"use client";

import { useEffect, useState, type ReactNode } from "react";
import { emptyPlot, fanchenPlot, type ChapterPlan, type PlotState, type VolumePlan } from "@/lib/plot/model";
import { IconBack, IconCheck, IconChevron, IconChevronDown, IconPerson, IconPlus, IconSearch } from "./icons";

type Thread = { id: string; title: string; summary: string; pending?: boolean };
type Hook = { id: string; title: string; summary: string; recovered: boolean; pending?: boolean };
type Pane = "hub" | "volumes" | "mainlines" | "branches" | "hooks" | "chapters" | "detail";
type DraftKind = "mainline" | "branch" | "hook";

export function NovelOutline({
  novelId,
  title,
  writtenWan,
  targetWan,
  onBack,
}: {
  novelId: string;
  title: string;
  writtenWan: number;
  targetWan: number;
  onBack: () => void;
}) {
  const [plot, setPlot] = useState<PlotState>(() => (novelId === "fanchen-wendao" ? fanchenPlot() : emptyPlot()));
  const [pane, setPane] = useState<Pane>("hub");
  const [openId, setOpenId] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const response = await fetch(`/api/plot?novelId=${encodeURIComponent(novelId)}`);
        if (!response.ok) return;
        const body = (await response.json()) as { plot?: PlotState };
        if (stopped || !body.plot) return;
        const next = body.plot;
        setPlot((current) => (next.revision >= current.revision ? next : current));
        setOpenId((current) => current || next.volumes.find((volume) => volume.status === "active")?.id || "");
      } catch {
        // Keep the outline already on screen.
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [novelId]);

  const pendingIds = new Set(plot.changes.map((change) => change.targetId));
  const volumes = plot.volumes.filter((volume) => !volume.retired);
  const chapters = plot.chapters.filter((chapter) => !chapter.retired);
  const mainlines = linesOf(plot, "mainline", pendingIds);
  const branches = linesOf(plot, "branch", pendingIds);
  const growth = linesOf(plot, "growth", pendingIds);
  const hooks = plot.foreshadowing.filter((hook) => !hook.retired).map((hook) => ({
    id: hook.id,
    title: hook.title,
    summary: hook.summary,
    recovered: hook.recoveredChapter !== null,
    pending: hook.itemStatus === "pending" || pendingIds.has(hook.id),
  }));
  const plannedChapters = Math.max(
    volumes.reduce((sum, volume) => sum + volume.total, 0),
    chapters.reduce((max, chapter) => Math.max(max, chapter.number), 0),
  );
  const writtenChapters = plot.progress.writtenChapters;
  const recovered = hooks.filter((hook) => hook.recovered).length;
  const recoveredPercent = hooks.length === 0 ? 0 : Math.round((recovered / hooks.length) * 100);
  const progress = targetWan === 0 ? 0 : Math.round((writtenWan / targetWan) * 1000) / 10;
  const keyword = query.trim();

  const sections = [
    { id: "volumes" as const, title: "分卷规划", detail: `${volumes.length} 卷 · 故事阶段与核心冲突`, icon: <BookGlyph /> },
    { id: "mainlines" as const, title: "主线剧情", detail: `${mainlines.length} 条 · 核心矛盾与发展脉络`, icon: <FlagGlyph /> },
    { id: "branches" as const, title: "支线剧情", detail: `${branches.length} 条 · 角色成长与世界拓展`, icon: <PenGlyph /> },
    {
      id: "hooks" as const,
      title: "伏笔与回收",
      detail: `${hooks.length} 个 · 已回收 ${recovered} 个 (${recoveredPercent}%)`,
      icon: <LoopGlyph />,
    },
    {
      id: "chapters" as const,
      title: "章节大纲",
      detail: `已规划 ${plannedChapters} 章 · 已完成 ${writtenChapters} 章`,
      icon: <BookGlyph />,
    },
  ].filter((section) => !keyword || `${section.title}${section.detail}`.includes(keyword));

  async function persist(action: string, extra: Record<string, string>) {
    const response = await fetch("/api/plot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ novelId, action, ...extra }),
    });
    const body = (await response.json()) as { plot?: PlotState; message?: string };
    if (!response.ok || !body.plot) {
      setToast(body.message || "保存失败");
      return null;
    }
    setPlot(body.plot);
    return body;
  }

  function addDraft(kind: DraftKind, name: string, summary: string) {
    void persist("add_thread", { kind, title: name, summary }).then((result) => {
      if (!result) return;
      setCreating(false);
      setPane(kind === "mainline" ? "mainlines" : kind === "branch" ? "branches" : "hooks");
      setToast("已加入大纲");
    });
  }

  function optimize() {
    void persist("optimize", {}).then((result) => {
      if (!result) return;
      setToast(result.message || "已补上一条开篇主线");
    });
  }

  const heading =
    pane === "hub"
      ? "剧情大纲"
      : pane === "detail"
        ? "大纲详情"
        : sections.find((section) => section.id === pane)?.title ??
          (pane === "volumes" ? "分卷规划" : pane === "mainlines" ? "主线剧情" : pane === "branches" ? "支线剧情" : pane === "hooks" ? "伏笔与回收" : "章节大纲");

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col bg-[#f6f7fb]">
      <header className="flex items-center gap-1 px-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="返回"
          onClick={() => {
            if (pane !== "hub") {
              setPane("hub");
              setQuery("");
              return;
            }
            onBack();
          }}
          className="grid size-10 place-items-center rounded-full text-[#5b40db] active:bg-black/5"
        >
          {pane === "hub" ? <IconPerson className="size-6" /> : <IconBack className="size-[22px] text-[#1c1e28]" />}
        </button>
        {searching ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索大纲"
            className="h-9 min-w-0 flex-1 rounded-full bg-white px-3 text-[14px] outline-none ring-1 ring-[#eceef3]"
            autoFocus
          />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-tight">{heading}</h1>
        )}
        <button
          type="button"
          aria-label="搜索"
          onClick={() => {
            setSearching((open) => !open);
            if (searching) setQuery("");
          }}
          className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
        >
          <IconSearch className="size-[22px]" />
        </button>
        <button
          type="button"
          aria-label="筛选"
          onClick={() => setPane("hooks")}
          className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
        >
          <FilterIcon className="size-5" />
        </button>
      </header>

      {pane === "hub" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">
            <section className="relative h-[132px] overflow-hidden rounded-[20px] shadow-[0_12px_28px_rgba(36,64,96,0.16)]">
              <OutlineBanner className="absolute inset-0 h-full w-full" />
              <div className="relative flex h-full flex-col justify-end px-4 pb-3.5 pt-3">
                <span className="w-fit rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium leading-none text-[#3c4654]">
                  {title}
                </span>
                <h2 className="mt-2 text-[26px] font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  剧情大纲
                </h2>
                <p className="mt-1.5 text-[12px] text-white/90">主线 · 支线 · 分卷 · 章节 · 伏笔</p>
              </div>
            </section>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <StatCard label="分卷" value={volumes.length} icon={<PathStat />} onClick={() => setPane("volumes")} />
              <StatCard label="章节" value={plannedChapters} icon={<BookStat />} onClick={() => setPane("chapters")} />
              <StatCard label="主线" value={mainlines.length} icon={<BranchStat />} onClick={() => setPane("mainlines")} />
              <StatCard label="支线" value={branches.length} icon={<GridStat />} onClick={() => setPane("branches")} />
            </div>

            <div className="mb-2.5 mt-4 flex items-center justify-between px-0.5">
              <h2 className="text-[18px] font-semibold tracking-tight">大纲总览</h2>
              <button type="button" onClick={() => setPane("detail")} className="flex items-center text-[13px] text-[#9aa0ae]">
                查看详情
                <IconChevron className="size-4" />
              </button>
            </div>

            <article className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                <span className="grid size-7 place-items-center rounded-lg bg-[#efe9ff] text-[#6a48d6]">
                  <BookGlyph />
                </span>
                全书进度
              </div>
              <p className="mt-2 text-[13px] text-[#8e929c]">
                {wan(writtenWan)}万 / {wan(targetWan)} 万字 ({progressLabel(progress)}%)
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#ece8f8]">
                <div className="h-full rounded-full bg-[#5b40db]" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            </article>

            <ul className="mt-2.5 flex flex-col gap-2.5">
              {sections.length === 0 ? (
                <li className="rounded-2xl bg-white px-4 py-8 text-center text-[13px] text-[#9aa0ae]">没有符合条件的大纲。</li>
              ) : (
                sections.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setPane(section.id)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)] active:bg-[#fafafc]"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#efe9ff] text-[#6a48d6]">{section.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold leading-none text-[#1c1e28]">{section.title}</span>
                        <span className="mt-1.5 block truncate text-[12px] leading-none text-[#8e929c]">{section.detail}</span>
                      </span>
                      <IconChevron className="size-4 shrink-0 text-[#c5c8d2]" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 bg-[#f6f7fb] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              onClick={optimize}
              className="flex h-12 items-center justify-center gap-1 rounded-2xl border border-[#d9d2f7] bg-white text-[15px] font-medium text-[#5b40db] active:bg-[#f7f5ff]"
            >
              <SparkIcon className="size-4" />
              AI 优化大纲
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-12 items-center justify-center gap-1 rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(91,64,219,0.28)] active:bg-[#4e36c4]"
            >
              <IconPlus className="size-4" />
              新建大纲
            </button>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3">
          {pane === "volumes" ? <VolumeList volumes={volumes} openId={openId} keyword={keyword} onToggle={setOpenId} onAdd={() => void persist("add_volume", {}).then((result) => result && setToast("已增加一卷"))} /> : null}
          {pane === "mainlines" ? <ThreadList items={mainlines} keyword={keyword} empty="还没有主线。可以新建一条。" /> : null}
          {pane === "branches" ? (
            <div className="flex flex-col gap-4">
              <ThreadList items={branches} keyword={keyword} empty="还没有支线。可以新建一条。" />
              {growth.length > 0 ? (
                <section>
                  <h2 className="mb-2 px-1 text-[16px] font-semibold">人物成长</h2>
                  <ThreadList items={growth} keyword={keyword} empty="还没有人物成长线。" />
                </section>
              ) : null}
            </div>
          ) : null}
          {pane === "hooks" ? <HookList hooks={hooks} keyword={keyword} /> : null}
          {pane === "chapters" ? (
            <ChapterList volumes={volumes} chapters={chapters} planned={plannedChapters} written={writtenChapters} />
          ) : null}
          {pane === "detail" ? (
            <DetailList
              volumes={volumes}
              mainlines={mainlines}
              branches={[...branches, ...growth]}
              hooks={hooks}
              planned={plannedChapters}
              written={writtenChapters}
            />
          ) : null}
        </div>
      )}

      {creating ? <CreateSheet onClose={() => setCreating(false)} onSave={addDraft} /> : null}
      {toast ? (
        <p className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#1c1e28] px-4 py-2 text-[13px] text-white">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function linesOf(plot: PlotState, kind: "mainline" | "branch" | "growth", pendingIds: Set<string>): Thread[] {
  return plot.plotlines
    .filter((line) => !line.retired && line.kind === kind)
    .map((line) => ({
      id: line.id,
      title: line.kind === "growth" && line.characterName ? `${line.title} · ${line.characterName}` : line.title,
      summary: line.summary,
      pending: line.itemStatus === "pending" || pendingIds.has(line.id),
    }));
}

function wan(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function progressLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function StatCard({ label, value, icon, onClick }: { label: string; value: number; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center rounded-2xl bg-white px-1 py-3 shadow-[0_8px_20px_rgba(28,28,48,0.04)] active:bg-[#fafafc]"
    >
      {icon}
      <span className="mt-1.5 text-[20px] font-semibold leading-none text-[#1c1e28]">{value}</span>
      <span className="mt-1 text-[11px] leading-none text-[#9aa0ae]">{label}</span>
    </button>
  );
}

function ThreadList({ items, keyword, empty }: { items: Thread[]; keyword: string; empty: string }) {
  const visible = items.filter((item) => !keyword || `${item.title}${item.summary}`.includes(keyword));
  if (visible.length === 0) return <EmptyNote text={items.length === 0 ? empty : "没有符合条件的条目。"} />;
  return (
    <ul className="flex flex-col gap-2.5">
      {visible.map((item) => (
        <li key={item.id} className="rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[16px] font-semibold">{item.title}</p>
            {item.pending ? <PendingPill /> : null}
          </div>
          <p className="mt-1 text-[13px] leading-6 text-[#6f7482]">{item.summary}</p>
        </li>
      ))}
    </ul>
  );
}

function HookList({ hooks, keyword }: { hooks: Hook[]; keyword: string }) {
  const visible = hooks.filter((hook) => !keyword || `${hook.title}${hook.summary}`.includes(keyword));
  if (visible.length === 0) return <EmptyNote text={hooks.length === 0 ? "还没有伏笔。" : "没有符合条件的伏笔。"} />;
  return (
    <ul className="flex flex-col gap-2.5">
      {visible.map((hook) => (
        <li key={hook.id} className="rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[16px] font-semibold">{hook.title}</p>
            {hook.pending ? <PendingPill /> : null}
            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium leading-none ${hook.recovered ? "bg-[#e7f6ee] text-[#3b9a68]" : "bg-[#fff6e8] text-[#d4892a]"}`}>
              {hook.recovered ? "已回收" : "未回收"}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-6 text-[#6f7482]">{hook.summary}</p>
        </li>
      ))}
    </ul>
  );
}

function ChapterList({
  volumes,
  chapters,
  planned,
  written,
}: {
  volumes: VolumePlan[];
  chapters: ChapterPlan[];
  planned: number;
  written: number;
}) {
  let start = 1;
  return (
    <div>
      <p className="mb-3 px-1 text-[13px] text-[#8e929c]">
        已规划 {planned} 章 · 已完成 {written} 章
      </p>
      <ul className="flex flex-col gap-2.5">
        {volumes.map((volume) => {
          const rangeStart = start;
          const end = rangeStart + volume.total - 1;
          const label = `第${rangeStart}–${end}章`;
          start = end + 1;
          return (
            <li key={volume.id} className="rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[15px] font-semibold">{volume.title}</p>
                <span className="shrink-0 text-[12px] text-[#8e929c]">{label}</span>
              </div>
              <p className="mt-1 text-[13px] text-[#8e929c]">
                {volume.status === "done" ? "已完成" : volume.status === "active" ? "进行中" : "未开始"} · {volume.written}/{volume.total} 章
              </p>
              {chapters
                .filter((chapter) => chapter.number >= rangeStart && chapter.number <= end)
                .map((chapter) => (
                  <p key={chapter.id} className="mt-1 text-[13px] leading-6 text-[#6f7482]">
                    第{chapter.number}章 {chapter.title}
                    {chapter.itemStatus === "pending" ? " · 待确认" : ""}
                    {chapter.status === "done" ? " · 已完成" : ""}
                  </p>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DetailList({
  volumes,
  mainlines,
  branches,
  hooks,
  planned,
  written,
}: {
  volumes: VolumePlan[];
  mainlines: Thread[];
  branches: Thread[];
  hooks: Hook[];
  planned: number;
  written: number;
}) {
  const recovered = hooks.filter((hook) => hook.recovered).length;
  return (
    <div className="flex flex-col gap-4">
      <DetailBlock title="分卷" lines={volumes.map((volume) => volume.title)} empty="还没有分卷。" />
      <DetailBlock title="主线" lines={mainlines.map((item) => `${item.title}：${item.summary}`)} empty="还没有主线。" />
      <DetailBlock title="支线" lines={branches.map((item) => item.title)} empty="还没有支线。" />
      <DetailBlock title="伏笔" lines={[`共 ${hooks.length} 个，已回收 ${recovered} 个`]} empty="还没有伏笔。" />
      <DetailBlock title="章节" lines={[`已规划 ${planned} 章，已完成 ${written} 章`]} empty="还没有章节。" />
    </div>
  );
}

function DetailBlock({ title, lines, empty }: { title: string; lines: string[]; empty: string }) {
  return (
    <section>
      <h2 className="px-1 text-[16px] font-semibold">{title}</h2>
      {lines.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-white px-4 py-4 text-[13px] text-[#9aa0ae]">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line} className="rounded-2xl bg-white px-4 py-3 text-[14px] leading-6 text-[#2a2c36]">
              {line}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VolumeList({
  volumes,
  openId,
  keyword,
  onToggle,
  onAdd,
}: {
  volumes: VolumePlan[];
  openId: string;
  keyword: string;
  onToggle: (id: string) => void;
  onAdd: () => void;
}) {
  const visible = volumes.filter((volume) => !keyword || `${volume.title}${volume.mainline ?? ""}`.includes(keyword));
  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-0.5">
        <h2 className="text-[16px] font-semibold">分卷结构 ({volumes.length} 卷)</h2>
        <button type="button" onClick={onAdd} className="flex items-center gap-0.5 text-[14px] font-medium text-[#5b40db]">
          <IconPlus className="size-3.5" />
          新增分卷
        </button>
      </div>
      {visible.length === 0 ? (
        <EmptyNote text="没有符合条件的分卷。" />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((volume) => (
            <VolumeCard
              key={volume.id}
              volume={volume}
              open={openId === volume.id}
              onToggle={() => onToggle(openId === volume.id ? "" : volume.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function VolumeCard({ volume, open, onToggle }: { volume: VolumePlan; open: boolean; onToggle: () => void }) {
  const expandable = Boolean(volume.mainline || volume.beats?.length);
  const Header = expandable ? "button" : "div";
  return (
    <li className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
      <Header
        {...(expandable ? { type: "button" as const, onClick: onToggle, "aria-expanded": open } : {})}
        className="flex w-full items-center gap-2 px-3.5 py-3.5 text-left"
      >
        <IconChevronDown className={`size-4 shrink-0 text-[#5b40db] transition-transform ${expandable && !open ? "-rotate-90" : ""}`} />
        <span className={`min-w-0 flex-1 truncate text-[15px] ${volume.status === "active" ? "font-semibold" : "font-medium"}`}>
          {volume.title}
        </span>
        <VolumeMeta volume={volume} />
      </Header>
      {open && expandable ? (
        <div className="px-4 pb-3.5">
          {volume.mainline ? (
            <p className="text-[13px] leading-6 text-[#6a6e7c]">
              <span className="font-semibold text-[#2a2c36]">主线：</span>
              {volume.mainline}
            </p>
          ) : null}
          {volume.beats?.length ? (
            <ul className="mt-2 space-y-1.5">
              {volume.beats.map((beat) => (
                <li key={beat} className="text-[13px] leading-6 text-[#6a6e7c]">
                  {beat}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function VolumeMeta({ volume }: { volume: VolumePlan }) {
  if (volume.status === "done") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[13px] text-[#4a4e5c]">
        <IconCheck className="size-3.5 text-[#34b56a]" />
        {volume.total} 章
      </span>
    );
  }
  if (volume.status === "active") {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-[#e3f6ea] px-2 py-1 text-[12px] font-medium leading-none text-[#2ea86a]">进行中</span>
        <span className="text-[13px] text-[#8b909c]">{volume.total} 章</span>
      </span>
    );
  }
  return <span className="shrink-0 text-[13px] text-[#c0c4ce]">{volume.written} / {volume.total} 章</span>;
}

function CreateSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (kind: DraftKind, title: string, summary: string) => void;
}) {
  const [kind, setKind] = useState<DraftKind>("mainline");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="关闭新建" className="flex-1" onClick={onClose} />
      <form
        className="rounded-t-3xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSave(kind, name.trim(), summary.trim() || "尚未填写说明。");
        }}
      >
        <h2 className="text-[17px] font-semibold">新建大纲</h2>
        <label className="mt-3 block text-[12px] text-[#8e929c]">
          类型
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as DraftKind)}
            className="mt-1 h-10 w-full rounded-xl bg-[#f6f7fb] px-3 text-[15px] text-[#1c1e28] outline-none"
          >
            <option value="mainline">主线</option>
            <option value="branch">支线</option>
            <option value="hook">伏笔</option>
          </select>
        </label>
        <label className="mt-3 block text-[12px] text-[#8e929c]">
          标题
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full rounded-xl bg-[#f6f7fb] px-3 text-[15px] text-[#1c1e28] outline-none" />
        </label>
        <label className="mt-3 block text-[12px] text-[#8e929c]">
          说明
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="mt-1 w-full resize-none rounded-xl bg-[#f6f7fb] px-3 py-2 text-[15px] text-[#1c1e28] outline-none" />
        </label>
        <button type="submit" className="mt-4 h-11 w-full rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white">
          保存
        </button>
      </form>
    </div>
  );
}

function PendingPill() {
  return <span className="shrink-0 rounded-full bg-[#fff6e8] px-2 py-1 text-[11px] font-medium leading-none text-[#d4892a]">待确认</span>;
}

function EmptyNote({ text }: { text: string }) {
  return <p className="rounded-2xl bg-white px-4 py-8 text-center text-[13px] text-[#9aa0ae]">{text}</p>;
}

function PathStat() {
  return <StatIcon><path d="M7 16c2-6 3-6 5-6s3 2 5 2 3-2 4-5" /></StatIcon>;
}
function BookStat() {
  return <StatIcon><path d="M7 6.5h6.5A2.5 2.5 0 0 1 16 9v8.5H9.2A2.2 2.2 0 0 0 7 19.7Z" /><path d="M7 6.5A2.2 2.2 0 0 1 9.2 8.7H16" /></StatIcon>;
}
function BranchStat() {
  return <StatIcon><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /><circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" /><path d="M8 9.4 12 14.6M16 9.4 12 14.6" /></StatIcon>;
}
function GridStat() {
  return <StatIcon><path d="M8 8h2.2v2.2H8zM13.8 8H16v2.2h-2.2zM8 13.8h2.2V16H8zM13.8 13.8H16V16h-2.2z" /></StatIcon>;
}
function StatIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-[#efe9ff] text-[#6a48d6]">
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}
function BookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6.5h7A3 3 0 0 1 16 9.5V19H8.2A2.2 2.2 0 0 0 6 21.2Z" />
    </svg>
  );
}
function FlagGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M7 19V5.5M7 6h9l-1.6 3.2L16 12.5H7" />
    </svg>
  );
}
function PenGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M14 6.5 17.5 10 9 18.5 5.5 19 6 15.5Z" />
    </svg>
  );
}
function LoopGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 9a4 4 0 0 1 7.2-2.2M16 15a4 4 0 0 1-7.2 2.2" />
      <path d="M16 5.5V8h-2.5M8 18.5V16h2.5" />
    </svg>
  );
}
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2.5 13.4 8.2 19 9.6 13.4 11 12 16.8 10.6 11 5 9.6 10.6 8.2Z" />
      <path d="M18 13.2 18.7 16 21.4 16.7 18.7 17.4 18 20.2 17.3 17.4 14.6 16.7 17.3 16Z" />
    </svg>
  );
}

