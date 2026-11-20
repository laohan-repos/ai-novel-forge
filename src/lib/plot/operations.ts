import type {
  ChapterPlan,
  ChapterStatus,
  Foreshadowing,
  PlotAction,
  PlotChange,
  PlotEvent,
  Plotline,
  PlotlineKind,
  PlotState,
  PlotTarget,
  VolumePlan,
  VolumeStatus,
} from "./model";

export type PlotIssue = { level: "error" | "warning"; message: string };

type Save = { save: boolean; error?: string };

let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

export function activeVolumes(plot: PlotState) {
  return plot.volumes.filter((volume) => !volume.retired);
}

export function activeChapters(plot: PlotState) {
  return plot.chapters.filter((chapter) => !chapter.retired);
}

export function activeLines(plot: PlotState, kind?: PlotlineKind) {
  return plot.plotlines.filter((line) => !line.retired && (kind ? line.kind === kind : true));
}

export function activeHooks(plot: PlotState) {
  return plot.foreshadowing.filter((hook) => !hook.retired);
}

export function activeEvents(plot: PlotState) {
  return plot.events.filter((event) => !event.retired);
}

export function volumeRanges(volumes: VolumePlan[]) {
  let start = 1;
  return volumes.filter((volume) => !volume.retired).map((volume) => {
    const range = { volume, start, end: start + Math.max(volume.total, 1) - 1 };
    start = range.end + 1;
    return range;
  });
}

export function plannedChapterCount(plot: PlotState) {
  const fromVolumes = activeVolumes(plot).reduce((sum, volume) => sum + volume.total, 0);
  const fromChapters = activeChapters(plot).reduce((max, chapter) => Math.max(max, chapter.number), 0);
  return Math.max(fromVolumes, fromChapters);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function chapterNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

function upsertChange(plot: PlotState, change: Omit<PlotChange, "id">) {
  const existing = plot.changes.find((item) => item.target === change.target && item.targetId === change.targetId);
  if (existing) {
    if (existing.action === "create") change.action = "create";
    existing.action = change.action;
    existing.title = change.title;
    existing.note = change.note;
    existing.payload = change.payload;
    return existing;
  }
  const created: PlotChange = { id: nextId("chg"), ...change };
  plot.changes.push(created);
  return created;
}

function putDraft<T extends { id: string; itemStatus: "pending" | "confirmed"; title: string }>(
  plot: PlotState,
  target: PlotTarget,
  item: T,
  payload: Record<string, unknown>,
  note: string,
  action: PlotAction,
) {
  if (item.itemStatus === "pending") {
    return upsertChange(plot, { target, targetId: item.id, action: "create", title: item.title, note, payload });
  }
  return upsertChange(plot, { target, targetId: item.id, action, title: item.title, note, payload });
}

export function saveStoryOutline(
  plot: PlotState,
  input: { summary?: unknown; promise?: unknown; ending?: unknown },
): Save & { changeId?: string; mode?: "created" | "updated" | "unchanged" } {
  const summary = text(input.summary);
  if (!summary) return { save: false, error: "总纲不能为空" };
  const promise = text(input.promise);
  const ending = text(input.ending);
  const next = {
    summary,
    promise: promise || plot.story.promise,
    ending: ending || plot.story.ending,
  };
  if (
    plot.story.status === "confirmed" &&
    plot.story.summary &&
    next.summary === plot.story.summary &&
    next.promise === plot.story.promise &&
    next.ending === plot.story.ending &&
    !plot.changes.some((change) => change.target === "story")
  ) {
    return { save: false, mode: "unchanged" };
  }
  const creating = plot.story.status === "pending" || !plot.story.summary;
  if (creating) {
    plot.story.summary = next.summary;
    plot.story.promise = next.promise;
    plot.story.ending = next.ending;
    plot.story.status = "pending";
  }
  const change = putDraft(plot, "story", { id: "story", itemStatus: plot.story.status, title: "全书总纲" }, next, "修订全书总纲", "update");
  return { save: true, changeId: change.id, mode: creating || plot.story.status === "pending" ? "created" : "updated" };
}

export type VolumeInput = {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  total?: unknown;
  status?: unknown;
  mainline?: unknown;
  beats?: unknown;
};

function readBeats(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []));
}

