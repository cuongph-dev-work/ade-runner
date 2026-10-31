import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ulid } from "ulid";
import {
  ALLOWED_REACTION_EMOJIS,
  ERROR_CODES,
  validateByCatalog,
  type AgentListResponse,
  type Channel,
  type ChannelMember,
  type ColleagueSummary,
  type ConfigErrorItem,
  type CreateThreadResponse,
  type DeleteChannelResponse,
  type EventEnvelope,
  type ErrorCode,
  type Message,
  type PostMessageResponse,
  type ProjectSummary,
  type ReactionSummary,
  type Thread,
  type ToggleReactionResponse
} from "@ade/shared";
import type { HubDatabase } from "../db/client.js";
import { LOCAL_USER_ID } from "../db/projector.js";
import {
  listProjectAgentsFromDb,
  readProjectAdeMetadata,
  resolveWorkflowInitialState,
  syncProjectAdeConfig
} from "../config/ade-loader.js";
import { resolveMentions } from "./mention-parser.js";
import type { InMemoryEventBus } from "../events/event-bus.js";
import type { GateService } from "../orchestration/gate-service.js";

export class HubDomainError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(ERROR_CODES[code].defaultMessage);
    this.name = "HubDomainError";
  }
}

interface StoredReactionBucket {
  emoji: (typeof ALLOWED_REACTION_EMOJIS)[number];
  userIds: string[];
}

export class ChatService {
  private gateService?: GateService;

  constructor(
    private readonly hubDb: HubDatabase,
    private readonly eventBus: InMemoryEventBus
  ) {}

  setGateService(gateService: GateService): void {
    this.gateService = gateService;
  }

  registerRepoIfMissing(repoPathInput: string): ProjectSummary | null {
    const repoPath = resolve(repoPathInput);
    if (!existsSync(joinOrCheckGit(repoPath))) {
      return null;
    }

    const existing = this.hubDb.sqlite
      .prepare(`SELECT id FROM projects WHERE repo_path = ?`)
      .get(repoPath) as { id: string } | undefined;

    if (existing) {
      syncProjectAdeConfig(this.hubDb.sqlite, existing.id);
      return this.getProjectById(existing.id);
    }

    // Bước 1: Đọc siêu dữ liệu .ade/project.yaml + .ade/agents/*.yaml
    const meta = readProjectAdeMetadata(repoPath);
    const projectId = `prj_${ulid().toLowerCase()}`;
    const generalChannelId = `chn_${ulid().toLowerCase()}`;
    const now = new Date().toISOString();

    // Bước 2: Ghi sự kiện project.registered để khởi tạo projects + project_members ('usr_local')
    this.hubDb.appendAndProject([
      {
        id: `evt_${ulid()}`,
        type: "project.registered",
        ts: now,
        project_id: projectId,
        thread_id: null,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: null,
        payload: {
          project_id: projectId,
          name: meta.name,
          repo_path: repoPath,
          workflow_id: meta.workflowId
        }
      }
    ]);

    // Bước 3: Chạy syncProjectAdeConfig(projectId) để điền bảng bộ nhớ đệm agents
    const synced = syncProjectAdeConfig(this.hubDb.sqlite, projectId);
    const memberAgentIds = synced.agents
      .filter((a) => a.enabled)
      .map((a) => a.id);

    // Bước 4: Ghi sự kiện channel.created (#general) đọc member_agent_ids từ agents (enabled = 1)
    this.hubDb.appendAndProject([
      {
        id: `evt_${ulid()}`,
        type: "channel.created",
        ts: now,
        project_id: projectId,
        thread_id: null,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: null,
        payload: {
          channel_id: generalChannelId,
          project_id: projectId,
          name: "general",
          description: "Thảo luận chung toàn dự án",
          member_user_ids: [LOCAL_USER_ID],
          member_agent_ids: memberAgentIds
        }
      }
    ]);

    return this.getProjectById(projectId);
  }

