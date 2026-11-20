export const characterRoles = ["protagonist", "heroine", "major", "important", "supporting"] as const;

export type CharacterRole = (typeof characterRoles)[number];

export const roleLabels: Record<CharacterRole, string> = {
  protagonist: "主角",
  heroine: "女主",
  major: "核心人物",
  important: "重要配角",
  supporting: "普通角色",
};

export type CharacterStatus = "pending" | "confirmed";

export type CharacterRelation = {
  id: string;
  targetName: string;
  summary: string;
  pending: boolean;
};

export type CharacterKnowledge = {
  id: string;
  fact: string;
  sinceChapter: number | null;
  pending: boolean;
};

export type CharacterGrowth = {
  id: string;
  chapter: number | null;
  realm: string;
  note: string;
  pending: boolean;
};

export type RelationInput = { targetName: string; summary: string };
export type KnowledgeInput = { fact: string; sinceChapter?: number | null };
export type GrowthInput = { chapter?: number | null; realm?: string; note: string };

export type CharacterProposal = {
  name: string;
  role?: string;
  gender?: string;
  age?: string;
  identity?: string;
  realm?: string;
  tagline?: string;
  summary?: string;
  relations?: RelationInput[];
  knowledge?: KnowledgeInput[];
  growth?: GrowthInput[];
  anchors?: string[];
  source?: string;
  imageId?: string;
  imagePath?: string;
};

export type CharacterChange = {
  id: string;
  name: string;
  action: "create" | "update";
  source: string;
  role?: CharacterRole;
  gender?: string;
  age?: string;
  identity?: string;
  realm?: string;
  tagline?: string;
  summary?: string;
  relations?: RelationInput[];
  knowledge?: KnowledgeInput[];
  growth?: GrowthInput[];
  anchors?: string[];
  image?: string;
};

export type Character = {
  id: string;
  name: string;
  role: CharacterRole;
  gender: string;
  age: string;
  identity: string;
  realm: string;
  tagline: string;
  summary: string;
  portrait: number;
  image: string | null;
  status: CharacterStatus;
  relations: CharacterRelation[];
  knowledge: CharacterKnowledge[];
  growth: CharacterGrowth[];
  anchors: string[];
};

export type CharacterArchive = {
  revision: number;
  characters: Character[];
  changes: CharacterChange[];
  history: CharacterChange[];
};

export const fanchenRelationSeed: Array<[string, string, string]> = [
  ["陆沉", "苏清雪", "携手同行"],
  ["陆沉", "赵无极", "曾经的好友，现已疏远"],
  ["陆沉", "玄清长老", "身份未明的长辈"],
  ["苏清雪", "白疏影", "同代较劲"],
  ["林婉儿", "陆沉", "关键时出手相助"],
];

export function isCharacterRole(value: string): value is CharacterRole {
  return (characterRoles as readonly string[]).includes(value);
}

export function isCoreRole(role: CharacterRole) {
  return role === "protagonist" || role === "heroine" || role === "major";
}

