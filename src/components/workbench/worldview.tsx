"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createSeed,
  emptyWorld,
  moduleLabels,
  type Activity,
  type Entry,
  type ModuleId,
  type WorldviewState,
} from "@/lib/worldview/model";
import { IconBack, IconChevron, IconMore, IconPlus, IconSearch } from "./icons";
import { Picture, uploadImage } from "./picture";

type View =
  | { kind: "home" }
  | { kind: "module"; id: ModuleId }
  | { kind: "filter"; mode: "all" | "core" | "pending" }
  | { kind: "entry"; id: string }
  | { kind: "search" }
  | { kind: "sort" };

type Sheet =
  | null
  | { type: "edit" }
  | { type: "create"; moduleId: ModuleId };

const moduleMeta: {
  id: ModuleId;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
}[] = [
  { id: "background", label: "世界背景", icon: IconWorld },
  { id: "region", label: "地理区域", icon: IconPin },
  { id: "cultivation", label: "修炼体系", icon: IconBolt },
  { id: "faction", label: "势力组织", icon: IconOrg },
  { id: "item", label: "资源物品", icon: IconCube },
  { id: "rule", label: "世界规则", icon: IconScale },
  { id: "history", label: "历史事件", icon: IconColumns },
  { id: "custom", label: "自定义", icon: IconGear },
];

const seed = createSeed();

const aiPool: { module: ModuleId; name: string; summary: string }[] = [
  {
    module: "region",
    name: "霜潮秘境",
    summary: "北境每年霜潮期开启的临时秘境，灵气暴涨，妖兽与遗迹一同出现。",
  },
  {
    module: "item",
    name: "问心铃",
    summary: "能映出持有者心魔的古铃，响到第三声会引来天劫预兆。",
  },
  {
    module: "history",
    name: "灵脉枯竭之年",
    summary: "三百年前中州灵脉突然枯竭，凡人王朝趁机向灵山扩张疆域。",
  },
];

function labelOf(id: ModuleId) {
  return moduleLabels[id];
}

function viewTitle(view: View, entries: Entry[]) {
  if (view.kind === "home") return "世界观";
  if (view.kind === "module") return labelOf(view.id);
  if (view.kind === "filter") {
    if (view.mode === "core") return "核心规则";
    if (view.mode === "pending") return "待确认";
    return "全部设定";
  }
  if (view.kind === "entry") {
    return entries.find((item) => item.id === view.id)?.name ?? "设定详情";
  }
  if (view.kind === "search") return "搜索";
  return "管理排序";
}

