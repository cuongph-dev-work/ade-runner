import React, { useState } from "react";
import type { ExplorerCardPayload } from "@ade/shared";

export interface ExplorerCardProps {
  card: ExplorerCardPayload;
}

export const ExplorerCard: React.FC<ExplorerCardProps> = ({ card }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      data-testid="explorer-card"
      className="ade-panel ade-panel--agent p-3 space-y-3 border-l-4 border-[var(--color-agent)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span className="ade-chip ade-chip--agent">TRUY VẾT MÃ NGUỒN</span>
          <span className="ade-mention ade-mention--agent">{card.agent_handle ?? "@explorer"}</span>
        </span>
        <div className="flex items-center gap-2 text-[11px] ade-muted">
          <span>{card.duration_ms ?? 0}ms</span>
          <span>•</span>
          <span>${(card.cost_usd ?? 0).toFixed(4)}</span>
        </div>
      </header>

      <div className="space-y-1">
        <h4 data-testid="explorer-topic" className="text-sm font-bold text-[var(--color-ink)]">
          {card.topic}
        </h4>
      </div>

      {card.flow_steps && card.flow_steps.length > 0 && (
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-xs ade-muted uppercase tracking-wider">
            Các bước luồng thực thi:
          </div>
          <ol data-testid="explorer-flow-steps" className="list-decimal list-inside space-y-1 pl-1">
            {card.flow_steps.map((step, idx) => {
              const text = typeof step === "string" ? step : (step as any).title ? `${(step as any).title}: ${(step as any).description}` : String(step);
              return (
                <li key={idx} className="leading-relaxed">
                  {text}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {card.citations && card.citations.length > 0 && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs ade-muted uppercase tracking-wider">
              Trích dẫn mã nguồn ({card.citations.length} vị trí)
            </span>
            <button
              type="button"
              data-testid="explorer-toggle-citations"
              onClick={() => setExpanded((prev) => !prev)}
              className="ade-btn ade-btn--sm"
            >
              {expanded ? "Thu gọn code" : "Xem mã nguồn"}
            </button>
          </div>

          {expanded && (
            <div data-testid="explorer-citations-list" className="space-y-2 pt-1">
              {card.citations.map((cite, idx) => {
                const startLine = cite.start_line ?? (cite as any).line_start ?? 1;
                const endLine = cite.end_line ?? (cite as any).line_end ?? startLine;
                const snippet = cite.snippet ?? (cite as any).code_snippet ?? "";
                return (
                  <div
                    key={idx}
                    data-testid={`citation-item-${idx}`}
                    className="ade-well p-2.5 rounded text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="ade-mono font-medium text-[var(--color-agent)]">
                        {cite.file}#L{startLine}-L{endLine}
                      </span>
                      {cite.role && <span className="ade-chip ade-chip--agent">{cite.role}</span>}
                    </div>
                    {cite.note && <div className="ade-muted italic text-[11px]">{cite.note}</div>}
                    {snippet && (
                      <pre className="p-2 rounded bg-[var(--color-paper-3)] font-mono text-[11px] overflow-x-auto text-[var(--color-ink)]">
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
