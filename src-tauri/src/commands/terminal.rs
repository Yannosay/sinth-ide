use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::state::{PtySession, TerminalState};

#[derive(Clone, Serialize)]
struct TerminalOutput {
    id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
struct TerminalExit {
    id: u32,
}

/// Decodes the complete UTF-8 prefix of `pending` and keeps a trailing partial sequence
/// for the next read, so multi-byte characters split across reads are not garbled.
fn take_utf8(pending: &mut Vec<u8>) -> String {
    match std::str::from_utf8(pending) {
        Ok(s) => {
            let out = s.to_string();
            pending.clear();
            out
        }
        Err(e) => {
            let valid = e.valid_up_to();
            if e.error_len().is_none() && pending.len() - valid < 4 {
                let out = String::from_utf8_lossy(&pending[..valid]).into_owned();
                pending.drain(..valid);
                out
            } else {
                let out = String::from_utf8_lossy(pending).into_owned();
                pending.clear();
                out
            }
        }
    }
}

fn which(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var).map(|dir| dir.join(name)).find(|c| c.is_file())
}

fn home_dir() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
    } else {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

fn resolve_shell(preferred: Option<String>) -> (String, Vec<String>) {
    if let Some(s) = preferred {
        if !s.trim().is_empty() {
            return (s, Vec::new());
        }
    }
    if cfg!(windows) {
        if let Some(p) = which("pwsh.exe") {
            return (p.to_string_lossy().into_owned(), vec!["-NoLogo".to_string()]);
        }
        if let Some(p) = which("powershell.exe") {
            return (p.to_string_lossy().into_owned(), vec!["-NoLogo".to_string()]);
        }
        let comspec = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
        (comspec, Vec::new())
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        (shell, vec!["-l".to_string()])
    }
}

fn resolve_cwd(preferred: &str) -> String {
    if !preferred.trim().is_empty() {
        let p = std::path::Path::new(preferred);
        if p.is_dir() {
            return preferred.to_string();
        }
    }
    if let Some(home) = home_dir() {
        if home.is_dir() {
            return home.to_string_lossy().into_owned();
        }
    }
    std::env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| ".".to_string())
}

#[tauri::command]
pub async fn spawn_terminal(
    app: AppHandle,
    state: State<'_, TerminalState>,
    cwd: String,
    shell: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let id = state.next_id.fetch_add(1, Ordering::SeqCst);
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(4),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("openpty: {e}"))?;

    let (shell_bin, shell_args) = resolve_shell(shell);
    let resolved_cwd = resolve_cwd(&cwd);

    let mut cmd = CommandBuilder::new(&shell_bin);
    for a in &shell_args {
        cmd.arg(a);
    }
    cmd.cwd(&resolved_cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if let Some(shims) = crate::commands::compilers::ensure_shims(&app) {
        let current = std::env::var_os("PATH").unwrap_or_default();
        let paths = std::iter::once(shims).chain(std::env::split_paths(&current));
        if let Ok(joined) = std::env::join_paths(paths) {
            cmd.env("PATH", joined);
        }
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn: {e}"))?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| format!("clone_reader: {e}"))?;
    let writer = pair.master.take_writer().map_err(|e| format!("take_writer: {e}"))?;

    let writer: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(writer));
    let child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>> = Arc::new(Mutex::new(child));

    let sessions = state.sessions.clone();
    sessions.lock().map_err(|e| format!("lock: {e}"))?.insert(
        id,
        PtySession {
            master: pair.master,
            writer: writer.clone(),
            child: child.clone(),
        },
    );

    let app_reader = app.clone();
    let sessions_reader = sessions.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let mut pending: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    let text = take_utf8(&mut pending);
                    if !text.is_empty() {
                        let _ = app_reader.emit("terminal-output", TerminalOutput { id, data: text });
                    }
                }
                Err(_) => break,
            }
        }
        if !pending.is_empty() {
            let _ = app_reader.emit("terminal-output", TerminalOutput { id, data: String::from_utf8_lossy(&pending).into_owned() });
        }
        let _ = app_reader.emit("terminal-exit", TerminalExit { id });
        if let Ok(mut map) = sessions_reader.lock() {
            map.remove(&id);
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn write_terminal(state: State<'_, TerminalState>, id: u32, data: String) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| format!("lock: {e}"))?;
    let session = sessions.get(&id).ok_or_else(|| "TERMINAL_EXITED".to_string())?;
    let mut w = session.writer.lock().map_err(|e| format!("lock writer: {e}"))?;
    w.write_all(data.as_bytes()).map_err(|e| format!("write: {e}"))?;
    w.flush().map_err(|e| format!("flush: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn resize_terminal(state: State<'_, TerminalState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| format!("lock: {e}"))?;
    let Some(session) = sessions.get(&id) else { return Ok(()) };
    session
        .master
        .resize(PtySize {
            rows: rows.max(4),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("resize: {e}"))
}

#[tauri::command]
pub async fn kill_terminal(state: State<'_, TerminalState>, id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| format!("lock: {e}"))?;
    if let Some(session) = sessions.remove(&id) {
        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::take_utf8;

    #[test]
    fn keeps_split_multibyte_characters() {
        let bytes = "a➜b".as_bytes();
        let mut pending = bytes[..2].to_vec();
        assert_eq!(take_utf8(&mut pending), "a");
        pending.extend_from_slice(&bytes[2..]);
        assert_eq!(take_utf8(&mut pending), "➜b");
        assert!(pending.is_empty());
    }

    #[test]
    fn replaces_invalid_bytes() {
        let mut pending = vec![b'x', 0xff, b'y'];
        assert_eq!(take_utf8(&mut pending), "x�y");
    }
}
