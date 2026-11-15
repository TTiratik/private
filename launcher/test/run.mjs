import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const out = join(tmpdir(), "updater.test.cjs");
await build({ entryPoints: ["electron/updater.ts"], bundle: true, platform: "node", format: "cjs", external: ["electron"], outfile: out, logLevel: "error" });
execFileSync(process.execPath, ["test/updater.test.cjs"], { stdio: "inherit", env: { ...process.env, UPDATER_CJS: out } });
