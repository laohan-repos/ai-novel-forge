import type { ChapterPlan } from "../plot/model";

export type ChapterDraft = {
  text: string;
  revision: number;
  updatedAt: string | null;
};

export type WritingTarget = Pick<ChapterPlan, "id" | "number" | "title"> & {
  updatedAt: string | null;
};

export type ChapterWriting = {
  novelTitle: string;
  chapter: ChapterPlan;
  draft: ChapterDraft;
  previousChapterId: string | null;
  nextChapterId: string | null;
};

export function manuscriptUrl(novelId: string, chapterId?: string) {
  const params = new URLSearchParams({ novelId });
  if (chapterId !== undefined) params.set("chapterId", chapterId);
  return `/api/manuscript?${params}`;
}
