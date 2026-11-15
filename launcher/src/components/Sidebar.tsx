import React from "react";
import type { GameServer } from "../api";
import logo from "../assets/logo-symbol.svg";
import { Users } from "./icons";

const fmt = (n: number) => n.toLocaleString("ru-RU");

function StatusDot({ s }: { s: GameServer["status"] }) {
  const c = s === "online" ? "bg-online" : s === "maintenance" ? "bg-accent" : "bg-ink-mute";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${c}`} />;
}

export default function Sidebar({
  servers, selected, onSelect, totalOnline,
}: { servers: GameServer[]; selected?: string; onSelect: (id: string) => void; totalOnline: number }) {
  return (
    <aside className="w-[240px] shrink-0 glass rounded-xl2 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <img src={logo} alt="Classic 5 RP" className="h-9" draggable={false} />
        <div className="mt-2 text-[13px] text-ink-mute">
          <span className="text-ink font-semibold">{fmt(totalOnline)}</span> игроков онлайн
        </div>
      </div>
      <div className="h-px bg-line mx-3" />
      <div className="flex-1 overflow-y-auto py-2">
        {servers.map((s) => {
          const active = s.id === selected;
          return (
            <button key={s.id} onClick={() => onSelect(s.id)}
              className={`group w-full flex items-center justify-between px-4 py-2 text-left transition ${
                active ? "bg-accent/10" : "hover:bg-white/[0.04]"
              }`}>
              <span className="flex items-center gap-2 min-w-0">
                {active && <span className="absolute left-0 w-[3px] h-5 rounded-r bg-accent -ml-4" />}
                <StatusDot s={s.status} />
                <span className={`truncate text-sm uppercase tracking-wide ${active ? "text-ink font-semibold" : "text-ink-mute group-hover:text-ink"}`}>
                  {s.name}
                </span>
              </span>
              <span className={`text-xs tabular-nums ${active ? "text-accent" : "text-ink-mute"}`}>
                {s.status === "online" ? fmt(s.online) : s.status === "maintenance" ? "тех." : "—"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-px bg-line mx-3" />
      <div className="px-4 py-3 flex items-center gap-2 text-ink-mute text-xs">
        <Users /> <span>romek</span>
      </div>
    </aside>
  );
}
