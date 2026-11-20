export type NovelStatus = "writing" | "done";
export type NovelCoverId = "novel" | "star" | "river";

export type NovelRecord = {
  id: string;
  title: string;
  genre: string;
  premise: string;
  status: NovelStatus;
  writtenWan: number;
  targetWan: number;
  cover: NovelCoverId;
};

export type NovelCatalog = {
  revision: number;
  currentId: string;
  novels: NovelRecord[];
};

export const seedCatalog: NovelCatalog = {
  revision: 1,
  currentId: "fanchen-wendao",
  novels: [
    {
      id: "fanchen-wendao",
      title: "凡尘问道",
      genre: "都市修仙",
      premise:
        "修仙文明与凡人王朝并存。主角从凡尘踏入修行，逐渐卷入宗门、王朝与隐秘势力的争夺。",
      status: "writing",
      writtenWan: 55.8,
      targetWan: 100,
      cover: "novel",
    },
    {
      id: "xinghai-jiyuan",
      title: "星海纪元",
      genre: "科幻冒险",
      premise: "人类离开母星后，在破碎的星海里寻找还能停靠的文明。",
      status: "writing",
      writtenWan: 12.4,
      targetWan: 80,
      cover: "star",
    },
    {
      id: "linjiang-ke",
      title: "临江客",
      genre: "历史武侠",
      premise: "江岸客栈里的一桩旧案，把一个过路人卷进朝堂与江湖之间。",
      status: "done",
      writtenWan: 50,
      targetWan: 50,
      cover: "river",
    },
  ],
};
