import type { NormalizedRunEvent } from "@ade/shared";

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
  onEvent: (event: NormalizedRunEvent) => void | Promise<void>;
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

export interface HarnessDriver {
  readonly name: "claude" | "acp";
  run(input: DriverRunInput, callbacks: DriverRunCallbacks): Promise<DriverRunResult>;
}
