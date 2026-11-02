import React from "react";
import type { MemoryFile, MemoryProposal } from "@ade/shared";

export interface MemoryTabProps {
  memoryError: string | null;
  memoryFiles: MemoryFile[];
  selectedMemoryFileName: string | null;
  onSelectMemoryFile: (file: MemoryFile) => void;
  memoryFileContent: string;
  onChangeMemoryFileContent: (content: string) => void;
  isSavingMemoryFile: boolean;
  onSaveMemoryFile: () => void;
  memoryProposals: MemoryProposal[];
  onDecideMemoryProposal: (proposalId: string, decision: "approve" | "reject") => void;
}

export const MemoryTab: React.FC<MemoryTabProps> = ({
  memoryError,
  memoryFiles,
  selectedMemoryFileName,
  onSelectMemoryFile,
  memoryFileContent,
  onChangeMemoryFileContent,
  isSavingMemoryFile,
  onSaveMemoryFile,
  memoryProposals,
  onDecideMemoryProposal
}) => {
  return (
    <div className="space-y-4 text-xs">
      {memoryError && (
        <div role="alert" className="ade-panel ade-panel--bad p-2.5 text-xs text-red-600">
          {memoryError}
        </div>
      )}

      {/* Phần 1: Quản lý tệp Memory */}
      <div className="border rounded p-3 space-y-3">
        <strong className="text-sm font-bold block">Tệp ghi nhớ dự án (.ade/memory/*.md)</strong>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1 md:col-span-1 border-r pr-2">
            <span className="ade-muted text-2xs block mb-1">Danh sách tệp:</span>
            {memoryFiles.length === 0 ? (
              <div className="ade-muted py-2">Chưa có tệp memory nào.</div>
            ) : (
              memoryFiles.map((f) => (
                <button
                  key={f.fileName}
                  type="button"
                  onClick={() => onSelectMemoryFile(f)}
                  className={`w-full text-left p-1.5 rounded font-mono text-xs flex items-center justify-between ${
                    selectedMemoryFileName === f.fileName
                      ? "bg-primary/10 text-primary font-bold"
                      : "hover:bg-muted/10"
                  }`}
                >
                  <span>{f.fileName}</span>
                  <span className="text-2xs ade-muted">{f.sizeBytes}b</span>
                </button>
              ))
            )}
          </div>

          <div className="md:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Đang sửa: <code className="font-mono text-primary">{selectedMemoryFileName ?? "Chưa chọn tệp"}</code>
              </span>
              <button
                type="button"
                data-testid="save-memory-file-btn"
                disabled={!selectedMemoryFileName || isSavingMemoryFile}
                onClick={onSaveMemoryFile}
                className="ade-btn ade-btn--sm ade-btn--primary"
              >
                {isSavingMemoryFile ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
            <textarea
              data-testid="memory-content-editor"
              value={memoryFileContent}
              onChange={(e) => onChangeMemoryFileContent(e.target.value)}
              disabled={!selectedMemoryFileName}
              rows={10}
              className="ade-input w-full font-mono text-xs leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Phần 2: Đề xuất Memory từ Agent */}
      <div className="border rounded p-3 space-y-3">
        <div className="flex items-center justify-between">
          <strong className="text-sm font-bold">Đề xuất Memory từ Agent (Proposals)</strong>
          <span className="ade-chip">{memoryProposals.length} đề xuất</span>
        </div>

        {memoryProposals.length === 0 ? (
          <div className="ade-muted py-2 text-center">Chưa có đề xuất nào từ Agent.</div>
        ) : (
          <div className="space-y-2">
            {memoryProposals.map((p) => (
              <div
                key={p.id}
                data-testid="memory-proposal-row"
                className="border rounded p-2.5 space-y-1.5 bg-muted/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="ade-mention ade-mention--agent font-mono">{p.agentHandle}</span>
                    <span className="ade-muted font-mono">→ .ade/memory/{p.targetFile}</span>
                  </div>
                  <div>
                    {p.status === "pending" && <span className="ade-chip ade-chip--warn">Chờ duyệt</span>}
                    {p.status === "approved" && <span className="text-green-600 font-semibold">✓ Đã duyệt</span>}
                    {p.status === "rejected" && <span className="text-red-500 font-semibold">✕ Đã từ chối</span>}
                  </div>
                </div>
                <div className="text-xs"><strong>Lý do:</strong> {p.reason}</div>
                <pre className="bg-muted/10 p-2 rounded font-mono text-2xs overflow-auto max-h-24 whitespace-pre-wrap border">
                  {p.content}
                </pre>
                {p.status === "pending" && (
                  <div className="flex justify-end gap-2 pt-1 border-t">
                    <button
                      type="button"
                      data-testid="reject-memory-proposal-btn"
                      onClick={() => onDecideMemoryProposal(p.id, "reject")}
                      className="ade-btn ade-btn--sm ade-btn--danger"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      data-testid="approve-memory-proposal-btn"
                      onClick={() => onDecideMemoryProposal(p.id, "approve")}
                      className="ade-btn ade-btn--sm ade-btn--primary"
                    >
                      Duyệt lưu vào Memory
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
