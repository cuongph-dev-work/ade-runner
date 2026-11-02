import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildHubApp } from "./app.js";

function findGitRoot(startDir: string): string {
  let cur = resolve(startDir);
  while (cur !== dirname(cur)) {
    if (existsSync(resolve(cur, ".git"))) {
      return cur;
    }
    cur = dirname(cur);
  }
  return startDir;
}

async function start(): Promise<void> {
  const port = Number(process.env.ADE_PORT ?? 3000);
  const host = process.env.ADE_HOST ?? "127.0.0.1";
  const gitRoot = findGitRoot(process.cwd());
  const dataDir = process.env.ADE_DATA_DIR ?? resolve(gitRoot, ".ade-data");
  const dbPath = resolve(dataDir, "ade.db");
  const defaultRepoPath = process.env.ADE_DEFAULT_REPO ?? gitRoot;

  const { app } = await buildHubApp({ dbPath, defaultRepoPath });
  await app.listen({ port, host });
  console.log(`ADE Hub listening on http://${host}:${port} (db: ${dbPath})`);
}

void start();
