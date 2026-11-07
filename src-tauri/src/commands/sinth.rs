use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::{AppHandle, Manager};

fn active_compiler_entry(app: &AppHandle) -> Option<PathBuf> {
    let base = app.path().app_data_dir().ok()?;
    let version = std::fs::read_to_string(base.join("active-compiler")).ok()?;
    let version = version.trim();
    crate::commands::compilers::validate_version(version).ok()?;
    let entry = base.join("compilers").join(version).join("bin").join("sinth.js");
    entry.is_file().then_some(entry)
}

fn compiler_for(app: &AppHandle, root: &Path) -> Option<PathBuf> {
    let local = root.join("node_modules").join("@yannosay").join("sinth").join("bin").join("sinth.js");
    if local.is_file() {
        return Some(local);
    }
    active_compiler_entry(app)
}

#[tauri::command]
pub async fn sinth_check(app: AppHandle, root: String) -> Result<String, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("not a directory: {root}"));
    }
    let entry = compiler_for(&app, &root_path).ok_or_else(|| "no Sinth compiler found; install one in the Compilers panel".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let node = if cfg!(windows) { "node.exe" } else { "node" };
        let mut cmd = Command::new(node);
        cmd.arg(&entry).args(["check", "--json", "--root"]).arg(&root_path).current_dir(&root_path).env("NO_COLOR", "1");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        let out = cmd.output().map_err(|e| format!("could not run node: {e}"))?;
        let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
        if stdout.trim_start().starts_with('{') {
            Ok(stdout)
        } else {
            Err(String::from_utf8_lossy(&out.stderr).lines().last().unwrap_or("sinth check failed").to_string())
        }
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}
