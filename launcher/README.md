# Classic 5 RP — Launcher

Desktop game launcher (Electron + Vite + React + TypeScript + Tailwind).

## Develop
```bash
npm install
npm run dev        # Vite renderer + Electron (frameless window)
```
Renderer only (for quick UI work / screenshots):
```bash
npm run build:renderer && npm run preview
```

## Build
```bash
npm run build      # builds renderer (dist/) and electron (dist-electron/)
```

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
Electron cannot be made fully decompile-proof. Measures to add before release:
- keep all secrets & launch authorisation server-side (already: ticket from API);
- compile main/renderer to V8 bytecode (`bytenode`), obfuscate the rest;
- `asar` packaging + `asarIntegrity`, code signing;
- `contextIsolation`/`sandbox` on, strict CSP, DevTools off in prod (done in code);
- mandatory version check via `/launcher/version`.

Full brief: `../.design/classic5rp-launcher/DESIGN_BRIEF.md`.

## Settings
Stored in Electron `userData/settings.json` via `electron/store.ts`:
`nickname`, `gamePath` (folder picker), `cdnBaseUrl`. The renderer reads/writes
them through the preload bridge (`window.launcher.getSettings/setSettings`).

## Differential updater (less CDN traffic)
`electron/updater.ts` keeps CDN downloads minimal:
1. fetch `<cdnBaseUrl>/manifest.json` — `{ version, files:[{path,size,sha256}] }`;
2. `scanLocal` hashes only files whose size matches the manifest;
3. `diffManifest` (pure, unit-tested) lists **only missing/changed files**;
4. `runUpdate` downloads them from `<cdnBaseUrl>/files/…` with HTTP **Range
   resume** (partial `.part` files are continued, not refetched), low
   concurrency, and **SHA-256 verification** before swapping each file in.

So a client that is already up to date downloads nothing; a small patch pulls
only the changed packs. Progress streams to the UI (`updater:progress`).
`npm test` covers the diff, resume and checksum paths.

> Note: `src/devBridge.ts` simulates the native bridge when the renderer runs
> in a plain browser (vite preview / screenshots). Inside Electron the preload
> bridge wins and the dev bridge is a no-op.
