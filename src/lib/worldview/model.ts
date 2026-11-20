export const moduleIds = [
  "background",
  "region",
  "cultivation",
  "faction",
  "item",
  "rule",
  "history",
  "custom",
] as const;

export type ModuleId = (typeof moduleIds)[number];

export const moduleLabels: Record<ModuleId, string> = {
  background: "世界背景",
  region: "地理区域",
  cultivation: "修炼体系",
  faction: "势力组织",
  item: "资源物品",
  rule: "世界规则",
  history: "历史事件",
  custom: "自定义",
};

export type Entry = {
  id: string;
  module: ModuleId;
  name: string;
  summary: string;
  core: boolean;
  pending: boolean;
  source?: string;
  image?: string | null;
  pendingImage?: string | null;
};

export type Activity = {
  id: string;
  badge: string;
  title: string;
  detail: string;
  entryId: string;
};

export type WorldviewState = {
  revision: number;
  worldName: string;
  worldSummary: string;
  order: ModuleId[];
  entries: Entry[];
  activities: Activity[];
};

export type NovelVolume = {
  id: string;
  title: string;
  status: "done" | "active" | "pending";
  written: number;
  total: number;
  mainline?: string;
  beats?: string[];
};

export const novelVolumes: NovelVolume[] = [
  { id: "v1", title: "第一卷·凡尘初醒", status: "done", written: 40, total: 40 },
  { id: "v2", title: "第二卷·灵路初行", status: "done", written: 40, total: 40 },
  {
    id: "v3",
    title: "第三卷·暗流涌动",
    status: "active",
    written: 40,
    total: 40,
    mainline:
      "主角卷入修仙界的隐秘纷争，发现幕后势力，实力提升并初步接触更大的世界。",
    beats: ["揭开第92章的伏笔", "主角与新势力正面交锋", "获得重要修炼资源"],
  },
  { id: "v4", title: "第四卷·宗门风云", status: "pending", written: 0, total: 40 },
  { id: "v5", title: "第五卷·域外之地", status: "pending", written: 0, total: 40 },
  { id: "v6", title: "第六卷·天机暗涌", status: "pending", written: 0, total: 40 },
  { id: "v7", title: "第七卷·诸天来客", status: "pending", written: 0, total: 40 },
  { id: "v8", title: "第八卷·问道终章", status: "pending", written: 0, total: 40 },
];

export function isModuleId(value: string): value is ModuleId {
  return (moduleIds as readonly string[]).includes(value);
}

type Flag = "core" | "pending";

function define(
  module: ModuleId,
  rows: Array<[string, string, Flag?, string?]>,
): Entry[] {
  return rows.map(([name, summary, flag, source], index) => ({
    id: `${module}-${index + 1}`,
    module,
    name,
    summary,
    core: flag === "core",
    pending: flag === "pending",
    source,
  }));
}

export function emptyWorld(title: string, premise: string): WorldviewState {
  return {
    revision: 1,
    worldName: title,
    worldSummary: premise.trim() || "尚未填写世界概述。",
    order: [...moduleIds],
    entries: [],
    activities: [],
  };
}

