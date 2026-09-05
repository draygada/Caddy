import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const roots = [
  path.join(appRoot, "src"),
  path.join(appRoot, "scripts"),
  path.join(repoRoot, "tests", "browser-workbench"),
];

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectJavaScript(target);
        return /\.(?:js|mjs)$/.test(entry.name) ? [target] : [];
      }),
  );
  return nested.flat();
}

const files = (await Promise.all(roots.map(collectJavaScript))).flat().sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax-checked ${files.length} JavaScript modules.`);
