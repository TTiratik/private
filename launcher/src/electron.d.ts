export interface LauncherBridge {
  minimize(): void;
  close(): void;
  launchGame(connectUrl: string, ticket: string): Promise<{ ok: boolean }>;
  openExternal(url: string): void;
  getVersion(): Promise<string>;
}
declare global {
  interface Window { launcher?: LauncherBridge; }
}
export {};
