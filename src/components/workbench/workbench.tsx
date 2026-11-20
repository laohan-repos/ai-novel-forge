"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { seedCatalog, type NovelCatalog, type NovelRecord } from "@/lib/novels/model";
import { Characters } from "./characters";
import { NovelMemory } from "./novel-memory";
import { NovelOutline } from "./novel-outline";
import { Worldview } from "./worldview";
import {
  IconBell,
  IconBookMark,
  IconChevron,
  IconDots,
  IconGlobe,
  IconHome,
  IconHomeStroke,
  IconMemory,
  IconNovel,
  IconNovelSolid,
  IconPen,
  IconPencil,
  IconPerson,
  IconPlot,
  IconPlus,
  IconSearch,
  IconShield,
  IconUpload,
  IconUser,
  NovelCover,
  RiverCover,
  StarSeaCover,
} from "./icons";

type TabId = "home" | "novels" | "write" | "memory" | "me";

const modules = [
  { title: "世界观设定", subtitle: "68 项", icon: IconGlobe },
  { title: "人物档案", subtitle: "24 位", icon: IconPerson },
  { title: "剧情大纲", subtitle: "8 卷·320 章", icon: IconPlot },
  { title: "小说记忆", subtitle: "事件·伏笔·状态", icon: IconMemory },
  { title: "质量检查", subtitle: "一致性·逻辑", icon: IconShield },
  { title: "导出发布", subtitle: "TXT·DOCX·EPUB", icon: IconUpload },
] as const;

const tabs: { id: TabId; label: string; icon: typeof IconHome }[] = [
  { id: "home", label: "首页", icon: IconHome },
  { id: "novels", label: "小说", icon: IconNovel },
  { id: "write", label: "创作", icon: IconPen },
  { id: "memory", label: "记忆", icon: IconMemory },
  { id: "me", label: "我的", icon: IconUser },
];

const coverArt = {
  novel: NovelCover,
  star: StarSeaCover,
  river: RiverCover,
} as const;

