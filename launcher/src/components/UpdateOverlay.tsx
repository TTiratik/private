import React, { useEffect, useState } from "react";
import type { UpdateProgress } from "../electron";

const mb = (b: number) => (b / 1e6).toFixed(0);
export default function UpdateOverlay({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const [p, setP] = useState<UpdateProgress | null>(null);
  useEffect(() => {
    const off = window.launcher?.onUpdateProgress(setP);
    window.launcher?.runUpdate().then((r) => { if (r?.ok) onDone(); else onError(r?.reason ?? "Ошибка обновления"); });
    return () => off?.();
  }, [onDone, onError]);
  const pct = p && p.bytesTotal ? Math.min(100, (p.bytesDone / p.bytesTotal) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "radial-gradient(120% 90% at 50% 20%, #10182a 0%, #070b16 70%)" }}>
      <div className="absolute inset-0 opacity-40"
        style={{ backgroundImage: "linear-gradient(0deg,#070b16,transparent 60%), repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 2px,transparent 2px 60px)" }} />
      <div className="relative px-10 pb-8">
        <div className="text-xl font-semibold mb-1">Обновление файлов игры</div>
        <div className="text-sm text-ink-mute mb-3 h-5">
          {p ? <>Файл {p.index}/{p.total} · {mb(p.bytesDone)}/{mb(p.bytesTotal)} МБ · <span className="text-ink-mute/70">{p.file}</span></> : "Проверка…"}
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent to-accent-hi transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
