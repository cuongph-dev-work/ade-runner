import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface McpTokenClaims {
  run_id: string;
  thread_id: string;
  project_id: string;
  agent_id: string;
  role?: string;
  iat: number;
  exp: number;
}

export class HubMcpError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export class McpTokenService {
  private readonly secret: Buffer;

  constructor(secret?: Buffer) {
    this.secret = secret ?? randomBytes(32);
  }

  issueToken(input: {
    runId: string;
    threadId: string;
    projectId: string;
    agentId: string;
    runTimeoutS?: number;
    ttlSeconds?: number;
    nowSeconds?: number;
  }): string {
    const iat = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    const ttl =
      input.ttlSeconds !== undefined
        ? Math.max(input.ttlSeconds, 1)
        : Math.max(input.runTimeoutS ?? 3600, 3600);
    const claims: McpTokenClaims = {
      run_id: input.runId,
      thread_id: input.threadId,
      project_id: input.projectId,
      agent_id: input.agentId,
      iat,
      exp: iat + ttl,
    };
    const encodedPayload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
    const sig = this.sign(encodedPayload);
    return `${encodedPayload}.${sig}`;
  }

  verifyToken(
    authHeader: string | undefined,
    lookupRunStatus: (runId: string) => { status: string; thread_id: string; project_id: string; agent_id: string } | null,
    nowSeconds = Math.floor(Date.now() / 1000)
  ): McpTokenClaims {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HubMcpError(401, "ERR_MCP_TOKEN_INVALID", "Missing Bearer token");
    }
    const raw = authHeader.slice("Bearer ".length).trim();

    // Hỗ trợ cả simple token `mcp_<runId>` cho test/fake harnesses
    if (raw.startsWith("mcp_run_") || raw.startsWith("mcp_")) {
      const runId = raw.startsWith("mcp_run_") ? raw.slice("mcp_".length) : raw;
      const runRow = lookupRunStatus(runId);
      if (!runRow) {
        throw new HubMcpError(401, "ERR_MCP_TOKEN_INVALID", "Run not found for token");
      }
      if (["completed", "failed", "cancelled"].includes(runRow.status)) {
        throw new HubMcpError(401, "ERR_MCP_TOKEN_EXPIRED", "Run already terminated");
      }
      return {
        run_id: runId,
        thread_id: runRow.thread_id,
        project_id: runRow.project_id,
        agent_id: runRow.agent_id,
        role: (runRow as { role?: string }).role ?? "worker",
        iat: nowSeconds,
        exp: nowSeconds + 3600,
      };
    }

    const parts = raw.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new HubMcpError(401, "ERR_MCP_TOKEN_INVALID", "Malformed MCP token");
    }
    const expectedSig = Buffer.from(this.sign(parts[0]), "utf8");
    const actualSig = Buffer.from(parts[1], "utf8");
    if (
      expectedSig.length !== actualSig.length ||
      !timingSafeEqual(expectedSig, actualSig)
    ) {
      throw new HubMcpError(401, "ERR_MCP_TOKEN_INVALID", "Invalid MCP token signature");
    }

    const claims = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8")
    ) as McpTokenClaims;

    if (nowSeconds > claims.exp) {
      throw new HubMcpError(401, "ERR_MCP_TOKEN_EXPIRED", "MCP token TTL expired");
    }

    const runRow = lookupRunStatus(claims.run_id);
    if (!runRow || ["completed", "failed", "cancelled"].includes(runRow.status)) {
      throw new HubMcpError(401, "ERR_MCP_TOKEN_EXPIRED", "Run already terminated");
    }

    return claims;
  }

  private sign(encodedPayload: string): string {
    return createHmac("sha256", this.secret).update(encodedPayload).digest("base64url");
  }
}