export function Workbench() {
  const [tab, setTab] = useState<TabId>("home");
  const [screen, setScreen] = useState<"main" | "outline" | "world" | "characters" | "memory">("main");
  const [worldBack, setWorldBack] = useState<"main" | "outline">("main");
  const [catalog, setCatalog] = useState<NovelCatalog>(seedCatalog);
  const [openedId, setOpenedId] = useState(seedCatalog.currentId);
  const [arrival, setArrival] = useState<NovelRecord | null>(null);
  const [worldTotal, setWorldTotal] = useState<number | null>(null);
  const [castTotal, setCastTotal] = useState<number | null>(null);
  const [plotTotal, setPlotTotal] = useState<{ volumes: number; chapters: number } | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const openedIdRef = useRef(openedId);
  const catalogRevision = useRef(catalog.revision);
  openedIdRef.current = openedId;
  const novels = tab === "novels";
  const current =
    catalog.novels.find((novel) => novel.id === catalog.currentId) ?? catalog.novels[0];
  const opened = catalog.novels.find((novel) => novel.id === openedId) ?? current;

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch("/api/novels", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as { catalog: NovelCatalog };
        if (stopped) return;
        const next = data.catalog;
        if (next.revision < catalogRevision.current) return;
        catalogRevision.current = next.revision;
        setCatalog(next);
        if (!next.novels.some((novel) => novel.id === openedIdRef.current)) {
          setOpenedId(next.currentId);
          setScreen("main");
        }
        if (seenIds.current === null) {
          seenIds.current = new Set(next.novels.map((novel) => novel.id));
          return;
        }
        const created = next.novels.find((novel) => !seenIds.current?.has(novel.id));
        for (const novel of next.novels) seenIds.current.add(novel.id);
        if (!created) return;
        setOpenedId(created.id);
        setScreen("outline");
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduceMotion) setArrival(created);
      } catch {
        // Keep the shelf on screen if the file is briefly locked.
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const novelId = current?.id;
    if (!novelId) return;
    let stopped = false;
    setWorldTotal(null);
    async function refreshWorld() {
      try {
        const response = await fetch(`/api/worldview?novelId=${encodeURIComponent(novelId)}`, {
          cache: "no-store",
        });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as { state: { entries: unknown[] } };
        if (!stopped) setWorldTotal(data.state.entries.length);
      } catch {
        // Keep the last count if the file is briefly locked.
      }
    }
    void refreshWorld();
    const timer = window.setInterval(() => void refreshWorld(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [current?.id]);

  useEffect(() => {
    const novelId = current?.id;
    if (!novelId) return;
    let stopped = false;
    setCastTotal(null);
    async function refreshCast() {
      try {
        const response = await fetch(`/api/characters?novelId=${encodeURIComponent(novelId)}`, {
          cache: "no-store",
        });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as { archive?: { characters: unknown[] } };
        if (!stopped && data.archive) setCastTotal(data.archive.characters.length);
      } catch {
        // Keep the last count if the file is briefly locked.
      }
    }
    void refreshCast();
    const timer = window.setInterval(() => void refreshCast(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [current?.id]);

  useEffect(() => {
    const novelId = current?.id;
    if (!novelId) return;
    let stopped = false;
    setPlotTotal(null);
    async function refreshPlot() {
      try {
        const response = await fetch(`/api/plot?novelId=${encodeURIComponent(novelId)}`, {
          cache: "no-store",
        });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as {
          plot?: {
            volumes?: { retired?: boolean; total?: number }[];
            chapters?: { retired?: boolean; number?: number }[];
          };
        };
        const volumes = (data.plot?.volumes ?? []).filter((volume) => !volume.retired);
        const chapters = (data.plot?.chapters ?? []).filter((chapter) => !chapter.retired);
        const planned = Math.max(
          volumes.reduce((sum, volume) => sum + (volume.total ?? 0), 0),
          chapters.reduce((max, chapter) => Math.max(max, chapter.number ?? 0), 0),
        );
        if (!stopped) setPlotTotal({ volumes: volumes.length, chapters: planned });
      } catch {
        // Keep the last count if the file is briefly locked.
      }
    }
    void refreshPlot();
    const timer = window.setInterval(() => void refreshPlot(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [current?.id]);

  async function focusNovel(id: string) {
    setOpenedId(id);
    setCatalog((previous) =>
      previous.currentId === id ? previous : { ...previous, currentId: id },
    );
    try {
      const response = await fetch("/api/novels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open", id }),
        cache: "no-store",
      });
      const data = (await response.json()) as { catalog?: NovelCatalog };
      if (response.ok && data.catalog && data.catalog.revision >= catalogRevision.current) {
        catalogRevision.current = data.catalog.revision;
        setCatalog(data.catalog);
      }
    } catch {
      // The local selection still opens the book.
    }
  }

  function openOutline(id: string) {
    void focusNovel(id);
    setScreen("outline");
  }

  function openWorld(from: "main" | "outline", id: string) {
    void focusNovel(id);
    setWorldBack(from);
    setScreen("world");
  }

  function openCharacters(id: string) {
    void focusNovel(id);
    setScreen("characters");
  }

  function openMemory(id: string) {
    void focusNovel(id);
    setScreen("memory");
  }

  async function removeNovel(id: string) {
    const response = await fetch("/api/novels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
      cache: "no-store",
    });
    const data = (await response.json()) as { catalog?: NovelCatalog; message?: string };
    if (!response.ok || !data.catalog) {
      throw new Error(data.message ?? "删除失败");
    }
    if (data.catalog.revision >= catalogRevision.current) {
      catalogRevision.current = data.catalog.revision;
      setCatalog(data.catalog);
    }
    if (openedIdRef.current === id) {
      setOpenedId(data.catalog.currentId);
      setScreen("main");
    }
  }

  let body: ReactNode;
  if (screen === "characters" && opened) {
    body = (
      <div className="relative mx-auto flex h-dvh max-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f7f8fb] text-[#16161e] shadow-[0_0_40px_rgba(22,22,40,0.08)]">
        <Characters
          key={opened.id}
          novelId={opened.id}
          novelTitle={opened.title}
          onBack={() => setScreen("main")}
        />
      </div>
    );
  } else if (screen === "world" && opened) {
    body = (
      <div className="relative mx-auto flex h-dvh max-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f6f7fb] text-[#16161e] shadow-[0_0_40px_rgba(22,22,40,0.08)]">
        <Worldview
          key={opened.id}
          novelId={opened.id}
          novelTitle={opened.title}
          premise={opened.premise}
          onBack={() => setScreen(worldBack)}
        />
      </div>
    );
  } else if (screen === "outline" && opened) {
    body = (
      <div
        className={`relative mx-auto flex h-dvh max-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f6f7fb] text-[#16161e] shadow-[0_0_40px_rgba(22,22,40,0.08)] ${
          arrival?.id === opened.id ? "novel-page-enter" : ""
        }`}
      >
        <NovelOutline
          key={opened.id}
          novelId={opened.id}
          title={opened.title}
          writtenWan={opened.writtenWan}
          targetWan={opened.targetWan}
          onBack={() => setScreen("main")}
        />
      </div>
    );
  } else if (screen === "memory" && opened) {
    body = (
      <div className="relative mx-auto flex h-dvh max-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f6f7fb] text-[#16161e] shadow-[0_0_40px_rgba(22,22,40,0.08)]">
        <NovelMemory
          key={opened.id}
          novelId={opened.id}
          title={opened.title}
          onBack={() => setScreen("main")}
        />
      </div>
    );
  } else {
    body = (
    <div
      className={`relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col text-[#16161e] shadow-[0_0_40px_rgba(22,22,40,0.08)] ${
        novels ? "bg-white" : "bg-[#f6f7fb]"
      }`}
    >
      {novels ? (
        <header className="grid grid-cols-[40px_1fr_40px] items-center px-3 pb-1 pt-5">
          <span />
          <h1 className="text-center text-[18px] font-semibold tracking-tight">
            我的小说
          </h1>
          <button
            type="button"
            aria-label="搜索"
            className="grid size-10 place-items-center rounded-full text-[#2a2c36] active:bg-black/5"
          >
            <IconSearch className="size-[22px]" />
          </button>
        </header>
      ) : (
        <header className="flex items-center gap-2.5 px-4 pb-1 pt-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#5b40db] text-white shadow-[0_6px_14px_rgba(91,64,219,0.28)]">
            <IconBookMark className="size-[22px]" />
          </span>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight">
            小说创作工作台
          </h1>
          <button
            type="button"
            aria-label="搜索"
            className="grid size-9 place-items-center rounded-full text-[#2a2c36] active:bg-black/5"
          >
            <IconSearch className="size-[22px]" />
          </button>
          <button
            type="button"
            aria-label="通知，有未读消息"
            className="relative grid size-9 place-items-center rounded-full text-[#2a2c36] active:bg-black/5"
          >
            <IconBell className="size-[22px]" />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#e24b43] ring-2 ring-[#f6f7fb]" />
          </button>
        </header>
      )}

      <main className={`flex flex-1 flex-col px-4 ${novels ? "pb-6" : "pb-2"}`}>
        {tab === "home" && current ? (
          <HomePanel
            novel={current}
            worldTotal={worldTotal}
            castTotal={castTotal}
            plotTotal={plotTotal}
            onOpenOutline={() => openOutline(current.id)}
            onOpenWorld={() => openWorld("main", current.id)}
            onOpenCharacters={() => openCharacters(current.id)}
            onOpenMemory={() => openMemory(current.id)}
          />
        ) : null}
        {tab === "novels" ? (
          <NovelsPanel novels={catalog.novels} onOpenOutline={openOutline} onDelete={removeNovel} />
        ) : null}
        {tab === "write" ? <WritePanel /> : null}
        {tab === "memory" ? <MemoryPanel /> : null}
        {tab === "me" ? <MePanel /> : null}
      </main>

      {novels ? (
        <button
          type="button"
          aria-label="新建小说"
          className="absolute bottom-[calc(72px+env(safe-area-inset-bottom))] right-5 z-10 grid size-14 place-items-center rounded-full bg-[#5b40db] text-white shadow-[0_10px_22px_rgba(91,64,219,0.34)] active:bg-[#4e36c4]"
        >
          <IconPlus className="size-7" />
        </button>
      ) : null}

      <footer className="sticky bottom-0">
        {tab === "home" ? (
          <div className="bg-gradient-to-t from-[#f6f7fb] via-[#f6f7fb] to-transparent px-4 pb-3 pt-2">
            <button
              type="button"
              className="flex h-[52px] w-full items-center justify-center gap-1.5 rounded-2xl bg-[#5b40db] text-[16px] font-medium text-white shadow-[0_10px_22px_rgba(91,64,219,0.32)] active:bg-[#4e36c4]"
            >
              <IconPlus className="size-5" />
              新建小说
            </button>
          </div>
        ) : novels ? null : (
          <div className="h-3 bg-gradient-to-t from-[#f6f7fb] to-transparent" />
        )}
        <nav
          aria-label="主导航"
          className="grid grid-cols-5 border-t border-[#eceef3] bg-white px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5"
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (item.id === "memory" && current) {
                    openMemory(current.id);
                    return;
                  }
                  setTab(item.id);
                }}
                className={`flex flex-col items-center gap-0.5 py-1 text-[11px] ${
                  active ? "text-[#5b40db]" : "text-[#b0b4c0]"
                }`}
              >
                <NavIcon id={item.id} active={active} icon={item.icon} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </footer>
    </div>
    );
  }

  return (
    <>
      {body}
      {arrival ? <NovelArrival novel={arrival} onDone={() => setArrival(null)} /> : null}
    </>
  );
}

function NovelArrival({ novel, onDone }: { novel: NovelRecord; onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), 1700);
    return () => window.clearTimeout(timer);
  }, [novel.id]);
  const Cover = coverArt[novel.cover];

  return (
    <div className="fixed inset-0 z-50 flex justify-center" role="status" aria-live="polite">
      <div className="novel-arrive-veil flex h-dvh w-full max-w-[430px] flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#7460ea_0%,#322664_55%,#171326_100%)] text-white">
        <div className="novel-arrive-copy flex flex-col items-center px-8 text-center">
          <p className="text-[12px] font-medium tracking-[0.28em] text-white/70">新书已创建</p>
          <Cover className="mt-6 h-[168px] w-[126px] rounded-[18px] shadow-[0_18px_40px_rgba(0,0,0,0.28)]" />
          <h2 className="mt-5 text-[30px] font-semibold leading-none tracking-tight">{novel.title}</h2>
          <p className="mt-3 line-clamp-2 max-w-[16em] text-[14px] leading-relaxed text-white/75">
            {novel.genre}
            {novel.premise ? ` · ${novel.premise}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function NavIcon({
  id,
  active,
  icon: Icon,
}: {
  id: TabId;
  active: boolean;
  icon: typeof IconHome;
}) {
  if (id === "home") {
    const HomeIcon = active ? IconHome : IconHomeStroke;
    return <HomeIcon className="size-[22px]" />;
  }
  if (id === "novels") {
    const NovelIcon = active ? IconNovelSolid : IconNovel;
    return <NovelIcon className="size-[22px]" />;
  }
  return <Icon className="size-[22px]" />;
}

function HomePanel({
  novel,
  worldTotal,
  castTotal,
  plotTotal,
  onOpenOutline,
  onOpenWorld,
  onOpenCharacters,
  onOpenMemory,
}: {
  novel: NovelRecord;
  worldTotal: number | null;
  castTotal: number | null;
  plotTotal: { volumes: number; chapters: number } | null;
  onOpenOutline: () => void;
  onOpenWorld: () => void;
  onOpenCharacters: () => void;
  onOpenMemory: () => void;
}) {
  const worldviewLabel = worldTotal === null ? "…" : `${worldTotal} 项`;
  const castLabel = castTotal === null ? "…" : `${castTotal} 位`;
  const plotLabel = plotTotal === null ? "…" : `${plotTotal.volumes} 卷·${plotTotal.chapters} 章`;
  const baseTools =
    novel.id === "fanchen-wendao"
      ? [...modules]
      : [
          { title: "世界观设定", subtitle: "0 项", icon: IconGlobe },
          { title: "人物档案", subtitle: "0 位", icon: IconPerson },
          { title: "剧情大纲", subtitle: "1 卷·0 章", icon: IconPlot },
          { title: "小说记忆", subtitle: "章节·人物·线索", icon: IconMemory },
          { title: "质量检查", subtitle: "尚未检查", icon: IconShield },
          { title: "导出发布", subtitle: "TXT·DOCX·EPUB", icon: IconUpload },
        ];
  const tools = baseTools.map((item) => {
    if (item.title === "世界观设定") return { ...item, subtitle: worldviewLabel };
    if (item.title === "人物档案") return { ...item, subtitle: castLabel };
    if (item.title === "剧情大纲") return { ...item, subtitle: plotLabel };
    return item;
  });
  return (
    <div className="flex flex-1 flex-col gap-4 pt-3">
      <NovelCard novel={novel} onOpen={onOpenOutline} />
      <section aria-label="创作工具" className="grid grid-cols-3 gap-3">
        {tools.map((item) => (
          <ModuleCard
            key={item.title}
            {...item}
            onClick={
              item.title === "剧情大纲"
                ? onOpenOutline
                : item.title === "世界观设定"
                  ? onOpenWorld
                : item.title === "人物档案"
                  ? onOpenCharacters
                  : item.title === "小说记忆"
                    ? onOpenMemory
                    : undefined
            }
          />
        ))}
      </section>
      <div className="mt-auto pt-1">
        <RecentTask novel={novel} />
      </div>
    </div>
  );
}

function NovelCard({ novel, onOpen }: { novel: NovelRecord; onOpen?: () => void }) {
  const Cover = coverArt[novel.cover];
  const percent = novel.targetWan === 0 ? 0 : (novel.writtenWan / novel.targetWan) * 100;
  const percentLabel = Number.isInteger(novel.writtenWan) ? String(percent) : percent.toFixed(1);
  const writing = novel.status === "writing";
  return (
    <article className="relative flex gap-3 rounded-[20px] bg-white p-3.5 text-left shadow-[0_8px_24px_rgba(28,28,48,0.05)]">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 z-10 rounded-[20px]"
          aria-label={`打开${novel.title}`}
        />
      ) : null}
      <Cover className="h-[112px] w-[84px] shrink-0 rounded-[14px]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h2 className="pt-0.5 text-[18px] font-semibold leading-none tracking-tight">
            {novel.title}
          </h2>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none ${
              writing ? "bg-[#e7e3fb] text-[#5b40db]" : "bg-[#e7f6ee] text-[#3b9a68]"
            }`}
          >
            {writing ? "创作中" : "已完成"}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-[#8e929c]">
          {novel.genre} · {writing ? "连载中" : "已完结"}
        </p>
        <p className="mt-2 text-[13px] leading-none text-[#8e929c]">
          已写 <span className="font-semibold text-[#2a2c36]">{formatWan(novel.writtenWan)}</span> 万字
          / 目标 {formatWan(novel.targetWan)} 万字
        </p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e4e5ec]">
            <div
              className={`h-full rounded-full ${writing ? "bg-[#5b40db]" : "bg-[#3aaa72]"}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <span className="text-[12px] font-medium tabular-nums text-[#6d7180]">
            {percentLabel}%
          </span>
        </div>
      </div>
    </article>
  );
}

function ModuleCard({
  title,
  subtitle,
  icon: Icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: typeof IconGlobe;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[128px] flex-col items-center justify-center rounded-[18px] bg-white px-1 py-4 text-center shadow-[0_8px_24px_rgba(28,28,48,0.045)] active:bg-[#fafaff]"
    >
      <Icon className="size-8 text-[#5b40db]" />
      <span className="mt-2.5 text-[14px] font-medium leading-none text-[#1c1d26]">
        {title}
      </span>
      <span className="mt-1.5 whitespace-nowrap text-[11px] leading-none text-[#a0a4b0]">
        {subtitle}
      </span>
    </button>
  );
}

function RecentTask({ novel }: { novel: NovelRecord }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <h2 className="text-[17px] font-semibold tracking-tight">最近任务</h2>
        <button
          type="button"
          className="flex items-center text-[13px] text-[#9aa0ae]"
        >
          查看全部
          <IconChevron className="size-4" />
        </button>
      </div>
      {novel.id === "fanchen-wendao" ? (
        <TaskCard />
      ) : (
        <article className="rounded-[18px] bg-white px-3.5 py-4 text-[13px] text-[#9aa0ae] shadow-[0_8px_24px_rgba(28,28,48,0.045)]">
          《{novel.title}》还没有章节。书名确认后，可以从大纲开始往下写。
        </article>
      )}
    </section>
  );
}

function TaskCard() {
  return (
    <article className="flex items-start gap-3 rounded-[18px] bg-white px-3.5 py-3.5 shadow-[0_8px_24px_rgba(28,28,48,0.045)]">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0eefd] text-[#5b40db]">
        <IconPencil className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold leading-snug">
            第 186 章：深夜来客
          </h3>
          <span className="mt-0.5 shrink-0 rounded-full bg-[#f8f1e7] px-2 py-1 text-[11px] font-medium leading-none text-[#b8916a]">
            待审核
          </span>
        </div>
        <p className="mt-1 truncate text-[12px] text-[#9aa0ae]">
          主角发现幕后势力的线索，推动第三卷...
        </p>
      </div>
    </article>
  );
}

function PanelTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-0.5 pb-3 pt-2">
      <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-[13px] text-[#8e929c]">{hint}</p>
    </div>
  );
}

type NovelFilter = "all" | NovelRecord["status"];

const novelFilters: { id: NovelFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "writing", label: "创作中" },
  { id: "done", label: "已完成" },
];

function formatWan(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function NovelsPanel({
  novels,
  onOpenOutline,
  onDelete,
}: {
  novels: NovelRecord[];
  onOpenOutline: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<NovelFilter>("all");
  const [pending, setPending] = useState<NovelRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const visible = novels.filter(
    (novel) => filter === "all" || novel.status === filter,
  );

  return (
    <div className="flex flex-1 flex-col pt-2">
      <div role="tablist" aria-label="小说状态" className="grid grid-cols-3">
        {novelFilters.map((item) => {
          const active = filter === item.id;
          const count = novels.filter(
            (novel) => item.id === "all" || novel.status === item.id,
          ).length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.id)}
              className="relative flex flex-col items-center pb-2.5"
            >
              <span
                className={`rounded-full px-3 py-1.5 text-[15px] leading-none ${
                  active
                    ? "bg-[#f0ebff] font-semibold text-[#5b40db]"
                    : "font-medium text-[#8d929e]"
                }`}
              >
                {item.label} ({count})
              </span>
              {active ? (
                <span className="absolute bottom-0 h-[3px] w-7 rounded-full bg-[#5b40db]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-col gap-5">
        {visible.map((novel) => (
          <NovelRow
            key={novel.id}
            novel={novel}
            onOpen={() => onOpenOutline(novel.id)}
            onAskDelete={() => {
              setDeleteError("");
              setPending(novel);
            }}
          />
        ))}
      </ul>
      {pending ? (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/30">
          <div className="rounded-t-3xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-5">
            <h2 className="text-[17px] font-semibold">删除《{pending.title}》</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#6f7482]">这本书的世界观和人物档案会一起删除。</p>
            {deleteError ? <p className="mt-2 text-[13px] text-[#d14343]">{deleteError}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="h-11 rounded-2xl bg-[#f3f4f8] text-[15px] font-medium text-[#1c1e28]"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  setDeleteError("");
                  void onDelete(pending.id)
                    .then(() => setPending(null))
                    .catch((error: unknown) => {
                      setDeleteError(error instanceof Error ? error.message : "删除失败");
                    })
                    .finally(() => setDeleting(false));
                }}
                className="h-11 rounded-2xl bg-[#d14343] text-[15px] font-medium text-white disabled:opacity-60"
              >
                {deleting ? "删除中" : "删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NovelRow({
  novel,
  onOpen,
  onAskDelete,
}: {
  novel: NovelRecord;
  onOpen?: () => void;
  onAskDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const percent = novel.targetWan === 0 ? 0 : Math.round((novel.writtenWan / novel.targetWan) * 1000) / 10;
  const percentLabel = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(1);
  const writing = novel.status === "writing";
  const Cover = coverArt[novel.cover];

  return (
    <li className="relative flex gap-3">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 z-10 rounded-xl"
          aria-label={`打开${novel.title}`}
        />
      ) : null}
      <Cover className="h-[96px] w-[72px] shrink-0 overflow-hidden rounded-[12px]" />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-none tracking-tight">
            {novel.title}
          </h2>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium leading-none ${
              writing
                ? "bg-[#efe9ff] text-[#6a48d6]"
                : "bg-[#e7f6ee] text-[#3b9a68]"
            }`}
          >
            {writing ? "创作中" : "已完成"}
          </span>
          <button
            type="button"
            aria-label={`${novel.title}更多操作`}
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            className="relative z-30 grid size-6 shrink-0 place-items-center text-[#c5c8d2]"
          >
            <IconDots className="size-5" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="关闭菜单"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-20"
              />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onAskDelete();
                }}
                className="absolute right-0 top-7 z-30 rounded-xl bg-white px-4 py-2.5 text-[14px] font-medium text-[#d14343] shadow-[0_8px_24px_rgba(28,28,48,0.12)]"
              >
                删除
              </button>
            </>
          ) : null}
        </div>
        <p className="mt-2 text-[13px] leading-none text-[#9aa0ae]">
          {novel.genre} · {formatWan(novel.targetWan)} 万字
        </p>
        <p className="mt-2 text-[13px] leading-none text-[#6f7482]">
          {formatWan(novel.writtenWan)} 万 / {formatWan(novel.targetWan)} 万 (
          {percentLabel}%)
        </p>
        <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[#e7e8ee]">
          <div
            className={`h-full rounded-full ${
              writing ? "bg-[#5b40db]" : "bg-[#3aaa72]"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function WritePanel() {
  return (
    <div>
      <PanelTitle title="创作" hint="继续未完成的章节" />
      <TaskCard />
    </div>
  );
}

function MemoryPanel() {
  const items = [
    ["事件", "12"],
    ["伏笔", "7"],
    ["状态", "24"],
  ];
  return (
    <div>
      <PanelTitle title="小说记忆" hint="凡尘问道 · 事件、伏笔与状态" />
      <ul className="overflow-hidden rounded-[18px] bg-white shadow-[0_8px_24px_rgba(28,28,48,0.045)]">
        {items.map(([label, count], index) => (
          <li
            key={label}
            className={`flex items-center justify-between px-4 py-4 ${
              index > 0 ? "border-t border-[#f1f2f6]" : ""
            }`}
          >
            <span className="text-[15px] font-medium">{label}</span>
            <span className="text-[13px] text-[#8e929c]">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MePanel() {
  return (
    <div>
      <PanelTitle title="我的" hint="创作者账号" />
      <article className="flex items-center gap-3 rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(28,28,48,0.045)]">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#efeaff] text-[#5b40db]">
          <IconUser className="size-6" />
        </span>
        <div>
          <p className="text-[16px] font-semibold">创作者</p>
          <p className="mt-0.5 text-[13px] text-[#8e929c]">1 部连载中的小说</p>
        </div>
      </article>
    </div>
  );
}
