import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type Database from "better-sqlite3";
import { parse as parseYaml } from "yaml";
import {
  AgentYamlSchema,
  extractWorkflowStateNames,
  ProjectYamlSchema,
  WorkflowYamlSchema,
  type AgentSummary,
  type ConfigErrorItem,
  type WorkflowYaml
} from "@ade/shared";

const BUILTIN_FEATURE_WORKFLOW: WorkflowYaml = {
  id: "feature",
  initial: "open",
  states: [
    "open",
    "planning",
    { plan_review: { gate: "plan" } },
    "building",
    { review: { gate: "review" } },
    "done"
  ],
  rules: []
};

export interface SyncAdeConfigResult {
  agents: AgentSummary[];
  configErrors: ConfigErrorItem[];
}

export function deterministicAgentId(projectId: string, handleWithoutAt: string): string {
  return `agt_${projectId}_${handleWithoutAt.toLowerCase()}`;
}

export function readProjectAdeMetadata(repoPath: string): {
  name: string;
  workflowId: string;
  enabledAgentHandles: string[];
} {
  let name = "ADE Project";
  let workflowId = "feature";
  const projectYamlPath = join(repoPath, ".ade", "project.yaml");

  if (existsSync(projectYamlPath)) {
    try {
      const parsed = ProjectYamlSchema.safeParse(parseYaml(readFileSync(projectYamlPath, "utf8")));
      if (parsed.success) {
        name = parsed.data.name;
        workflowId = parsed.data.workflow;
      }
    } catch {
      // Lỗi chi tiết sẽ được ghi vào config_errors_json khi gọi syncProjectAdeConfig
    }
  }

  const enabledAgentHandles: string[] = [];
  const agentsDir = join(repoPath, ".ade", "agents");
  if (existsSync(agentsDir)) {
    const files = readdirSync(agentsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort((a, b) => a.localeCompare(b));
    const seen = new Set<string>();
    for (const fileName of files) {
      try {
        const raw = parseYaml(readFileSync(join(agentsDir, fileName), "utf8"));
        const parsed = AgentYamlSchema.safeParse(raw);
        if (parsed.success && !seen.has(parsed.data.handle)) {
          seen.add(parsed.data.handle);
          if (parsed.data.enabled) {
            enabledAgentHandles.push(parsed.data.handle);
          }
        }
      } catch {
        // Bỏ qua tệp lỗi để giữ fault isolation
      }
    }
  }

  return { name, workflowId, enabledAgentHandles };
}

export function syncProjectAdeConfig(
  sqlite: Database.Database,
  projectId: string
): SyncAdeConfigResult {
  const projectRow = sqlite
    .prepare(`SELECT id, repo_path AS repoPath FROM projects WHERE id = ?`)
    .get(projectId) as { id: string; repoPath: string } | undefined;

  if (!projectRow) {
    return { agents: [], configErrors: [] };
  }

  const repoPath = projectRow.repoPath;
  const configErrors: ConfigErrorItem[] = [];

  const projectYamlRel = ".ade/project.yaml";
  const projectYamlPath = join(repoPath, projectYamlRel);
  if (existsSync(projectYamlPath)) {
    try {
      const raw = parseYaml(readFileSync(projectYamlPath, "utf8"));
      const parsed = ProjectYamlSchema.safeParse(raw);
      if (parsed.success) {
        const d = parsed.data;
        sqlite
          .prepare(
            `UPDATE projects
             SET name = ?, default_branch = ?, default_main_agent = ?,
                 workflow_id = ?, memory_path = ?, use_repo_instructions = ?
             WHERE id = ?`
          )
          .run(
            d.name,
            d.default_branch,
            d.default_main_agent,
            d.workflow,
            d.memory_path,
            d.use_repo_instructions ? 1 : 0,
            projectId
          );
      } else {
        for (const issue of parsed.error.issues) {
          configErrors.push({
            file: projectYamlRel,
            field: issue.path.join(".") || "$root",
            message: issue.message
          });
        }
      }
    } catch (err) {
      configErrors.push({
        file: projectYamlRel,
        field: "$yaml",
        message: err instanceof Error ? err.message : "Cú pháp YAML không hợp lệ."
      });
    }
  }

  const agentsDir = join(repoPath, ".ade", "agents");
  const validHandles = new Set<string>();

  if (existsSync(agentsDir)) {
    const files = readdirSync(agentsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of files) {
      const relFile = `.ade/agents/${fileName}`;
      const absFile = join(agentsDir, fileName);
      let rawYaml: unknown;
      try {
        rawYaml = parseYaml(readFileSync(absFile, "utf8"));
      } catch (err) {
        configErrors.push({
          file: relFile,
          field: "$yaml",
          message: err instanceof Error ? err.message : "Cú pháp YAML không hợp lệ."
        });
        continue;
      }

      const parsed = AgentYamlSchema.safeParse(rawYaml);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          configErrors.push({
            file: relFile,
            field: issue.path.join(".") || "$root",
            message: issue.message
          });
        }
        continue;
      }

      const ag = parsed.data;
      const handleWithAt = `@${ag.handle.toLowerCase()}`;
      if (validHandles.has(handleWithAt)) {
        configErrors.push({
          file: relFile,
          field: "handle",
          message: `Trùng handle ${handleWithAt} giữa hai tệp cấu hình agent.`
        });
        continue;
      }
      validHandles.add(handleWithAt);

      const fileMtimeIso = statSync(absFile).mtime.toISOString();
      const agentId = deterministicAgentId(projectId, ag.handle);

      sqlite
        .prepare(
          `INSERT INTO agents (
             id, project_id, handle, display_name, avatar, role, harness, model,
             credential_profile, mcp_allow_json, write, can_be_main, enabled,
             max_depth, budget_usd, timeout_s, source_file, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(project_id, handle) DO UPDATE SET
             display_name = excluded.display_name,
             avatar = excluded.avatar,
             role = excluded.role,
             harness = excluded.harness,
             model = excluded.model,
             credential_profile = excluded.credential_profile,
             mcp_allow_json = excluded.mcp_allow_json,
             write = excluded.write,
             can_be_main = excluded.can_be_main,
             enabled = excluded.enabled,
             max_depth = excluded.max_depth,
             budget_usd = excluded.budget_usd,
             timeout_s = excluded.timeout_s,
             source_file = excluded.source_file,
             updated_at = excluded.updated_at`
        )
        .run(
          agentId,
          projectId,
          handleWithAt,
          ag.display_name,
          ag.avatar,
          ag.role,
          ag.harness,
          ag.model,
          ag.credential_profile,
          JSON.stringify(ag.mcp_allow),
          ag.write ? 1 : 0,
          ag.can_be_main ? 1 : 0,
          ag.enabled ? 1 : 0,
          ag.max_depth,
          ag.budget_usd,
          ag.timeout_s,
          relFile,
          fileMtimeIso
        );
    }
  }

  const existingAgents = sqlite
    .prepare(`SELECT id, handle FROM agents WHERE project_id = ?`)
    .all(projectId) as Array<{ id: string; handle: string }>;
  for (const row of existingAgents) {
    if (!validHandles.has(row.handle)) {
      sqlite.prepare(`DELETE FROM agents WHERE id = ?`).run(row.id);
    }
  }

  sqlite
    .prepare(`UPDATE projects SET config_errors_json = ? WHERE id = ?`)
    .run(JSON.stringify(configErrors), projectId);

  return {
    agents: listProjectAgentsFromDb(sqlite, projectId),
    configErrors
  };
}

