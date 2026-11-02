import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { buildHubApp, resolveMentions, type HubServerBundle } from "../src/index.js";

function createSampleAdeRepo(rootDir: string): string {
  const repoDir = join(rootDir, "sample-repo");
  mkdirSync(join(repoDir, ".ade", "agents"), { recursive: true });
  mkdirSync(join(repoDir, ".ade", "workflows"), { recursive: true });
  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    `name: "ADE Demo"\ndefault_branch: "main"\nworkflow: "feature"\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "planner.yaml"),
    `handle: "planner"\ndisplay_name: "Planner"\nharness: "claude"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "coder.yaml"),
    `handle: "coder"\ndisplay_name: "Coder"\nharness: "codex"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "disabled-bot.yaml"),
    `handle: "disabled-bot"\ndisplay_name: "Disabled Bot"\nharness: "claude"\nenabled: false\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "workflows", "feature.yaml"),
    `id: "feature"\ninitial: "open"\nstates:\n  - open\n  - planning\n  - done\n`
  );
  return repoDir;
}

describe("P1 Chat Service, .ade/ Loader, Mention Parser & /ws", () => {
  const cleanupDirs: string[] = [];
  let bundle: HubServerBundle | null = null;

  afterEach(async () => {
    if (bundle) {
      await bundle.app.close();
      bundle = null;
    }
    for (const d of cleanupDirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("parses @agent, @human, @unknown and ignores code blocks", () => {
    const res = resolveMentions(
      "Chào @planner, `@coder` trong code, @coder thật, đồng nghiệp @owner và @ghost",
      [
        { id: "agt_1", handle: "@planner", enabled: true },
        { id: "agt_2", handle: "@coder", enabled: true },
        { id: "agt_3", handle: "@disabled-bot", enabled: false }
      ],
      [{ id: "usr_local", handle: "@owner" }]
    );

    expect(res.validMentions).toEqual([
      { handle: "@planner", agentId: "agt_1" },
      { handle: "@coder", agentId: "agt_2" }
    ]);
    expect(res.humanMentions).toEqual(["@owner"]);
    expect(res.unknownMentions).toEqual(["@ghost"]);
  });

  it("covers channel CRUD + soft-delete guard, root-message thread creation, reactions and /ws ping/error", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "ade-p1-hub-"));
    cleanupDirs.push(sandbox);
    const repoDir = createSampleAdeRepo(sandbox);

    bundle = await buildHubApp({
      dbPath: join(sandbox, "ade.db"),
      defaultRepoPath: repoDir,
      watchAdeFiles: false
    });
    await bundle.app.listen({ host: "127.0.0.1", port: 0 });
    const addr = bundle.app.server.address();
    if (!addr || typeof addr === "string") throw new Error("No port");
    const port = addr.port;

    const projRes = await bundle.app.inject({
      method: "GET",
      url: "/api/projects",
      headers: { host: "localhost:3000" }
    });
    expect(projRes.statusCode).toBe(200);
    const projectId = projRes.json().projects[0].id as string;
    expect(projRes.json().projects[0].colleagues[0].handle).toBe("@owner");

    const chList = await bundle.app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/channels`,
      headers: { host: "localhost:3000" }
    });
    const generalChannel = chList.json().channels[0] as {
      id: string;
      members: Array<{ memberType: string; memberId: string }>;
    };
    const generalId = generalChannel.id;
    // Khởi tạo #general theo thứ tự 4 bước đã nạp sẵn 2 agent đang bật (@coder, @planner) + usr_local
    expect(generalChannel.members.filter((m) => m.memberType === "agent")).toHaveLength(2);

    // AC-API-CH-01-10: Không được xóa kênh cuối cùng
    const delLast = await bundle.app.inject({
      method: "DELETE",
      url: `/api/channels/${generalId}`,
      headers: { host: "localhost:3000" }
    });
    expect(delLast.statusCode).toBe(409);
    expect(delLast.json().code).toBe("ERR_LAST_CHANNEL_DELETE");

    // Tạo kênh thứ hai, cập nhật thành viên, tạo thread lịch sử rồi xóa mềm
    const createCh = await bundle.app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/channels`,
      headers: { host: "localhost:3000" },
      payload: { name: "frontend-ui", description: "UI" }
    });
    expect(createCh.statusCode).toBe(201);
    const feId = createCh.json().channel.id as string;

    const patchCh = await bundle.app.inject({
      method: "PATCH",
      url: `/api/channels/${feId}`,
      headers: { host: "localhost:3000" },
      payload: { name: "frontend", description: "Kênh UI", memberAgentIds: [] }
    });
    expect(patchCh.statusCode).toBe(200);
    expect(patchCh.json().channel.members).toHaveLength(1);

    // Gửi tin nhắn gốc mở thread trong #general + thả biểu cảm
    const thrRes = await bundle.app.inject({
      method: "POST",
      url: `/api/channels/${generalId}/threads`,
      headers: { host: "localhost:3000" },
      payload: { body: "Nhờ @planner phối hợp @owner xem giúp @ghost" }
    });
    expect(thrRes.statusCode).toBe(201);
    const createdThr = thrRes.json();
    expect(createdThr.validMentions).toEqual(["@planner"]);
    expect(createdThr.humanMentions).toEqual(["@owner"]);
    expect(createdThr.unknownMentions).toEqual(["@ghost"]);
    expect(createdThr.systemMessage.body).toContain("@ghost");

    const reactRes = await bundle.app.inject({
      method: "POST",
      url: `/api/messages/${createdThr.rootMessage.id}/reactions`,
      headers: { host: "localhost:3000" },
      payload: { emoji: "🚀" }
    });
    expect(reactRes.statusCode).toBe(200);
    expect(reactRes.json().reactions[0]).toMatchObject({
      emoji: "🚀",
      count: 1,
      reactedByMe: true
    });

    // Xóa mềm kênh frontend
    const delFe = await bundle.app.inject({
      method: "DELETE",
      url: `/api/channels/${feId}`,
      headers: { host: "localhost:3000" }
    });
    expect(delFe.statusCode).toBe(200);

    const getDeletedThreads = await bundle.app.inject({
      method: "GET",
      url: `/api/channels/${feId}/threads`,
      headers: { host: "localhost:3000" }
    });
    expect(getDeletedThreads.statusCode).toBe(404);

    // AC-API-CH-01-26: Cho phép tạo lại kênh cùng tên "frontend" sau khi kênh cũ đã xóa mềm
    const recreateFe = await bundle.app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/channels`,
      headers: { host: "localhost:3000" },
      payload: { name: "frontend", description: "Tạo lại kênh cùng tên sau xóa mềm" }
    });
    expect(recreateFe.statusCode).toBe(201);
    expect(recreateFe.json().channel.name).toBe("frontend");
    expect(recreateFe.json().channel.id).not.toBe(feId);

    // Kiểm chứng WebSocket /ws chào kết nối, báo ws.error và trả ws.pong
    const frames: Array<{ type: string }> = [];
    await new Promise<void>((resolveWs, rejectWs) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: { Origin: `http://127.0.0.1:${port}` }
      });
      ws.on("message", (buf) => {
        const msg = JSON.parse(String(buf)) as { type: string };
        frames.push(msg);
        if (msg.type === "ws.connected") {
          ws.send(JSON.stringify({ type: "unknown_cmd" }));
        } else if (msg.type === "ws.error") {
          ws.send(JSON.stringify({ type: "ping" }));
        } else if (msg.type === "ws.pong") {
          ws.close();
          resolveWs();
        }
      });
      ws.on("error", rejectWs);
    });
    expect(frames.map((f) => f.type)).toEqual(["ws.connected", "ws.error", "ws.pong"]);
  });

  it("validates workflow YAML errors (422 ERR_WORKFLOW_INVALID & 400 ERR_INVALID_STATUS)", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "ade-p1-wf-"));
    cleanupDirs.push(sandbox);
    const repoDir = createSampleAdeRepo(sandbox);

    bundle = await buildHubApp({
      dbPath: join(sandbox, "ade.db"),
      defaultRepoPath: repoDir,
      watchAdeFiles: false
    });
    const projId = bundle.chatService.listProjects()[0]!.id;
    const generalId = bundle.chatService.listChannels(projId)[0]!.id;

    // Thiếu initial -> 422 ERR_WORKFLOW_INVALID
    writeFileSync(
      join(repoDir, ".ade", "workflows", "feature.yaml"),
      `states:\n  - open\n`
    );
    const res422 = await bundle.app.inject({
      method: "POST",
      url: `/api/channels/${generalId}/threads`,
      headers: { host: "localhost:3000" },
      payload: { body: "Kiểm tra workflow thiếu initial" }
    });
    expect(res422.statusCode).toBe(422);
    expect(res422.json().code).toBe("ERR_WORKFLOW_INVALID");

    // initial không nằm trong states -> 400 ERR_INVALID_STATUS
    writeFileSync(
      join(repoDir, ".ade", "workflows", "feature.yaml"),
      `initial: "ghost_state"\nstates:\n  - open\n  - done\n`
    );
    const res400 = await bundle.app.inject({
      method: "POST",
      url: `/api/channels/${generalId}/threads`,
      headers: { host: "localhost:3000" },
      payload: { body: "Kiểm tra initial bị cấm" }
    });
    expect(res400.statusCode).toBe(400);
    expect(res400.json().code).toBe("ERR_INVALID_STATUS");
  });
});
