"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  fanchenCharacters,
  isCoreRole,
  roleLabels,
  type Character,
  type CharacterArchive,
  type CharacterRole,
} from "@/lib/characters/model";
import { IconBack, IconChevron, IconPerson, IconPlus, IconSearch } from "./icons";
import { Picture, uploadImage } from "./picture";

type Filter = "featured" | "all" | "core" | "important" | "ordinary";

const aiPool: Array<{
  name: string;
  role: CharacterRole;
  gender: string;
  age: string;
  identity: string;
  realm: string;
  tagline: string;
  summary: string;
}> = [
  {
    name: "青鸾",
    role: "important",
    gender: "女",
    age: "26岁",
    identity: "隐修",
    realm: "金丹中期",
    tagline: "青云宗隐修 · 只在月夜现身",
    summary: "青云宗不入名册的隐修，只在月夜到后山，把听到的风声留给陆沉一句。",
  },
  {
    name: "谢无咎",
    role: "supporting",
    gender: "男",
    age: "34岁",
    identity: "客栈账房",
    realm: "凡人",
    tagline: "客栈账房 · 记得每一笔没结的账",
    summary: "青云城外客栈的账房，不修仙，却把修士欠下的人情一笔笔记得比灵石还清。",
  },
];

const roleOptions: CharacterRole[] = ["protagonist", "heroine", "major", "important", "supporting"];

const looks = [
  { bg: "#d7e3f3", skin: "#f2c9a8", hair: "#241c18", cloth: "#3c4c63", style: "short" },
  { bg: "#f3e4ef", skin: "#f6d2bc", hair: "#c7b5a4", cloth: "#e7d3c4", style: "long" },
  { bg: "#e4eaf2", skin: "#efc3a2", hair: "#1c1a22", cloth: "#5d6d86", style: "side" },
  { bg: "#efe7f6", skin: "#f4cbb4", hair: "#3a2a28", cloth: "#d9c2cf", style: "long" },
  { bg: "#e5eef0", skin: "#e8b892", hair: "#2a241c", cloth: "#6d7c72", style: "short" },
  { bg: "#ece6dc", skin: "#e2b08a", hair: "#3a322c", cloth: "#8d7b68", style: "beard" },
  { bg: "#e7eef8", skin: "#f3cbb3", hair: "#2c2428", cloth: "#7f93b2", style: "flower" },
  { bg: "#e8eee8", skin: "#ecc09a", hair: "#1e1c1a", cloth: "#5f6a62", style: "side" },
  { bg: "#e6eef6", skin: "#e4c3a6", hair: "#f3f0e8", cloth: "#d5dbe6", style: "elder" },
] as const;

