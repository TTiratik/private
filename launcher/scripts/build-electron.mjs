import { build, context } from "esbuild";
const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron"],
  outdir: "dist-electron",
  logLevel: "info",
};
const entries = ["electron/main.ts", "electron/preload.ts"];
const watch = process.argv.includes("--watch");
if (watch) {
  const ctx = await context({ ...common, entryPoints: entries });
  await ctx.watch();
  console.log("[electron] watching…");
} else {
  await build({ ...common, entryPoints: entries });
}
