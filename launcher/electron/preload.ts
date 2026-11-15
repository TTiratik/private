import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("launcher", {
  minimize: () => ipcRenderer.send("win:minimize"),
  close: () => ipcRenderer.send("win:close"),
  openExternal: (url: string) => ipcRenderer.send("app:openExternal", url),
  getVersion: () => ipcRenderer.invoke("app:getVersion"),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch: unknown) => ipcRenderer.invoke("settings:set", patch),
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),

  verifyFiles: () => ipcRenderer.invoke("updater:verify"),
  runUpdate: () => ipcRenderer.invoke("updater:run"),
  cancelUpdate: () => ipcRenderer.send("updater:cancel"),
  onUpdateProgress: (cb: (p: unknown) => void) => {
    const h = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on("updater:progress", h);
    return () => ipcRenderer.removeListener("updater:progress", h);
  },

  launchGame: (connectUrl: string, ticket: string) => ipcRenderer.invoke("game:launch", connectUrl, ticket),
});
