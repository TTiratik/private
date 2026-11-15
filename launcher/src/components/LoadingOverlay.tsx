import React, { useEffect, useState } from "react";

export default function LoadingOverlay({ server, onDone }: { server: string; onDone: () => void }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setP((v) => {
      const nv = v + Math.random() * 14;
      if (nv >= 100) { clearInterval(id); setTimeout(onDone, 500); return 100; }
      return nv;
    }), 320);
    return () => clearInterval(id);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "radial-gradient(120% 90% at 50% 20%, #10182a 0%, #070b16 70%)" }}>
      <div className="absolute inset-0 opacity-40"
        style={{ backgroundImage: "linear-gradient(0deg,#070b16,transparent 60%), repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 2px,transparent 2px 60px)" }} />
      <div className="relative px-10 pb-8">
        <div className="text-xl font-semibold mb-3">Запуск игры<span className="text-ink-mute"> · {server}</span></div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent to-accent-hi transition-[width] duration-300" style={{ width: `${p}%` }} />
        </div>
      </div>
    </div>
  );
}
