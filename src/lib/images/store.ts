import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

const maxBytes = 4 * 1024 * 1024;

type ImageKind = { ext: "png" | "jpg" | "webp" | "gif"; type: string };

export function mediaUrl(novelId: string, imageId: string | null | undefined) {
  if (!imageId) return null;
  return `/api/media?novelId=${encodeURIComponent(novelId)}&id=${encodeURIComponent(imageId)}`;
}

function novelDir(novelId: string) {
  const id = novelId.trim();
  if (!/^[a-z0-9-]+$/.test(id)) throw new ImageError("小说不存在");
  return join(process.cwd(), "data", "images", id);
}

function kindOf(bytes: Buffer): ImageKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", type: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", type: "image/jpeg" };
  }
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF87a") return { ext: "gif", type: "image/gif" };
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") return { ext: "gif", type: "image/gif" };
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", type: "image/webp" };
  }
  return null;
}

function checked(bytes: Buffer) {
  if (bytes.length === 0) throw new ImageError("图片是空的");
  if (bytes.length > maxBytes) throw new ImageError("图片不能超过 4MB");
  const kind = kindOf(bytes);
  if (!kind) throw new ImageError("只接受 PNG、JPEG、WEBP 或 GIF");
  return kind;
}

export function saveImageBytes(novelId: string, bytes: Buffer) {
  const kind = checked(bytes);
  const id = `img-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const dir = novelDir(novelId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.${kind.ext}`), bytes);
  return id;
}

export function saveImageFile(novelId: string, filePath: string) {
  const target = filePath.trim();
  if (!target || !existsSync(target) || !statSync(target).isFile()) throw new ImageError("找不到这张图片");
  return saveImageBytes(novelId, readFileSync(target));
}

export function hasImage(novelId: string, imageId: string) {
  return imagePath(novelId, imageId) !== null;
}

export function readImage(novelId: string, imageId: string) {
  const filePath = imagePath(novelId, imageId);
  if (!filePath) return null;
  const body = readFileSync(filePath);
  const kind = kindOf(body);
  if (!kind) return null;
  return { body, type: kind.type };
}

export function removeNovelImages(novelId: string) {
  if (!/^[a-z0-9-]+$/.test(novelId)) return;
  rmSync(join(process.cwd(), "data", "images", novelId), { recursive: true, force: true });
}

function imagePath(novelId: string, imageId: string) {
  if (!/^img-[a-z0-9]+$/.test(imageId)) return null;
  let dir: string;
  try {
    dir = novelDir(novelId);
  } catch {
    return null;
  }
  for (const ext of ["png", "jpg", "webp", "gif"]) {
    const filePath = join(dir, `${imageId}.${ext}`);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}
