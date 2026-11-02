import React from "react";

export interface AgentSummary {
  id: string;
  handle: string;
  displayName: string;
  avatar?: string | null;
  role: string;
  harness: string;
  credentialProfile: string;
  skills?: string[];
  write: boolean;
  canBeMain: boolean;
  enabled: boolean;
}

export interface GeneralTabProps {
  projectName: string;
  onChangeProjectName: (name: string) => void;
  repoPath: string;
  defaultBranch: string;
  onChangeDefaultBranch: (branch: string) => void;
  branches: string[];
  defaultMainAgent: string | null;
  onChangeDefaultMainAgent: (agent: string | null) => void;
  eligibleAgents: AgentSummary[];
  defaultWorkflow: string;
  onChangeDefaultWorkflow: (wf: string) => void;
  workflows: string[];
  useRepoInstructions: boolean;
  onChangeUseRepoInstructions: (val: boolean) => void;
  isSavingGeneral: boolean;
  onSaveGeneral: (e: React.FormEvent) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  projectName,
  onChangeProjectName,
  repoPath,
  defaultBranch,
  onChangeDefaultBranch,
  branches,
  defaultMainAgent,
  onChangeDefaultMainAgent,
  eligibleAgents,
  defaultWorkflow,
  onChangeDefaultWorkflow,
  workflows,
  useRepoInstructions,
  onChangeUseRepoInstructions,
  isSavingGeneral,
  onSaveGeneral
}) => {
  return (
    <form onSubmit={onSaveGeneral} className="space-y-3 text-xs max-w-xl">
      <div>
        <label className="block font-medium mb-1">Tên dự án</label>
        <input
          type="text"
          data-testid="general-project-name-input"
          value={projectName}
          onChange={(e) => onChangeProjectName(e.target.value)}
          className="ade-input w-full"
          required
        />
      </div>

      <div>
        <label className="block font-medium mb-1">Đường dẫn kho Git</label>
        <input
          type="text"
          value={repoPath}
          readOnly
          className="ade-input w-full bg-muted/20 cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block font-medium mb-1">Nhánh mặc định</label>
        <select
          value={defaultBranch}
          onChange={(e) => onChangeDefaultBranch(e.target.value)}
          className="ade-input w-full"
        >
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-medium mb-1">Main Agent mặc định</label>
        <select
          value={defaultMainAgent ?? ""}
          onChange={(e) => onChangeDefaultMainAgent(e.target.value || null)}
          className="ade-input w-full"
        >
          <option value="">Tự động theo mention đầu tiên</option>
          {eligibleAgents.map((a) => (
            <option key={a.handle} value={a.handle}>
              {a.handle} ({a.displayName})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-medium mb-1">Workflow mặc định</label>
        <select
          value={defaultWorkflow}
          onChange={(e) => onChangeDefaultWorkflow(e.target.value)}
          className="ade-input w-full"
        >
          {workflows.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="generalUseRepoInstructions"
          data-testid="general-use-repo-instructions-checkbox"
          checked={useRepoInstructions}
          onChange={(e) => onChangeUseRepoInstructions(e.target.checked)}
        />
        <label htmlFor="generalUseRepoInstructions" className="cursor-pointer">
          Dùng hướng dẫn của repo (CLAUDE.md / AGENTS.md)
        </label>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          data-testid="save-general-settings-btn"
          disabled={isSavingGeneral}
          className="ade-btn ade-btn--primary"
        >
          {isSavingGeneral ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
};
