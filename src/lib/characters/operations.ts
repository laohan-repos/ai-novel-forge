import type { NovelRecord } from "../novels/model";
import { moduleLabels } from "../worldview/model";
import type { NovelVolume, WorldviewState } from "../worldview/model";
import {
  fanchenRelationSeed,
  isCharacterRole,
  isCoreRole,
  roleLabels,
  type Character,
  type CharacterArchive,
  type CharacterChange,
  type CharacterProposal,
  type CharacterRole,
  type GrowthInput,
  type KnowledgeInput,
  type RelationInput,
} from "./model";

export type CharacterIssue = {
  level: "error" | "warn";
  code: string;
  name?: string;
  message: string;
};

let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

export function ensureCharacterShape(archive: CharacterArchive) {
  let dirty = false;
  if (!Array.isArray(archive.changes)) {
    archive.changes = [];
    dirty = true;
  }
  if (!Array.isArray(archive.history)) {
    archive.history = [];
    dirty = true;
  }
  for (const character of archive.characters) {
    if (character.status !== "pending" && character.status !== "confirmed") {
      character.status = "confirmed";
      dirty = true;
    }
    if (!Array.isArray(character.relations)) {
      character.relations = [];
      dirty = true;
    }
    if (!Array.isArray(character.knowledge)) {
      character.knowledge = [];
      dirty = true;
    }
    if (!Array.isArray(character.growth)) {
      character.growth = [];
      dirty = true;
    }
    if (!Array.isArray(character.anchors)) {
      character.anchors = [];
      dirty = true;
    }
    if (character.image === undefined) {
      character.image = null;
      dirty = true;
    }
  }
  return dirty;
}

export function attachKnownRelations(novelId: string, archive: CharacterArchive) {
  if (novelId !== "fanchen-wendao") return false;
  let dirty = false;
  for (const [left, right, summary] of fanchenRelationSeed) {
    const owner = archive.characters.find((character) => character.name === left);
    const other = archive.characters.find((character) => character.name === right);
    if (!owner || !other || owner.relations.some((relation) => relation.targetName === right)) continue;
    owner.relations.push({
      id: `rel-${owner.id}-${right}`,
      targetName: right,
      summary,
      pending: false,
    });
    dirty = true;
  }
  return dirty;
}

function confirmedLead(archive: CharacterArchive, role: "protagonist" | "heroine", exceptName = "") {
  return archive.characters.find(
    (character) => character.role === role && character.status === "confirmed" && character.name !== exceptName,
  );
}

function relationsOf(archive: CharacterArchive, character: Character) {
  const outgoing = character.relations.map((relation) => ({
    with: relation.targetName,
    summary: relation.summary,
    pending: relation.pending,
    from: character.name,
  }));
  const incoming = archive.characters.flatMap((other) =>
    other.name === character.name
      ? []
      : other.relations
          .filter((relation) => relation.targetName === character.name)
          .map((relation) => ({
            with: other.name,
            summary: relation.summary,
            pending: relation.pending,
            from: other.name,
          })),
  );
  return [...outgoing, ...incoming];
}

function cleanRelations(relations: RelationInput[] | undefined) {
  return (relations ?? [])
    .map((relation) => ({ targetName: text(relation.targetName), summary: text(relation.summary) }))
    .filter((relation) => relation.targetName && relation.summary);
}

function cleanAnchors(anchors: string[] | undefined) {
  return [...new Set((anchors ?? []).map((anchor) => text(anchor)).filter(Boolean))];
}

function cleanKnowledge(knowledge: KnowledgeInput[] | undefined) {
  return (knowledge ?? [])
    .map((item) => ({
      fact: text(item.fact),
      sinceChapter: typeof item.sinceChapter === "number" ? item.sinceChapter : null,
    }))
    .filter((item) => item.fact);
}

function cleanGrowth(growth: GrowthInput[] | undefined) {
  return (growth ?? [])
    .map((item) => ({
      chapter: typeof item.chapter === "number" ? item.chapter : null,
      realm: text(item.realm),
      note: text(item.note),
    }))
    .filter((item) => item.note);
}

function upsertList<T>(current: T[] | undefined, incoming: T[], key: (item: T) => string) {
  const next = [...(current ?? [])];
  for (const item of incoming) {
    const id = key(item);
    const index = next.findIndex((entry) => key(entry) === id);
    if (index >= 0) next[index] = item;
    else next.push(item);
  }
  return next;
}

