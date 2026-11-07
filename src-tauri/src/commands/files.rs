use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub async fn create_file(path: String, content: Option<String>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        return Err(format!("already exists: {path}"));
    }
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
        }
    }
    let body = content.unwrap_or_default();
    fs::write(&p, body.as_bytes()).map_err(|e| format!("write: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        return Err(format!("already exists: {path}"));
    }
    fs::create_dir_all(&p).map_err(|e| format!("mkdir: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn rename_path(from: String, to: String) -> Result<(), String> {
    let src = PathBuf::from(&from);
    let dst = PathBuf::from(&to);
    if !src.exists() {
        return Err(format!("source does not exist: {from}"));
    }
    if dst.exists() {
        return Err(format!("destination exists: {to}"));
    }
    if let Some(parent) = dst.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
        }
    }
    fs::rename(&src, &dst).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("not found: {path}"));
    }
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| format!("rmdir: {e}"))?;
    } else {
        fs::remove_file(&p).map_err(|e| format!("rmfile: {e}"))?;
    }
    Ok(())
}