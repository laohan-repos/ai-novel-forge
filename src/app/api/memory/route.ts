import { connection } from "next/server";
import { MemoryError, readMemory } from "@/lib/memory/store";

export async function GET(request: Request) {
  await connection();
  const novelId = new URL(request.url).searchParams.get("novelId") ?? "";
  try {
    return Response.json({ memory: readMemory(novelId) });
  } catch (error) {
    const message = error instanceof MemoryError ? error.message : "读取失败";
    const status = error instanceof MemoryError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}
