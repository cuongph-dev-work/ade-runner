import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { HarnessType } from "@ade/shared";
import { buildHubApp, type HubServerBundle } from "../../apps/hub/dist/index.js";
import {
  FakeClaudeDriver,
  InProcessRunnerTransport,
  LocalRunnerDaemon,
  WorktreeManager,
} from "../../packages/runner/dist/index.js";

const webDistDir = resolve(import.meta.dirname, "../../apps/web/dist");

export interface StartTestHubOptions {
  scenarioMap?: Record<string, string>;
  workflowYaml?: string;
  agents?: Array<{
    handle: string;
    harness: HarnessType;
    write?: boolean;
    scenario?: string;
  }>;
}

export interface TestHubContext {
  baseUrl: string;
  projectId: string;
  channelId: string;
  threadId: string;
  repoDir: string;
  bundle: HubServerBundle;
  daemon: LocalRunnerDaemon;
  close: () => Promise<void>;
}

export async function startTestHub(options?: StartTestHubOptions): Promise<TestHubContext> {
  process.env.ADE_TEST = "1";
  const sandbox = mkdtempSync(join(tmpdir(), "ade-e2e-hub-"));
  const repoDir = join(sandbox, "repo");

  mkdirSync(join(repoDir, ".ade", "agents"), { recursive: true });
  mkdirSync(join(repoDir, ".ade", "workflows"), { recursive: true });

  execFileSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "dev@local.test"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "ADE Test"], { cwd: repoDir, stdio: "ignore" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    `name: "ADE E2E Test"\ndefault_branch: "main"\nworkflow: "feature"\n`
  );
  const defaultWorkflowContent = `id: "feature"
initial: "open"
states:
  - open
  - planning
  - plan_review
  - building
  - review
  - done
rules:
  - id: "r_outcome"
    on: "run.outcome_reported"
    when:
      status: "done"
    do:
      - set_state: "plan_review"
`;

  writeFileSync(
    join(repoDir, ".ade", "workflows", "feature.yaml"),
    options?.workflowYaml ?? defaultWorkflowContent
  );

  const resolvedScenarioMap: Record<string, string> = { ...(options?.scenarioMap ?? {}) };

  if (options?.agents && options.agents.length > 0) {
    for (const ag of options.agents) {
      const handleClean = ag.handle.startsWith("@") ? ag.handle.slice(1) : ag.handle;
      const cred = ag.harness === "codex" ? "sub-chatgpt" : "sub-claude";
      const isLead = handleClean === "lead";
      writeFileSync(
        join(repoDir, ".ade", "agents", `${handleClean}.yaml`),
        `handle: "@${handleClean}"\ndisplay_name: "${handleClean}"\nrole: "${isLead ? "main" : "worker"}"\ncan_be_main: ${isLead ? "true" : "false"}\nharness: "${ag.harness}"\ncredential_profile: "${cred}"\nwrite: ${ag.write ? "true" : "false"}\n`
      );
      if (ag.scenario) {
        resolvedScenarioMap[`@${handleClean}`] = ag.scenario;
      }
    }
  } else {
    writeFileSync(
      join(repoDir, ".ade", "agents", "fake.yaml"),
      `handle: "@fake"\ndisplay_name: "Fake Agent"\nharness: "claude-code"\ncredential_profile: "sub-claude"\nwrite: true\n`
    );
    writeFileSync(
      join(repoDir, ".ade", "agents", "fake_perm.yaml"),
      `handle: "@fake_perm"\ndisplay_name: "Fake Perm Agent"\nharness: "claude-code"\ncredential_profile: "sub-claude"\nwrite: true\n`
    );
    writeFileSync(
      join(repoDir, ".ade", "agents", "claude_fake.yaml"),
      `handle: "@claude_fake"\ndisplay_name: "Claude Fake"\nharness: "claude-code"\ncredential_profile: "sub-claude"\nwrite: false\n`
    );
    writeFileSync(
      join(repoDir, ".ade", "agents", "codex_fake.yaml"),
      `handle: "@codex_fake"\ndisplay_name: "Codex Fake"\nharness: "codex"\ncredential_profile: "sub-chatgpt"\nwrite: false\n`
    );
  }

  writeFileSync(join(repoDir, "README.md"), "# ADE E2E Test\n");
  execFileSync("git", ["add", "."], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: repoDir, stdio: "ignore" });

  const transport = new InProcessRunnerTransport();
  const worktrees = new WorktreeManager();
  const claudeDriver = new FakeClaudeDriver({ scenarioMap: resolvedScenarioMap });
  const codexDriver = new FakeClaudeDriver({ scenarioMap: resolvedScenarioMap });

  const daemon = new LocalRunnerDaemon({
    runnerId: "rnr_e2e_local",
    mode: "solo",
    transport,
    worktrees,
    claudeDriver,
    codexDriver,
  });

  const bundle = await buildHubApp({
    dbPath: join(sandbox, "ade.db"),
    mode: "solo",
    version: "0.1.0",
    webDistDir,
    defaultRepoPath: repoDir,
    runnerTransport: transport,
  });

  await bundle.app.listen({ host: "127.0.0.1", port: 0 });
  const address = bundle.app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind port");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  bundle.runDispatcher.setMcpUrl(`${baseUrl}/mcp`);

  daemon.connect();

  const project = bundle.hubDb.sqlite
    .prepare("SELECT id FROM projects LIMIT 1")
    .get() as { id: string };
  const channel = bundle.hubDb.sqlite
    .prepare("SELECT id FROM channels WHERE project_id = ? LIMIT 1")
    .get(project.id) as { id: string };

  const threadRes = bundle.chatService.createThread(channel.id, {
    body: "Khởi động kịch bản E2E",
  });

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    projectId: project.id,
    channelId: channel.id,
    threadId: threadRes.thread.id,
    repoDir,
    bundle,
    daemon,
    close: async () => {
      daemon.disconnect();
      await bundle.app.close();
      rmSync(sandbox, { recursive: true, force: true });
    },
  };
}