export function saveVolumeOutline(plot: PlotState, inputs: VolumeInput[]): Save & {
  created: string[];
  updated: string[];
  conflicts: string[];
} {
  if (inputs.length === 0) return { save: false, error: "请提供分卷", created: [], updated: [], conflicts: [] };
  const created: string[] = [];
  const updated: string[] = [];
  const conflicts: string[] = [];
  for (const input of inputs) {
    const title = text(input.title);
    if (!title) {
      conflicts.push("有一卷没有标题");
      continue;
    }
    const total = input.total === undefined ? null : chapterNumber(input.total);
    if (input.total !== undefined && total === null) {
      conflicts.push(`「${title}」的章节数需要是正整数`);
      continue;
    }
    const status = text(input.status);
    if (status && status !== "done" && status !== "active" && status !== "pending") {
      conflicts.push(`「${title}」的状态无法识别`);
      continue;
    }
    const payload: Record<string, unknown> = {
      title,
      summary: text(input.summary),
      mainline: text(input.mainline) || text(input.summary),
      beats: readBeats(input.beats),
    };
    if (total !== null) payload.total = total;
    if (status) payload.status = status;
    const id = text(input.id);
    const current =
      activeVolumes(plot).find((volume) => (id && volume.id === id) || volume.title === title) ?? null;
    if (!current) {
      const volume: VolumePlan = {
        id: nextId("vol"),
        title,
        summary: String(payload.summary),
        status: (status || "pending") as VolumeStatus,
        written: 0,
        total: total ?? 40,
        mainline: String(payload.mainline),
        beats: payload.beats as string[],
        itemStatus: "pending",
        retired: false,
      };
      plot.volumes.push(volume);
      upsertChange(plot, {
        target: "volume",
        targetId: volume.id,
        action: "create",
        title,
        note: "新增分卷",
        payload,
      });
      created.push(title);
      continue;
    }
    if (current.itemStatus === "pending") {
      current.title = title;
      current.summary = String(payload.summary);
      current.mainline = String(payload.mainline);
      current.beats = payload.beats as string[];
      if (total !== null) current.total = total;
      if (status) current.status = status as VolumeStatus;
    }
    putDraft(plot, "volume", current, payload, "修订分卷", "update");
    updated.push(title);
  }
  return { save: created.length + updated.length > 0, created, updated, conflicts };
}

export type ChapterInput = {
  number?: unknown;
  title?: unknown;
  summary?: unknown;
  status?: unknown;
};

export function saveChapterOutlines(plot: PlotState, inputs: ChapterInput[]): Save & {
  created: string[];
  updated: string[];
  conflicts: string[];
} {
  if (inputs.length === 0) return { save: false, error: "请提供章节大纲", created: [], updated: [], conflicts: [] };
  const created: string[] = [];
  const updated: string[] = [];
  const conflicts: string[] = [];
  for (const input of inputs) {
    const number = chapterNumber(input.number);
    const title = text(input.title);
    const summary = text(input.summary);
    if (number === null || !title || !summary) {
      conflicts.push(title ? `「${title}」缺少章节号或说明` : "有一章缺少章节号、标题或说明");
      continue;
    }
    const status = text(input.status);
    if (status && status !== "planned" && status !== "done") {
      conflicts.push(`第${number}章的状态无法识别`);
      continue;
    }
    const payload: Record<string, unknown> = { number, title, summary };
    if (status) payload.status = status;
    const current = activeChapters(plot).find((chapter) => chapter.number === number) ?? null;
    if (!current) {
      const chapter: ChapterPlan = {
        id: nextId("ch"),
        number,
        title,
        summary,
        status: (status || "planned") as ChapterStatus,
        itemStatus: "pending",
        retired: false,
      };
      plot.chapters.push(chapter);
      upsertChange(plot, {
        target: "chapter",
        targetId: chapter.id,
        action: "create",
        title: `第${number}章 ${title}`,
        note: "新增章节大纲",
        payload,
      });
      created.push(`第${number}章`);
      continue;
    }
    if (current.itemStatus === "pending") {
      current.title = title;
      current.summary = summary;
      if (status) current.status = status as ChapterStatus;
    }
    putDraft(plot, "chapter", current, payload, "修订章节大纲", "update");
    updated.push(`第${number}章`);
  }
  return { save: created.length + updated.length > 0, created, updated, conflicts };
}

