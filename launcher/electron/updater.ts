import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, statSync, mkdirSync, renameSync, openSync, closeSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

export interface ManifestEntry { path: string; size: number; sha256: string; url?: string; }
export interface Manifest { version: string; baseUrl?: string; files: ManifestEntry[]; }

export interface LocalState { size: number; sha256: string; }
export interface UpdatePlan {
  toDownload: ManifestEntry[];
  upToDate: number;
  bytesToDownload: number;
  bytesTotal: number;
}

/**
 * Pure diff: decide which manifest files must be (re)downloaded given what is
 * already on disk. A file is skipped only when BOTH size and hash match — that
 * is what makes the CDN download minimal (only missing/changed files are
 * fetched). Side-effect free so it can be unit-tested without a filesystem.
 */
export function diffManifest(local: Record<string, LocalState | undefined>, manifest: Manifest): UpdatePlan {
  const toDownload: ManifestEntry[] = [];
  let upToDate = 0, bytesToDownload = 0, bytesTotal = 0;
  for (const f of manifest.files) {
    bytesTotal += f.size;
    const cur = local[f.path];
    if (cur && cur.size === f.size && cur.sha256.toLowerCase() === f.sha256.toLowerCase()) {
      upToDate++;
    } else {
      toDownload.push(f);
      bytesToDownload += f.size;
    }
  }
  return { toDownload, upToDate, bytesToDownload, bytesTotal };
}

export async function hashFile(path: string): Promise<string> {
  const h = createHash("sha256");
  await pipeline(createReadStream(path), h as any);
  return h.digest("hex");
}

/** Build LocalState map for the files named in the manifest (only hashes what exists). */
export async function scanLocal(gameDir: string, manifest: Manifest): Promise<Record<string, LocalState>> {
  const out: Record<string, LocalState> = {};
  for (const f of manifest.files) {
    const p = join(gameDir, f.path);
    if (!existsSync(p)) continue;
    const size = statSync(p).size;
    // size cheap-check first; only hash when the size matches (avoids hashing
    // obviously-wrong files, saving disk IO)
    if (size !== f.size) { out[f.path] = { size, sha256: "" }; continue; }
    out[f.path] = { size, sha256: await hashFile(p) };
  }
  return out;
}

export type ProgressCb = (p: { file: string; index: number; total: number; bytesDone: number; bytesTotal: number }) => void;

/**
 * Download the planned files from the CDN with resume (HTTP Range) and SHA-256
 * verification. Uses global fetch (Node 18+/Electron). Concurrency kept low to
 * be gentle on the CDN; already-complete `.part` files are resumed, not refetched.
 */
export async function runUpdate(
  gameDir: string, manifest: Manifest, plan: UpdatePlan,
  onProgress: ProgressCb, signal?: AbortSignal, concurrency = 3,
): Promise<void> {
  const base = manifest.baseUrl ?? "";
  let bytesDone = 0; const bytesTotal = plan.bytesToDownload;
  let index = 0; const total = plan.toDownload.length;
  const queue = [...plan.toDownload];

  async function worker() {
    for (;;) {
      if (signal?.aborted) throw new Error("aborted");
      const entry = queue.shift();
      if (!entry) return;
      const dest = join(gameDir, entry.path);
      const part = dest + ".part";
      mkdirSync(dirname(dest), { recursive: true });

      let have = existsSync(part) ? statSync(part).size : 0;
      if (have > entry.size) { have = 0; } // corrupt partial -> restart
      const url = entry.url ?? base + entry.path;

      if (have < entry.size) {
        const res = await fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {}, signal });
        if (!res.ok && res.status !== 206) throw new Error(`${entry.path}: HTTP ${res.status}`);
        const out = createWriteStream(part, { flags: have ? "a" : "w" });
        try {
          const reader = (res.body as any).getReader?.();
          if (reader) {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!out.write(Buffer.from(value))) await new Promise<void>((r) => out.once("drain", () => r()));
              bytesDone += value.length;
              onProgress({ file: entry.path, index, total, bytesDone, bytesTotal });
            }
          } else {
            for await (const chunk of res.body as any) {
              out.write(chunk); bytesDone += chunk.length;
              onProgress({ file: entry.path, index, total, bytesDone, bytesTotal });
            }
          }
        } finally {
          // flush fully to disk before we hash-verify (end(cb) fires after flush)
          await new Promise<void>((resolve, reject) => { out.on("error", reject); out.end(() => resolve()); });
        }
      }
      // verify
      const got = await hashFile(part);
      if (got.toLowerCase() !== entry.sha256.toLowerCase()) throw new Error(`${entry.path}: checksum mismatch`);
      renameSync(part, dest);
      index++;
      onProgress({ file: entry.path, index, total, bytesDone, bytesTotal });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total || 1) }, worker));
}

/** Convenience: ensure dir exists for a touch-test. */
export function ensureDir(p: string) { mkdirSync(p, { recursive: true }); const fd = openSync(join(p, ".write-test"), "w"); closeSync(fd); }
