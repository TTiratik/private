import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readSettings, writeSettings, type Settings } from "./store";
import { scanLocal, diffManifest, runUpdate, type Manifest } from "./updater";

const isDev = !app.isPackaged;
let win: BrowserWindow | null = null;
let updateAbort: AbortController | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 650, minWidth: 1000, minHeight: 600,
    frame: false, backgroundColor: "#0B1020", show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  win.once("ready-to-show", () => win?.show());
  if (isDev) win.loadURL("http://localhost:5173");
  else win.loadFile(join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// window controls
ipcMain.on("win:minimize", () => win?.minimize());
ipcMain.on("win:close", () => win?.close());
ipcMain.on("app:openExternal", (_e, url: string) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });
ipcMain.handle("app:getVersion", () => app.getVersion());

// settings
ipcMain.handle("settings:get", (): Settings => readSettings());
ipcMain.handle("settings:set", (_e, patch: Partial<Settings>): Settings => writeSettings(patch));
ipcMain.handle("dialog:pickFolder", async (): Promise<string | null> => {
  const r = await dialog.showOpenDialog(win!, { properties: ["openDirectory", "createDirectory"], title: "Папка с игрой" });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});

// updater: verify (plan how much to download) + run (download missing from CDN)
async function fetchManifest(cdnBaseUrl: string): Promise<Manifest> {
  const url = cdnBaseUrl.replace(/\/$/, "") + "/manifest.json";
  const res = await fetch(url, { headers: { "X-Launcher-Version": app.getVersion() } });
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
  const m = (await res.json()) as Manifest;
  if (!m.baseUrl) m.baseUrl = cdnBaseUrl.replace(/\/$/, "") + "/files/";
  return m;
}

ipcMain.handle("updater:verify", async () => {
  const { gamePath, cdnBaseUrl } = readSettings();
  if (!gamePath) return { ok: false, reason: "no-path" };
  if (!cdnBaseUrl) return { ok: false, reason: "no-cdn" };
  const manifest = await fetchManifest(cdnBaseUrl);
  const local = await scanLocal(gamePath, manifest);
  const plan = diffManifest(local, manifest);
  return { ok: true, version: manifest.version, files: manifest.files.length, ...plan, toDownload: plan.toDownload.length };
});

ipcMain.handle("updater:run", async () => {
  const { gamePath, cdnBaseUrl } = readSettings();
  if (!gamePath || !cdnBaseUrl) return { ok: false, reason: "not-configured" };
  const manifest = await fetchManifest(cdnBaseUrl);
  const local = await scanLocal(gamePath, manifest);
  const plan = diffManifest(local, manifest);
  updateAbort = new AbortController();
  try {
    await runUpdate(gamePath, manifest, plan, (p) => win?.webContents.send("updater:progress", p), updateAbort.signal);
    return { ok: true, downloaded: plan.toDownload.length, bytes: plan.bytesToDownload };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "error" };
  } finally { updateAbort = null; }
});
ipcMain.on("updater:cancel", () => updateAbort?.abort());

// launch: verify files, then start the game executable from gamePath
ipcMain.handle("game:launch", async (_e, connectUrl: string, _ticket: string) => {
  const { gamePath } = readSettings();
  if (!gamePath) return { ok: false, reason: "no-path" };
  const exe = join(gamePath, process.platform === "win32" ? "GTA5.exe" : "game");
  if (!existsSync(exe)) return { ok: false, reason: "exe-not-found" };
  try {
    spawn(exe, [`+connect`, connectUrl], { cwd: gamePath, detached: true, stdio: "ignore" }).unref();
    win?.minimize();
    return { ok: true };
  } catch (e: any) { return { ok: false, reason: e?.message ?? "spawn-failed" }; }
});