export function managePlotline(
  plot: PlotState,
  input: { action?: unknown; kind?: unknown; title?: unknown; summary?: unknown; characterName?: unknown },
): Save & { changeId?: string } {
  const action = text(input.action);
  const title = text(input.title);
  const summary = text(input.summary);
  const kind = text(input.kind);
  const characterName = text(input.characterName);
  if (!title) return { save: false, error: "剧情线需要标题" };
  if (action !== "create" && action !== "update" && action !== "retire") {
    return { save: false, error: "请指定创建、修改或结束这条剧情线" };
  }
  const current =
    activeLines(plot).find((line) => line.title === title && (!kind || line.kind === kind)) ?? null;
  if (action === "create") {
    if (kind !== "mainline" && kind !== "branch" && kind !== "growth") {
      return { save: false, error: "剧情线需要标明主线、支线或人物成长线" };
    }
    if (kind === "growth" && !characterName) return { save: false, error: "人物成长线需要写明是谁" };
    if (current?.itemStatus === "confirmed") return { save: false, error: `「${title}」已经在大纲里，请改用修改` };
    if (current) {
      current.summary = summary || current.summary;
      current.characterName = characterName || current.characterName;
      const change = putDraft(
        plot,
        "plotline",
        current,
        { title, summary: current.summary, characterName: current.characterName, kind: current.kind },
        "修订剧情线",
        "update",
      );
      return { save: true, changeId: change.id };
    }
    const line: Plotline = {
      id: nextId(kind === "mainline" ? "m" : kind === "branch" ? "b" : "g"),
      kind,
      title,
      summary: summary || "尚未填写说明。",
      characterName,
      itemStatus: "pending",
      retired: false,
    };
    plot.plotlines.push(line);
    const change = upsertChange(plot, {
      target: "plotline",
      targetId: line.id,
      action: "create",
      title,
      note: "新增剧情线",
      payload: { title, summary: line.summary, characterName, kind },
    });
    return { save: true, changeId: change.id };
  }
  if (!current) return { save: false, error: `大纲里没有「${title}」` };
  if (action === "retire" && current.itemStatus === "pending") {
    plot.plotlines = plot.plotlines.filter((line) => line.id !== current.id);
    plot.changes = plot.changes.filter((change) => change.targetId !== current.id);
    return { save: true };
  }
  if (action === "retire") {
    const change = putDraft(plot, "plotline", current, { retired: true }, "结束这条剧情线", "retire");
    return { save: true, changeId: change.id };
  }
  if (current.itemStatus === "pending") {
    if (summary) current.summary = summary;
    if (characterName) current.characterName = characterName;
  }
  const change = putDraft(
    plot,
    "plotline",
    current,
    {
      title,
      summary: summary || current.summary,
      characterName: characterName || current.characterName,
      kind: current.kind,
    },
    "修订剧情线",
    "update",
  );
  return { save: true, changeId: change.id };
}

