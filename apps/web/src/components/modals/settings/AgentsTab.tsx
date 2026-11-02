import React from "react";
import type { HarnessType, SkillItem, TestAgentResult } from "@ade/shared";
import type { AgentSummary } from "./GeneralTab.js";

export interface AgentsTabProps {
  agents: AgentSummary[];
  skills: SkillItem[];
  openNewAgentDrawer: () => void;
  openEditAgentDrawer: (ag: AgentSummary) => void;
  handleDeleteAgent: (ag: AgentSummary) => void;
  handleTestAgent: (ag: AgentSummary) => void;
  isTestingAgent: boolean;
  isAgentDrawerOpen: boolean;
  setIsAgentDrawerOpen: (open: boolean) => void;
  editingAgentId: string | null;
  agentHandle: string;
  setAgentHandle: (handle: string) => void;
  agentDisplayName: string;
  setAgentDisplayName: (name: string) => void;
  agentRole: string;
  setAgentRole: (role: string) => void;
  agentHarness: HarnessType;
  setAgentHarness: (h: HarnessType) => void;
  agentCredProfile: string;
  setAgentCredProfile: (p: string) => void;
  agentSkills: string[];
  setAgentSkills: React.Dispatch<React.SetStateAction<string[]>>;
  agentWrite: boolean;
  setAgentWrite: (w: boolean) => void;
  agentCanBeMain: boolean;
  setAgentCanBeMain: (c: boolean) => void;
  agentEnabled: boolean;
  setAgentEnabled: (e: boolean) => void;
  isSavingAgent: boolean;
  handleSaveAgent: (e: React.FormEvent) => void;
  testResult: TestAgentResult | null;
  setTestResult: (r: TestAgentResult | null) => void;
}

