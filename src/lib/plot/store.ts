import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { isCoreRole, roleLabels } from "../characters/model";
import { readCharacters } from "../characters/store";
import { currentNovelId, readNovel } from "../novels/store";
import { readWorldview, writingRules } from "../worldview/store";
import {
  authorAddThread,
  authorAddVolume,
  authorOptimize,
  commitRevision,
  manageForeshadowing,
  managePlotEvent,
  managePlotline,
  plannedChapterCount,
  previewChanges,
  saveChapterOutlines,
  saveStoryOutline,
  saveVolumeOutline,
  validatePlot,
  activeVolumes,
  type ChapterInput,
  type VolumeInput,
} from "./operations";
import { emptyPlot, fanchenPlot, type PlotState } from "./model";

export class PlotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlotError";
  }
}

function novelKey(novelId: string) {
  const id = novelId.trim();
  if (!/^[a-z0-9-]+$/.test(id) || !readNovel(id)) throw new PlotError("小说不存在");
  return id;
}

function activeId(novelId = "") {
  return novelKey(novelId.trim() || currentNovelId());
}

function plotPath(novelId: string) {
  return join(process.cwd(), "data", `plot-${novelKey(novelId)}.json`);
}

function sleep(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Local file lock; the wait is only a few milliseconds.
  }
}

function withLock<T>(filePath: string, fn: () => T): T {
  mkdirSync(dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.lock`;
  const started = Date.now();
  let fd: number | null = null;
  while (fd === null) {
    try {
      fd = openSync(lockPath, "wx");
    } catch {
      if (Date.now() - started > 3000) throw new PlotError("剧情大纲正在被占用");
      sleep(15);
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    try {
      unlinkSync(lockPath);
    } catch {
      // The next writer replaces a stale lock by failing open, then retrying.
    }
  }
}

function writeUnlocked(filePath: string, plot: PlotState) {
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(plot, null, 2)}\n`);
  renameSync(temporary, filePath);
}

function ensurePlot(plot: PlotState) {
  let dirty = false;
  if (!plot.story) {
    plot.story = { summary: "", promise: "", ending: "", status: "confirmed" };
    dirty = true;
  }
  for (const key of ["volumes", "chapters", "plotlines", "foreshadowing", "events", "changes", "history"] as const) {
    if (!Array.isArray(plot[key])) {
      plot[key] = [];
      dirty = true;
    }
  }
  if (!plot.progress) {
    plot.progress = { writtenChapters: 0, currentChapter: 0 };
    dirty = true;
  }
  return dirty;
}

function readUnlocked(novelId: string): PlotState {
  const filePath = plotPath(novelId);
  if (!existsSync(filePath)) {
    const plot = novelId === "fanchen-wendao" ? fanchenPlot() : emptyPlot();
    writeUnlocked(filePath, plot);
    return plot;
  }
  const plot = JSON.parse(readFileSync(filePath, "utf8")) as PlotState;
  if (ensurePlot(plot)) {
    plot.revision += 1;
    writeUnlocked(filePath, plot);
  }
  return plot;
}

export function readPlot(novelId = "") {
  const id = activeId(novelId);
  return withLock(plotPath(id), () => readUnlocked(id));
}

function mutate<T extends { save: boolean; error?: string }>(novelId: string, change: (plot: PlotState) => T) {
  const id = activeId(novelId);
  const filePath = plotPath(id);
  let failure = "";
  const result = withLock(filePath, () => {
    const plot = readUnlocked(id);
    const next = change(plot);
    if (next.error) failure = next.error;
    if (next.save) {
      plot.revision += 1;
      writeUnlocked(filePath, plot);
    }
    return { ...next, plot, revision: plot.revision };
  });
  if (failure) throw new PlotError(failure);
  return result;
}

export function saveStory(novelId: string, summary: string, promise: string, ending: string) {
  return mutate(novelId, (plot) => saveStoryOutline(plot, { summary, promise, ending }));
}

export function saveVolumes(novelId: string, volumes: VolumeInput[]) {
  return mutate(novelId, (plot) => saveVolumeOutline(plot, volumes));
}

export function saveChapters(novelId: string, chapters: ChapterInput[]) {
  return mutate(novelId, (plot) => saveChapterOutlines(plot, chapters));
}

export function savePlotline(
  novelId: string,
  input: { action: string; kind: string; title: string; summary: string; characterName: string },
) {
  return mutate(novelId, (plot) => managePlotline(plot, input));
}

export function saveForeshadowing(
  novelId: string,
  input: { action: string; title: string; summary: string; chapter?: number | null },
) {
  return mutate(novelId, (plot) => manageForeshadowing(plot, input));
}