export function characterProfile(archive: CharacterArchive, name: string) {
  const character = archive.characters.find((item) => item.name === name.trim());
  if (!character) return null;
  const openChanges = archive.changes.filter((change) => change.name === character.name);
  const history = archive.history.filter((change) => change.name === character.name).slice(0, 12);
  return {
    id: character.id,
    name: character.name,
    role: character.role,
    roleLabel: roleLabels[character.role],
    status: character.status,
    gender: character.gender,
    age: character.age,
    identity: character.identity,
    realm: character.realm,
    tagline: character.tagline,
    summary: character.summary,
    relations: relationsOf(archive, character),
    knowledge: character.knowledge.map((item) => ({
      fact: item.fact,
      sinceChapter: item.sinceChapter,
      pending: item.pending,
    })),
    growth: character.growth.map((item) => ({
      chapter: item.chapter,
      realm: item.realm,
      note: item.note,
      pending: item.pending,
    })),
    openChanges,
    history,
  };
}

export function searchCharacterArchive(archive: CharacterArchive, query: string) {
  const keyword = query.trim();
  const characters = archive.characters.flatMap((character) => {
    const reasons: string[] = [];
    if (character.name.includes(keyword)) reasons.push("姓名");
    if (roleLabels[character.role].includes(keyword)) reasons.push("定位");
    if (character.identity.includes(keyword)) reasons.push("身份");
    if (character.realm.includes(keyword)) reasons.push("境界");
    if (`${character.tagline}${character.summary}`.includes(keyword)) reasons.push("介绍");
    const relations = relationsOf(archive, character).filter(
      (relation) => relation.with.includes(keyword) || relation.summary.includes(keyword),
    );
    if (relations.length > 0) reasons.push("关系");
    const knowledge = character.knowledge.filter((item) => item.fact.includes(keyword));
    if (knowledge.length > 0) reasons.push("所知");
    const growth = character.growth.filter((item) => item.note.includes(keyword) || item.realm.includes(keyword));
    if (growth.length > 0) reasons.push("成长");
    if (reasons.length === 0) return [];
    return [
      {
        name: character.name,
        role: character.role,
        roleLabel: roleLabels[character.role],
        status: character.status,
        identity: character.identity,
        realm: character.realm,
        tagline: character.tagline,
        reasons,
        relations: relations.slice(0, 3).map((relation) => ({ with: relation.with, summary: relation.summary })),
      },
    ];
  });
  return { query: keyword, count: characters.length, characters };
}

function volumeAt(volumes: NovelVolume[], chapter: number) {
  let start = 1;
  for (const volume of volumes) {
    const end = start + Math.max(volume.total, 1) - 1;
    if (chapter >= start && chapter <= end) {
      return {
        title: volume.title,
        status: volume.status,
        from: start,
        to: end,
        mainline: volume.mainline ?? null,
        beats: volume.beats ?? [],
      };
    }
    start = end + 1;
  }
  return null;
}

function stateAt(archive: CharacterArchive, character: Character, chapter: number) {
  const growth = character.growth.filter(
    (item) => !item.pending && (item.chapter === null || item.chapter <= chapter),
  );
  const latestRealm = [...growth].reverse().find((item) => item.realm)?.realm;
  const knowledge = character.knowledge.filter(
    (item) => !item.pending && (item.sinceChapter === null || item.sinceChapter <= chapter),
  );
  const notYetKnown = character.knowledge.filter(
    (item) => !item.pending && item.sinceChapter !== null && item.sinceChapter > chapter,
  );
  return {
    name: character.name,
    role: character.role,
    roleLabel: roleLabels[character.role],
    status: character.status,
    identity: character.identity,
    realm: latestRealm || character.realm,
    tagline: character.tagline,
    summary: character.summary,
    knowledge: knowledge.map((item) => ({ fact: item.fact, sinceChapter: item.sinceChapter })),
    notYetKnown: notYetKnown.map((item) => ({ fact: item.fact, sinceChapter: item.sinceChapter })),
    relations: relationsOf(archive, character)
      .filter((relation) => !relation.pending)
      .map((relation) => ({ with: relation.with, summary: relation.summary })),
    growth: growth.map((item) => ({ chapter: item.chapter, realm: item.realm, note: item.note })),
    openChanges: archive.changes.filter((change) => change.name === character.name),
  };
}

