import {
  CharacterError,
  auditConsistency,
  commitCharacters,
  generateCharacters,
  getCharacter,
  getCharacterContext,
  proposeCharacters,
  reviewPackage,
  searchCharacters,
  validateCharacters,
} from "../src/lib/characters/store";
import type { CharacterProposal } from "../src/lib/characters/model";
import { isCharacterRole } from "../src/lib/characters/model";
import { createNovel, currentNovelId, deleteNovel, NovelError, readNovels, renameNovel } from "../src/lib/novels/store";
import { MemoryError } from "../src/lib/memory/store";
import {
  commitMemoryChanges,
  getMemoryContext,
  getMemoryDetail,
  rebuildNovelChapter,
  searchNovelMemory,
  submitMemoryChanges,
  validateNovelMemory,
} from "../src/lib/memory/store";
import type { MemoryInput } from "../src/lib/memory/operations";
import { PlotError } from "../src/lib/plot/store";
import {
  commitPlot,
  getPlotContext,
  previewPlot,
  saveChapters,
  saveEvent,
  saveForeshadowing,
  savePlotline,
  saveStory,
  saveVolumes,
  validateNovelPlot,
} from "../src/lib/plot/store";
import {
  novelContext,
  proposeEntries,
  readWorldview,
  setWorldOverview,
  syncNovelTitle,
  worldviewSnapshot,
  writingRules,
  WorldviewError,
  type EntryProposal,
} from "../src/lib/worldview/store";
import { isModuleId, moduleIds, type ModuleId } from "../src/lib/worldview/model";

type JsonRpc = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
};

const moduleList = moduleIds.join("、");

