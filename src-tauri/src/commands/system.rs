use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeInfo {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

#[tauri::command]
pub async fn check_node_runtime() -> Result<NodeInfo, String> {
    let name = if cfg!(windows) { "node.exe" } else { "node" };
    match Command::new(name).arg("--version").output() {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let path = which_node(name);
            Ok(NodeInfo { available: true, version: Some(version), path })
        }
        _ => Ok(NodeInfo { available: false, version: None, path: None }),
    }
}

fn which_node(name: &str) -> Option<String> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().into_owned());
        }
        if cfg!(windows) {
            let alt = dir.join("node.exe");
            if alt.is_file() {
                return Some(alt.to_string_lossy().into_owned());
            }
        }
    }
    None
}