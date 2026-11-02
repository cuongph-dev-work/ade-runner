import React, { useState } from "react";
import type { MemoryCardPayload } from "@ade/shared";

export interface MemoryProposalCardProps {
  card: MemoryCardPayload;
  onDecide: (decision: "approve" | "reject") => Promise<void>;
  disabled?: boolean;
}

export const MemoryProposalCard: React.FC<MemoryProposalCardProps> = ({
  card,
  onDecide,
  disabled
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (decision: "approve" | "reject") => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onDecide(decision);
    } catch (err: any) {
      setError(err.message || "Lỗi khi xử lý đề xuất.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = card.status === "pending";
  const isApproved = card.status === "approved";
  const isRejected = card.status === "rejected";

  return (
    <div
      data-testid="memory-proposal-card"
      className="ade-panel ade-gate-card p-3 my-2 space-y-2 text-xs border rounded"
    >
      <div className="flex items-center justify-between border-b pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-bold">Đề xuất ghi nhớ:</span>
          <code className="text-primary font-semibold">.ade/memory/{card.targetFile}</code>
          <span className="ade-mention ade-mention--agent font-mono text-2xs">
            {card.agentHandle}
          </span>
        </div>
        <div>
          {isPending && <span className="ade-chip ade-chip--warn">Chờ duyệt</span>}
          {isApproved && <span className="text-green-600 font-semibold">✓ Đã duyệt</span>}
          {isRejected && <span className="text-red-500 font-semibold">✕ Đã từ chối</span>}
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-muted-foreground">
          <strong>Lý do:</strong> {card.reason}
        </p>
        <div className="bg-muted/10 p-2 rounded font-mono text-2xs max-h-48 overflow-auto whitespace-pre-wrap border">
          {card.content}
        </div>
      </div>

      {error && <div className="text-red-500 font-medium">{error}</div>}

      {isPending && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t">
          <button
            type="button"
            data-testid="reject-memory-btn"
            disabled={disabled || isSubmitting}
            onClick={() => handleAction("reject")}
            className="ade-btn ade-btn--sm ade-btn--danger"
          >
            Từ chối
          </button>
          <button
            type="button"
            data-testid="approve-memory-btn"
            disabled={disabled || isSubmitting}
            onClick={() => handleAction("approve")}
            className="ade-btn ade-btn--sm ade-btn--primary"
          >
            {isSubmitting ? "Đang xử lý..." : "Duyệt lưu vào Memory"}
          </button>
        </div>
      )}
    </div>
  );
};
