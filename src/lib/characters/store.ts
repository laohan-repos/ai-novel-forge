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
import { currentNovelId, readNovel } from "../novels/store";
import { novelVolumes } from "../worldview/model";
import { readWorldview } from "../worldview/store";
import {
  attachKnownRelations,
  auditConsistency as auditConsistencyOf,
  buildCharacterScheme,
  characterContext,
  characterProfile,
  commitCharacterChanges,
  ensureCharacterShape,
  proposeCharacterChanges,
  reviewPackage as reviewPackageOf,
  searchCharacterArchive,
  validateCharacterArchive,
} from "./operations";
import {
  emptyArchive,
  fanchenCharacters,
  isCharacterRole,
  type Character,
  type CharacterArchive,
  type CharacterProposal,
  type CharacterRole,
} from "./model";

export class CharacterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterError";
  }
}

function novelKey(novelId: string) {
  const id = novelId.trim();
  if (!/^[a-z0-9-]+$/.test(id) || !readNovel(id)) throw new CharacterError("小说不存在");
  return id;
}

function activeId(novelId = "") {
  return novelKey(novelId.trim() || currentNovelId());
}

function archivePath(novelId: string) {
  return join(process.cwd(), "data", `characters-${novelKey(novelId)}.json`);
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
      if (Date.now() - started > 3000) throw new CharacterError("人物档案正在被占用");
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

function writeUnlocked(filePath: string, archive: CharacterArchive) {
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(archive, null, 2)}\n`);
  renameSync(temporary, filePath);
}

function readUnlocked(novelId: string): CharacterArchive {
  const filePath = archivePath(novelId);
  if (!existsSync(filePath)) {
    const archive = novelId === "fanchen-wendao" ? fanchenCharacters() : emptyArchive();
    writeUnlocked(filePath, archive);
    return archive;
  }
  const archive = JSON.parse(readFileSync(filePath, "utf8")) as CharacterArchive;
  const stale =
    novelId === "fanchen-wendao" &&
    archive.characters.length > 0 &&
    archive.characters.every((character) => !character.realm);
  if (stale) {
    const fresh = fanchenCharacters();
    fresh.revision = archive.revision + 1;
    writeUnlocked(filePath, fresh);
    return fresh;
  }
  const shaped = ensureCharacterShape(archive);
  const seeded = attachKnownRelations(novelId, archive);
  const dirty = shaped || seeded;
  if (dirty) {
    archive.revision += 1;
    writeUnlocked(filePath, archive);
  }
  return archive;
}

export function readCharacters(novelId: string) {
  const id = novelKey(novelId);
  return withLock(archivePath(id), () => readUnlocked(id));
}

export function createCharacter(
  novelId: string,
  input: {
    name: string;
    role: string;
    gender: string;
    age: string;
    identity: string;
    summary: string;
    realm?: string;
    tagline?: string;
    imageId?: string;
  },
) {
  const name = input.name.trim();
  if (!name) throw new CharacterError("姓名不能为空");
  if (!isCharacterRole(input.role)) throw new CharacterError("请选择角色定位");
  const role: CharacterRole = input.role;
  const imageId = input.imageId?.trim() || "";
  const id = novelKey(novelId);
  if (imageId && !hasImage(id, imageId)) throw new CharacterError("图片不存在");
  const filePath = archivePath(id);
  return withLock(filePath, () => {
    const archive = readUnlocked(id);
    if (archive.characters.some((item) => item.name === name)) {
      throw new CharacterError(`「${name}」已经在人物档案里`);
    }
    const character: Character = {
      id: `char-${Date.now()}`,
      name,
      role,
      gender: input.gender.trim() || "未填",
      age: input.age.trim(),
      identity: input.identity.trim() || "未填",
      realm: input.realm?.trim() || "",
      tagline: input.tagline?.trim() || "",
      summary: input.summary.trim() || "尚未填写人物简介。",
      portrait: archive.characters.length % 9,
      image: imageId || null,
      status: "confirmed",
      relations: [],
      knowledge: [],
      growth: [],
      anchors: [],
    };
    archive.characters.push(character);
    archive.revision += 1;
    writeUnlocked(filePath, archive);
    return { archive, character };
  });
}

function outlineVolumes(novelId: string) {
  if (novelId === "fanchen-wendao") return novelVolumes;
  return [
    {
      id: "v1",
      title: "第一卷·未命名",
      status: "pending" as const,
      written: 0,
      total: 40,
    },
  ];
}

function mutate(novelId: string, change: (archive: CharacterArchive) => { save: boolean }) {
  const id = activeId(novelId);
  const filePath = archivePath(id);
  return withLock(filePath, () => {
    const archive = readUnlocked(id);
    const result = change(archive);
    if (result.save) {
      archive.revision += 1;
      writeUnlocked(filePath, archive);
    }
    return { ...result, revision: archive.revision };
  });
}

export function generateCharacters(novelId = "") {
  const id = activeId(novelId);
  const novel = readNovel(id);
  if (!novel) throw new CharacterError("小说不存在");
  return buildCharacterScheme({
    novel,
    world: readWorldview(id),
    volumes: outlineVolumes(id),
    archive: readCharacters(id),
  });
}

export function getCharacter(novelId: string, name: string) {
  const id = activeId(novelId);
  const archive = readCharacters(id);
  const profile = characterProfile(archive, name);
  if (!profile) throw new CharacterError(`人物档案里没有「${name.trim() || "未命名"}」`);
  const character = archive.characters.find((item) => item.name === name.trim());
  const pendingImage = archive.changes.find((change) => change.name === character?.name && change.image)?.image ?? null;
  return {
    ...profile,
    image: mediaUrl(id, character?.image),
    pendingImage: mediaUrl(id, pendingImage),
  };
}

export function searchCharacters(novelId: string, query: string) {
  const keyword = query.trim();
  if (!keyword) throw new CharacterError("请提供搜索内容");
  return searchCharacterArchive(readCharacters(activeId(novelId)), keyword);
}

export function getCharacterContext(novelId: string, chapter: number, names: string[] = []) {
  if (!Number.isInteger(chapter) || chapter < 1) throw new CharacterError("请提供有效的章节号");
  const id = activeId(novelId);
  return characterContext(readCharacters(id), outlineVolumes(id), chapter, names);
}

export function proposeCharacters(novelId: string, proposals: CharacterProposal[]) {
  const id = activeId(novelId);
  const ready: CharacterProposal[] = [];
  const early: Array<{ name: string; message: string }> = [];
  for (const proposal of proposals) {
    const path = proposal.imagePath?.trim();
    if (!path) {
      ready.push(proposal);
      continue;
    }
    try {
      ready.push({ ...proposal, imageId: saveImageFile(id, path) });
    } catch (error) {
      early.push({
        name: proposal.name,
        message: error instanceof ImageError ? error.message : "图片没有读到",
      });
    }
  }
  if (ready.length === 0) {
    if (early.length > 0) return { created: [], updated: [], conflicts: early, revision: readCharacters(id).revision };
    throw new CharacterError("至少提供一条人物变更");
  }
  let failure = "";
  const result = mutate(id, (archive) => {
    const next = proposeCharacterChanges(archive, ready);
    if ("error" in next && next.error) failure = next.error;
    return next;
  });
  if (failure) throw new CharacterError(failure);
  const conflicts = "conflicts" in result && Array.isArray(result.conflicts) ? result.conflicts : [];
  return { ...result, conflicts: [...conflicts, ...early] };
}

export function commitCharacters(novelId: string, changeIds: string[], names: string[]) {
  let failure = "";
  const result = mutate(novelId, (archive) => {
    const next = commitCharacterChanges(archive, changeIds, names);
    if ("error" in next && next.error) failure = next.error;
    return next;
  });
  if (failure) throw new CharacterError(failure);
  return result;
}

export function validateCharacters(novelId: string, chapter?: number) {
  return validateCharacterArchive(readCharacters(activeId(novelId)), chapter);
}

export function auditConsistency(novelId: string) {
  const id = activeId(novelId);
  return auditConsistencyOf(readWorldview(id), readCharacters(id));
}

export function reviewPackage(novelId: string) {
  const id = activeId(novelId);
  return reviewPackageOf(readWorldview(id), readCharacters(id));
}
