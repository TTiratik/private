export interface UpdateProgress { file: string; index: number; total: number; bytesDone: number; bytesTotal: number; }
export interface VerifyResult {
  ok: boolean; reason?: string; version?: string; files?: number;
  toDownload?: number; upToDate?: number; bytesToDownload?: number; bytesTotal?: number;
}
export interface Settings { nickname: string; gamePath: string; cdnBaseUrl: string; }

export interface LauncherBridge {
  minimize(): void;
  close(): void;
  openExternal(url: string): void;
  getVersion(): Promise<string>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  pickFolder(): Promise<string | null>;
  verifyFiles(): Promise<VerifyResult>;
  runUpdate(): Promise<{ ok: boolean; reason?: string; downloaded?: number; bytes?: number }>;
  cancelUpdate(): void;
  onUpdateProgress(cb: (p: UpdateProgress) => void): () => void;
  launchGame(connectUrl: string, ticket: string): Promise<{ ok: boolean; reason?: string }>;
}
declare global {
  interface Window { launcher?: LauncherBridge; }
}
export {};
