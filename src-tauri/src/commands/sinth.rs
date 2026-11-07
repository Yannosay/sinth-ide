use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, Manager};

/// Where the Sinth compiler used for a project comes from.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum CompilerSource {
    /// `node_modules/@yannosay/sinth` inside the project.
    Project,
    /// A version installed from the Compilers panel.
    Managed,
    /// A global `npm install -g @yannosay/sinth`.
    Global,
}

#[derive(Serialize)]
pub struct ResolvedCompiler {
    source: Option<CompilerSource>,
    /// Absolute path to `bin/sinth.js`, run with `node`.
    entry: Option<String>,
    version: Option<String>,
    node: Option<String>,
}

pub fn which(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    let names: Vec<String> = if cfg!(windows) {
        vec![format!("{name}.exe"), format!("{name}.cmd"), name.to_string()]
    } else {
        vec![name.to_string()]
    };
    for dir in std::env::split_paths(&path_var) {
        for n in &names {
            let candidate = dir.join(n);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn active_compiler_entry(app: &AppHandle) -> Option<PathBuf> {
    let base = app.path().app_data_dir().ok()?;
    let version = std::fs::read_to_string(base.join("active-compiler")).ok()?;
    let version = version.trim();
    crate::commands::compilers::validate_version(version).ok()?;
    let entry = base.join("compilers").join(version).join("bin").join("sinth.js");
    entry.is_file().then_some(entry)
}

fn global_compiler_entry() -> Option<PathBuf> {
    let shim = which("sinth")?;
    let real = std::fs::canonicalize(&shim).unwrap_or(shim.clone());
    if real.file_name().is_some_and(|n| n == "sinth.js") {
        return Some(real);
    }
    let dir = shim.parent()?;
    let candidates = [
        dir.join("node_modules").join("@yannosay").join("sinth").join("bin").join("sinth.js"),
        dir.join("..").join("lib").join("node_modules").join("@yannosay").join("sinth").join("bin").join("sinth.js"),
    ];
    candidates.into_iter().find(|c| c.is_file())
}

/// Searches upwards so a file opened in a sub-folder still uses the project's compiler.
fn project_compiler_entry(root: &Path) -> Option<PathBuf> {
    let mut dir = Some(root);
    while let Some(d) = dir {
        let local = d.join("node_modules").join("@yannosay").join("sinth").join("bin").join("sinth.js");
        if local.is_file() {
            return Some(local);
        }
        dir = d.parent();
    }
    None
}

pub fn compiler_for(app: &AppHandle, root: &Path) -> Option<(CompilerSource, PathBuf)> {
    if let Some(p) = project_compiler_entry(root) {
        return Some((CompilerSource::Project, p));
    }
    if let Some(p) = active_compiler_entry(app) {
        return Some((CompilerSource::Managed, p));
    }
    global_compiler_entry().map(|p| (CompilerSource::Global, p))
}

fn package_version(entry: &Path) -> Option<String> {
    let pkg = entry.parent()?.parent()?.join("package.json");
    let raw = std::fs::read_to_string(pkg).ok()?;
    let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
    json.get("version")?.as_str().map(str::to_string)
}

pub fn node_binary() -> Option<PathBuf> {
    which("node")
}

#[tauri::command]
pub async fn resolve_sinth(app: AppHandle, root: String) -> Result<ResolvedCompiler, String> {
    let found = compiler_for(&app, Path::new(&root));
    Ok(ResolvedCompiler {
        source: found.as_ref().map(|f| f.0),
        version: found.as_ref().and_then(|f| package_version(&f.1)),
        entry: found.map(|f| f.1.to_string_lossy().into_owned()),
        node: node_binary().map(|p| p.to_string_lossy().into_owned()),
    })
}

#[tauri::command]
pub async fn sinth_check(app: AppHandle, root: String) -> Result<String, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Folder not found: {root}"));
    }
    let (_, entry) = compiler_for(&app, &root_path).ok_or_else(|| "NO_COMPILER".to_string())?;
    let node = node_binary().ok_or_else(|| "NO_NODE".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new(node);
        cmd.arg(&entry).args(["check", "--json", "--root"]).arg(&root_path).current_dir(&root_path).env("NO_COLOR", "1");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        let out = cmd.output().map_err(|e| format!("Could not run Node.js: {e}"))?;
        let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
        if stdout.trim_start().starts_with('{') {
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&out.stderr);
            let line = stderr.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("sinth check failed");
            Err(line.trim().to_string())
        }
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_project_compiler_in_parent_folders() {
        let dir = std::env::temp_dir().join(format!("sinth-ide-test-{}", std::process::id()));
        let bin = dir.join("node_modules/@yannosay/sinth/bin");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join("sinth.js"), "").unwrap();
        let nested = dir.join("pages/blog");
        std::fs::create_dir_all(&nested).unwrap();
        assert_eq!(project_compiler_entry(&nested).unwrap(), bin.join("sinth.js"));
        std::fs::remove_dir_all(&dir).ok();
    }
}