export function manageForeshadowing(
  plot: PlotState,
  input: { action?: unknown; title?: unknown; summary?: unknown; chapter?: unknown },
): Save & { changeId?: string } {
  const action = text(input.action);
  const title = text(input.title);
  const summary = text(input.summary);
  if (!title) return { save: false, error: "伏笔需要标题" };
  if (action !== "plant" && action !== "plan" && action !== "recover" && action !== "update") {
    return { save: false, error: "请指定埋设、计划回收、实际回收或修改" };
  }
  const chapterProvided = input.chapter !== undefined && input.chapter !== null;
  const chapter = chapterProvided ? chapterNumber(input.chapter) : null;
  if (chapterProvided && chapter === null) return { save: false, error: "章节号需要是正整数" };
  if ((action === "plan" || action === "recover") && chapter === null) return { save: false, error: "请提供章节号" };
  let current = activeHooks(plot).find((hook) => hook.title === title) ?? null;
  if (action === "plant" && !current) {
    if (!summary) return { save: false, error: "新伏笔需要说明" };
    const hook: Foreshadowing = {
      id: nextId("h"),
      title,
      summary,
      plantedChapter: chapter,
      plannedChapter: null,
      recoveredChapter: null,
      itemStatus: "pending",
      retired: false,
    };
    plot.foreshadowing.push(hook);
    const change = upsertChange(plot, {
      target: "foreshadowing",
      targetId: hook.id,
      action: "create",
      title,
      note: chapter ? `埋在第${chapter}章` : "新增伏笔",
      payload: { title, summary, plantedChapter: chapter },
    });
    return { save: true, changeId: change.id };
  }
  if (!current) return { save: false, error: `大纲里没有伏笔「${title}」` };
  const payload: Record<string, unknown> = { title, summary: summary || current.summary };
  let note = "修订伏笔";
  let plotAction: PlotAction = "update";
  if (action === "plant") {
    payload.plantedChapter = chapter;
    note = chapter ? `埋在第${chapter}章` : "调整埋设";
  }
  if (action === "plan") {
    payload.plannedChapter = chapter;
    note = chapter ? `计划在第${chapter}章回收` : "取消计划回收";
  }
  if (action === "recover") {
    payload.recoveredChapter = chapter;
    note = chapter ? `在第${chapter}章回收` : "取消实际回收";
    plotAction = "recover";
  }
  if (current.itemStatus === "pending") {
    if (summary) current.summary = summary;
    if ("plantedChapter" in payload) current.plantedChapter = payload.plantedChapter as number | null;
    if ("plannedChapter" in payload) current.plannedChapter = payload.plannedChapter as number | null;
    if ("recoveredChapter" in payload) current.recoveredChapter = payload.recoveredChapter as number | null;
  }
  const change = putDraft(plot, "foreshadowing", current, payload, note, plotAction);
  return { save: true, changeId: change.id };
}

function eventCycle(events: PlotEvent[]) {
  const byTitle = new Map(events.map((event) => [event.title, event]));
  const state = new Map<string, number>();
  function visit(title: string): boolean {
    const mark = state.get(title) ?? 0;
    if (mark === 1) return true;
    if (mark === 2) return false;
    state.set(title, 1);
    for (const dependency of byTitle.get(title)?.dependsOn ?? []) {
      if (visit(dependency)) return true;
    }
    state.set(title, 2);
    return false;
  }
  return events.some((event) => visit(event.title));
}