export const AgentsTab: React.FC<AgentsTabProps> = ({
  agents,
  skills,
  openNewAgentDrawer,
  openEditAgentDrawer,
  handleDeleteAgent,
  handleTestAgent,
  isTestingAgent,
  isAgentDrawerOpen,
  setIsAgentDrawerOpen,
  editingAgentId,
  agentHandle,
  setAgentHandle,
  agentDisplayName,
  setAgentDisplayName,
  agentRole,
  setAgentRole,
  agentHarness,
  setAgentHarness,
  agentCredProfile,
  setAgentCredProfile,
  agentSkills,
  setAgentSkills,
  agentWrite,
  setAgentWrite,
  agentCanBeMain,
  setAgentCanBeMain,
  agentEnabled,
  setAgentEnabled,
  isSavingAgent,
  handleSaveAgent,
  testResult,
  setTestResult
}) => {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="ade-muted">
          Các Agent được định nghĩa trong <code>.ade/agents/*.yaml</code>
        </span>
        <button
          type="button"
          data-testid="add-agent-btn"
          onClick={openNewAgentDrawer}
          className="ade-btn ade-btn--primary ade-btn--sm"
        >
          + Thêm agent
        </button>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted/10 border-b">
            <tr>
              <th className="p-2">Handle</th>
              <th className="p-2">Tên hiển thị</th>
              <th className="p-2">Harness</th>
              <th className="p-2">Skills</th>
              <th className="p-2">Quyền</th>
              <th className="p-2 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-3 text-center ade-muted">
                  Chưa có agent nào được cấu hình
                </td>
              </tr>
            ) : (
              agents.map((ag) => (
                <tr key={ag.id} className="border-b hover:bg-muted/5">
                  <td className="p-2 font-mono font-medium">
                    <span className="ade-mention ade-mention--agent">{ag.handle}</span>
                  </td>
                  <td className="p-2">{ag.displayName}</td>
                  <td className="p-2">
                    <span className="ade-chip ade-chip--agent">{ag.harness}</span>
                  </td>
                  <td className="p-2">
                    {(ag.skills || []).map((s: string) => (
                      <span key={s} className="ade-chip ade-mono mr-1">
                        {s}
                      </span>
                    ))}
                  </td>
                  <td className="p-2">
                    {ag.write ? <span className="text-amber-600 mr-2 font-semibold">write</span> : <span className="ade-muted mr-2">read</span>}
                    {ag.canBeMain && <span className="text-blue-600 font-semibold">main</span>}
                  </td>
                  <td className="p-2 text-right space-x-1">
                    <button
                      type="button"
                      data-testid={`test-agent-btn-${ag.handle.replace("@", "")}`}
                      onClick={() => handleTestAgent(ag)}
                      disabled={isTestingAgent}
                      className="ade-btn ade-btn--sm"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      data-testid={`edit-agent-btn-${ag.handle.replace("@", "")}`}
                      onClick={() => openEditAgentDrawer(ag)}
                      className="ade-btn ade-btn--sm"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-agent-btn-${ag.handle.replace("@", "")}`}
                      onClick={() => handleDeleteAgent(ag)}
                      className="ade-btn ade-btn--sm ade-btn--danger"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Agent Form Drawer */}
      {isAgentDrawerOpen && (
        <div className="ade-modal-backdrop" style={{ zIndex: 10000 }}>
          <div className="ade-modal-shell ade-panel p-5 space-y-3" style={{ maxWidth: "560px", width: "100%" }}>
            <div className="flex items-center justify-between border-b pb-2">
              <strong className="text-sm font-bold">
                {editingAgentId ? "Sửa Agent" : "Thêm Agent mới"}
              </strong>
              <button
                type="button"
                onClick={() => setIsAgentDrawerOpen(false)}
                className="ade-icon-btn"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAgent} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-medium mb-1">Handle (*)</label>
                <input
                  type="text"
                  data-testid="agent-handle-input"
                  value={agentHandle}
                  onChange={(e) => setAgentHandle(e.target.value)}
                  placeholder="@coder"
                  className="ade-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Tên hiển thị (*)</label>
                <input
                  type="text"
                  data-testid="agent-display-name-input"
                  value={agentDisplayName}
                  onChange={(e) => setAgentDisplayName(e.target.value)}
                  placeholder="Coder"
                  className="ade-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Mô tả vai trò (System Prompt) (*)</label>
                <textarea
                  data-testid="agent-role-input"
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                  rows={3}
                  placeholder="Lập trình viên triển khai tính năng theo kế hoạch"
                  className="ade-input w-full font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium mb-1">Harness</label>
                  <select
                    data-testid="agent-harness-select"
                    value={agentHarness}
                    onChange={(e) => {
                      const h = e.target.value as "claude-code" | "codex";
                      setAgentHarness(h);
                      setAgentCredProfile(h === "codex" ? "sub-chatgpt" : "sub-claude");
                    }}
                    className="ade-input w-full"
                  >
                    <option value="claude-code">Claude Code (Agent SDK)</option>
                    <option value="codex">Codex (ACP stdio)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Hồ sơ xác thực</label>
                  <select
                    data-testid="agent-credential-select"
                    value={agentCredProfile}
                    onChange={(e) => setAgentCredProfile(e.target.value)}
                    className="ade-input w-full"
                  >
                    {agentHarness === "claude-code" ? (
                      <>
                        <option value="sub-claude">sub-claude</option>
                        <option value="api-key">api-key</option>
                      </>
                    ) : (
                      <>
                        <option value="sub-chatgpt">sub-chatgpt</option>
                        <option value="api-key">api-key</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Gắn Skills</label>
                <div className="flex flex-wrap gap-1 border p-2 rounded max-h-24 overflow-y-auto">
                  {skills.map((sk) => {
                    const isChecked = agentSkills.includes(sk.name);
                    return (
                      <button
                        type="button"
                        key={sk.name}
                        data-testid={`skill-checkbox-${sk.name}`}
                        onClick={() => {
                          setAgentSkills((prev) =>
                            isChecked ? prev.filter((s) => s !== sk.name) : [...prev, sk.name]
                          );
                        }}
                        className={`ade-chip ${isChecked ? "ade-chip--agent" : "ade-muted"}`}
                      >
                        {isChecked ? "✓ " : "+ "}
                        {sk.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="agent-write-checkbox"
                    checked={agentWrite}
                    onChange={(e) => setAgentWrite(e.target.checked)}
                  />
                  <span>Quyền ghi (write worktree)</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="agent-can-be-main-checkbox"
                    checked={agentCanBeMain}
                    onChange={(e) => setAgentCanBeMain(e.target.checked)}
                  />
                  <span>Có thể làm Main Agent</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="agent-enabled-checkbox"
                    checked={agentEnabled}
                    onChange={(e) => setAgentEnabled(e.target.checked)}
                  />
                  <span>Bật (enabled)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAgentDrawerOpen(false)}
                  className="ade-btn"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-testid="save-agent-btn"
                  disabled={isSavingAgent}
                  className="ade-btn ade-btn--primary"
                >
                  {isSavingAgent ? "Đang lưu..." : "Lưu agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Agent Modal */}
      {testResult && (
        <div className="ade-modal-backdrop" style={{ zIndex: 10001 }}>
          <div
            data-testid="test-agent-modal"
            className="ade-modal-shell ade-panel p-5 space-y-3"
            style={{ maxWidth: "500px", width: "100%" }}
          >
            <div className="flex items-center justify-between border-b pb-2">
              <strong className="text-sm font-bold">Kết quả Test Agent</strong>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="ade-icon-btn"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded bg-muted/10">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <strong>1. Khởi động Harness:</strong>
                  <p className="ade-muted">{testResult.checks.harnessBoot.detail}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded bg-muted/10">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <strong>2. Nạp danh sách Skill:</strong>
                  <p className="ade-muted">{testResult.checks.skillsLoaded.detail}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded bg-muted/10">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <strong>3. Kết nối ADE MCP:</strong>
                  <p className="ade-muted">{testResult.checks.mcpConnected.detail}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                data-testid="close-test-result-btn"
                onClick={() => setTestResult(null)}
                className="ade-btn ade-btn--primary"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