export function saveEvent(
  novelId: string,
  input: { action: string; title: string; summary: string; chapter?: number | null; time: string; dependsOn: string[] },
) {
  return mutate(novelId, (plot) => managePlotEvent(plot, input));
}

export function validateNovelPlot(novelId = "") {
  const id = activeId(novelId);
  const plot = readPlot(id);
  const names = readCharacters(id).characters.map((character) => character.name);
  const rules = writingRules(readWorldview(id)).rules.map((rule) => rule.name);
  const result = validatePlot(plot, names);
  return { ...result, rules, pending: plot.changes.length };
}

export function previewPlot(novelId: string, tokens: string[]) {
  const plot = readPlot(novelId);
  const result = previewChanges(plot, tokens);
  if ("error" in result && result.error) throw new PlotError(result.error);
  return result;
}

export function commitPlot(novelId: string, tokens: string[]) {
  return mutate(novelId, (plot) => commitRevision(plot, tokens));
}

export function getPlotContext(novelId = "") {
  const id = activeId(novelId);
  const novel = readNovel(id);
  if (!novel) throw new PlotError("小说不存在");
  const plot = readPlot(id);
  const world = readWorldview(id);
  const archive = readCharacters(id);
  const rules = writingRules(world).rules.map((rule) => ({ name: rule.name, summary: rule.summary }));
  const people = [...archive.characters].sort((a, b) => Number(isCoreRole(b.role)) - Number(isCoreRole(a.role)));
  const active = activeVolumes(plot).find((volume) => volume.status === "active") ?? null;
  const storyChange = plot.changes.find((change) => change.target === "story");
  return {
    novel: {
      id: novel.id,
      title: novel.title,
      genre: novel.genre,
      premise: novel.premise,
      writtenWan: novel.writtenWan,
      targetWan: novel.targetWan,
    },
    progress: {
      currentChapter: plot.progress.currentChapter,
      writtenChapters: plot.progress.writtenChapters,
      plannedChapters: plannedChapterCount(plot),
      activeVolume: active ? { id: active.id, title: active.title, summary: active.summary } : null,
    },
    story: {
      summary: plot.story.summary,
      promise: plot.story.promise,
      ending: plot.story.ending,
      status: plot.story.status,
      pending: storyChange ? storyChange.payload : null,
    },
    volumes: activeVolumes(plot).map((volume) => ({
      id: volume.id,
      title: volume.title,
      summary: volume.summary,
      status: volume.status,
      total: volume.total,
      written: volume.written,
      mainline: volume.mainline,
      beats: volume.beats,
      pending: volume.itemStatus === "pending",
    })),
    plotlines: plot.plotlines.filter((line) => !line.retired).map((line) => ({
      id: line.id,
      kind: line.kind,
      title: line.title,
      summary: line.summary,
      characterName: line.characterName,
      pending: line.itemStatus === "pending",
    })),
    foreshadowing: plot.foreshadowing.filter((hook) => !hook.retired).map((hook) => ({
      id: hook.id,
      title: hook.title,
      summary: hook.summary,
      plantedChapter: hook.plantedChapter,
      plannedChapter: hook.plannedChapter,
      recoveredChapter: hook.recoveredChapter,
      pending: hook.itemStatus === "pending",
    })),
    events: plot.events.filter((event) => !event.retired).map((event) => ({
      id: event.id,
      title: event.title,
      summary: event.summary,
      chapter: event.chapter,
      time: event.time,
      dependsOn: event.dependsOn,
      pending: event.itemStatus === "pending",
    })),
    characters: people.slice(0, 16).map((character) => ({
      name: character.name,
      role: roleLabels[character.role],
      realm: character.realm,
      tagline: character.tagline,
      status: character.status,
    })),
    worldview: {
      worldName: world.worldName,
      worldSummary: world.worldSummary,
      coreRules: world.entries.filter((entry) => entry.module === "rule" && entry.core).map((entry) => entry.name),
      writingRules: rules,
    },
    pendingChanges: plot.changes.map((change) => ({
      id: change.id,
      title: change.title,
      target: change.target,
      action: change.action,
      note: change.note,
    })),
  };
}

export function addAuthorThread(novelId: string, kind: string, title: string, summary: string) {
  return mutate(novelId, (plot) => authorAddThread(plot, kind, title, summary));
}

export function addAuthorVolume(novelId: string) {
  return mutate(novelId, (plot) => authorAddVolume(plot));
}

export function optimizeAuthorPlot(novelId: string) {
  const novel = readNovel(activeId(novelId));
  return mutate(novelId, (plot) => authorOptimize(plot, novel?.title ?? ""));
}
