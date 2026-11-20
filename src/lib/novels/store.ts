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
import { removeNovelImages } from "../images/store";
import { seedCatalog, type NovelCatalog, type NovelCoverId, type NovelRecord } from "./model";

const dataPath = join(process.cwd(), "data", "novels.json");

export class NovelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NovelError";
  }
}

const covers: NovelCoverId[] = ["novel", "star", "river"];

function sleep(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Local file lock; the wait is only a few milliseconds.
  }
}

function withLock<T>(fn: () => T): T {
  mkdirSync(dirname(dataPath), { recursive: true });
  const lockPath = `${dataPath}.lock`;
  const started = Date.now();
  let fd: number | null = null;
  while (fd === null) {
    try {
      fd = openSync(lockPath, "wx");
    } catch {
      if (Date.now() - started > 3000) throw new NovelError("书架正在被占用");
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

function writeUnlocked(state: NovelCatalog) {
  const temporary = `${dataPath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, dataPath);
}

function readUnlocked(): NovelCatalog {
  if (!existsSync(dataPath)) {
    writeUnlocked(seedCatalog);
    return structuredClone(seedCatalog);
  }
  return JSON.parse(readFileSync(dataPath, "utf8")) as NovelCatalog;
}

export function readNovels(): NovelCatalog {
  return withLock(readUnlocked);
}

export function currentNovelId() {
  return readNovels().currentId;
}

export function readNovel(id: string) {
  return readNovels().novels.find((novel) => novel.id === id) ?? null;
}

export function openNovel(id: string) {
  return withLock(() => {
    const state = readUnlocked();
    if (!state.novels.some((novel) => novel.id === id)) {
      throw new NovelError("这本小说不在书架上");
    }
    if (state.currentId !== id) {
      state.currentId = id;
      state.revision += 1;
      writeUnlocked(state);
    }
    return state;
  });
}

export function createNovel(input: {
  title: string;
  genre?: string;
  premise?: string;
  targetWan?: number;
}) {
  const title = input.title.trim();
  const genre = input.genre?.trim() || "未分类";
  const premise = input.premise?.trim() || "";
  const targetWan =
    typeof input.targetWan === "number" && input.targetWan > 0 ? input.targetWan : 100;
  if (!title) throw new NovelError("书名不能为空");
  if (title.length > 40) throw new NovelError("书名请控制在 40 字以内");

  return withLock(() => {
    const state = readUnlocked();
    if (state.novels.some((novel) => novel.title === title)) {
      throw new NovelError(`《${title}》已经在书架上`);
    }
    const novel: NovelRecord = {
      id: `novel-${Date.now()}`,
      title,
      genre,
      premise,
      status: "writing",
      writtenWan: 0,
      targetWan,
      cover: covers[state.novels.length % covers.length] ?? "novel",
    };
    state.novels.unshift(novel);
    state.currentId = novel.id;
    state.revision += 1;
    writeUnlocked(state);
    return { novel, catalog: state };
  });
}

export function renameNovel(input: { title: string; novelId?: string }) {
  const title = input.title.trim();
  if (!title) throw new NovelError("书名不能为空");
  if (title.length > 40) throw new NovelError("书名请控制在 40 字以内");

  return withLock(() => {
    const state = readUnlocked();
    const id = input.novelId?.trim() || state.currentId;
    const novel = state.novels.find((item) => item.id === id);
    if (!novel) throw new NovelError("这本小说不在书架上");
    const taken = state.novels.some((item) => item.id !== novel.id && item.title === title);
    if (taken) throw new NovelError(`《${title}》已经在书架上`);
    const previousTitle = novel.title;
    if (previousTitle !== title) {
      novel.title = title;
      state.revision += 1;
      writeUnlocked(state);
    }
    return { novel, catalog: state, previousTitle, changed: previousTitle !== title };
  });
}

function discardNovelData(novelId: string) {
  if (!/^[a-z0-9-]+$/.test(novelId)) return;
  const dataDir = join(process.cwd(), "data");
  const files = [
    novelId === "fanchen-wendao"
      ? join(dataDir, "worldview.json")
      : join(dataDir, `world-${novelId}.json`),
    join(dataDir, `characters-${novelId}.json`),
    join(dataDir, `plot-${novelId}.json`),
    join(dataDir, `memory-${novelId}.json`),
  ];
  removeNovelImages(novelId);
  for (const filePath of files) {
    for (const suffix of ["", ".lock", ".tmp"]) {
      try {
        unlinkSync(`${filePath}${suffix}`);
      } catch {
        // The book can be removed before these files exist.
      }
    }
  }
}

export function deleteNovel(input: { novelId?: string; title?: string }) {
  const requestedId = input.novelId?.trim() ?? "";
  const requestedTitle = input.title?.trim() ?? "";
  if (!requestedId && !requestedTitle) throw new NovelError("请指定要删除的小说");
  if (requestedId && !/^[a-z0-9-]+$/.test(requestedId)) throw new NovelError("这本小说不在书架上");

  const result = withLock(() => {
    const state = readUnlocked();
    const novel = requestedId
      ? state.novels.find((item) => item.id === requestedId)
      : state.novels.find((item) => item.title === requestedTitle);
    if (!novel) throw new NovelError("这本小说不在书架上");
    if (requestedTitle && novel.title !== requestedTitle) throw new NovelError("书名和小说对不上");
    if (state.novels.length <= 1) throw new NovelError("书架上至少留一本小说");
    const index = state.novels.findIndex((item) => item.id === novel.id);
    state.novels = state.novels.filter((item) => item.id !== novel.id);
    if (state.currentId === novel.id) {
      state.currentId = state.novels[Math.min(index, state.novels.length - 1)]?.id ?? state.novels[0].id;
    }
    state.revision += 1;
    writeUnlocked(state);
    return { novel, catalog: state };
  });
  discardNovelData(result.novel.id);
  return result;
}
