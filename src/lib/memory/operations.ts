import { roleLabels, type Character } from "../characters/model";
import {
  activeChapters,
  activeEvents,
  activeHooks,
  activeLines,
  plannedChapterCount,
  volumeRanges,
} from "../plot/operations";
import type { PlotState } from "../plot/model";
import {
  emptyMemory,
  isMemoryKind,
  type MemoryAction,
  type MemoryChange,
  type MemoryKind,
  type MemoryPayload,
  type MemoryRecord,
  type MemoryState,
} from "./model";

export type MemoryIssue = { level: "error" | "warning"; message: string };

type Save = { save: boolean; error?: string };

export type MemorySource = {
  novelTitle: string;
  plot: PlotState;
  characters: Character[];
  memory: MemoryState;
};

export type MemoryInput = {
  action?: unknown;
  id?: unknown;
  kind?: unknown;
  title?: unknown;
  summary?: unknown;
  chapter?: unknown;
  time?: unknown;
  characters?: unknown;
  place?: unknown;
  impacts?: unknown;
  quote?: unknown;
  sourceChapter?: unknown;
  sourceNote?: unknown;
  dependsOn?: unknown;
  recoveredChapter?: unknown;
  note?: unknown;
};

const kindAliases: Record<string, MemoryKind> = {
  event: "event",
  事件: "event",
  关键事件: "event",
  state: "state",
  状态: "state",
  人物状态: "state",
  clue: "clue",
  线索: "clue",
  伏笔: "clue",
  relation: "relation",
  关系: "relation",
  fact: "fact",
  事实: "fact",
  规则: "fact",
  chapter: "chapter",
  章节: "chapter",
};

const actionAliases: Record<string, MemoryAction> = {
  create: "create",
  update: "update",
  retire: "retire",
  新增: "create",
  创建: "create",
  更新: "update",
  修改: "update",
  删除: "retire",
  撤下: "retire",
  退役: "retire",
};

let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const name = text(item);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

function chapterNumber(value: unknown): { value: number | null; error?: string } {
  if (value === null || value === undefined || value === "") return { value: null };
  const number = typeof value === "number" ? value : Number(text(value));
  if (!Number.isInteger(number) || number < 1) return { value: null, error: "章节号要从 1 开始" };
  return { value: number };
}

function sameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function readPayload(input: MemoryInput, kind: MemoryKind, title: string): { payload?: MemoryPayload; error?: string } {
  const chapter = chapterNumber(input.chapter);
  if (chapter.error) return { error: `「${title}」的${chapter.error}` };
  const sourceChapter = chapterNumber(input.sourceChapter);
  if (sourceChapter.error) return { error: `「${title}」的原文${sourceChapter.error}` };
  const recovered = chapterNumber(input.recoveredChapter);
  if (recovered.error) return { error: `「${title}」的回收${recovered.error}` };
  return {
    payload: {
      kind,
      title,
      summary: text(input.summary),
      chapter: chapter.value,
      time: text(input.time),
      characters: strings(input.characters),
      place: text(input.place),
      impacts: strings(input.impacts),
      quote: text(input.quote),
      sourceChapter: sourceChapter.value,
      sourceNote: text(input.sourceNote),
      dependsOn: strings(input.dependsOn),
      recoveredChapter: recovered.value,
    },
  };
}

function payloadMatches(item: MemoryRecord, payload: MemoryPayload) {
  return (
    item.kind === payload.kind &&
    item.title === payload.title &&
    item.summary === payload.summary &&
    item.chapter === payload.chapter &&
    item.time === payload.time &&
    item.place === payload.place &&
    item.quote === payload.quote &&
    item.sourceChapter === payload.sourceChapter &&
    item.sourceNote === payload.sourceNote &&
    item.recoveredChapter === payload.recoveredChapter &&
    sameList(item.characters, payload.characters) &&
    sameList(item.impacts, payload.impacts) &&
    sameList(item.dependsOn, payload.dependsOn)
  );
}

function liveItems(state: MemoryState) {
  return state.items.filter((item) => !item.retired);
}

function findItem(state: MemoryState, id: string, kind: MemoryKind | null, title: string) {
  if (id) return state.items.find((item) => item.id === id) ?? null;
  return liveItems(state).find((item) => item.title === title && (kind === null || item.kind === kind)) ?? null;
}

function upsertChange(state: MemoryState, change: Omit<MemoryChange, "id">) {
  const existing = state.changes.find((item) => item.targetId === change.targetId);
  if (existing) {
    if (existing.action === "create" && change.action !== "retire") change.action = "create";
    existing.action = change.action;
    existing.kind = change.kind;
    existing.title = change.title;
    existing.note = change.note;
    existing.payload = change.payload;
    return existing;
  }
  const created: MemoryChange = { id: nextId("chg"), ...change };
  state.changes.push(created);
  return created;
}

