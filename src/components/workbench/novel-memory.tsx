"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { roleLabels, type Character, type CharacterArchive, type CharacterRole } from "@/lib/characters/model";
import type { MemoryRecord } from "@/lib/memory/model";
import { emptyPlot, fanchenPlot, type PlotState } from "@/lib/plot/model";
import { IconBack, IconCheck, IconChevron, IconMemory, IconSearch, IconShield } from "./icons";

type Pane =
  | "hub"
  | "chapters"
  | "events"
  | "event"
  | "people"
  | "person"
  | "lines"
  | "relations"
  | "rules"
  | "timeline"
  | "clues"
  | "search"
  | "health";

type ChapterMemory = {
  number: number;
  title: string;
  summary: string;
  volumeId: string;
  volume: string;
  tags: string[];
};

type EventMemory = {
  id: string;
  title: string;
  chapter: number;
  place: string;
  people: string;
  summary: string;
  impacts: string[];
  quote: string;
  confirmed: boolean;
};

type Track = { chapter: number; title: string; note: string; tag: string };
type PersonMemory = {
  name: string;
  role: string;
  realm: string;
  place: string;
  firstChapter: number;
  summary: string;
  tracks: Track[];
  states: string[];
  knowledge: string[];
  relations: { name: string; summary: string }[];
  tone: number;
};

type ClueMemory = {
  title: string;
  summary: string;
  status: "open" | "done" | "later";
  tags: string[];
  chapter: number | null;
};

type LineMemory = { title: string; summary: string; kind: string };
type VolumeMemory = { id: string; range: string; title: string; summary: string; status: "done" | "active" | "pending" };
type RuleMemory = { name: string; summary: string };
type HealthItem = { title: string; detail: string; level: "ok" | "warn" };

type MemoryModel = {
  chapters: ChapterMemory[];
  events: EventMemory[];
  people: PersonMemory[];
  clues: ClueMemory[];
  lines: LineMemory[];
  relations: { from: string; name: string; summary: string }[];
  rules: RuleMemory[];
  volumes: VolumeMemory[];
  pending: number;
};

const tones = [
  "from-[#1e3348] to-[#4d6d8c]",
  "from-[#243044] to-[#5c5348]",
  "from-[#1c3a36] to-[#3f6d5c]",
  "from-[#3a2e22] to-[#6d5a42]",
  "from-[#2a2744] to-[#56528a]",
  "from-[#1d3040] to-[#3e6278]",
];

const tagTone: Record<string, string> = {
  修为提升: "bg-[#e7f6ee] text-[#2f9a62]",
  成长: "bg-[#e7f6ee] text-[#2f9a62]",
  转折: "bg-[#fff1e4] text-[#d9782d]",
  起点: "bg-[#ece7fb] text-[#6a48d6]",
  关键事件: "bg-[#ece7fb] text-[#6a48d6]",
  章节摘要: "bg-[#eef3f8] text-[#5d7186]",
  剧情线索: "bg-[#eef3f8] text-[#5d7186]",
  人物记忆: "bg-[#f3eefe] text-[#7a56d6]",
  事实规则: "bg-[#eef6f1] text-[#3d8b62]",
};

