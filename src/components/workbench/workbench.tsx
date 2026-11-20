"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { seedCatalog, type NovelCatalog, type NovelRecord } from "@/lib/novels/model";
import { Characters } from "./characters";
import { ManuscriptEditor, WritingResume } from "./manuscript-editor";
import { NovelMemory } from "./novel-memory";
import { NovelOutline } from "./novel-outline";
import { Worldview } from "./worldview";
import {
  IconBell,
  IconBookMark,
  IconDots,
  IconGlobe,
  IconHome,
  IconHomeStroke,
  IconMemory,
  IconNovel,
  IconNovelSolid,
  IconPen,
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
type NovelScreen = "outline" | "world" | "characters" | "memory";
type OpenManuscript = { novelId: string; chapterId: string };

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

const novelLinks = [
  { id: "world", label: "世界观设定", icon: IconGlobe },
  { id: "characters", label: "人物档案", icon: IconPerson },
  { id: "outline", label: "剧情大纲", icon: IconPlot },
] as const;

const coverArt = {
  novel: NovelCover,
  star: StarSeaCover,
  river: RiverCover,
} as const;

export function Workbench() {
  const [tab, setTab] = useState<TabId>("home");
  const [screen, setScreen] = useState<"main" | NovelScreen>("main");
  const [catalog, setCatalog] = useState<NovelCatalog>(seedCatalog);
  const [catalogReady, setCatalogReady] = useState(false);
  const [openedId, setOpenedId] = useState(seedCatalog.currentId);
  const [outlineAtChapters, setOutlineAtChapters] = useState(false);
  const [editor, setEditor] = useState<OpenManuscript | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
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

  const showNewNovel = useEffectEvent((created: NovelRecord) => {
    if (editor) return;
    setOpenedId(created.id);
    setOutlineAtChapters(false);
    setScreen("outline");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setArrival(created);
  });

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
        setCatalogReady(true);
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
        if (created) showNewNovel(created);
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

  function leaveEditor() {
    if (editorDirty && !window.confirm("当前章节还有未保存的修改。确定离开吗？")) return false;
    setEditor(null);
    setEditorDirty(false);
    return true;
  }

  function openEditor(novelId: string, chapterId: string) {
    setEditor({ novelId, chapterId });
    window.scrollTo(0, 0);
  }

  function openNovelScreen(next: NovelScreen, id: string, showChapters = false) {
    if (editor && !leaveEditor()) return;
    void focusNovel(id);
    setOutlineAtChapters(showChapters);
    setScreen(next);
  }

  function selectTab(id: TabId) {
    if (id === "memory" && current) {
      openNovelScreen("memory", current.id);
      return;
    }
    if (editor && !leaveEditor()) return;
    setTab(id);
    setScreen("main");
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

  let detail: ReactNode;
  if (screen === "characters" && opened) {
    detail = (
      <Characters
        key={opened.id}
        novelId={opened.id}
        novelTitle={opened.title}
        onBack={() => setScreen("main")}
      />
    );
  } else if (screen === "world" && opened) {
    detail = (
      <Worldview
        key={opened.id}
        novelId={opened.id}
        novelTitle={opened.title}
        premise={opened.premise}
        onBack={() => setScreen("main")}
      />
    );
  } else if (screen === "outline" && opened) {
    detail = (
      <NovelOutline
        key={opened.id}
        novelId={opened.id}
        title={opened.title}
        writtenWan={opened.writtenWan}
        targetWan={opened.targetWan}
        initialPane={outlineAtChapters ? "chapters" : "hub"}
        onOpenChapter={(chapterId) => openEditor(opened.id, chapterId)}
        onBack={() => setScreen("main")}
      />
    );
  } else if (screen === "memory" && opened) {
    detail = (
      <NovelMemory
        key={opened.id}
        novelId={opened.id}
        title={opened.title}
        onBack={() => setScreen("main")}
      />
    );
  }

  const activeTab = editor ? "write" : detail ? (screen === "memory" ? "memory" : undefined) : tab;
  const workspaceNovel = editor ? catalog.novels.find((novel) => novel.id === editor.novelId) : detail ? opened : current;
  const writingResume = catalogReady && current ? (
    <WritingResume
      key={current.id}
      novelId={current.id}
      onOpenChapter={(chapterId) => openEditor(current.id, chapterId)}
      onOpenChapters={() => openNovelScreen("outline", current.id, true)}
    />
  ) : null;
  const enteringOutline = arrival && screen === "outline" && arrival.id === opened?.id;
  const body = detail ? (
    <div className={`relative flex h-dvh flex-col overflow-hidden ${enteringOutline ? "novel-page-enter" : ""}`}>
      {detail}
    </div>
  ) : (
    <div
      className={`relative flex min-h-dvh flex-col ${novels ? "bg-white lg:bg-transparent" : ""}`}
    >
      {novels ? (
        <header className="workbench-gutter grid grid-cols-[40px_1fr_40px] items-center px-3 pb-1 pt-5 lg:grid-cols-[1fr_auto] lg:pb-4 lg:pt-7">
          <span className="lg:hidden" />
          <h1 className="text-center text-[18px] font-semibold tracking-tight lg:text-left lg:text-[26px]">
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
        <header className="workbench-gutter flex items-center gap-2.5 px-4 pb-1 pt-5 lg:pb-4 lg:pt-7">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#5b40db] text-white shadow-[0_6px_14px_rgba(91,64,219,0.28)] lg:hidden">
            <IconBookMark className="size-[22px]" />
          </span>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight lg:text-[26px]">
            <span className="lg:hidden">小说创作工作台</span>
            <span className="hidden lg:inline">{tabs.find((item) => item.id === tab)?.label}</span>
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

      <main className={`workbench-gutter flex flex-1 flex-col px-4 lg:flex-none lg:pb-8 ${novels ? "pb-6" : "pb-2"}`}>
        {tab === "home" && current ? (
          <HomePanel
            novel={current}
            worldTotal={worldTotal}
            castTotal={castTotal}
            plotTotal={plotTotal}
            writingResume={writingResume}
            onOpenOutline={() => openNovelScreen("outline", current.id)}
            onOpenWorld={() => openNovelScreen("world", current.id)}
            onOpenCharacters={() => openNovelScreen("characters", current.id)}
            onOpenMemory={() => openNovelScreen("memory", current.id)}
          />
        ) : null}
        {tab === "novels" ? (
          <NovelsPanel novels={catalog.novels} onOpenOutline={(id) => openNovelScreen("outline", id)} onDelete={removeNovel} />
        ) : null}
        {tab === "write" && current ? (
          <section className="w-full max-w-xl">
            <PanelTitle title="章节正文" hint={`《${current.title}》`} />
            {writingResume}
          </section>
        ) : null}
        {tab === "memory" ? <MemoryPanel /> : null}
        {tab === "me" ? <MePanel /> : null}
      </main>

      {novels ? (
        <button
          type="button"
          aria-label="新建小说"
          className="absolute bottom-[calc(72px+env(safe-area-inset-bottom))] right-5 z-10 flex size-14 items-center justify-center gap-1.5 rounded-full bg-[#5b40db] text-white shadow-[0_10px_22px_rgba(91,64,219,0.34)] active:bg-[#4e36c4] lg:bottom-auto lg:right-[calc(var(--workbench-gutter)+3rem)] lg:top-7 lg:h-10 lg:w-auto lg:rounded-xl lg:px-4 lg:text-sm"
        >
          <IconPlus className="size-7 lg:size-4" />
          <span className="hidden lg:inline">新建小说</span>
        </button>
      ) : null}

      <footer className="sticky bottom-0 lg:static">
        {tab === "home" ? (
          <div className="workbench-gutter bg-gradient-to-t from-[#f6f7fb] via-[#f6f7fb] to-transparent px-4 pb-3 pt-2 lg:bg-none lg:pb-8 lg:pt-0">
            <button
              type="button"
              className="flex h-[52px] w-full items-center justify-center gap-1.5 rounded-2xl bg-[#5b40db] text-[16px] font-medium text-white shadow-[0_10px_22px_rgba(91,64,219,0.32)] active:bg-[#4e36c4] lg:ml-auto lg:h-11 lg:w-auto lg:rounded-xl lg:px-5 lg:text-sm"
            >
              <IconPlus className="size-5" />
              新建小说
            </button>
          </div>
        ) : novels ? null : (
          <div className="h-3 bg-gradient-to-t from-[#f6f7fb] to-transparent lg:hidden" />
        )}
        <WorkbenchNav activeTab={activeTab} onSelect={selectTab} />
      </footer>
    </div>
  );

  return (
    <div className="workbench-shell mx-auto flex min-h-dvh w-full max-w-[430px] bg-[#f6f7fb] text-[#16161e] shadow-[0_0_40px_rgba(22,22,40,0.08)] sm:max-w-[760px] lg:max-w-none lg:shadow-none">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto border-r border-[#e8e8f0] bg-white px-4 py-7 lg:flex xl:w-60">
        <div className="mb-8 flex items-center gap-2.5 px-2 text-sm font-semibold">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#5b40db] text-white">
            <IconBookMark className="size-[22px]" />
          </span>
          小说创作工作台
        </div>
        <WorkbenchNav desktop activeTab={activeTab} onSelect={selectTab} />
        {workspaceNovel ? (
          <nav className="mt-6 grid gap-1 border-t border-[#eceef3] pt-5" aria-label="小说工作区">
            <p className="mb-1 truncate px-3 text-xs font-medium text-[#707587]" title={workspaceNovel.title}>
              {workspaceNovel.title}
            </p>
            {novelLinks.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={detail && screen === id ? "page" : undefined}
                onClick={() => openNovelScreen(id, workspaceNovel.id)}
                className="workbench-sidebar-link"
              >
                <Icon className="size-5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        ) : null}
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full lg:max-w-[1240px]">
          {!editor || detail ? <div hidden={Boolean(editor)}>{body}</div> : null}
          {editor ? (
            <ManuscriptEditor
              key={`${editor.novelId}/${editor.chapterId}`}
              novelId={editor.novelId}
              chapterId={editor.chapterId}
              onDirtyChange={setEditorDirty}
              onChangeChapter={(chapterId) => {
                if (leaveEditor()) openEditor(editor.novelId, chapterId);
              }}
              onBack={leaveEditor}
            />
          ) : null}
        </div>
      </div>
      {arrival ? <NovelArrival novel={arrival} onDone={() => setArrival(null)} /> : null}
    </div>
  );
}

function WorkbenchNav({
  activeTab,
  desktop = false,
  onSelect,
}: {
  activeTab?: TabId;
  desktop?: boolean;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <nav
      aria-label="主导航"
      className={desktop ? "grid gap-1" : "grid grid-cols-5 border-t border-[#eceef3] bg-white px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"}
    >
      {tabs.map((item) => {
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(item.id)}
            className={desktop
              ? "workbench-sidebar-link"
              : `flex flex-col items-center gap-0.5 py-1 text-[11px] ${active ? "text-[#5b40db]" : "text-[#b0b4c0]"}`}
          >
            <NavIcon id={item.id} active={active} icon={item.icon} />
            {item.label}
          </button>
        );
      })}
    </nav>
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
      <div className="novel-arrive-veil flex h-dvh w-full max-w-[430px] flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#7460ea_0%,#322664_55%,#171326_100%)] text-white sm:max-w-[760px] lg:max-w-none">
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
  writingResume,
  onOpenOutline,
  onOpenWorld,
  onOpenCharacters,
  onOpenMemory,
}: {
  novel: NovelRecord;
  worldTotal: number | null;
  castTotal: number | null;
  plotTotal: { volumes: number; chapters: number } | null;
  writingResume: ReactNode;
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
    <div className="flex flex-1 flex-col gap-4 pt-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
      <NovelCard novel={novel} onOpen={onOpenOutline} />
      <section aria-label="创作工具" className="grid grid-cols-3 gap-3 lg:col-span-2 lg:gap-4">
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
      {writingResume ? (
        <section className="mt-auto pt-1 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:pt-0">
          <h2 className="mb-2.5 px-0.5 text-[17px] font-semibold tracking-tight">正文创作</h2>
          {writingResume}
        </section>
      ) : null}
    </div>
  );
}

function NovelCard({ novel, onOpen }: { novel: NovelRecord; onOpen?: () => void }) {
  const Cover = coverArt[novel.cover];
  const percent = novel.targetWan === 0 ? 0 : (novel.writtenWan / novel.targetWan) * 100;
  const percentLabel = Number.isInteger(novel.writtenWan) ? String(percent) : percent.toFixed(1);
  const writing = novel.status === "writing";
  return (
    <article className="relative flex gap-3 rounded-[20px] bg-white p-3.5 text-left shadow-[0_8px_24px_rgba(28,28,48,0.05)] lg:gap-5 lg:p-5">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 z-10 rounded-[20px]"
          aria-label={`打开${novel.title}`}
        />
      ) : null}
      <Cover className="h-[112px] w-[84px] shrink-0 rounded-[14px] lg:h-36 lg:w-27" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 break-words pt-0.5 text-[18px] font-semibold leading-tight tracking-tight lg:text-[22px]">
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
        {novel.premise ? (
          <p className="mt-2 hidden text-sm leading-5 text-[#666b7a] lg:line-clamp-2">{novel.premise}</p>
        ) : null}
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
      className="flex min-h-[128px] flex-col items-center justify-center rounded-[18px] bg-white px-1 py-4 text-center shadow-[0_8px_24px_rgba(28,28,48,0.045)] active:bg-[#fafaff] lg:items-start lg:px-5 lg:text-left lg:hover:bg-[#fafaff]"
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
      <div role="tablist" aria-label="小说状态" className="grid grid-cols-3 lg:flex lg:gap-3">
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

      <ul className="mt-3 flex flex-col gap-5 md:grid md:grid-cols-2 2xl:grid-cols-3">
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
        <div className="workbench-dialog absolute inset-0 z-40 flex flex-col justify-end bg-black/30">
          <div className="workbench-dialog-panel rounded-t-3xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-5">
            <h2 className="text-[17px] font-semibold">删除《{pending.title}》</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#6f7482]">这本书的正文、大纲、世界观、人物档案和小说记忆会一起删除。</p>
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