export function characterContext(
  archive: CharacterArchive,
  volumes: NovelVolume[],
  chapter: number,
  names: string[],
) {
  const missing: string[] = [];
  const selected = names.length
    ? names.flatMap((name) => {
        const character = archive.characters.find((item) => item.name === name.trim());
        if (!character) {
          missing.push(name.trim());
          return [];
        }
        return [character];
      })
    : archive.characters.filter(
        (character) =>
          isCoreRole(character.role) ||
          character.role === "important" ||
          character.growth.some((item) => item.chapter !== null && item.chapter <= chapter) ||
          character.knowledge.some((item) => item.sinceChapter !== null && item.sinceChapter <= chapter),
      );
  return {
    chapter,
    volume: volumeAt(volumes, chapter),
    note: "openChanges 里的内容还没确认，写这一章时不要当成已经发生。",
    missing,
    characters: selected.map((character) => stateAt(archive, character, chapter)),
  };
}

function coveredByCast(archive: CharacterArchive, label: string) {
  return archive.characters.some((character) =>
    `${character.identity}${character.tagline}${character.summary}${character.name}`.includes(label),
  );
}

export function buildCharacterScheme(input: {
  novel: NovelRecord;
  world: WorldviewState;
  volumes: NovelVolume[];
  archive: CharacterArchive;
}) {
  const { novel, world, volumes, archive } = input;
  const factions = world.entries.filter((entry) => entry.module === "faction");
  const uncovered = [
    ...factions.filter((entry) => entry.core && !coveredByCast(archive, entry.name)),
    ...factions.filter((entry) => !entry.core && !coveredByCast(archive, entry.name)),
  ].slice(0, 4);
  const scheme: Array<{ slot: string; role: CharacterRole; reason: string; groundedIn: string[] }> = [];
  if (!confirmedLead(archive, "protagonist")) {
    scheme.push({
      slot: "主角",
      role: "protagonist",
      reason: novel.premise || world.worldSummary,
      groundedIn: [world.worldName],
    });
  }
  if (!confirmedLead(archive, "heroine")) {
    scheme.push({
      slot: "女主",
      role: "heroine",
      reason: "需要一位能和主角长期同行、并把关系写实的人。",
      groundedIn: uncovered.slice(0, 1).map((entry) => entry.name),
    });
  }
  for (const faction of uncovered) {
    scheme.push({
      slot: "重要配角",
      role: "important",
      reason: `势力「${faction.name}」还没有对应的人。${faction.summary}`,
      groundedIn: [faction.name],
    });
  }
  const active = volumes.find((volume) => volume.status === "active");
  for (const beat of (active?.beats ?? []).slice(0, 3)) {
    scheme.push({
      slot: "剧情相关",
      role: "important",
      reason: `当前卷的这段剧情还没有落在具体的人身上：${beat}`,
      groundedIn: [active?.title ?? ""],
    });
  }
  return {
    novelId: novel.id,
    title: novel.title,
    writes: false,
    message: "这是根据世界观和大纲整理的角色方案，还没有写入人物档案。和作者确认后，再用 propose_character_changes 提交。",
    world: { name: world.worldName, summary: world.worldSummary },
    outline: volumes.map((volume) => ({
      title: volume.title,
      status: volume.status,
      mainline: volume.mainline ?? null,
      beats: volume.beats ?? [],
    })),
    existing: archive.characters.map((character) => ({
      name: character.name,
      role: character.role,
      roleLabel: roleLabels[character.role],
      status: character.status,
      realm: character.realm,
      tagline: character.tagline,
    })),
    constraints: [
      "一本小说只保留一位已确认的主角和一位已确认的女主。",
      "提议写入后是待确认，commit_character_changes 之后才成为正史。",
      "关系的双方都必须已经在档案里，或出现在同一次提议里。",
    ],
    scheme,
  };
}

function blankChange(name: string, action: "create" | "update", source: string): CharacterChange {
  return { id: nextId("chg"), name, action, source };
}