export function listProjectAgentsFromDb(
  sqlite: Database.Database,
  projectId: string
): AgentSummary[] {
  const rows = sqlite
    .prepare(
      `SELECT id, project_id AS projectId, handle, display_name AS displayName,
              avatar, role, harness, model, credential_profile AS credentialProfile,
              mcp_allow_json AS mcpAllowJson, write, can_be_main AS canBeMain,
              enabled, max_depth AS maxDepth, budget_usd AS budgetUsd,
              timeout_s AS timeoutS, source_file AS sourceFile, updated_at AS updatedAt
       FROM agents
       WHERE project_id = ?
       ORDER BY handle ASC`
    )
    .all(projectId) as Array<{
    id: string;
    projectId: string;
    handle: string;
    displayName: string;
    avatar: string | null;
    role: string;
    harness: "claude-code" | "codex";
    model: string;
    credentialProfile: string;
    mcpAllowJson: string;
    write: number;
    canBeMain: number;
    enabled: number;
    maxDepth: number;
    budgetUsd: number | null;
    timeoutS: number;
    sourceFile: string;
    updatedAt: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    handle: r.handle.startsWith("@") ? r.handle : `@${r.handle}`,
    displayName: r.displayName,
    avatar: r.avatar,
    role: r.role,
    harness: r.harness,
    model: r.model,
    credentialProfile: r.credentialProfile,
    mcpAllow: JSON.parse(r.mcpAllowJson) as string[],
    write: r.write === 1,
    canBeMain: r.canBeMain === 1,
    enabled: r.enabled === 1,
    maxDepth: r.maxDepth,
    budgetUsd: r.budgetUsd,
    timeoutS: r.timeoutS,
    sourceFile: r.sourceFile,
    updatedAt: r.updatedAt
  }));
}

export type WorkflowValidationOutcome =
  | { ok: true; initialState: string; workflowId: string }
  | { ok: false; status: 400 | 422; code: "ERR_WORKFLOW_INVALID" | "ERR_INVALID_STATUS" };

export function resolveWorkflowInitialState(
  repoPath: string,
  workflowId: string
): WorkflowValidationOutcome {
  const wfPath = join(repoPath, ".ade", "workflows", `${workflowId}.yaml`);
  let workflow: WorkflowYaml;

  if (!existsSync(wfPath)) {
    if (workflowId === "feature") {
      workflow = BUILTIN_FEATURE_WORKFLOW;
    } else {
      return { ok: false, status: 422, code: "ERR_WORKFLOW_INVALID" };
    }
  } else {
    let raw: unknown;
    try {
      raw = parseYaml(readFileSync(wfPath, "utf8"));
    } catch {
      return { ok: false, status: 422, code: "ERR_WORKFLOW_INVALID" };
    }
    const parsed = WorkflowYamlSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, status: 422, code: "ERR_WORKFLOW_INVALID" };
    }
    workflow = parsed.data;
  }

  const stateNames = extractWorkflowStateNames(workflow);
  if (!stateNames.includes(workflow.initial)) {
    return { ok: false, status: 400, code: "ERR_INVALID_STATUS" };
  }

  return { ok: true, initialState: workflow.initial, workflowId };
}

export function watchProjectAdeDirectory(
  repoPath: string,
  onChanged: () => void
): FSWatcher {
  const adeDir = join(repoPath, ".ade");
  let debounceTimer: NodeJS.Timeout | null = null;

  const trigger = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onChanged();
    }, 150);
  };

  const watcher = chokidar.watch(adeDir, {
    ignoreInitial: true,
    depth: 3
  });

  watcher.on("add", trigger);
  watcher.on("change", trigger);
  watcher.on("unlink", trigger);

  return watcher;
}
