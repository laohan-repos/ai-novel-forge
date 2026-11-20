import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withNovel } from "../novels/store";
import { activeChapters } from "../plot/operations";
import { readPlot } from "../plot/store";
import type { ChapterDraft, ChapterWriting, WritingTarget } from "./model";

type SavedDraft = ChapterDraft & { chapterId: string };

const emptyDraft: ChapterDraft = { text: "", revision: 0, updatedAt: null };

export class ManuscriptError extends Error {
  constructor(message: string, readonly status: 404 | 409) {
    super(message);
    this.name = "ManuscriptError";
  }
}

function manuscriptPath(novelId: string) {
  return join(process.cwd(), "data", `manuscript-${novelId}.json`);
}

// Drafts are stored in last-saved order, newest first.
function readDrafts(filePath: string): SavedDraft[] {
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, "utf8")) as SavedDraft[];
}

function writingChapters(novelId: string) {
  return activeChapters(readPlot(novelId)).sort((a, b) => a.number - b.number);
}

export function readWritingTarget(novelId: string): WritingTarget | null {
  const chapters = writingChapters(novelId);
  const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return withNovel(novelId, () => {
    const draft = readDrafts(manuscriptPath(novelId)).find((item) => byId.has(item.chapterId));
    const chapter = draft ? byId.get(draft.chapterId) : chapters.find((item) => item.status !== "done") ?? chapters[0];
    if (!chapter) return null;
    return { id: chapter.id, number: chapter.number, title: chapter.title, updatedAt: draft?.updatedAt ?? null };
  });
}

export function readChapterWriting(novelId: string, chapterId: string): ChapterWriting {
  const chapters = writingChapters(novelId);
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index === -1) throw new ManuscriptError("这个章节大纲已不存在", 404);

  return withNovel(novelId, (novel) => {
    const draft = readDrafts(manuscriptPath(novelId)).find((item) => item.chapterId === chapterId);
    return {
      novelTitle: novel.title,
      chapter: chapters[index],
      draft: draft ?? emptyDraft,
      previousChapterId: chapters[index - 1]?.id ?? null,
      nextChapterId: chapters[index + 1]?.id ?? null,
    };
  });
}

export function saveChapterDraft(novelId: string, chapterId: string, text: string, revision: number): ChapterDraft {
  if (!writingChapters(novelId).some((chapter) => chapter.id === chapterId)) {
    throw new ManuscriptError("这个章节大纲已不存在", 404);
  }

  return withNovel(novelId, () => {
    const filePath = manuscriptPath(novelId);
    const drafts = readDrafts(filePath);
    const current = drafts.find((item) => item.chapterId === chapterId) ?? emptyDraft;
    if (current.text === text) return current;
    if (current.revision !== revision) {
      throw new ManuscriptError("另一处已保存了这章的新版本，当前修改仍在编辑器里。", 409);
    }

    const draft: SavedDraft = { chapterId, text, revision: revision + 1, updatedAt: new Date().toISOString() };
    const next = [draft, ...drafts.filter((item) => item.chapterId !== chapterId)];
    const temporary = `${filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(temporary, filePath);
    return draft;
  });
}
