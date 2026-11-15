import React, { useEffect, useRef, useState } from "react";
import type { NewsItem } from "../api";
import { Chevron } from "./icons";

const grads = [
  "linear-gradient(135deg,#1e3a5f,#0b1020)",
  "linear-gradient(135deg,#5a2a1a,#0b1020)",
  "linear-gradient(135deg,#2a2060,#0b1020)",
  "linear-gradient(135deg,#1a4a3a,#0b1020)",
];

export default function NewsCarousel({ items }: { items: NewsItem[] }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<number>();
  const perView = 3;
  const maxIdx = Math.max(0, items.length - perView);
  const go = (d: number) => setIdx((i) => Math.min(maxIdx, Math.max(0, i + d)));

  useEffect(() => {
    timer.current = window.setInterval(() => setIdx((i) => (i >= maxIdx ? 0 : i + 1)), 6000);
    return () => window.clearInterval(timer.current);
  }, [maxIdx]);

  return (
    <div className="relative" onMouseEnter={() => window.clearInterval(timer.current)}>
      <div className="flex gap-4 overflow-hidden">
        {items.slice(idx, idx + perView).map((n, i) => (
          <a key={n.id} href={n.link} onClick={(e) => { e.preventDefault(); window.launcher?.openExternal(n.link); }}
            className="rise group relative flex-1 min-w-0 h-44 rounded-xl2 overflow-hidden border border-line no-drag"
            style={{ background: grads[(idx + i) % grads.length] }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            {n.tag && <span className="absolute top-3 left-3 text-[11px] font-semibold uppercase tracking-wider text-accent-hi bg-black/40 px-2 py-0.5 rounded">{n.tag}</span>}
            <div className="absolute bottom-0 p-3">
              <div className="text-sm font-semibold leading-snug group-hover:text-accent-hi transition">{n.title}</div>
              <div className="text-[11px] text-ink-mute mt-1">{new Date(n.publishedAt).toLocaleDateString("ru-RU")}</div>
            </div>
          </a>
        ))}
      </div>
      {idx > 0 && (
        <button onClick={() => go(-1)} aria-label="Назад"
          className="no-drag absolute -left-3 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full glass text-ink hover:text-accent"><Chevron style={{ transform: "rotate(180deg)" }} /></button>
      )}
      {idx < maxIdx && (
        <button onClick={() => go(1)} aria-label="Вперёд"
          className="no-drag absolute -right-3 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full glass text-ink hover:text-accent"><Chevron /></button>
      )}
    </div>
  );
}