function CharacterPortrait({
  novelId,
  portrait,
  imageId,
  className,
}: {
  novelId: string;
  portrait: number;
  imageId?: string | null;
  className?: string;
}) {
  if (imageId) return <Picture novelId={novelId} imageId={imageId} alt="" className={className} />;
  const look = looks[portrait] ?? looks[portrait % looks.length] ?? looks[0];
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <rect width="80" height="80" fill={look.bg} />
      <ellipse cx="40" cy="78" rx="28" ry="20" fill={look.cloth} />
      <path d="M24 62c4-8 10-12 16-12s12 4 16 12" fill="#f7d7c2" />
      <circle cx="40" cy="36" r="16" fill={look.skin} />
      {look.style === "long" ? (
        <path d="M22 34c2-16 10-22 18-22s16 6 18 22c-2 6-2 20-4 28-8-6-20-6-28 0-2-8-2-22-4-28Z" fill={look.hair} />
      ) : null}
      {look.style === "short" ? (
        <path d="M24 34c1-14 8-20 16-20s15 6 16 20c-2 2-4 3-8 2 2-6-2-8-8-8s-10 2-8 8c-4 1-6 0-8-2Z" fill={look.hair} />
      ) : null}
      {look.style === "side" ? (
        <path d="M23 36c2-16 9-22 18-22 8 0 14 5 16 16-6 2-8 6-8 10 2-8-4-12-10-12-8 0-12 6-10 14-4-1-6-3-6-6Z" fill={look.hair} />
      ) : null}
      {look.style === "beard" ? (
        <>
          <path d="M24 34c1-14 8-20 16-20s15 6 16 20c-3 1-5 2-9 1 1-7-3-9-7-9s-8 2-7 9c-4 1-6 0-9-1Z" fill={look.hair} />
          <path d="M32 48c2 6 5 8 8 8s6-2 8-8c-3 2-5 3-8 3s-5-1-8-3Z" fill="#c9a08a" />
        </>
      ) : null}
      {look.style === "elder" ? (
        <>
          <path d="M24 34c1-14 8-20 16-20s15 6 16 20c-3 1-5 2-9 1 1-7-3-9-7-9s-8 2-7 9c-4 1-6 0-9-1Z" fill={look.hair} />
          <path d="M30 46c3 8 6 11 10 11s7-3 10-11c-4 3-7 4-10 4s-6-1-10-4Z" fill="#efeae2" />
        </>
      ) : null}
      {look.style === "flower" ? (
        <>
          <path d="M22 34c2-16 10-22 18-22s16 6 18 22c-2 4-3 14-5 22-7-6-17-6-26 0-2-8-3-18-5-22Z" fill={look.hair} />
          <circle cx="54" cy="30" r="4" fill="#7ea2d6" />
        </>
      ) : null}
      <path d="M33 36h3M45 36h3" stroke="#6d5348" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M37 43c2 2 4 2 6 0" stroke="#c9897a" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function metaLine(character: Character) {
  return [character.gender, character.age, character.identity].filter(Boolean).join(" · ");
}

