import type { LauncherApi, GameServer, NewsItem, Community, LaunchTicket } from "./types";

// Real HTTP client — points at the backend once it exists.
// Enable by setting VITE_API_BASE_URL and VITE_USE_REAL_API=true.
const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://api.classic5rp.example";
const LAUNCHER_VERSION = "0.1.0";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Launcher-Version": LAUNCHER_VERSION },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

export const httpApi: LauncherApi = {
  getServers: () => get<GameServer[]>("/api/v1/servers"),
  getNews: (serverId?: string) =>
    get<NewsItem[]>(`/api/v1/news${serverId ? `?server=${serverId}` : ""}`),
  getCommunities: () => get<Community[]>("/api/v1/communities"),
  async launch(serverId: string): Promise<LaunchTicket> {
    const res = await fetch(`${BASE}/api/v1/session/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Launcher-Version": LAUNCHER_VERSION },
      body: JSON.stringify({ serverId }),
    });
    if (!res.ok) throw new Error(`launch: ${res.status}`);
    return (await res.json()) as LaunchTicket;
  },
};
