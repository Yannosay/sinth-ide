use std::path::{Path, PathBuf};
use std::process::Command;

use base64::Engine;
use flate2::read::GzDecoder;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

const REGISTRY_URL: &str = "https://registry.npmjs.org/@yannosay%2Fsinth";
const TARBALL_PREFIX: &str = "https://registry.npmjs.org/@yannosay/sinth/-/";
const PACKAGE_NAME: &str = "@yannosay/sinth";
const USER_AGENT: &str = concat!("sinth-ide/", env!("CARGO_PKG_VERSION"));
const MAX_TARBALL_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompilerVersion {
    pub version: String,
    pub tarball_url: String,
    pub shasum: String,
    pub published_at: String,
    pub description: String,
    pub deprecated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledCompiler {
    pub version: String,
    pub path: String,
    pub installed_at: String,
    pub size_bytes: u64,
    pub active: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    version: String,
    stage: String,
    bytes_received: u64,
    bytes_total: u64,
    message: String,
}

fn emit_progress(app: &AppHandle, version: &str, stage: &str, received: u64, total: u64, message: &str) {
    let _ = app.emit(
        "compiler-install-progress",
        ProgressPayload {
            version: version.to_string(),
            stage: stage.to_string(),
            bytes_received: received,
            bytes_total: total,
            message: message.to_string(),
        },
    );
}

pub fn validate_version(version: &str) -> Result<(), String> {
    let ok = !version.is_empty()
        && version.len() <= 64
        && version.chars().next().is_some_and(|c| c.is_ascii_digit())
        && version.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '+' || c == '_')
        && !version.contains("..");
    if ok {
        Ok(())
    } else {
        Err(format!("invalid version string: {version}"))
    }
}

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&base).map_err(|e| format!("mkdir: {e}"))?;
    Ok(base)
}

fn compilers_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app_data_root(app)?.join("compilers");
    std::fs::create_dir_all(&root).map_err(|e| format!("mkdir: {e}"))?;
    Ok(root)
}

pub fn shim_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_root(app)?.join("bin");
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {e}"))?;
    Ok(dir)
}

fn active_marker(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join("active-compiler"))
}

fn read_active(app: &AppHandle) -> Option<String> {
    let p = active_marker(app).ok()?;
    let v = std::fs::read_to_string(p).ok()?.trim().to_string();
    if validate_version(&v).is_ok() {
        Some(v)
    } else {
        None
    }
}

