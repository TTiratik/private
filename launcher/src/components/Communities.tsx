import React from "react";
import type { Community } from "../api";

export default function Communities({ items }: { items: Community[] }) {
  return (
    <div className="flex-1">
      <h1 className="text-2xl font-black mb-5">Сообщества</h1>
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        {items.map((c) => (
          <button key={c.label} onClick={() => window.launcher?.openExternal(c.url)}
            className="no-drag glass rounded-xl2 p-4 text-left hover:border-accent/40 hover:bg-white/[0.04] transition rise">
            <div className="text-base font-semibold">{c.label}</div>
            <div className="text-xs text-ink-mute mt-1 truncate">{c.url.replace("https://", "")}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
