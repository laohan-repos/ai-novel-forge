import { connection } from "next/server";
import { PlotError, addAuthorThread, addAuthorVolume, optimizeAuthorPlot, readPlot } from "@/lib/plot/store";

export async function GET(request: Request) {
  await connection();
  const novelId = new URL(request.url).searchParams.get("novelId") ?? "";
  try {
    return Response.json({ plot: readPlot(novelId) });
  } catch (error) {
    const message = error instanceof PlotError ? error.message : "读取失败";
    const status = error instanceof PlotError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = (await request.json()) as {
      novelId?: string;
      action?: string;
      kind?: string;
      title?: string;
      summary?: string;
    };
    const novelId = body.novelId ?? "";
    if (body.action === "add_thread") {
      const result = addAuthorThread(novelId, body.kind ?? "", body.title ?? "", body.summary ?? "");
      return Response.json({ plot: result.plot });
    }
    if (body.action === "add_volume") {
      const result = addAuthorVolume(novelId);
      return Response.json({ plot: result.plot });
    }
    if (body.action === "optimize") {
      const result = optimizeAuthorPlot(novelId);
      return Response.json({ plot: result.plot, message: result.message });
    }
    return Response.json({ message: "未知操作" }, { status: 400 });
  } catch (error) {
    const message = error instanceof PlotError ? error.message : "保存失败";
    const status = error instanceof PlotError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}
