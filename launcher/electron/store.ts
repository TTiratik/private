import { app } from "electron";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface Settings {
  nickname: string;
  gamePath: string;
  cdnBaseUrl: string;
}
const DEFAULTS: Settings = { nickname: "", gamePath: "", cdnBaseUrl: "" };

function file() { return join(app.getPath("userData"), "settings.json"); }

export function readSettings(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(readFileSync(file(), "utf8")) }; }
  catch { return { ...DEFAULTS }; }
}
export function writeSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch };
  const f = file(); mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(next, null, 2));
  return next;
}
