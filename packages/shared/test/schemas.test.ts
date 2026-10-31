import { describe, expect, it } from "vitest";
import {
  ApiErrorResponseSchema,
  collectRules,
  ERROR_CODES,
  EventEnvelopeSchema,
  FakeScenarioYamlSchema,
  HealthResponseSchema,
  resolveMsg
} from "../src/index.js";

describe("@ade/shared schemas & catalogs", () => {
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

  it("parses ApiErrorResponseSchema and resolves ERR_LOCAL_ORIGIN_ONLY", () => {
    const err = ApiErrorResponseSchema.parse({
      code: "ERR_LOCAL_ORIGIN_ONLY",
      message: ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.defaultMessage
    });
    expect(err.details).toEqual({});
    expect(ERROR_CODES.ERR_LOCAL_ORIGIN_ONLY.http).toBe(403);
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
      payload: { agent: "@planner", text: "viết spec" }
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

  it("resolves Vietnamese validation messages from VALIDATION_CATALOG", () => {
    const rules = collectRules("chat.channel.create");
    expect(rules).toHaveLength(3);
    expect(resolveMsg("MSG01", "channelName")).toBe("Tên kênh là bắt buộc.");
    expect(resolveMsg("MSG02", "channelName", { max: 80 })).toBe(
      "Tên kênh không được vượt quá 80 ký tự."
    );
  });
});