function applyChange(state: MemoryState, change: MemoryChange) {
  let item = state.items.find((entry) => entry.id === change.targetId);
  if (change.action === "retire") {
    if (!item) return;
    item.retired = true;
    item.status = "confirmed";
    return;
  }
  if (!item) {
    item = { id: change.targetId, ...change.payload, status: "confirmed", retired: false };
    state.items.push(item);
    return;
  }
  Object.assign(item, change.payload);
  item.status = "confirmed";
  item.retired = false;
}

function overlay(state: MemoryState) {
  const next = structuredClone(state);
  for (const change of next.changes) applyChange(next, change);
  return next;
}

export function submitChanges(state: MemoryState, inputs: MemoryInput[]): Save & {
  created: { id: string; title: string }[];
  updated: { id: string; title: string }[];
  retired: { id: string; title: string }[];
  unchanged: string[];
  duplicates: string[];
  skipped: string[];
} {
  const created: { id: string; title: string }[] = [];
  const updated: { id: string; title: string }[] = [];
  const retired: { id: string; title: string }[] = [];
  const unchanged: string[] = [];
  const duplicates: string[] = [];
  const skipped: string[] = [];
  if (inputs.length === 0) {
    return { save: false, error: "请提供要提交的记忆", created, updated, retired, unchanged, duplicates, skipped };
  }
  for (const input of inputs) {
    const actionName = text(input.action) || "create";
    const action = actionAliases[actionName];
    if (!action) {
      skipped.push(`无法识别的操作：${actionName}`);
      continue;
    }
    const requestedKind = text(input.kind) ? kindAliases[text(input.kind)] : undefined;
    if (text(input.kind) && !requestedKind) {
      skipped.push(`「${text(input.title) || "未命名"}」的记忆类型无法识别`);
      continue;
    }
    if (action !== "retire" && !requestedKind) {
      skipped.push(`「${text(input.title) || "未命名"}」的记忆类型无法识别`);
      continue;
    }
    const located = findItem(state, text(input.id), requestedKind ?? null, text(input.title));
    const title = text(input.title) || located?.title || "";
    if (!title) {
      skipped.push("有一条记忆没有标题");
      continue;
    }
    if (action === "retire") {
      const item = located ?? findItem(state, text(input.id), requestedKind ?? null, title);
      if (!item) {
        skipped.push(`没有找到要撤下的「${title || text(input.id)}」`);
        continue;
      }
      if (item.retired) {
        skipped.push(`「${item.title}」已经撤下`);
        continue;
      }
      const change = upsertChange(state, {
        action: "retire",
        targetId: item.id,
        kind: item.kind,
        title: item.title,
        note: text(input.note) || "撤下这条记忆",
        payload: recordPayload(item),
      });
      retired.push({ id: change.id, title: item.title });
      continue;
    }
    if (!requestedKind) {
      skipped.push(`「${title}」的记忆类型无法识别`);
      continue;
    }
    const parsed = readPayload(input, requestedKind, title);
    if (!parsed.payload) {
      skipped.push(parsed.error ?? `「${title}」无法读取`);
      continue;
    }
    if (!parsed.payload.summary) {
      skipped.push(`「${title}」缺少说明`);
      continue;
    }
    let item = located ?? findItem(state, text(input.id), requestedKind, title);
    if (action === "create" && item) {
      duplicates.push(`「${title}」已有同名记忆，这次改为更新`);
    }
    if (!item && action === "update") {
      skipped.push(`没有找到要更新的「${title || text(input.id)}」`);
      continue;
    }
    if (!item) {
      item = { id: nextId("mem"), ...parsed.payload, status: "pending", retired: false };
      state.items.push(item);
      const change = upsertChange(state, {
        action: "create",
        targetId: item.id,
        kind: item.kind,
        title: item.title,
        note: text(input.note) || "新发现的记忆",
        payload: parsed.payload,
      });
      created.push({ id: change.id, title: item.title });
      continue;
    }
    if (payloadMatches(item, parsed.payload)) {
      unchanged.push(item.title);
      continue;
    }
    if (item.status === "pending") Object.assign(item, parsed.payload);
    const change = upsertChange(state, {
      action: item.status === "pending" ? "create" : "update",
      targetId: item.id,
      kind: parsed.payload.kind,
      title: parsed.payload.title,
      note: text(input.note) || "更新这条记忆",
      payload: parsed.payload,
    });
    updated.push({ id: change.id, title: parsed.payload.title });
  }
  const changed = created.length + updated.length + retired.length > 0;
  if (!changed) {
    const same = unchanged.length > 0 ? `「${unchanged.join("、")}」已经记过，内容没有变化` : "";
    return {
      save: false,
      error: skipped[0] || same || duplicates[0] || "没有需要写入的记忆",
      created,
      updated,
      retired,
      unchanged,
      duplicates,
      skipped,
    };
  }
  return { save: true, created, updated, retired, unchanged, duplicates, skipped };
}