const fanchenCast: Array<[string, CharacterRole, string, string, string, string, string, string, number]> = [
  ["陆沉", "protagonist", "男", "25岁", "青云宗弟子", "金丹初期", "青云宗弟子 · 调查幕后势力", "本作主角，原为普通打工人，意外获得修仙传承后踏上修行之路，正在追查幕后势力。", 0],
  ["苏清雪", "heroine", "女", "23岁", "天璇宗弟子", "筑基后期", "天璇宗弟子 · 与主角携手同行", "天璇宗弟子，出身修仙世家，外冷内热，与陆沉在历练中结下深厚羁绊。", 1],
  ["赵无极", "important", "男", "42岁", "旧识", "筑基后期", "曾经的好友 · 现已关系恶化", "曾经与陆沉并肩，后来立场分开，现在见面往往先把话锋抵到最硬。", 5],
  ["玄清长老", "important", "男", "68岁", "青云宗长老", "元婴初期", "青云宗长老 · 身份复杂", "青云宗长老，话里总留着半句，谁也说不清他到底站在哪一边。", 8],
  ["陈砚舟", "major", "男", "26岁", "内门师兄", "金丹初期", "天璇宗内门师兄 · 关键时从不退后", "天璇宗内门师兄，最早带陆沉熟悉宗门规矩，表面散漫，关键时从不退后。", 2],
  ["沈照雪", "major", "女", "24岁", "大师姐", "金丹中期", "天璇宗大师姐 · 外门考核最严", "天璇宗大师姐，负责外门考核，对陆沉要求严苛，也是他在宗门里最稳的依靠。", 3],
  ["顾承渊", "major", "男", "28岁", "散修", "金丹初期", "独行散修 · 路上的对手", "独来独往的散修，与陆沉既是路上的对手，也是少数愿意把实情说完的人。", 4],
  ["林婉儿", "important", "女", "20岁", "灵修", "筑基中期", "陆沉的好友 · 擅长阵法灵器", "陆沉的好友，活泼聪慧，擅长阵法与灵器，在关键时刻多次提供帮助。", 6],
  ["周衡", "important", "男", "31岁", "执法堂执事", "金丹后期", "执法堂执事 · 认规矩不认情面", "天璇宗执法堂执事，认规矩不认情面，几次把陆沉从越界的边缘拦回来。", 7],
  ["叶知秋", "important", "女", "27岁", "丹师", "筑基后期", "药园管事 · 话少手稳", "药园管事，话少手稳，陆沉每次重伤后真正能用的丹药都出自她手里。", 1],
  ["韩铁衣", "important", "男", "35岁", "器修", "金丹初期", "铸器坊师傅 · 只认能用的法器", "铸器坊的老师傅，看不起空谈，只肯把能用的法器交给经得起打的人。", 2],
  ["白疏影", "important", "女", "22岁", "剑修", "筑基后期", "外门剑修 · 与苏清雪较劲", "外门剑修，胜负心重，和苏清雪较劲，也因此几次与陆沉并肩破阵。", 3],
  ["秦牧", "important", "男", "19岁", "外门弟子", "炼气九层", "同批入门 · 消息最灵通", "和陆沉同一批入门，胆子小，记性好，宗门里的闲话往往先到他耳朵里。", 4],
  ["慕容昭", "important", "男", "33岁", "客卿", "金丹中期", "别宗客卿 · 笑面底下算计", "从别宗借来的客卿，笑面底下算计清楚，是天璇宗近期最不稳定的盟友。", 5],
  ["唐晚", "important", "女", "29岁", "阵师", "金丹初期", "护山大阵 · 不许人插嘴", "负责护山大阵的年轻阵师，林婉儿的师父一脉，修阵时不许任何人插嘴。", 6],
  ["江晚舟", "important", "男", "30岁", "王朝镇魔使", "筑基大圆满", "镇魔司联络人 · 在意陆沉来历", "镇魔司派到宗门的联络人，公事公办，却对陆沉的来历格外在意。", 0],
  ["柳三娘", "supporting", "女", "36岁", "坊市掌柜", "凡人", "坊市掌柜 · 什么都打听", "临江坊市的掌柜，什么都卖，也什么都打听，给陆沉留过一条不记账的后路。", 6],
  ["石头", "supporting", "男", "17岁", "杂役", "炼气三层", "外门杂役 · 嘴严力气大", "外门杂役，力气大，嘴严，陆沉入门前在凡间就认识的旧识。", 4],
  ["阿禾", "supporting", "女", "16岁", "药童", "炼气一层", "药童 · 盯着陆沉喝药", "叶知秋身边的药童，负责盯着陆沉按时喝那些难喝的药。", 3],
  ["老周", "supporting", "男", "61岁", "凡人车夫", "凡人", "驿站车夫 · 总在路边停车", "城外驿站的车夫，不修仙，却总在陆沉最狼狈的时候把车停在路边。", 7],
  ["小满", "supporting", "女", "18岁", "凡人间谍", "凡人", "坊市眼线 · 还没选边", "王朝安插在坊市的眼线，自己也没想清楚到底站在哪一边。", 1],
  ["铁柱", "supporting", "男", "24岁", "矿工", "凡人", "灵石矿工 · 听见过不该有的脚步", "灵石矿上的凡人矿工，给陆沉讲过矿洞深处不该有的脚步声。", 2],
  ["春桃", "supporting", "女", "40岁", "客栈老板", "凡人", "客栈老板 · 记得每个留下名字的人", "青云城外客栈的老板，记得每一个付不起房钱、却留下名字的修士。", 6],
  ["裴照", "supporting", "女", "21岁", "灵植夫", "筑基初期", "药园弟子 · 认植物不认人", "药园弟子，认植物不认人，苏清雪少数愿意放下身段请教的人。", 1],
];

export function fanchenCharacters(): CharacterArchive {
  const archive: CharacterArchive = {
    revision: 1,
    characters: fanchenCast.map(([name, role, gender, age, identity, realm, tagline, summary, portrait], index) => ({
      id: `char-${index + 1}`,
      name,
      role,
      gender,
      age,
      identity,
      realm,
      tagline,
      summary,
      portrait,
      image: null,
      status: "confirmed",
      relations: [],
      knowledge: [],
      growth: [],
      anchors: [],
    })),
    changes: [],
    history: [],
  };
  for (const [left, right, summary] of fanchenRelationSeed) {
    const owner = archive.characters.find((character) => character.name === left);
    if (!owner) continue;
    owner.relations.push({
      id: `rel-${owner.id}-${right}`,
      targetName: right,
      summary,
      pending: false,
    });
  }
  return archive;
}

export function emptyArchive(): CharacterArchive {
  return { revision: 1, characters: [], changes: [], history: [] };
}
