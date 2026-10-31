import type Database from "better-sqlite3";
import type { ThreadAgentGrant } from "@ade/shared";

export class GrantService {
  constructor(private readonly sqlite: Database.Database) {}

  hasActiveGrant(threadId: string, agentId: string): boolean {
    const row = this.sqlite
      .prepare(
        `SELECT 1 FROM thread_agents
         WHERE thread_id = ? AND agent_id = ? AND revoked_at IS NULL`
      )
      .get(threadId, agentId);
    return Boolean(row);
  }

  grantAgent(params: {
    threadId: string;
    agentId: string;
    role?: "main" | "worker";
    scope?: "brief" | "full";
    grantedBy: string;
  }): void {
    const now = new Date().toISOString();
    this.sqlite
      .prepare(
        `INSERT INTO thread_agents (thread_id, agent_id, role, scope, granted_by, granted_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(thread_id, agent_id) DO UPDATE SET
           role = excluded.role,
           scope = excluded.scope,
           granted_by = excluded.granted_by,
           granted_at = excluded.granted_at,
           revoked_at = NULL`
      )
      .run(
        params.threadId,
        params.agentId,
        params.role ?? "worker",
        params.scope ?? "full",
        params.grantedBy,
        now
      );
  }

  revokeAgent(threadId: string, agentId: string): void {
    const now = new Date().toISOString();
    this.sqlite
      .prepare(
        `UPDATE thread_agents SET revoked_at = ?
         WHERE thread_id = ? AND agent_id = ? AND revoked_at IS NULL`
      )
      .run(now, threadId, agentId);
  }

  listGrants(threadId: string): ThreadAgentGrant[] {
    const rows = this.sqlite
      .prepare(
        `SELECT ta.agent_id, ta.role, ta.scope, ta.granted_by, ta.granted_at,
                a.handle, a.display_name
         FROM thread_agents ta
         INNER JOIN agents a ON a.id = ta.agent_id
         WHERE ta.thread_id = ? AND ta.revoked_at IS NULL
         ORDER BY ta.granted_at ASC`
      )
      .all(threadId) as Array<{
      agent_id: string;
      role: "main" | "worker";
      scope: "brief" | "full";
      granted_by: string;
      granted_at: string;
      handle: string;
      display_name: string;
    }>;

    return rows.map((r) => ({
      agent_id: r.agent_id,
      handle: r.handle,
      display_name: r.display_name,
      role: r.role,
      scope: r.scope,
      granted_by: r.granted_by,
      granted_at: r.granted_at,
    }));
  }
}
