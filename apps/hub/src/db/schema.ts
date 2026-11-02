import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull()
});

export const projectsTable = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull().unique(),
  defaultBranch: text("default_branch").notNull(),
  defaultMainAgent: text("default_main_agent"),
  workflowId: text("workflow_id").notNull(),
  memoryPath: text("memory_path").notNull(),
  useRepoInstructions: integer("use_repo_instructions").notNull(),
  configErrorsJson: text("config_errors_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const projectMembersTable = sqliteTable(
  "project_members",
  {
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.userId] })
  })
);

export const channelsTable = sqliteTable("channels", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const channelMembersTable = sqliteTable(
  "channel_members",
  {
    channelId: text("channel_id").notNull(),
    memberType: text("member_type").notNull(),
    memberId: text("member_id").notNull(),
    addedAt: text("added_at").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.channelId, t.memberType, t.memberId] })
  })
);

export const threadsTable = sqliteTable("threads", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  channelId: text("channel_id").notNull(),
  rootMessageId: text("root_message_id").notNull(),
  title: text("title").notNull(),
  state: text("state").notNull(),
  previousState: text("previous_state"),
  workflowId: text("workflow_id").notNull(),
  mainAgentId: text("main_agent_id"),
  summary: text("summary").notNull(),
  budgetUsd: real("budget_usd"),
  spentUsd: real("spent_usd").notNull(),
  engineHalted: integer("engine_halted").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const messagesTable = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  isRoot: integer("is_root").notNull(),
  authorType: text("author_type").notNull(),
  authorId: text("author_id").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  mentionsJson: text("mentions_json").notNull(),
  humanMentionsJson: text("human_mentions_json").notNull(),
  reactionsJson: text("reactions_json").notNull(),
  cardJson: text("card_json"),
  runId: text("run_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const agentsTable = sqliteTable("agents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  role: text("role").notNull(),
  harness: text("harness").notNull(),
  model: text("model").notNull(),
  credentialProfile: text("credential_profile").notNull(),
  mcpAllowJson: text("mcp_allow_json").notNull(),
  write: integer("write").notNull(),
  canBeMain: integer("can_be_main").notNull(),
  enabled: integer("enabled").notNull(),
  maxDepth: integer("max_depth").notNull(),
  budgetUsd: real("budget_usd"),
  timeoutS: integer("timeout_s").notNull(),
  sourceFile: text("source_file").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const skillsTable = sqliteTable("skills", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  name: text("name").notNull(),
  scope: text("scope").notNull(),
  path: text("path").notNull(),
  description: text("description").notNull(),
  hasShellScript: integer("has_shell_script").notNull().default(0),
  contentHash: text("content_hash").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const agentSkillsTable = sqliteTable(
  "agent_skills",
  {
    agentId: text("agent_id").notNull(),
    skillId: text("skill_id").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agentId, t.skillId] })
  })
);

export const memoryProposalsTable = sqliteTable("memory_proposals", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  threadId: text("thread_id").notNull(),
  runId: text("run_id").notNull(),
  agentId: text("agent_id").notNull(),
  scope: text("scope").notNull().default("project"),
  targetFile: text("target_file").notNull(),
  content: text("content").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: text("decided_at"),
  createdAt: text("created_at").notNull()
});

export const eventsTable = sqliteTable("events", {
  id: text("id").primaryKey(),
  seq: integer("seq").notNull().unique(),
  type: text("type").notNull(),
  projectId: text("project_id"),
  threadId: text("thread_id"),
  runId: text("run_id"),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  payload: text("payload").notNull(),
  causationId: text("causation_id"),
  correlationId: text("correlation_id"),
  ts: text("ts").notNull()
});

export const runnersTable = sqliteTable("runners", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  machineName: text("machine_name").notNull(),
  harnessesAvailableJson: text("harnesses_available_json").notNull(),
  status: text("status").notNull(),
  lastSeen: text("last_seen").notNull()
});

export const runsTable = sqliteTable("runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  threadId: text("thread_id").notNull(),
  agentId: text("agent_id").notNull(),
  invokedBy: text("invoked_by").notNull(),
  runnerId: text("runner_id"),
  credentialProfile: text("credential_profile").notNull(),
  acpSessionId: text("acp_session_id"),
  role: text("role").notNull(),
  task: text("task"),
  delegationId: text("delegation_id"),
  parentRunId: text("parent_run_id"),
  depth: integer("depth").notNull().default(0),
  timeoutS: integer("timeout_s").notNull().default(600),
  status: text("status").notNull(),
  outcome: text("outcome"),
  stopReason: text("stop_reason"),
  summary: text("summary"),
  decisionsJson: text("decisions_json"),
  skillsSnapshotJson: text("skills_snapshot_json").notNull().default("[]"),
  costUsd: real("cost_usd").notNull().default(0),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  createdAt: text("created_at").notNull()
});

export const runLogsTable = sqliteTable("run_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),
  seq: integer("seq").notNull(),
  kind: text("kind").notNull(),
  dataJson: text("data_json").notNull(),
  ts: text("ts").notNull()
});

export const threadAgentsTable = sqliteTable("thread_agents", {
  threadId: text("thread_id").notNull(),
  agentId: text("agent_id").notNull(),
  role: text("role").notNull(),
  scope: text("scope").notNull(),
  grantedBy: text("granted_by").notNull(),
  grantedAt: text("granted_at").notNull(),
  revokedAt: text("revoked_at")
});

export const approvalsTable = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  runId: text("run_id").notNull(),
  gate: text("gate").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("pending"),
  targetState: text("target_state").notNull(),
  summary: text("summary").notNull(),
  decidedBy: text("decided_by"),
  decidedAt: text("decided_at"),
  feedback: text("feedback"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const agentScratchpadsTable = sqliteTable(
  "agent_scratchpads",
  {
    threadId: text("thread_id").notNull(),
    agentId: text("agent_id").notNull(),
    content: text("content").notNull().default(""),
    updatedAt: text("updated_at").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.threadId, t.agentId] })
  })
);