export function proposeCharacterChanges(archive: CharacterArchive, proposals: CharacterProposal[]) {
  if (proposals.length === 0) {
    return { save: false, error: "至少提供一条人物变更" };
  }
  const created: Array<{ name: string; changeId: string }> = [];
  const updated: Array<{ name: string; changeId: string }> = [];
  const conflicts: Array<{ name: string; message: string }> = [];
  const accepted: Array<{ proposal: CharacterProposal; name: string; role?: CharacterRole }> = [];
  const claimed = { protagonist: confirmedLead(archive, "protagonist")?.name ?? "", heroine: confirmedLead(archive, "heroine")?.name ?? "" };

  for (const proposal of proposals) {
    const name = text(proposal.name);
    if (!name) {
      conflicts.push({ name: "", message: "姓名不能为空" });
      continue;
    }
    if (proposal.role && !isCharacterRole(proposal.role)) {
      conflicts.push({ name, message: `定位无效：${proposal.role}` });
      continue;
    }
    const role = proposal.role && isCharacterRole(proposal.role) ? proposal.role : undefined;
    const existing = archive.characters.find((character) => character.name === name);
    if (!existing && !text(proposal.summary) && !text(proposal.tagline)) {
      conflicts.push({ name, message: "新建人物需要简介或一句介绍" });
      continue;
    }
    if ((role === "protagonist" || role === "heroine") && claimed[role] && claimed[role] !== name) {
      conflicts.push({
        name,
        message: `已经有确认过的${roleLabels[role]}「${claimed[role]}」`,
      });
      continue;
    }
    if (role === "protagonist" || role === "heroine") claimed[role] = name;
    accepted.push({ proposal, name, role });
  }

  let checking = true;
  while (checking) {
    checking = false;
    const known = new Set([
      ...archive.characters.map((character) => character.name),
      ...accepted.flatMap((item) => (item.name ? [item.name] : [])),
    ]);
    for (const item of accepted) {
      if (!item.name) continue;
      const relations = cleanRelations(item.proposal.relations);
      const missing = relations.find((relation) => relation.targetName === item.name || !known.has(relation.targetName));
      if (!missing) continue;
      conflicts.push({
        name: item.name,
        message:
          missing.targetName === item.name
            ? "关系不能指向自己"
            : `关系对象「${missing.targetName}」不在人物档案里`,
      });
      item.name = "";
      checking = true;
    }
  }

  for (const item of accepted) {
    if (!item.name) continue;
    const proposal = item.proposal;
    const source = text(proposal.source) || "Codex";
    const relations = cleanRelations(proposal.relations);
    const knowledge = cleanKnowledge(proposal.knowledge);
    const growth = cleanGrowth(proposal.growth);
    const anchors = cleanAnchors(proposal.anchors);
    const existing = archive.characters.find((character) => character.name === item.name);

    if (!existing) {
      const role = item.role ?? "supporting";
      const character: Character = {
        id: nextId("char"),
        name: item.name,
        role,
        gender: text(proposal.gender) || "未填",
        age: text(proposal.age),
        identity: text(proposal.identity) || "未填",
        realm: text(proposal.realm),
        tagline: text(proposal.tagline),
        summary: text(proposal.summary) || text(proposal.tagline),
        portrait: archive.characters.length % 9,
        image: text(proposal.imageId) || null,
        status: "pending",
        relations: relations.map((relation) => ({ id: nextId("rel"), ...relation, pending: true })),
        knowledge: knowledge.map((entry) => ({ id: nextId("know"), ...entry, pending: true })),
        growth: growth.map((entry) => ({ id: nextId("grow"), ...entry, pending: true })),
        anchors,
      };
      archive.characters.push(character);
      const change = blankChange(item.name, "create", source);
      if (item.role) change.role = role;
      change.gender = character.gender;
      change.age = character.age;
      change.identity = character.identity;
      change.realm = character.realm;
      change.tagline = character.tagline;
      change.summary = character.summary;
      change.relations = relations;
      change.knowledge = knowledge;
      change.growth = growth;
      change.anchors = anchors;
      if (character.image) change.image = character.image;
      archive.changes.push(change);
      created.push({ name: item.name, changeId: change.id });
      continue;
    }

    if (existing.status === "pending") {
      if (item.role) existing.role = item.role;
      if (text(proposal.gender)) existing.gender = text(proposal.gender);
      if (text(proposal.age)) existing.age = text(proposal.age);
      if (text(proposal.identity)) existing.identity = text(proposal.identity);
      if (text(proposal.realm)) existing.realm = text(proposal.realm);
      if (text(proposal.tagline)) existing.tagline = text(proposal.tagline);
      if (text(proposal.summary)) existing.summary = text(proposal.summary);
      if (text(proposal.imageId)) existing.image = text(proposal.imageId);
      if (Array.isArray(proposal.anchors)) existing.anchors = anchors;
      for (const relation of relations) {
        const found = existing.relations.find((entry) => entry.targetName === relation.targetName);
        if (found) found.summary = relation.summary;
        else existing.relations.push({ id: nextId("rel"), ...relation, pending: true });
      }
      for (const entry of knowledge) {
        const found = existing.knowledge.find((item) => item.fact === entry.fact);
        if (found) found.sinceChapter = entry.sinceChapter;
        else existing.knowledge.push({ id: nextId("know"), ...entry, pending: true });
      }
      existing.growth.push(...growth.map((entry) => ({ id: nextId("grow"), ...entry, pending: true })));
      let change = archive.changes.find((entry) => entry.name === existing.name && entry.action === "create");
      if (!change) {
        change = blankChange(existing.name, "create", source);
        archive.changes.push(change);
      }
      change.source = source;
      change.role = existing.role;
      change.summary = existing.summary;
      change.tagline = existing.tagline;
      change.realm = existing.realm;
      change.anchors = existing.anchors;
      if (existing.image) change.image = existing.image;
      change.relations = upsertList(change.relations, relations, (relation) => relation.targetName);
      change.knowledge = upsertList(change.knowledge, knowledge, (entry) => entry.fact);
      change.growth = [...(change.growth ?? []), ...growth];
      updated.push({ name: existing.name, changeId: change.id });
      continue;
    }

    const nextRole = item.role && item.role !== existing.role ? item.role : undefined;
    const fields = {
      gender: text(proposal.gender) && text(proposal.gender) !== existing.gender ? text(proposal.gender) : "",
      age: text(proposal.age) && text(proposal.age) !== existing.age ? text(proposal.age) : "",
      identity: text(proposal.identity) && text(proposal.identity) !== existing.identity ? text(proposal.identity) : "",
      realm: text(proposal.realm) && text(proposal.realm) !== existing.realm ? text(proposal.realm) : "",
      tagline: text(proposal.tagline) && text(proposal.tagline) !== existing.tagline ? text(proposal.tagline) : "",
      summary: text(proposal.summary) && text(proposal.summary) !== existing.summary ? text(proposal.summary) : "",
    };
    const anchorChanged = Array.isArray(proposal.anchors) && anchors.join("|") !== existing.anchors.join("|");
    const nextImage = text(proposal.imageId) && text(proposal.imageId) !== (existing.image ?? "") ? text(proposal.imageId) : "";
    const hasChange = Boolean(nextRole || nextImage || anchorChanged || fields.gender || fields.age || fields.identity || fields.realm || fields.tagline || fields.summary || relations.length || knowledge.length || growth.length);
    if (!hasChange) {
      conflicts.push({ name: existing.name, message: "没有可提交的变更" });
      continue;
    }
    let change = archive.changes.find((entry) => entry.name === existing.name && entry.action === "update");
    if (!change) {
      change = blankChange(existing.name, "update", source);
      archive.changes.push(change);
    }
    change.source = source;
    if (nextRole) change.role = nextRole;
    if (fields.gender) change.gender = fields.gender;
    if (fields.age) change.age = fields.age;
    if (fields.identity) change.identity = fields.identity;
    if (fields.realm) change.realm = fields.realm;
    if (fields.tagline) change.tagline = fields.tagline;
    if (fields.summary) change.summary = fields.summary;
    if (nextImage) change.image = nextImage;
    if (anchorChanged) change.anchors = anchors;
    change.relations = upsertList(change.relations, relations, (relation) => relation.targetName);
    change.knowledge = upsertList(change.knowledge, knowledge, (entry) => entry.fact);
    change.growth = [...(change.growth ?? []), ...growth];
    updated.push({ name: existing.name, changeId: change.id });
  }

  return {
    save: created.length > 0 || updated.length > 0,
    created,
    updated,
    conflicts,
  };
}