const tools = [
  {
    name: "list_novels",
    description:
      "列出应用书架上的小说，并标出当前正在写的一本。讨论新书名之前先看，避免和已有书重名。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_novel",
    description:
      "作者已经明确确认书名之后，把这本小说创建到应用书架，并切换为当前小说。还在讨论候选名字、作者没有点头时，不要调用。同名小说会被拒绝。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "作者确认后的书名" },
        genre: { type: "string", description: "题材，例如都市修仙" },
        premise: { type: "string", description: "一两句故事前提" },
        targetWan: { type: "number", description: "目标字数，单位万字。不填则是 100。" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "rename_novel",
    description:
      "修改书架上某本小说的书名。作者明确确认新书名之后再调用。不填 novelId 就修改当前小说。新书名不能和书架上另一本重复。如果世界观名称还和旧书名一样，会一并改成新书名。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "作者确认后的新书名" },
        novelId: { type: "string", description: "要改名的小说 id。不填则修改当前小说。" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_novel",
    description:
      "从书架删除一本小说，并同时删除它的正文、世界观、人物档案、剧情大纲和小说记忆。作者明确说出要删除的书名之后再调用。用 novelId 或 title 指定，不会默认删除当前小说。书架上的最后一本不能删除。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "要删除的小说 id。" },
        title: { type: "string", description: "要删除的书名。与 novelId 同时填写时，书名必须一致。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_novel_context",
    description:
      "读取当前小说的书名、类型、简介和分卷大纲。创建新书之后，这里就是新书。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_worldview",
    description:
      "读取当前世界观概述，以及八个模块下的全部设定摘要。写入前先看已有条目，避免重复和矛盾。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_writing_rules",
    description: "读取自定义模块里的写作约束，包括文风、战力尺度、称呼、时间和禁写清单。生成时必须遵守。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_world_overview",
    description: "更新世界名称和概述。对应世界观封面上的标题和简介。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "世界名称，例如玄天大陆" },
        summary: { type: "string", description: "一两段世界概述" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["name", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_entries",
    description: `批量提议设定。新条目一律是待确认，不会直接入库。同一模块里同名的待确认条目会被更新；已确认条目不会被覆盖，并在 conflicts 里返回。模块只能是：${moduleList}。`,
    inputSchema: {
      type: "object",
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              module: { type: "string", enum: [...moduleIds] },
              name: { type: "string" },
              summary: { type: "string" },
              core: { type: "boolean", description: "是否建议标为核心。作者确认前只是建议。" },
              source: { type: "string", description: "来源，例如第186章或 Codex。默认 Codex。" },
              imagePath: { type: "string", description: "本地图片路径。新设定的图随条目待确认；已确认设定只挂上待确认的图，不改原文。" },
            },
            required: ["module", "name", "summary"],
            additionalProperties: false,
          },
        },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["entries"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_characters",
    description:
      "根据当前小说的世界观和大纲整理一份角色方案。只返回方案，不写入人物档案。和作者讨论确认后，再调用 propose_character_changes。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_character",
    description: "按姓名读取一个人的完整档案，包括身份、境界、关系、所知、成长，以及尚未确认的变更和已确认的历史。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "人物姓名" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "search_characters",
    description: "按姓名、身份、境界、关系、所知或成长记录搜索人物。写一场戏之前，用它找出相关的人。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "身份、关系、剧情或人名中的关键词" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_character_context",
    description:
      "读取某一章需要的人物状态。返回截至该章已经成立的境界、所知和关系。未点名时返回核心人物、重要配角，以及在此章之前有成长或所知记录的人。openChanges 还没确认，不能当成已经发生。",
    inputSchema: {
      type: "object",
      properties: {
        chapter: { type: "number", description: "章节号，从 1 开始" },
        names: { type: "array", items: { type: "string" }, description: "只看这些人。不填则按本章需要的范围返回。" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["chapter"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_character_changes",
    description:
      "提交人物新增或变更建议。新人和修改都先记为待确认，不覆盖已经确认的档案。同名的未确认草稿会合并。关系双方必须已在档案中，或出现在同一次提交里。已有确认过的主角或女主时，不能再提议另一位。",
    inputSchema: {
      type: "object",
      properties: {
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: {
                type: "string",
                enum: ["protagonist", "heroine", "major", "important", "supporting"],
                description: "主角、女主、核心人物、重要配角、普通角色",
              },
              gender: { type: "string" },
              age: { type: "string" },
              identity: { type: "string" },
              realm: { type: "string", description: "当前境界" },
              tagline: { type: "string", description: "一句介绍" },
              summary: { type: "string", description: "人物简介" },
              anchors: {
                type: "array",
                items: { type: "string" },
                description: "这个角色挂靠的世界观条目名。写全称，与世界观里的条目名一致；挂了不存在的条目会被 audit_consistency 报为悬空。",
              },
              relations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    targetName: { type: "string" },
                    summary: { type: "string" },
                  },
                  required: ["targetName", "summary"],
                  additionalProperties: false,
                },
              },
              knowledge: {
                type: "array",
                description: "此人截至某章已经知道的事",
                items: {
                  type: "object",
                  properties: {
                    fact: { type: "string" },
                    sinceChapter: { type: "number" },
                  },
                  required: ["fact"],
                  additionalProperties: false,
                },
              },
              growth: {
                type: "array",
                description: "成长记录。确认后才改变正史里的境界。",
                items: {
                  type: "object",
                  properties: {
                    chapter: { type: "number" },
                    realm: { type: "string" },
                    note: { type: "string" },
                  },
                  required: ["note"],
                  additionalProperties: false,
                },
              },
              source: { type: "string", description: "来源，例如第186章或 Codex。默认 Codex。" },
              imagePath: { type: "string", description: "本地图片路径。新人物的图随档案待确认；已确认人物要等确认后才换头像。" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["changes"],
      additionalProperties: false,
    },
  },
  {
    name: "commit_character_changes",
    description:
      "确认人物变更，写入正史并记入历史。作者明确说确认这些人或这些变更之后再调用。用 names 或 changeIds 指定范围，不会一次确认全部。",
    inputSchema: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" }, description: "要确认的人物姓名" },
        changeIds: { type: "array", items: { type: "string" }, description: "要确认的变更 id" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "validate_characters",
    description:
      "检查人物是否自相矛盾：多主角、关系对象缺失、双方关系相反、同一章境界冲突，以及指定章节时境界是否来得太早。待确认变更会作为提醒返回。只看人物档案内部，不涉及世界观。",
    inputSchema: {
      type: "object",
      properties: {
        chapter: { type: "number", description: "可选。检查写到这一章时，境界和所知是否超前。" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "audit_consistency",
    description:
      "硬校验：世界观与人物设定是否匹配。检查核心规则/势力有没有角色承载、角色挂靠的设定是否存在、主角是否落在核心规则上、设定里提到却没挂靠的角色。结果确定、同数据同结论，可以当写入门禁。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "review_consistency",
    description:
      "软评审：把世界观与全部人物打包成评审包，附五条判断清单与输出格式，由调用方逐条判断哪些角色动机其实没有被规则支撑。本工具不下结论，只准备材料。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_plot_context",
    description:
      "读取全书总纲、当前写到的进度、分卷、主线支线与成长线、未回收伏笔、关键事件，并附上相关人物和世界观。改大纲之前先看。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "save_story_outline",
    description:
      "创建或修订全书总纲草稿。不会直接改已确认的总纲，作者确认后才写入。讨论阶段不要调用。",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "全书总纲" },
        promise: { type: "string", description: "故事对读者的核心承诺" },
        ending: { type: "string", description: "终局方向，可以先留白" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["summary"],
      additionalProperties: false,
    },
  },
  {
    name: "save_volume_outline",
    description:
      "创建或修改分卷规划草稿。用标题对应已有分卷；没有同名分卷就新增。已确认的分卷要等作者确认后才改写。",
    inputSchema: {
      type: "object",
      properties: {
        volumes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              summary: { type: "string", description: "这一卷的阶段和核心冲突" },
              total: { type: "number", description: "本卷章节数" },
              status: { type: "string", description: "done、active 或 pending" },
              mainline: { type: "string" },
              beats: { type: "array", items: { type: "string" } },
            },
            required: ["title"],
            additionalProperties: false,
          },
        },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["volumes"],
      additionalProperties: false,
    },
  },
  {
    name: "save_chapter_outlines",
    description:
      "批量创建或修改章节大纲草稿。以章节号对应已有章节。已确认的章节要等作者确认后才改写。",
    inputSchema: {
      type: "object",
      properties: {
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              number: { type: "number", description: "章节号，从 1 开始" },
              title: { type: "string" },
              summary: { type: "string" },
              status: { type: "string", description: "planned 或 done。标成 done 会在确认后推动写作进度。" },
            },
            required: ["number", "title", "summary"],
            additionalProperties: false,
          },
        },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["chapters"],
      additionalProperties: false,
    },
  },
  {
    name: "manage_plotline",
    description:
      "创建或维护主线、支线和人物成长线。action 用 create、update 或 retire。成长线必须写 characterName。已确认的线先进入草稿。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "create、update 或 retire" },
        kind: { type: "string", description: "mainline、branch 或 growth" },
        title: { type: "string" },
        summary: { type: "string" },
        characterName: { type: "string", description: "人物成长线对应的人物" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["action", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "manage_foreshadowing",
    description:
      "管理伏笔。action 用 plant 埋设、plan 计划回收、recover 实际回收、update 修改说明。chapter 是对应章节。已确认的伏笔先进入草稿。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "plant、plan、recover 或 update" },
        title: { type: "string" },
        summary: { type: "string" },
        chapter: { type: "number", description: "埋设、计划回收或实际回收的章节号" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["action", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "manage_plot_event",
    description:
      "管理关键事件、发生章节、时间标签和事件依赖。action 用 create、update 或 remove。dependsOn 填写已存在的事件标题。不能依赖自己，也不能绕成环。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "create、update 或 remove" },
        title: { type: "string" },
        summary: { type: "string" },
        chapter: { type: "number" },
        time: { type: "string", description: "时间标签，例如入夜、第三年春" },
        dependsOn: { type: "array", items: { type: "string" }, description: "必须先发生的事件标题" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["action", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_plot",
    description:
      "检查大纲逻辑、写作约束和人物是否对得上：章节是否落在分卷里、伏笔回收是否早于埋设、事件依赖是否颠倒或成环、成长线的人物是否在档案里。待确认修改会作为提醒返回。",
    inputSchema: {
      type: "object",
      properties: {
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "preview_plot_changes",
    description:
      "预览待确认的剧情修改会影响到哪些后续章节、分卷、伏笔和事件。不写盘。不填 changeIds 就预览全部待确认修改。",
    inputSchema: {
      type: "object",
      properties: {
        changeIds: { type: "array", items: { type: "string" }, description: "修改 id 或标题。不填则预览全部。" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "commit_plot_revision",
    description:
      "确认指定的剧情修改，写入大纲并记一个版本，同时按已完成章节同步写作进度。作者明确说确认这些修改之后再调用。用 changeIds 指定，不会一次确认全部。",
    inputSchema: {
      type: "object",
      properties: {
        changeIds: { type: "array", items: { type: "string" }, description: "要确认的修改 id 或标题" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["changeIds"],
      additionalProperties: false,
    },
  },
  {
    name: "get_memory_context",
    description:
      "为即将写作的章节准备记忆包。带上这一章大纲、上一章、已经发生的事件、未回收线索，以及相关人物到这一章为止的所知和状态。待确认的修改会单独列出，还不能当事实用。不填 chapter 就用当前进度的下一章。",
    inputSchema: {
      type: "object",
      properties: {
        chapter: { type: "number", description: "即将写作的章节号。不填则是当前进度的下一章。" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_novel_memory",
    description:
      "按人物、事件、时间、关键词、记忆类型或章节号查询。结果包含已确认和待确认的小说记忆，也会带上大纲和人物档案里对得上的条目。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "关键词，匹配标题、说明、原文和人物" },
        character: { type: "string", description: "人物姓名" },
        event: { type: "string", description: "事件标题或其中的词" },
        time: { type: "string", description: "时间标签，例如入夜、1994年" },
        kind: { type: "string", description: "event、state、clue、relation、fact、chapter，或 事件、状态、线索、关系、事实、章节、人物" },
        chapter: { type: "number", description: "只看这一章" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_memory_detail",
    description: "读取一条记忆的全文、影响和原文依据。优先用 id。标题唯一时也可以用标题；有多条同名记忆时会列出候选 id。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "记忆 id，或查询结果里的 id" },
        title: { type: "string", description: "记忆标题。id 和标题至少填一个。" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "submit_memory_changes",
    description:
      "提交新发现的事件、人物状态、线索、关系和事实。只进入待确认，不会改已经确认的记忆。同名记忆会改成更新。讨论阶段不要调用。",
    inputSchema: {
      type: "object",
      properties: {
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string", description: "create、update 或 retire" },
              id: { type: "string", description: "要更新或撤下的记忆 id" },
              kind: { type: "string", description: "event、state、clue、relation、fact 或 chapter" },
              title: { type: "string" },
              summary: { type: "string" },
              chapter: { type: "number", description: "这件事发生或被埋下的章节" },
              time: { type: "string", description: "时间标签" },
              characters: { type: "array", items: { type: "string" }, description: "涉及的人物姓名" },
              place: { type: "string" },
              impacts: { type: "array", items: { type: "string" }, description: "造成的变化" },
              quote: { type: "string", description: "原文依据，尽量摘录原句" },
              sourceChapter: { type: "number", description: "原文所在章节" },
              sourceNote: { type: "string", description: "出处说明。正文摘录请写明正文。" },
              dependsOn: { type: "array", items: { type: "string" }, description: "必须先发生的事件标题" },
              recoveredChapter: { type: "number", description: "线索回收章节。只对 clue 有意义。" },
              note: { type: "string", description: "这次修改的说明" },
            },
            required: ["title"],
            additionalProperties: false,
          },
        },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["changes"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_memory_changes",
    description:
      "检查待确认的记忆有没有重复、冲突，以及原文依据能不能对上章节。人物不在档案里、原文对不上大纲时给出提醒。不写盘。不填 changeIds 就检查全部待确认修改。",
    inputSchema: {
      type: "object",
      properties: {
        changeIds: { type: "array", items: { type: "string" }, description: "修改 id 或标题。不填则检查全部。" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "commit_memory_changes",
    description:
      "确认指定的记忆修改并保存。重复、冲突或引用了不存在的章节时不会写入。作者明确说确认这些记忆之后再调用。用 changeIds 指定，不会一次确认全部。",
    inputSchema: {
      type: "object",
      properties: {
        changeIds: { type: "array", items: { type: "string" }, description: "要确认的修改 id 或标题" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["changeIds"],
      additionalProperties: false,
    },
  },
  {
    name: "rebuild_chapter_memory",
    description:
      "章节大纲或正文修改后，重新提取这一章的记忆，并和已有记录核对。新提取的内容仍是待确认。传入 text 时，正文里对不上的旧提取会被提议撤下；不传 text 时只核对章节大纲。",
    inputSchema: {
      type: "object",
      properties: {
        chapter: { type: "number", description: "要重新提取的章节号" },
        text: { type: "string", description: "修改后的正文。不传则只按大纲核对。" },
        novelId: { type: "string", description: "小说 id。不填则使用当前小说。" },
      },
      required: ["chapter"],
      additionalProperties: false,
    },
  },
];

function textResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function novelIdOf(args: Record<string, unknown>) {
  return typeof args.novelId === "string" ? args.novelId : "";
}

function callTool(name: string, args: Record<string, unknown>) {
  if (name === "list_novels") {
    const catalog = readNovels();
    return textResult({
      currentId: catalog.currentId,
      novels: catalog.novels.map((novel) => ({
        id: novel.id,
        title: novel.title,
        genre: novel.genre,
        premise: novel.premise,
        status: novel.status,
        writtenWan: novel.writtenWan,
        targetWan: novel.targetWan,
        current: novel.id === catalog.currentId,
      })),
    });
  }
  if (name === "create_novel") {
    const title = typeof args.title === "string" ? args.title : "";
    const genre = typeof args.genre === "string" ? args.genre : undefined;
    const premise = typeof args.premise === "string" ? args.premise : undefined;
    const targetWan = typeof args.targetWan === "number" ? args.targetWan : undefined;
    const result = createNovel({ title, genre, premise, targetWan });
    return textResult({
      created: true,
      novel: result.novel,
      message: `《${result.novel.title}》已放入书架，并切换为当前小说。`,
    });
  }
  if (name === "rename_novel") {
    const title = typeof args.title === "string" ? args.title : "";
    const novelId = novelIdOf(args);
    const result = renameNovel({ title, novelId: novelId || undefined });
    if (result.changed) {
      syncNovelTitle(result.novel.id, result.previousTitle, result.novel.title);
    }
    return textResult({
      renamed: result.changed,
      previousTitle: result.previousTitle,
      novel: result.novel,
      message: result.changed
        ? `《${result.previousTitle}》已改名为《${result.novel.title}》。`
        : `书名已经是《${result.novel.title}》。`,
    });
  }
  if (name === "delete_novel") {
    const title = typeof args.title === "string" ? args.title : undefined;
    const novelId = novelIdOf(args);
    const result = deleteNovel({ title, novelId: novelId || undefined });
    return textResult({
      deleted: true,
      novel: result.novel,
      currentId: result.catalog.currentId,
      message: `《${result.novel.title}》已从书架删除，正文、世界观、人物档案、剧情大纲和小说记忆也已清除。`,
    });
  }
  const novelId = novelIdOf(args);
  if (name === "get_novel_context") return textResult(novelContext(novelId));
  if (name === "get_worldview") {
    const id = novelId || currentNovelId();
    return textResult(worldviewSnapshot(readWorldview(id), id));
  }
  if (name === "get_writing_rules") return textResult(writingRules(readWorldview(novelId)));
  if (name === "set_world_overview") {
    const overviewName = typeof args.name === "string" ? args.name : "";
    const summary = typeof args.summary === "string" ? args.summary : "";
    return textResult(setWorldOverview(overviewName, summary, novelId));
  }
  if (name === "propose_entries") {
    const raw = Array.isArray(args.entries) ? args.entries : [];
    const entries: EntryProposal[] = raw.map((item) => {
      const entry = item as Record<string, unknown>;
      const moduleName = typeof entry.module === "string" ? entry.module : "";
      if (!isModuleId(moduleName)) {
        throw new WorldviewError(`未知模块：${moduleName || "空"}`);
      }
      const proposal: EntryProposal = {
        module: moduleName as ModuleId,
        name: typeof entry.name === "string" ? entry.name : "",
        summary: typeof entry.summary === "string" ? entry.summary : "",
      };
      if (typeof entry.core === "boolean") proposal.core = entry.core;
      if (typeof entry.source === "string") proposal.source = entry.source;
      if (typeof entry.imagePath === "string") proposal.imagePath = entry.imagePath;
      return proposal;
    });
    return textResult(proposeEntries(entries, novelId));
  }
  if (name === "generate_characters") return textResult(generateCharacters(novelId));
  if (name === "get_character") {
    const characterName = typeof args.name === "string" ? args.name : "";
    return textResult(getCharacter(novelId, characterName));
  }
  if (name === "search_characters") {
    const query = typeof args.query === "string" ? args.query : "";
    return textResult(searchCharacters(novelId, query));
  }
  if (name === "get_character_context") {
    const chapter = typeof args.chapter === "number" ? args.chapter : Number(args.chapter);
    const names = Array.isArray(args.names) ? args.names.filter((item): item is string => typeof item === "string") : [];
    return textResult(getCharacterContext(novelId, chapter, names));
  }
  if (name === "propose_character_changes") {
    const raw = Array.isArray(args.changes) ? args.changes : [];
    return textResult(proposeCharacters(novelId, raw.map((item) => readProposal(item))));
  }
  if (name === "commit_character_changes") {
    const names = Array.isArray(args.names) ? args.names.filter((item): item is string => typeof item === "string") : [];
    const changeIds = Array.isArray(args.changeIds) ? args.changeIds.filter((item): item is string => typeof item === "string") : [];
    return textResult(commitCharacters(novelId, changeIds, names));
  }
  if (name === "validate_characters") {
    const chapter = typeof args.chapter === "number" ? args.chapter : undefined;
    return textResult(validateCharacters(novelId, chapter));
  }
  if (name === "audit_consistency") {
    return textResult(auditConsistency(novelId));
  }
  if (name === "review_consistency") {
    return textResult(reviewPackage(novelId));
  }
  if (name === "get_plot_context") return textResult(getPlotContext(novelId));
  if (name === "save_story_outline") {
    const summary = typeof args.summary === "string" ? args.summary : "";
    const promise = typeof args.promise === "string" ? args.promise : "";
    const ending = typeof args.ending === "string" ? args.ending : "";
    return textResult(withoutPlot(saveStory(novelId, summary, promise, ending)));
  }
  if (name === "save_volume_outline") {
    const volumes = Array.isArray(args.volumes) ? args.volumes.map((item) => (item ?? {}) as Record<string, unknown>) : [];
    return textResult(withoutPlot(saveVolumes(novelId, volumes)));
  }
  if (name === "save_chapter_outlines") {
    const chapters = Array.isArray(args.chapters) ? args.chapters.map((item) => (item ?? {}) as Record<string, unknown>) : [];
    return textResult(withoutPlot(saveChapters(novelId, chapters)));
  }
  if (name === "manage_plotline") {
    return textResult(withoutPlot(savePlotline(novelId, {
      action: typeof args.action === "string" ? args.action : "",
      kind: typeof args.kind === "string" ? args.kind : "",
      title: typeof args.title === "string" ? args.title : "",
      summary: typeof args.summary === "string" ? args.summary : "",
      characterName: typeof args.characterName === "string" ? args.characterName : "",
    })));
  }
  if (name === "manage_foreshadowing") {
    return textResult(withoutPlot(saveForeshadowing(novelId, {
      action: typeof args.action === "string" ? args.action : "",
      title: typeof args.title === "string" ? args.title : "",
      summary: typeof args.summary === "string" ? args.summary : "",
      chapter: typeof args.chapter === "number" ? args.chapter : undefined,
    })));
  }
  if (name === "manage_plot_event") {
    return textResult(withoutPlot(saveEvent(novelId, {
      action: typeof args.action === "string" ? args.action : "",
      title: typeof args.title === "string" ? args.title : "",
      summary: typeof args.summary === "string" ? args.summary : "",
      chapter: typeof args.chapter === "number" ? args.chapter : undefined,
      time: typeof args.time === "string" ? args.time : "",
      dependsOn: stringsOf(args.dependsOn),
    })));
  }
  if (name === "validate_plot") return textResult(validateNovelPlot(novelId));
  if (name === "preview_plot_changes") return textResult(previewPlot(novelId, stringsOf(args.changeIds)));
  if (name === "commit_plot_revision") return textResult(withoutPlot(commitPlot(novelId, stringsOf(args.changeIds))));
  if (name === "get_memory_context") {
    const chapter = typeof args.chapter === "number" ? args.chapter : undefined;
    return textResult(getMemoryContext(novelId, chapter));
  }
  if (name === "search_novel_memory") {
    const chapter = typeof args.chapter === "number" ? args.chapter : undefined;
    return textResult(searchNovelMemory(novelId, {
      query: typeof args.query === "string" ? args.query : "",
      character: typeof args.character === "string" ? args.character : "",
      event: typeof args.event === "string" ? args.event : "",
      time: typeof args.time === "string" ? args.time : "",
      kind: typeof args.kind === "string" ? args.kind : "",
      chapter,
    }));
  }
  if (name === "get_memory_detail") {
    const id = typeof args.id === "string" ? args.id : "";
    const title = typeof args.title === "string" ? args.title : "";
    return textResult(getMemoryDetail(novelId, id, title));
  }
  if (name === "submit_memory_changes") {
    const raw = Array.isArray(args.changes) ? args.changes : [];
    return textResult(submitMemoryChanges(novelId, raw.map((item) => readMemoryInput(item))));
  }
  if (name === "validate_memory_changes") return textResult(validateNovelMemory(novelId, stringsOf(args.changeIds)));
  if (name === "commit_memory_changes") return textResult(commitMemoryChanges(novelId, stringsOf(args.changeIds)));
  if (name === "rebuild_chapter_memory") {
    const chapter = typeof args.chapter === "number" ? args.chapter : Number(args.chapter);
    const prose = typeof args.text === "string" ? args.text : undefined;
    return textResult(rebuildNovelChapter(novelId, chapter, prose));
  }
  throw new WorldviewError(`未知工具：${name}`);
}

function withoutPlot<T extends { plot: unknown }>(result: T) {
  const { plot: _plot, ...rest } = result;
  return rest;
}

function stringsOf(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readMemoryInput(value: unknown): MemoryInput {
  const entry = (value ?? {}) as Record<string, unknown>;
  const input: MemoryInput = {};
  for (const key of ["action", "id", "kind", "title", "summary", "time", "place", "quote", "sourceNote", "note"] as const) {
    if (typeof entry[key] === "string") input[key] = entry[key];
  }
  for (const key of ["chapter", "sourceChapter", "recoveredChapter"] as const) {
    if (typeof entry[key] === "number") input[key] = entry[key];
  }
  for (const key of ["characters", "impacts", "dependsOn"] as const) {
    if (Array.isArray(entry[key])) input[key] = entry[key].filter((item): item is string => typeof item === "string");
  }
  return input;
}

function readProposal(value: unknown): CharacterProposal {
  const entry = (value ?? {}) as Record<string, unknown>;
  const proposal: CharacterProposal = { name: typeof entry.name === "string" ? entry.name : "" };
  if (typeof entry.role === "string" && isCharacterRole(entry.role)) proposal.role = entry.role;
  else if (typeof entry.role === "string" && entry.role) proposal.role = entry.role;
  if (typeof entry.gender === "string") proposal.gender = entry.gender;
  if (typeof entry.age === "string") proposal.age = entry.age;
  if (typeof entry.identity === "string") proposal.identity = entry.identity;
  if (typeof entry.realm === "string") proposal.realm = entry.realm;
  if (typeof entry.tagline === "string") proposal.tagline = entry.tagline;
  if (typeof entry.summary === "string") proposal.summary = entry.summary;
  if (typeof entry.source === "string") proposal.source = entry.source;
  if (typeof entry.imagePath === "string") proposal.imagePath = entry.imagePath;
  if (Array.isArray(entry.anchors)) {
    proposal.anchors = entry.anchors.flatMap((item) => (typeof item === "string" ? [item] : []));
  }
  if (Array.isArray(entry.relations)) {
    proposal.relations = entry.relations.flatMap((item) => {
      const relation = item as Record<string, unknown>;
      if (typeof relation.targetName !== "string" || typeof relation.summary !== "string") return [];
      return [{ targetName: relation.targetName, summary: relation.summary }];
    });
  }
  if (Array.isArray(entry.knowledge)) {
    proposal.knowledge = entry.knowledge.flatMap((item) => {
      const fact = item as Record<string, unknown>;
      if (typeof fact.fact !== "string") return [];
      return [{ fact: fact.fact, sinceChapter: typeof fact.sinceChapter === "number" ? fact.sinceChapter : null }];
    });
  }
  if (Array.isArray(entry.growth)) {
    proposal.growth = entry.growth.flatMap((item) => {
      const growth = item as Record<string, unknown>;
      if (typeof growth.note !== "string") return [];
      return [{
        note: growth.note,
        realm: typeof growth.realm === "string" ? growth.realm : "",
        chapter: typeof growth.chapter === "number" ? growth.chapter : null,
      }];
    });
  }
  return proposal;
}

function respond(id: number | string | null | undefined, result: unknown) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result })}\n`);
}

function fail(id: number | string | null | undefined, message: string) {
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32603, message },
    })}\n`,
  );
}

function handle(message: JsonRpc) {
  if (!message.method || message.id === undefined) return;
  try {
    if (message.method === "initialize") {
      respond(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "novel-worldview", version: "0.1.0" },
      });
      return;
    }
    if (message.method === "ping") {
      respond(message.id, {});
      return;
    }
    if (message.method === "tools/list") {
      respond(message.id, { tools });
      return;
    }
    if (message.method === "tools/call") {
      const name = message.params?.name ?? "";
      const args = message.params?.arguments ?? {};
      respond(message.id, callTool(name, args));
      return;
    }
    fail(message.id, `不支持的方法：${message.method}`);
  } catch (error) {
    const messageText =
      error instanceof WorldviewError || error instanceof NovelError || error instanceof CharacterError || error instanceof PlotError || error instanceof MemoryError
        ? error.message
        : error instanceof Error
          ? error.message
          : "工具调用失败";
    if (message.method === "tools/call") {
      respond(message.id, textResult(messageText, true));
      return;
    }
    fail(message.id, messageText);
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let newline = buffer.indexOf("\n");
  while (newline !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    newline = buffer.indexOf("\n");
    if (!line) continue;
    try {
      handle(JSON.parse(line) as JsonRpc);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "无法解析请求";
      fail(null, messageText);
    }
  }
});
