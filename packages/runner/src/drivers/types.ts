import type {
  NormalizedRunEvent,
  PermissionOption,
  PermissionReplyMessage,
  RunEndMessage,
  RunStartMessage
} from "@ade/shared";

export interface DriverCallbacks {
  onEvent(runId: string, acpSessionId: string | null, event: NormalizedRunEvent): void;
  onPermissionRequest(req: {
    runId: string;
    requestId: string;
    tool: string;
    args: Record<string, unknown>;
    displayCommand: string;
    options: PermissionOption[];
  }): void;
  onEnd(end: Omit<RunEndMessage, "type">): void;
}

export interface HarnessDriver {
  startRun(msg: RunStartMessage, worktreePath: string, callbacks: DriverCallbacks): Promise<void>;
  replyPermission(reply: PermissionReplyMessage): void;
  cancelRun(runId: string, reason: string): Promise<void>;
}