function OutlineBanner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 390 150" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="ol-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6e9fd4" />
          <stop offset="55%" stopColor="#9ec6e4" />
          <stop offset="100%" stopColor="#d9c6ae" />
        </linearGradient>
        <linearGradient id="ol-scrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#163044" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#163044" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#163044" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="390" height="150" fill="url(#ol-sky)" />
      <path d="M0 78 52 42 98 70 150 36 198 72 250 46 304 74 360 48 390 68v82H0Z" fill="#a9c3d4" />
      <path d="M0 98 48 62 104 98 158 58 210 102 268 70 328 104 390 78v72H0Z" fill="#4d7f90" />
      <path d="M230 90 286 46 324 86 360 58 390 90v60H230Z" fill="#2c6570" />
      <path d="M300 70c8 18 10 36 8 58" fill="none" stroke="#f4fbff" strokeWidth="3" strokeLinecap="round" />
      <path d="M308 76c6 16 7 32 5 50" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      <g transform="translate(250 58)">
        <path d="M16 6 34 22H0Z" fill="#6a5344" />
        <path d="M6 22h22v16H6Z" fill="#8a6a52" />
        <path d="M14 28h6v10h-6Z" fill="#5c4638" />
      </g>
      <rect width="390" height="150" fill="url(#ol-scrim)" />
    </svg>
  );
}
