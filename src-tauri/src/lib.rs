mod commands;
mod state;

use state::TerminalState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        ])
        .run(tauri::generate_context!())
        .expect("fatal: tauri runtime initialization failed");
}