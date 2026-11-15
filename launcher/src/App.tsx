import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type GameServer, type NewsItem, type Community } from "./api";
import TitleBar from "./components/TitleBar";
import TopNav, { type Tab } from "./components/TopNav";
import Sidebar from "./components/Sidebar";
import ServerCard from "./components/ServerCard";
import Communities from "./components/Communities";
import PlayButton from "./components/PlayButton";
import LoadingOverlay from "./components/LoadingOverlay";
import UpdateOverlay from "./components/UpdateOverlay";
import SettingsModal from "./components/SettingsModal";
import { Refresh, Gear } from "./components/icons";
import lockup from "./assets/logo-lockup.svg";

export default function App() {
  const [tab, setTab] = useState<Tab>("servers");
  const [servers, setServers] = useState<GameServer[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<string>(() => localStorage.getItem("selected") || "");
  const [refreshing, setRefreshing] = useState(false);
  const [launchState, setLaunchState] = useState<"idle" | "launching">("idle");
  const [updating, setUpdating] = useState(false);
  const [loadingServer, setLoadingServer] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await api.getServers();
      setServers(list);
      setSelected((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? ""));
      setError(null);
    } catch { setError("Не удалось обновить список серверов"); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { refresh(); api.getCommunities().then(setCommunities).catch(() => {}); }, [refresh]);
  useEffect(() => { const id = setInterval(refresh, 30_000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { if (selected) { localStorage.setItem("selected", selected); api.getNews(selected).then(setNews).catch(() => {}); } }, [selected]);

  const current = useMemo(() => servers.find((s) => s.id === selected), [servers, selected]);
  const totalOnline = useMemo(() => servers.reduce((a, s) => a + (s.status === "online" ? s.online : 0), 0), [servers]);

  const beginLaunch = async () => {
    if (!current) return;
    setLaunchState("launching");
    try {
      const ticket = await api.launch(current.id);
      const res = await window.launcher?.launchGame(ticket.connectUrl, ticket.ticket);
      if (res && !res.ok) setError(res.reason === "exe-not-found" ? "Исполняемый файл игры не найден" : res.reason === "no-path" ? "Укажите папку с игрой" : "Не удалось запустить игру");
      else setLoadingServer(current.name);
    } catch { setError("Не удалось запустить игру"); }
    finally { setLaunchState("idle"); }
  };

  const onPlay = async () => {
    if (!current || current.status !== "online") return;
    const s = await window.launcher?.getSettings();
    if (!s?.gamePath) { setShowSettings(true); setError("Сначала укажите папку с игрой"); return; }
    if (s.cdnBaseUrl) setUpdating(true);   // verify & patch from CDN, then launch
    else beginLaunch();
  };

  return (
    <div className="h-full flex flex-col text-ink relative"
      style={{ background: "radial-gradient(130% 100% at 70% -10%, #16203a 0%, #0B1020 55%, #090D1A 100%)" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-[0.12]"
        style={{ backgroundImage: "repeating-linear-gradient(90deg,#9fb2d0 0 3px,transparent 3px 22px)", maskImage: "linear-gradient(180deg,transparent,black 40%,transparent)" }} />

      <TitleBar />
      <header className="drag flex items-center gap-6 px-5 pb-3 shrink-0">
        <img src={lockup} alt="Classic 5 RP" className="h-7" draggable={false} />
        <TopNav tab={tab} onTab={setTab} />
      </header>

      <main className="flex-1 min-h-0 flex gap-5 px-5 pb-4">
        <Sidebar servers={servers} selected={selected} onSelect={setSelected} totalOnline={totalOnline} />
        <section className="flex-1 min-w-0 glass rounded-xl2 p-7 flex flex-col relative overflow-hidden">
          {tab !== "communities" ? <ServerCard server={current} news={news} /> : <Communities items={communities} />}

          {tab !== "communities" && (
            <div className="mt-auto pt-6 flex items-center justify-between">
              <PlayButton server={current} state={launchState} onPlay={onPlay} />
              <div className="flex items-center gap-2">
                <button onClick={refresh} aria-label="Обновить"
                  className={`no-drag grid place-items-center w-10 h-10 rounded-xl2 text-ink-mute hover:text-ink hover:bg-white/5 transition ${refreshing ? "spin" : ""}`}><Refresh /></button>
                <button onClick={() => setShowSettings(true)} aria-label="Настройки"
                  className="no-drag grid place-items-center w-10 h-10 rounded-xl2 text-ink-mute hover:text-ink hover:bg-white/5 transition"><Gear /></button>
              </div>
            </div>
          )}
          {error && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs bg-red-500/15 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20">{error}</div>}
        </section>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {updating && <UpdateOverlay onDone={() => { setUpdating(false); beginLaunch(); }} onError={(m) => { setUpdating(false); setError(m); }} />}
      {loadingServer && <LoadingOverlay server={loadingServer} onDone={() => setLoadingServer(null)} />}
    </div>
  );
}
