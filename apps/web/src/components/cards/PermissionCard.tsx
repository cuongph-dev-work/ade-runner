import React, { useState } from "react";
import { PermissionReplyBodySchema, type PermissionCardPayload } from "@ade/shared";

const PERM_STATUS_LABELS_VI: Record<PermissionCardPayload["status"], string> = {
  pending: "Chờ quyết định",
  allowed: "Đã cho phép",
  denied: "Đã từ chối",
  cancelled: "Đã huỷ",
};

const PERM_STATUS_CHIP_CLASS: Record<PermissionCardPayload["status"], string> = {
  pending: "ade-chip ade-chip--human",
  allowed: "ade-chip ade-chip--ok",
  denied: "ade-chip ade-chip--bad",
  cancelled: "ade-chip",
};

const PERM_GATE_STATUS_ATTR: Record<PermissionCardPayload["status"], string> = {
  pending: "pending",
  allowed: "approved",
  denied: "rejected",
  cancelled: "cancelled",
};

const VALIDATION_MESSAGES_VI: Record<string, string> = {
  MSG01: "Lựa chọn là bắt buộc.",
  MSG02: "Lựa chọn không được vượt quá 64 ký tự.",
  MSG04: "Định dạng Quyết định không hợp lệ.",
};

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

export interface PermissionCardProps {
  card: PermissionCardPayload;
  currentUserId: string;
  currentUserRole: "owner" | "member";
  onReplyPermission: (params: {
    runId: string;
    requestId: string;
    optionId: string;
    decision: "allow" | "deny";
  }) => Promise<void>;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  card,
  currentUserId,
  currentUserRole,
  onReplyPermission,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const canAct = currentUserRole === "owner" || currentUserId === card.invokedBy;
  const allowOpt = card.options.find((o) => o.decision === "allow");
  const denyOpt = card.options.find((o) => o.decision === "deny");

  const submitDecision = async (optionId: string, decision: "allow" | "deny") => {
    setInlineError(null);
    const check = PermissionReplyBodySchema.safeParse({ optionId, decision });
    if (!check.success) {
      const code = check.error.issues[0]?.message ?? "MSG04";
      setInlineError(`${code}: ${VALIDATION_MESSAGES_VI[code] ?? code}`);
      return;
    }
    setSubmitting(true);
    try {
      await onReplyPermission({
        runId: card.runId,
        requestId: card.requestId,
        optionId: check.data.optionId,
        decision: check.data.decision,
      });
    } catch (err) {
      const maybeValidationCode = (err as { validationCode?: string })?.validationCode;
      if (maybeValidationCode) {
        setInlineError(
          `${maybeValidationCode}: ${VALIDATION_MESSAGES_VI[maybeValidationCode] ?? maybeValidationCode}`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article
      data-testid="permission-card"
      data-request-id={card.requestId}
      data-gate-status={PERM_GATE_STATUS_ATTR[card.status]}
      className="ade-panel ade-gate-card p-3 space-y-2"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <span
            data-testid="permission-gate-mark"
            className="ade-gate-mark"
            aria-hidden="true"
          />
          <span>Yêu cầu quyền thực thi công cụ ·</span>
          <span className="ade-mention ade-mention--agent">
            <BotGlyph />
            <span>{card.agentHandle}</span>
          </span>
        </span>
        <span
          data-testid="permission-card-status"
          className={PERM_STATUS_CHIP_CLASS[card.status]}
        >
          {PERM_STATUS_LABELS_VI[card.status]}
        </span>
      </header>

      <div className="space-y-1 text-xs">
        <div>
          Công cụ:{" "}
          <strong data-testid="permission-tool-name" className="ade-mono">
            {card.tool}
          </strong>
        </div>
        <pre
          data-testid="permission-command"
          className="ade-well ade-mono overflow-x-auto p-2 text-xs"
        >
          <code>{card.displayCommand}</code>
        </pre>
      </div>

      {card.status === "pending" && canAct ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="permission-approve-btn"
            disabled={submitting}
            onClick={() => void submitDecision(allowOpt?.id ?? "allow", "allow")}
            className="ade-btn ade-btn--sm ade-btn--primary"
          >
            Cho phép
          </button>
          <button
            type="button"
            data-testid="permission-deny-btn"
            disabled={submitting}
            onClick={() => void submitDecision(denyOpt?.id ?? "deny", "deny")}
            className="ade-btn ade-btn--sm"
          >
            Từ chối
          </button>
        </div>
      ) : null}

      {inlineError ? (
        <p
          data-testid="permission-validation-error"
          className="text-xs"
          style={{ color: "var(--color-bad)" }}
        >
          {inlineError}
        </p>
      ) : null}
    </article>
  );
};
