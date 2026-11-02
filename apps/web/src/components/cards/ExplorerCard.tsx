import React, { useState } from "react";
import type { ExplorerCardPayload } from "@ade/shared";

export interface ExplorerCardProps {
  card: ExplorerCardPayload;
}

export const ExplorerCard: React.FC<ExplorerCardProps> = ({ card }) => {
  const [expanded, setExpanded] = useState(false);
  const topicText = card.topic || (card as unknown as { query?: string }).query || "Tra cứu kiến trúc mã nguồn";
  const citations = card.citations ?? [];
  const flowSteps = card.flow_steps ?? [];
  const readOnlyBadge = (card as any).read_only_badge ?? "Chỉ đọc · 0 tệp sửa";
  const summaryText = (card as any).summary;

  return (
    <article
      data-testid="explorer-card"
      className="ade-panel ade-panel--agent ade-explorer-card p-3 space-y-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span className="ade-chip ade-chip--agent">TRUY VẾT MÃ NGUỒN</span>
          <span className="ade-mention ade-mention--agent">{card.agent_handle ?? "@explorer"}</span>
          <span className="ade-chip ade-chip--agent">{readOnlyBadge}</span>
        </span>
        <div className="flex items-center gap-2 text-[11px] ade-muted">
          <span>{card.duration_ms ?? 0}ms</span>
          <span>•</span>
          <span>${(card.cost_usd ?? 0).toFixed(4)}</span>
        </div>
      </header>

      <div className="space-y-1">
        <h4 data-testid="explorer-topic" className="text-sm font-bold text-[var(--color-ink)]">
          {topicText}
        </h4>
        {summaryText && (
          <p className="text-xs text-[var(--color-ink-2)] leading-relaxed">
            {summaryText}
          </p>
        )}
      </div>

      {flowSteps.length > 0 && (
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold text-xs ade-muted uppercase tracking-wider">
            Các bước luồng thực thi:
          </div>
          <ol data-testid="explorer-flow-steps" className="ade-flow-list list-none p-0 m-0 space-y-1">
            {flowSteps.map((step, idx) => {
              const title = typeof step === "string" ? step : (step as { title?: string }).title ?? String(step);
              const desc = typeof step === "object" && (step as { desc?: string }).desc
                ? (step as { desc?: string }).desc
                : typeof step === "object" && (step as { description?: string }).description
                ? (step as { description?: string }).description
                : null;
              return (
                <li key={idx} className="ade-flow-step">
                  <span className="ade-chip ade-mono text-center" style={{ minWidth: "18px", padding: "0 4px" }}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="text-[var(--color-ink)]">{title}</strong>
                    {desc && <p className="ade-muted mt-0.5 leading-relaxed">{desc}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {citations.length > 0 && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs ade-muted uppercase tracking-wider">
              Trích dẫn mã nguồn ({citations.length} vị trí)
            </span>
            <button
              type="button"
              data-testid="explorer-toggle-citations"
              onClick={() => setExpanded((prev) => !prev)}
              className="ade-btn ade-btn--sm ade-btn--ghost"
            >
              {expanded ? "Thu gọn code" : "Xem mã nguồn"}
            </button>
          </div>

          {expanded && (
            <div data-testid="explorer-citations-list" className="space-y-2 pt-1">
              {citations.map((cite, idx) => {
                const file = typeof cite === "string" ? cite : (cite as { file?: string }).file ?? String(cite);
                const startLine = (cite as any).start_line ?? (cite as any).line_start;
                const endLine = (cite as any).end_line ?? (cite as any).line_end;
                const linesStr = (cite as any).lines ?? (startLine && endLine ? `L${startLine}-L${endLine}` : "");
                const label = linesStr ? `${file}#${linesStr.replace(/^#/, "")}` : file;
                const snippet = typeof cite === "object" && (cite as { snippet?: string }).snippet ? (cite as { snippet?: string }).snippet : "";
                return (
                  <div
                    key={idx}
                    data-testid={`citation-item-${idx}`}
                    className="p-2 rounded ade-well space-y-1 font-mono text-[11px]"
                  >
                    <div className="flex items-center justify-between font-semibold text-[var(--color-agent)]">
                      <span className="ade-mono">{label}</span>
                      {(cite as any).role && <span className="ade-chip ade-chip--agent">{(cite as any).role}</span>}
                    </div>
                    {snippet && (
                      <pre className="overflow-x-auto p-1.5 bg-[var(--color-paper)] rounded text-[var(--color-ink)] border border-[var(--color-rule)]">
                        <code>{snippet}</code>
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
