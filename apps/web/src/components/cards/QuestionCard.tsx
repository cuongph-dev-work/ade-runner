import React, { useState } from "react";
import type { QuestionCardPayload, QuestionAnswerItem } from "@ade/shared";

export interface QuestionCardProps {
  card: QuestionCardPayload;
  onReplyQuestion?: (params: {
    questionId: string;
    answer?: string;
    optionId?: string | null;
    answers?: QuestionAnswerItem[];
  }) => Promise<void>;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ card, onReplyQuestion }) => {
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>(card.selected_option_id ?? "");
  const [customText, setCustomText] = useState<string>(card.answer ?? "");
  const [multiAnswers, setMultiAnswers] = useState<Record<string, { optionIds: string[]; otherText?: string; text?: string }>>({});

  const isPending = card.status === "pending";

  const handleSingleSelect = (optVal: string) => {
    if (!isPending) return;
    setSelectedOption(optVal);
  };

  const handleSubmit = async () => {
    if (!onReplyQuestion || !isPending) return;
    setSubmitting(true);
    try {
      if (card.questions && card.questions.length > 0) {
        const answers: QuestionAnswerItem[] = (card.questions ?? []).map((q) => {
          const ans = multiAnswers[q.id];
          return {
            question_id: q.id,
            selected_option_ids: ans?.optionIds ?? [],
            other_text: ans?.otherText ?? null,
            text: ans?.text ?? null,
          };
        });
        await onReplyQuestion({
          questionId: card.question_id,
          answers,
        });
      } else {
        await onReplyQuestion({
          questionId: card.question_id,
          answer: customText || selectedOption,
          optionId: selectedOption || null,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article
      data-testid={`question-card-${card.question_id}`}
      data-question-id={card.question_id}
      data-status={card.status}
      className="ade-panel ade-gate-card ade-clarify-card p-3 space-y-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span className="ade-chip ade-chip--human">CÂU HỎI LÀM RÕ</span>
          <span className="ade-mention ade-mention--agent">{card.agent_handle ?? "@clarifier"}</span>
        </span>
        <span
          data-testid="question-card-status"
          className={
            card.status === "answered"
              ? "ade-chip ade-chip--ok"
              : card.status === "expired"
                ? "ade-chip ade-chip--bad"
                : "ade-chip ade-chip--human"
          }
        >
          {card.status === "answered"
            ? "Đã trả lời"
            : card.status === "expired"
              ? "Hết hạn"
              : "Chờ trả lời"}
        </span>
      </header>

      <div data-testid="question-prompt" className="text-sm font-medium leading-relaxed">
        {card.question}
      </div>

      {card.options && card.options.length > 0 && (
        <div data-testid="question-options" className="space-y-1.5 text-xs">
          {card.options.map((opt, idx) => {
            const optId = typeof opt === "string" ? opt : (opt as any).id ?? String(idx);
            const optLabel = typeof opt === "string" ? opt : (opt as any).label ?? String(opt);
            return (
              <label
                key={optId}
                data-testid={`question-option-${optId}`}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                  selectedOption === optId
                    ? "bg-[var(--color-paper-3)] border border-[var(--color-agent)] font-medium"
                    : "hover:bg-[var(--color-paper-2)]"
                }`}
              >
                <input
                  type="radio"
                  name={`question_${card.question_id}`}
                  value={optId}
                  disabled={!isPending}
                  checked={selectedOption === optId}
                  onChange={() => handleSingleSelect(optId)}
                  className="text-[var(--color-agent)]"
                />
                <span>{optLabel}</span>
              </label>
            );
          })}
        </div>
      )}

      {card.questions && card.questions.length > 0 && (
        <div data-testid="sub-questions-list" className="space-y-3 text-xs">
          {card.questions.map((q) => (
            <div key={q.id} className="ade-q-block p-2.5 rounded space-y-1.5" style={{ backgroundColor: "var(--color-paper-2)", border: "var(--rule-hair) solid var(--color-rule-2)" }}>
              <div className="font-semibold text-xs text-[var(--color-ink)]">{q.prompt}</div>
              {q.options && q.options.length > 0 && (
                <div className="space-y-1">
                  {q.options.map((opt) => {
                    const optId = opt.id;
                    const optVal = opt.label;
                    const cur = multiAnswers[q.id]?.optionIds ?? [];
                    const isChecked = cur.includes(optId);
                    return (
                      <label
                        key={optId}
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition ${
                          isChecked
                            ? "bg-[var(--color-paper-3)] border border-[var(--color-agent)] font-medium"
                            : "hover:bg-[var(--color-paper)]"
                        }`}
                      >
                        <input
                          type={q.type === "multi" ? "checkbox" : "radio"}
                          name={`sub_${q.id}`}
                          disabled={!isPending}
                          checked={isChecked}
                          onChange={() => {
                            if (!isPending) return;
                            setMultiAnswers((prev) => {
                              const prevAns = prev[q.id] ?? { optionIds: [] };
                              let nextOpts: string[];
                              if (q.type === "multi") {
                                nextOpts = isChecked
                                  ? prevAns.optionIds.filter((x) => x !== optId)
                                  : [...prevAns.optionIds, optId];
                              } else {
                                nextOpts = [optId];
                              }
                              return { ...prev, [q.id]: { ...prevAns, optionIds: nextOpts } };
                            });
                          }}
                        />
                        <span>{optVal}</span>
                        {opt.hint && <span className="text-[11px] ade-muted">({opt.hint})</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isPending && (
        <div className="space-y-2 pt-2 border-t border-[var(--color-rule)]">
          <input
            type="text"
            data-testid="question-custom-text-input"
            placeholder="Hoặc tự điền câu trả lời tùy biến..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full ade-input text-xs"
          />
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="question-submit-btn"
              disabled={submitting || (!selectedOption && !customText.trim() && Object.keys(multiAnswers).length === 0)}
              onClick={handleSubmit}
              className="ade-btn ade-btn--primary text-xs"
            >
              {submitting ? "Đang gửi..." : "Gửi câu trả lời"}
            </button>
          </div>
        </div>
      )}

      {!isPending && (card.answer || card.selected_option_id) && (
        <div data-testid="question-answered-box" className="p-2 rounded bg-[var(--color-paper-3)] text-xs space-y-1">
          <span className="font-semibold text-xs ade-muted">Câu trả lời đã ghi nhận:</span>
          <div className="font-medium text-[var(--color-ink)]">
            {card.answer || card.selected_option_id}
          </div>
          {card.answered_by && (
            <div className="text-[11px] ade-muted">
              Trả lời bởi {card.answered_by} lúc {card.answered_at ?? "vừa xong"}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
