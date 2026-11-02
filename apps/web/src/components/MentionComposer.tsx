import { useRef, useState, type JSX, type KeyboardEvent } from "react";
import { resolveMsg, type AgentSummary, type ColleagueSummary } from "@ade/shared";
import { Button, Icon, Chip, Avatar } from "./ui/index.js";
import { HeightToggleIcon } from "./icons.js";

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
  variant?: "channel" | "thread";
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
  onSubmit,
  variant = "channel"
}: MentionComposerProps): JSX.Element {
  const isThread = variant === "thread";
  const [text, setText] = useState("");
  const [heightPx, setHeightPx] = useState(isThread ? 42 : 84);
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
    <div className={`ade-composer-wrap ${isThread ? "ade-thread-composer" : "ade-channel-composer"} relative`}>
      {popupOpen && (
        <div data-testid="mention-popup" className="ade-mention-popup" role="listbox">
          {/* Header */}
          <div className="ade-mention-popup-header">
            <span className="ade-mention-popup-title">Nhắc hoặc giao việc</span>
            <span className="ade-mention-popup-hint">↑↓ duyệt · ↵ chèn</span>
          </div>

          <div className="ade-mention-popup-body">
            {/* Group Agents */}
            {matchedAgents.length > 0 && (
              <div data-testid="mention-group-agents" className="ade-mention-group">
                <div className="ade-mention-group-label ade-mention-group-label--agent">
                  BOT & AGENT (GIAO VIỆC)
                </div>
                {matchedAgents.map((ag) => {
                  const idx = flatOptions.findIndex((o) => o.handle === ag.handle);
                  const isSelected = idx === selectedIdx;
                  const agentInitials = ag.handle.replace(/^@/, "").slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      data-testid={`mention-option-${ag.handle.slice(1)}`}
                      className={`ade-mention-option ade-mention-option--agent ${
                        isSelected ? "is-selected" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertOption(ag.handle);
                      }}
                    >
                      <div className="ade-mention-option-left">
                        <Avatar
                          tone={ag.handle === "@lead" ? "lead" : "agent"}
                          size={22}
                          initials={agentInitials}
                        />
                        <span className="ade-mention-handle ade-mention-handle--agent">
                          {ag.handle}
                        </span>
                        <span className="ade-mention-sep">·</span>
                        <span className="ade-mention-name">{ag.displayName}</span>
                      </div>
                      <div className="ade-mention-option-right">
                        <Chip type="agent">{ag.harness}</Chip>
                        {isSelected && <kbd className="ade-mention-shortcut">↵</kbd>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {matchedAgents.length > 0 && matchedColleagues.length > 0 && (
              <div className="ade-mention-divider" />
            )}

            {/* Group Colleagues */}
            {matchedColleagues.length > 0 && (
              <div data-testid="mention-group-colleagues" className="ade-mention-group">
                <div className="ade-mention-group-label ade-mention-group-label--human">
                  ĐỒNG NGHIỆP (CON NGƯỜI)
                </div>
                {matchedColleagues.map((col) => {
                  const idx = flatOptions.findIndex((o) => o.handle === col.handle);
                  const isSelected = idx === selectedIdx;
                  const nameParts = col.name.trim().split(/\s+/);
                  const initials =
                    nameParts.length >= 2
                      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
                      : col.handle.replace(/^@/, "").slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={col.id}
                      type="button"
                      data-testid={`mention-option-${col.handle.slice(1)}`}
                      className={`ade-mention-option ade-mention-option--human ${
                        isSelected ? "is-selected" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertOption(col.handle);
                      }}
                    >
                      <div className="ade-mention-option-left">
                        <Avatar
                          tone="human"
                          size={22}
                          initials={initials}
                          presence="online"
                        />
                        <span className="ade-mention-handle ade-mention-handle--human">
                          {col.handle}
                        </span>
                        <span className="ade-mention-sep">·</span>
                        <span className="ade-mention-name">{col.name}</span>
                      </div>
                      <div className="ade-mention-option-right">
                        <Chip type="human">{col.role}</Chip>
                        {isSelected && <kbd className="ade-mention-shortcut">↵</kbd>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="ade-mention-popup-footer">
            <span>Tab hoặc Enter để chèn · Esc để đóng</span>
          </div>
        </div>
      )}

      {/* Input Box Card (Figma 1:252 for channel / 1:341 for thread) */}
      <div className={`ade-composer-input-card ${isThread ? "ade-composer-input-card--thread" : ""}`}>
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
            const lineEstimatePx = isThread ? 42 : val.split("\n").length * 20 + 24;
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
      </div>

      {/* Toolbar */}
      {isThread ? (
        /* Thread Composer Bar (Figma 1:343): Single-line hint on left, Send button on right */
        <div className="ade-thread-composer-bar flex items-center justify-between gap-2 min-h-[32px]">
          <span className="ade-muted text-[11px] whitespace-nowrap overflow-hidden text-ellipsis flex-1">
            Enter để gửi · Shift+Enter xuống dòng
          </span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-label={resizerAriaLabel}
              data-testid={resizerTestId}
              style={{ display: "none" }}
            />
            <button
              type="button"
              data-testid={heightToggleTestId}
              className="ade-icon-btn ade-icon-btn--sm"
              style={{ display: "none" }}
              aria-label="Đổi chiều cao khung nhập"
              onClick={() => setHeightPx((h) => (h < 80 ? 120 : 42))}
            >
              <HeightToggleIcon />
            </button>
            <Button
              variant="primary"
              size="md"
              data-testid={sendBtnTestId}
              disabled={submitting}
              onClick={() => {
                void handleSend();
              }}
            >
              <Icon name="send" size={14} />
              <span>{sendLabel}</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Channel Composer Toolbar (Figma 1:254): Tools on left, Send on right */
        <div className="ade-composer-toolbar flex items-center justify-between gap-2 min-h-[32px]">
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="ade-composer-tool-btn"
              aria-label="Chèn ký tự @"
              onClick={() => {
                const next = text.endsWith(" ") || text.length === 0 ? `${text}@` : `${text} @`;
                setText(next);
                setToken(detectMentionToken(next, next.length));
                textareaRef.current?.focus();
              }}
            >
              <Icon name="mention" size={14} />
              <span>@ Mention</span>
            </button>
            <button
              type="button"
              className="ade-composer-tool-btn"
              aria-label="Chèn emoji"
              onClick={() => {
                const next = `${text} 😊 `;
                setText(next);
                textareaRef.current?.focus();
              }}
            >
              <Icon name="smile" size={14} />
              <span>Emoji</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="ade-muted hidden 2xl:inline text-[11px] whitespace-nowrap mr-1">
              <code>Enter</code> để gửi · <code>Shift+Enter</code> xuống dòng
            </span>
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-label={resizerAriaLabel}
              data-testid={resizerTestId}
              style={{ display: "none" }}
            />
            <button
              type="button"
              data-testid={heightToggleTestId}
              className="ade-icon-btn ade-icon-btn--sm"
              aria-label="Đổi chiều cao khung nhập"
              title="Co giãn chiều cao khung nhập"
              onClick={() => setHeightPx((h) => (h < 132 ? 180 : 84))}
            >
              <HeightToggleIcon />
            </button>
            <Button
              variant="primary"
              size="md"
              data-testid={sendBtnTestId}
              disabled={submitting}
              onClick={() => {
                void handleSend();
              }}
            >
              <Icon name="send" size={14} />
              <span>{sendLabel === "Gửi" ? "Gửi tin nhắn" : sendLabel}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
