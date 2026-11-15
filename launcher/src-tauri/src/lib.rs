use classic5rp_core::{diff_manifest, scan_local, run_update, Manifest, Settings, UpdatePlan};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};

struct AppState {
    client: reqwest::Client,
}

fn settings_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

const LAUNCHER_VERSION: &str = env!("CARGO_PKG_VERSION");

// ---------- settings ----------
#[tauri::command]
fn get_settings(app: AppHandle) -> Settings {
    Settings::read(&settings_path(&app))
}

#[tauri::command]
fn set_settings(app: AppHandle, patch: serde_json::Value) -> Result<Settings, String> {
    let path = settings_path(&app);
    let next = Settings::read(&path).apply_patch(&patch);
    Settings::write(&path, &next).map_err(|e| e.to_string())?;
    Ok(next)
}

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Папка с игрой")
        .pick_folder(move |p| { let _ = tx.send(p); });
    rx.await.ok().flatten().map(|p| p.to_string())
}

// ---------- updater ----------
async fn fetch_manifest(client: &reqwest::Client, cdn: &str) -> Result<Manifest, String> {
    let base = cdn.trim_end_matches('/');
    let url = format!("{base}/manifest.json");
    let res = client
        .get(&url)
        .header("X-Launcher-Version", LAUNCHER_VERSION)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("manifest: HTTP {}", res.status().as_u16()));
    }
    let mut m: Manifest = res.json().await.map_err(|e| e.to_string())?;
    if m.base_url.is_none() {
        m.base_url = Some(format!("{base}/files/"));
    }
    Ok(m)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VerifyOut {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")] reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] version: Option<String>,
    files: usize,
    to_download: usize,
    up_to_date: usize,
    bytes_to_download: u64,
    bytes_total: u64,
}

#[tauri::command]
async fn verify_files(app: AppHandle, state: State<'_, AppState>) -> Result<VerifyOut, String> {
    let s = Settings::read(&settings_path(&app));
    if s.game_path.is_empty() { return Ok(reason("no-path")); }
    if s.cdn_base_url.is_empty() { return Ok(reason("no-cdn")); }
    let manifest = fetch_manifest(&state.client, &s.cdn_base_url).await?;
    let game = PathBuf::from(&s.game_path);
    let local = tauri::async_runtime::spawn_blocking({
        let m = manifest.clone();
        move || scan_local(&game, &m)
    }).await.map_err(|e| e.to_string())?;
    let plan = diff_manifest(&local, &manifest);
    Ok(VerifyOut {
        ok: true, reason: None, version: Some(manifest.version.clone()),
        files: manifest.files.len(), to_download: plan.to_download_count,
        up_to_date: plan.up_to_date, bytes_to_download: plan.bytes_to_download, bytes_total: plan.bytes_total,
    })
}

fn reason(r: &str) -> VerifyOut {
    VerifyOut { ok: false, reason: Some(r.into()), version: None, files: 0, to_download: 0, up_to_date: 0, bytes_to_download: 0, bytes_total: 0 }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunOut { ok: bool, #[serde(skip_serializing_if = "Option::is_none")] reason: Option<String>, downloaded: usize, bytes: u64 }

#[tauri::command]
async fn run_update_cmd(app: AppHandle, state: State<'_, AppState>) -> Result<RunOut, String> {
    let s = Settings::read(&settings_path(&app));
    if s.game_path.is_empty() || s.cdn_base_url.is_empty() {
        return Ok(RunOut { ok: false, reason: Some("not-configured".into()), downloaded: 0, bytes: 0 });
    }
    let manifest = fetch_manifest(&state.client, &s.cdn_base_url).await?;
    let game = PathBuf::from(&s.game_path);
    let local = {
        let m = manifest.clone(); let g = game.clone();
        tauri::async_runtime::spawn_blocking(move || scan_local(&g, &m)).await.map_err(|e| e.to_string())?
    };
    let plan: UpdatePlan = diff_manifest(&local, &manifest);
    let (downloaded, bytes) = (plan.to_download_count, plan.bytes_to_download);
    let app2 = app.clone();
    run_update(&state.client, &game, &manifest, &plan, move |p| {
        let _ = app2.emit("updater:progress", &p);
    }).await.map_err(|e| e.to_string())?;
    Ok(RunOut { ok: true, reason: None, downloaded, bytes })
}

// ---------- launch ----------
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchOut { ok: bool, #[serde(skip_serializing_if = "Option::is_none")] reason: Option<String> }

#[tauri::command]
fn launch_game(app: AppHandle, connect_url: String) -> LaunchOut {
    let s = Settings::read(&settings_path(&app));
    if s.game_path.is_empty() { return LaunchOut { ok: false, reason: Some("no-path".into()) }; }
    let exe_name = if cfg!(windows) { "GTA5.exe" } else { "game" };
    let exe = PathBuf::from(&s.game_path).join(exe_name);
    if !exe.exists() { return LaunchOut { ok: false, reason: Some("exe-not-found".into()) }; }
    match std::process::Command::new(&exe).current_dir(&s.game_path).arg("+connect").arg(&connect_url).spawn() {
        Ok(_) => {
            if let Some(w) = app.get_webview_window("main") { let _ = w.minimize(); }
            LaunchOut { ok: true, reason: None }
        }
        Err(e) => LaunchOut { ok: false, reason: Some(e.to_string()) },
    }
}

// ---------- window + misc ----------
#[tauri::command]
fn win_minimize(window: tauri::Window) { let _ = window.minimize(); }
#[tauri::command]
fn win_close(window: tauri::Window) { let _ = window.close(); }
#[tauri::command]
fn get_version() -> String { LAUNCHER_VERSION.to_string() }
#[tauri::command]
fn open_external(app: AppHandle, url: String) {
    if url.starts_with("http://") || url.starts_with("https://") {
        use tauri_plugin_opener::OpenerExt;
        let _ = app.opener().open_url(url, None::<&str>);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { client: reqwest::Client::new() })
        .invoke_handler(tauri::generate_handler![
            get_settings, set_settings, pick_folder,
            verify_files, run_update_cmd, launch_game,
            win_minimize, win_close, get_version, open_external
        ])
        .run(tauri::generate_context!())
        .expect("error while running Classic 5 RP launcher");
}
