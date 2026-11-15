import type { LauncherBridge, Settings, UpdateProgress } from "./electron";

// Only used when running the renderer outside Electron (vite preview / tests).
// Simulates the native bridge so Settings + updater UI are fully exercisable.
export function installDevBridge() {
  if (window.launcher || import.meta.env.PROD && !import.meta.env.VITE_DEV_BRIDGE) {
    // still install in prod browser preview only when explicitly asked
  }
  if (window.launcher) return;
  const KEY = "dev-settings";
  const read = (): Settings => ({ nickname: "", gamePath: "", cdnBaseUrl: "", ...JSON.parse(localStorage.getItem(KEY) || "{}") });
  const write = (patch: Partial<Settings>) => { const n = { ...read(), ...patch }; localStorage.setItem(KEY, JSON.stringify(n)); return n; };
  let progressCbs: ((p: UpdateProgress) => void)[] = [];
  const bridge: LauncherBridge = {
    minimize() {}, close() {}, openExternal(u) { window.open(u, "_blank"); },
    getVersion: async () => "0.1.0-dev",
    getSettings: async () => read(),
    setSettings: async (p) => write(p),
    pickFolder: async () => "C:\\\\Games\\\\Classic5RP",
    verifyFiles: async () => ({ ok: true, version: "2026.11.1", files: 1240, toDownload: 37, upToDate: 1203, bytesToDownload: 820_000_000, bytesTotal: 24_000_000_000 }),
    async runUpdate() {
      const total = 37; const bytesTotal = 820_000_000; let done = 0;
      for (let i = 1; i <= total; i++) {
        await new Promise((r) => setTimeout(r, 70));
        done += bytesTotal / total;
        progressCbs.forEach((cb) => cb({ file: `data/pack_${i}.rpf`, index: i, total, bytesDone: done, bytesTotal }));
      }
      return { ok: true, downloaded: total, bytes: bytesTotal };
    },
    cancelUpdate() {},
    onUpdateProgress(cb) { progressCbs.push(cb); return () => { progressCbs = progressCbs.filter((c) => c !== cb); }; },
    launchGame: async () => ({ ok: true }),
  };
  window.launcher = bridge;
}