function recordPayload(item: MemoryRecord): MemoryPayload {
  return {
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    chapter: item.chapter,
    time: item.time,
    characters: [...item.characters],
    place: item.place,
    impacts: [...item.impacts],
    quote: item.quote,
    sourceChapter: item.sourceChapter,
    sourceNote: item.sourceNote,
    dependsOn: [...item.dependsOn],
    recoveredChapter: item.recoveredChapter,
  };
}

function knownEventTitles(source: MemorySource, state: MemoryState) {
  const titles = new Set<string>();
  for (const event of activeEvents(source.plot)) titles.add(event.title);
  for (const item of state.items) {
    if (!item.retired && item.kind === "event") titles.add(item.title);
  }
  return titles;
}

function eventCycle(events: MemoryRecord[]) {
  const byTitle = new Map(events.map((event) => [event.title, event]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  function walk(title: string): boolean {
    if (done.has(title)) return false;
    if (visiting.has(title)) return true;
    visiting.add(title);
    const event = byTitle.get(title);
    for (const dependency of event?.dependsOn ?? []) {
      if (byTitle.has(dependency) && walk(dependency)) return true;
    }
    visiting.delete(title);
    done.add(title);
    return false;
  }
  return events.some((event) => walk(event.title));
}

export function validateChanges(source: MemorySource, tokens: string[] = []): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checked: number;
} {
  const requested = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
  const selected = requested.length
    ? source.memory.changes.filter((change) => requested.includes(change.id) || requested.includes(change.title))
    : source.memory.changes;
  if (requested.length > 0) {
    const found = new Set(selected.flatMap((change) => [change.id, change.title]));
    const missing = requested.filter((token) => !found.has(token));
    if (missing.length > 0) {
      return { ok: false, errors: [`这些修改不在待确认列表里：${missing.join("、")}`], warnings: [], checked: 0 };
    }
  }
  if (selected.length === 0) {
    return { ok: true, errors: [], warnings: [], checked: 0 };
  }
  const projected = overlay({ ...source.memory, changes: selected });
  const errors: string[] = [];
  const warnings: string[] = [];
  const names = new Set(source.characters.map((character) => character.name));
  const chapters = activeChapters(source.plot);
  const planned = plannedChapterCount(source.plot);
  const titles = knownEventTitles(source, projected);
  const active = projected.items.filter((item) => !item.retired);
  const touched = new Set(selected.map((change) => change.targetId));
  for (const item of active) {
    if (!touched.has(item.id)) continue;
    const twin = active.find((other) => other.id !== item.id && other.kind === item.kind && other.title === item.title);
    if (twin) errors.push(`「${item.title}」有重复的${kindLabel(item.kind)}`);
    if (!item.summary.trim()) errors.push(`「${item.title}」缺少说明`);
    if (item.chapter && planned > 0 && item.chapter > planned) {
      errors.push(`「${item.title}」的第${item.chapter}章超出大纲`);
    }
    cite(item, chapters, warnings, errors);
    for (const name of item.characters) {
      if (!names.has(name)) warnings.push(`「${item.title}」提到的「${name}」还不在人物档案里`);
    }
    if ((item.kind === "event" || item.kind === "state" || item.kind === "relation") && item.characters.length === 0) {
      warnings.push(`「${item.title}」没有写涉及的人物`);
    }
    if (item.kind === "clue" && item.recoveredChapter && item.chapter && item.recoveredChapter < item.chapter) {
      errors.push(`线索「${item.title}」的回收早于埋设`);
    }
    if (item.kind === "event") {
      for (const dependency of item.dependsOn) {
        if (!titles.has(dependency)) errors.push(`事件「${item.title}」依赖的「${dependency}」不存在`);
        const earlier = active.find((entry) => entry.kind === "event" && entry.title === dependency);
        const plotEarlier = activeEvents(source.plot).find((entry) => entry.title === dependency);
        const earlierChapter = earlier?.chapter ?? plotEarlier?.chapter ?? null;
        if (earlierChapter && item.chapter && item.chapter < earlierChapter) {
          errors.push(`事件「${item.title}」排在它所依赖的「${dependency}」之前`);
        }
      }
    }
  }
  if (eventCycle(active.filter((item) => item.kind === "event"))) errors.push("事件依赖形成了循环");
  const states = new Map<string, Set<string>>();
  for (const item of active.filter((entry) => entry.kind === "state")) {
    for (const name of item.characters) {
      const key = `${name}:${item.chapter ?? "未标明"}`;
      const notes = states.get(key) ?? new Set<string>();
      notes.add(item.summary);
      states.set(key, notes);
    }
  }
  for (const [key, notes] of states) {
    if (notes.size < 2) continue;
    const [name, at] = key.split(":");
    const touchedState = active.some(
      (item) => touched.has(item.id) && item.kind === "state" && item.characters.includes(name) && String(item.chapter ?? "未标明") === at,
    );
    if (!touchedState) continue;
    warnings.push(at === "未标明" ? `「${name}」有几条没标明章节的状态，说法不一致` : `「${name}」在第${at}章的状态说法不一致`);
  }
  return { ok: errors.length === 0, errors, warnings, checked: selected.length };
}

function cite(item: MemoryRecord, chapters: { number: number; summary: string }[], warnings: string[], errors: string[]) {
  if (item.sourceChapter === null) {
    warnings.push(item.quote ? `「${item.title}」写了原文，但没有标明章节` : `「${item.title}」缺少原文依据`);
    return;
  }
  const chapter = chapters.find((entry) => entry.number === item.sourceChapter);
  if (!chapter) {
    errors.push(`「${item.title}」引用的第${item.sourceChapter}章不在大纲里`);
    return;
  }
  if (!item.quote) {
    warnings.push(`「${item.title}」没有摘录原文`);
    return;
  }
  if (item.sourceNote.includes("正文") || item.sourceNote.includes("重提取")) return;
  const slice = item.quote.slice(0, 12);
  const summarySlice = chapter.summary.slice(0, 12);
  if (chapter.summary.includes(slice) || (summarySlice && item.quote.includes(summarySlice))) return;
  warnings.push(`「${item.title}」的原文没有出现在第${item.sourceChapter}章大纲里`);
}

function kindLabel(kind: MemoryKind) {
  if (kind === "event") return "事件";
  if (kind === "state") return "状态";
  if (kind === "clue") return "线索";
  if (kind === "relation") return "关系";
  if (kind === "fact") return "事实";
  return "章节记忆";
}

export function commitChanges(source: MemorySource, requested: string[]): Save & {
  committed?: string[];
  warnings?: string[];
} {
  const tokens = [...new Set(requested.map((item) => item.trim()).filter(Boolean))];
  if (tokens.length === 0) return { save: false, error: "请指定要确认的记忆" };
  const selected = source.memory.changes.filter((change) => tokens.includes(change.id) || tokens.includes(change.title));
  const found = new Set(selected.flatMap((change) => [change.id, change.title]));
  const missing = tokens.filter((token) => !found.has(token));
  if (missing.length > 0) return { save: false, error: `这些修改不在待确认列表里：${missing.join("、")}` };
  const report = validateChanges(source, tokens);
  if (!report.ok) return { save: false, error: report.errors.join(" ") };
  const state = source.memory;
  for (const change of selected) applyChange(state, change);
  const ids = new Set(selected.map((change) => change.id));
  state.changes = state.changes.filter((change) => !ids.has(change.id));
  const chapter = selected.map((change) => change.payload.chapter).find((value) => value !== null) ?? null;
  state.history.unshift({
    id: nextId("rev"),
    summary: selected.map((change) => change.title).join("、"),
    changeIds: selected.map((change) => change.id),
    chapter,
  });
  state.history = state.history.slice(0, 40);
  return { save: true, committed: selected.map((change) => change.title), warnings: report.warnings };
}

function sentences(value: string) {
  return value
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？])/))
    .map((line) => line.trim())
    .filter((line) => line.length >= 6)
    .slice(0, 12);
}

