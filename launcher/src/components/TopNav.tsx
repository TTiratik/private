import React from "react";

export type Tab = "servers" | "news" | "communities";
const tabs: { id: Tab; label: string }[] = [
  { id: "servers", label: "Игровые сервера" },
  { id: "news", label: "Новости" },
  { id: "communities", label: "Сообщества" },
];

export default function TopNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="no-drag flex items-center gap-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onTab(t.id)}
          className={`px-3 py-1.5 text-sm rounded-lg transition font-medium ${
            tab === t.id ? "text-ink bg-white/[0.07]" : "text-ink-mute hover:text-ink"
          }`}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
