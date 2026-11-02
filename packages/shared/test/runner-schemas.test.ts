import { describe, expect, it } from "vitest";
import {
  CancelRunParamsSchema,
  LiveCardPayloadSchema,
  PermissionReplyBodySchema,
  PermissionReplyParamsSchema,
  ProjectRunsParamsSchema,
  RunSchema,
  RunStartMessageSchema,
  RunnerMessageSchema,
  ThreadRunsParamsSchema,
  WsRunnerServerEventSchema
} from "../src/schemas/runner.js";

describe("P2 Runner Schemas & Validation (AC-API-RN-01-09, AC-API-RN-01-19, AC-API-RN-01-23, AC-UI-RN-01-09)", () => {
  it("chấp nhận PermissionReplyBody hợp lệ và tự động trim optionId", () => {
    const parsed = PermissionReplyBodySchema.parse({
      optionId: "  allow  ",
      decision: "allow"
    });
    expect(parsed).toEqual({ optionId: "allow", decision: "allow" });
  });

  it.each([
    { optionId: "", decision: "allow", expectedMsg: "MSG01" },
    { optionId: "   ", decision: "allow", expectedMsg: "MSG01" },
    { optionId: "a".repeat(65), decision: "allow", expectedMsg: "MSG02" },
    { optionId: "allow", decision: "", expectedMsg: "MSG01" },
    { optionId: "allow", decision: "maybe", expectedMsg: "MSG04" }
  ])("từ chối payload sai quy tắc V-01..V-06: %j", ({ optionId, decision, expectedMsg }) => {
    const res = PermissionReplyBodySchema.safeParse({ optionId, decision });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe(expectedMsg);
    }
  });

  it("kiểm tra regex V-07..V-10 cho path params trả MSG04 khi sai định dạng (AC-API-RN-01-19)", () => {
    expect(ThreadRunsParamsSchema.safeParse({ threadId: "sai_dinh_dang" }).success).toBe(false);
    expect(ThreadRunsParamsSchema.safeParse({ threadId: "thr_01" }).success).toBe(true);
    expect(ProjectRunsParamsSchema.safeParse({ projectId: "sai_prj" }).success).toBe(false);
    expect(ProjectRunsParamsSchema.safeParse({ projectId: "prj_01" }).success).toBe(true);
    expect(
      PermissionReplyParamsSchema.safeParse({ runId: "bad_id", requestId: "req_01" }).success
    ).toBe(false);
    expect(CancelRunParamsSchema.safeParse({ runId: "x" }).success).toBe(false);
  });

  it("chấp nhận mcpUrl = null và mcpToken = null trong RunStartMessageSchema cho Phase P2", () => {
    const startMsg = RunStartMessageSchema.parse({
      type: "run.start",
      runId: "run_01",
      projectId: "prj_01",
      threadId: "thr_01",
      repoPath: "/tmp/repo",
      defaultBranch: "main",
      useRepoInstructions: false,
      agent: {
        id: "agt_01",
        handle: "@coder",
        displayName: "Coder",
        role: "Coder",
        harness: "codex",
        model: null,
        credentialProfile: "sub-chatgpt",
        write: true,
        timeoutS: 120
      },
      skills: [],
      prompt: "Kiểm tra",
      context: "",
      mcpUrl: null,
      mcpToken: null,
      resumeSessionId: null
    });
    expect(startMsg.mcpUrl).toBeNull();
  });

  it("kiểm tra cấu trúc đồng nhất của LiveCardPayloadSchema, RunSchema và WsRunnerServerEventSchema", () => {
    const msg = RunnerMessageSchema.parse({
      type: "runner.hello",
      runnerId: "rnr_local",
      machineName: "dev-mac",
      harnessesAvailable: ["claude-code", "codex"],
      version: "0.1.0"
    });
    expect(msg.type).toBe("runner.hello");

    const card = LiveCardPayloadSchema.parse({
      cardType: "live_card",
      runId: "run_01JBCDEF0123456789ABCDEFGH",
      agentId: "agt_01JBCDEF0123456789ABCDEFGH",
      agentHandle: "@coder",
      agentDisplayName: "Coder",
      invokedBy: "usr_local",
      runnerMachineName: "dev-mac",
      status: "running",
      plan: [{ id: "p1", text: "Đọc yêu cầu", status: "completed" }],
      toolCalls: [],
      steps: [],
      lastMessageText: "Đang thực hiện",
      outcome: null,
      stopReason: null,
      errorCode: null,
      costUsd: 0,
      startedAt: "2026-10-31T06:00:00.000Z",
      endedAt: null
    });
    expect(card.status).toBe("running");

    const summary = RunSchema.parse({
      id: "run_01JBCDEF0123456789ABCDEFGH",
      projectId: "prj_01JBCDEF0123456789ABCDEFGH",
      threadId: "thr_01JBCDEF0123456789ABCDEFGH",
      agentId: "agt_01JBCDEF0123456789ABCDEFGH",
      agentHandle: "@coder",
      agentDisplayName: "Coder",
      harness: "codex",
      runnerId: "rnr_local",
      runnerMachineName: "dev-mac",
      invokedBy: "usr_local",
      credentialProfile: "sub-chatgpt",
      acpSessionId: null,
      role: "worker",
      depth: 0,
      timeoutS: 600,
      status: "waiting_permission",
      outcome: null,
      stopReason: null,
      costUsd: 0,
      liveCardMessageId: "msg_01JBCDEF0123456789ABCDEFGH",
      pendingPermissionTool: "Bash",
      startedAt: "2026-10-31T06:00:00.000Z",
      endedAt: null,
      createdAt: "2026-10-31T05:59:59.000Z"
    });
    expect(summary.pendingPermissionTool).toBe("Bash");

    const wsEvt = WsRunnerServerEventSchema.parse({
      type: "run.updated",
      data: {
        eventId: "evt_1",
        seq: 1,
        projectId: summary.projectId,
        channelId: "chn_01JBCDEF0123456789ABCDEFGH",
        threadId: summary.threadId,
        run: summary
      }
    });
    expect(wsEvt.type).toBe("run.updated");
  });
});
