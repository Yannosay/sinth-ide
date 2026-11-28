use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified_ms: u64,
    pub has_children: bool,
    pub children: Option<Vec<FileNode>>,
}

const MAX_CHILDREN: usize = 500;

fn system_time_ms(t: std::io::Result<std::time::SystemTime>) -> u64 {
    match t.ok().and_then(|s| s.duration_since(UNIX_EPOCH).ok()) {
        Some(d) => d.as_millis() as u64,
        None => 0,
    }
}

/// Folders and files that are never useful in the explorer, quick open or search.
fn is_hidden(name: &str) -> bool {
    matches!(name, ".git" | ".hg" | ".svn" | "node_modules" | "target" | ".DS_Store" | "Thumbs.db" | ".vercel" | ".wrangler" | ".sinth")
}

fn list_dir(path: &Path) -> Result<Vec<FileNode>, String> {
    let entries = fs::read_dir(path).map_err(|e| format!("read_dir: {e}"))?;
    let mut out: Vec<FileNode> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_hidden(&name) {
            continue;
        }
        let full = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let is_dir = meta.is_dir();
        let size = if is_dir { 0 } else { meta.len() };
        let modified_ms = system_time_ms(meta.modified());
        let has_children = if is_dir {
            fs::read_dir(&full).map(|it| it.flatten().any(|_| true)).unwrap_or(false)
        } else {
            false
        };
        out.push(FileNode {
            name,
            path: full.to_string_lossy().into_owned(),
            is_directory: is_dir,
            size,
            modified_ms,
            has_children,
            children: if is_dir { Some(Vec::new()) } else { None },
        });
        if out.len() >= MAX_CHILDREN {
            break;
        }
    }
    out.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(out)
}

fn build_tree(path: &Path, depth: usize) -> Result<Vec<FileNode>, String> {
    let mut nodes = list_dir(path)?;
    if depth >= 1 {
        for n in nodes.iter_mut() {
            n.children = None;
        }
        return Ok(nodes);
    }
    for n in nodes.iter_mut() {
        if n.is_directory {
            let p = PathBuf::from(&n.path);
            if let Ok(children) = build_tree(&p, depth + 1) {
                n.children = Some(children);
            }
        }
    }
    Ok(nodes)
}

/// Windows canonical paths start with `\\?\`; shells, Node and people expect the plain form.
fn strip_verbatim(p: &str) -> String {
    if let Some(rest) = p.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    p.strip_prefix(r"\\?\").unwrap_or(p).to_string()
}

#[tauri::command]
pub async fn read_directory_tree(path: String) -> Result<serde_json::Value, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("path does not exist: {path}"));
    }
    if !p.is_dir() {
        return Err(format!("not a directory: {path}"));
    }
    let tree = build_tree(&p, 0)?;
    let canonical = fs::canonicalize(&p)
        .map(|c| strip_verbatim(&c.to_string_lossy()))
        .unwrap_or(path);
    Ok(serde_json::json!({ "path": canonical, "tree": tree }))
}

#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(format!("not a directory: {path}"));
    }
    list_dir(&p)
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let bytes = fs::read(&p).map_err(|e| format!("read: {e}"))?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err("file too large to open in editor".into());
    }
    let (decoded, _, _) = encoding_rs::UTF_8.decode(&bytes);
    Ok(decoded.into_owned())
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
        }
    }
    fs::write(&p, content.as_bytes()).map_err(|e| format!("write: {e}"))?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub preview: String,
}

const MAX_HITS: usize = 500;
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;

#[tauri::command]
pub async fn search_in_folder(path: String, query: String, case_sensitive: bool) -> Result<Vec<SearchHit>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let needle = if case_sensitive { query.clone() } else { query.to_lowercase() };
    let mut hits: Vec<SearchHit> = Vec::new();
    for entry in walkdir::WalkDir::new(&path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let n = e.file_name().to_string_lossy();
            e.depth() == 0 || !(is_hidden(&n) || n == "dist")
        })
        .flatten()
    {
        if hits.len() >= MAX_HITS {
            break;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.len() > MAX_FILE_BYTES {
            continue;
        }
        let bytes = match fs::read(entry.path()) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let (text, _, had_errors) = encoding_rs::UTF_8.decode(&bytes);
        if had_errors && text.chars().filter(|c| *c == '\u{FFFD}').count() > 8 {
            continue;
        }
        for (idx, line) in text.lines().enumerate() {
            let hay = if case_sensitive { line.to_string() } else { line.to_lowercase() };
            if let Some(col) = hay.find(&needle) {
                hits.push(SearchHit {
                    path: entry.path().to_string_lossy().into_owned(),
                    line: idx + 1,
                    column: col + 1,
                    preview: line.trim().chars().take(200).collect(),
                });
                if hits.len() >= MAX_HITS {
                    break;
                }
            }
        }
    }
    Ok(hits)
}
const MAX_LISTED_FILES: usize = 20_000;

/// Every file below `path` (relative, forward slashes) for quick open. Skips the folders the explorer hides and build output.
#[tauri::command]
pub async fn list_files(path: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("not a directory: {path}"));
    }
    let mut out: Vec<String> = Vec::new();
    for entry in walkdir::WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let n = e.file_name().to_string_lossy();
            e.depth() == 0 || !(is_hidden(&n) || n == "dist")
        })
        .flatten()
    {
        if !entry.file_type().is_file() {
            continue;
        }
        if let Ok(rel) = entry.path().strip_prefix(&root) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
        if out.len() >= MAX_LISTED_FILES {
            break;
        }
    }
    out.sort();
    Ok(out)
}
