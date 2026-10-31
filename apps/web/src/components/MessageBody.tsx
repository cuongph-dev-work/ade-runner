import type { JSX, ReactNode } from "react";

interface MessageBodyProps {
  body: string;
  validMentions: string[];
  humanMentions: string[];
}

export function MessageBody({
  body,
  validMentions,
  humanMentions
}: MessageBodyProps): JSX.Element {
  const agentSet = new Set(validMentions.map((m) => m.toLowerCase()));
  const humanSet = new Set(humanMentions.map((m) => m.toLowerCase()));

  // Tách code inline `...` để không tô sáng mention bên trong code
  const segments = body.split(/(`[^`\n]+`)/g);
  const nodes: ReactNode[] = [];

  segments.forEach((seg, segIdx) => {
    if (seg.startsWith("`") && seg.endsWith("`") && seg.length >= 2) {
      nodes.push(<code key={`code-${segIdx}`}>{seg.slice(1, -1)}</code>);
      return;
    }

    const parts = seg.split(/(@[a-z0-9][a-z0-9-_]*)/gi);
    parts.forEach((part, partIdx) => {
      const lower = part.toLowerCase();
      if (part.startsWith("@") && agentSet.has(lower)) {
        nodes.push(
          <span
            key={`ag-${segIdx}-${partIdx}`}
            data-testid={`mention-chip-${lower.slice(1)}`}
            className="ade-mention ade-mention--agent"
          >
            {part}
          </span>
        );
      } else if (part.startsWith("@") && humanSet.has(lower)) {
        const isMe = lower === "@owner";
        nodes.push(
          <span
            key={`hm-${segIdx}-${partIdx}`}
            data-testid={`mention-chip-${lower.slice(1)}`}
            className={
              isMe
                ? "ade-mention ade-mention--human ade-mention--me"
                : "ade-mention ade-mention--human"
            }
          >
            {part}
          </span>
        );
      } else if (part.length > 0) {
        nodes.push(part);
      }
    });
  });

  return <div className="ade-msg-body">{nodes}</div>;
}
