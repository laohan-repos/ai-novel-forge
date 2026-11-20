"use client";

import { useEffect, useState } from "react";
import { manuscriptUrl, type ChapterDraft, type ChapterWriting, type WritingTarget } from "@/lib/manuscript/model";
import { IconBack, IconChevron, IconChevronDown, IconPencil } from "./icons";

export function WritingResume({
  novelId,
  onOpenChapter,
  onOpenChapters,
}: {
  novelId: string;
  onOpenChapter: (id: string) => void;
  onOpenChapters: () => void;
}) {
  const [target, setTarget] = useState<WritingTarget | null>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(manuscriptUrl(novelId), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("写作进度读取失败");
        const data = (await response.json()) as { target: WritingTarget | null };
        if (!controller.signal.aborted) setTarget(data.target);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [novelId, attempt]);

  return (
    <div className="rounded-[18px] border border-[#ebe7f4] bg-white p-3.5 lg:p-4">
      {target ? (
        <button
          type="button"
          onClick={() => onOpenChapter(target.id)}
          className="flex w-full items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-[#5b40db]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0ebff] text-[#5b40db]">
            <IconPencil className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-[#5b40db]">{target.updatedAt ? "继续写作" : "开始写作"}</span>
            <span className="mt-1 block break-words text-[15px] font-semibold">第{target.number}章 {target.title}</span>
          </span>
          <IconChevron className="size-4 shrink-0 text-[#5b40db]" />
        </button>
      ) : null}
      {error ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <p role="alert" className="text-[#8a4127]">写作进度读取失败</p>
          <button
            type="button"
            className="min-h-9 font-medium text-[#5b40db]"
            onClick={() => { setError(false); setAttempt((count) => count + 1); }}
          >
            重试
          </button>
        </div>
      ) : null}
      {!error && target === undefined ? <p role="status" className="text-sm text-[#707587]">正在读取写作进度…</p> : null}
      {target === null ? <p className="text-sm text-[#707587]">还没有可写的章节大纲。</p> : null}
      {target !== undefined || error ? (
        <button type="button" onClick={onOpenChapters} className="mt-2 min-h-9 text-sm font-medium text-[#5b40db] hover:underline">
          查看章节大纲
        </button>
      ) : null}
    </div>
  );
}

