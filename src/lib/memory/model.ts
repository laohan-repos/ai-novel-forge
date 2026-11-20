export const memoryKinds = ["event", "state", "clue", "relation", "fact", "chapter"] as const;

export type MemoryKind = (typeof memoryKinds)[number];
export type MemoryStatus = "pending" | "confirmed";
export type MemoryAction = "create" | "update" | "retire";

export type MemoryPayload = {
  kind: MemoryKind;
  title: string;
  summary: string;
  chapter: number | null;
  time: string;
  characters: string[];
  place: string;
  impacts: string[];
  quote: string;
  sourceChapter: number | null;
  sourceNote: string;
  dependsOn: string[];
  recoveredChapter: number | null;
};

export type MemoryRecord = MemoryPayload & {
  id: string;
  status: MemoryStatus;
  retired: boolean;
};

export type MemoryChange = {
  id: string;
  action: MemoryAction;
  targetId: string;
  kind: MemoryKind;
  title: string;
  note: string;
  payload: MemoryPayload;
};

export type MemoryRevision = {
  id: string;
  summary: string;
  changeIds: string[];
  chapter: number | null;
};

export type MemoryExtract = {
  chapter: number;
  source: string;
  itemIds: string[];
};

export type MemoryState = {
  revision: number;
  items: MemoryRecord[];
  changes: MemoryChange[];
  history: MemoryRevision[];
  extracts: MemoryExtract[];
};

export function isMemoryKind(value: string): value is MemoryKind {
  return (memoryKinds as readonly string[]).includes(value);
}

export function emptyMemory(): MemoryState {
  return { revision: 1, items: [], changes: [], history: [], extracts: [] };
}