  syncAllProjectsAdeConfig(): void {
    const rows = this.hubDb.sqlite
      .prepare(`SELECT id FROM projects ORDER BY created_at ASC`)
      .all() as Array<{ id: string }>;
    for (const row of rows) {
      syncProjectAdeConfig(this.hubDb.sqlite, row.id);
    }
  }

  listProjects(): ProjectSummary[] {
    const rows = this.hubDb.sqlite
      .prepare(
        `SELECT id, name, repo_path AS repoPath, default_branch AS defaultBranch,
                default_main_agent AS defaultMainAgent, workflow_id AS workflowId,
                memory_path AS memoryPath, use_repo_instructions AS useRepoInstructions,
                config_errors_json AS configErrorsJson,
                created_at AS createdAt, updated_at AS updatedAt
         FROM projects
         ORDER BY created_at ASC`
      )
      .all() as Array<{
      id: string;
      name: string;
      repoPath: string;
      defaultBranch: string;
      defaultMainAgent: string | null;
      workflowId: string;
      memoryPath: string;
      useRepoInstructions: number;
      configErrorsJson: string;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      repoPath: row.repoPath,
      defaultBranch: row.defaultBranch,
      defaultMainAgent: row.defaultMainAgent,
      workflowId: row.workflowId,
      memoryPath: row.memoryPath,
      useRepoInstructions: row.useRepoInstructions === 1,
      colleagues: this.listProjectColleagues(row.id),
      configErrors: JSON.parse(row.configErrorsJson) as ConfigErrorItem[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  getProjectById(projectId: string): ProjectSummary {
    const found = this.listProjects().find((p) => p.id === projectId);
    if (!found) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    return found;
  }

  listProjectColleagues(projectId: string): ColleagueSummary[] {
    const rows = this.hubDb.sqlite
      .prepare(
        `SELECT u.id AS id, u.handle AS handle, u.name AS name, pm.role AS role
         FROM project_members pm
         INNER JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = ?
         ORDER BY u.handle ASC`
      )
      .all(projectId) as Array<{ id: string; handle: string; name: string; role: string }>;

    return rows.map((r) => ({
      id: r.id,
      handle: r.handle.startsWith("@") ? r.handle : `@${r.handle}`,
      name: r.name,
      role: r.role
    }));
  }

  listAgents(projectId: string): AgentListResponse {
    const project = this.getProjectById(projectId);
    const agents = listProjectAgentsFromDb(this.hubDb.sqlite, projectId);
    return {
      agents,
      configErrors: project.configErrors
    };
  }

  listChannels(projectId: string): Channel[] {
    this.getProjectById(projectId);
    const rows = this.hubDb.sqlite
      .prepare(
        `SELECT id, project_id AS projectId, name, description,
                created_at AS createdAt, updated_at AS updatedAt
         FROM channels
         WHERE project_id = ?
           AND deleted_at IS NULL
           AND name NOT LIKE '__ade_%'
         ORDER BY created_at ASC, rowid ASC`
      )
      .all(projectId) as Array<{
      id: string;
      projectId: string;
      name: string;
      description: string;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((r) => ({
      ...r,
      members: this.listChannelMembers(r.id)
    }));
  }

  private listChannelMembers(channelId: string): ChannelMember[] {
    return this.hubDb.sqlite
      .prepare(
        `SELECT member_type AS memberType, member_id AS memberId, added_at AS addedAt
         FROM channel_members
         WHERE channel_id = ?
         ORDER BY added_at ASC, member_type ASC, member_id ASC`
      )
      .all(channelId) as ChannelMember[];
  }

  private requireActiveChannel(channelId: string): {
    id: string;
    projectId: string;
    name: string;
    description: string;
  } {
    const row = this.hubDb.sqlite
      .prepare(
        `SELECT id, project_id AS projectId, name, description, deleted_at AS deletedAt
         FROM channels
         WHERE id = ?`
      )
      .get(channelId) as
      | {
          id: string;
          projectId: string;
          name: string;
          description: string;
          deletedAt: string | null;
        }
      | undefined;

    if (!row || row.deletedAt !== null || row.name.startsWith("__ade_")) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description
    };
  }

  createChannel(projectId: string, rawBody: Record<string, unknown>): Channel {
    const check = validateByCatalog("chat.channel.create", rawBody);
    if (!check.ok) {
      throw new HubDomainError(422, "ERR_VALIDATION", { fieldErrors: check.fieldErrors });
    }

    this.getProjectById(projectId);
    const name = String(check.normalized.name);
    const description = String(check.normalized.description ?? "");

    const duplicate = this.hubDb.sqlite
      .prepare(
        `SELECT id FROM channels
         WHERE project_id = ? AND name = ? AND deleted_at IS NULL`
      )
      .get(projectId, name) as { id: string } | undefined;

    if (duplicate) {
      throw new HubDomainError(409, "ERR_CHANNEL_NAME_EXISTS");
    }

    const enabledAgents = listProjectAgentsFromDb(this.hubDb.sqlite, projectId).filter(
      (a) => a.enabled
    );
    const channelId = `chn_${ulid().toLowerCase()}`;
    const now = new Date().toISOString();

    const [committed] = this.hubDb.appendAndProject([
      {
        id: `evt_${ulid()}`,
        type: "channel.created",
        ts: now,
        project_id: projectId,
        thread_id: null,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: null,
        payload: {
          channel_id: channelId,
          project_id: projectId,
          name,
          description,
          member_user_ids: [LOCAL_USER_ID],
          member_agent_ids: enabledAgents.map((a) => a.id)
        }
      }
    ]);

    const created = this.listChannels(projectId).find((c) => c.id === channelId)!;
    this.eventBus.publish({
      type: "channel.created",
      data: {
        eventId: committed!.id,
        seq: committed!.seq!,
        projectId,
        channel: created
      }
    });
    return created;
  }

  updateChannel(channelId: string, rawBody: Record<string, unknown>): Channel {
    const check = validateByCatalog("chat.channel.update", rawBody);
    if (!check.ok) {
      throw new HubDomainError(422, "ERR_VALIDATION", { fieldErrors: check.fieldErrors });
    }

    const current = this.requireActiveChannel(channelId);
    const name = String(check.normalized.name);
    const description =
      check.normalized.description !== undefined
        ? String(check.normalized.description)
        : current.description;

    if (name !== current.name) {
      const dup = this.hubDb.sqlite
        .prepare(
          `SELECT id FROM channels
           WHERE project_id = ? AND name = ? AND deleted_at IS NULL AND id != ?`
        )
        .get(current.projectId, name, channelId) as { id: string } | undefined;
      if (dup) {
        throw new HubDomainError(409, "ERR_CHANNEL_NAME_EXISTS");
      }
    }

    const currentMembers = this.listChannelMembers(channelId);
    const validUserIds = new Set(this.listProjectColleagues(current.projectId).map((c) => c.id));
    const validAgentIds = new Set(
      listProjectAgentsFromDb(this.hubDb.sqlite, current.projectId).map((a) => a.id)
    );

    const requestedUsers = Array.isArray(check.normalized.memberUserIds)
      ? (check.normalized.memberUserIds as unknown[]).map(String)
      : currentMembers.filter((m) => m.memberType === "human").map((m) => m.memberId);

    const requestedAgents = Array.isArray(check.normalized.memberAgentIds)
      ? (check.normalized.memberAgentIds as unknown[]).map(String)
      : currentMembers.filter((m) => m.memberType === "agent").map((m) => m.memberId);

    const finalUsers = Array.from(
      new Set([LOCAL_USER_ID, ...requestedUsers.filter((id) => validUserIds.has(id))])
    );
    const finalAgents = Array.from(
      new Set(requestedAgents.filter((id) => validAgentIds.has(id)))
    );

    const now = new Date().toISOString();
    const [committed] = this.hubDb.appendAndProject([
      {
        id: `evt_${ulid()}`,
        type: "channel.updated",
        ts: now,
        project_id: current.projectId,
        thread_id: null,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: null,
        payload: {
          channel_id: channelId,
          project_id: current.projectId,
          name,
          description,
          member_user_ids: finalUsers,
          member_agent_ids: finalAgents
        }
      }
    ]);

    const updated = this.listChannels(current.projectId).find((c) => c.id === channelId)!;
    this.eventBus.publish({
      type: "channel.updated",
      data: {
        eventId: committed!.id,
        seq: committed!.seq!,
        projectId: current.projectId,
        channel: updated
      }
    });
    return updated;
  }

  deleteChannel(channelId: string): DeleteChannelResponse {
    const current = this.requireActiveChannel(channelId);
    const activeChannels = this.listChannels(current.projectId);
    if (activeChannels.length <= 1) {
      throw new HubDomainError(409, "ERR_LAST_CHANNEL_DELETE");
    }

    const now = new Date().toISOString();
    const [committed] = this.hubDb.appendAndProject([
      {
        id: `evt_${ulid()}`,
        type: "channel.deleted",
        ts: now,
        project_id: current.projectId,
        thread_id: null,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: null,
        payload: {
          channel_id: channelId,
          project_id: current.projectId
        }
      }
    ]);

    this.eventBus.publish({
      type: "channel.deleted",
      data: {
        eventId: committed!.id,
        seq: committed!.seq!,
        projectId: current.projectId,
        channelId
      }
    });

    return { deletedChannelId: channelId };
  }

  listThreads(channelId: string): Thread[] {
    this.requireActiveChannel(channelId);
    const rows = this.hubDb.sqlite
      .prepare(
        `SELECT id, project_id AS projectId, channel_id AS channelId,
                root_message_id AS rootMessageId, title, state,
                previous_state AS previousState, workflow_id AS workflowId,
                main_agent_id AS mainAgentId, summary,
                budget_usd AS budgetUsd, spent_usd AS spentUsd,
                engine_halted AS engineHalted, created_by AS createdBy,
                created_at AS createdAt, updated_at AS updatedAt
         FROM threads
         WHERE channel_id = ?
         ORDER BY created_at ASC, rowid ASC`
      )
      .all(channelId) as Array<{
      id: string;
      projectId: string;
      channelId: string;
      rootMessageId: string;
      title: string;
      state: string;
      previousState: string | null;
      workflowId: string;
      mainAgentId: string | null;
      summary: string;
      budgetUsd: number | null;
      spentUsd: number;
      engineHalted: number;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((r) => this.hydrateThread(r));
  }

  private hydrateThread(row: {
    id: string;
    projectId: string;
    channelId: string;
    rootMessageId: string;
    title: string;
    state: string;
    previousState: string | null;
    workflowId: string;
    mainAgentId: string | null;
    summary: string;
    budgetUsd: number | null;
    spentUsd: number;
    engineHalted: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }): Thread {
    const allMessages = this.queryThreadMessagesRaw(row.id);
    const rootMessage = allMessages.find((m) => m.id === row.rootMessageId) ?? allMessages[0]!;
    const conversationalReplies = allMessages.filter(
      (m) => !m.isRoot && m.kind !== "system"
    );
    const participantSet = new Set<string>();
    let pendingQuestionCount = 0;
    let explorerCitationCount = 0;
    for (const msg of allMessages) {
      if (msg.kind !== "system") {
        participantSet.add(msg.authorId);
      }
      if (msg.kind === "question_card" && msg.card && msg.card.status === "pending") {
        pendingQuestionCount += 1;
      }
      if (msg.kind === "explorer_card" && msg.card && Array.isArray(msg.card.citations)) {
        explorerCitationCount = msg.card.citations.length;
      }
    }

    return {
      id: row.id,
      projectId: row.projectId,
      channelId: row.channelId,
      rootMessageId: row.rootMessageId,
      rootMessage,
      title: row.title,
      state: row.state,
      previousState: row.previousState,
      workflowId: row.workflowId,
      mainAgentId: row.mainAgentId,
      summary: row.summary,
      budgetUsd: row.budgetUsd,
      spentUsd: row.spentUsd,
      engineHalted: row.engineHalted === 1,
      replyCount: conversationalReplies.length,
      lastReplyAt:
        conversationalReplies.length > 0
          ? conversationalReplies[conversationalReplies.length - 1]!.createdAt
          : null,
      participantIds: Array.from(participantSet),
      pendingQuestionCount,
      explorerCitationCount,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private getHydratedThreadById(threadId: string): Thread {
    const row = this.hubDb.sqlite
      .prepare(
        `SELECT t.id, t.project_id AS projectId, t.channel_id AS channelId,
                t.root_message_id AS rootMessageId, t.title, t.state,
                t.previous_state AS previousState, t.workflow_id AS workflowId,
                t.main_agent_id AS mainAgentId, t.summary,
                t.budget_usd AS budgetUsd, t.spent_usd AS spentUsd,
                t.engine_halted AS engineHalted, t.created_by AS createdBy,
                t.created_at AS createdAt, t.updated_at AS updatedAt,
                c.deleted_at AS channelDeletedAt
         FROM threads t
         INNER JOIN channels c ON c.id = t.channel_id
         WHERE t.id = ?`
      )
      .get(threadId) as
      | {
          id: string;
          projectId: string;
          channelId: string;
          rootMessageId: string;
          title: string;
          state: string;
          previousState: string | null;
          workflowId: string;
          mainAgentId: string | null;
          summary: string;
          budgetUsd: number | null;
          spentUsd: number;
          engineHalted: number;
          createdBy: string;
          createdAt: string;
          updatedAt: string;
          channelDeletedAt: string | null;
        }
      | undefined;

    if (!row || row.channelDeletedAt !== null) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    return this.hydrateThread(row);
  }

  createThread(channelId: string, rawBody: Record<string, unknown>): CreateThreadResponse {
    const check = validateByCatalog("chat.thread.create", rawBody);
    if (!check.ok) {
      throw new HubDomainError(422, "ERR_VALIDATION", { fieldErrors: check.fieldErrors });
    }

    const channel = this.requireActiveChannel(channelId);
    const project = this.getProjectById(channel.projectId);
    const wfOutcome = resolveWorkflowInitialState(project.repoPath, project.workflowId);
    if (!wfOutcome.ok) {
      throw new HubDomainError(wfOutcome.status, wfOutcome.code);
    }

    const body = String(check.normalized.body);
    const rawTitle =
      typeof check.normalized.title === "string" ? check.normalized.title : "";
    const firstNonEmptyLine =
      body
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? "Thread";
    const title = rawTitle.length > 0 ? rawTitle : firstNonEmptyLine.slice(0, 80);

    const agents = listProjectAgentsFromDb(this.hubDb.sqlite, project.id);
    const colleagues = this.listProjectColleagues(project.id);
    const mentionRes = resolveMentions(body, agents, colleagues);

    const threadId = `thr_${ulid().toLowerCase()}`;
    const rootMessageId = `msg_${ulid().toLowerCase()}`;
    const rootEventId = `evt_${ulid()}`;
    const now = new Date().toISOString();

    const batch: EventEnvelope[] = [
      {
        id: `evt_${ulid()}`,
        type: "thread.created",
        ts: now,
        project_id: project.id,
        thread_id: threadId,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: threadId,
        payload: {
          thread_id: threadId,
          channel_id: channelId,
          title,
          initial_state: wfOutcome.initialState,
          workflow_id: wfOutcome.workflowId,
          root_message_id: rootMessageId
        }
      },
      {
        id: rootEventId,
        type: "message.posted",
        ts: now,
        project_id: project.id,
        thread_id: threadId,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: threadId,
        payload: {
          message_id: rootMessageId,
          kind: "text",
          body,
          is_root: true,
          mentions: mentionRes.validMentions.map((m) => m.handle),
          human_mentions: mentionRes.humanMentions,
          card: null
        }
      }
    ];

    for (const valid of mentionRes.validMentions) {
      batch.push({
        id: `evt_${ulid()}`,
        type: "agent.mentioned",
        ts: now,
        project_id: project.id,
        thread_id: threadId,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: rootEventId,
        correlation_id: threadId,
        payload: {
          agent: valid.handle,
          agent_id: valid.agentId,
          message_id: rootMessageId,
          text: body
        }
      });
    }

    let systemMessageId: string | null = null;
    if (mentionRes.unknownMentions.length > 0) {
      systemMessageId = `msg_${ulid().toLowerCase()}`;
      batch.push({
        id: `evt_${ulid()}`,
        type: "message.posted",
        ts: now,
        project_id: project.id,
        thread_id: threadId,
        run_id: null,
        actor: { type: "system", id: "system" },
        causation_id: rootEventId,
        correlation_id: threadId,
        payload: {
          message_id: systemMessageId,
          kind: "system",
          body: `Agent chưa bật hay không tồn tại: ${mentionRes.unknownMentions.join(", ")}`,
          is_root: false,
          mentions: [],
          human_mentions: [],
          card: {
            type: "unknown_mention_warning",
            handles: mentionRes.unknownMentions
          }
        }
      });
    }

    const committed = this.hubDb.appendAndProject(batch);
    const thread = this.getHydratedThreadById(threadId);
    const allMessages = this.listMessages(threadId);
    const rootMessage = allMessages.find((m) => m.id === rootMessageId)!;
    const systemMessage = systemMessageId
      ? (allMessages.find((m) => m.id === systemMessageId) ?? null)
      : null;

    this.publishCommittedThreadAndMessageFrames(
      committed,
      project.id,
      channelId,
      thread,
      allMessages
    );

    return {
      thread,
      rootMessage,
      systemMessage,
      validMentions: mentionRes.validMentions.map((m) => m.handle),
      humanMentions: mentionRes.humanMentions,
      unknownMentions: mentionRes.unknownMentions
    };
  }

  listMessages(threadId: string): Message[] {
    this.getHydratedThreadById(threadId);
    return this.queryThreadMessagesRaw(threadId);
  }

  private queryThreadMessagesRaw(threadId: string): Message[] {
    const rows = this.hubDb.sqlite
      .prepare(
        `SELECT id, thread_id AS threadId, is_root AS isRoot,
                author_type AS authorType, author_id AS authorId,
                kind, body, mentions_json AS mentionsJson,
                human_mentions_json AS humanMentionsJson,
                reactions_json AS reactionsJson, card_json AS cardJson,
                run_id AS runId, created_at AS createdAt, updated_at AS updatedAt
         FROM messages
         WHERE thread_id = ?
         ORDER BY is_root DESC, created_at ASC, rowid ASC`
      )
      .all(threadId) as Array<{
      id: string;
      threadId: string;
      isRoot: number;
      authorType: Message["authorType"];
      authorId: string;
      kind: Message["kind"];
      body: string;
      mentionsJson: string;
      humanMentionsJson: string;
      reactionsJson: string;
      cardJson: string | null;
      runId: string | null;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      threadId: r.threadId,
      isRoot: r.isRoot === 1,
      authorType: r.authorType,
      authorId: r.authorId,
      kind: r.kind,
      body: r.body,
      mentions: JSON.parse(r.mentionsJson) as string[],
      humanMentions: JSON.parse(r.humanMentionsJson) as string[],
      reactions: this.mapReactions(r.reactionsJson),
      card: r.cardJson ? (JSON.parse(r.cardJson) as Record<string, unknown>) : null,
      runId: r.runId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  private mapReactions(reactionsJson: string): ReactionSummary[] {
    const buckets = JSON.parse(reactionsJson) as StoredReactionBucket[];
    return buckets
      .filter((b) => b.userIds.length > 0 && ALLOWED_REACTION_EMOJIS.includes(b.emoji))
      .map((b) => ({
        emoji: b.emoji,
        count: b.userIds.length,
        userIds: b.userIds,
        reactedByMe: b.userIds.includes(LOCAL_USER_ID)
      }));
  }

  postMessage(threadId: string, rawBody: Record<string, unknown>): PostMessageResponse {
    const check = validateByCatalog("chat.message.create", rawBody);
    if (!check.ok) {
      throw new HubDomainError(422, "ERR_VALIDATION", { fieldErrors: check.fieldErrors });
    }

    const thread = this.getHydratedThreadById(threadId);
    const body = String(check.normalized.body);
    const agents = listProjectAgentsFromDb(this.hubDb.sqlite, thread.projectId);
    const colleagues = this.listProjectColleagues(thread.projectId);
    const mentionRes = resolveMentions(body, agents, colleagues);

    const messageId = `msg_${ulid().toLowerCase()}`;
    const msgEventId = `evt_${ulid()}`;
    const now = new Date().toISOString();

    const batch: EventEnvelope[] = [
      {
        id: msgEventId,
        type: "message.posted",
        ts: now,
        project_id: thread.projectId,
        thread_id: threadId,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: threadId,
        payload: {
          message_id: messageId,
          kind: "text",
          body,
          is_root: false,
          mentions: mentionRes.validMentions.map((m) => m.handle),
          human_mentions: mentionRes.humanMentions,
          card: null
        }
      }
    ];

    for (const valid of mentionRes.validMentions) {
      batch.push({
        id: `evt_${ulid()}`,
        type: "agent.mentioned",
        ts: now,
        project_id: thread.projectId,
        thread_id: threadId,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: msgEventId,
        correlation_id: threadId,
        payload: {
          agent: valid.handle,
          agent_id: valid.agentId,
          message_id: messageId,
          text: body
        }
      });
    }

    let systemMessageId: string | null = null;
    if (mentionRes.unknownMentions.length > 0) {
      systemMessageId = `msg_${ulid().toLowerCase()}`;
      batch.push({
        id: `evt_${ulid()}`,
        type: "message.posted",
        ts: now,
        project_id: thread.projectId,
        thread_id: threadId,
        run_id: null,
        actor: { type: "system", id: "system" },
        causation_id: msgEventId,
        correlation_id: threadId,
        payload: {
          message_id: systemMessageId,
          kind: "system",
          body: `Agent chưa bật hay không tồn tại: ${mentionRes.unknownMentions.join(", ")}`,
          is_root: false,
          mentions: [],
          human_mentions: [],
          card: {
            type: "unknown_mention_warning",
            handles: mentionRes.unknownMentions
          }
        }
      });
    }

    const committed = this.hubDb.appendAndProject(batch);
    const updatedThread = this.getHydratedThreadById(threadId);
    const allMessages = this.listMessages(threadId);
    const message = allMessages.find((m) => m.id === messageId)!;
    const systemMessage = systemMessageId
      ? (allMessages.find((m) => m.id === systemMessageId) ?? null)
      : null;

    this.publishCommittedThreadAndMessageFrames(
      committed,
      thread.projectId,
      thread.channelId,
      updatedThread,
      allMessages
    );

    if (this.gateService && (body.startsWith("/approve") || body.startsWith("/revise") || body.startsWith("/main"))) {
      void this.gateService.handleSlashCommand(threadId, LOCAL_USER_ID, body);
    }

    return {
      message,
      systemMessage,
      validMentions: mentionRes.validMentions.map((m) => m.handle),
      humanMentions: mentionRes.humanMentions,
      unknownMentions: mentionRes.unknownMentions
    };
  }

  toggleReaction(
    messageId: string,
    rawBody: Record<string, unknown>
  ): ToggleReactionResponse {
    const check = validateByCatalog("chat.message.react", rawBody);
    if (!check.ok) {
      throw new HubDomainError(422, "ERR_VALIDATION", { fieldErrors: check.fieldErrors });
    }

    const row = this.hubDb.sqlite
      .prepare(
        `SELECT m.id AS messageId, m.reactions_json AS reactionsJson,
                t.id AS threadId, t.project_id AS projectId, t.channel_id AS channelId,
                c.deleted_at AS channelDeletedAt
         FROM messages m
         INNER JOIN threads t ON t.id = m.thread_id
         INNER JOIN channels c ON c.id = t.channel_id
         WHERE m.id = ?`
      )
      .get(messageId) as
      | {
          messageId: string;
          reactionsJson: string;
          threadId: string;
          projectId: string;
          channelId: string;
          channelDeletedAt: string | null;
        }
      | undefined;

    if (!row || row.channelDeletedAt !== null) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    const emoji = check.normalized.emoji as (typeof ALLOWED_REACTION_EMOJIS)[number];
    const buckets = JSON.parse(row.reactionsJson) as StoredReactionBucket[];
    const alreadyReacted =
      buckets.find((b) => b.emoji === emoji)?.userIds.includes(LOCAL_USER_ID) ?? false;
    const added = !alreadyReacted;
    const now = new Date().toISOString();

    const [committed] = this.hubDb.appendAndProject([
      {
        id: `evt_${ulid()}`,
        type: "message.reaction_toggled",
        ts: now,
        project_id: row.projectId,
        thread_id: row.threadId,
        run_id: null,
        actor: { type: "human", id: LOCAL_USER_ID },
        causation_id: null,
        correlation_id: row.threadId,
        payload: {
          message_id: messageId,
          thread_id: row.threadId,
          channel_id: row.channelId,
          emoji,
          actor_id: LOCAL_USER_ID,
          added
        }
      }
    ]);

    const updatedMsg = this.queryThreadMessagesRaw(row.threadId).find(
      (m) => m.id === messageId
    )!;

    this.eventBus.publish({
      type: "message.reaction_toggled",
      data: {
        eventId: committed!.id,
        seq: committed!.seq!,
        projectId: row.projectId,
        channelId: row.channelId,
        threadId: row.threadId,
        messageId,
        emoji,
        actorId: LOCAL_USER_ID,
        added,
        reactions: updatedMsg.reactions
      }
    });

    return {
      messageId,
      threadId: row.threadId,
      channelId: row.channelId,
      reactions: updatedMsg.reactions
    };
  }

  private publishCommittedThreadAndMessageFrames(
    committed: EventEnvelope[],
    projectId: string,
    channelId: string,
    thread: Thread,
    messages: Message[]
  ): void {
    const byId = new Map(messages.map((m) => [m.id, m]));

    for (const ev of committed) {
      if (ev.type === "thread.created") {
        this.eventBus.publish({
          type: "thread.created",
          data: {
            eventId: ev.id,
            seq: ev.seq!,
            projectId,
            channelId,
            thread
          }
        });
      } else if (ev.type === "message.posted") {
        const msg = byId.get(String(ev.payload.message_id));
        if (msg) {
          this.eventBus.publish({
            type: "message.posted",
            data: {
              eventId: ev.id,
              seq: ev.seq!,
              projectId,
              channelId,
              threadId: thread.id,
              message: msg
            }
          });
        }
      } else if (ev.type === "agent.mentioned") {
        this.eventBus.publish({
          type: "agent.mentioned",
          data: {
            eventId: ev.id,
            seq: ev.seq!,
            projectId,
            threadId: thread.id,
            messageId: String(ev.payload.message_id),
            agent: String(ev.payload.agent),
            agentId: String(ev.payload.agent_id),
            text: String(ev.payload.text)
          }
        });
      }
    }
  }
}

function joinOrCheckGit(repoPath: string): string {
  return resolve(repoPath, ".git");
}