export function rebuildChapter(source: MemorySource, chapter: number, prose?: string): Save & {
  extracted: { id: string; action: string; kind: MemoryKind; title: string; summary: string }[];
  unchanged: string[];
  changeIds: string[];
  message: string;
} {
  if (!Number.isInteger(chapter) || chapter < 1) return { save: false, error: "章节号要从 1 开始", extracted: [], unchanged: [], changeIds: [], message: "" };
  const planned = plannedChapterCount(source.plot);
  const chapterPlan = activeChapters(source.plot).find((item) => item.number === chapter);
  if (planned > 0 && chapter > planned && !chapterPlan) {
    return { save: false, error: `第${chapter}章超出大纲`, extracted: [], unchanged: [], changeIds: [], message: "" };
  }
  if (!chapterPlan && prose === undefined) {
    return { save: false, error: "这一章还没有大纲，也没有正文可提取", extracted: [], unchanged: [], changeIds: [], message: "" };
  }
  const names = [...source.characters.map((character) => character.name)].sort((a, b) => b.length - a.length);
  const hooks = activeHooks(source.plot);
  const inputs: MemoryInput[] = [];
  if (chapterPlan && (chapterPlan.title || chapterPlan.summary)) {
    inputs.push({
      action: "create",
      kind: "chapter",
      title: `第${chapter}章 ${chapterPlan.title}`.trim(),
      summary: chapterPlan.summary || chapterPlan.title,
      chapter,
      quote: chapterPlan.summary,
      sourceChapter: chapter,
      sourceNote: `第${chapter}章大纲`,
      characters: names.filter((name) => `${chapterPlan.title}${chapterPlan.summary}`.includes(name)).slice(0, 6),
      note: "按章节大纲重新核对",
    });
  }
  if (prose !== undefined) {
    const lines = sentences(prose);
    const picked = lines.filter((line) => names.some((name) => line.includes(name)) || hooks.some((hook) => line.includes(hook.title)));
    const chosen = picked.length > 0 ? picked : lines.slice(0, 3);
    const used = new Set<string>();
    for (const line of chosen) {
      const mentioned = names.filter((name) => line.includes(name)).slice(0, 4);
      const hook = hooks.find((item) => line.includes(item.title));
      let kind: MemoryKind = "event";
      if (hook && /揭开|回收|真相|原来|对上/.test(line)) kind = "clue";
      else if (mentioned.length >= 2 && /关系|信任|决裂|答应|姐妹|敌/.test(line)) kind = "relation";
      else if (/知道|发现|记得|看见|听说/.test(line)) kind = "fact";
      else if (/修为|境界|成为|决定|失踪|受伤|突破/.test(line)) kind = "state";
      else if (mentioned.length === 0 && !hook) continue;
      const base = hook?.title || (mentioned[0] ? `${mentioned[0]}·第${chapter}章` : `第${chapter}章细节`);
      let title = base;
      let index = 2;
      while (used.has(`${kind}:${title}`)) {
        title = `${base}·${index}`;
        index += 1;
      }
      used.add(`${kind}:${title}`);
      const recovered = kind === "clue" && /回收|揭开|真相/.test(line);
      inputs.push({
        action: "create",
        kind,
        title,
        summary: line,
        chapter: kind === "clue" ? hook?.plantedChapter ?? chapter : chapter,
        time: "",
        characters: mentioned,
        place: "",
        impacts: [],
        quote: line,
        sourceChapter: chapter,
        sourceNote: `第${chapter}章正文`,
        dependsOn: [],
        recoveredChapter: recovered ? chapter : null,
        note: "从修改后的正文重新提取",
      });
    }
    const owned = liveItems(source.memory).filter((item) => item.sourceNote === `第${chapter}章正文`);
    const freshQuotes = new Set(inputs.map((input) => text(input.quote)));
    const freshTitles = new Set(inputs.map((input) => `${text(input.kind)}:${text(input.title)}`));
    for (const item of owned) {
      if (freshQuotes.has(item.quote) || freshTitles.has(`${item.kind}:${item.title}`)) continue;
      inputs.push({ action: "retire", id: item.id, title: item.title, note: "正文修改后，这条提取已对不上" });
    }
  }
  if (inputs.length === 0) {
    return { save: false, error: "这一章没有提取出新的记忆", extracted: [], unchanged: [], changeIds: [], message: "" };
  }
  const result = submitChanges(source.memory, inputs);
  const extracted = [...result.created, ...result.updated, ...result.retired].map((item) => {
    const change = source.memory.changes.find((entry) => entry.id === item.id);
    return {
      id: item.id,
      action: change?.action ?? "update",
      kind: change?.kind ?? "chapter",
      title: item.title,
      summary: change?.payload.summary ?? "",
    };
  });
  return {
    save: result.save,
    error: result.error,
    extracted,
    unchanged: result.unchanged,
    changeIds: extracted.map((item) => item.id),
    message: result.save ? "已按这一章重新提取，确认前不会改已经记下的记忆。" : result.error || "这一章的记忆没有变化。",
  };
}

