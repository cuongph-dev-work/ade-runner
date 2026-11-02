export type LegacyRunEvent =
  | { kind: "plan"; entries: string[] }
  | { kind: "tool_call"; name: string; path?: string; args?: Record<string, unknown> }
  | { kind: "message_chunk"; text: string }
  | { kind: "mcp_call"; tool: string; args: Record<string, unknown> };

export interface PermissionOption {
  optionId: "allow" | "deny";
  name: string;
}

export interface PermissionRequestPayload {
  requestId: string;
  tool: string;
  command?: string;
  args?: Record<string, unknown>;
  options: PermissionOption[];
}

export interface DriverRunCallbacks {
  onEvent: (event: LegacyRunEvent) => void | Promise<void>;
  onPermissionRequest: (req: PermissionRequestPayload) => Promise<"allow" | "deny">;
  onMcpCall?: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface DriverRunInput {
  runId: string;
  agentHandle: string;
  cwd: string;
  prompt: string;
  mcpUrl?: string;
  mcpToken?: string;
  signal?: AbortSignal;
}

export interface DriverRunResult {
  sessionId: string;
  stopReason: "end_turn" | "cancelled" | "permission_mismatch" | "error";
  costUsd: number;
}

export interface LegacyHarnessDriver {
  readonly name: "claude" | "acp";
  run(input: DriverRunInput, callbacks: DriverRunCallbacks): Promise<DriverRunResult>;
}