export function ManuscriptEditor({
  novelId,
  chapterId,
  onDirtyChange,
  onChangeChapter,
  onBack,
}: {
  novelId: string;
  chapterId: string;
  onDirtyChange: (dirty: boolean) => void;
  onChangeChapter: (id: string) => void;
  onBack: () => void;
}) {
  const [writing, setWriting] = useState<ChapterWriting | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const dirty = writing !== null && text !== writing.draft.text;
  const count = Array.from(text.replace(/\s/gu, "")).length;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(manuscriptUrl(novelId, chapterId), {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as ChapterWriting & { message?: string };
        if (!response.ok) throw new Error(body.message || "正文读取失败");
        if (controller.signal.aborted) return;
        setWriting(body);
        setText(body.draft.text);
        setSaveError("");
        setConflict(false);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error && !(error instanceof TypeError) ? error.message : "正文读取失败，请重试。");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [novelId, chapterId, loadAttempt]);

  useEffect(() => {
    onDirtyChange(dirty);
    if (!dirty) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty, onDirtyChange]);

  function reload() {
    if (dirty && !window.confirm("载入最新版本后，本次未保存的修改会被替换。继续吗？")) return;
    setLoading(true);
    setLoadError("");
    setLoadAttempt((attempt) => attempt + 1);
  }

  async function save() {
    if (!writing || !dirty || saving || loading || conflict) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/manuscript", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ novelId, chapterId, text, revision: writing.draft.revision }),
      });
      const body = (await response.json()) as { draft?: ChapterDraft; message?: string };
      if (!response.ok || !body.draft) {
        setConflict(response.status === 409);
        throw new Error(body.message || "正文保存失败，请重试。");
      }
      setWriting({ ...writing, draft: body.draft });
    } catch (error) {
      setSaveError(error instanceof Error && !(error instanceof TypeError) ? error.message : "正文保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="workbench-header flex items-start gap-2 px-3 pb-2 pt-4">
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-[#343247] hover:bg-[#edeaf6]"
        >
          <IconBack className="size-[22px]" />
        </button>
        <div className="min-w-0 py-1">
          {writing ? <p className="text-xs font-medium text-[#707587]">{writing.novelTitle}</p> : null}
          <h1 className="mt-0.5 break-words text-[18px] font-semibold tracking-tight">
            {writing ? `第${writing.chapter.number}章 ${writing.chapter.title}` : "章节正文"}
          </h1>
        </div>
      </header>

      <main className="workbench-gutter flex-1 px-4 pb-5 pt-2">
        {loadError || saveError ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f1ded5] bg-[#fff8f3] p-3 text-sm text-[#8a4127]">
            <p role="alert">{loadError || saveError}</p>
            {loadError || conflict ? (
              <button type="button" onClick={reload} className="min-h-9 font-medium underline underline-offset-2">
                {conflict ? "载入最新版本" : "重试读取"}
              </button>
            ) : null}
          </div>
        ) : null}
        {!writing && loading ? <p role="status" className="py-8 text-center text-sm text-[#707587]">正在读取正文…</p> : null}
        {writing ? (
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.4fr)] lg:gap-5">
            <section className="min-w-0 rounded-2xl border border-[#ebe7f4] bg-white px-4 lg:col-start-2 lg:row-start-1 lg:p-5">
              <h2 className="hidden text-sm font-semibold lg:block">章节大纲</h2>
              <button
                type="button"
                aria-expanded={showOutline}
                aria-controls="writing-outline"
                onClick={() => setShowOutline(!showOutline)}
                className="flex min-h-11 w-full items-center justify-between text-left text-sm font-semibold lg:hidden"
              >
                章节大纲
                <IconChevronDown className={`size-4 text-[#5b40db] ${showOutline ? "rotate-180" : ""}`} />
              </button>
              <p id="writing-outline" className={`${showOutline ? "block" : "hidden"} whitespace-pre-wrap break-words pb-3 text-sm leading-7 text-[#595e70] lg:mt-2 lg:block lg:pb-0`}>
                {writing.chapter.summary || "本章暂无大纲说明。"}
              </p>
            </section>
            <div className="min-w-0 rounded-2xl border border-[#ebe7f4] bg-white p-3 lg:col-start-1 lg:row-start-1 lg:p-5">
              <label htmlFor="manuscript-text" className="mb-2 block px-1 text-sm font-semibold">正文</label>
              <textarea
                id="manuscript-text"
                value={text}
                readOnly={loading || saving}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void save();
                  }
                }}
                placeholder="在这里写下本章正文…"
                className="block min-h-[52dvh] w-full resize-y rounded-xl border border-[#ebe7f4] bg-[#fdfcfe] px-3 py-3 text-base leading-8 text-[#242131] placeholder:text-[#858092] focus-visible:outline-2 focus-visible:outline-[#5b40db] lg:min-h-[calc(100dvh-15rem)] lg:px-5"
              />
            </div>
          </div>
        ) : null}
      </main>

      {writing ? (
        <footer className="workbench-gutter sticky bottom-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-[#ebe7f4] bg-white px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-5 lg:py-3">
          <nav aria-label="章节导航" className="col-span-2 row-start-2 flex justify-between gap-2 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:justify-start">
            <button
              type="button"
              disabled={!writing.previousChapterId}
              onClick={() => writing.previousChapterId && onChangeChapter(writing.previousChapterId)}
              className="min-h-10 rounded-lg px-2 text-sm font-medium text-[#5b40db] hover:bg-[#f6f4fc] disabled:text-[#a1a3ad]"
            >
              上一章
            </button>
            <button
              type="button"
              disabled={!writing.nextChapterId}
              onClick={() => writing.nextChapterId && onChangeChapter(writing.nextChapterId)}
              className="min-h-10 rounded-lg px-2 text-sm font-medium text-[#5b40db] hover:bg-[#f6f4fc] disabled:text-[#a1a3ad]"
            >
              下一章
            </button>
          </nav>
          <p role="status" className="flex flex-wrap gap-x-2 text-xs text-[#666b7a]">
            <span className="tabular-nums">{count.toLocaleString("zh-CN")} 字</span>
            <span>{saving ? "正在保存" : saveError ? "保存失败" : dirty ? "有未保存的修改" : writing.draft.updatedAt ? "已保存" : "尚未保存"}</span>
          </p>
          <button
            type="button"
            disabled={!dirty || saving || loading || conflict}
            onClick={() => void save()}
            className="min-h-11 rounded-xl bg-[#5b40db] px-4 text-sm font-semibold text-white hover:bg-[#4e36c4] disabled:bg-[#e9e4f7] disabled:text-[#6c6389] lg:px-5"
          >
            保存正文
          </button>
        </footer>
      ) : null}
    </div>
  );
}
