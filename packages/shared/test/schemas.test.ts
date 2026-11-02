import { describe, expect, it } from "vitest";
import {
  AgentYamlSchema,
  ApiErrorResponseSchema,
  collectRules,
  CreateChannelInputSchema,
  CreateThreadInputSchema,
  ERROR_CODES,
  EventEnvelopeSchema,
  extractWorkflowStateNames,
  FakeScenarioYamlSchema,
  HealthResponseSchema,
  ProjectYamlSchema,
  resolveMsg,
  ToggleReactionInputSchema,
  validateByCatalog,
  WorkflowYamlSchema,
  WsClientEventSchema
} from "../src/index.js";

describe("@ade/shared schemas & catalogs (P0 + P1)", () => {
  it("parses valid HealthResponseSchema and rejects non-solo mode", () => {
    const valid = HealthResponseSchema.parse({
      status: "ok",
      mode: "solo",
      dbConnected: true,
      eventCount: 0,
      version: "0.1.0"
    });
    expect(valid.mode).toBe("solo");

    const invalid = HealthResponseSchema.safeParse({
      status: "ok",
      mode: "vps",
      dbConnected: true,
      eventCount: -1,
      version: ""
    });
    expect(invalid.success).toBe(false);
  });

  it("parses ApiErrorResponseSchema and resolves ERR_LOCAL_ORIGIN_ONLY & ERR_LAST_CHANNEL_DELETE", () => {
    const err = ApiErrorResponseSchema.parse({
      code: "ERR_LOCAL_ORIGIN_ONLY",
      message: ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.defaultMessage
    });
    expect(err.details).toEqual({});
    expect(ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.http).toBe(403);
    expect(ERROR_CODES.ERR_LAST_CHANNEL_DELETE.http).toBe(409);
  });

  it("validates EventEnvelopeSchema and FakeScenarioYamlSchema", () => {
    const evt = EventEnvelopeSchema.parse({
      id: "evt_01JBCDEFGHJKMNPQRSTVWXYZ",
      type: "agent.mentioned",
      ts: "2026-10-31T06:00:00.000Z",
      project_id: "prj_01",
      thread_id: "thr_01",
      run_id: null,
      actor: { type: "human", id: "usr_local" },
      causation_id: null,
      correlation_id: "thr_01",
      payload: { agent: "@planner", agent_id: "agt_01", message_id: "msg_01", text: "viết spec" }
    });
    expect(evt.type).toBe("agent.mentioned");

    const scenario = FakeScenarioYamlSchema.parse({
      agent: "@planner",
      steps: [
        { plan: ["Đọc yêu cầu", "Viết spec"] },
        { request_permission: { tool: "Bash", command: "npm test", expect: "allow" } },
        { mcp: { tool: "report_outcome", args: { status: "done" } } }
      ]
    });
    expect(scenario.steps).toHaveLength(3);
  });

  it("validates P1 VALIDATION_CATALOG rules V-01..V-29 and Vietnamese messages", () => {
    const createRules = collectRules("chat.channel.create");
    expect(createRules).toHaveLength(7);
    expect(resolveMsg("MSG01", "channelName")).toBe("Tên kênh là bắt buộc.");
    expect(resolveMsg("MSG02", "channelName", { max: 80 })).toBe(
      "Tên kênh không được vượt quá 80 ký tự."
    );

    const badName = validateByCatalog("chat.channel.create", { name: "Bad Name!" });
    expect(badName.ok).toBe(false);
    if (!badName.ok) {
      expect(badName.fieldErrors.name?.[0]?.code).toBe("MSG04");
    }

    const badMembers = validateByCatalog("chat.channel.update", {
      name: "general",
      memberAgentIds: "not-an-array"
    });
    expect(badMembers.ok).toBe(false);
    if (!badMembers.ok) {
      expect(badMembers.fieldErrors.memberAgentIds?.[0]?.code).toBe("MSG04");
    }

    const badEmoji = validateByCatalog("chat.message.react", { emoji: "💩" });
    expect(badEmoji.ok).toBe(false);
  });

  it("parses .ade/ YAML schemas (including claude-code, global: skills, object states) and P1 Chat input schemas", () => {
    const project = ProjectYamlSchema.parse({
      name: "ADE Demo",
      workflow_id: "bugfix",
      default_main_agent: "lead"
    });
    expect(project.workflow).toBe("bugfix");
    expect(project.default_main_agent).toBe("@lead");

    const agent = AgentYamlSchema.parse({
      handle: "@planner",
      harness: "claude-code",
      credential: "sub-claude",
      skills: ["write-spec", "global:shared-review"]
    });
    expect(agent.handle).toBe("planner");
    expect(agent.display_name).toBe("Planner");
    expect(agent.harness).toBe("claude-code");
    expect(agent.credential_profile).toBe("sub-claude");
    expect(agent.skills).toEqual(["write-spec", "global:shared-review"]);

    const wf = WorkflowYamlSchema.parse({
      initial: "open",
      states: ["open", "planning", { plan_review: { gate: "plan" } }, "done"]
    });
    expect(extractWorkflowStateNames(wf)).toEqual(["open", "planning", "plan_review", "done"]);

    const wfObj = WorkflowYamlSchema.parse({
      workflow: "custom",
      initial: "open",
      states: {
        open: {},
        spec_review: { gate: "spec" },
        done: {}
      }
    });
    expect(wfObj.id).toBe("custom");
    expect(extractWorkflowStateNames(wfObj)).toEqual(["open", "spec_review", "done"]);

    expect(CreateChannelInputSchema.parse({ name: " general " }).name).toBe("general");
    expect(CreateThreadInputSchema.parse({ body: "Xin chào @planner" }).body).toBe(
      "Xin chào @planner"
    );
    expect(ToggleReactionInputSchema.parse({ emoji: "🚀" }).emoji).toBe("🚀");
    expect(WsClientEventSchema.parse({ type: "ping" }).type).toBe("ping");
  });
});
