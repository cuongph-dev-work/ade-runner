import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openHubDatabase } from "../../apps/hub/src/db/client.js";

function verifyAppendOnly(): void {
  const dir = mkdtempSync(join(tmpdir(), "ade-verify-p0-"));
  const dbPath = join(dir, "ade.db");
  const hubDb = openHubDatabase(dbPath);

  try {
    hubDb.appendEvent({
      id: "evt_01JVERIFY00000000000000001",
      type: "project.registered",
      ts: new Date().toISOString(),
      project_id: "prj_verify",
      thread_id: null,
      run_id: null,
      actor: { type: "human", id: "usr_local" },
      causation_id: null,
      correlation_id: null,
      payload: { project_id: "prj_verify" }
    });

    let updateBlocked = false;
    try {
      hubDb.sqlite.prepare("UPDATE events SET actor_id = 'tampered'").run();
    } catch {
      updateBlocked = true;
    }

    let deleteBlocked = false;
    try {
      hubDb.sqlite.prepare("DELETE FROM events").run();
    } catch {
      deleteBlocked = true;
    }

    const count = hubDb.countEvents();
    console.log(`[${count === 1 ? "PASS" : "FAIL"}] events INSERT & count === 1`);
    console.log(`[${updateBlocked ? "PASS" : "FAIL"}] SQLite trigger blocks UPDATE on events`);
    console.log(`[${deleteBlocked ? "PASS" : "FAIL"}] SQLite trigger blocks DELETE on events`);

    if (count !== 1 || !updateBlocked || !deleteBlocked) {
      process.exit(1);
    }
  } finally {
    hubDb.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

verifyAppendOnly();
