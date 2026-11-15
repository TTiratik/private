pub mod settings;
pub mod updater;

pub use settings::Settings;
pub use updater::{diff_manifest, hash_file, run_update, scan_local, Manifest, ManifestEntry, LocalState, Progress, UpdatePlan};

#[cfg(test)]
mod tests {
    use super::updater::*;
    use super::settings::Settings;
    use std::collections::HashMap;
    use std::io::Write;

    fn man() -> Manifest {
        Manifest {
            version: "1.0".into(),
            base_url: Some("https://cdn/".into()),
            files: vec![
                ManifestEntry { path: "a.pak".into(), size: 10, sha256: "aa".into(), url: None },
                ManifestEntry { path: "b.pak".into(), size: 20, sha256: "bb".into(), url: None },
                ManifestEntry { path: "c.pak".into(), size: 30, sha256: "cc".into(), url: None },
            ],
        }
    }

    #[test]
    fn diff_picks_only_missing_or_changed() {
        let mut local = HashMap::new();
        local.insert("a.pak".to_string(), LocalState { size: 10, sha256: "AA".into() }); // ok (case-insensitive)
        local.insert("b.pak".to_string(), LocalState { size: 20, sha256: "zz".into() }); // changed
        // c.pak missing
        let plan = diff_manifest(&local, &man());
        assert_eq!(plan.up_to_date, 1);
        let got: Vec<_> = plan.to_download.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(got, vec!["b.pak", "c.pak"]);
        assert_eq!(plan.bytes_to_download, 50);
        assert_eq!(plan.bytes_total, 60);
    }

    #[test]
    fn hash_and_scan() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("f.bin");
        std::fs::write(&p, b"abc").unwrap();
        // sha256("abc")
        assert_eq!(hash_file(&p).unwrap(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        let m = Manifest { version: "1".into(), base_url: None, files: vec![
            ManifestEntry { path: "f.bin".into(), size: 3, sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".into(), url: None },
            ManifestEntry { path: "missing".into(), size: 5, sha256: "00".into(), url: None },
        ]};
        let local = scan_local(dir.path(), &m);
        assert!(local.contains_key("f.bin"));
        assert!(!local.contains_key("missing"));
        assert_eq!(diff_manifest(&local, &m).up_to_date, 1);
    }

    #[test]
    fn settings_patch_merges_camel_and_snake() {
        let s = Settings::default()
            .apply_patch(&serde_json::json!({ "nickname": "romek" }))
            .apply_patch(&serde_json::json!({ "gamePath": "C:/Games" }))
            .apply_patch(&serde_json::json!({ "cdn_base_url": "https://cdn" }));
        assert_eq!(s.nickname, "romek");
        assert_eq!(s.game_path, "C:/Games");
        assert_eq!(s.cdn_base_url, "https://cdn");
    }

    #[test]
    fn settings_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("cfg/settings.json");
        let s = Settings { nickname: "n".into(), game_path: "g".into(), cdn_base_url: "c".into() };
        Settings::write(&p, &s).unwrap();
        assert_eq!(Settings::read(&p), s);
    }

    // Minimal HTTP/1.1 server honoring Range, to test resume+verify end-to-end.
    async fn serve_once(body: &'static [u8]) -> u16 {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            loop {
                let Ok((mut sock, _)) = listener.accept().await else { break };
                let mut buf = vec![0u8; 2048];
                let n = sock.read(&mut buf).await.unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]);
                let start = req.lines()
                    .find_map(|l| {
                        let ll = l.to_ascii_lowercase();
                        ll.strip_prefix("range: bytes=").map(|r| r.split('-').next().unwrap_or("").trim().to_string())
                    })
                    .and_then(|s| s.parse::<usize>().ok())
                    .unwrap_or(0);
                let slice = &body[start.min(body.len())..];
                let head = if start > 0 {
                    format!("HTTP/1.1 206 Partial Content\r\nContent-Length: {}\r\nContent-Range: bytes {}-{}/{}\r\nConnection: close\r\n\r\n",
                        slice.len(), start, body.len()-1, body.len())
                } else {
                    format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", slice.len())
                };
                let _ = sock.write_all(head.as_bytes()).await;
                let _ = sock.write_all(slice).await;
                let _ = sock.flush().await;
            }
        });
        port
    }

    #[tokio::test]
    async fn run_update_resumes_and_verifies() {
        let dir = tempfile::tempdir().unwrap();
        let body: &'static [u8] = b"HELLO-CLASSIC5RP-GAME-DATA-BLOCK";
        let sha = {
            use sha2::{Digest, Sha256};
            hex::encode(Sha256::digest(body))
        };
        let port = serve_once(body).await;
        // pre-seed a partial download to force a Range resume
        std::fs::create_dir_all(dir.path().join("data")).unwrap();
        let mut part = std::fs::File::create(dir.path().join("data/x.bin.part")).unwrap();
        part.write_all(&body[..10]).unwrap();
        drop(part);

        let manifest = Manifest {
            version: "1".into(),
            base_url: Some(format!("http://127.0.0.1:{port}/")),
            files: vec![ManifestEntry { path: "data/x.bin".into(), size: body.len() as u64, sha256: sha, url: None }],
        };
        let plan = diff_manifest(&HashMap::new(), &manifest);
        let client = reqwest::Client::new();
        let mut last = None;
        run_update(&client, dir.path(), &manifest, &plan, |p| last = Some(p)).await.unwrap();

        let out = std::fs::read(dir.path().join("data/x.bin")).unwrap();
        assert_eq!(out, body);
        assert!(!dir.path().join("data/x.bin.part").exists());
        assert!(last.is_some());
    }

    #[tokio::test]
    async fn run_update_rejects_bad_checksum() {
        let dir = tempfile::tempdir().unwrap();
        let body: &'static [u8] = b"wrong-bytes";
        let port = serve_once(body).await;
        let manifest = Manifest {
            version: "1".into(),
            base_url: Some(format!("http://127.0.0.1:{port}/")),
            files: vec![ManifestEntry { path: "y.bin".into(), size: body.len() as u64, sha256: "deadbeef".into(), url: None }],
        };
        let plan = diff_manifest(&HashMap::new(), &manifest);
        let client = reqwest::Client::new();
        let err = run_update(&client, dir.path(), &manifest, &plan, |_| {}).await.unwrap_err();
        assert!(matches!(err, UpdateError::Checksum(_)));
    }
}