export function createSeed(): WorldviewState {
  return {
    revision: 1,
    worldName: "玄天大陆",
    worldSummary:
      "修仙文明与凡人王朝并存，各大势力争夺灵气资源，天地法则逐渐改变，仙凡之约正在松动。",
    order: [...moduleIds],
    entries: [
      ...define("background", [
        ["玄天大陆", "此方世界的总称，仙凡共居，灵气自东玄山脉向四野弥漫。"],
        ["灵气潮汐", "灵气每六十年涨落一次，涨潮时秘境开启，退潮时凡人王朝扩张。", "core"],
        ["凡仙并存", "凡人王朝掌管城池赋税，修士宗门占据灵脉，彼此默契又互相提防。"],
        ["天地法则", "法则会因大能陨落和灵气异变而改写，旧的境界天花板正在松动。", "core"],
        ["纪元更迭", "上一个仙朝崩塌后留下残缺天道，本纪元才刚进入灵气回潮。"],
        ["灵脉分布", "灵脉主干在东玄与中州，支脉断续，边陲常出现无主矿眼。"],
      ]),
      ...define("region", [
        ["幽冥谷", "终年不见日头的裂谷，谷底有一条倒流的寒灵河。", "pending", "第186章"],
        ["青云城", "青云宗外门所在的山城，坊市与王朝驿站并立。"],
        ["临江", "江岸商埠，散修与凡人船帮在此交易灵材。"],
        ["东玄山脉", "大陆主脉，瀑布与洞天多藏于云层之上。"],
        ["北境雪原", "王庭牧地，灵气稀薄，却埋着上古战阵。"],
        ["南疆密林", "妖兽与毒瘴交织，药王谷在林心开口。"],
        ["中州皇城", "大燕王朝的都城，禁制隔开了内城与修士坊市。"],
        ["落霞港", "通往无尽海的港口，星海商会的船队从这里出发。"],
        ["天机阁遗址", "断裂的观星台，残卷仍会自行翻页。"],
        ["无尽海", "大陆以东的雾海，海上灵潮能把人送去另一处海岸。"],
        ["赤焰荒漠", "火脉外露的荒漠，夜中沙下有莲开的声音。"],
        ["云梦泽", "大泽连着天，湖心岛只在月圆时现出道路。"],
        ["星落平原", "曾有星铁坠落，现在是王朝屯田与低阶修士的缓冲带。"],
        ["万妖岭", "妖族聚集的山脉，与青云宗以一条灵河为界。"],
      ]),
      ...define("cultivation", [
        ["炼气", "引气入体的起点，共九层，层满才能冲击筑基。", "core"],
        ["筑基", "筑就道基，寿元延至二百，可御器飞行短途。"],
        ["金丹", "道基凝丹，灵力由气转液，可开辟小型洞府。"],
        ["元婴", "丹破婴生，神识外放，开始接触天地法则。"],
        ["化神", "神念化形，一言可改一地灵气浓淡。"],
        ["炼虚", "炼假还真，能短暂借用地脉。"],
        ["合体", "身神相合，宗门通常到此即称老祖。"],
        ["大乘", "当前可见的天花板，渡劫后去向不明。"],
      ]),
      ...define("faction", [
        ["青云宗", "东玄正道大宗，外门在青云城，内门藏于主峰云海。", "core"],
        ["天机阁", "已残的观星组织，残部仍在出售残卷与预言。"],
        ["大燕王朝", "中州凡人王朝，以镇魔司制衡境内修士。"],
        ["幽冥教", "活动于幽冥谷一带的隐秘教派，擅寒灵与夺舍传闻。"],
        ["万宝楼", "跨城坊市，明面拍卖灵材，暗面接取宗门委托。"],
        ["散修联盟", "松散的互保盟约，临江是他们的常驻码头。"],
        ["北境王庭", "雪原上凡人与巫祝共治的王庭。"],
        ["药王谷", "南疆医修一脉，中立，谁伤重都可以求药。"],
        ["剑庐", "只收剑修的小型庐舍，不入正魔之争。"],
        ["星海商会", "跑无尽海的商会，用星图换灵石。"],
        ["镇魔司", "王朝官署，负责登记高阶修士入境。"],
        ["隐世世家", "不入宗门名录的血脉世家，家徽最近才重新露面。", "pending", "第159章"],
      ]),
      ...define("item", [
        ["灵石", "通用货币与修炼消耗品，中品以上受镇魔司管制。", "core"],
        ["筑基丹", "提高筑基成功率的丹药，药王谷每年只出两炉。"],
        ["青云剑", "青云外门制式飞剑，认主后可随灵气潮汐增幅。"],
        ["星陨铁", "星落平原出土的金属，能稳住破碎的法宝。"],
        ["聚灵阵盘", "小型聚灵器具，洞府标配，退潮期效果减半。"],
        ["传送符", "一次性短距传送，不能穿过大阵与海域。"],
        ["护心镜", "挡住一次神识窥探，碎后会留下施术者的气息。"],
        ["万年灵乳", "云梦泽湖心才有的灵液，可洗练根骨。"],
        ["天机残卷", "会自行改写内容的残页，曾指向幽冥谷的方向。", "pending", "第172章"],
        ["玄冰", "北境地底的寒冰，可封存灵药与神魂波动。"],
        ["火莲子", "赤焰荒漠夜开的莲实，金丹修士用来稳固心火。"],
      ]),
      ...define("rule", [
        ["灵气守恒", "灵气不会凭空增加，潮汐只是在山川之间重新分配。", "core"],
        ["境界压制", "大境界差距无法用数量抹平，跨两境需外物或地利。", "core"],
        ["天劫", "每个大境界突破都有劫，失败则境界跌落并损寿元。", "core"],
        ["因果", "夺舍、屠城与毁脉会在下一次天劫中被清算。", "core"],
        ["禁制", "城池、洞天与海域各有禁制，强行突破会惊动镇守。", "core"],
        ["寿元", "寿元用尽前必须突破，丹药只能延缓，不能重置。", "core"],
      ]),
      ...define("history", [
        ["灵气复苏", "本纪元开始的标志，东玄主脉重新喷涌。"],
        ["仙凡分治", "仙朝崩塌后立下的约定：王朝不夺灵脉，宗门不立皇。", "core"],
        ["青云立宗", "青云宗借复苏的主脉开山，成为东玄第一宗。"],
        ["北境之战", "王庭与妖族停战，以万妖岭灵河为界。"],
        ["天机断裂", "天机阁观星失败，星穹出现无法推演的空白。"],
      ]),
      ...define("custom", [
        ["文风约束", "叙述保持冷峻白话，不使用现代网络语。"],
        ["战力尺度", "同境斗法看功法与地利，不写无代价的越级连胜。"],
        ["称呼规范", "王朝用官职称呼，宗门用师门辈分，散修互称道友。"],
        ["时间换算", "一年三百六十日，灵气潮汐以六十年为一周。"],
        ["货币体系", "凡钱与灵石分账，一枚下品灵石抵百两官银。"],
        ["禁写清单", "不出现系统面板、现代科技和地球地理。"],
      ]),
    ],
    activities: [
      {
        id: "act-youming",
        badge: "新",
        title: "新增：幽冥谷",
        detail: "来自第186章 · 待确认",
        entryId: "region-1",
      },
    ],
  };
}

export function getNovelContext() {
  return {
    id: "fanchen-wendao",
    title: "凡尘问道",
    genre: "都市修仙",
    status: "创作中",
    writtenWan: 55.8,
    targetWan: 100,
    premise:
      "修仙文明与凡人王朝并存。主角从凡尘踏入修行，逐渐卷入宗门、王朝与隐秘势力的争夺。",
    volumes: novelVolumes.map((volume) => ({
      id: volume.id,
      title: volume.title,
      status: volume.status,
      chapters: volume.total,
      writtenChapters: volume.written,
      mainline: volume.mainline ?? null,
      beats: volume.beats ?? [],
    })),
    modules: moduleIds.map((id) => ({ id, label: moduleLabels[id] })),
  };
}
