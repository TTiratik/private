import type { LauncherBridge, UpdateProgress } from "./electron";

// Detect Tauri v2 runtime.
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Install window.launcher backed by Tauri `invoke`/events. No-op outside Tauri. */
export async function installTauriBridge(): Promise<boolean> {
  if (!inTauri() || window.launcher) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");

  const bridge: LauncherBridge = {
    minimize: () => void invoke("win_minimize"),
    close: () => void invoke("win_close"),
    openExternal: (url) => void invoke("open_external", { url }),
    getVersion: () => invoke("get_version"),
    getSettings: () => invoke("get_settings"),
    setSettings: (patch) => invoke("set_settings", { patch }),
    pickFolder: () => invoke("pick_folder"),
    verifyFiles: () => invoke("verify_files"),
    runUpdate: () => invoke("run_update_cmd"),
    cancelUpdate: () => {/* reserved: emit a cancel to backend */},
    onUpdateProgress: (cb) => {
      let un = () => {};
      listen<UpdateProgress>("updater:progress", (e) => cb(e.payload)).then((f) => (un = f));
      return () => un();
    },
    launchGame: (connectUrl) => invoke("launch_game", { connectUrl }),
  };
  window.launcher = bridge;
  return true;
}
