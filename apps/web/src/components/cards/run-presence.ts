import type { RunStatus, RunSummary } from "@ade/shared";

const ACTIVE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set([
  "queued",
  "running",
  "waiting_permission",
]);

export function isAgentRunning(
  runs: readonly Pick<RunSummary, "agentHandle" | "status">[],
  agentHandle: string,
): boolean {
  const normalized = agentHandle.toLowerCase();
  return runs.some(
    (r) => r.agentHandle.toLowerCase() === normalized && ACTIVE_RUN_STATUSES.has(r.status),
  );
}

export function shouldShowThreadReplyBar(
  replyCount: number,
  runs: readonly Pick<RunSummary, "status">[],
): boolean {
  return replyCount > 0 || runs.some((r) => ACTIVE_RUN_STATUSES.has(r.status));
}

export function computeThreadRunSummary(
  runs: readonly Pick<RunSummary, "agentHandle" | "status" | "pendingPermissionTool">[],
): string | null {
  const active = [...runs].reverse().find((r) => ACTIVE_RUN_STATUSES.has(r.status));
  if (!active) return null;
  if (active.status === "waiting_permission") {
    return active.pendingPermissionTool
      ? `${active.agentHandle}: Chờ cấp quyền ${active.pendingPermissionTool}`
      : `${active.agentHandle}: Chờ cấp quyền`;
  }
  if (active.status === "queued") {
    return `${active.agentHandle}: Đang chờ`;
  }
  return `${active.agentHandle}: Đang chạy`;
}
