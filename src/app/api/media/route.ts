import { connection } from "next/server";
import { ImageError, mediaUrl, readImage, saveImageBytes } from "@/lib/images/store";
import { readNovel } from "@/lib/novels/store";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const novelId = url.searchParams.get("novelId") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const image = readImage(novelId, id);
  if (!image) return new Response("找不到图片", { status: 404 });
  return new Response(new Uint8Array(image.body), {
    headers: { "content-type": image.type, "cache-control": "private, max-age=86400" },
  });
}

export async function POST(request: Request) {
  await connection();
  try {
    const form = await request.formData();
    const novelId = String(form.get("novelId") ?? "");
    if (!/^[a-z0-9-]+$/.test(novelId) || !readNovel(novelId)) {
      return Response.json({ message: "小说不存在" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ message: "请选择图片" }, { status: 400 });
    const id = saveImageBytes(novelId, Buffer.from(await file.arrayBuffer()));
    return Response.json({ id, url: mediaUrl(novelId, id) });
  } catch (error) {
    const message = error instanceof ImageError ? error.message : "图片保存失败";
    const status = error instanceof ImageError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}