export function managePlotEvent(
  plot: PlotState,
  input: { action?: unknown; title?: unknown; summary?: unknown; chapter?: unknown; time?: unknown; dependsOn?: unknown },
): Save & { changeId?: string } {
  const action = text(input.action);
  const title = text(input.title);
  const summary = text(input.summary);
  const time = text(input.time);
  if (!title) return { save: false, error: "事件需要标题" };
  if (action !== "create" && action !== "update" && action !== "remove") {
    return { save: false, error: "请指定创建、修改或移除事件" };
  }
  const chapter = input.chapter === undefined ? null : chapterNumber(input.chapter);
  if (input.chapter !== undefined && input.chapter !== null && chapter === null) {
    return { save: false, error: "事件章节需要是正整数" };
  }
  const current = activeEvents(plot).find((event) => event.title === title) ?? null;
  const dependsOn = Array.isArray(input.dependsOn)
    ? [...new Set(input.dependsOn.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : [])))]
    : current?.dependsOn ?? [];
  if (action === "remove") {
    if (!current) return { save: false, error: `大纲里没有事件「${title}」` };
    if (current.itemStatus === "pending") {
      plot.events = plot.events.filter((event) => event.id !== current.id);
      plot.changes = plot.changes.filter((change) => change.targetId !== current.id);
      return { save: true };
    }
    const change = putDraft(plot, "event", current, { retired: true }, "移除事件", "retire");
    return { save: true, changeId: change.id };
  }
  const known = new Set(activeEvents(plot).filter((event) => event.id !== current?.id).map((event) => event.title));
  const missing = dependsOn.filter((name) => name !== title && !known.has(name));
  if (missing.length > 0) return { save: false, error: `事件依赖还不存在：${missing.join("、")}` };
  if (dependsOn.includes(title)) return { save: false, error: "事件不能依赖自己" };
  const draftDepends = current ? dependsOn : dependsOn;
  const trial = activeEvents(plot)
    .filter((event) => event.id !== current?.id)
    .concat([{
      id: current?.id ?? "trial",
      title,
      summary,
      chapter,
      time,
      dependsOn: draftDepends,
      itemStatus: "pending",
      retired: false,
    }]);
  if (eventCycle(trial)) return { save: false, error: "事件依赖形成了循环" };
  if (action === "create" && current?.itemStatus === "confirmed") {
    return { save: false, error: `「${title}」已经在事件里，请改用修改` };
  }
  if (!current) {
    if (!summary) return { save: false, error: "新事件需要说明" };
    const event: PlotEvent = {
      id: nextId("ev"),
      title,
      summary,
      chapter,
      time,
      dependsOn,
      itemStatus: "pending",
      retired: false,
    };
    plot.events.push(event);
    const change = upsertChange(plot, {
      target: "event",
      targetId: event.id,
      action: "create",
      title,
      note: "新增事件",
      payload: { title, summary, chapter, time, dependsOn },
    });
    return { save: true, changeId: change.id };
  }
  if (current.itemStatus === "pending") {
    if (summary) current.summary = summary;
    if (input.chapter !== undefined) current.chapter = chapter;
    if (input.time !== undefined) current.time = time;
    if (input.dependsOn !== undefined) current.dependsOn = dependsOn;
  }
  const change = putDraft(
    plot,
    "event",
    current,
    {
      title,
      summary: summary || current.summary,
      chapter: input.chapter === undefined ? current.chapter : chapter,
      time: input.time === undefined ? current.time : time,
      dependsOn: input.dependsOn === undefined ? current.dependsOn : dependsOn,
    },
    "修订事件",
    "update",
  );
  return { save: true, changeId: change.id };
}

const volumeKeys = ["title", "summary", "total", "status", "mainline", "beats"];
const chapterKeys = ["title", "summary", "status"];
const lineKeys = ["title", "summary", "characterName"];
const hookKeys = ["title", "summary", "plantedChapter", "plannedChapter", "recoveredChapter"];
const eventKeys = ["title", "summary", "chapter", "time", "dependsOn"];
const storyKeys = ["summary", "promise", "ending"];

function assign(item: object, payload: Record<string, unknown>, keys: string[]) {
  const record = item as Record<string, unknown>;
  for (const key of keys) {
    if (key in payload) record[key] = payload[key];
  }
}

function itemOf(plot: PlotState, change: PlotChange) {
  if (change.target === "story") return plot.story;
  const list = {
    volume: plot.volumes,
    chapter: plot.chapters,
    plotline: plot.plotlines,
    foreshadowing: plot.foreshadowing,
    event: plot.events,
  }[change.target];
  return list.find((item) => item.id === change.targetId) ?? null;
}

export function applyChange(plot: PlotState, change: PlotChange) {
  const item = itemOf(plot, change);
  if (!item) return;
  if (change.action === "retire") {
    if ("retired" in item) item.retired = true;
    return;
  }
  if (change.action !== "create") {
    if (change.target === "story") assign(plot.story, change.payload, storyKeys);
    if (change.target === "volume") assign(item, change.payload, volumeKeys);
    if (change.target === "chapter") assign(item, change.payload, chapterKeys);
    if (change.target === "plotline") assign(item, change.payload, lineKeys);
    if (change.target === "foreshadowing") assign(item, change.payload, hookKeys);
    if (change.target === "event") assign(item, change.payload, eventKeys);
  }
  if ("itemStatus" in item) item.itemStatus = "confirmed";
  if (change.target === "story") plot.story.status = "confirmed";
}

