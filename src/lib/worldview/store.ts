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
import { hasImage, ImageError, mediaUrl, saveImageFile } from "../images/store";
import { readNovel, currentNovelId } from "../novels/store";
import {
  createSeed,
  emptyWorld,
  isModuleId,
  moduleIds,
  moduleLabels,
  novelVolumes,
  type Activity,
  type Entry,
  type ModuleId,
  type WorldviewState,
} from "./model";

const dataDir = join(process.cwd(), "data");
const legacyWorldPath = join(dataDir, "worldview.json");

export class WorldviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldviewError";
  }
}

export type EntryProposal = {
  module: ModuleId;
  name: string;
  summary: string;
  core?: boolean;
  source?: string;
  imagePath?: string;
  imageId?: string;
};

export type EntryRef = {
  id: string;
  module: ModuleId;
  name: string;
};

export type ProposeResult = {
  created: EntryRef[];
  updated: EntryRef[];
  conflicts: Array<EntryRef & { summary: string; reason: string }>;
};

function sleep(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Local file lock; the wait is only a few milliseconds.
  }
}

function novelKey(novelId: string) {
  if (!/^[a-z0-9-]+$/.test(novelId)) throw new WorldviewError("小说不存在");
  return novelId;
}

function worldPath(novelId: string) {
  const id = novelKey(novelId);
  if (id === "fanchen-wendao") return legacyWorldPath;
  return join(dataDir, `world-${id}.json`);
}

function activeNovelId(novelId?: string) {
  const requested = novelId?.trim();
  const id = novelKey(requested || currentNovelId());
  if (!readNovel(id)) throw new WorldviewError("小说不存在");
  return id;
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
      if (Date.now() - started > 3000) {
        throw new WorldviewError("世界观数据正在被占用");
      }
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

function writeUnlocked(filePath: string, state: WorldviewState) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, filePath);
}

function readUnlocked(novelId: string): WorldviewState {
  const filePath = worldPath(novelId);
  if (!existsSync(filePath)) {
    const novel = readNovel(novelId);
    const seed =
      novelId === "fanchen-wendao" || !novel
        ? createSeed()
        : emptyWorld(novel.title, novel.premise);
    writeUnlocked(filePath, seed);
    return seed;
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as WorldviewState;
}

export function syncNovelTitle(novelId: string, previousTitle: string, nextTitle: string) {
  const id = activeNovelId(novelId);
  const filePath = worldPath(id);
  return withLock(filePath, () => {
    if (!existsSync(filePath)) return null;
    const state = readUnlocked(id);
    if (state.worldName !== previousTitle) return state;
    state.worldName = nextTitle;
    state.revision += 1;
    writeUnlocked(filePath, state);
    return state;
  });
}

export function readWorldview(novelId?: string): WorldviewState {
  const id = activeNovelId(novelId);
  return withLock(worldPath(id), () => readUnlocked(id));
}

function update(novelId: string, change: (state: WorldviewState) => void): WorldviewState {
  const id = activeNovelId(novelId);
  const filePath = worldPath(id);
  return withLock(filePath, () => {
    const state = readUnlocked(id);
    change(state);
    state.revision += 1;
    writeUnlocked(filePath, state);
    return state;
  });
}

function pendingDetail(source: string) {
  return /^第\d+章$/.test(source) ? `来自${source} · 待确认` : `${source} · 待确认`;
}

function remember(state: WorldviewState, entry: Entry, verb: "新增" | "更新") {
  const source = entry.source ?? "Codex";
  const activity: Activity = {
    id: `act-${entry.id}-${state.revision + 1}`,
    badge: "新",
    title: `${verb}：${entry.name}`,
    detail: pendingDetail(source),
    entryId: entry.id,
  };
  state.activities = [activity, ...state.activities].slice(0, 20);
}

export function worldviewSnapshot(state = readWorldview(), novelId = "") {
  const counts = {
    total: state.entries.length,
    core: state.entries.filter((entry) => entry.core).length,
    pending: state.entries.filter((entry) => entry.pending).length,
  };
  return {
    revision: state.revision,
    worldName: state.worldName,
    worldSummary: state.worldSummary,
    counts,
    modules: state.order.map((id) => ({
      id,
      label: moduleLabels[id],
      count: state.entries.filter((entry) => entry.module === id).length,
      entries: state.entries
        .filter((entry) => entry.module === id)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          summary: entry.summary,
          core: entry.core,
          pending: entry.pending,
          source: entry.source ?? null,
          image: mediaUrl(novelId, entry.image),
          pendingImage: mediaUrl(novelId, entry.pendingImage),
        })),
    })),
  };
}

