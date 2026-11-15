import React from "react";
import type { GameServer, NewsItem } from "../api";
import NewsCarousel from "./NewsCarousel";
import logo from "../assets/logo-symbol.svg";

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function ServerCard({ server, news }: { server?: GameServer; news: NewsItem[] }) {
  if (!server) return null;
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-3 rise">
        <img src={logo} alt="" className="h-12 w-12 object-contain" draggable={false} />
        <div>
          <h1 className="text-4xl font-black leading-none">{server.name}</h1>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-ink-mute">
            <span className="w-1.5 h-1.5 rounded-full bg-online inline-block" />
            {server.status === "online" ? <>Онлайн: <span className="text-ink">{fmt(server.online)}</span></>
              : server.status === "maintenance" ? "Технические работы" : "Сервер офлайн"}
          </div>
        </div>
      </div>

      <div className="mt-7">
        <h2 className="text-lg font-semibold mb-3">Новости и обновления</h2>
        <NewsCarousel items={news} />
      </div>
    </div>
  );
}
