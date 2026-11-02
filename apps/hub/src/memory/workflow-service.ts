import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type Database from "better-sqlite3";
import {
  WorkflowYamlSchema,
  type WorkflowDetailResponse,
  type WorkflowParseError
} from "@ade/shared";
import type { InMemoryEventBus } from "../events/event-bus.js";
import { HubDomainError } from "../chat/chat-service.js";

export class WorkflowService {
  constructor(
    private deps: {
      sqlite: Database.Database;
      eventBus: InMemoryEventBus;
    }
  ) {}

  private getRepoPath(projectId: string): string {
    const row = this.deps.sqlite
      .prepare("SELECT repo_path FROM projects WHERE id = ?")
      .get(projectId) as { repo_path: string } | undefined;
    if (!row) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    return row.repo_path;
  }

  public getWorkflowDetail(projectId: string, workflowId: string): WorkflowDetailResponse {
    const repoPath = this.getRepoPath(projectId);
    const wfDir = join(repoPath, ".ade", "workflows");
    const filePath = join(wfDir, `${workflowId}.yaml`);

    if (!existsSync(filePath)) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    const workflowYaml = readFileSync(filePath, "utf8");

    // Scan availableWorkflows
    let availableWorkflows: string[] = [];
    if (existsSync(wfDir)) {
      availableWorkflows = readdirSync(wfDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".yaml"))
        .map((e) => e.name.replace(/\.yaml$/, ""))
        .sort((a, b) => a.localeCompare(b, "en"));
    }

    // Scan availableAgents
    const agentRows = this.deps.sqlite
      .prepare("SELECT handle FROM agents WHERE project_id = ? AND enabled = 1")
      .all(projectId) as Array<{ handle: string }>;
    const availableAgents = agentRows.map((a) => (a.handle.startsWith("@") ? a.handle : `@${a.handle}`));

    // Parse YAML dung thứ lỗi
    let parsed = null;
    let parseError: WorkflowParseError | null = null;

    try {
      const rawObj = parseYaml(workflowYaml);
      const res = WorkflowYamlSchema.safeParse(rawObj);
      if (res.success) {
        parsed = res.data;
      } else {
        parseError = {
          code: "MSG04",
          message: "Cấu trúc Workflow không hợp lệ theo lược đồ Zod.",
          issues: res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
        };
      }
    } catch (err: any) {
      parseError = {
        code: "MSG07",
        message: err.message || "Nội dung Workflow YAML không đúng cú pháp YAML.",
        line: err.linePos?.[0]?.line
      };
    }

    return {
      workflowId,
      workflowYaml,
      parsed,
      parseError,
      availableWorkflows,
      availableAgents
    };
  }

  public putWorkflowYaml(
    projectId: string,
    workflowId: string,
    workflowYaml: string
  ): WorkflowDetailResponse {
    const repoPath = this.getRepoPath(projectId);
    const wfDir = join(repoPath, ".ade", "workflows");
    mkdirSync(wfDir, { recursive: true });

    // 1. Kiểm tra cú pháp YAML
    let rawObj: any;
    try {
      rawObj = parseYaml(workflowYaml);
    } catch (err: any) {
      const line = err.linePos?.[0]?.line;
      throw new HubDomainError(422, "ERR_VALIDATION", {
        fieldErrors: {
          workflowYaml: [{ code: "MSG07", message: "Nội dung Workflow YAML không đúng cú pháp YAML." }]
        },
        line
      });
    }

    // 2. Validate theo WorkflowYamlSchema
    const parseRes = WorkflowYamlSchema.safeParse(rawObj);
    if (!parseRes.success) {
      throw new HubDomainError(422, "ERR_WORKFLOW_INVALID", {
        issues: parseRes.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      });
    }

    const wf = parseRes.data;
    const issues: string[] = [];

    // Kiểm tra cấu trúc nghiệp vụ
    const stateNames = Object.keys(wf.states);
    if (stateNames.length === 0) {
      issues.push("Workflow phải có ít nhất 1 trạng thái (states).");
    }

    if (!stateNames.includes(wf.initial)) {
      issues.push(`Trạng thái ban đầu '${wf.initial}' không tồn tại trong danh sách states.`);
    }

    for (const [sName, sDef] of Object.entries(wf.states)) {
      if (sDef.gate && !["plan", "spec", "review"].includes(sDef.gate)) {
        issues.push(`Trạng thái '${sName}' có cổng duyệt '${sDef.gate}' không hợp lệ (phải là plan, spec hoặc review).`);
      }
    }

    // Kiểm tra rules
    for (const rawRule of wf.rules || []) {
      const r = rawRule as Record<string, any>;
      const whenObj = (r.when && typeof r.when === "object") ? r.when : {};
      if (whenObj.state && typeof whenObj.state === "string" && !stateNames.includes(whenObj.state)) {
        issues.push(`Rule on '${r.on ?? ""}' tham chiếu state '${whenObj.state}' không tồn tại.`);
      }
      if (whenObj.to && typeof whenObj.to === "string" && !stateNames.includes(whenObj.to)) {
        issues.push(`Rule on '${r.on ?? ""}' tham chiếu state đích '${whenObj.to}' không tồn tại.`);
      }
      const doList = Array.isArray(r.do) ? r.do : [];
      for (const act of doList) {
        if (typeof act === "object" && act !== null && "set_state" in act) {
          const target = typeof act.set_state === "string" ? act.set_state : act.set_state?.to;
          if (target && !stateNames.includes(target)) {
            issues.push(`Hành động set_state '${target}' không tồn tại.`);
          }
        }
      }
    }

    if (issues.length > 0) {
      throw new HubDomainError(422, "ERR_WORKFLOW_INVALID", { issues });
    }

    // 3. Ghi tệp
    const filePath = join(wfDir, `${workflowId}.yaml`);
    writeFileSync(filePath, workflowYaml, "utf8");

    // Phát WebSocket
    this.deps.eventBus.publish({
      type: "project.config_updated",
      projectId,
      data: { projectId }
    } as any);

    return this.getWorkflowDetail(projectId, workflowId);
  }
}
