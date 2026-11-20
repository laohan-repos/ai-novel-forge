"use client";

export function mediaUrl(novelId: string, imageId?: string | null) {
  if (!imageId) return "";
  return `/api/media?novelId=${encodeURIComponent(novelId)}&id=${encodeURIComponent(imageId)}`;
}

export function Picture({
  novelId,
  imageId,
  className,
  alt,
}: {
  novelId: string;
  imageId?: string | null;
  className?: string;
  alt: string;
}) {
  if (!imageId) return null;
  return <img src={mediaUrl(novelId, imageId)} alt={alt} className={`${className ?? ""} object-cover`} />;
}

export async function uploadImage(novelId: string, file: File) {
  const body = new FormData();
  body.set("novelId", novelId);
  body.set("file", file);
  const response = await fetch("/api/media", { method: "POST", body, cache: "no-store" });
  const data = (await response.json()) as { id?: string; message?: string };
  if (!response.ok || !data.id) throw new Error(data.message || "图片保存失败");
  return data.id;
}
