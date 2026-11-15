use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    #[serde(default, rename = "baseUrl", alias = "base_url")]
    pub base_url: Option<String>,
    pub files: Vec<ManifestEntry>,
}

#[derive(Debug, Clone)]
pub struct LocalState {
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdatePlan {
    #[serde(skip)]
    pub to_download: Vec<ManifestEntry>,
    pub up_to_date: usize,
    pub to_download_count: usize,
    pub bytes_to_download: u64,
    pub bytes_total: u64,
}

/// Pure diff: a file is skipped only when BOTH size and hash match. Side-effect
/// free so it is unit-tested without a filesystem. This is what keeps CDN
/// traffic minimal — only missing/changed files end up in `to_download`.
pub fn diff_manifest(local: &HashMap<String, LocalState>, manifest: &Manifest) -> UpdatePlan {
    let mut to_download = Vec::new();
    let (mut up_to_date, mut bytes_to_download, mut bytes_total) = (0usize, 0u64, 0u64);
    for f in &manifest.files {
        bytes_total += f.size;
        match local.get(&f.path) {
            Some(cur) if cur.size == f.size && cur.sha256.eq_ignore_ascii_case(&f.sha256) => {
                up_to_date += 1;
            }
            _ => {
                bytes_to_download += f.size;
                to_download.push(f.clone());
            }
        }
    }
    UpdatePlan {
        to_download_count: to_download.len(),
        to_download,
        up_to_date,
        bytes_to_download,
        bytes_total,
    }
}

pub fn hash_file(path: &Path) -> std::io::Result<String> {
    let mut f = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Build the local-state map for files named in the manifest. Only hashes a
/// file when its size matches (cheap size check first → less disk IO).
pub fn scan_local(game_dir: &Path, manifest: &Manifest) -> HashMap<String, LocalState> {
    let mut out = HashMap::new();
    for f in &manifest.files {
        let p = game_dir.join(&f.path);
        let Ok(meta) = std::fs::metadata(&p) else { continue };
        let size = meta.len();
        if size != f.size {
            out.insert(f.path.clone(), LocalState { size, sha256: String::new() });
            continue;
        }
        if let Ok(h) = hash_file(&p) {
            out.insert(f.path.clone(), LocalState { size, sha256: h });
        }
    }
    out
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub file: String,
    pub index: usize,
    pub total: usize,
    pub bytes_done: u64,
    pub bytes_total: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum UpdateError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("http {0}: {1}")]
    Http(u16, String),
    #[error("network: {0}")]
    Net(#[from] reqwest::Error),
    #[error("checksum mismatch: {0}")]
    Checksum(String),
}

/// Download the planned files with HTTP Range **resume** and SHA-256
/// verification. Partial `.part` files are continued, not refetched. Calls
/// `on_progress` as bytes land. Sequential (gentle on CDN); the Tauri layer can
/// run it on a background task.
pub async fn run_update<F: FnMut(Progress)>(
    client: &reqwest::Client,
    game_dir: &Path,
    manifest: &Manifest,
    plan: &UpdatePlan,
    mut on_progress: F,
) -> Result<(), UpdateError> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let base = manifest.base_url.clone().unwrap_or_default();
    let total = plan.to_download.len();
    let bytes_total = plan.bytes_to_download;
    let mut bytes_done = 0u64;

    for (i, entry) in plan.to_download.iter().enumerate() {
        let dest = game_dir.join(&entry.path);
        let part = dest.with_extension(format!(
            "{}part",
            dest.extension().map(|e| format!("{}.", e.to_string_lossy())).unwrap_or_default()
        ));
        if let Some(dir) = dest.parent() { tokio::fs::create_dir_all(dir).await?; }

        let mut have = tokio::fs::metadata(&part).await.map(|m| m.len()).unwrap_or(0);
        if have > entry.size { have = 0; }

        if have < entry.size {
            let url = entry.url.clone().unwrap_or_else(|| format!("{base}{}", entry.path));
            let mut req = client.get(&url);
            if have > 0 { req = req.header("Range", format!("bytes={have}-")); }
            let res = req.send().await?;
            let status = res.status();
            if !status.is_success() && status.as_u16() != 206 {
                return Err(UpdateError::Http(status.as_u16(), entry.path.clone()));
            }
            let mut file = tokio::fs::OpenOptions::new()
                .create(true).append(have > 0).write(true).truncate(have == 0)
                .open(&part).await?;
            let mut stream = res.bytes_stream();
            while let Some(chunk) = stream.next().await {
                let chunk = chunk?;
                file.write_all(&chunk).await?;
                bytes_done += chunk.len() as u64;
                on_progress(Progress { file: entry.path.clone(), index: i + 1, total, bytes_done, bytes_total });
            }
            file.flush().await?;
        }

        let got = hash_file(&part)?;
        if !got.eq_ignore_ascii_case(&entry.sha256) {
            return Err(UpdateError::Checksum(entry.path.clone()));
        }
        tokio::fs::rename(&part, &dest).await?;
        on_progress(Progress { file: entry.path.clone(), index: i + 1, total, bytes_done, bytes_total });
    }
    Ok(())
}
