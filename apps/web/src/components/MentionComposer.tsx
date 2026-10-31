import { useRef, useState, type JSX, type KeyboardEvent } from "react";
import { resolveMsg, type AgentSummary, type ColleagueSummary } from "@ade/shared";

interface MentionComposerProps {
  inputTestId: string;
  sendBtnTestId: string;
  resizerTestId: string;
  resizerAriaLabel: string;
  heightToggleTestId: string;
  placeholder: string;
  sendLabel: string;
  submitting: boolean;
  colleagues: ColleagueSummary[];
  agents: AgentSummary[];
  onSubmit: (body: string) => Promise<boolean>;
}

interface ActiveMentionToken {
  start: number;
  end: number;
  query: string;
}

function detectMentionToken(value: string, caret: number): ActiveMentionToken | null {
  const before = value.slice(0, caret);
  const match = /(?:^|[\s([{"'])@([a-z0-9-_]*)$/i.exec(before);
  if (!match) return null;
  const query = match[1] ?? "";
  const atIndex = before.lastIndexOf(`@${query}`);
  if (atIndex < 0) return null;
  return { start: atIndex, end: caret, query: query.toLowerCase() };
}

export function MentionComposer({
  inputTestId,
  sendBtnTestId,
  resizerTestId,
  resizerAriaLabel,
  heightToggleTestId,
  placeholder,
  sendLabel,
  submitting,
  colleagues,
  agents,
  onSubmit
}: MentionComposerProps): JSX.Element {
  const [text, setText] = useState("");
  const [heightPx, setHeightPx] = useState(84);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [token, setToken] = useState<ActiveMentionToken | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const enabledAgents = agents.filter((a) => a.enabled);
  const matchedColleagues = token
    ? colleagues.filter(
        (c) =>
          c.handle.slice(1).toLowerCase().includes(token.query) ||
          c.name.toLowerCase().includes(token.query)
      )
    : [];
  const matchedAgents = token
    ? enabledAgents.filter(
        (a) =>
          a.handle.slice(1).toLowerCase().includes(token.query) ||
          a.displayName.toLowerCase().includes(token.query)
      )
    : [];

  const flatOptions: Array<{ handle: string; label: string; kind: "human" | "agent" }> = [
    ...matchedColleagues.map((c) => ({
      handle: c.handle,
      label: c.name,
      kind: "human" as const
    })),
    ...matchedAgents.map((a) => ({
      handle: a.handle,
      label: a.displayName,
      kind: "agent" as const
    }))
  ];

  const popupOpen = token !== null && flatOptions.length > 0;

  const insertOption = (handle: string): void => {
    if (!token) return;
    const nextText = `${text.slice(0, token.start)}${handle} ${text.slice(token.end)}`;
    setText(nextText);
    setToken(null);
    setSelectedIdx(0);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleSend = async (): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (trimmed.length > 20000) {
      setErrorMsg(resolveMsg("MSG02", "body", { max: 20000 }));
      return;
    }
    setErrorMsg(null);
    const ok = await onSubmit(trimmed);
    if (ok) {
      setText("");
      setToken(null);
      setHeightPx(84);
    }
  };

  const onTextareaKeyDown = (ev: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (popupOpen) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setSelectedIdx((idx) => (idx + 1) % flatOptions.length);
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setSelectedIdx((idx) => (idx - 1 + flatOptions.length) % flatOptions.length);
        return;
      }
      if (ev.key === "Enter" || ev.key === "Tab") {
        ev.preventDefault();
        const chosen = flatOptions[selectedIdx] ?? flatOptions[0];
        if (chosen) insertOption(chosen.handle);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        setToken(null);
        return;
      }
    }

    if (ev.key === "Escape" && token !== null) {
      ev.preventDefault();
      setToken(null);
      return;
    }

    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      void handleSend();
    }
  };

  const clampHeight = (next: number): number => Math.max(48, Math.min(260, next));

  return (
    <div className="ade-composer-wrap">
      {popupOpen && (
        <div data-testid="mention-popup" className="ade-mention-popup" role="listbox">
          {matchedColleagues.length > 0 && (
            <div data-testid="mention-group-colleagues">
              <div className="ade-mention-group-label">Đồng nghiệp</div>
              {matchedColleagues.map((col) => {
                const idx = flatOptions.findIndex((o) => o.handle === col.handle);
                return (
                  <button
                    key={col.id}
                    type="button"
                    data-testid={`mention-option-${col.handle.slice(1)}`}
                    className={
                      idx === selectedIdx
                        ? "ade-mention-option is-selected"
                        : "ade-mention-option"
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertOption(col.handle);
                    }}
                  >
                    <span>
                      <strong>{col.handle}</strong> · {col.name}
                    </span>
                    <span className="ade-chip">{col.role}</span>
                  </button>
                );
              })}
            </div>
          )}

          {matchedAgents.length > 0 && (
            <div data-testid="mention-group-agents">
              <div className="ade-mention-group-label">Bot / Agent</div>
              {matchedAgents.map((ag) => {
                const idx = flatOptions.findIndex((o) => o.handle === ag.handle);
                return (
                  <button
                    key={ag.id}
                    type="button"
                    data-testid={`mention-option-${ag.handle.slice(1)}`}
                    className={
                      idx === selectedIdx
                        ? "ade-mention-option is-selected"
                        : "ade-mention-option"
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertOption(ag.handle);
                    }}
                  >
                    <span>
                      <strong>{ag.handle}</strong> · {ag.displayName}
                    </span>
                    <span className="ade-chip ade-chip--agent">{ag.harness}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={resizerAriaLabel}
        data-testid={resizerTestId}
        className="ade-composer-resizer"
        onKeyDown={(ev) => {
          if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setHeightPx((h) => clampHeight(h + 16));
          } else if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setHeightPx((h) => clampHeight(h - 16));
          }
        }}
        onMouseDown={(ev) => {
          const startY = ev.clientY;
          const startH = heightPx;
          const onMove = (moveEv: MouseEvent): void => {
            setHeightPx(clampHeight(startH + (startY - moveEv.clientY)));
          };
          const onUp = (): void => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        ⋯
      </div>

      <textarea
        ref={textareaRef}
        data-testid={inputTestId}
        className="ade-composer-textarea"
        style={{ height: `${heightPx}px` }}
        placeholder={placeholder}
        value={text}
        onChange={(ev) => {
          const el = ev.target;
          const val = el.value;
          setText(val);
          if (errorMsg) setErrorMsg(null);
          const lineEstimatePx = val.split("\n").length * 22 + 24;
          setHeightPx((prev) =>
            clampHeight(Math.max(prev, el.scrollHeight, lineEstimatePx))
          );
          const caret = el.selectionStart ?? val.length;
          setToken(detectMentionToken(val, caret));
          setSelectedIdx(0);
        }}
        onKeyDown={onTextareaKeyDown}
      />

      {errorMsg && (
        <p role="alert" className="ade-field-error">
          {errorMsg}
        </p>
      )}

      <div className="ade-composer-foot">
        <div className="ade-mode-group">
          <button
            type="button"
            className="ade-btn ade-btn--icon ade-icon-btn"
            aria-label="Chèn ký tự @"
            onClick={() => {
              const next = text.endsWith(" ") || text.length === 0 ? `${text}@` : `${text} @`;
              setText(next);
              setToken(detectMentionToken(next, next.length));
              textareaRef.current?.focus();
            }}
          >
            @
          </button>
          <button
            type="button"
            data-testid={heightToggleTestId}
            className="ade-btn ade-btn--icon ade-icon-btn"
            aria-label="Đổi chiều cao khung nhập"
            onClick={() => setHeightPx((h) => (h < 132 ? 180 : 84))}
          >
            ⇕
          </button>
          <span>Enter để gửi · Shift+Enter xuống dòng</span>
        </div>

        <button
          type="button"
          data-testid={sendBtnTestId}
          className="ade-btn ade-btn--primary"
          disabled={submitting}
          onClick={() => {
            void handleSend();
          }}
        >
          {sendLabel}
        </button>
      </div>
    </div>
  );
}