export function Characters({
  novelId,
  novelTitle,
  onBack,
}: {
  novelId: string;
  novelTitle: string;
  onBack: () => void;
}) {
  const [archive, setArchive] = useState<CharacterArchive>(() =>
    novelId === "fanchen-wendao" ? fanchenCharacters() : { revision: 0, characters: [], changes: [], history: [] },
  );
  const [filter, setFilter] = useState<Filter>("featured");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");
  const revisionRef = useRef(0);
  const creatingRef = useRef(false);
  creatingRef.current = creating;

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      if (creatingRef.current) return;
      try {
        const response = await fetch(`/api/characters?novelId=${encodeURIComponent(novelId)}`, {
          cache: "no-store",
        });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as { archive?: CharacterArchive };
        if (!data.archive || stopped) return;
        if (data.archive.revision < revisionRef.current) return;
        revisionRef.current = data.archive.revision;
        setArchive(data.archive);
      } catch {
        // Keep the list on screen if the file is briefly locked.
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [novelId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selected = archive.characters.find((item) => item.id === selectedId) ?? null;
  const keyword = query.trim();
  const visible = archive.characters.filter((character) => {
    if (filter === "core" && !isCoreRole(character.role)) return false;
    if (filter === "important" && character.role !== "important") return false;
    if (filter === "ordinary" && character.role !== "supporting") return false;
    if (filter === "featured" && !isCoreRole(character.role) && character.role !== "important") return false;
    if (!keyword) return true;
    const haystack = `${character.name} ${character.tagline} ${character.identity} ${character.summary}`;
    return haystack.includes(keyword);
  });
  const coreCount = archive.characters.filter((item) => isCoreRole(item.role)).length;
  const importantCount = archive.characters.filter((item) => item.role === "important").length;
  const ordinaryCount = archive.characters.filter((item) => item.role === "supporting").length;
  const sectionTitle =
    filter === "all" ? "全部角色" : filter === "core" ? "核心人物" : filter === "important" ? "重要配角" : filter === "ordinary" ? "普通角色" : "主要人物";

  async function saveCharacter(input: {
    name: string;
    role: CharacterRole;
    gender: string;
    age: string;
    identity: string;
    summary: string;
    realm: string;
    tagline: string;
    imageId?: string;
  }) {
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ novelId, ...input }),
      cache: "no-store",
    });
    const data = (await response.json()) as { archive?: CharacterArchive; message?: string };
    if (!response.ok || !data.archive) {
      setToast(data.message ?? "保存失败");
      return false;
    }
    revisionRef.current = data.archive.revision;
    setArchive(data.archive);
    setCreating(false);
    setToast("已加入人物档案");
    return true;
  }

  const names = new Set(archive.characters.map((character) => character.name));
  const relations = archive.characters.flatMap((character) =>
    (character.relations ?? [])
      .filter((relation) => !relation.pending)
      .map((relation) => [character.name, relation.targetName, relation.summary] as const),
  );
  const openChanges = archive.changes ?? [];

  async function generateCharacter() {
    const next = aiPool.find((item) => !names.has(item.name));
    if (!next) {
      setToast("暂时没有新的角色可生成");
      return;
    }
    setGenerating(true);
    await saveCharacter(next);
    setGenerating(false);
  }

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col bg-[#f6f7fb]">
      <header className="flex items-center gap-1 px-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="返回"
          onClick={() => {
            if (selected || relationsOpen) {
              setSelectedId(null);
              setRelationsOpen(false);
              return;
            }
            onBack();
          }}
          className="grid size-10 place-items-center rounded-full text-[#5b40db] active:bg-black/5"
        >
          {selected || relationsOpen ? <IconBack className="size-[22px] text-[#1c1e28]" /> : <IconPerson className="size-6" />}
        </button>
        {searching && !selected ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索人物"
            className="h-9 min-w-0 flex-1 rounded-full bg-white px-3 text-[14px] outline-none ring-1 ring-[#eceef3]"
            autoFocus
          />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-tight">
            {selected ? selected.name : "人物档案"}
          </h1>
        )}
        <button
          type="button"
          aria-label="搜索"
          onClick={() => {
            setSelectedId(null);
            setSearching((open) => !open);
            if (searching) setQuery("");
          }}
          className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
        >
          <IconSearch className="size-[22px]" />
        </button>
        <button
          type="button"
          aria-label="筛选"
          onClick={() =>
            setFilter((current) => {
              const order: Filter[] = ["featured", "all", "core", "important", "ordinary"];
              return order[(order.indexOf(current) + 1) % order.length] ?? "featured";
            })
          }
          className="grid size-10 place-items-center rounded-full text-[#1c1e28] active:bg-black/5"
        >
          <FilterIcon className="size-5" />
        </button>
      </header>

      {selected ? (
        <article className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,28,48,0.045)]">
            <CharacterPortrait novelId={novelId} portrait={selected.portrait} imageId={shownImage(selected, openChanges)} className="size-16 shrink-0 rounded-2xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-[20px] font-semibold leading-none">{selected.name}</h2>
                <RoleBadge role={selected.role} />
                {selected.status === "pending" || openChanges.some((change) => change.name === selected.name) ? <PendingPill /> : null}
                {selected.realm ? <RealmPill realm={selected.realm} /> : null}
              </div>
              <p className="mt-2 text-[13px] text-[#8e929c]">{selected.tagline || metaLine(selected)}</p>
            </div>
          </div>
          <p className="mt-4 px-1 text-[15px] leading-7 text-[#2a2c36]">{selected.summary}</p>
          {relations.some(([left, right]) => left === selected.name || right === selected.name) ? (
            <ul className="mt-4 flex flex-col gap-2">
              {relations
                .filter(([left, right]) => left === selected.name || right === selected.name)
                .map(([left, right, detail]) => (
                  <li key={`${left}-${right}`} className="rounded-2xl bg-white px-4 py-3 text-[14px]">
                    <span className="font-semibold">{left}</span>
                    <span className="mx-1.5 text-[#b0b4c0]">—</span>
                    <span className="font-semibold">{right}</span>
                    <p className="mt-1 text-[13px] text-[#8e929c]">{detail}</p>
                  </li>
                ))}
            </ul>
          ) : null}
          {openChanges.some((change) => change.name === selected.name) ? (
            <p className="mt-4 rounded-2xl bg-[#fff6e8] px-4 py-3 text-[13px] leading-6 text-[#9a6230]">
              有待确认的变更。确认前，卡片上仍是当前正史。
            </p>
          ) : null}
        </article>
      ) : relationsOpen ? (
        <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3">
          <h2 className="px-1 text-[18px] font-semibold">关系网络</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {relations.length === 0 ? (
              <li className="rounded-2xl bg-white px-4 py-8 text-center text-[13px] text-[#9aa0ae]">还没有记下人物关系。</li>
            ) : (
              relations.map(([left, right, detail]) => (
                <li key={`${left}-${right}`} className="rounded-2xl bg-white px-4 py-3 text-[14px] shadow-[0_8px_24px_rgba(28,28,48,0.04)]">
                  <span className="font-semibold">{left}</span>
                  <span className="mx-1.5 text-[#b0b4c0]">—</span>
                  <span className="font-semibold">{right}</span>
                  <p className="mt-1 text-[13px] text-[#8e929c]">{detail}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">
            <section className="relative h-[132px] overflow-hidden rounded-[20px] shadow-[0_12px_28px_rgba(36,64,96,0.16)]">
              <CharacterBanner className="absolute inset-0 h-full w-full" />
              <div className="relative flex h-full flex-col justify-end px-4 pb-3.5 pt-3">
                <span className="w-fit rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium leading-none text-[#3c4654]">
                  {novelTitle}
                </span>
                <h2 className="mt-2 text-[26px] font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                  人物档案
                </h2>
                <p className="mt-1.5 text-[12px] text-white/90">管理角色设定、成长历程与关系网络</p>
              </div>
            </section>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <StatCard label="全部角色" value={archive.characters.length} active={filter === "all"} onClick={() => setFilter("all")} icon={<SearchStat />} />
              <StatCard label="核心人物" value={coreCount} active={filter === "core"} onClick={() => setFilter("core")} icon={<CrownStat />} />
              <StatCard label="重要配角" value={importantCount} active={filter === "important"} onClick={() => setFilter("important")} icon={<PeopleStat />} />
              <StatCard label="普通角色" value={ordinaryCount} active={filter === "ordinary"} onClick={() => setFilter("ordinary")} icon={<PersonStat />} />
            </div>

            <div className="mb-2.5 mt-4 flex items-center justify-between px-0.5">
              <h2 className="text-[18px] font-semibold tracking-tight">{sectionTitle}</h2>
              <button type="button" onClick={() => setRelationsOpen(true)} className="flex items-center text-[13px] text-[#9aa0ae]">
                查看关系图
                <IconChevron className="size-4" />
              </button>
            </div>

            <ul className="flex flex-col gap-2.5">
              {visible.length === 0 ? (
                <li className="rounded-2xl bg-white px-4 py-8 text-center text-[13px] text-[#9aa0ae]">
                  {archive.characters.length === 0 ? "还没有人物。可以新建，或让 AI 生成。" : "没有符合条件的人物。"}
                </li>
              ) : (
                visible.map((character) => {
                  const lead = character.role === "protagonist";
                  return (
                    <li key={character.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(character.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-3 text-left shadow-[0_8px_24px_rgba(28,28,48,0.04)] active:bg-[#fafafc] ${
                          lead ? "ring-1 ring-[#cfc3ff]" : ""
                        }`}
                      >
                        <CharacterPortrait novelId={novelId} portrait={character.portrait} imageId={shownImage(character, openChanges)} className="size-[52px] shrink-0 rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[16px] font-semibold leading-none text-[#1c1e28]">{character.name}</span>
                            <RoleBadge role={character.role} />
                            {character.status === "pending" || openChanges.some((change) => change.name === character.name) ? <PendingPill /> : null}
                            {character.realm ? <RealmPill realm={character.realm} /> : null}
                          </span>
                          <span className="mt-1.5 block truncate text-[12px] leading-none text-[#8e929c]">
                            {character.tagline || metaLine(character)}
                          </span>
                        </span>
                        <IconChevron className={`size-4 shrink-0 ${lead ? "text-[#7b68e6]" : "text-[#c5c8d2]"}`} />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 bg-[#f6f7fb] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-12 items-center justify-center gap-1 rounded-2xl border border-[#d9d2f7] bg-white text-[15px] font-medium text-[#5b40db] active:bg-[#f7f5ff]"
            >
              <IconPlus className="size-4" />
              新建角色
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={() => void generateCharacter()}
              className="flex h-12 items-center justify-center gap-1 rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(91,64,219,0.28)] active:bg-[#4e36c4] disabled:opacity-60"
            >
              <SparkIcon className="size-4" />
              {generating ? "生成中" : "AI 生成角色"}
            </button>
          </div>
        </>
      )}

      {creating ? (
        <CreateSheet
          onClose={() => setCreating(false)}
          novelId={novelId}
          onSave={saveCharacter}
        />
      ) : null}
      {toast ? (
        <p className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#1c1e28] px-4 py-2 text-[13px] text-white">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function shownImage(character: Character, changes: CharacterArchive["changes"]) {
  return changes.find((change) => change.name === character.name && change.image)?.image || character.image;
}

function CreateSheet({
  novelId,
  onClose,
  onSave,
}: {
  novelId: string;
  onClose: () => void;
  onSave: (input: {
    name: string;
    role: CharacterRole;
    gender: string;
    age: string;
    identity: string;
    summary: string;
    realm: string;
    tagline: string;
    imageId?: string;
  }) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<CharacterRole>("supporting");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [identity, setIdentity] = useState("");
  const [realm, setRealm] = useState("");
  const [tagline, setTagline] = useState("");
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/30">
      <button type="button" aria-label="关闭新建" className="flex-1" onClick={onClose} />
      <form
        className="max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (saving) return;
          setSaving(true);
          void (async () => {
            try {
              const imageId = file ? await uploadImage(novelId, file) : undefined;
              const saved = await onSave({ name, role, gender, age, identity, summary, realm, tagline, imageId });
              if (!saved) setSaving(false);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "图片保存失败");
              setSaving(false);
            }
          })();
        }}
      >
        <h2 className="text-[17px] font-semibold">新建人物</h2>
        <label className="mt-3 block text-[12px] text-[#8e929c]">
          姓名
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl bg-[#f6f7fb] px-3 text-[15px] text-[#1c1e28] outline-none"
          />
        </label>
        <label className="mt-3 block text-[12px] text-[#8e929c]">
          定位
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as CharacterRole)}
            className="mt-1 h-10 w-full rounded-xl bg-[#f6f7fb] px-3 text-[15px] text-[#1c1e28] outline-none"
          >
            {roleOptions.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Field label="性别" value={gender} onChange={setGender} />
          <Field label="年龄" value={age} onChange={setAge} />
          <Field label="身份" value={identity} onChange={setIdentity} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="境界" value={realm} onChange={setRealm} />
          <Field label="一句介绍" value={tagline} onChange={setTagline} />
        </div>
        <label className="mt-3 block text-[12px] text-[#8e929c]">
          图片
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-[13px] text-[#4a4e5c]"
          />
        </label>
        {error ? <p className="mt-2 text-[12px] text-[#d4892a]">{error}</p> : null}
        <label className="mt-3 block text-[12px] text-[#8e929c]">
          简介
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-xl bg-[#f6f7fb] px-3 py-2 text-[15px] text-[#1c1e28] outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 h-11 w-full rounded-2xl bg-[#5b40db] text-[15px] font-medium text-white active:bg-[#4e36c4] disabled:opacity-40"
        >
          {saving ? "保存中" : "保存"}
        </button>
      </form>
    </div>
  );
}

function PendingPill() {
  return <span className="shrink-0 rounded-full bg-[#fff6e8] px-1.5 py-1 text-[11px] font-medium leading-none text-[#d4892a]">待确认</span>;
}

function RoleBadge({ role }: { role: CharacterRole }) {
  const tone =
    role === "important"
      ? "bg-[#fff1e4] text-[#e08a2a]"
      : role === "supporting"
        ? "bg-[#f1f2f5] text-[#8d929e]"
        : "bg-[#efe9ff] text-[#6a48d6]";
  return <span className={`shrink-0 rounded-full px-1.5 py-1 text-[11px] font-medium leading-none ${tone}`}>{roleLabels[role]}</span>;
}

function RealmPill({ realm }: { realm: string }) {
  return <span className="shrink-0 rounded-full bg-[#f2f3f6] px-1.5 py-1 text-[11px] leading-none text-[#8d929e]">{realm}</span>;
}

function StatCard({
  label,
  value,
  active,
  onClick,
  icon,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center rounded-2xl bg-white px-1 py-3 shadow-[0_8px_20px_rgba(28,28,48,0.04)] ${
        active ? "ring-1 ring-[#cfc3ff]" : ""
      }`}
    >
      {icon}
      <span className="mt-1.5 text-[20px] font-semibold leading-none text-[#1c1e28]">{value}</span>
      <span className="mt-1 text-[11px] leading-none text-[#9aa0ae]">{label}</span>
    </button>
  );
}

function SearchStat() {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-[#efe9ff] text-[#6a48d6]">
      <IconSearch className="size-4" />
    </span>
  );
}

function CrownStat() {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-[#fff4e4] text-[#e39a2d]">
      <CrownIcon className="size-4" />
    </span>
  );
}

function PeopleStat() {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-[#efe9ff] text-[#6a48d6]">
      <PeopleIcon className="size-4" />
    </span>
  );
}

function PersonStat() {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-[#efe9ff] text-[#6a48d6]">
      <IconPerson className="size-4" />
    </span>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2.5 13.4 8.2 19 9.6 13.4 11 12 16.8 10.6 11 5 9.6 10.6 8.2Z" />
      <path d="M18 13.2 18.7 16 21.4 16.7 18.7 17.4 18 20.2 17.3 17.4 14.6 16.7 17.3 16Z" />
    </svg>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M3.5 16.5 2 7.5 7.5 11 12 5.5 16.5 11 22 7.5 20.5 16.5Z" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="9" cy="9" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="2" fill="currentColor" stroke="none" />
      <path d="M3.8 18c.7-2.6 2.7-3.8 5.2-3.8s4.5 1.2 5.2 3.8" />
      <path d="M14.2 14.8c1.4.2 2.6.9 3.2 2.6" />
    </svg>
  );
}

function CharacterBanner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 390 150" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="ca-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ea4d4" />
          <stop offset="55%" stopColor="#9ec4df" />
          <stop offset="100%" stopColor="#d7c4b0" />
        </linearGradient>
        <linearGradient id="ca-scrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#163044" stopOpacity="0.55" />
          <stop offset="58%" stopColor="#163044" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#163044" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="390" height="150" fill="url(#ca-sky)" />
      <path d="M0 78 48 46 92 70 140 38 188 68 236 44 286 72 340 48 390 70v80H0Z" fill="#9db8cc" />
      <path d="M0 96 40 64 96 96 146 60 198 100 250 72 304 104 360 78 390 96v54H0Z" fill="#4f7f90" />
      <path d="M220 88 270 46 306 84 338 58 390 90v60H220Z" fill="#2d6570" />
      <path d="M250 104 300 58 332 100 362 74 390 104v46H250Z" fill="#1d4e58" />
      <g transform="translate(292 52)">
        <path d="M18 8 34 22H2Z" fill="#6a5344" />
        <path d="M8 22h20v18H8Z" fill="#8a6a52" />
        <path d="M14 28h8v12h-8Z" fill="#5c4638" />
        <path d="M16 4h4v6h-4Z" fill="#7d624c" />
      </g>
      <path d="M330 36c8 6 10 2 16-2-6 8-4 12 2 18-10-2-14 2-16 8-2-8-8-10-16-8 8-4 6-10 2-16 4 4 8 2 12 0Z" fill="#e7a0b4" />
      <path d="M352 24c5 4 6 1 10-1-4 5-2 7 1 11-6-1-8 1-10 5-1-5-5-6-10-5 5-2 4-6 1-10 3 2 5 1 8 0Z" fill="#f0b7c6" />
      <rect width="390" height="150" fill="url(#ca-scrim)" />
    </svg>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[12px] text-[#8e929c]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl bg-[#f6f7fb] px-2 text-[14px] text-[#1c1e28] outline-none"
      />
    </label>
  );
}