export type MemoryHit = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  chapter: number | null;
  time: string;
  characters: string[];
  quote: string;
  source: "memory" | "plot" | "character";
  pending: boolean;
};

export type MemoryQuery = {
  query?: string;
  character?: string;
  event?: string;
  time?: string;
  kind?: string;
  chapter?: number | null;
};

function chapterPlan(plot: PlotState, number: number) {
  return activeChapters(plot).find((chapter) => chapter.number === number) ?? null;
}

function volumeTitle(plot: PlotState, number: number) {
  const range = volumeRanges(plot.volumes).find((item) => number >= item.start && number <= item.end);
  return range?.volume.title ?? "";
}

export function searchMemory(source: MemorySource, query: MemoryQuery, limit = 30): { total: number; hits: MemoryHit[] } {
  const hits = corpus(source);
  const keyword = query.query?.trim() ?? "";
  const character = query.character?.trim() ?? "";
  const event = query.event?.trim() ?? "";
  const time = query.time?.trim() ?? "";
  const kind = query.kind?.trim() ?? "";
  const matched = hits
    .filter((hit) => {
      if (keyword && !blob(hit).includes(keyword)) return false;
      if (character && !hit.characters.includes(character) && hit.title !== character && !hit.summary.includes(character)) return false;
      if (event && hit.kind !== "event" && hit.kind !== "关键事件") return false;
      if (event && !`${hit.title}${hit.summary}`.includes(event)) return false;
      if (time && !`${hit.time}${hit.summary}${hit.title}`.includes(time)) return false;
      if (kind && !kindMatches(kind, hit)) return false;
      if (query.chapter != null && hit.chapter !== query.chapter) {
        if (!(kind === "人物" && hit.kind === "人物" && character && hit.title === character)) return false;
      }
      return true;
    });
  return { total: matched.length, hits: matched.slice(0, limit) };
}

