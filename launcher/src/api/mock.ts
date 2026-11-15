import type { LauncherApi, GameServer, NewsItem, Community, LaunchTicket } from "./types";

// Mock implementation. Same shape the real HTTP API will return, so swapping
// in the real client (src/api/http.ts) changes nothing in the UI.
const base = import.meta.env.BASE_URL || "/";
const load = async <T>(file: string): Promise<T> => {
  const res = await fetch(`${base}mock/${file}`);
  if (!res.ok) throw new Error(`mock ${file}: ${res.status}`);
  return (await res.json()) as T;
};
const jitter = (n: number) => Math.max(0, n + Math.round((Math.random() - 0.5) * n * 0.06));

export const mockApi: LauncherApi = {
  async getServers() {
    const list = await load<GameServer[]>("servers.json");
    return list
      .map((s) => ({ ...s, online: s.status === "online" ? jitter(s.online) : 0 }))
      .sort((a, b) => a.order - b.order);
  },
  async getNews(_serverId?: string) {
    return load<NewsItem[]>("news.json");
  },
  async getCommunities() {
    return load<Community[]>("communities.json");
  },
  async launch(serverId: string): Promise<LaunchTicket> {
    // In production the server validates the session and returns the ticket.
    await new Promise((r) => setTimeout(r, 400));
    return {
      ticket: `mock-${serverId}-${Date.now()}`,
      connectUrl: `classic5rp://connect/${serverId}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  },
};
