import React, { useState } from "react";

export interface ScratchpadItem {
  threadId: string;
  agentId: string;
  agentHandle: string;
  agentDisplayName: string;
  agentAvatar?: string | null;
  content: string;
  updatedAt: string;
}

export interface ScratchpadViewProps {
  scratchpads: ScratchpadItem[];
}

export const ScratchpadView: React.FC<ScratchpadViewProps> = ({ scratchpads }) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    scratchpads[0]?.agentId ?? ""
  );

  if (scratchpads.length === 0) {
    return (
      <div data-testid="scratchpad-empty" className="p-4 text-center ade-muted text-xs">
        Chưa có sổ nháp nào được ghi trong thread này.
      </div>
    );
  }

  const activeItem =
    scratchpads.find((s) => s.agentId === selectedAgentId) ?? scratchpads[0];

  return (
    <div data-testid="scratchpad-view" className="ade-panel p-3 rounded-lg border text-sm">
      <div className="flex items-center gap-1 border-b pb-2 mb-3 overflow-x-auto">
        {scratchpads.map((item) => {
          const isActive = item.agentId === activeItem.agentId;
          return (
            <button
              key={item.agentId}
              type="button"
              data-testid={`scratchpad-tab-${item.agentHandle.replace("@", "")}`}
              onClick={() => setSelectedAgentId(item.agentId)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                isActive
                  ? "bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-400"
              }`}
            >
              {item.agentHandle}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs ade-muted mb-2">
        <span>Sổ nháp của {activeItem.agentDisplayName} ({activeItem.agentHandle})</span>
        <span className="ade-mono">{new Date(activeItem.updatedAt).toLocaleTimeString()}</span>
      </div>

      <pre
        data-testid="scratchpad-content"
        className="p-3 rounded bg-stone-50 dark:bg-stone-900 border text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono"
      >
        {activeItem.content || "(Sổ nháp trống)"}
      </pre>
    </div>
  );
};