function blob(hit: MemoryHit) {
  return `${hit.title}${hit.summary}${hit.quote}${hit.time}${hit.characters.join("")}`;
}

function kindMatches(kind: string, hit: MemoryHit) {
  const alias = kindAliases[kind];
  if (alias === "event") return hit.kind === "event" || hit.kind === "关键事件";
  if (alias === "state") return hit.kind === "state" || hit.kind === "人物";
  if (alias === "clue") return hit.kind === "clue" || hit.kind === "线索";
  if (alias === "relation") return hit.kind === "relation" || hit.kind === "关系";
  if (alias === "fact") return hit.kind === "fact" || hit.kind === "事实";
  if (alias === "chapter") return hit.kind === "chapter" || hit.kind === "章节";
  if (kind === "人物") return hit.kind === "人物" || hit.kind === "state";
  return hit.kind === kind;
}

function corpus(source: MemorySource): MemoryHit[] {
  const hits: MemoryHit[] = [];
  for (const item of liveItems(source.memory)) {
    hits.push({
      id: item.id,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      chapter: item.chapter,
      time: item.time,
      characters: item.characters,
      quote: item.quote,
      source: "memory",
      pending: item.status === "pending" || source.memory.changes.some((change) => change.targetId === item.id),
    });
  }
  for (const character of source.characters) {
    hits.push({
      id: `person:${character.name}`,
      kind: "人物",
      title: character.name,
      summary: character.summary,
      chapter: character.knowledge.find((fact) => fact.sinceChapter)?.sinceChapter ?? null,
      time: character.realm,
      characters: [character.name],
      quote: "",
      source: "character",
      pending: character.status === "pending",
    });
    for (const fact of character.knowledge) {
      hits.push({
        id: `knowledge:${character.name}:${fact.id}`,
        kind: "fact",
        title: `${character.name}所知`,
        summary: fact.fact,
        chapter: fact.sinceChapter,
        time: "",
        characters: [character.name],
        quote: fact.fact,
        source: "character",
        pending: fact.pending,
      });
    }
    for (const growth of character.growth) {
      hits.push({
        id: `growth:${character.name}:${growth.id}`,
        kind: "state",
        title: growth.realm || `${character.name}的变化`,
        summary: growth.note,
        chapter: growth.chapter,
        time: growth.realm,
        characters: [character.name],
        quote: growth.note,
        source: "character",
        pending: growth.pending,
      });
    }
    for (const relation of character.relations) {
      hits.push({
        id: `relation:${character.name}:${relation.targetName}`,
        kind: "relation",
        title: `${character.name}与${relation.targetName}`,
        summary: relation.summary,
        chapter: null,
        time: "",
        characters: [character.name, relation.targetName],
        quote: "",
        source: "character",
        pending: relation.pending,
      });
    }
  }
  for (const event of activeEvents(source.plot)) {
    hits.push({
      id: `plot-event:${event.id}`,
      kind: "event",
      title: event.title,
      summary: event.summary,
      chapter: event.chapter,
      time: event.time,
      characters: namesIn(event.summary, source.characters),
      quote: event.summary,
      source: "plot",
      pending: event.itemStatus === "pending",
    });
  }
  for (const hook of activeHooks(source.plot)) {
    hits.push({
      id: `hook:${hook.id}`,
      kind: "clue",
      title: hook.title,
      summary: hook.summary,
      chapter: hook.plantedChapter,
      time: hook.recoveredChapter ? "已回收" : "未回收",
      characters: namesIn(`${hook.title}${hook.summary}`, source.characters),
      quote: hook.summary,
      source: "plot",
      pending: hook.itemStatus === "pending",
    });
  }
  for (const line of activeLines(source.plot)) {
    hits.push({
      id: `line:${line.id}`,
      kind: "线索",
      title: line.title,
      summary: line.summary,
      chapter: null,
      time: line.kind === "mainline" ? "主线" : line.kind === "branch" ? "支线" : "成长",
      characters: line.characterName ? [line.characterName] : namesIn(line.summary, source.characters),
      quote: "",
      source: "plot",
      pending: line.itemStatus === "pending",
    });
  }
  for (const chapter of activeChapters(source.plot)) {
    hits.push({
      id: `chapter:${chapter.number}`,
      kind: "chapter",
      title: `第${chapter.number}章 ${chapter.title}`,
      summary: chapter.summary,
      chapter: chapter.number,
      time: volumeTitle(source.plot, chapter.number),
      characters: namesIn(`${chapter.title}${chapter.summary}`, source.characters),
      quote: chapter.summary,
      source: "plot",
      pending: chapter.itemStatus === "pending",
    });
  }
  return hits;
}

function namesIn(value: string, characters: Character[]) {
  return [...characters.map((character) => character.name)]
    .sort((left, right) => right.length - left.length)
    .filter((name) => name && value.includes(name))
    .slice(0, 6);
}