function applyUpdate(character: Character, change: CharacterChange) {
  if (change.role) character.role = change.role;
  if (change.gender) character.gender = change.gender;
  if (change.age) character.age = change.age;
  if (change.identity) character.identity = change.identity;
  if (change.realm) character.realm = change.realm;
  if (change.tagline) character.tagline = change.tagline;
  if (change.summary) character.summary = change.summary;
  if (change.image) character.image = change.image;
  if (Array.isArray(change.anchors)) character.anchors = cleanAnchors(change.anchors);
  for (const relation of change.relations ?? []) {
    const found = character.relations.find((item) => item.targetName === relation.targetName);
    if (found) {
      found.summary = relation.summary;
      found.pending = false;
    } else {
      character.relations.push({ id: nextId("rel"), targetName: relation.targetName, summary: relation.summary, pending: false });
    }
  }
  for (const entry of change.knowledge ?? []) {
    const found = character.knowledge.find((item) => item.fact === entry.fact);
    if (found) {
      found.sinceChapter = entry.sinceChapter ?? null;
      found.pending = false;
    } else {
      character.knowledge.push({
        id: nextId("know"),
        fact: entry.fact,
        sinceChapter: entry.sinceChapter ?? null,
        pending: false,
      });
    }
  }
  for (const entry of change.growth ?? []) {
    character.growth.push({
      id: nextId("grow"),
      chapter: entry.chapter ?? null,
      realm: entry.realm ?? "",
      note: entry.note,
      pending: false,
    });
  }
}

