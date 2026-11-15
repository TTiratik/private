import React, { useEffect, useState } from "react";
import type { Settings, VerifyResult } from "../electron";
import { Close } from "./icons";

const fmtGB = (b?: number) => b == null ? "" : `${(b / 1e9).toFixed(1)} ГБ`;
const fmtMB = (b?: number) => b == null ? "" : `${(b / 1e6).toFixed(0)} МБ`;

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings>({ nickname: "", gamePath: "", cdnBaseUrl: "" });
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { window.launcher?.getSettings().then(setS); }, []);
  const save = (patch: Partial<Settings>) => { const n = { ...s, ...patch }; setS(n); window.launcher?.setSettings(patch); };

  const pick = async () => { const p = await window.launcher?.pickFolder(); if (p) save({ gamePath: p }); };
  const check = async () => { setBusy(true); try { setVerify((await window.launcher?.verifyFiles()) ?? null); } finally { setBusy(false); } };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 no-drag" onMouseDown={onClose}>
      <div className="rise w-[520px] glass rounded-xl2 p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Настройки</h2>
          <button onClick={onClose} className="text-ink-mute hover:text-ink"><Close /></button>
        </div>

        <label className="block text-sm text-ink-mute mb-1.5">Никнейм</label>
        <input value={s.nickname} onChange={(e) => save({ nickname: e.target.value })}
          placeholder="Ваш ник в игре"
          className="w-full mb-4 px-3 py-2 rounded-lg bg-black/30 border border-line text-ink outline-none focus:border-accent/60" />

        <label className="block text-sm text-ink-mute mb-1.5">Папка с игрой</label>
        <div className="flex gap-2 mb-4">
          <input value={s.gamePath} onChange={(e) => save({ gamePath: e.target.value })}
            placeholder="C:\Games\Classic5RP"
            className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-line text-ink outline-none focus:border-accent/60" />
          <button onClick={pick} className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 text-sm">Выбрать…</button>
        </div>

        <details className="mb-4">
          <summary className="text-sm text-ink-mute cursor-pointer select-none">Дополнительно</summary>
          <label className="block text-xs text-ink-mute mt-3 mb-1.5">CDN (адрес обновлений)</label>
          <input value={s.cdnBaseUrl} onChange={(e) => save({ cdnBaseUrl: e.target.value })}
            placeholder="https://cdn.classic5rp.example"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-line text-ink outline-none focus:border-accent/60 text-sm" />
        </details>

        <div className="flex items-center gap-3">
          <button onClick={check} disabled={busy || !s.gamePath}
            className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 text-sm disabled:opacity-40">
            {busy ? "Проверка…" : "Проверить файлы"}
          </button>
          {verify?.ok && (
            <span className="text-xs text-ink-mute">
              Версия {verify.version} · к загрузке {verify.toDownload} из {verify.files} файлов
              {verify.bytesToDownload ? <> · <span className="text-accent">{fmtMB(verify.bytesToDownload)}</span> с CDN (всего {fmtGB(verify.bytesTotal)})</> : " · всё актуально"}
            </span>
          )}
          {verify && !verify.ok && <span className="text-xs text-red-300">Укажите папку и CDN</span>}
        </div>
      </div>
    </div>
  );
}