export function NovelMemory({
  novelId,
  title,
  onBack,
}: {
  novelId: string;
  title: string;
  onBack: () => void;
}) {
  const [plot, setPlot] = useState<PlotState>(() => (novelId === "fanchen-wendao" ? fanchenPlot() : emptyPlot()));
  const [people, setPeople] = useState<Character[]>([]);
  const [ledger, setLedger] = useState<MemoryRecord[]>([]);
  const [ledgerPending, setLedgerPending] = useState(0);
  const [ready, setReady] = useState(false);
  const [pane, setPane] = useState<Pane>("hub");
  const [stack, setStack] = useState<Pane[]>([]);
  const [volumeId, setVolumeId] = useState("all");
  const [clueFilter, setClueFilter] = useState<"all" | "open" | "done">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "main" | "node">("all");
  const [personTab, setPersonTab] = useState<"track" | "state" | "know" | "rel">("track");
  const [eventId, setEventId] = useState("");
  const [personName, setPersonName] = useState("");
  const [query, setQuery] = useState("");
  const [searchTab, setSearchTab] = useState("全部");
  const [shown, setShown] = useState(24);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const [plotResponse, castResponse, memoryResponse] = await Promise.all([
          fetch(`/api/plot?novelId=${encodeURIComponent(novelId)}`, { cache: "no-store" }),
          fetch(`/api/characters?novelId=${encodeURIComponent(novelId)}`, { cache: "no-store" }),
          fetch(`/api/memory?novelId=${encodeURIComponent(novelId)}`, { cache: "no-store" }),
        ]);
        if (stopped) return;
        if (plotResponse.ok) {
          const body = (await plotResponse.json()) as { plot?: PlotState };
          if (body.plot) setPlot(body.plot);
        }
        if (castResponse.ok) {
          const body = (await castResponse.json()) as { archive?: CharacterArchive };
          if (body.archive) setPeople(body.archive.characters);
        }
        if (memoryResponse.ok) {
          const body = (await memoryResponse.json()) as { memory?: { items?: MemoryRecord[]; changes?: unknown[] } };
          if (body.memory?.items) setLedger(body.memory.items);
          if (body.memory?.changes) setLedgerPending(body.memory.changes.length);
        }
      } catch {
        // Keep the memory already on screen.
      } finally {
        if (!stopped) setReady(true);
      }
    }
    void load();
    return () => {
      stopped = true;
    };
  }, [novelId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const memory = useMemo(
    () => buildMemory(novelId, plot, people, ledger, ledgerPending),
    [novelId, plot, people, ledger, ledgerPending],
  );
  const event = memory.events.find((item) => item.id === eventId) ?? memory.events[0];
  const person = memory.people.find((item) => item.name === personName) ?? memory.people[0];

  function open(next: Pane) {
    setStack((current) => [...current, pane]);
    setPane(next);
  }

  function back() {
    setStack((current) => {
      const copy = [...current];
      const previous = copy.pop();
      if (!previous) onBack();
      else setPane(previous);
      return copy;
    });
  }

  const heading =
    pane === "hub"
      ? "小说记忆"
      : pane === "chapters"
        ? "章节记忆"
        : pane === "events"
          ? "关键事件"
          : pane === "event"
            ? "事件详情"
            : pane === "people"
              ? "人物经历"
              : pane === "person"
                ? `人物记忆 · ${person?.name ?? ""}`
                : pane === "lines"
                  ? "剧情线索"
                  : pane === "relations"
                    ? "关系变化"
                    : pane === "rules"
                      ? "事实规则"
                      : pane === "timeline"
                        ? "剧情时间线"
                        : pane === "clues"
                          ? "线索与伏笔"
                          : pane === "search"
                            ? "智能检索"
                            : "记忆健康检查";

  const chapterList = memory.chapters
    .filter((chapter) => volumeId === "all" || chapter.volumeId === volumeId)
    .slice()
    .reverse();
  const visibleChapters = chapterList.slice(0, shown);
  const clueList = memory.clues.filter((clue) =>
    clueFilter === "all" ? true : clueFilter === "done" ? clue.status === "done" : clue.status !== "done",
  );
  const volumeList = memory.volumes.filter((volume) =>
    timeFilter === "all" ? true : timeFilter === "main" ? volume.status !== "pending" : volume.status === "active",
  );

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col bg-[#f6f7fb]">
      <header className="workbench-header flex shrink-0 items-center gap-1 px-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="返回"
          onClick={back}
          className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
        >
          <IconBack className="size-[22px]" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-tight">{heading}</h1>
        <button
          type="button"
          aria-label="搜索"
          onClick={() => open("search")}
          className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
        >
          <IconSearch className="size-[22px]" />
        </button>
        {pane === "clues" ? (
          <button
            type="button"
            onClick={() => setToast("新线索会先记成待核对，确认后才写入伏笔")}
            className="px-1 text-[14px] font-medium text-[#5b40db]"
          >
            ＋新增
          </button>
        ) : (
          <button
            type="button"
            aria-label="更多"
            onClick={() => open("health")}
            className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
          >
            <span className="text-[18px] leading-none tracking-widest">···</span>
          </button>
        )}
      </header>

      <div className="workbench-gutter min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {!ready ? <p className="px-1 py-8 text-center text-[13px] text-[#8e929c]">正在整理这本小说的记忆…</p> : null}
        {ready && pane === "hub" ? (
          <Hub
            title={title}
            memory={memory}
            onOpen={open}
            onChapter={() => {
              setVolumeId("all");
              setShown(24);
              open("chapters");
            }}
          />
        ) : null}
        {ready && pane === "chapters" ? (
          <div>
            <ChipRow>
              <Chip active={volumeId === "all"} onClick={() => setVolumeId("all")}>
                全部 ({memory.chapters.length})
              </Chip>
              {memory.volumes.map((volume, index) => (
                <Chip key={volume.id} active={volumeId === volume.id} onClick={() => setVolumeId(volume.id)}>
                  第{index + 1}卷 ({volumeCount(memory, volume.id)})
                </Chip>
              ))}
            </ChipRow>
            <ul className="mt-3 space-y-3">
              {visibleChapters.map((chapter, index) => (
                <li key={chapter.number}>
                  <button
                    type="button"
                    onClick={() => {
                      const match = memory.events.find((item) => item.chapter === chapter.number);
                      setEventId(match?.id ?? memory.events[0]?.id ?? "");
                      if (memory.events.length) open("event");
                    }}
                    className="flex w-full gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)]"
                  >
                    <Thumb tone={chapter.number % tones.length} label={`第${chapter.number}章`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold">
                          第{chapter.number}章 · {chapter.title}
                        </span>
                        {index === 0 && volumeId === "all" ? <Badge className="bg-[#ece7fb] text-[#6a48d6]">最新</Badge> : null}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-[#6f7482]">{chapter.summary || "这一章还没有摘要。"}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {chapter.tags.map((tag) => (
                          <Badge key={tag} className="bg-[#f3f5f8] text-[#7b8494]">
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {shown < chapterList.length ? (
              <button
                type="button"
                onClick={() => setShown((count) => count + 24)}
                className="mt-3 w-full rounded-2xl bg-white py-3 text-[14px] text-[#5b40db]"
              >
                还有 {chapterList.length - shown} 章
              </button>
            ) : null}
            {chapterList.length === 0 ? <Empty text="还没有章节记忆。" /> : null}
          </div>
        ) : null}
        {ready && pane === "events" ? (
          <ul className="space-y-3">
            {memory.events.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEventId(item.id);
                    open("event");
                  }}
                  className="flex w-full gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)]"
                >
                  <Thumb tone={item.chapter % tones.length} label={item.place} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{item.title}</span>
                    <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-[#6f7482]">{item.summary}</span>
                    <span className="mt-2 block text-[12px] text-[#9aa0ae]">第{item.chapter}章 · {item.place}</span>
                  </span>
                </button>
              </li>
            ))}
            {memory.events.length === 0 ? <Empty text="还没有关键事件。" /> : null}
          </ul>
        ) : null}
        {ready && pane === "event" && event ? <EventDetail event={event} onEdit={() => setToast("修改会先留成待核对，确认前不改已经记下的记忆")} /> : null}
        {ready && pane === "people" ? (
          <ul className="space-y-2.5">
            {memory.people.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  onClick={() => {
                    setPersonName(item.name);
                    setPersonTab("track");
                    open("person");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)]"
                >
                  <Avatar name={item.name} tone={item.tone} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{item.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-[#8e929c]">
                      {item.role}
                      {item.realm ? ` · ${item.realm}` : ""}
                      {item.place ? ` · ${item.place}` : ""}
                    </span>
                  </span>
                  <IconChevron className="size-4 text-[#c5c9d4]" />
                </button>
              </li>
            ))}
            {memory.people.length === 0 ? <Empty text="还没有人物记忆。" /> : null}
          </ul>
        ) : null}
        {ready && pane === "person" && person ? (
          <PersonDetail
            person={person}
            tab={personTab}
            onTab={setPersonTab}
            onMore={() => setToast(`${person.name}的经历都在这一页里`)}
          />
        ) : null}
        {ready && pane === "lines" ? <TextList items={memory.lines.map((line) => ({ title: line.title, summary: `${line.kind} · ${line.summary}` }))} empty="还没有剧情线索。" /> : null}
        {ready && pane === "relations" ? (
          <TextList
            items={memory.relations.map((item) => ({ title: `${item.from} → ${item.name}`, summary: item.summary }))}
            empty="还没有关系变化。"
          />
        ) : null}
        {ready && pane === "rules" ? (
          <TextList items={memory.rules.map((rule) => ({ title: rule.name, summary: rule.summary }))} empty="还没有事实规则。" />
        ) : null}
        {ready && pane === "timeline" ? (
          <div>
            <ChipRow>
              <Chip active={timeFilter === "all"} onClick={() => setTimeFilter("all")}>整体时间线</Chip>
              <Chip active={timeFilter === "main"} onClick={() => setTimeFilter("main")}>主线事件</Chip>
              <Chip active={timeFilter === "node"} onClick={() => setTimeFilter("node")}>重要节点</Chip>
            </ChipRow>
            <ol className="relative mt-4 space-y-3 border-l border-[#e4e6ee] pl-4">
              {volumeList.map((volume) => (
                <li key={volume.id} className="relative">
                  <span className={`absolute -left-[21px] top-4 size-2.5 rounded-full ring-4 ring-[#f6f7fb] ${volume.status === "active" ? "bg-[#5b40db]" : volume.status === "done" ? "bg-[#3aaa72]" : "bg-[#c5c9d4]"}`} />
                  <article className="flex gap-3 rounded-2xl bg-white p-3 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
                    <Thumb tone={volume.title.length % tones.length} label={volume.range} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] text-[#9aa0ae]">{volume.range}</p>
                        <Badge className={volume.status === "active" ? "bg-[#ece7fb] text-[#6a48d6]" : volume.status === "done" ? "bg-[#e7f6ee] text-[#2f9a62]" : "bg-[#f3f4f7] text-[#8b909c]"}>
                          {volume.status === "active" ? "进行中" : volume.status === "done" ? "已写完" : "计划中"}
                        </Badge>
                      </div>
                      <h2 className="mt-0.5 text-[16px] font-semibold">{volume.title}</h2>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#6f7482]">{volume.summary || "这一卷还没有阶段说明。"}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {ready && pane === "clues" ? (
          <div>
            <ChipRow>
              <Chip active={clueFilter === "all"} onClick={() => setClueFilter("all")}>全部 ({memory.clues.length})</Chip>
              <Chip active={clueFilter === "open"} onClick={() => setClueFilter("open")}>
                未回收 ({memory.clues.filter((clue) => clue.status !== "done").length})
              </Chip>
              <Chip active={clueFilter === "done"} onClick={() => setClueFilter("done")}>
                已回收 ({memory.clues.filter((clue) => clue.status === "done").length})
              </Chip>
            </ChipRow>
            <ul className="mt-3 space-y-3">
              {clueList.map((clue) => (
                <li key={clue.title} className="flex gap-3 rounded-2xl bg-white p-3 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#efeaff] text-[#6a48d6]">
                    <IconMemory className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-[15px] font-semibold">{clue.title}</h2>
                      <Badge className={clue.status === "done" ? "bg-[#e7f6ee] text-[#2f9a62]" : clue.status === "open" ? "bg-[#fff1e4] text-[#d9782d]" : "bg-[#f3f4f7] text-[#8b909c]"}>
                        {clue.status === "done" ? "已回收" : clue.status === "open" ? "进行中" : "未开始"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#6f7482]">{clue.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {clue.tags.map((tag) => (
                        <Badge key={tag} className="bg-[#f3f5f8] text-[#7b8494]">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {clueList.length === 0 ? <Empty text="这一组里还没有线索。" /> : null}
          </div>
        ) : null}
        {ready && pane === "search" ? (
          <SearchPane
            memory={memory}
            query={query}
            tab={searchTab}
            onQuery={setQuery}
            onTab={setSearchTab}
            onEvent={(id) => {
              setEventId(id);
              open("event");
            }}
            onPerson={(name) => {
              setPersonName(name);
              setPersonTab("track");
              open("person");
            }}
          />
        ) : null}
        {ready && pane === "health" ? <Health memory={memory} onRepair={() => setToast("建议已标出。改大纲或人物前，仍要单独确认")} /> : null}
      </div>
      {toast ? (
        <p className="pointer-events-none absolute inset-x-8 bottom-8 rounded-2xl bg-[#1c1e28]/90 px-4 py-3 text-center text-[13px] text-white">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function Hub({
  title,
  memory,
  onOpen,
  onChapter,
}: {
  title: string;
  memory: MemoryModel;
  onOpen: (pane: Pane) => void;
  onChapter: () => void;
}) {
  const latest = [...memory.chapters].sort((a, b) => b.number - a.number)[0];
  const items = memory.chapters.length + memory.events.length + memory.clues.length + memory.people.length + memory.lines.length;
  const tiles: { label: string; count: string; pane: Pane; onClick?: () => void }[] = [
    { label: "章节记忆", count: `${memory.chapters.length} 章摘要`, pane: "chapters", onClick: onChapter },
    { label: "关键事件", count: `${memory.events.length} 个事件`, pane: "events" },
    { label: "人物经历", count: `${memory.people.length} 位角色`, pane: "people" },
    { label: "剧情线索", count: `${memory.lines.length} 条线索`, pane: "lines" },
    { label: "关系变化", count: `${memory.relations.length} 条记录`, pane: "relations" },
    { label: "事实规则", count: `${memory.rules.length} 条规则`, pane: "rules" },
  ];
  return (
    <>
      <section className="relative overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_80%_20%,#8ec7ff_0%,transparent_32%),linear-gradient(160deg,#16324d_0%,#24506a_48%,#1a3344_100%)] px-4 py-4 text-white shadow-[0_12px_28px_rgba(22,40,64,0.18)] lg:px-6 lg:py-6">
        <span className="rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium text-[#314255]">{title}</span>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[28px] font-bold leading-none">小说记忆</h2>
            <p className="mt-2 max-w-[16em] text-[12px] leading-relaxed text-white/80 lg:max-w-none">已记录创作过程中的事件、人物经历、线索与关键信息</p>
          </div>
          <span className="grid size-14 place-items-center rounded-full bg-white/15">
            <IconMemory className="size-7" />
          </span>
        </div>
      </section>
      <div className="mt-3 grid grid-cols-4 gap-2 lg:mt-4 lg:gap-4">
        <Stat value={memory.chapters.length} label="已记录章节" />
        <Stat value={items} label="记忆条目" />
        <Stat value={memory.events.length} label="关键事件" />
        <Stat value={memory.pending} label="待核对" />
      </div>
      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <section>
          <h2 className="mb-2.5 mt-5 text-[16px] font-semibold lg:mt-0">记忆分类</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {tiles.map((tile) => (
              <button
                key={tile.label}
                type="button"
                onClick={() => (tile.onClick ? tile.onClick() : onOpen(tile.pane))}
                className="rounded-2xl bg-white px-2 py-3.5 text-center shadow-[0_8px_24px_rgba(28,28,48,0.04)]"
              >
                <span className="mx-auto grid size-9 place-items-center rounded-xl bg-[#f3efff] text-[#6a48d6]">
                  <IconMemory className="size-4" />
                </span>
                <span className="mt-2 block text-[13px] font-medium">{tile.label}</span>
                <span className="mt-1 block text-[11px] text-[#a0a4b0]">{tile.count}</span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <button
            type="button"
            onClick={() => onOpen("timeline")}
            className="mt-3 flex w-full items-center justify-between rounded-2xl lg:mt-0 bg-white px-4 py-3.5 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)]"
          >
            <span>
              <span className="block text-[15px] font-semibold">剧情时间线</span>
              <span className="mt-0.5 block text-[12px] text-[#8e929c]">{memory.volumes.length} 卷阶段</span>
            </span>
            <IconChevron className="size-4 text-[#c5c9d4]" />
          </button>
          <div className="mb-2.5 mt-5 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">最近记忆</h2>
            <button type="button" onClick={onChapter} className="text-[13px] text-[#9aa0ae]">
              查看全部
            </button>
          </div>
          {latest ? (
            <button
              type="button"
              onClick={onChapter}
              className="flex w-full gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)]"
            >
              <Thumb tone={latest.number % tones.length} label={`第${latest.number}章`} />
              <span>
                <span className="block text-[15px] font-semibold">{latest.title}</span>
                <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-[#6f7482]">{latest.summary}</span>
                <span className="mt-1 block text-[12px] text-[#9aa0ae]">第{latest.number}章 · {latest.volume}</span>
              </span>
            </button>
          ) : (
            <Empty text="写下章节大纲后，这里会出现最近一条记忆。" />
          )}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => onOpen("health")} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white text-[14px] font-medium shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
              <IconShield className="size-4 text-[#5b40db]" />
              记忆健康检查
            </button>
            <button type="button" onClick={() => onOpen("search")} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-[#5b40db] text-[14px] font-medium text-white">
              <IconSearch className="size-4" />
              智能检索
            </button>
          </div>
          <button type="button" onClick={() => onOpen("clues")} className="mt-2.5 w-full py-2 text-center text-[13px] text-[#8e929c]">
            线索与伏笔 · {memory.clues.length} 条
          </button>
        </section>
      </div>
    </>
  );
}

function EventDetail({ event, onEdit }: { event: EventMemory; onEdit: () => void }) {
  return (
    <div>
      <section className="overflow-hidden rounded-[22px] bg-[linear-gradient(160deg,#1a2740,#3d5c86_55%,#d7b56a)] px-4 py-5 text-white">
        <p className="text-[12px] text-white/75">第{event.chapter}章</p>
        <h2 className="mt-1 text-[24px] font-bold leading-tight">{event.title}</h2>
        <div className="mt-3 flex gap-2">
          <Badge className="bg-white/20 text-white">关键事件</Badge>
          <Badge className="bg-[#e7f6ee] text-[#2f9a62]">{event.confirmed ? "已确认" : "待核对"}</Badge>
        </div>
      </section>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Meta label="发生章节" value={`第${event.chapter}章`} />
        <Meta label="发生地点" value={event.place || "未注明"} />
        <Meta label="涉及人物" value={event.people || "未注明"} />
      </div>
      <Card title="事件概述">
        <p className="text-[14px] leading-relaxed text-[#3c4250]">{event.summary}</p>
      </Card>
      <Card title="事件影响">
        <ul className="space-y-2">
          {event.impacts.map((impact) => (
            <li key={impact} className="flex gap-2 text-[14px] leading-relaxed text-[#3c4250]">
              <IconCheck className="mt-0.5 size-4 shrink-0 text-[#3aaa72]" />
              {impact}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="原文依据">
        <p className="text-[14px] leading-relaxed text-[#3c4250]">“{event.quote}”</p>
        <p className="mt-2 text-[12px] text-[#9aa0ae]">第{event.chapter}章</p>
      </Card>
      <button type="button" onClick={onEdit} className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white">
        编辑记忆
      </button>
    </div>
  );
}

function PersonDetail({
  person,
  tab,
  onTab,
  onMore,
}: {
  person: PersonMemory;
  tab: "track" | "state" | "know" | "rel";
  onTab: (tab: "track" | "state" | "know" | "rel") => void;
  onMore: () => void;
}) {
  const tabs = [
    ["track", "经历轨迹"],
    ["state", "状态变化"],
    ["know", "认知信息"],
    ["rel", "关联事件"],
  ] as const;
  return (
    <div>
      <section className="flex gap-3 rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
        <Avatar name={person.name} tone={person.tone} large />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-semibold">{person.name}</h2>
            <Badge className="bg-[#ece7fb] text-[#6a48d6]">{person.role}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-[#6f7482]">
            {person.realm || "身份见档案"}
            {person.place ? ` · ${person.place}` : ""}
          </p>
          <p className="mt-1 text-[12px] text-[#9aa0ae]">首次登场：第{person.firstChapter || 1}章</p>
        </div>
      </section>
      <div className="mt-3 grid grid-cols-4 rounded-2xl bg-white p-1 text-[12px] shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`rounded-xl py-2 ${tab === id ? "bg-[#f3efff] font-medium text-[#5b40db]" : "text-[#8e929c]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "track" ? (
        <section className="mt-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
          <h3 className="text-[14px] font-semibold">关键经历（{person.tracks.length} 条）</h3>
          <ol className="mt-3 space-y-4 border-l border-[#ece7fb] pl-4">
            {person.tracks.map((track) => (
              <li key={`${track.chapter}-${track.title}`} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-[#5b40db]" />
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium">第{track.chapter}章 · {track.title}</p>
                  <Badge className={tagTone[track.tag] ?? "bg-[#f3f5f8] text-[#7b8494]"}>{track.tag}</Badge>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6f7482]">{track.note}</p>
              </li>
            ))}
            {person.tracks.length === 0 ? <p className="text-[13px] text-[#8e929c]">还没有写到这个人的经历。</p> : null}
          </ol>
        </section>
      ) : null}
      {tab === "state" ? <PlainList items={person.states} empty="还没有状态变化。" /> : null}
      {tab === "know" ? <PlainList items={person.knowledge} empty="还没有认知信息。" /> : null}
      {tab === "rel" ? (
        <TextList items={person.relations.map((relation) => ({ title: relation.name, summary: relation.summary }))} empty="还没有关联人物。" />
      ) : null}
      <button type="button" onClick={onMore} className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white">
        查看完整经历
      </button>
    </div>
  );
}

function SearchPane({
  memory,
  query,
  tab,
  onQuery,
  onTab,
  onEvent,
  onPerson,
}: {
  memory: MemoryModel;
  query: string;
  tab: string;
  onQuery: (value: string) => void;
  onTab: (value: string) => void;
  onEvent: (id: string) => void;
  onPerson: (name: string) => void;
}) {
  const keyword = query.trim();
  const hits = searchHits(memory, keyword, tab);
  return (
    <div>
      <label className="flex h-11 items-center gap-2 rounded-full bg-white px-3 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
        <IconSearch className="size-4 text-[#9aa0ae]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索事件、章节、人物、线索"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>
      <ChipRow>
        {["全部", "事件", "章节", "人物", "线索", "规则"].map((item) => (
          <Chip key={item} active={tab === item} onClick={() => onTab(item)}>
            {item}
          </Chip>
        ))}
      </ChipRow>
      <p className="mb-2 mt-4 text-[13px] text-[#8e929c]">检索结果（{hits.length}）</p>
      <ul className="space-y-2.5">
        {hits.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => {
                if (hit.eventId) onEvent(hit.eventId);
                if (hit.person) onPerson(hit.person);
              }}
              className="w-full rounded-2xl bg-white p-3.5 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)]"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">{hit.title}</span>
                <Badge className={tagTone[hit.kind] ?? "bg-[#f3f5f8] text-[#7b8494]"}>{hit.kind}</Badge>
              </span>
              <span className="mt-1 block text-[13px] leading-relaxed text-[#6f7482]">{hit.summary}</span>
            </button>
          </li>
        ))}
      </ul>
      {hits.length === 0 ? <Empty text="没有符合的记忆。" /> : null}
    </div>
  );
}

function Health({ memory, onRepair }: { memory: MemoryModel; onRepair: () => void }) {
  const items = healthOf(memory);
  const warnings = items.filter((item) => item.level === "warn").length;
  return (
    <div className="pb-2">
      <section className="rounded-[22px] bg-white px-4 py-6 text-center shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#f3efff] text-[#5b40db]">
          <IconShield className="size-8" />
        </span>
        <h2 className="mt-3 text-[18px] font-semibold">{warnings === 0 ? "整体状态良好" : "有几处要核对"}</h2>
        <p className="mt-1 text-[13px] text-[#8e929c]">已看过 {memory.chapters.length} 章的章节记忆</p>
      </section>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat value={0} label="严重冲突" />
        <Stat value={warnings} label="一般问题" />
        <Stat value={memory.pending} label="优化建议" />
      </div>
      <h2 className="mb-2.5 mt-5 text-[16px] font-semibold">检查项</h2>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.title} className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-medium">{item.title}</p>
              <Badge className={item.level === "ok" ? "bg-[#e7f6ee] text-[#2f9a62]" : "bg-[#fff1e4] text-[#d9782d]"}>
                {item.level === "ok" ? "已通过" : "待核对"}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-[#6f7482]">{item.detail}</p>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onRepair} className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white">
        一键修复建议
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
      <h3 className="mb-2 text-[15px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-2 py-3 text-center shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
      <p className="text-[11px] text-[#9aa0ae]">{label}</p>
      <p className="mt-1 truncate text-[13px] font-medium">{value}</p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white px-1 py-3 text-center shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
      <p className="text-[18px] font-semibold leading-none text-[#1c1e28]">{value}</p>
      <p className="mt-1.5 text-[11px] text-[#a0a4b0]">{label}</p>
    </div>
  );
}

function Thumb({ tone, label }: { tone: number; label: string }) {
  return (
    <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-center text-[10px] font-medium leading-tight text-white ${tones[tone % tones.length]}`}>
      {label}
    </span>
  );
}

function Avatar({ name, tone, large }: { name: string; tone: number; large?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white ${tones[tone % tones.length]} ${large ? "size-16 text-[20px]" : "size-12 text-[16px]"}`}>
      {name.slice(0, 1)}
    </span>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 overflow-x-auto pb-1 pt-1">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] ${active ? "bg-[#5b40db] text-white" : "bg-white text-[#5c6372]"}`}
    >
      {children}
    </button>
  );
}

function TextList({ items, empty }: { items: { title: string; summary: string }[]; empty: string }) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={`${item.title}-${item.summary}`} className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
          <p className="text-[15px] font-medium">{item.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6f7482]">{item.summary}</p>
        </li>
      ))}
    </ul>
  );
}

function PlainList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="rounded-2xl bg-white px-4 py-3.5 text-[14px] leading-relaxed shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-2 py-8 text-center text-[13px] text-[#8e929c]">{text}</p>;
}

function volumeCount(memory: MemoryModel, id: string) {
  return memory.chapters.filter((chapter) => chapter.volumeId === id).length;
}

function buildMemory(novelId: string, plot: PlotState, cast: Character[], ledger: MemoryRecord[] = [], ledgerPending = 0): MemoryModel {
  if (novelId === "fanchen-wendao") return withLedger(fanchenMemory(), ledger, ledgerPending);
  const volumes = plot.volumes.filter((volume) => !volume.retired);
  let cursor = 1;
  const ranges = volumes.map((volume) => {
    const start = cursor;
    const end = cursor + Math.max(volume.total, 1) - 1;
    cursor = end + 1;
    return { ...volume, start, end };
  });
  const volumeOf = (number: number) => ranges.find((volume) => number >= volume.start && number <= volume.end) ?? ranges[0];
  const chapters = plot.chapters
    .filter((chapter) => !chapter.retired)
    .map((chapter) => {
      const volume = volumeOf(chapter.number);
      return {
        number: chapter.number,
        title: chapter.title,
        summary: chapter.summary,
        volumeId: volume?.id ?? "",
        volume: volume?.title ?? "",
        tags: [volume?.title.replace(/第.+?卷\s*·\s*/, "") || "章节", chapter.status === "done" ? "已写" : "大纲"].filter(Boolean),
      };
    });
  const names = cast.map((person) => person.name);
  const mentioned = (text: string) => names.filter((name) => text.includes(name)).slice(0, 3).join("、");
  const marked = new Set<number>();
  for (const hook of plot.foreshadowing) {
    if (hook.plantedChapter) marked.add(hook.plantedChapter);
    if (hook.plannedChapter) marked.add(hook.plannedChapter);
  }
  for (const range of ranges) marked.add(range.start);
  const events = (plot.events.filter((event) => !event.retired).length
    ? plot.events.filter((event) => !event.retired).map((event) => ({
        id: event.id,
        title: event.title,
        chapter: event.chapter ?? 1,
        place: event.time || volumeOf(event.chapter ?? 1)?.title || "",
        people: mentioned(event.summary),
        summary: event.summary,
        impacts: [event.summary],
        quote: event.summary,
        confirmed: event.itemStatus === "confirmed",
      }))
    : chapters
        .filter((chapter) => marked.has(chapter.number))
        .map((chapter) => ({
          id: `ch-${chapter.number}`,
          title: chapter.title,
          chapter: chapter.number,
          place: chapter.volume,
          people: mentioned(chapter.summary),
          summary: chapter.summary,
          impacts: [chapter.summary || "这一章改变了后面要核对的事实。"],
          quote: chapter.summary || chapter.title,
          confirmed: true,
        })));
  const people = cast.map((person, index) => personMemory(person, chapters, index));
  const clues = plot.foreshadowing
    .filter((hook) => !hook.retired)
    .map((hook) => ({
      title: hook.title,
      summary: hook.summary,
      status: hook.recoveredChapter ? "done" as const : hook.plantedChapter ? "open" as const : "later" as const,
      tags: [hook.plantedChapter ? `第${hook.plantedChapter}章埋下` : "未埋设", hook.plannedChapter ? `计划第${hook.plannedChapter}章` : "回收未定"].filter(Boolean),
      chapter: hook.plantedChapter,
    }));
  const lines = plot.plotlines
    .filter((line) => !line.retired)
    .map((line) => ({
      title: line.title,
      summary: line.summary,
      kind: line.kind === "mainline" ? "主线" : line.kind === "branch" ? "支线" : "成长",
    }));
  const relations = people.flatMap((person) => person.relations.map((relation) => ({ from: person.name, ...relation })));
  const rules = people.flatMap((person) =>
    cast
      .find((item) => item.name === person.name)
      ?.anchors.map((anchor) => ({ name: person.name, summary: anchor })) ?? [],
  );
  const pending =
    plot.changes.length +
    plot.chapters.filter((chapter) => chapter.itemStatus === "pending").length +
    clues.filter((clue) => clue.status !== "done").length;
  return withLedger(
    {
      chapters,
      events,
      people,
      clues,
      lines,
      relations,
      rules,
      volumes: ranges.map((volume) => ({
        id: volume.id,
        range: `第${volume.start}–${volume.end}章`,
        title: volume.title.replace(/^第.+?卷\s*·\s*/, ""),
        summary: volume.summary || volume.mainline,
        status: volume.status,
      })),
      pending,
    },
    ledger,
    ledgerPending,
  );
}

function withLedger(memory: MemoryModel, ledger: MemoryRecord[], ledgerPending: number): MemoryModel {
  const live = ledger.filter((item) => !item.retired && item.status === "confirmed");
  const events = [...memory.events];
  for (const item of live.filter((record) => record.kind === "event")) {
    if (events.some((event) => event.id === item.id || event.title === item.title)) continue;
    events.unshift({
      id: item.id,
      title: item.title,
      chapter: item.chapter ?? 1,
      place: item.place || item.time,
      people: item.characters.join("、"),
      summary: item.summary,
      impacts: item.impacts.length > 0 ? item.impacts : [item.summary],
      quote: item.quote || item.summary,
      confirmed: true,
    });
  }
  const clues = memory.clues.map((clue) => ({ ...clue }));
  for (const item of live.filter((record) => record.kind === "clue")) {
    const status = item.recoveredChapter ? "done" as const : item.chapter ? "open" as const : "later" as const;
    const existing = clues.find((clue) => clue.title === item.title);
    if (existing) {
      existing.summary = item.summary || existing.summary;
      existing.status = status;
      continue;
    }
    clues.unshift({
      title: item.title,
      summary: item.summary,
      status,
      tags: [item.chapter ? `第${item.chapter}章` : "未埋设", item.recoveredChapter ? "已回收" : "待回收"],
      chapter: item.chapter,
    });
  }
  const relations = [...memory.relations];
  for (const item of live.filter((record) => record.kind === "relation")) {
    const from = item.characters[0] ?? "";
    const name = item.characters[1] ?? item.title;
    if (!from || relations.some((relation) => relation.from === from && relation.name === name)) continue;
    relations.push({ from, name, summary: item.summary });
  }
  const rules = [...memory.rules];
  for (const item of live.filter((record) => record.kind === "fact")) {
    if (rules.some((rule) => rule.name === item.title && rule.summary === item.summary)) continue;
    rules.push({ name: item.title, summary: item.summary });
  }
  const people = memory.people.map((person) => {
    const states = live.filter((item) => item.kind === "state" && item.characters.includes(person.name));
    if (states.length === 0) return person;
    const extra = states
      .filter((item) => !person.tracks.some((track) => track.title === item.title))
      .map((item) => ({ chapter: item.chapter ?? 1, title: item.title, note: item.summary, tag: "成长" }));
    return extra.length === 0 ? person : { ...person, tracks: [...extra, ...person.tracks] };
  });
  return { ...memory, events, clues, relations, rules, people, pending: memory.pending + ledgerPending };
}

function personMemory(person: Character, chapters: ChapterMemory[], index: number): PersonMemory {
  const hits = chapters.filter((chapter) => `${chapter.title}${chapter.summary}`.includes(person.name)).slice(0, 6);
  const tracks =
    person.growth.length > 0
      ? person.growth.map((growth) => ({
          chapter: growth.chapter ?? 1,
          title: growth.realm || growth.note,
          note: growth.note,
          tag: growth.realm ? "修为提升" : "成长",
        }))
      : hits.map((chapter, hitIndex) => ({
          chapter: chapter.number,
          title: chapter.title,
          note: chapter.summary,
          tag: hitIndex === 0 ? "起点" : "成长",
        }));
  return {
    name: person.name,
    role: roleLabels[person.role as CharacterRole] ?? person.role,
    realm: person.realm || person.identity,
    place: person.tagline,
    firstChapter: hits[0]?.number ?? person.knowledge[0]?.sinceChapter ?? 1,
    summary: person.summary,
    tracks,
    states: [person.realm, person.identity, person.tagline].filter(Boolean),
    knowledge: person.knowledge.map((item) => item.fact),
    relations: person.relations.map((relation) => ({ name: relation.targetName, summary: relation.summary })),
    tone: index,
  };
}

function searchHits(memory: MemoryModel, keyword: string, tab: string) {
  const match = (text: string) => !keyword || text.includes(keyword);
  const hits: { id: string; title: string; summary: string; kind: string; eventId?: string; person?: string }[] = [];
  if (tab === "全部" || tab === "人物") {
    for (const person of memory.people) {
      if (match(`${person.name}${person.summary}${person.realm}`)) {
        hits.push({ id: person.name, title: person.name, summary: person.summary || person.realm, kind: "人物记忆", person: person.name });
      }
    }
  }
  if (tab === "全部" || tab === "事件") {
    for (const event of memory.events) {
      if (match(`${event.title}${event.summary}${event.people}`)) {
        hits.push({ id: event.id, title: event.title, summary: event.summary, kind: "关键事件", eventId: event.id });
      }
    }
  }
  if (tab === "全部" || tab === "章节") {
    for (const chapter of memory.chapters) {
      if (match(`第${chapter.number}章${chapter.title}${chapter.summary}`)) {
        hits.push({
          id: `c-${chapter.number}`,
          title: `第${chapter.number}章 ${chapter.title}`,
          summary: chapter.summary,
          kind: "章节摘要",
        });
      }
    }
  }
  if (tab === "全部" || tab === "线索") {
    for (const clue of memory.clues) {
      if (match(`${clue.title}${clue.summary}`)) hits.push({ id: clue.title, title: clue.title, summary: clue.summary, kind: "剧情线索" });
    }
    for (const line of memory.lines) {
      if (match(`${line.title}${line.summary}`)) hits.push({ id: line.title, title: line.title, summary: line.summary, kind: "剧情线索" });
    }
  }
  if (tab === "全部" || tab === "规则") {
    for (const rule of memory.rules) {
      if (match(`${rule.name}${rule.summary}`)) hits.push({ id: `${rule.name}${rule.summary}`, title: rule.name, summary: rule.summary, kind: "事实规则" });
    }
  }
  return hits.slice(0, 30);
}

function healthOf(memory: MemoryModel): HealthItem[] {
  const open = memory.clues.filter((clue) => clue.status !== "done");
  const blank = memory.chapters.filter((chapter) => !chapter.summary).length;
  const lonely = memory.people.filter((person) => person.relations.length === 0);
  return [
    {
      title: "人物状态一致性",
      detail: lonely.length ? `${lonely.map((person) => person.name).join("、")}还没有关系记录` : `已核对 ${memory.people.length} 位人物`,
      level: lonely.length ? "warn" : "ok",
    },
    {
      title: "事件因果追溯",
      detail: memory.events.length ? `${memory.events.length} 个关键事件都能回到章节` : "还没有可追溯的关键事件",
      level: memory.events.length ? "ok" : "warn",
    },
    {
      title: "时间线连贯性",
      detail: memory.volumes.length ? `${memory.volumes.length} 卷按章节号接上` : "还没有分卷",
      level: memory.volumes.length ? "ok" : "warn",
    },
    {
      title: "设定细节冲突",
      detail: blank ? `${blank} 章大纲还没有摘要` : "已有摘要的章节没有空条目",
      level: blank ? "warn" : "ok",
    },
    {
      title: "伏笔回收提醒",
      detail: open.length ? `有 ${open.length} 条线索还没回收` : "埋下的线索都已回收",
      level: open.length ? "warn" : "ok",
    },
  ];
}

function fanchenMemory(): MemoryModel {
  const chapters: ChapterMemory[] = [
    { number: 186, title: "深夜来客", summary: "陆沉在幽冥谷中突破金丹境，同时发现幕后势力的新的线索。", volumeId: "v3", volume: "第三卷", tags: ["突破成长", "势力线索", "陆沉"] },
    { number: 185, title: "异常灵气", summary: "陆沉深入幽冥谷，发现异常灵气波动，疑与上古遗迹有关。", volumeId: "v3", volume: "第三卷", tags: ["探索", "遗迹线索", "幽冥谷"] },
    { number: 184, title: "谷中遇险", summary: "众人深入幽冥谷，遭遇神秘势力袭击，苏清雪出手保护陆沉受伤。", volumeId: "v3", volume: "第三卷", tags: ["战斗", "苏清雪", "神秘势力"] },
    { number: 183, title: "前往幽冥谷", summary: "根据线索，陆沉一行人动身前往幽冥谷，调查玄清长老隐约透露的真相。", volumeId: "v3", volume: "第三卷", tags: ["推进主线", "幽冥谷", "调查"] },
  ];
  const events: EventMemory[] = [
    {
      id: "EV-0362",
      title: "陆沉突破金丹境",
      chapter: 186,
      place: "幽冥谷",
      people: "陆沉、苏清雪",
      summary: "陆沉在幽冥谷的灵脉异动中，借助天材地宝与心境突破，成功突破至金丹境。实力大幅提升，并察觉到幕后势力仍在暗中观察。",
      impacts: ["陆沉修为：筑基后期 → 金丹初期", "主线推进：接近幕后势力的真实目的", "人物关系：苏清雪对陆沉更加信任"],
      quote: "灵气在经脉里撞了三次，第四次终于稳住。金丹初成的时候，谷外有人把灯吹灭了。",
      confirmed: true,
    },
  ];
  const people: PersonMemory[] = [
    {
      name: "陆沉",
      role: "主角",
      realm: "金丹初期",
      place: "幽冥谷",
      firstChapter: 1,
      summary: "从凡人踏入修行，金丹初期仍在追查幕后势力。",
      tone: 0,
      tracks: [
        { chapter: 186, title: "突破金丹", note: "在幽冥谷中突破金丹境，实力大增。", tag: "修为提升" },
        { chapter: 128, title: "独当一面", note: "在宗门任务中展现实力，获得更多认可。", tag: "成长" },
        { chapter: 87, title: "经历背叛", note: "赵无极背刺，踏上对修行产生新的认知。", tag: "转折" },
        { chapter: 42, title: "正式修炼", note: "获得修炼功法，踏上修行之路。", tag: "起点" },
        { chapter: 1, title: "初入修行", note: "普通程序员，意外接触修仙世界。", tag: "起点" },
      ],
      states: ["当前境界：金丹初期", "所在：幽冥谷", "持续追踪幕后势力"],
      knowledge: ["天材地宝可以借灵脉冲击境界", "幕后势力在突破时仍在观察"],
      relations: [
        { name: "苏清雪", summary: "携手同行，第186章后更加信任。" },
        { name: "赵无极", summary: "曾经的好友，第87章决裂。" },
        { name: "玄清长老", summary: "话里总留半句，真实身份尚未开始。" },
      ],
    },
  ];
  return {
    chapters,
    events,
    people,
    clues: [
      { title: "神秘令牌", summary: "第92章出现的古老令牌，疑似与主角身世有关。", status: "open", tags: ["身世之谜", "陆沉"], chapter: 92 },
      { title: "幽冥谷的上古遗迹", summary: "第185章发现的遗迹，可能隐藏着上古势力的秘密。", status: "open", tags: ["世界真相", "幽冥谷"], chapter: 185 },
      { title: "玄清长老的真实身份", summary: "疑似与主角父亲有关，真实目的尚不明朗。", status: "later", tags: ["人物秘密", "玄清长老"], chapter: null },
      { title: "天灵石的来源", summary: "第56章获得，来自域外隙里，退回第19章。", status: "done", tags: ["资源设定", "域外势力"], chapter: 56 },
    ],
    lines: [
      { title: "凡尘入道", summary: "陆沉从凡人踏入修行，金丹初期仍在追查幕后势力。", kind: "主线" },
      { title: "宗门暗流", summary: "青云宗、天璇宗与镇魔司互相试探。", kind: "主线" },
      { title: "苏清雪同行", summary: "天璇宗弟子与主角并肩，世家身份逐渐露出来。", kind: "支线" },
    ],
    relations: [
      { from: "陆沉", name: "苏清雪", summary: "携手同行，突破之后更加信任。" },
      { from: "陆沉", name: "赵无极", summary: "曾经的好友，现已疏远。" },
    ],
    rules: [
      { name: "境界", summary: "突破需要灵脉、天材地宝与心境同时成立。" },
      { name: "战力", summary: "金丹初期可以在筑基群战里占上风，仍避不开金丹中期。" },
    ],
    volumes: [
      { id: "v1", range: "第1–40章（第一卷）", title: "凡尘初醒", summary: "主角初入修行，踏入修仙世界。", status: "done" },
      { id: "v2", range: "第41–80章（第二卷）", title: "灵路初行", summary: "拜入青云宗，修为提升，结识同伴。", status: "done" },
      { id: "v3", range: "第81–120章（第三卷）", title: "暗流涌动", summary: "宗门内外势力交织，危机渐显。", status: "done" },
      { id: "v4", range: "第121–160章（第四卷）", title: "宗门风云", summary: "宗门大比，势力博弈，真相初露。", status: "done" },
      { id: "v5", range: "第161–200章（第五卷）", title: "域外之地", summary: "进入幽冥谷，探寻上古遗迹。", status: "active" },
      { id: "v6", range: "第201–240章（第六卷）", title: "天机显现", summary: "揭示上古真相，世界格局变化。", status: "pending" },
    ],
    pending: 8,
  };
}