export function commitCharacterChanges(archive: CharacterArchive, changeIds: string[], names: string[]) {
  if (changeIds.length === 0 && names.length === 0) {
    return { save: false, error: "请指定要确认的人物或变更" };
  }
  const selected = archive.changes.filter((change) => changeIds.includes(change.id) || names.includes(change.name));
  for (const name of names) {
    const pending = archive.characters.find((character) => character.name === name && character.status === "pending");
    if (pending && !selected.some((change) => change.name === name)) {
      selected.push(blankChange(name, "create", "Codex"));
    }
  }
  if (selected.length === 0) {
    return { save: false, error: "没有找到要确认的变更" };
  }
  const committed: Array<{ name: string; changeId: string; action: "create" | "update" }> = [];
  const conflicts: Array<{ name: string; message: string }> = [];
  for (const change of selected) {
    const character = archive.characters.find((item) => item.name === change.name);
    if (!character) {
      conflicts.push({ name: change.name, message: "人物不在档案里" });
      continue;
    }
    const nextRole = change.role ?? character.role;
    if ((nextRole === "protagonist" || nextRole === "heroine") && confirmedLead(archive, nextRole, character.name)) {
      const holder = confirmedLead(archive, nextRole, character.name);
      conflicts.push({ name: change.name, message: `已经有确认过的${roleLabels[nextRole]}「${holder?.name}」` });
      continue;
    }
    if (change.action === "update") applyUpdate(character, change);
    else if (change.image) character.image = change.image;
    character.status = "confirmed";
    for (const relation of character.relations) relation.pending = false;
    for (const entry of character.knowledge) entry.pending = false;
    for (const entry of character.growth) entry.pending = false;
    archive.history = [change, ...archive.history].slice(0, 40);
    archive.changes = archive.changes.filter((item) => item.id !== change.id);
    committed.push({ name: character.name, changeId: change.id, action: change.action });
  }
  return { save: committed.length > 0, committed, conflicts };
}

function tone(summary: string) {
  if (/恶化|决裂|敌对|反目|疏远|仇/.test(summary)) return "hostile";
  if (/好友|朋友|携手|盟友|同心|相助/.test(summary)) return "close";
  return "other";
}

