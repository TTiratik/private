# Classic 5 RP — Launcher

Desktop game launcher — **Tauri (Rust) + Vite + React + TypeScript + Tailwind**.
The UI is web; the backend (settings, updater, game launch) is Rust in `src-tauri/`.

## Develop
```bash
npm install
npm run dev        # Tauri dev: Vite renderer + Rust window (frameless)
```
Renderer only (browser preview / screenshots — a dev bridge stands in for the
native backend):
```bash
npm run build:renderer && npm run preview
```

## Build
```bash
npm run build      # tauri build -> native installer (.msi/.exe on Windows)
npm test           # cargo tests for the Rust core (updater + settings)
```

## Rust backend (`src-tauri/`)
- `core/` — a GUI-free crate with the real logic, fully unit-tested
  (`diff_manifest`, `scan_local`, `hash_file`, `run_update`, `Settings`).
- `src/lib.rs` — thin Tauri commands that call `core` and stream events.
- Commands: `get_settings`, `set_settings`, `pick_folder`, `verify_files`,
  `run_update_cmd`, `launch_game`, `win_minimize/close`, `open_external`.

> Note: the Tauri GUI links against WebView (WebView2 on Windows, WebKitGTK on
> Linux). Build it on your target OS. The Rust **core** compiles and tests
> anywhere (`npm test`).

## API
All UI talks to a single `LauncherApi` interface (`src/api/types.ts`).
- Default: **mock** (`src/api/mock.ts`) reading `public/mock/*.json`.
- Real backend: `src/api/http.ts`. Switch with env:
  ```
  VITE_USE_REAL_API=true
  VITE_API_BASE_URL=https://api.classic5rp.example
  ```
Endpoints (v1): `GET /servers`, `GET /news`, `GET /communities`,
`POST /session/launch` (server issues the connect ticket — the client never
derives it).

## Security / anti-tamper (planned, see design brief)
A native Rust/Tauri binary is already much harder to decompile than an Electron/JS
bundle. Measures to add before release:
- keep all secrets & launch authorisation server-side (already: ticket from API);
- ship the logic as the compiled Rust binary (no JS bytecode step needed);
  obfuscate/minify the web UI assets;
- `asar` packaging + `asarIntegrity`, code signing;
- `contextIsolation`/`sandbox` on, strict CSP, DevTools off in prod (done in code);
- mandatory version check via `/launcher/version`.

Full brief: `../.design/classic5rp-launcher/DESIGN_BRIEF.md`.

## Settings
Stored in the app config dir (`settings.json`) by `core::Settings`:
`nickname`, `gamePath` (native folder picker), `cdnBaseUrl`. The renderer reads/
writes them through the Tauri bridge (`window.launcher.getSettings/setSettings`).

## Differential updater (less CDN traffic)
`src-tauri/core/src/updater.rs` keeps CDN downloads minimal:
1. fetch `<cdnBaseUrl>/manifest.json` — `{ version, files:[{path,size,sha256}] }`;
2. `scanLocal` hashes only files whose size matches the manifest;
3. `diffManifest` (pure, unit-tested) lists **only missing/changed files**;
4. `runUpdate` downloads them from `<cdnBaseUrl>/files/…` with HTTP **Range
   resume** (partial `.part` files are continued, not refetched), low
   concurrency, and **SHA-256 verification** before swapping each file in.

So a client that is already up to date downloads nothing; a small patch pulls
only the changed packs. Progress streams to the UI (`updater:progress`).
`npm test` (cargo) covers the diff, resume and checksum paths.

> Note: `src/tauriBridge.ts` wires `window.launcher` to Tauri `invoke`/events
> when running natively; `src/devBridge.ts` simulates it for browser preview.
