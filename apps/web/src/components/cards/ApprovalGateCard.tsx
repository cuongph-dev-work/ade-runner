import React, { useState } from "react";
import type { ApprovalGateCardPayload, ApprovalStatus } from "@ade/shared";

export interface ApprovalGateCardProps {
  card: Partial<ApprovalGateCardPayload> & {
    approval_id: string;
    summary: string;
    status: ApprovalStatus;
  };
  threadId: string;
  onDecision: (params: {
    approvalId: string;
    decision: "approve" | "changes_requested";
    feedback?: string;
  }) => Promise<void> | void;
}

export const ApprovalGateCard: React.FC<ApprovalGateCardProps> = ({
  card,
  threadId: _threadId,
  onDecision,
}) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = card.title ?? `Cổng duyệt ${card.gate?.toUpperCase() ?? "PLAN"} v${card.version ?? 1}`;
  const isPending = card.status === "pending";

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onDecision({
        approvalId: card.approval_id,
        decision: "approve",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangesRequested = async () => {
    if (!feedback.trim()) return;
    setIsSubmitting(true);
    try {
      await onDecision({
        approvalId: card.approval_id,
        decision: "changes_requested",
        feedback: feedback.trim(),
      });
      setShowFeedback(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid={`approval-gate-card-${card.approval_id}`}
      className="ade-panel my-2 p-3 rounded-lg border text-sm"
      style={{
        backgroundColor: "var(--color-paper-2, #fff)",
        borderColor: isPending ? "var(--color-lead, #d97706)" : "var(--color-rule-2, #e5e7eb)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base">{title}</span>
          <span
            data-testid="approval-status-badge"
            className="ade-chip"
            style={{
              fontSize: "0.75rem",
              backgroundColor:
                card.status === "approved"
                  ? "var(--color-ok-bg, #ecfdf5)"
                  : card.status === "changes_requested"
                  ? "var(--color-bad-bg, #fef2f2)"
                  : "var(--color-warn-bg, #fffbeb)",
              color:
                card.status === "approved"
                  ? "var(--color-ok, #059669)"
                  : card.status === "changes_requested"
                  ? "var(--color-bad, #dc2626)"
                  : "var(--color-warn, #d97706)",
            }}
          >
            {card.status === "approved"
              ? "Đã duyệt"
              : card.status === "changes_requested"
              ? "Yêu cầu sửa"
              : "Chờ duyệt"}
          </span>
        </div>
        {card.target_state && (
          <span className="text-xs ade-mono ade-muted">
            Mục tiêu: {card.target_state}
          </span>
        )}
      </div>

      <div className="ade-card-body my-2 text-sm leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>
        {card.summary}
      </div>

      {card.status === "approved" && (
        <div data-testid="approval-resolved-msg" className="text-xs ade-muted mt-2">
          Đã được phê duyệt bởi {card.decided_by ?? "bạn"}
        </div>
      )}

      {card.status === "changes_requested" && card.feedback && (
        <div
          data-testid="approval-feedback-msg"
          className="text-xs mt-2 p-2 rounded"
          style={{ backgroundColor: "var(--color-bad-bg, #fef2f2)", color: "var(--color-bad, #dc2626)" }}
        >
          <strong>Phản hồi yêu cầu sửa:</strong> {card.feedback}
        </div>
      )}

      {isPending && (
        <div className="mt-3 pt-2 border-t flex flex-col gap-2">
          {!showFeedback ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="btn-approve-gate"
                disabled={isSubmitting}
                onClick={handleApprove}
                className="ade-btn ade-btn--primary"
                style={{
                  backgroundColor: "var(--color-ok, #059669)",
                  borderColor: "var(--color-ok, #059669)",
                  color: "#fff",
                }}
              >
                {isSubmitting ? "Đang duyệt..." : "Duyệt (Approve)"}
              </button>
              <button
                type="button"
                data-testid="btn-revise-gate"
                disabled={isSubmitting}
                onClick={() => setShowFeedback(true)}
                className="ade-btn ade-btn--secondary"
              >
                Yêu cầu sửa (Changes Requested)
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                data-testid="gate-feedback-input"
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Nhập lý do hoặc nội dung cần chỉnh sửa..."
                className="w-full p-2 border rounded text-xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-submit-feedback"
                  disabled={isSubmitting || !feedback.trim()}
                  onClick={handleChangesRequested}
                  className="ade-btn ade-btn--primary"
                  style={{
                    backgroundColor: "var(--color-bad, #dc2626)",
                    borderColor: "var(--color-bad, #dc2626)",
                    color: "#fff",
                  }}
                >
                  {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu sửa"}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowFeedback(false)}
                  className="ade-btn ade-btn--ghost"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
