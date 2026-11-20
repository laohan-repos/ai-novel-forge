import { novelVolumes } from "../worldview/model";

export type PlotItemStatus = "pending" | "confirmed";
export type VolumeStatus = "done" | "active" | "pending";
export type ChapterStatus = "planned" | "done";
export type PlotlineKind = "mainline" | "branch" | "growth";
export type PlotTarget = "story" | "volume" | "chapter" | "plotline" | "foreshadowing" | "event";
export type PlotAction = "create" | "update" | "retire" | "recover";

export type StoryOutline = {
  summary: string;
  promise: string;
  ending: string;
  status: PlotItemStatus;
};

export type VolumePlan = {
  id: string;
  title: string;
  summary: string;
  status: VolumeStatus;
  written: number;
  total: number;
  mainline: string;
  beats: string[];
  itemStatus: PlotItemStatus;
  retired: boolean;
};

export type ChapterPlan = {
  id: string;
  number: number;
  title: string;
  summary: string;
  status: ChapterStatus;
  itemStatus: PlotItemStatus;
  retired: boolean;
};

export type Plotline = {
  id: string;
  kind: PlotlineKind;
  title: string;
  summary: string;
  characterName: string;
  itemStatus: PlotItemStatus;
  retired: boolean;
};

export type Foreshadowing = {
  id: string;
  title: string;
  summary: string;
  plantedChapter: number | null;
  plannedChapter: number | null;
  recoveredChapter: number | null;
  itemStatus: PlotItemStatus;
  retired: boolean;
};

export type PlotEvent = {
  id: string;
  title: string;
  summary: string;
  chapter: number | null;
  time: string;
  dependsOn: string[];
  itemStatus: PlotItemStatus;
  retired: boolean;
};

export type PlotChange = {
  id: string;
  target: PlotTarget;
  targetId: string;
  action: PlotAction;
  title: string;
  note: string;
  payload: Record<string, unknown>;
};

export type PlotRevision = {
  id: string;
  summary: string;
  changeIds: string[];
  writtenChapters: number;
};

export type PlotState = {
  revision: number;
  story: StoryOutline;
  volumes: VolumePlan[];
  chapters: ChapterPlan[];
  plotlines: Plotline[];
  foreshadowing: Foreshadowing[];
  events: PlotEvent[];
  changes: PlotChange[];
  history: PlotRevision[];
  progress: { writtenChapters: number; currentChapter: number };
};

export function isPlotlineKind(value: string): value is PlotlineKind {
  return value === "mainline" || value === "branch" || value === "growth";
}

export function isVolumeStatus(value: string): value is VolumeStatus {
  return value === "done" || value === "active" || value === "pending";
}

export function isChapterStatus(value: string): value is ChapterStatus {
  return value === "planned" || value === "done";
}

export function emptyPlot(): PlotState {
  return {
    revision: 1,
    story: { summary: "", promise: "", ending: "", status: "confirmed" },
    volumes: [
      {
        id: "v1",
        title: "第一卷·未命名",
        summary: "",
        status: "pending",
        written: 0,
        total: 40,
        mainline: "",
        beats: [],
        itemStatus: "confirmed",
        retired: false,
      },
    ],
    chapters: [],
    plotlines: [],
    foreshadowing: [],
    events: [],
    changes: [],
    history: [],
    progress: { writtenChapters: 0, currentChapter: 0 },
  };
}

const fanchenLines: Array<[PlotlineKind, string, string, string]> = [
  ["mainline", "凡尘入道", "陆沉从凡人踏入修行，金丹初期仍在追查幕后势力。", ""],
  ["mainline", "宗门暗流", "青云宗、天璇宗与镇魔司互相试探，旧识赵无极已经决裂。", ""],
  ["mainline", "问道终章", "玄清长老的身份、王朝与宗门的因果，留到终卷揭开。", ""],
  ["branch", "苏清雪同行", "天璇宗弟子与主角并肩，世家身份逐渐露出来。", "苏清雪"],
  ["branch", "赵无极决裂", "曾经的好友立场分开，见面先把话锋抵到最硬。", "赵无极"],
  ["branch", "玄清长老", "青云宗长老话里总留半句，身份始终没有说透。", "玄清长老"],
  ["branch", "林婉儿的阵", "关键时用阵法与灵器给陆沉留后路。", "林婉儿"],
  ["branch", "白疏影较剑", "和外门剑修的胜负，牵着苏清雪一起往前。", "白疏影"],
  ["branch", "叶知秋丹道", "药园管事手里的丹药，决定陆沉还能不能站起来。", "叶知秋"],
  ["branch", "韩铁衣铸器", "只把能用的法器交给经得起打的人。", "韩铁衣"],
  ["branch", "江晚舟的来历", "镇魔司联络人对陆沉的出身格外在意。", "江晚舟"],
  ["branch", "顾承渊散修", "路上的对手，也是少数愿意把实情说完的人。", "顾承渊"],
  ["branch", "坊市柳三娘", "什么都卖，也给陆沉留过一条不记账的后路。", "柳三娘"],
  ["branch", "药园裴照", "认植物不认人，苏清雪愿意放下身段请教。", "裴照"],
  ["branch", "护山大阵", "唐晚守着大阵，不许任何人在修阵时插嘴。", "唐晚"],
];

