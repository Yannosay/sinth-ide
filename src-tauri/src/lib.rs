mod commands;
mod state;

use state::TerminalState;

/// GUI apps on macOS and Linux start with a minimal PATH, so Node.js installed through
/// Homebrew, nvm, fnm or Volta would not be found. Ask the login shell for the real PATH.
#[cfg(unix)]
fn inherit_login_shell_path() {
    use std::process::{Command, Stdio};
    const MARK: &str = "__SINTH_PATH__";
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    let Ok(out) = Command::new(&shell)
        .args(["-ilc", "printf '__SINTH_PATH__%s' \"$PATH\""])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
    else {
        return;
    };
    let text = String::from_utf8_lossy(&out.stdout);
    if let Some(idx) = text.rfind(MARK) {
        let path = text[idx + MARK.len()..].trim();
        if !path.is_empty() {
            std::env::set_var("PATH", path);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(unix)]
    inherit_login_shell_path();
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_directory_tree,
            commands::fs::read_directory,
            commands::fs::read_text_file,
            commands::fs::write_text_file,
            commands::fs::search_in_folder,
            commands::files::create_file,
            commands::files::create_directory,
            commands::files::rename_path,
            commands::files::delete_path,
            commands::system::check_node_runtime,
            commands::terminal::spawn_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::kill_terminal,
            commands::compilers::list_available_compilers,
            commands::compilers::list_installed_compilers,
            commands::compilers::install_compiler,
            commands::compilers::uninstall_compiler,
            commands::compilers::activate_compiler,
            commands::sinth::sinth_check,
            commands::sinth::resolve_sinth,
        ])
        .run(tauri::generate_context!())
        .expect("fatal: tauri runtime initialization failed");
}