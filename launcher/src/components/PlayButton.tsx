import React from "react";
import type { GameServer } from "../api";

type State = "idle" | "launching";
export default function PlayButton({ server, state, onPlay }:
  { server?: GameServer; state: State; onPlay: () => void }) {
  const disabled = !server || server.status !== "online" || state === "launching";
  const label = state === "launching" ? "Запуск…"
    : server?.status === "maintenance" ? "Тех. работы"
    : server?.status === "offline" ? "Недоступен"
    : "Играть";
  return (
    <div className="flex items-center gap-4">
      <button onClick={onPlay} disabled={disabled}
        className={`no-drag relative h-[58px] min-w-[200px] px-10 rounded-xl2 text-lg font-bold tracking-wide transition
          ${disabled ? "bg-white/5 text-ink-mute cursor-not-allowed"
            : "text-white shadow-[0_10px_30px_-8px_rgba(245,115,31,.6)] bg-gradient-to-b from-accent-hi to-accent hover:brightness-110 active:scale-[.98]"}`}>
        {state === "launching" && <span className="inline-block w-4 h-4 mr-2 align-[-2px] border-2 border-white/40 border-t-white rounded-full spin" />}
        {label}
      </button>
      {server?.status === "maintenance" && (
        <span className="text-xs text-ink-mute max-w-[160px]">Сервер на технических работах, зайдите позже.</span>
      )}
    </div>
  );
}