export function writingRules(state = readWorldview()) {
  return {
    revision: state.revision,
    rules: state.entries
      .filter((entry) => entry.module === "custom")
      .map((entry) => ({
        name: entry.name,
        summary: entry.summary,
      })),
  };
}

export function novelContext(novelId?: string) {
  const novel = readNovel(activeNovelId(novelId));
  if (!novel) throw new WorldviewError("小说不存在");
  const volumes =
    novel.id === "fanchen-wendao"
      ? novelVolumes.map((volume) => ({
          id: volume.id,
          title: volume.title,
          status: volume.status,
          chapters: volume.total,
          writtenChapters: volume.written,
          mainline: volume.mainline ?? null,
          beats: volume.beats ?? [],
        }))
      : [
          {
            id: "v1",
            title: "第一卷·未命名",
            status: "pending" as const,
            chapters: 40,
            writtenChapters: 0,
            mainline: null,
            beats: [] as string[],
          },
        ];
  return {
    id: novel.id,
    title: novel.title,
    genre: novel.genre,
    status: novel.status === "writing" ? "创作中" : "已完成",
    writtenWan: novel.writtenWan,
    targetWan: novel.targetWan,
    premise: novel.premise,
    volumes,
    modules: moduleIds.map((moduleId) => ({ id: moduleId, label: moduleLabels[moduleId] })),
  };
}

export function setWorldOverview(name: string, summary: string, novelId = "") {
  const worldName = name.trim();
  const worldSummary = summary.trim();
  if (!worldName || !worldSummary) {
    throw new WorldviewError("世界名称和概述都不能为空");
  }
  const state = update(novelId, (current) => {
    current.worldName = worldName;
    current.worldSummary = worldSummary;
  });
  return {
    revision: state.revision,
    worldName: state.worldName,
    worldSummary: state.worldSummary,
  };
}

export function proposeEntries(entries: EntryProposal[], novelId = ""): ProposeResult {
  if (entries.length === 0) {
    throw new WorldviewError("至少提供一条设定");
  }
  const id = activeNovelId(novelId);
  const filePath = worldPath(id);
  return withLock(filePath, () => {
    const state = readUnlocked(id);
    const result: ProposeResult = { created: [], updated: [], conflicts: [] };
    entries.forEach((proposal, index) => {
      const name = proposal.name.trim();
      const summary = proposal.summary.trim();
      if (!isModuleId(proposal.module)) {
        throw new WorldviewError(`未知模块：${String(proposal.module)}`);
      }
      if (!name || !summary) {
        throw new WorldviewError("设定的名称和概述都不能为空");
      }
      let imageId = proposal.imageId?.trim() || "";
      if (proposal.imagePath?.trim()) {
        try {
          imageId = saveImageFile(id, proposal.imagePath);
        } catch (error) {
          result.conflicts.push({
            id: "",
            module: proposal.module,
            name,
            summary,
            reason: error instanceof ImageError ? error.message : "图片没有读到",
          });
          return;
        }
      }
      const existing = state.entries.find(
        (entry) => entry.module === proposal.module && entry.name === name,
      );
      if (existing && !existing.pending) {
        if (imageId && imageId !== existing.image) {
          existing.pendingImage = imageId;
          result.updated.push({ id: existing.id, module: existing.module, name: existing.name });
        }
        if (summary !== existing.summary || (typeof proposal.core === "boolean" && proposal.core !== existing.core) || !imageId) {
          result.conflicts.push({
            id: existing.id,
            module: existing.module,
            name: existing.name,
            summary: existing.summary,
            reason: "已确认的设定不会被覆盖",
          });
        }
        return;
      }
      const source = proposal.source?.trim() || "Codex";
      if (existing) {
        existing.summary = summary;
        existing.source = source;
        if (typeof proposal.core === "boolean") existing.core = proposal.core;
        if (imageId) existing.image = imageId;
        remember(state, existing, "更新");
        result.updated.push({
          id: existing.id,
          module: existing.module,
          name: existing.name,
        });
        return;
      }
      const created: Entry = {
        id: `proposed-${Date.now()}-${index}`,
        module: proposal.module,
        name,
        summary,
        core: proposal.core === true,
        pending: true,
        source,
        image: imageId || null,
      };
      state.entries.push(created);
      remember(state, created, "新增");
      result.created.push({ id: created.id, module: created.module, name: created.name });
    });
    if (result.created.length > 0 || result.updated.length > 0) {
      state.revision += 1;
      writeUnlocked(filePath, state);
    }
    return result;
  });
}