const fanchenHooks: Array<[string, string, number | null, number | null, number | null]> = [
  ["第92章残卷", "陆沉翻到不该翻的残卷，伏笔已经在第三卷揭开。", 92, 110, 110],
  ["矿洞脚步", "铁柱说矿洞深处有不该有的脚步，后来对上了幕后势力。", 40, 100, 100],
  ["不记账的后路", "柳三娘留下的那笔账，在坊市脱身时用掉了。", 50, 80, 80],
  ["玄清半句", "长老没说完的话，在宗门风波里对上了一半。", 30, 120, 120],
  ["赵无极信物", "决裂前留下的旧物，已经说明两人不再同行。", 20, 70, 70],
  ["苏家禁地", "清雪提起过一次的禁地，在同行历练里露了入口。", 60, 100, 100],
  ["镇魔司名册", "江晚舟手里的名册，对上了陆沉入门前的名字。", 45, 90, 90],
  ["外门暗记", "考核时的暗记，后来证明不是沈照雪一个人的意思。", 15, 55, 55],
  ["青云后山", "月夜才有人出现的后山，还没写明是谁在等。", 130, 160, null],
  ["天机残部", "天机阁卖掉的预言，还没落到具体的章节。", null, null, null],
  ["王朝眼线", "小满还没选边，她听到的那句话也还没回收。", null, null, null],
  ["客栈名册", "春桃记得的那个付不起房钱的名字，尚未揭开。", null, null, null],
  ["铸器余温", "韩铁衣拒绝交付的那件法器，还在炉里。", null, null, null],
  ["护山缺口", "大阵上有一处唐晚不肯解释的缺口。", null, null, null],
  ["散修旧账", "顾承渊说了一半的来历，约好终卷再讲。", null, null, null],
  ["药园异种", "裴照认出来的那株灵植，不属于天璇宗。", null, null, null],
  ["执法堂案卷", "周衡压下的那份案卷，还没给陆沉看。", null, null, null],
  ["白疏影的剑意", "较剑时刺偏的那一剑，像是故意留的。", null, null, null],
  ["丹方缺味", "叶知秋有一张不肯炼的丹方。", null, null, null],
  ["驿站停车", "老周总把车停在同一处，像在等某个人。", null, null, null],
  ["主峰云海", "青云宗内门云海里有一座不对客的殿。", null, null, null],
  ["幕后印记", "陆沉追查的印记，还没有对上具体的人。", null, null, null],
  ["终卷天机", "第八卷才该揭开的那句预言，现在不能提前说。", null, 320, null],
  ["凡尘旧名", "陆沉入道前的名字，还有人在王朝的册子上找。", null, null, null],
];

export function fanchenPlot(): PlotState {
  return {
    revision: 1,
    story: {
      summary: "修仙文明与凡人王朝并存。主角从凡尘踏入修行，逐渐卷入宗门、王朝与隐秘势力的争夺。",
      promise: "陆沉要查清幕后势力，也要在凡尘与修行之间站住。",
      ending: "玄清长老的身份、王朝与宗门的因果，留到第八卷揭开。",
      status: "confirmed",
    },
    volumes: novelVolumes.map((volume) => ({
      id: volume.id,
      title: volume.title,
      summary: volume.mainline ?? "",
      status: volume.status,
      written: volume.written,
      total: volume.total,
      mainline: volume.mainline ?? "",
      beats: volume.beats ?? [],
      itemStatus: "confirmed",
      retired: false,
    })),
    chapters: [],
    plotlines: fanchenLines.map(([kind, title, summary, characterName], index) => ({
      id: kind === "mainline" ? `m${index + 1}` : `b${index - 2}`,
      kind,
      title,
      summary,
      characterName,
      itemStatus: "confirmed",
      retired: false,
    })),
    foreshadowing: fanchenHooks.map(([title, summary, plantedChapter, plannedChapter, recoveredChapter], index) => ({
      id: `h${index + 1}`,
      title,
      summary,
      plantedChapter,
      plannedChapter,
      recoveredChapter,
      itemStatus: "confirmed",
      retired: false,
    })),
    events: [],
    changes: [],
    history: [],
    progress: { writtenChapters: 186, currentChapter: 186 },
  };
}
