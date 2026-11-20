import { connection } from "next/server";
import { CharacterError, createCharacter, readCharacters } from "@/lib/characters/store";

export async function GET(request: Request) {
  await connection();
  const novelId = new URL(request.url).searchParams.get("novelId") ?? "";
  try {
    return Response.json({ archive: readCharacters(novelId) });
  } catch (error) {
    const message = error instanceof CharacterError ? error.message : "读取失败";
    const status = error instanceof CharacterError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = (await request.json()) as {
      novelId?: string;
      name?: string;
      role?: string;
      gender?: string;
      age?: string;
      identity?: string;
      summary?: string;
      realm?: string;
      tagline?: string;
      imageId?: string;
    };
    const result = createCharacter(body.novelId ?? "", {
      name: body.name ?? "",
      role: body.role ?? "",
      gender: body.gender ?? "",
      age: body.age ?? "",
      identity: body.identity ?? "",
      summary: body.summary ?? "",
      realm: body.realm,
      tagline: body.tagline,
      imageId: body.imageId,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof CharacterError ? error.message : "保存失败";
    const status = error instanceof CharacterError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}