fn write_shims(app: &AppHandle, version: &str) -> Result<(), String> {
    let entry = compilers_root(app)?.join(version).join("bin").join("sinth.js");
    if !entry.is_file() {
        return Err(format!("Sinth {version} is missing bin/sinth.js"));
    }
    let dir = shim_dir(app)?;
    let entry_str = entry.to_string_lossy();
    std::fs::write(dir.join("sinth.cmd"), format!("@echo off\r\nnode \"{entry_str}\" %*\r\n")).map_err(|e| format!("write shim: {e}"))?;
    let unix = dir.join("sinth");
    std::fs::write(&unix, format!("#!/bin/sh\nexec node \"{entry_str}\" \"$@\"\n")).map_err(|e| format!("write shim: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&unix, std::fs::Permissions::from_mode(0o755)).map_err(|e| format!("chmod: {e}"))?;
    }
    Ok(())
}

fn write_active(app: &AppHandle, version: &str) -> Result<(), String> {
    write_shims(app, version)?;
    let p = active_marker(app)?;
    std::fs::write(&p, version).map_err(|e| format!("write active: {e}"))
}

pub fn ensure_shims(app: &AppHandle) -> Option<PathBuf> {
    let active = read_active(app)?;
    let dir = shim_dir(app).ok()?;
    if !dir.join("sinth.cmd").is_file() {
        write_shims(app, &active).ok()?;
    }
    Some(dir)
}

fn dir_size(path: &Path) -> u64 {
    walkdir::WalkDir::new(path)
        .into_iter()
        .flatten()
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

fn semver_key(v: &str) -> (u64, u64, u64, bool) {
    let mut split = v.splitn(2, ['-', '+']);
    let core = split.next().unwrap_or(v);
    let is_release = split.next().is_none();
    let mut parts = core.split('.');
    let mut next = || parts.next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    (next(), next(), next(), is_release)
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .https_only(true)
        .build()
        .map_err(|e| format!("client: {e}"))
}

async fn fetch_registry() -> Result<serde_json::Value, String> {
    let resp = http_client()?.get(REGISTRY_URL).send().await.map_err(|e| format!("request: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("registry returned {}", resp.status()));
    }
    resp.json().await.map_err(|e| format!("json: {e}"))
}

#[tauri::command]
pub async fn list_available_compilers() -> Result<Vec<CompilerVersion>, String> {
    let body = fetch_registry().await?;
    let versions_obj = body
        .get("versions")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "registry payload missing versions".to_string())?;
    let time_obj = body.get("time").and_then(|v| v.as_object());

    let mut out: Vec<CompilerVersion> = Vec::with_capacity(versions_obj.len());
    for (version, meta) in versions_obj {
        if validate_version(version).is_err() {
            continue;
        }
        let dist = meta.get("dist").cloned().unwrap_or(serde_json::Value::Null);
        let tarball = dist.get("tarball").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let shasum = dist.get("shasum").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        if !tarball.starts_with(TARBALL_PREFIX) {
            continue;
        }
        let description = meta.get("description").and_then(|v| v.as_str()).unwrap_or(PACKAGE_NAME).to_string();
        let deprecated = meta.get("deprecated").map(|v| !v.is_null()).unwrap_or(false);
        let published_at = time_obj.and_then(|t| t.get(version)).and_then(|v| v.as_str()).unwrap_or("").to_string();
        out.push(CompilerVersion { version: version.clone(), tarball_url: tarball, shasum, published_at, description, deprecated });
    }
    out.sort_by_key(|v| std::cmp::Reverse(semver_key(&v.version)));
    Ok(out)
}

#[tauri::command]
pub async fn list_installed_compilers(app: AppHandle) -> Result<serde_json::Value, String> {
    let root = compilers_root(&app)?;
    let active = read_active(&app);
    let mut installed: Vec<InstalledCompiler> = Vec::new();
    for entry in std::fs::read_dir(&root).map_err(|e| format!("read_dir: {e}"))?.flatten() {
        let path = entry.path();
        let version = entry.file_name().to_string_lossy().into_owned();
        if !path.is_dir() || validate_version(&version).is_err() {
            continue;
        }
        let installed_at = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs().to_string())
            .unwrap_or_default();
        installed.push(InstalledCompiler {
            active: active.as_deref() == Some(version.as_str()),
            size_bytes: dir_size(&path),
            path: path.to_string_lossy().into_owned(),
            installed_at,
            version,
        });
    }
    installed.sort_by_key(|c| std::cmp::Reverse(semver_key(&c.version)));
    Ok(serde_json::json!({ "installed": installed, "active": active }))
}

fn verify_integrity(bytes: &[u8], integrity: Option<&str>, shasum: Option<&str>) -> Result<(), String> {
    if let Some(sri) = integrity.and_then(|s| s.split_whitespace().find(|p| p.starts_with("sha512-"))) {
        let expected = base64::engine::general_purpose::STANDARD
            .decode(&sri["sha512-".len()..])
            .map_err(|e| format!("bad integrity value: {e}"))?;
        let actual = Sha512::digest(bytes);
        if actual.as_slice() != expected.as_slice() {
            return Err("integrity check failed: the downloaded package does not match the registry checksum".into());
        }
        return Ok(());
    }
    if shasum.is_some() {
        return Err("registry did not provide a sha512 integrity hash; refusing to install".into());
    }
    Err("registry did not provide an integrity hash; refusing to install".into())
}

fn npm_command() -> Command {
    if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/d", "/s", "/c", "npm.cmd"]);
        c
    } else {
        Command::new("npm")
    }
}

fn install_dependencies(dir: &Path) -> Result<(), String> {
    let pkg: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(dir.join("package.json")).map_err(|e| format!("read package.json: {e}"))?,
    )
    .map_err(|e| format!("parse package.json: {e}"))?;
    let has_deps = pkg.get("dependencies").and_then(|d| d.as_object()).is_some_and(|d| !d.is_empty());
    if !has_deps {
        return Ok(());
    }
    let out = npm_command()
        .args(["install", "--omit=dev", "--no-audit", "--no-fund", "--no-package-lock", "--loglevel=error"])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("could not run npm (is Node.js installed?): {e}"))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("npm install failed: {}", stderr.lines().last().unwrap_or("unknown error")));
    }
    Ok(())
}