export function validateCharacterArchive(archive: CharacterArchive, chapter?: number) {
  const issues: CharacterIssue[] = [];
  for (const role of ["protagonist", "heroine"] as const) {
    const people = archive.characters.filter((character) => character.role === role && character.status === "confirmed");
    if (people.length > 1) {
      issues.push({
        level: "error",
        code: role === "protagonist" ? "multiple_protagonists" : "multiple_heroines",
        message: `有${people.length}位已确认的${roleLabels[role]}：${people.map((character) => character.name).join("、")}`,
      });
    }
  }
  const reported = new Set<string>();
  for (const character of archive.characters) {
    for (const relation of character.relations) {
      const target = archive.characters.find((item) => item.name === relation.targetName);
      if (!target) {
        issues.push({
          level: "error",
          code: "missing_relation",
          name: character.name,
          message: `关系对象「${relation.targetName}」不在人物档案里`,
        });
        continue;
      }
      const back = target.relations.find((item) => item.targetName === character.name && !item.pending && !relation.pending);
      const pair = [character.name, target.name].sort().join("|");
      if (back && tone(relation.summary) !== "other" && tone(back.summary) !== "other" && tone(relation.summary) !== tone(back.summary) && !reported.has(pair)) {
        reported.add(pair);
        issues.push({
          level: "error",
          code: "relation_conflict",
          name: character.name,
          message: `${character.name}对${target.name}是「${relation.summary}」，对方却是「${back.summary}」`,
        });
      }
    }
    const realms = new Map<number, string>();
    for (const entry of character.growth.filter((item) => !item.pending && item.chapter !== null && item.realm)) {
      const previous = realms.get(entry.chapter as number);
      if (previous && previous !== entry.realm) {
        issues.push({
          level: "error",
          code: "growth_realm_conflict",
          name: character.name,
          message: `第${entry.chapter}章同时记了「${previous}」和「${entry.realm}」`,
        });
      }
      realms.set(entry.chapter as number, entry.realm);
    }
    const latest = character.growth.filter((item) => !item.pending && item.realm).at(-1);
    if (latest && character.realm && latest.realm !== character.realm) {
      issues.push({
        level: "warn",
        code: "realm_mismatch",
        name: character.name,
        message: `当前境界是${character.realm}，最近一次成长记录是${latest.realm}`,
      });
    }
    if (typeof chapter === "number") {
      const future = character.growth.find(
        (item) => !item.pending && item.chapter !== null && item.chapter > chapter && item.realm && item.realm === character.realm,
      );
      const past = character.growth.some(
        (item) => !item.pending && item.realm === character.realm && (item.chapter === null || item.chapter <= chapter),
      );
      if (future && !past) {
        issues.push({
          level: "warn",
          code: "early_realm",
          name: character.name,
          message: `第${chapter}章时还不应写成${character.realm}，这条成长在第${future.chapter}章`,
        });
      }
    }
  }
  for (const change of archive.changes) {
    issues.push({
      level: "warn",
      code: "pending_change",
      name: change.name,
      message: change.action === "create" ? "这个人还待确认" : "有一条尚未确认的变更",
    });
  }
  return { ok: issues.every((issue) => issue.level !== "error"), issues };
}

// ---------------------------------------------------------------------------
// 评审员 · 硬校验：世界观 ↔ 人物设定的匹配度
// ---------------------------------------------------------------------------

const carrierModules = ["rule", "faction", "cultivation"] as const;

