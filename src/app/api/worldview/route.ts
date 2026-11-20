import { connection } from "next/server";
import { isModuleId, type ModuleId } from "@/lib/worldview/model";
import {
  confirmEntry,
  createEntry,
  proposeEntries,
  readWorldview,
  reorderModules,
  setWorldOverview,
  toggleCore,
  WorldviewError,
  type EntryProposal,
} from "@/lib/worldview/store";

export async function GET(request: Request) {
  await connection();
  const novelId = new URL(request.url).searchParams.get("novelId") ?? "";
  return Response.json({ state: readWorldview(novelId) });
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      summary?: string;
      id?: string;
      module?: string;
      core?: boolean;
      order?: ModuleId[];
      entries?: EntryProposal[];
      novelId?: string;
      imageId?: string;
    };
    const novelId = body.novelId ?? "";

    if (body.action === "set_overview") {
      setWorldOverview(body.name ?? "", body.summary ?? "", novelId);
    } else if (body.action === "propose_entries") {
      const result = proposeEntries(body.entries ?? [], novelId);
      return Response.json({ state: readWorldview(novelId), result });
    } else if (body.action === "confirm") {
      confirmEntry(body.id ?? "", novelId);
    } else if (body.action === "toggle_core") {
      const result = toggleCore(body.id ?? "", novelId);
      return Response.json({ state: result.state, core: result.core });
    } else if (body.action === "create_entry") {
      if (!body.module || !isModuleId(body.module)) {
        throw new WorldviewError("未知模块");
      }
      createEntry(
        {
          module: body.module,
          name: body.name ?? "",
          summary: body.summary ?? "",
          core: body.core === true,
          imageId: body.imageId,
        },
        novelId,
      );
    } else if (body.action === "reorder") {
      reorderModules(body.order ?? [], novelId);
    } else {
      throw new WorldviewError("未知操作");
    }

    return Response.json({ state: readWorldview(novelId) });
  } catch (error) {
    const message = error instanceof WorldviewError ? error.message : "保存失败";
    const status = error instanceof WorldviewError ? 400 : 500;
    return Response.json({ message }, { status });
  }
}