export function memoryDetail(source: MemorySource, id: string, title: string) {
  const hits = corpus(source);
  if (id) {
    const stored = source.memory.items.find((item) => item.id === id);
    const hit = hits.find((item) => item.id === id);
    if (!stored && !hit) return { error: `没有这条记忆：${id}` };
    return { detail: describe(source, stored ?? null, hit ?? null) };
  }
  const name = title.trim();
  if (!name) return { error: "请提供记忆 id 或标题" };
  const storedMatches = source.memory.items.filter((item) => item.title === name);
  const hitMatches = hits.filter((item) => item.title === name);
  const ids = new Set<string>();
  const matches = [...storedMatches.map((item) => item.id), ...hitMatches.map((item) => item.id)].filter((item) => {
    if (ids.has(item)) return false;
    ids.add(item);
    return true;
  });
  if (matches.length === 0) return { error: `没有找到「${name}」` };
  if (matches.length > 1) {
    return {
      ambiguous: true,
      matches: matches.slice(0, 12).map((item) => {
        const hit = hits.find((entry) => entry.id === item);
        return { id: item, title: hit?.title ?? name, kind: hit?.kind ?? "", chapter: hit?.chapter ?? null, summary: hit?.summary ?? "" };
      }),
    };
  }
  const matchId = matches[0];
  const stored = source.memory.items.find((item) => item.id === matchId) ?? null;
  const hit = hits.find((item) => item.id === matchId) ?? null;
  return { detail: describe(source, stored, hit) };
}

function describe(source: MemorySource, stored: MemoryRecord | null, hit: MemoryHit | null) {
  const chapterNumber = stored?.sourceChapter ?? stored?.chapter ?? hit?.chapter ?? null;
  const chapter = chapterNumber ? chapterPlan(source.plot, chapterNumber) : null;
  const quote = stored?.quote || hit?.quote || "";
  const fromProse = (stored?.sourceNote ?? "").includes("正文");
  let citation = "这条记忆来自已确认的记录";
  if (hit?.source === "plot" && hit.kind === "chapter") citation = "这条记忆来自章节大纲";
  else if (hit?.source === "character") citation = "这条记忆来自人物档案";
  else if (hit?.source === "plot") citation = "这条记忆来自剧情大纲";
  else if (!stored?.sourceChapter) citation = quote ? "写了原文，但没有标明章节" : "缺少原文依据";
  else if (!chapter) citation = `引用的第${stored.sourceChapter}章不在大纲里`;
  else if (fromProse) citation = `原文摘自第${chapter.number}章正文`;
  else if (quote && chapter.summary.includes(quote.slice(0, 12))) citation = `原文能在第${chapter.number}章大纲里对上`;
  else citation = `原文没有出现在第${chapter.number}章大纲里`;
  const change = stored ? source.memory.changes.find((item) => item.targetId === stored.id) ?? null : null;
  const characters = stored?.characters ?? hit?.characters ?? [];
  const related = corpus(source)
    .filter((item) => item.id !== (stored?.id ?? hit?.id) && characters.some((name) => item.characters.includes(name) || item.title === name))
    .slice(0, 5)
    .map((item) => ({ id: item.id, title: item.title, kind: item.kind, chapter: item.chapter }));
  return {
    id: stored?.id ?? hit?.id ?? "",
    kind: stored?.kind ?? hit?.kind ?? "",
    title: stored?.title ?? hit?.title ?? "",
    summary: stored?.summary ?? hit?.summary ?? "",
    chapter: stored?.chapter ?? hit?.chapter ?? null,
    time: stored?.time ?? hit?.time ?? "",
    place: stored?.place ?? "",
    characters,
    impacts: stored?.impacts ?? [],
    dependsOn: stored?.dependsOn ?? [],
    recoveredChapter: stored?.recoveredChapter ?? null,
    status: stored?.status ?? (hit?.pending ? "pending" : "confirmed"),
    retired: stored?.retired ?? false,
    pendingChange: change ? { id: change.id, action: change.action, title: change.title, note: change.note } : null,
    evidence: {
      quote,
      sourceChapter: stored?.sourceChapter ?? chapter?.number ?? null,
      sourceNote: stored?.sourceNote || citation,
      chapterTitle: chapter ? `第${chapter.number}章 ${chapter.title}` : "",
      chapterSummary: chapter?.summary ?? "",
      citation,
    },
    related,
  };
}