export function syncProgress(plot: PlotState) {
  const done = activeChapters(plot).filter((chapter) => chapter.itemStatus === "confirmed" && chapter.status === "done");
  const highest = done.reduce((max, chapter) => Math.max(max, chapter.number), 0);
  plot.progress.writtenChapters = Math.max(plot.progress.writtenChapters, highest);
  plot.progress.currentChapter = plot.progress.writtenChapters;
  for (const range of volumeRanges(plot.volumes)) {
    const count = done.filter((chapter) => chapter.number >= range.start && chapter.number <= range.end).length;
    range.volume.written = Math.max(range.volume.written, count);
  }
}

export function commitRevision(plot: PlotState, requested: string[]): Save & {
  committed?: string[];
  writtenChapters?: number;
} {
  const tokens = [...new Set(requested.map((item) => item.trim()).filter(Boolean))];
  if (tokens.length === 0) return { save: false, error: "请指定要确认的修改" };
  const selected = plot.changes.filter((change) => tokens.includes(change.id) || tokens.includes(change.title));
  const found = new Set(selected.flatMap((change) => [change.id, change.title]));
  const missing = tokens.filter((token) => !found.has(token));
  if (missing.length > 0) return { save: false, error: `这些修改不在待确认列表里：${missing.join("、")}` };
  if (selected.length === 0) return { save: false, error: "没有可确认的修改" };
  for (const change of selected) applyChange(plot, change);
  const ids = new Set(selected.map((change) => change.id));
  plot.changes = plot.changes.filter((change) => !ids.has(change.id));
  syncProgress(plot);
  plot.history.unshift({
    id: nextId("rev"),
    summary: selected.map((change) => change.title).join("、"),
    changeIds: selected.map((change) => change.id),
    writtenChapters: plot.progress.writtenChapters,
  });
  plot.history = plot.history.slice(0, 40);
  return { save: true, committed: selected.map((change) => change.title), writtenChapters: plot.progress.writtenChapters };
}

function overlay(plot: PlotState) {
  const next = structuredClone(plot);
  for (const change of next.changes) applyChange(next, change);
  return next;
}

export function previewChanges(plot: PlotState, requested: string[]) {
  const tokens = [...new Set(requested.map((item) => item.trim()).filter(Boolean))];
  const selected = tokens.length
    ? plot.changes.filter((change) => tokens.includes(change.id) || tokens.includes(change.title))
    : plot.changes;
  if (tokens.length > 0) {
    const found = new Set(selected.flatMap((change) => [change.id, change.title]));
    const missing = tokens.filter((token) => !found.has(token));
    if (missing.length > 0) return { error: `这些修改不在待确认列表里：${missing.join("、")}` };
  }
  if (selected.length === 0) return { pending: 0, impacts: [], message: "没有待确认的剧情修改。" };
  const after = overlay({ ...plot, changes: selected });
  const impacts = selected.map((change) => ({
    changeId: change.id,
    title: change.title,
    action: change.note,
    affects: impactNotes(plot, after, change),
  }));
  return { pending: selected.length, impacts };
}

