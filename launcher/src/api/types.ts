export type ServerStatus = "online" | "offline" | "maintenance";

export interface GameServer {
  id: string;
  name: string;
  slug: string;
  online: number;
  status: ServerStatus;
  order: number;
  connectUrl: string;
  iconUrl?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  publishedAt: string;
  tag?: string;
}

export interface Community {
  label: string;
  url: string;
  icon: string;
}

export interface LaunchTicket {
  ticket: string;
  connectUrl: string;
  expiresAt: string;
}

/** The contract every backend (real or mock) must implement. */
export interface LauncherApi {
  getServers(): Promise<GameServer[]>;
  getNews(serverId?: string): Promise<NewsItem[]>;
  getCommunities(): Promise<Community[]>;
  /** Server authorises the launch and hands back a one-time ticket. */
  launch(serverId: string): Promise<LaunchTicket>;
}
