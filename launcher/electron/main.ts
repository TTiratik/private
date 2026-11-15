import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";

const isDev = !app.isPackaged;
let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 650,
    minWidth: 1000,
    minHeight: 600,
    frame: false,            // custom title bar
    resizable: true,
    backgroundColor: "#0B1020",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win?.show());

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ---- IPC: window controls ----
ipcMain.on("win:minimize", () => win?.minimize());
ipcMain.on("win:close", () => win?.close());

// ---- IPC: open external links safely ----
ipcMain.on("app:openExternal", (_e, url: string) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.handle("app:getVersion", () => app.getVersion());

// ---- IPC: launch the game ----
// The connectUrl + ticket are issued by the server (see src/api/http.ts).
// Here we would spawn the game process / hand off the protocol URL, then hide
// the launcher. Stubbed for the mock build.
ipcMain.handle("game:launch", async (_e, connectUrl: string, _ticket: string) => {
  if (/^classic5rp:\/\//i.test(connectUrl)) {
    win?.minimize();
    return { ok: true };
  }
  return { ok: false };
});