#[tauri::command]
pub async fn install_compiler(app: AppHandle, version: String) -> Result<(), String> {
    validate_version(&version)?;
    emit_progress(&app, &version, "resolving", 0, 0, "Resolving version metadata");

    let fail = |app: &AppHandle, msg: String| -> String {
        emit_progress(app, &version, "error", 0, 0, &msg);
        msg
    };

    let body = fetch_registry().await.map_err(|e| fail(&app, e))?;
    let meta = body
        .get("versions")
        .and_then(|v| v.get(&version))
        .ok_or_else(|| fail(&app, format!("version {version} is not published")))?;
    let dist = meta.get("dist").ok_or_else(|| fail(&app, "missing dist metadata".into()))?;
    let tarball_url = dist.get("tarball").and_then(|t| t.as_str()).unwrap_or_default().to_string();
    if !tarball_url.starts_with(TARBALL_PREFIX) {
        return Err(fail(&app, format!("unexpected tarball location: {tarball_url}")));
    }
    let integrity = dist.get("integrity").and_then(|v| v.as_str()).map(str::to_string);
    let shasum = dist.get("shasum").and_then(|v| v.as_str()).map(str::to_string);

    let root = compilers_root(&app)?;
    let target_dir = root.join(&version);
    let staging = root.join(format!(".staging-{version}"));
    if staging.exists() {
        std::fs::remove_dir_all(&staging).map_err(|e| format!("clean staging: {e}"))?;
    }
    std::fs::create_dir_all(&staging).map_err(|e| format!("mkdir staging: {e}"))?;

    let result = async {
        emit_progress(&app, &version, "downloading", 0, 0, "Downloading package");
        let dl = http_client()?.get(&tarball_url).send().await.map_err(|e| format!("download: {e}"))?;
        if !dl.status().is_success() {
            return Err(format!("download returned {}", dl.status()));
        }
        let total = dl.content_length().unwrap_or(0);
        if total > MAX_TARBALL_BYTES {
            return Err("package is unexpectedly large".to_string());
        }
        let tmp_tarball = staging.join("package.tgz");
        let mut file = tokio::fs::File::create(&tmp_tarball).await.map_err(|e| format!("create tarball: {e}"))?;
        let mut received: u64 = 0;
        let mut stream = dl.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let bytes = chunk.map_err(|e| format!("stream: {e}"))?;
            received += bytes.len() as u64;
            if received > MAX_TARBALL_BYTES {
                return Err("package is unexpectedly large".to_string());
            }
            file.write_all(&bytes).await.map_err(|e| format!("write tarball: {e}"))?;
            emit_progress(&app, &version, "downloading", received, total, "Downloading package");
        }
        file.flush().await.map_err(|e| format!("flush: {e}"))?;
        drop(file);

        emit_progress(&app, &version, "verifying", received, total, "Verifying sha512 integrity");
        let bytes = std::fs::read(&tmp_tarball).map_err(|e| format!("read tarball: {e}"))?;
        verify_integrity(&bytes, integrity.as_deref(), shasum.as_deref())?;

        emit_progress(&app, &version, "extracting", received, total, "Extracting package");
        let extract_root = staging.join("extract");
        std::fs::create_dir_all(&extract_root).map_err(|e| format!("mkdir extract: {e}"))?;
        let mut archive = tar::Archive::new(GzDecoder::new(&bytes[..]));
        archive.set_preserve_permissions(false);
        archive.set_unpack_xattrs(false);
        archive.unpack(&extract_root).map_err(|e| format!("unpack: {e}"))?;
        let package_dir = extract_root.join("package");
        if !package_dir.join("package.json").is_file() {
            return Err("archive does not contain package/package.json".to_string());
        }

        emit_progress(&app, &version, "dependencies", received, total, "Installing dependencies");
        let dir = package_dir.clone();
        tokio::task::spawn_blocking(move || install_dependencies(&dir)).await.map_err(|e| format!("join: {e}"))??;

        if target_dir.exists() {
            std::fs::remove_dir_all(&target_dir).map_err(|e| format!("clean target: {e}"))?;
        }
        std::fs::rename(&package_dir, &target_dir).map_err(|e| format!("rename: {e}"))?;
        Ok(received)
    }
    .await;

    std::fs::remove_dir_all(&staging).ok();
    let received = result.map_err(|e| fail(&app, e))?;

    emit_progress(&app, &version, "registering", received, received, "Registering version");
    if read_active(&app).is_none() {
        write_active(&app, &version)?;
    }
    emit_progress(&app, &version, "done", received, received, &format!("Sinth {version} installed"));
    Ok(())
}

#[tauri::command]
pub async fn uninstall_compiler(app: AppHandle, version: String) -> Result<(), String> {
    validate_version(&version)?;
    let target = compilers_root(&app)?.join(&version);
    if !target.exists() {
        return Err(format!("version {version} is not installed"));
    }
    if read_active(&app).as_deref() == Some(version.as_str()) {
        return Err("cannot remove the active version; switch to another version first".into());
    }
    std::fs::remove_dir_all(&target).map_err(|e| format!("remove: {e}"))
}

#[tauri::command]
pub async fn activate_compiler(app: AppHandle, version: String) -> Result<(), String> {
    validate_version(&version)?;
    if !compilers_root(&app)?.join(&version).is_dir() {
        return Err(format!("version {version} is not installed"));
    }
    write_active(&app, &version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_traversal_versions() {
        assert!(validate_version("5.0.0").is_ok());
        assert!(validate_version("5.0.0-beta.1").is_ok());
        assert!(validate_version("../../etc").is_err());
        assert!(validate_version("5.0.0/../../x").is_err());
        assert!(validate_version("").is_err());
        assert!(validate_version("a.b").is_err());
    }

    #[test]
    fn verifies_sha512() {
        let data = b"hello";
        let sri = format!("sha512-{}", base64::engine::general_purpose::STANDARD.encode(Sha512::digest(data)));
        assert!(verify_integrity(data, Some(&sri), None).is_ok());
        assert!(verify_integrity(b"tampered", Some(&sri), None).is_err());
        assert!(verify_integrity(data, None, Some("abc")).is_err());
    }

    #[test]
    fn orders_releases_above_prereleases() {
        assert!(semver_key("5.0.0") > semver_key("5.0.0-experimental_01"));
        assert!(semver_key("5.0.0") > semver_key("4.1.0"));
    }
}