export function Worldview({
  onBack,
  novelId,
  novelTitle,
  premise = "",
}: {
  onBack: () => void;
  novelId: string;
  novelTitle: string;
  premise?: string;
}) {
  const initial = novelId === "fanchen-wendao" ? seed : emptyWorld(novelTitle, premise);
  const [stack, setStack] = useState<View[]>([{ kind: "home" }]);
  const [entries, setEntries] = useState(initial.entries);
  const [activities, setActivities] = useState(initial.activities);
  const [order, setOrder] = useState<ModuleId[]>(initial.order);
  const [worldName, setWorldName] = useState(initial.worldName);
  const [worldSummary, setWorldSummary] = useState(initial.worldSummary);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const aiCursor = useRef(0);
  const revisionRef = useRef(initial.revision);
  const hydratedRef = useRef(false);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const view = stack[stack.length - 1] ?? { kind: "home" as const };

  function applyState(state: WorldviewState) {
    hydratedRef.current = true;
    revisionRef.current = state.revision;
    setEntries(state.entries);
    setActivities(state.activities);
    setOrder(state.order);
    setWorldName(state.worldName);
    setWorldSummary(state.worldSummary);
  }

  async function commit(body: Record<string, unknown>) {
    const response = await fetch("/api/worldview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, novelId }),
      cache: "no-store",
    });
    const data = (await response.json()) as {
      state?: WorldviewState;
      message?: string;
      result?: { conflicts: { name: string; reason: string }[] };
    };
    if (!response.ok || !data.state) {
      setToast(data.message ?? "保存失败");
      return null;
    }
    applyState(data.state);
    return data;
  }

  const total = entries.length;
  const coreCount = entries.filter((item) => item.core).length;
  const pendingCount = entries.filter((item) => item.pending || item.pendingImage).length;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      if (sheetRef.current) return;
      try {
        const response = await fetch(`/api/worldview?novelId=${encodeURIComponent(novelId)}`, {
          cache: "no-store",
        });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as { state: WorldviewState };
        if (stopped || data.state.revision < revisionRef.current) return;
        if (hydratedRef.current && data.state.revision === revisionRef.current) return;
        hydratedRef.current = true;
        revisionRef.current = data.state.revision;
        setEntries(data.state.entries);
        setActivities(data.state.activities);
        setOrder(data.state.order);
        setWorldName(data.state.worldName);
        setWorldSummary(data.state.worldSummary);
      } catch {
        // Keep the current screen if the file is briefly locked.
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [novelId]);

  function push(next: View) {
    setMenuOpen(false);
    setStack((current) => [...current, next]);
  }

  function pop() {
    setMenuOpen(false);
    setSheet(null);
    if (stack.length === 1) {
      onBack();
      return;
    }
    setStack((current) => current.slice(0, -1));
  }

  function countOf(id: ModuleId) {
    return entries.filter((item) => item.module === id).length;
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    setOrder(next);
    void commit({ action: "reorder", order: next });
  }

  function confirmEntry(id: string) {
    void commit({ action: "confirm", id }).then((result) => {
      if (result) setToast("已确认这条设定");
    });
  }

  function toggleCore(id: string) {
    void commit({ action: "toggle_core", id }).then((result) => {
      if (!result) return;
      const entry = result.state?.entries.find((item) => item.id === id);
      setToast(entry?.core ? "已标为核心规则" : "已取消核心规则");
    });
  }

  function generate() {
    if (generatingRef.current) return;
    const preset = aiPool[aiCursor.current % aiPool.length];
    aiCursor.current += 1;
    if (!preset) return;
    generatingRef.current = true;
    setGenerating(true);
    void commit({
      action: "propose_entries",
      entries: [{ ...preset, source: "AI 生成" }],
    }).then((result) => {
      generatingRef.current = false;
      setGenerating(false);
      if (!result) return;
      const conflict = result.result?.conflicts[0];
      setToast(
        conflict
          ? `「${conflict.name}」${conflict.reason}`
          : `已生成「${preset.name}」，等待确认`,
      );
    });
  }

  function openCreate() {
    const moduleId = view.kind === "module" ? view.id : "background";
    setSheet({ type: "create", moduleId });
  }

  function saveEntry(draft: {
    name: string;
    summary: string;
    module: ModuleId;
    core: boolean;
    imageId?: string;
  }) {
    void commit({ action: "create_entry", ...draft }).then((result) => {
      if (!result) return;
      setSheet(null);
      setToast(`已新增「${draft.name}」`);
    });
  }

  const listed = entriesFor(view, entries, query, order);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 bg-[#f6f7fb] pb-1">
        {view.kind === "search" ? (
          <div className="workbench-header flex items-center gap-1 px-2 pt-[max(10px,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={pop}
              aria-label="返回"
              className="grid size-10 shrink-0 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
            >
              <IconBack className="size-[22px]" />
            </button>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索设定、区域、规则"
              aria-label="搜索设定"
              className="h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-[#1c1e28] outline-none ring-1 ring-[#e6e8f0] placeholder:text-[#b0b4c0]"
            />
          </div>
        ) : (
          <div className="workbench-header grid grid-cols-[5rem_minmax(0,1fr)_5rem] items-center px-1.5 pt-[max(10px,env(safe-area-inset-top))] lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-1">
            <button
              type="button"
              onClick={pop}
              aria-label="返回"
              className="grid size-10 place-items-center justify-self-start rounded-full text-[#1c1e28] active:bg-black/5"
            >
              <IconBack className="size-[22px]" />
            </button>
            <h1 className="truncate text-center text-[17px] font-semibold tracking-tight lg:text-left">
              {viewTitle(view, entries)}
            </h1>
            <div className="flex items-center justify-end justify-self-end">
              {view.kind === "home" ? (
                <>
                  <button
                    type="button"
                    aria-label="搜索"
                    onClick={() => {
                      setQuery("");
                      push({ kind: "search" });
                    }}
                    className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
                  >
                    <IconSearch className="size-[22px]" />
                  </button>
                  <button
                    type="button"
                    aria-label="更多"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                    className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
                  >
                    <IconMore className="size-5" />
                  </button>
                </>
              ) : (
                <span className="size-10" />
              )}
            </div>
          </div>
        )}
        {menuOpen && view.kind === "home" ? (
          <>
            <button
              type="button"
              aria-label="关闭菜单"
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-3 top-[calc(100%-4px)] z-40 w-40 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_10px_28px_rgba(22,22,40,0.14)]">
              {(
                [
                  ["all", "全部设定", total],
                  ["core", "核心规则", coreCount],
                  ["pending", "待确认", pendingCount],
                ] as const
              ).map(([mode, label, count]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => push({ kind: "filter", mode })}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[14px] text-[#1c1e28] active:bg-[#f6f7fb]"
                >
                  {label}
                  <span className="text-[12px] text-[#a0a4b0]">{count}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </header>

      <main className="workbench-gutter flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-2">
        {view.kind === "home" ? (
          <HomeView
            novelTitle={novelTitle}
            worldName={worldName}
            worldSummary={worldSummary}
            total={total}
            coreCount={coreCount}
            pendingCount={pendingCount}
            order={order}
            countOf={countOf}
            activities={activities.slice(0, 3)}
            onEdit={() => setSheet({ type: "edit" })}
            onOpenModule={(id) => push({ kind: "module", id })}
            onOpenFilter={(mode) => push({ kind: "filter", mode })}
            onSort={() => push({ kind: "sort" })}
            onOpenEntry={(id) => push({ kind: "entry", id })}
          />
        ) : null}

        {view.kind === "sort" ? (
          <SortView order={order} countOf={countOf} onMove={move} />
        ) : null}

        {view.kind === "entry" ? (
          <EntryDetail
            novelId={novelId}
            entry={entries.find((item) => item.id === view.id)}
            onConfirm={confirmEntry}
            onToggleCore={toggleCore}
          />
        ) : null}

        {view.kind === "search" && query.trim() === "" ? (
          <p className="px-2 pt-8 text-center text-[13px] text-[#a0a4b0]">
            搜索设定名称、概述或模块
          </p>
        ) : null}

        {listed ? (
          <EntryList
            novelId={novelId}
            items={listed}
            showModule={view.kind !== "module"}
            onOpen={(id) => push({ kind: "entry", id })}
          />
        ) : null}
      </main>

      {view.kind === "home" || view.kind === "module" || view.kind === "filter" ? (
        <div className="workbench-gutter shrink-0 bg-[#f6f7fb] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-1 lg:pb-5">
          <div className="workbench-actions grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="flex h-[50px] items-center justify-center gap-1 rounded-2xl border border-[#5b40db] bg-white text-[15px] font-medium text-[#5b40db] active:bg-[#f6f3ff] disabled:opacity-60"
            >
              <IconSpark className="size-4" />
              {generating ? "生成中..." : "AI生成设定"}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex h-[50px] items-center justify-center gap-1 rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(91,64,219,0.28)] active:bg-[#4e36c4]"
            >
              <IconPlus className="size-[18px]" />
              新增设定
            </button>
          </div>
        </div>
      ) : null}

      {view.kind === "sort" ? (
        <div className="workbench-gutter shrink-0 bg-[#f6f7fb] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-1 lg:pb-5">
          <button
            type="button"
            onClick={pop}
            className="flex h-[50px] w-full items-center justify-center rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white active:bg-[#4e36c4] lg:ml-auto lg:w-36"
          >
            完成
          </button>
        </div>
      ) : null}

      {sheet?.type === "edit" ? (
        <EditSheet
          name={worldName}
          summary={worldSummary}
          onClose={() => setSheet(null)}
          onSave={(name, summary) => {
            void commit({ action: "set_overview", name, summary }).then((result) => {
              if (!result) return;
              setSheet(null);
              setToast("概述已更新");
            });
          }}
        />
      ) : null}

      {sheet?.type === "create" ? (
        <CreateSheet
          novelId={novelId}
          initialModule={sheet.moduleId}
          onClose={() => setSheet(null)}
          onSave={saveEntry}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">
          <p className="w-full max-w-[390px] rounded-full bg-[#1c1e28]/92 px-4 py-2 text-center text-[13px] text-white">
            {toast}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function entriesFor(
  view: View,
  entries: Entry[],
  query: string,
  order: ModuleId[],
) {
  const rank = new Map(order.map((id, index) => [id, index]));
  const sorted = [...entries].sort(
    (a, b) => (rank.get(a.module) ?? 0) - (rank.get(b.module) ?? 0),
  );
  if (view.kind === "module") return sorted.filter((item) => item.module === view.id);
  if (view.kind === "filter") {
    if (view.mode === "core") return sorted.filter((item) => item.core);
    if (view.mode === "pending") return sorted.filter((item) => item.pending || item.pendingImage);
    return sorted;
  }
  if (view.kind === "search") {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return null;
    return sorted.filter((item) => {
      const haystack = `${item.name} ${item.summary} ${labelOf(item.module)}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }
  return null;
}

function HomeView({
  novelTitle,
  worldName,
  worldSummary,
  total,
  coreCount,
  pendingCount,
  order,
  countOf,
  activities,
  onEdit,
  onOpenModule,
  onOpenFilter,
  onSort,
  onOpenEntry,
}: {
  novelTitle: string;
  worldName: string;
  worldSummary: string;
  total: number;
  coreCount: number;
  pendingCount: number;
  order: ModuleId[];
  countOf: (id: ModuleId) => number;
  activities: Activity[];
  onEdit: () => void;
  onOpenModule: (id: ModuleId) => void;
  onOpenFilter: (mode: "all" | "core" | "pending") => void;
  onSort: () => void;
  onOpenEntry: (id: string) => void;
}) {
  const stats = [
    { label: "设定条目", value: total, icon: IconLayers, tone: "text-[#5b40db]", mode: "all" as const },
    { label: "核心规则", value: coreCount, icon: IconShieldStat, tone: "text-[#5b40db]", mode: "core" as const },
    { label: "待确认", value: pendingCount, icon: IconAlert, tone: "text-[#ef5348]", mode: "pending" as const },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section className="relative h-[158px] overflow-hidden rounded-[22px] shadow-[0_12px_28px_rgba(36,64,96,0.16)] lg:h-52">
        <WorldLandscape className="absolute inset-0 h-full w-full" />
        <div className="relative flex h-full flex-col px-4 pb-3.5 pt-3.5 lg:p-6">
          <span className="w-fit rounded-md bg-[#1b2430]/50 px-2 py-1 text-[11px] leading-none text-white backdrop-blur-[2px]">
            {novelTitle}
          </span>
          <h2 className="mt-2.5 text-[26px] font-bold leading-none tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            {worldName}
          </h2>
          <p className="mt-2 line-clamp-2 max-w-[17em] text-[13px] leading-[1.45] text-white/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] lg:max-w-[40em]">
            {worldSummary}
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="mt-auto inline-flex w-fit items-center gap-0.5 rounded-lg border border-white/80 bg-black/20 px-2.5 py-1.5 text-[12px] leading-none text-white backdrop-blur-[2px] active:bg-black/35"
          >
            编辑概述
            <IconChevron className="size-3.5" />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2.5 lg:gap-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onOpenFilter(item.mode)}
              className="flex flex-col items-center rounded-2xl bg-white px-1 py-3.5 shadow-[0_8px_24px_rgba(28,28,48,0.045)] active:bg-[#fafafc]"
            >
              <Icon className={`size-7 ${item.tone}`} />
              <span className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums tracking-tight text-[#1c1e28]">
                {item.value}
              </span>
              <span className="mt-1.5 text-[12px] leading-none text-[#9aa0ae]">{item.label}</span>
            </button>
          );
        })}
      </div>

      <section>
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <h2 className="text-[16px] font-semibold tracking-tight text-[#1a1c24]">世界观模块</h2>
          <button
            type="button"
            onClick={onSort}
            className="flex items-center text-[13px] text-[#a0a4b0] active:opacity-70"
          >
            管理排序
            <IconChevron className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2.5 lg:gap-4">
          {order.map((id) => {
            const meta = moduleMeta.find((item) => item.id === id);
            if (!meta) return null;
            const Icon = meta.icon;
            const count = countOf(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onOpenModule(id)}
                aria-label={`${meta.label}，${count}项`}
                className="flex flex-col items-center rounded-2xl bg-white px-1 py-3.5 shadow-[0_8px_24px_rgba(28,28,48,0.045)] active:bg-[#fafafc]"
              >
                <Icon className="size-6 text-[#5b40db]" />
                <span className="mt-2 text-[13px] font-medium leading-none text-[#1c1e28]">
                  {meta.label}
                </span>
                <span className="mt-1.5 text-[11px] leading-none text-[#a8adba]">{count}项</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 px-0.5 text-[16px] font-semibold tracking-tight text-[#1a1c24]">
          最近动态
        </h2>
        <ul className="flex flex-col gap-2.5">
          {activities.length === 0 ? (
            <li className="rounded-2xl bg-white px-3.5 py-4 text-[13px] text-[#9aa0ae] shadow-[0_8px_24px_rgba(28,28,48,0.045)]">
              还没有动态。和 Codex 确认设定后，新条目会出现在这里。
            </li>
          ) : null}
          {activities.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                onClick={() => onOpenEntry(activity.entryId)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.045)] active:bg-[#fafafc]"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl text-[14px] font-semibold text-white ${
                    activity.badge === "确" ? "bg-[#3aaa72]" : "bg-[#5b40db]"
                  }`}
                >
                  {activity.badge}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-tight text-[#1c1e28]">
                    {activity.title}
                  </span>
                  <span className="mt-1 block truncate text-[12px] leading-none text-[#9aa0ae]">
                    {activity.detail}
                  </span>
                </span>
                <IconChevron className="size-4 shrink-0 text-[#c5c8d2]" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SortView({
  order,
  countOf,
  onMove,
}: {
  order: ModuleId[];
  countOf: (id: ModuleId) => number;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div>
      <p className="mb-3 px-0.5 text-[13px] text-[#8e929c]">调整首页模块的排列</p>
      <ul className="flex flex-col gap-2.5">
        {order.map((id, index) => {
          const meta = moduleMeta.find((item) => item.id === id);
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(28,28,48,0.045)]"
            >
              <Icon className="size-6 shrink-0 text-[#5b40db]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-[#1c1e28]">{meta.label}</span>
                <span className="text-[12px] text-[#9aa0ae]">{countOf(id)}项</span>
              </span>
              <button
                type="button"
                aria-label={`上移${meta.label}`}
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                className="grid size-8 place-items-center rounded-full text-[#5b40db] active:bg-[#f4f1ff] disabled:text-[#d5d8e2]"
              >
                <IconChevron className="size-4 -rotate-90" />
              </button>
              <button
                type="button"
                aria-label={`下移${meta.label}`}
                disabled={index === order.length - 1}
                onClick={() => onMove(index, 1)}
                className="grid size-8 place-items-center rounded-full text-[#5b40db] active:bg-[#f4f1ff] disabled:text-[#d5d8e2]"
              >
                <IconChevron className="size-4 rotate-90" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EntryList({
  novelId,
  items,
  showModule,
  onOpen,
}: {
  novelId: string;
  items: Entry[];
  showModule: boolean;
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e1e4ec] bg-white px-4 py-14 text-center">
        <p className="text-[15px] font-medium text-[#2a2c36]">没有匹配的设定</p>
        <p className="mt-1.5 text-[13px] text-[#a0a4b0]">换个词，或新增一条</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex w-full items-center gap-2 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.045)] active:bg-[#fafafc]"
          >
            <Picture novelId={novelId} imageId={item.pendingImage || item.image} alt="" className="size-11 shrink-0 rounded-xl" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-medium text-[#1c1e28]">{item.name}</span>
                {item.pending || item.pendingImage ? (
                  <em className="shrink-0 rounded-full bg-[#f8f1e7] px-1.5 py-0.5 text-[10px] font-medium not-italic text-[#b8916a]">
                    待确认
                  </em>
                ) : null}
                {item.core ? (
                  <em className="shrink-0 rounded-full bg-[#efeaff] px-1.5 py-0.5 text-[10px] font-medium not-italic text-[#5b40db]">
                    核心
                  </em>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-[12px] text-[#9aa0ae]">
                {showModule ? `${labelOf(item.module)} · ` : ""}
                {item.summary}
              </span>
            </span>
            <IconChevron className="size-4 shrink-0 text-[#c5c8d2]" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function EntryDetail({
  novelId,
  entry,
  onConfirm,
  onToggleCore,
}: {
  novelId: string;
  entry: Entry | undefined;
  onConfirm: (id: string) => void;
  onToggleCore: (id: string) => void;
}) {
  if (!entry) {
    return <p className="px-1 pt-8 text-center text-[14px] text-[#8e929c]">这条设定已经不在了</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <article className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,28,48,0.045)]">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[#f3f4f8] px-2 py-1 text-[12px] leading-none text-[#6a6e7c]">
            {labelOf(entry.module)}
          </span>
          {entry.core ? (
            <span className="rounded-full bg-[#efeaff] px-2 py-1 text-[12px] leading-none text-[#5b40db]">
              核心
            </span>
          ) : null}
          {entry.pending || entry.pendingImage ? (
            <span className="rounded-full bg-[#f8f1e7] px-2 py-1 text-[12px] leading-none text-[#b8916a]">
              待确认
            </span>
          ) : null}
        </div>
        <Picture
          novelId={novelId}
          imageId={entry.pendingImage || entry.image}
          alt={entry.name}
          className="mt-3 h-40 w-full rounded-2xl"
        />
        <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-[#1c1e28]">{entry.name}</h2>
        <p className="mt-2 text-[14px] leading-7 text-[#4a4e5c]">{entry.summary}</p>
        {entry.source ? (
          <p className="mt-3 text-[13px] text-[#8e929c]">来源 · {entry.source}</p>
        ) : null}
      </article>
      {entry.pending || entry.pendingImage ? (
        <button
          type="button"
          onClick={() => onConfirm(entry.id)}
          className="flex h-11 items-center justify-center rounded-xl bg-[#5b40db] text-[15px] font-medium text-white active:bg-[#4e36c4]"
        >
          {entry.pending ? "确认这条设定" : "确认这张图"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onToggleCore(entry.id)}
        className="flex h-11 items-center justify-center rounded-xl border border-[#e4e6ee] bg-white text-[15px] font-medium text-[#2a2c36] active:bg-[#fafafc]"
      >
        {entry.core ? "取消核心规则" : "标为核心规则"}
      </button>
    </div>
  );
}

function SheetFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-center">
      <div className="workbench-dialog relative flex h-full w-full max-w-[430px] flex-col justify-end sm:max-w-[760px] lg:max-w-none">
        <button
          type="button"
          aria-label="关闭"
          className="absolute inset-0 bg-[#12141c]/40"
          onClick={onClose}
        />
        <div className="workbench-dialog-panel relative max-h-[82dvh] overflow-y-auto rounded-t-[24px] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e4e6ee] lg:hidden" />
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="text-[14px] text-[#8e929c]">
              取消
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function EditSheet({
  name,
  summary,
  onClose,
  onSave,
}: {
  name: string;
  summary: string;
  onClose: () => void;
  onSave: (name: string, summary: string) => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftSummary, setDraftSummary] = useState(summary);
  const ready = draftName.trim().length > 0 && draftSummary.trim().length > 0;

  return (
    <SheetFrame title="编辑概述" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          onSave(draftName.trim(), draftSummary.trim());
        }}
      >
        <label className="block text-[13px] text-[#6a6e7c]" htmlFor="world-name">
          世界名称
        </label>
        <input
          id="world-name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl bg-[#f5f6fa] px-3 text-[15px] outline-none ring-[#5b40db] focus:ring-1"
        />
        <label className="mt-3 block text-[13px] text-[#6a6e7c]" htmlFor="world-summary">
          概述
        </label>
        <textarea
          id="world-summary"
          value={draftSummary}
          onChange={(event) => setDraftSummary(event.target.value)}
          className="mt-1.5 min-h-28 w-full rounded-xl bg-[#f5f6fa] px-3 py-2 text-[15px] leading-6 outline-none ring-[#5b40db] focus:ring-1"
        />
        <button
          type="submit"
          disabled={!ready}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#5b40db] text-[15px] font-medium text-white disabled:opacity-40"
        >
          保存
        </button>
      </form>
    </SheetFrame>
  );
}

function CreateSheet({
  novelId,
  initialModule,
  onClose,
  onSave,
}: {
  novelId: string;
  initialModule: ModuleId;
  onClose: () => void;
  onSave: (draft: { name: string; summary: string; module: ModuleId; core: boolean; imageId?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [moduleId, setModuleId] = useState<ModuleId>(initialModule);
  const [core, setCore] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <SheetFrame title="新增设定" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || saving) return;
          setSaving(true);
          setError("");
          void (async () => {
            try {
              const imageId = file ? await uploadImage(novelId, file) : undefined;
              onSave({ name: name.trim(), summary: summary.trim(), module: moduleId, core, imageId });
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "图片保存失败");
              setSaving(false);
            }
          })();
        }}
      >
        <label className="block text-[13px] text-[#6a6e7c]" htmlFor="entry-name">
          名称
        </label>
        <input
          id="entry-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：落霞港"
          className="mt-1.5 h-11 w-full rounded-xl bg-[#f5f6fa] px-3 text-[15px] outline-none ring-[#5b40db] placeholder:text-[#b0b4c0] focus:ring-1"
        />
        <p className="mb-1.5 mt-3 text-[13px] text-[#6a6e7c]">所属模块</p>
        <div className="flex flex-wrap gap-2">
          {moduleMeta.map((item) => {
            const selected = item.id === moduleId;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setModuleId(item.id)}
                className={`rounded-full px-3 py-1.5 text-[13px] ${
                  selected ? "bg-[#efeaff] font-medium text-[#5b40db]" : "bg-[#f3f4f8] text-[#6a6e7c]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <label className="mt-3 block text-[13px] text-[#6a6e7c]" htmlFor="entry-summary">
          概述
        </label>
        <textarea
          id="entry-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className="mt-1.5 min-h-20 w-full rounded-xl bg-[#f5f6fa] px-3 py-2 text-[15px] leading-6 outline-none ring-[#5b40db] focus:ring-1"
        />
        <button
          type="button"
          aria-pressed={core}
          onClick={() => setCore((value) => !value)}
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#f5f6fa] px-3 py-3 text-left"
        >
          <span className="text-[14px] text-[#1c1e28]">标为核心规则</span>
          <span
            className={`grid h-6 w-11 place-items-center rounded-full p-0.5 ${
              core ? "justify-end bg-[#5b40db]" : "justify-start bg-[#d9dbe3]"
            }`}
          >
            <span className="size-5 rounded-full bg-white shadow-sm" />
          </span>
        </button>
        <label className="mt-3 block text-[13px] text-[#6a6e7c]" htmlFor="entry-image">
          图片
        </label>
        <input
          id="entry-image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1.5 block w-full text-[13px] text-[#4a4e5c]"
        />
        {error ? <p className="mt-2 text-[12px] text-[#d4892a]">{error}</p> : null}
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#5b40db] text-[15px] font-medium text-white disabled:opacity-40"
        >
          {saving ? "保存中" : "保存"}
        </button>
      </form>
    </SheetFrame>
  );
}

function WorldLandscape({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 390 176"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="wv-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f86c4" />
          <stop offset="48%" stopColor="#8ec4e4" />
          <stop offset="100%" stopColor="#f4ddb4" />
        </linearGradient>
        <radialGradient id="wv-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="42%" stopColor="#ffe3a0" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffe3a0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wv-scrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#102838" stopOpacity="0.42" />
          <stop offset="42%" stopColor="#102838" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#102838" stopOpacity="0" />
        </linearGradient>
        <filter id="wv-mist" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <rect width="390" height="176" fill="url(#wv-sky)" />
      <circle cx="292" cy="38" r="42" fill="url(#wv-sun)" />
      <circle cx="292" cy="38" r="13" fill="#fff7e4" />
      <path d="M0 92 46 58 78 78 124 46 168 76 214 50 258 82 310 58 360 84 390 70v106H0Z" fill="#b9d4e6" />
      <path d="M0 108 36 74 84 104 128 68 176 108 220 78 262 112 318 82 360 108 390 90v86H0Z" fill="#5f93a4" />
      <path d="M210 96 268 52 304 88 332 64 376 96 390 84v92H210Z" fill="#2f6d72" />
      <path d="M248 118 300 70 334 108 360 86 390 112v64H248Z" fill="#1f5560" />
      <path d="M312 66c2 18 3 36 2 58" fill="none" stroke="#f7fdff" strokeWidth="3.2" strokeLinecap="round" opacity="0.95" />
      <path d="M318 70c2 16 2 34 1 52" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M307 74c1 14 2 28 1 44" fill="none" stroke="#e7f7ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="314" cy="132" rx="22" ry="8" fill="#f4fbff" opacity="0.8" filter="url(#wv-mist)" />
      <path d="M0 128 40 96 78 122 118 88 156 124 196 104 236 136 390 150v26H0Z" fill="#245868" />
      <path d="M0 148 52 126 104 150 156 128 214 156 280 140 390 158v18H0Z" fill="#163e4c" />
      <path d="M34 132 46 102 58 132Z" fill="#123844" />
      <path d="M50 128 60 104 70 128Z" fill="#1a4654" />
      <path d="M78 140 92 104 106 140Z" fill="#102f3a" />
      <g transform="translate(336 86)">
        <path d="M-6 20 14 8 34 20Z" fill="#3d2d24" />
        <path d="M-2 14 14 5 30 14Z" fill="#5a4032" />
        <path d="M4 20v10M22 20v10" stroke="#2c241c" strokeWidth="1.7" />
        <path d="M-8 20h42" stroke="#241c16" strokeWidth="1.5" />
        <rect x="10" y="20" width="8" height="7" fill="#6d5342" />
      </g>
      <ellipse cx="120" cy="160" rx="100" ry="16" fill="#eef5f6" opacity="0.28" filter="url(#wv-mist)" />
      <rect width="390" height="176" fill="url(#wv-scrim)" />
    </svg>
  );
}

function Glyph({
  className,
  children,
  filled = false,
}: {
  className?: string;
  children: ReactNode;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? undefined : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 4 19.6 8 12 12 4.4 8 12 4Z" />
      <path d="M4.4 12 12 16 19.6 12" />
      <path d="M4.4 16 12 20 19.6 16" />
    </Glyph>
  );
}

function IconShieldStat({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 3.6 19 6.4v5.2c0 3.8-2.6 6.4-7 8-4.4-1.6-7-4.2-7-8V6.4L12 3.6Z" />
      <path d="m8.8 11.6 2.2 2.2 4.2-4.4" />
    </Glyph>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 4.2 20.4 19H3.6L12 4.2Z" />
      <path d="M12 9.4v4.2" />
      <path d="M12 16.6h.01" />
    </Glyph>
  );
}

function IconWorld({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.2 2.4 3.3 5.1 3.3 8S14.2 17.6 12 20c-2.2-2.4-3.3-5.1-3.3-8S9.8 6.4 12 4Z" />
    </Glyph>
  );
}

function IconPin({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 21s6.2-5.3 6.2-10.2a6.2 6.2 0 1 0-12.4 0C5.8 15.7 12 21 12 21Z" />
      <circle cx="12" cy="10.8" r="2" />
    </Glyph>
  );
}

function IconBolt({ className }: { className?: string }) {
  return (
    <Glyph className={className} filled>
      <path d="M13.1 2.6 4.8 13.2h5.6l-.8 8.2 8.6-11.2h-5.6l.5-7.6Z" />
    </Glyph>
  );
}

function IconOrg({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="5.5" r="2.1" />
      <circle cx="6" cy="17.2" r="2.1" />
      <circle cx="18" cy="17.2" r="2.1" />
      <path d="M12 7.6V12H6.2v3M12 12h5.8v3" />
    </Glyph>
  );
}

function IconCube({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 3.4 20 8v8.2L12 20.8 4 16.2V8L12 3.4Z" />
      <path d="M12 11.2 20 8M12 11.2 4 8M12 11.2v9.6" />
    </Glyph>
  );
}

function IconScale({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 4v14.2" />
      <path d="M7.2 20.2h9.6" />
      <path d="M6.2 7.6h11.6" />
      <path d="M6.2 7.6 3.6 13.4h5.2L6.2 7.6Z" />
      <path d="M17.8 7.6 15.2 13.4h5.2L17.8 7.6Z" />
    </Glyph>
  );
}

function IconColumns({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 10.2 12 5l8 5.2" />
      <path d="M6.2 10.2V19M10 10.2V19M14 10.2V19M17.8 10.2V19" />
      <path d="M5 19.4h14" />
    </Glyph>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M10 3.3h4l.6 2.1a6.5 6.5 0 0 1 1.7 1l2-1.1 2 3.4-1.6 1.6a6.6 6.6 0 0 1 0 2l1.6 1.6-2 3.4-2-1.1a6.5 6.5 0 0 1-1.7 1L14 20.7h-4l-.6-2.1a6.5 6.5 0 0 1-1.7-1l-2 1.1-2-3.4 1.6-1.6a6.6 6.6 0 0 1 0-2L3.7 8.7l2-3.4 2 1.1a6.5 6.5 0 0 1 1.7-1L10 3.3Z" />
      <circle cx="12" cy="12" r="2.3" />
    </Glyph>
  );
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.2 13.7 8.6 20.2 10.2 13.7 11.8 12 18.2 10.3 11.8 3.8 10.2 10.3 8.6Z"
      />
      <path
        fill="currentColor"
        d="M18.2 14.2 18.9 16.6 21.4 17.3 18.9 18 18.2 20.4 17.5 18 15 17.3 17.5 16.6Z"
      />
    </svg>
  );
}
