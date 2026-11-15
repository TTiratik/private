import { contextBridge, ipcRenderer } from "electron";

// Minimal, explicit bridge. The renderer never gets Node or ipcRenderer directly.
contextBridge.exposeInMainWorld("launcher", {
  minimize: () => ipcRenderer.send("win:minimize"),
  close: () => ipcRenderer.send("win:close"),
  openExternal: (url: string) => ipcRenderer.send("app:openExternal", url),
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  launchGame: (connectUrl: string, ticket: string) => ipcRenderer.invoke("game:launch", connectUrl, ticket),
});
