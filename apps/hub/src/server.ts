import { resolve } from "node:path";
import { buildHubApp } from "./app.js";

async function start(): Promise<void> {
  const port = Number(process.env.ADE_PORT ?? 3000);
  const host = process.env.ADE_HOST ?? "127.0.0.1";
  const dataDir = process.env.ADE_DATA_DIR ?? resolve(process.cwd(), ".ade-data");
  const dbPath = resolve(dataDir, "ade.db");

  const { app } = await buildHubApp({ dbPath });
  await app.listen({ port, host });
  console.log(`ADE Hub listening on http://${host}:${port} (db: ${dbPath})`);
}

void start();
