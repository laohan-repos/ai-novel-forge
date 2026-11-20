import { connection } from "next/server";
import { NovelError, createNovel, deleteNovel, openNovel, readNovels, renameNovel } from "@/lib/novels/store";
import { syncNovelTitle } from "@/lib/worldview/store";

export async function GET() {
  await connection();
  return Response.json({ catalog: readNovels() });
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      title?: string;
      genre?: string;
      premise?: string;
      targetWan?: number;
    };
    if (body.action === "open") {
      return Response.json({ catalog: openNovel(body.id ?? "") });
    }
    if (body.action === "rename") {
      const result = renameNovel({ title: body.title ?? "", novelId: body.id });
      if (result.changed) {
        syncNovelTitle(result.novel.id, result.previousTitle, result.novel.title);
      }
      return Response.json({ catalog: result.catalog, novel: result.novel });
    }
    if (body.action === "delete") {
      const result = deleteNovel({ novelId: body.id, title: body.title });
      return Response.json({ catalog: result.catalog, novel: result.novel });
    }
    if (body.action === "create") {
      const result = createNovel({
        title: body.title ?? "",
        genre: body.genre,
        premise: body.premise,
        targetWan: body.targetWan,
      });
      return Response.json({ catalog: result.catalog, novel: result.novel });
    }
    throw new NovelError("未知操作");
  } catch (error) {
    const message = error instanceof NovelError ? error.message : "保存失败";
    const status = error instanceof NovelError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}