function impactNotes(before: PlotState, after: PlotState, change: PlotChange) {
  const notes: string[] = [];
  if (change.target === "story") {
    notes.push("总纲变动后，各卷阶段需要重新对照。");
    for (const volume of activeVolumes(after)) notes.push(volume.title);
  }
  if (change.target === "chapter") {
    const chapter = activeChapters(after).find((item) => item.id === change.targetId);
    const number = chapter?.number ?? 0;
    const later = activeChapters(after).filter((item) => item.number > number).slice(0, 6);
    notes.push(later.length ? `第${number}章之后要核对：${later.map((item) => item.title).join("、")}` : `第${number}章之后还没有别的章节大纲。`);
  }
  if (change.target === "volume") {
    const volume = after.volumes.find((item) => item.id === change.targetId);
    const previous = before.volumes.find((item) => item.id === change.targetId);
    notes.push(`${volume?.title ?? change.title}的规划会改变这一卷里的章节位置。`);
    if (volume && previous && volume.total !== previous.total) {
      const nextRange = volumeRanges(after.volumes).find((range) => range.volume.id === volume.id);
      const previousRange = volumeRanges(before.volumes).find((range) => range.volume.id === volume.id);
      if (nextRange && previousRange && nextRange.end < previousRange.end) {
        const dropped = activeChapters(before).filter((chapter) => chapter.number > nextRange.end && chapter.number <= previousRange.end);
        if (dropped.length > 0) notes.push(`这些章节会掉出本卷：${dropped.map((chapter) => `第${chapter.number}章`).join("、")}`);
      }
    }
  }
  if (change.target === "event") {
    const event = activeEvents(after).find((item) => item.id === change.targetId);
    const dependents = activeEvents(after).filter((item) => event && item.dependsOn.includes(event.title));
    if (event && dependents.length === 0) notes.push("还没有其他事件依赖这件事。");
    for (const dependent of dependents) {
      if (event?.chapter && dependent.chapter && dependent.chapter < event.chapter) {
        notes.push(`「${dependent.title}」排在「${event.title}」之前，依赖会断。`);
      } else if (event) {
        notes.push(`「${dependent.title}」依赖这件事，需要跟着核对。`);
      }
    }
  }
  if (change.target === "foreshadowing") {
    const hook = activeHooks(after).find((item) => item.id === change.targetId);
    if (hook?.plantedChapter && hook.recoveredChapter && hook.recoveredChapter < hook.plantedChapter) {
      notes.push("回收章节早于埋设章节。");
    }
    const start = hook?.plantedChapter ?? hook?.recoveredChapter ?? 0;
    const later = activeChapters(after).filter((chapter) => start > 0 && chapter.number >= start).slice(0, 5);
    notes.push(later.length ? `从第${start}章起受影响：${later.map((chapter) => chapter.title).join("、")}` : "还没有章节大纲直接接这处伏笔。");
  }
  if (change.target === "plotline") {
    const line = after.plotlines.find((item) => item.id === change.targetId);
    const title = line?.title ?? change.title;
    const mentioned = activeChapters(after).filter((chapter) => chapter.summary.includes(title) || chapter.title.includes(title));
    notes.push(mentioned.length ? `这些章节写到了这条线：${mentioned.map((chapter) => chapter.title).join("、")}` : "还没有章节大纲直接写到这条线。");
    if (line?.kind === "growth" && line.characterName) notes.push(`人物「${line.characterName}」的成长需要和档案对照。`);
    if (change.action === "retire") notes.push("结束后，后面的章节不能再把这条线当成进行中。");
  }
  return notes;
}

export function validatePlot(plot: PlotState, characterNames: string[]) {
  const issues: PlotIssue[] = [];
  const projected = overlay(plot);
  if (!projected.story.summary.trim()) issues.push({ level: "warning", message: "还没有全书总纲。" });
  if (activeLines(projected, "mainline").length === 0) issues.push({ level: "warning", message: "还没有主线。" });
  const active = projected.volumes.filter((volume) => !volume.retired && volume.status === "active");
  if (active.length > 1) issues.push({ level: "warning", message: `同时有${active.length}卷标成进行中。` });
  const ranges = volumeRanges(projected.volumes);
  for (const chapter of activeChapters(projected)) {
    if (!ranges.some((range) => chapter.number >= range.start && chapter.number <= range.end)) {
      issues.push({ level: "error", message: `第${chapter.number}章不在任何分卷里。` });
    }
  }
  for (const hook of activeHooks(projected)) {
    if (hook.plantedChapter && hook.recoveredChapter && hook.recoveredChapter < hook.plantedChapter) {
      issues.push({ level: "error", message: `伏笔「${hook.title}」的回收早于埋设。` });
    }
    if (hook.plantedChapter && hook.plannedChapter && hook.plannedChapter < hook.plantedChapter) {
      issues.push({ level: "error", message: `伏笔「${hook.title}」的计划回收早于埋设。` });
    }
    if (hook.recoveredChapter && !hook.plantedChapter) {
      issues.push({ level: "warning", message: `伏笔「${hook.title}」回收了，但没有埋设章节。` });
    }
  }
  const names = new Set(characterNames);
  for (const line of activeLines(projected, "growth")) {
    if (!line.characterName || !names.has(line.characterName)) {
      issues.push({ level: "error", message: `成长线「${line.title}」的人物不在档案里。` });
    }
  }
  const events = activeEvents(projected);
  const eventTitles = new Set(events.map((event) => event.title));
  for (const event of events) {
    for (const dependency of event.dependsOn) {
      if (!eventTitles.has(dependency)) issues.push({ level: "error", message: `事件「${event.title}」依赖的「${dependency}」不存在。` });
      const earlier = events.find((item) => item.title === dependency);
      if (earlier?.chapter && event.chapter && event.chapter < earlier.chapter) {
        issues.push({ level: "error", message: `事件「${event.title}」排在它所依赖的「${dependency}」之前。` });
      }
    }
  }
  if (eventCycle(events)) issues.push({ level: "error", message: "事件依赖形成了循环。" });
  if (plot.changes.length > 0) {
    issues.push({ level: "warning", message: `还有 ${plot.changes.length} 条剧情修改待确认。` });
  }
  return { ok: issues.every((issue) => issue.level !== "error"), issues };
}

