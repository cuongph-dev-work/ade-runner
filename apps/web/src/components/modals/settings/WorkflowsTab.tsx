import React from "react";

export interface WorkflowsTabProps {
  workflows: string[];
  selectedWorkflow: string;
  onSelectWorkflow: (wf: string) => void;
  workflowError: string | null;
  workflowYaml: string;
  onChangeWorkflowYaml: (yaml: string) => void;
  isSavingWorkflow: boolean;
  onSaveWorkflow: (e: React.FormEvent) => void;
}

export const WorkflowsTab: React.FC<WorkflowsTabProps> = ({
  workflows,
  selectedWorkflow,
  onSelectWorkflow,
  workflowError,
  workflowYaml,
  onChangeWorkflowYaml,
  isSavingWorkflow,
  onSaveWorkflow
}) => {
  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="font-semibold">Chọn Workflow:</label>
          <select
            value={selectedWorkflow}
            onChange={(e) => onSelectWorkflow(e.target.value)}
            className="ade-input font-mono"
          >
            {workflows.map((wf) => (
              <option key={wf} value={wf}>
                {wf}
              </option>
            ))}
          </select>
        </div>
        <span className="ade-muted">Tệp cấu hình: .ade/workflows/{selectedWorkflow}.yaml</span>
      </div>

      {workflowError && (
        <div role="alert" className="ade-panel ade-panel--bad p-2.5 text-xs text-red-600">
          {workflowError}
        </div>
      )}

      <form onSubmit={onSaveWorkflow} className="space-y-3">
        <div>
          <label className="block font-medium mb-1">Cú pháp Workflow YAML</label>
          <textarea
            data-testid="workflow-yaml-editor"
            value={workflowYaml}
            onChange={(e) => onChangeWorkflowYaml(e.target.value)}
            rows={14}
            className="ade-input w-full font-mono text-xs whitespace-pre leading-relaxed"
            required
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            data-testid="save-workflow-btn"
            disabled={isSavingWorkflow}
            className="ade-btn ade-btn--primary"
          >
            {isSavingWorkflow ? "Đang lưu..." : "Lưu Workflow"}
          </button>
        </div>
      </form>
    </div>
  );
};
