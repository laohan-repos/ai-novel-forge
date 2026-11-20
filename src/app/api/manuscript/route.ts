import { connection } from "next/server";
import { ManuscriptError, readChapterWriting, readWritingTarget, saveChapterDraft } from "@/lib/manuscript/store";
import { NovelError } from "@/lib/novels/store";
import { PlotError } from "@/lib/plot/store";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ManuscriptError) return Response.json({ message: error.message }, { status: error.status });
  if (error instanceof NovelError || error instanceof PlotError) {
    return Response.json({ message: error.message }, { status: 400 });
  }
  return Response.json({ message: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const novelId = params.get("novelId")?.trim();
  const chapterId = params.get("chapterId");
  if (!novelId) return Response.json({ message: "请选择小说" }, { status: 400 });
  try {
    if (chapterId === null) return Response.json({ target: readWritingTarget(novelId) });
    return Response.json(readChapterWriting(novelId, chapterId));
  } catch (error) {
    return errorResponse(error, "正文读取失败");
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    typeof body?.novelId !== "string" || !body.novelId.trim() ||
    typeof body.chapterId !== "string" || !body.chapterId ||
    typeof body.text !== "string" ||
    typeof body.revision !== "number" || !Number.isSafeInteger(body.revision) || body.revision < 0
  ) {
    return Response.json({ message: "正文或章节信息无效" }, { status: 400 });
  }
  try {
    return Response.json({ draft: saveChapterDraft(body.novelId.trim(), body.chapterId, body.text, body.revision) });
  } catch (error) {
    return errorResponse(error, "正文保存失败");
  }
}
