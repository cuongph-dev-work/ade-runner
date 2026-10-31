import { ulid } from "ulid";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type {
  MemoryFile,
  MemoryFileListResponse,
  MemoryProposal,
  MemoryProposalListResponse,
  MemoryProposalStatus,
  McpProposeMemoryOutput
} from "@ade/shared";
import type { InMemoryEventBus } from "../events/event-bus.js";
import { HubDomainError } from "../chat/chat-service.js";

export class MemoryService {
  constructor(
    private deps: {
      sqlite: Database.Database;
      eventBus: InMemoryEventBus;
      appendEvent: (env: any) => any;
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

  private getMemoryDir(repoPath: string): string {
    return join(repoPath, ".ade", "memory");
  }

  public listMemoryFiles(projectId: string): MemoryFileListResponse {
    const repoPath = this.getRepoPath(projectId);
    const memDir = this.getMemoryDir(repoPath);

    if (!existsSync(memDir)) {
      return { files: [] };
    }

    const entries = readdirSync(memDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, "en"));

    const files: MemoryFile[] = [];
    for (const name of entries) {
      const fullPath = join(memDir, name);
      const stat = statSync(fullPath);
      const content = readFileSync(fullPath, "utf8");
      files.push({
        fileName: name,
        content,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    }

    return { files };
  }

  public getMemoryFile(projectId: string, fileName: string): MemoryFile {
    const repoPath = this.getRepoPath(projectId);
    const fullPath = join(this.getMemoryDir(repoPath), fileName);
    if (!existsSync(fullPath)) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }
    const stat = statSync(fullPath);
    return {
      fileName,
      content: readFileSync(fullPath, "utf8"),
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString()
    };
  }

  public putMemoryFile(projectId: string, fileName: string, content: string): MemoryFile {
    const repoPath = this.getRepoPath(projectId);
    const memDir = this.getMemoryDir(repoPath);
    mkdirSync(memDir, { recursive: true });

    const fullPath = join(memDir, fileName);
    writeFileSync(fullPath, content, "utf8");

    // Đồng bộ sang worktrees nếu có
    const wtDir = join(repoPath, ".ade", "wt");
    if (existsSync(wtDir)) {
      const wtEntries = readdirSync(wtDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const wt of wtEntries) {
        const wtMemDir = join(wtDir, wt.name, ".ade", "memory");
        if (existsSync(wtMemDir)) {
          writeFileSync(join(wtMemDir, fileName), content, "utf8");
        }
      }
    }

    const stat = statSync(fullPath);
    const file: MemoryFile = {
      fileName,
      content,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString()
    };

    // Publish WebSocket sync
    this.deps.eventBus.publish({
      type: "project.config_updated",
      projectId,
      data: { projectId }
    } as any);

    return file;
  }

  public proposeMemory(params: {
    projectId: string;
    threadId: string;
    runId: string;
    agentId: string;
    target_file: string;
    content: string;
    reason: string;
  }): McpProposeMemoryOutput {
    const repoPath = this.getRepoPath(params.projectId);
    const filePath = join(this.getMemoryDir(repoPath), params.target_file);
    const currentContent = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";

    const agent = this.deps.sqlite
      .prepare("SELECT handle FROM agents WHERE id = ?")
      .get(params.agentId) as { handle: string } | undefined;
    const agentHandle = agent?.handle ?? "@agent";

    const proposalId = `mpr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const msgId = `msg_mpr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    const cardPayload = {
      cardType: "memory_proposal",
      proposalId,
      agentHandle,
      targetFile: params.target_file,
      currentContent,
      content: params.content,
      reason: params.reason,
      status: "pending" as MemoryProposalStatus
    };

    // Events
    this.deps.appendEvent({
      id: `evt_${ulid()}`,
      seq: 0,
      type: "memory.proposed",
      project_id: params.projectId,
      thread_id: params.threadId,
      run_id: params.runId,
      actor: { type: "agent", id: params.agentId },
      payload: {
        proposal_id: proposalId,
        project_id: params.projectId,
        thread_id: params.threadId,
        run_id: params.runId,
        agent_id: params.agentId,
        target_file: params.target_file,
        content: params.content,
        reason: params.reason
      },
      ts: nowIso
    });

    this.deps.appendEvent({
      id: `evt_${ulid()}`,
      seq: 0,
      type: "message.posted",
      project_id: params.projectId,
      thread_id: params.threadId,
      run_id: params.runId,
      actor: { type: "agent", id: params.agentId },
      payload: {
        message_id: msgId,
        thread_id: params.threadId,
        is_root: false,
        author_type: "agent",
        author_id: params.agentId,
        kind: "approval_card",
        body: `Đề xuất ghi nhớ vào .ade/memory/${params.target_file}: ${params.reason}`,
        mentions: [],
        human_mentions: [],
        card: cardPayload
      },
      ts: nowIso
    });

    // WebSocket
    this.deps.eventBus.publish({
      type: "memory.proposed",
      projectId: params.projectId,
      threadId: params.threadId,
      data: {
        proposal_id: proposalId,
        target_file: params.target_file,
        reason: params.reason
      }
    } as any);

    this.deps.eventBus.publish({
      type: "message.posted",
      projectId: params.projectId,
      threadId: params.threadId,
      data: {
        message_id: msgId,
        thread_id: params.threadId,
        is_root: false,
        kind: "approval_card",
        card: cardPayload
      }
    } as any);

    return {
      ok: true,
      proposal_id: proposalId,
      message_id: msgId,
      status: "pending"
    };
  }

  public listMemoryProposals(projectId: string, status?: string): MemoryProposalListResponse {
    const repoPath = this.getRepoPath(projectId);
    const memDir = this.getMemoryDir(repoPath);

    let query = `
      SELECT mp.*, a.handle AS agent_handle
      FROM memory_proposals mp
      JOIN agents a ON mp.agent_id = a.id
      JOIN threads t ON mp.thread_id = t.id
      JOIN channels c ON t.channel_id = c.id
      WHERE mp.project_id = ? AND c.deleted_at IS NULL
    `;
    const params: unknown[] = [projectId];

    if (status) {
      query += ` AND mp.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY mp.created_at DESC`;

    const rows = this.deps.sqlite.prepare(query).all(...params) as Array<{
      id: string;
      project_id: string;
      thread_id: string;
      run_id: string;
      agent_id: string;
      agent_handle: string;
      scope: string;
      target_file: string;
      content: string;
      reason: string;
      status: MemoryProposalStatus;
      decided_by: string | null;
      decided_at: string | null;
      created_at: string;
    }>;

    const proposals: MemoryProposal[] = rows.map((r) => {
      const targetPath = join(memDir, r.target_file);
      const currentContent = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
      return {
        id: r.id,
        projectId: r.project_id,
        threadId: r.thread_id,
        runId: r.run_id,
        agentId: r.agent_id,
        agentHandle: r.agent_handle,
        scope: r.scope,
        targetFile: r.target_file,
        currentContent,
        content: r.content,
        reason: r.reason,
        status: r.status,
        decidedBy: r.decided_by,
        decidedAt: r.decided_at,
        createdAt: r.created_at
      };
    });

    return { proposals };
  }

  public decideMemoryProposal(proposalId: string, decision: "approve" | "reject"): MemoryProposal {
    const row = this.deps.sqlite
      .prepare(
        `SELECT mp.*, a.handle AS agent_handle, p.repo_path, c.deleted_at AS channel_deleted_at
         FROM memory_proposals mp
         JOIN agents a ON mp.agent_id = a.id
         JOIN projects p ON mp.project_id = p.id
         JOIN threads t ON mp.thread_id = t.id
         JOIN channels c ON t.channel_id = c.id
         WHERE mp.id = ?`
      )
      .get(proposalId) as
      | {
          id: string;
          project_id: string;
          thread_id: string;
          run_id: string;
          agent_id: string;
          agent_handle: string;
          scope: string;
          target_file: string;
          content: string;
          reason: string;
          status: string;
          repo_path: string;
          channel_deleted_at: string | null;
        }
      | undefined;

    if (!row || row.channel_deleted_at !== null) {
      throw new HubDomainError(404, "ERR_NOT_FOUND");
    }

    if (row.status !== "pending") {
      throw new HubDomainError(409, "ERR_MEMORY_PROPOSAL_DECIDED");
    }

    const memDir = this.getMemoryDir(row.repo_path);
    const targetPath = join(memDir, row.target_file);
    const currentContent = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";

    const newStatus: MemoryProposalStatus = decision === "approve" ? "approved" : "rejected";
    const nowIso = new Date().toISOString();
    const actorId = "usr_local";

    if (decision === "approve") {
      mkdirSync(memDir, { recursive: true });
      writeFileSync(targetPath, row.content, "utf8");

      // Đồng bộ sang worktrees
      const wtDir = join(row.repo_path, ".ade", "wt");
      if (existsSync(wtDir)) {
        const wtEntries = readdirSync(wtDir, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const wt of wtEntries) {
          const wtMemDir = join(wtDir, wt.name, ".ade", "memory");
          if (existsSync(wtMemDir)) {
            writeFileSync(join(wtMemDir, row.target_file), row.content, "utf8");
          }
        }
      }
    }

    // Append event
    this.deps.appendEvent({
      id: `evt_${ulid()}`,
      seq: 0,
      type: "memory.resolved",
      project_id: row.project_id,
      thread_id: row.thread_id,
      run_id: row.run_id,
      actor: { type: "human", id: actorId },
      payload: {
        proposal_id: proposalId,
        decision,
        target_file: row.target_file,
        content: row.content
      },
      ts: nowIso
    });

    // WebSocket
    this.deps.eventBus.publish({
      type: "memory.resolved",
      projectId: row.project_id,
      threadId: row.thread_id,
      data: {
        proposal_id: proposalId,
        decision,
        status: newStatus
      }
    } as any);

    const updatedMsg = this.deps.sqlite
      .prepare(
        `SELECT m.id, m.thread_id, m.is_root, m.author_type, m.author_id, m.kind, m.body,
                m.mentions_json, m.human_mentions_json, m.reactions_json, m.card_json, m.run_id,
                m.created_at, m.updated_at, t.channel_id
         FROM messages m
         INNER JOIN threads t ON t.id = m.thread_id
         WHERE m.card_json LIKE ?
         ORDER BY m.created_at DESC LIMIT 1`
      )
      .get(`%"proposalId":"${proposalId}"%`) as any;
    if (updatedMsg) {
      this.deps.eventBus.publish({
        type: "message.updated",
        projectId: row.project_id,
        threadId: row.thread_id,
        data: {
          seq: 0,
          projectId: row.project_id,
          channelId: updatedMsg.channel_id ?? "",
          threadId: row.thread_id,
          message: {
            id: updatedMsg.id,
            threadId: updatedMsg.thread_id,
            isRoot: Boolean(updatedMsg.is_root),
            authorType: updatedMsg.author_type,
            authorId: updatedMsg.author_id,
            kind: updatedMsg.kind,
            body: updatedMsg.body,
            mentions: JSON.parse(updatedMsg.mentions_json || "[]"),
            humanMentions: JSON.parse(updatedMsg.human_mentions_json || "[]"),
            reactions: [],
            card: updatedMsg.card_json ? JSON.parse(updatedMsg.card_json) : null,
            runId: updatedMsg.run_id,
            createdAt: updatedMsg.created_at,
            updatedAt: updatedMsg.updated_at,
          },
        },
      } as any);
    }

    return {
      id: proposalId,
      projectId: row.project_id,
      threadId: row.thread_id,
      runId: row.run_id,
      agentId: row.agent_id,
      agentHandle: row.agent_handle,
      scope: row.scope,
      targetFile: row.target_file,
      currentContent,
      content: row.content,
      reason: row.reason,
      status: newStatus,
      decidedBy: actorId,
      decidedAt: nowIso,
      createdAt: nowIso
    };
  }
}