export function auditConsistency(world: WorldviewState, archive: CharacterArchive) {
  const issues: CharacterIssue[] = [];
  const byName = new Map(world.entries.map((entry) => [entry.name, entry]));
  const carriers = new Map<string, string[]>();

  for (const character of archive.characters) {
    for (const anchor of character.anchors) {
      const list = carriers.get(anchor) ?? [];
      list.push(character.name);
      carriers.set(anchor, list);
      if (!byName.has(anchor)) {
        issues.push({
          level: "error",
          code: "dangling_anchor",
          name: character.name,
          message: `挂靠的设定「${anchor}」在世界观里不存在`,
        });
      }
    }
  }

  for (const entry of world.entries) {
    if (!entry.core) continue;
    const needsCarrier = (carrierModules as readonly string[]).includes(entry.module);
    if (needsCarrier && !carriers.has(entry.name)) {
      issues.push({
        level: "error",
        code: "orphan_core_entry",
        name: entry.name,
        message: `核心${moduleLabels[entry.module]}「${entry.name}」没有任何角色承载，写在纸上但没人用`,
      });
    }
  }

  for (const character of archive.characters) {
    if (character.anchors.length === 0) {
      issues.push({
        level: "warn",
        code: "unanchored_character",
        name: character.name,
        message: `${roleLabels[character.role]}「${character.name}」没有挂靠任何设定，没法校验它和世界观是否匹配`,
      });
    }
  }

  for (const [entryName, names] of carriers) {
    const entry = byName.get(entryName);
    if (!entry?.core) continue;
    if ((entry.module === "rule" || entry.module === "item") && names.length > 3) {
      issues.push({
        level: "warn",
        code: "overloaded_entry",
        name: entryName,
        message: `核心${moduleLabels[entry.module]}「${entryName}」被 ${names.length} 个角色同时承载（${names.join("、")}），规则容易被稀释`,
      });
    }
  }

  for (const role of ["protagonist", "heroine"] as const) {
    const lead = archive.characters.find((character) => character.role === role);
    if (!lead) {
      issues.push({ level: "warn", code: "missing_lead", message: `还没有${roleLabels[role]}，主线的承载点空缺` });
      continue;
    }
    const carried = lead.anchors.filter((anchor) => {
      const entry = byName.get(anchor);
      return entry?.module === "rule" && entry.core;
    });
    if (carried.length === 0) {
      issues.push({
        level: "error",
        code: "lead_without_rule",
        name: lead.name,
        message: `${roleLabels[role]}「${lead.name}」一条核心规则都没挂，动机落不到世界规则上`,
      });
    }
  }

  for (const entry of world.entries) {
    if (carriers.has(entry.name)) continue;
    for (const character of archive.characters) {
      if (character.anchors.includes(entry.name)) continue;
      if (!entry.summary.includes(character.name)) continue;
      issues.push({
        level: "warn",
        code: "unlinked_mention",
        name: character.name,
        message: `设定「${entry.name}」里写到了「${character.name}」，但这个角色没有挂靠它`,
      });
    }
  }

  const coreEntries = world.entries.filter((entry) => entry.core);
  const carried = coreEntries.filter((entry) => carriers.has(entry.name));
  const anchored = archive.characters.filter((character) => character.anchors.length > 0);

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    issues,
    coverage: {
      coreEntries: coreEntries.length,
      carriedCoreEntries: carried.length,
      orphanCoreEntries: coreEntries.filter((entry) => !carriers.has(entry.name)).map((entry) => entry.name),
      characters: archive.characters.length,
      anchoredCharacters: anchored.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 评审员 · 软评审：打包给模型判断，不在本地做评断
// ---------------------------------------------------------------------------

export function reviewPackage(world: WorldviewState, archive: CharacterArchive) {
  const byName = new Map(world.entries.map((entry) => [entry.name, entry]));
  return {
    world: { name: world.worldName, summary: world.worldSummary },
    rules: world.entries
      .filter((entry) => entry.module === "rule")
      .map((entry) => ({ name: entry.name, core: entry.core, summary: entry.summary })),
    entries: world.entries.map((entry) => ({
      module: moduleLabels[entry.module],
      name: entry.name,
      core: entry.core,
      summary: entry.summary,
      carriedBy: archive.characters
        .filter((character) => character.anchors.includes(entry.name))
        .map((character) => character.name),
    })),
    cast: archive.characters.map((character) => ({
      name: character.name,
      role: roleLabels[character.role],
      status: character.status,
      identity: character.identity,
      tagline: character.tagline,
      summary: character.summary,
      anchors: character.anchors.map((anchor) => `${anchor}（${moduleLabels[byName.get(anchor)?.module ?? "custom"]}）`),
      relations: character.relations.map((relation) => `${relation.targetName}：${relation.summary}`),
    })),
    checklist: [
      "每条核心规则，是否至少有一个角色的处境是被这条规则直接决定的？如果只是有人在解释规则，算不合格。",
      "每个角色的动机，能不能只用世界规则来解释，而不需要额外假设？需要额外假设的地方指出来。",
      "有没有两个角色承载了同一条规则、却给出了互相矛盾的解读？",
      "主角的困境是否被规则逼出来，而不是作者安排出来的？",
      "有没有角色的设定，反过来要求在规则里加一条新例外？如果有，说明规则本身有缝。",
    ],
    answerFormat: {
      verdict: "pass / needs_work",
      findings: [{ target: "角色名或设定名", problem: "一句话说清哪里不匹配", fix: "最小改法" }],
    },
  };
}
