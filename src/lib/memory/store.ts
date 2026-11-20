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
import { readCharacters } from "../characters/store";
import { currentNovelId, readNovel } from "../novels/store";
import { readPlot } from "../plot/store";
import { emptyMemory, type MemoryState } from "./model";
import {
  commitChanges,
  ensureMemory,
  memoryContext,
  memoryDetail,
  rebuildChapter,
  searchMemory,
  submitChanges,
  validateChanges,
  type MemoryInput,
  type MemoryQuery,
  type MemorySource,
} from "./operations";

export class MemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryError";
  }
}

function novelKey(novelId: string) {
  const id = novelId.trim();
  if (!/^[a-z0-9-]+$/.test(id) || !readNovel(id)) throw new MemoryError("小说不存在");
  return id;
}

function activeId(novelId = "") {
  return novelKey(novelId.trim() || currentNovelId());
}

function memoryPath(novelId: string) {
  return join(process.cwd(), "data", `memory-${novelKey(novelId)}.json`);
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
      if (Date.now() - started > 3000) throw new MemoryError("小说记忆正在被占用");
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

function writeUnlocked(filePath: string, memory: MemoryState) {
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(memory, null, 2)}\n`);
  renameSync(temporary, filePath);
}

function readUnlocked(novelId: string): MemoryState {
  const filePath = memoryPath(novelId);
  if (!existsSync(filePath)) {
    const memory = emptyMemory();
    writeUnlocked(filePath, memory);
    return memory;
  }
  const memory = JSON.parse(readFileSync(filePath, "utf8")) as MemoryState;
  if (ensureMemory(memory)) {
    memory.revision += 1;
    writeUnlocked(filePath, memory);
  }
  return memory;
}

export function readMemory(novelId = "") {
  const id = activeId(novelId);
  return withLock(memoryPath(id), () => readUnlocked(id));
}

function sourceOf(novelId: string, memory: MemoryState): MemorySource {
  const id = activeId(novelId);
  const novel = readNovel(id);
  if (!novel) throw new MemoryError("小说不存在");
  return {
    novelTitle: novel.title,
    plot: readPlot(id),
    characters: readCharacters(id).characters,
    memory,
  };
}

function loadSource(novelId: string) {
  const id = activeId(novelId);
  const memory = readMemory(id);
  return sourceOf(id, memory);
}

function mutate<T extends { save: boolean; error?: string }>(novelId: string, change: (source: MemorySource) => T) {
  const id = activeId(novelId);
  const novel = readNovel(id);
  if (!novel) throw new MemoryError("小说不存在");
  const plot = readPlot(id);
  const characters = readCharacters(id).characters;
  const filePath = memoryPath(id);
  let failure = "";
  const result = withLock(filePath, () => {
    const memory = readUnlocked(id);
    const next = change({ novelTitle: novel.title, plot, characters, memory });
    if (next.error && !next.save) failure = next.error;
    if (next.save) {
      memory.revision += 1;
      writeUnlocked(filePath, memory);
    }
    return { ...next, revision: memory.revision };
  });
  if (failure) throw new MemoryError(failure);
  return result;
}

export function getMemoryContext(novelId = "", chapter?: number) {
  const source = loadSource(novelId);
  const current = source.plot.progress.currentChapter || source.plot.progress.writtenChapters;
  const target = chapter ?? Math.max(1, current + 1);
  if (!Number.isInteger(target) || target < 1) throw new MemoryError("章节号要从 1 开始");
  return memoryContext(source, target);
}

export function searchNovelMemory(novelId: string, query: MemoryQuery) {
  const source = loadSource(novelId);
  return searchMemory(source, query);
}

export function getMemoryDetail(novelId: string, id: string, title: string) {
  const source = loadSource(novelId);
  const result = memoryDetail(source, id, title);
  if ("error" in result && result.error) throw new MemoryError(result.error);
  return result;
}

export function submitMemoryChanges(novelId: string, changes: MemoryInput[]) {
  return mutate(novelId, (source) => submitChanges(source.memory, changes));
}

export function validateNovelMemory(novelId: string, changeIds: string[]) {
  const source = loadSource(novelId);
  return validateChanges(source, changeIds);
}

export function commitMemoryChanges(novelId: string, changeIds: string[]) {
  return mutate(novelId, (source) => commitChanges(source, changeIds));
}

export function rebuildNovelChapter(novelId: string, chapter: number, prose?: string) {
  return mutate(novelId, (source) => rebuildChapter(source, chapter, prose));
}