export function confirmEntry(id: string, novelId = "") {
  return update(novelId, (current) => {
    const entry = current.entries.find((item) => item.id === id);
    if (!entry) throw new WorldviewError("这条设定已经不在了");
    if (entry.pendingImage) {
      entry.image = entry.pendingImage;
      entry.pendingImage = null;
    }
    entry.pending = false;
    current.activities = current.activities.map((activity) =>
      activity.entryId === id
        ? { ...activity, badge: "确", detail: activity.detail.replace("待确认", "已确认") }
        : activity,
    );
  });
}

export function toggleCore(id: string, novelId = "") {
  let core = false;
  const state = update(novelId, (current) => {
    const entry = current.entries.find((item) => item.id === id);
    if (!entry) throw new WorldviewError("这条设定已经不在了");
    entry.core = !entry.core;
    core = entry.core;
  });
  return { state, core };
}

export function createEntry(
  input: {
    module: ModuleId;
    name: string;
    summary: string;
    core: boolean;
    imageId?: string;
  },
  novelId = "",
) {
  const name = input.name.trim();
  const summary = input.summary.trim() || "尚未填写概述。";
  const imageId = input.imageId?.trim() || "";
  if (imageId && !hasImage(activeNovelId(novelId), imageId)) throw new WorldviewError("图片不存在");
  if (!isModuleId(input.module)) throw new WorldviewError(`未知模块：${input.module}`);
  if (!name) throw new WorldviewError("名称不能为空");
  let createdId = "";
  const state = update(novelId, (current) => {
    const existing = current.entries.find(
      (entry) => entry.module === input.module && entry.name === name,
    );
    if (existing) throw new WorldviewError(`「${name}」已在${moduleLabels[input.module]}中`);
    createdId = `manual-${Date.now()}`;
    const entry: Entry = {
      id: createdId,
      module: input.module,
      name,
      summary,
      core: input.core,
      pending: false,
      image: imageId || null,
    };
    current.entries.push(entry);
    current.activities = [
      {
        id: `act-${createdId}`,
        badge: "新",
        title: `新增：${name}`,
        detail: "手动添加 · 已入库",
        entryId: createdId,
      },
      ...current.activities,
    ].slice(0, 20);
  });
  return state;
}

export function reorderModules(order: ModuleId[], novelId = "") {
  if (order.length !== moduleIds.length || new Set(order).size !== moduleIds.length) {
    throw new WorldviewError("模块顺序需要包含全部八个模块");
  }
  if (order.some((id) => !isModuleId(id))) {
    throw new WorldviewError("模块顺序里有未知模块");
  }
  return update(novelId, (state) => {
    state.order = [...order];
  });
}
