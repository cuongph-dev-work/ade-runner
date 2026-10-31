import React, { useState } from "react";
import type { LiveCardPayload, RunStatus } from "@ade/shared";

const STATUS_LABELS_VI: Record<RunStatus, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  waiting_permission: "Chờ cấp quyền",
  waiting_human: "Chờ phản hồi",
  completed: "Hoàn thành",
  failed: "Thất bại",
  cancelled: "Đã huỷ",
};

const STATUS_CHIP_CLASS: Record<RunStatus, string> = {
  queued: "ade-chip ade-chip--agent",
  running: "ade-chip ade-chip--agent",
  waiting_permission: "ade-chip ade-chip--human",
  waiting_human: "ade-chip ade-chip--human",
  completed: "ade-chip ade-chip--ok",
  failed: "ade-chip ade-chip--bad",
  cancelled: "ade-chip",
};

const CANCELLABLE_STATUSES: ReadonlySet<RunStatus> = new Set([
  "queued",
  "running",
  "waiting_permission",
]);

const BotGlyph: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    width={12}
    height={12}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="5" width="11" height="8.5" rx="2" />
    <path d="M8 2.5V5M5.5 9h.01M10.5 9h.01M6 11.5h4" />
  </svg>
);

function formatDurationSeconds(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const diffMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  if (Number.isNaN(diffMs)) return null;
  return `${(diffMs / 1000).toFixed(1)}s`;
}

export interface LiveCardProps {
  card: LiveCardPayload;
  currentUserId: string;
  currentUserRole: "owner" | "member";
  onCancelRun: (runId: string) => Promise<void>;
}

export const LiveCard: React.FC<LiveCardProps> = ({
  card,
  currentUserId,
  currentUserRole,
  onCancelRun,
}) => {
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const canAct = currentUserRole === "owner" || currentUserId === card.invokedBy;
  const showCancel = canAct && CANCELLABLE_STATUSES.has(card.status);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancelRun(card.runId);
    } finally {
      setCancelling(false);
    }
  };

  const totalActivities = card.toolCalls.length + card.steps.length;
  const durationLabel = formatDurationSeconds(card.startedAt, card.endedAt);

  return (
    <article
      data-testid="live-card"
      data-run-id={card.runId}
      className="ade-panel p-3 space-y-2"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span data-testid="agent-bot-badge" className="ade-chip ade-chip--agent ade-mono">
            BOT
          </span>
          <span className="ade-mention ade-mention--agent">
            <BotGlyph />
            <span>{card.agentHandle}</span>
          </span>
          <span className="ade-muted">{`· chạy cho ${card.invokedBy}`}</span>
          <span className="ade-muted">
            {card.runnerMachineName ? `· runner ${card.runnerMachineName}` : "· chờ runner"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            data-testid="live-card-status"
            data-status={card.status}
            className={STATUS_CHIP_CLASS[card.status]}
          >
            {STATUS_LABELS_VI[card.status]}
          </span>
          {showCancel ? (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void handleCancel()}
              className="ade-btn ade-btn--sm ade-btn--danger"
            >
              Huỷ run
            </button>
          ) : null}
        </div>
      </header>

      {card.plan.length > 0 ? (
        <ul data-testid="live-card-plan" className="ade-mono space-y-0.5 text-xs">
          {card.plan.map((item) => (
            <li key={item.id}>
              <span>
                {item.status === "completed" ? "[x]" : item.status === "in_progress" ? "[~]" : "[ ]"}
              </span>{" "}
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-1.5">
        <button
          type="button"
          data-testid="live-card-toggle-steps"
          aria-expanded={stepsExpanded}
          onClick={() => setStepsExpanded((prev) => !prev)}
          className="ade-btn ade-btn--sm"
        >
          {stepsExpanded ? `Thu gọn (${totalActivities} bước)` : `Mở rộng (${totalActivities} bước)`}
        </button>

        {stepsExpanded ? (
          <ul
            data-testid="live-card-steps"
            className="ade-well ade-mono max-h-[240px] space-y-1 overflow-y-auto p-2 text-xs"
          >
            {card.toolCalls.map((tc) => (
              <li key={tc.callId}>{tc.summary}</li>
            ))}
            {card.steps.map((st, idx) => (
              <li key={`step_${idx}`}>{st.text}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {card.lastMessageText ? (
        <div
          data-testid="live-card-message"
          className="ade-well whitespace-pre-wrap p-2.5 text-sm"
        >
          {card.lastMessageText}
        </div>
      ) : null}

      {card.status === "completed" || card.status === "failed" || card.status === "cancelled" ? (
        <footer
          data-testid="live-card-footer"
          className="ade-mono ade-muted pt-2 text-xs"
          style={{ borderTop: "var(--rule-hair) solid var(--color-rule)" }}
        >
          <span>{`Trạng thái cuối: ${STATUS_LABELS_VI[card.status]}`}</span>
          <span>{` · Chi phí: $${card.costUsd.toFixed(4)}`}</span>
          {durationLabel ? <span>{` · Thời lượng: ${durationLabel}`}</span> : null}
          {card.errorCode ? <span>{` · Mã lỗi: ${card.errorCode}`}</span> : null}
        </footer>
      ) : null}
    </article>
  );
};
