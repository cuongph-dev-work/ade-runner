import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApiErrorResponseSchema, HealthResponseSchema } from "@ade/shared";
import { buildHubApp, type HubServerBundle } from "../src/index.js";

describe("@ade/hub append-only events & GET /api/health", () => {
  const cleanupDirs: string[] = [];
  let bundle: HubServerBundle | null = null;

  afterEach(async () => {
    if (bundle) {
      await bundle.app.close();
      bundle = null;
    }
    for (const dir of cleanupDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), "ade-hub-test-"));
    cleanupDirs.push(dir);
    return join(dir, "ade.db");
  }

  it("AC-API-P0-01-01: returns HTTP 200 HealthResponseSchema for localhost Host + Origin with 0 events", async () => {
    bundle = await buildHubApp({ dbPath: createTempDbPath(), version: "0.1.0" });
    const res = await bundle.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "localhost:3000", origin: "http://localhost:5173" }
    });

    expect(res.statusCode).toBe(200);
    const parsed = HealthResponseSchema.parse(res.json());
    expect(parsed).toEqual({
      status: "ok",
      mode: "solo",
      dbConnected: true,
      eventCount: 0,
      version: "0.1.0"
    });
  });

  it("AC-API-P0-01-02 & append-only triggers: counts appended events and blocks UPDATE/DELETE", async () => {
    bundle = await buildHubApp({ dbPath: createTempDbPath() });

    bundle.hubDb.appendEvent({
      id: "evt_01J00000000000000000000001",
      type: "project.registered",
      ts: "2026-10-31T06:00:00.000Z",
      project_id: "prj_01",
      thread_id: null,
      run_id: null,
      actor: { type: "human", id: "usr_local" },
      causation_id: null,
      correlation_id: null,
      payload: { project_id: "prj_01", name: "Demo", repo_path: "/tmp/demo", workflow_id: "feature" }
    });
    bundle.hubDb.appendEvent({
      id: "evt_01J00000000000000000000002",
      type: "channel.created",
      ts: "2026-10-31T06:00:01.000Z",
      project_id: "prj_01",
      thread_id: null,
      run_id: null,
      actor: { type: "human", id: "usr_local" },
      causation_id: null,
      correlation_id: null,
      payload: {
        channel_id: "chn_01",
        project_id: "prj_01",
        name: "general",
        description: "",
        member_user_ids: ["usr_local"],
        member_agent_ids: []
      }
    });

    expect(() =>
      bundle!.hubDb.sqlite.prepare("UPDATE events SET type = 'hacked'").run()
    ).toThrow(/append-only/);
    expect(() =>
      bundle!.hubDb.sqlite.prepare("DELETE FROM events").run()
    ).toThrow(/append-only/);

    const res = await bundle.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "127.0.0.1:3000" }
    });
    expect(res.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(res.json()).eventCount).toBe(2);
  });

  it("AC-API-P0-01-03: rejects non-local Origin and Origin: null with HTTP 403 ERR_LOCAL_ORIGIN_ONLY", async () => {
    bundle = await buildHubApp({ dbPath: createTempDbPath() });
    for (const badOrigin of ["https://evil.example.com", "null"]) {
      const res = await bundle.app.inject({
        method: "GET",
        url: "/api/health",
        headers: { host: "localhost:3000", origin: badOrigin }
      });

      expect(res.statusCode).toBe(403);
      const err = ApiErrorResponseSchema.parse(res.json());
      expect(err.code).toBe("ERR_LOCAL_ORIGIN_ONLY");
    }
  });

  it("AC-API-P0-01-04 & AC-API-P0-01-06: rejects non-local Host both without Origin and with localhost Origin (DNS rebinding)", async () => {
    bundle = await buildHubApp({ dbPath: createTempDbPath() });

    const noOriginRes = await bundle.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "ade.remote.example.com" }
    });
    expect(noOriginRes.statusCode).toBe(403);
    expect(ApiErrorResponseSchema.parse(noOriginRes.json()).code).toBe("ERR_LOCAL_ORIGIN_ONLY");

    const rebindRes = await bundle.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "ade.remote.example.com", origin: "http://localhost:5173" }
    });
    expect(rebindRes.statusCode).toBe(403);
    expect(ApiErrorResponseSchema.parse(rebindRes.json()).code).toBe("ERR_LOCAL_ORIGIN_ONLY");
  });

  it("AC-API-P0-01-05: returns HTTP 500 ERR_INTERNAL_ERROR when SQLite connection is closed", async () => {
    bundle = await buildHubApp({ dbPath: createTempDbPath() });
    bundle.hubDb.close();

    const res = await bundle.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }
    });

    expect(res.statusCode).toBe(500);
    const err = ApiErrorResponseSchema.parse(res.json());
    expect(err.code).toBe("ERR_INTERNAL_ERROR");
  });
});
