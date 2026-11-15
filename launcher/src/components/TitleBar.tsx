import React from "react";
import { Minus, Close } from "./icons";

export default function TitleBar() {
  const call = (fn?: () => void) => () => fn?.();
  return (
    <div className="drag flex items-center justify-end h-9 px-2 shrink-0">
      <button className="no-drag grid place-items-center w-9 h-7 rounded-md text-ink-mute hover:bg-white/10 hover:text-ink transition"
        onClick={call(window.launcher?.minimize)} aria-label="Свернуть"><Minus /></button>
      <button className="no-drag grid place-items-center w-9 h-7 rounded-md text-ink-mute hover:bg-red-500/80 hover:text-white transition"
        onClick={call(window.launcher?.close)} aria-label="Закрыть"><Close /></button>
    </div>
  );
}