export function memoryContext(source: MemorySource, chapter: number) {
  const plan = chapterPlan(source.plot, chapter);
  const previous = chapterPlan(source.plot, chapter - 1);
  const range = volumeRanges(source.plot.volumes).find((item) => chapter >= item.start && chapter <= item.end);
  const names = [...source.characters.map((character) => character.name)].sort((left, right) => right.length - left.length);
  const mentioned = new Set<string>();
  for (const value of [plan?.title, plan?.summary, previous?.title, previous?.summary]) {
    if (!value) continue;
    for (const name of names) if (value.includes(name)) mentioned.add(name);
  }
  for (const character of source.characters) {
    if (character.role === "protagonist" || character.role === "heroine") mentioned.add(character.name);
  }
  const chosen = source.characters.filter((character) => mentioned.has(character.name)).slice(0, 8);
  const confirmed = liveItems(source.memory).filter((item) => item.status === "confirmed");
  const before = (item: { chapter: number | null }) => item.chapter === null || item.chapter < chapter;
  const recentEvents = [
    ...confirmed.filter((item) => item.kind === "event" && before(item)).map((item) => eventBrief(item.title, item.summary, item.chapter, item.characters)),
    ...activeEvents(source.plot)
      .filter((event) => event.chapter === null || event.chapter < chapter)
      .map((event) => eventBrief(event.title, event.summary, event.chapter, namesIn(event.summary, source.characters))),
  ]
    .filter((event, index, list) => list.findIndex((item) => item.title === event.title) === index)
    .sort((left, right) => (right.chapter ?? 0) - (left.chapter ?? 0))
    .slice(0, 8);
  const openClues = [
    ...confirmed
      .filter((item) => item.kind === "clue" && (item.recoveredChapter === null || item.recoveredChapter >= chapter) && before(item))
      .map((item) => ({ title: item.title, summary: item.summary, plantedChapter: item.chapter, recoveredChapter: item.recoveredChapter })),
    ...activeHooks(source.plot)
      .filter((hook) => (hook.recoveredChapter === null || hook.recoveredChapter >= chapter) && (hook.plantedChapter === null || hook.plantedChapter < chapter))
      .map((hook) => ({ title: hook.title, summary: hook.summary, plantedChapter: hook.plantedChapter, recoveredChapter: hook.recoveredChapter })),
  ]
    .filter((clue, index, list) => list.findIndex((item) => item.title === clue.title) === index)
    .slice(0, 10);
  return {
    novelTitle: source.novelTitle,
    chapter,
    outline: plan
      ? { title: plan.title, summary: plan.summary, volume: range?.volume.title ?? "", status: plan.status }
      : null,
    previousChapter: previous ? { number: previous.number, title: previous.title, summary: previous.summary } : null,
    carry: {
      recentEvents,
      openClues,
      people: chosen.map((character) => ({
        name: character.name,
        role: roleLabels[character.role],
        realm: character.realm,
        identity: character.identity,
        knowledge: character.knowledge
          .filter((fact) => !fact.pending && (fact.sinceChapter === null || fact.sinceChapter <= chapter))
          .map((fact) => fact.fact),
        growth: character.growth
          .filter((growth) => !growth.pending && (growth.chapter === null || growth.chapter <= chapter))
          .slice(-3)
          .map((growth) => ({ chapter: growth.chapter, realm: growth.realm, note: growth.note })),
        relations: character.relations.filter((relation) => !relation.pending).map((relation) => ({ name: relation.targetName, summary: relation.summary })),
        states: confirmed
          .filter((item) => item.kind === "state" && item.characters.includes(character.name) && before(item))
          .sort((left, right) => (right.chapter ?? 0) - (left.chapter ?? 0))
          .slice(0, 3)
          .map((item) => ({ chapter: item.chapter, title: item.title, summary: item.summary })),
      })),
      plotlines: activeLines(source.plot).slice(0, 8).map((line) => ({
        kind: line.kind,
        title: line.title,
        summary: line.summary,
        characterName: line.characterName,
      })),
    },
    pending: source.memory.changes.map((change) => ({
      id: change.id,
      action: change.action,
      title: change.title,
      note: change.note,
    })),
    note: "已确认的记忆可以当作已经发生的事。待确认的修改还不能写进正文。不要写过这一章大纲还没发生的事。",
  };
}

function eventBrief(title: string, summary: string, chapter: number | null, characters: string[]) {
  return { title, summary, chapter, characters };
}

export function ensureMemory(state: MemoryState) {
  let dirty = false;
  const base = emptyMemory();
  for (const key of ["items", "changes", "history", "extracts"] as const) {
    if (!Array.isArray(state[key])) {
      state[key] = base[key] as never;
      dirty = true;
    }
  }
  for (const item of state.items) {
    if (!isMemoryKind(item.kind)) {
      item.kind = "event";
      dirty = true;
    }
    if (item.status !== "pending" && item.status !== "confirmed") {
      item.status = "confirmed";
      dirty = true;
    }
    if (!Array.isArray(item.characters)) {
      item.characters = [];
      dirty = true;
    }
    if (!Array.isArray(item.impacts)) {
      item.impacts = [];
      dirty = true;
    }
    if (!Array.isArray(item.dependsOn)) {
      item.dependsOn = [];
      dirty = true;
    }
    if (item.recoveredChapter === undefined) {
      item.recoveredChapter = null;
      dirty = true;
    }
    for (const key of ["summary", "time", "place", "quote", "sourceNote", "title"] as const) {
      if (typeof item[key] !== "string") {
        item[key] = "";
        dirty = true;
      }
    }
  }
  return dirty;
}
