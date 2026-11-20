import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(root, "node_modules/typescript/bin/tsc");
const compiled = spawnSync(process.execPath, [tsc, "-p", "tsconfig.mcp.json"], {
  cwd: root,
  encoding: "utf8",
});

if (compiled.status !== 0) {
  process.stderr.write(compiled.stdout ?? "");
  process.stderr.write(compiled.stderr ?? "");
  process.exit(compiled.status ?? 1);
}

const child = spawn(process.execPath, [join(root, "mcp/dist/mcp/server.js")], {
  cwd: root,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