export function authorAddThread(plot: PlotState, kind: string, title: string, summary: string): Save {
  const name = title.trim();
  if (!name) return { save: false, error: "标题不能为空" };
  if (kind === "hook") {
    if (activeHooks(plot).some((hook) => hook.title === name)) return { save: false, error: `「${name}」已经在伏笔里` };
    plot.foreshadowing.push({
      id: nextId("h"),
      title: name,
      summary: summary.trim() || "尚未填写说明。",
      plantedChapter: null,
      plannedChapter: null,
      recoveredChapter: null,
      itemStatus: "confirmed",
      retired: false,
    });
    return { save: true };
  }
  if (kind !== "mainline" && kind !== "branch") return { save: false, error: "请选择主线、支线或伏笔" };
  if (activeLines(plot, kind).some((line) => line.title === name)) return { save: false, error: `「${name}」已经在大纲里` };
  plot.plotlines.push({
    id: nextId(kind === "mainline" ? "m" : "b"),
    kind,
    title: name,
    summary: summary.trim() || "尚未填写说明。",
    characterName: "",
    itemStatus: "confirmed",
    retired: false,
  });
  return { save: true };
}

export function authorAddVolume(plot: PlotState): Save {
  const index = activeVolumes(plot).length + 1;
  plot.volumes.push({
    id: nextId("vol"),
    title: `第${index}卷·未命名`,
    summary: "",
    status: "pending",
    written: 0,
    total: 40,
    mainline: "",
    beats: [],
    itemStatus: "confirmed",
    retired: false,
  });
  return { save: true };
}

export function authorOptimize(plot: PlotState, novelTitle: string): Save & { message: string } {
  if (activeLines(plot, "mainline").length > 0) {
    return { save: false, message: "当前大纲没有需要合并的重复条目" };
  }
  plot.plotlines.unshift({
    id: nextId("m"),
    kind: "mainline",
    title: "开篇主线",
    summary: novelTitle ? `《${novelTitle}》从这一条主线写起。` : "先定下这一条主线。",
    characterName: "",
    itemStatus: "confirmed",
    retired: false,
  });
  return { save: true, message: "已补上一条开篇主线" };
}

export function visiblePlot(plot: PlotState) {
  const pendingIds = new Set(plot.changes.map((change) => change.targetId));
  return {
    revision: plot.revision,
    story: plot.story,
    volumes: activeVolumes(plot),
    chapters: activeChapters(plot),
    mainlines: activeLines(plot, "mainline"),
    branches: activeLines(plot, "branch"),
    growth: activeLines(plot, "growth"),
    foreshadowing: activeHooks(plot),
    events: activeEvents(plot),
    changes: plot.changes,
    progress: plot.progress,
    plannedChapters: plannedChapterCount(plot),
    pendingIds: [...pendingIds],
  };
}
