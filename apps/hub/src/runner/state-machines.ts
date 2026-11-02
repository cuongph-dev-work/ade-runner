import type { RunStatus, RunnerStatus } from "@ade/shared";
import { HubDomainError } from "../errors.js";

export { HubDomainError };

const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set(["completed", "failed", "cancelled"]);

const ALLOWED_RUN_TRANSITIONS: Record<RunStatus, ReadonlySet<RunStatus>> = {
  queued: new Set(["running", "cancelled"]),
  running: new Set(["waiting_permission", "waiting_human", "completed", "failed", "cancelled"]),
  waiting_permission: new Set(["running", "cancelled"]),
  waiting_human: new Set(["running", "cancelled", "completed"]),
  completed: new Set([]),
  failed: new Set([]),
  cancelled: new Set([]),
};

export function assertRunTransition(current: RunStatus, next: RunStatus): void {
  if (next === "cancelled" && TERMINAL_RUN_STATUSES.has(current)) {
    throw new HubDomainError(
      "ERR_RUN_NOT_CANCELLABLE",
      "Run đã kết thúc nên không thể huỷ.",
      409,
    );
  }
  if (!ALLOWED_RUN_TRANSITIONS[current].has(next)) {
    throw new HubDomainError(
      "ERR_INVALID_STATUS",
      `Không được chuyển trạng thái Run từ ${current} sang ${next}.`,
      400,
    );
  }
}

const ALLOWED_RUNNER_TRANSITIONS: Record<RunnerStatus, ReadonlySet<RunnerStatus>> = {
  online: new Set(["offline", "online"]),
  offline: new Set(["online"]),
};

export function assertRunnerTransition(current: RunnerStatus | null, next: RunnerStatus): void {
  if (current === null) {
    if (next !== "online") {
      throw new HubDomainError("ERR_INVALID_STATUS", "Runner mới phải khởi đầu ở online.", 400);
    }
    return;
  }
  if (current === "offline" && next === "offline") {
    throw new HubDomainError(
      "ERR_INVALID_STATUS",
      "Runner đang ở trạng thái offline không thể ngắt kết nối lần nữa.",
      400,
    );
  }
  if (!ALLOWED_RUNNER_TRANSITIONS[current].has(next)) {
    throw new HubDomainError("ERR_INVALID_STATUS", "Chuyển trạng thái Runner không hợp lệ.", 400);
  }
}
