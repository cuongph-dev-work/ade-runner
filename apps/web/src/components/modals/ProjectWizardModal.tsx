import React, { useState } from "react";
import {
  validateRepoApi,
  createProjectApi,
  fetchHarnessesApi
} from "../../api/settings.js";
import type { ProjectTemplateId, HarnessItem } from "@ade/shared";
import { IconButton, Icon } from "../ui/index.js";

export interface ProjectWizardModalProps {
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({
  onClose,
  onProjectCreated
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [repoPath, setRepoPath] = useState("");
  const [projectName, setProjectName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [availableBranches, setAvailableBranches] = useState<string[]>(["main"]);
  const [useRepoInstructions, setUseRepoInstructions] = useState(false);
  const [templateId, setTemplateId] = useState<ProjectTemplateId>("lead_coder_tester_qa");
  const [isValidating, setIsValidating] = useState(false);
  const [isValidRepo, setIsValidRepo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidateRepo = async () => {
    if (!repoPath.trim()) {
      setErrorMessage("Đường dẫn kho mã nguồn là bắt buộc.");
      return;
    }
    setIsValidating(true);
    setErrorMessage(null);
    try {
      const res = await validateRepoApi({ repoPath: repoPath.trim() });
      setIsValidRepo(res.valid);
      setDefaultBranch(res.currentBranch || "main");
      setAvailableBranches(res.branches.length > 0 ? res.branches : ["main"]);
      if (!projectName.trim()) {
        const parts = repoPath.trim().replace(/\/+$/, "").split("/");
        setProjectName(parts[parts.length - 1] || "My Project");
      }
    } catch (err: any) {
      setIsValidRepo(false);
      setErrorMessage(err.message || "Kho Git không hợp lệ hoặc đã tồn tại.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleStep1Next = async () => {
    if (!repoPath.trim()) {
      setErrorMessage("Đường dẫn kho mã nguồn là bắt buộc.");
      return;
    }
    if (!isValidRepo) {
      await handleValidateRepo();
      if (!isValidRepo) return;
    }
    if (!projectName.trim()) {
      setErrorMessage("Tên dự án là bắt buộc.");
      return;
    }
    setErrorMessage(null);
    setCurrentStep(2);
  };

  const handleStep2Next = async () => {
    try {
      const hRes = await fetchHarnessesApi();
      setHarnesses(hRes.harnesses);
    } catch {
      // Ignore
    }
    setCurrentStep(3);
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await createProjectApi({
        projectName: projectName.trim(),
        repoPath: repoPath.trim(),
        defaultBranch: defaultBranch.trim() || "main",
        templateId,
        useRepoInstructions
      });
      onProjectCreated(res.project.id);
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể tạo dự án.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="ade-backdrop ade-backdrop--layer-1"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-modal-title"
        data-testid="project-wizard"
        className="ade-panel ade-modal-shell ade-modal-shell--lg"
      >
        <div className="ade-modal-header">
          <div>
            <h2 id="wizard-modal-title" className="ade-head text-base font-semibold">Tạo dự án mới</h2>
            <p className="text-xs ade-muted m-0 mt-0.5">
              Đăng ký kho Git trên máy local, khởi tạo cấu hình <code>.ade/</code> và kiểm tra Harness.
            </p>
          </div>
          <IconButton
            data-testid="close-project-wizard-btn"
            variant="ghost"
            size={28}
            aria-label="Đóng"
            title="Đóng"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </IconButton>
        </div>

        {/* Stepper */}
        <div className="ade-modal-subbar">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {[
              { num: 1, label: "1. Kho mã nguồn" },
              { num: 2, label: "2. Bộ mẫu Agent" },
              { num: 3, label: "3. Kiểm tra Harness" }
            ].map(({ num, label }) => {
              const active = currentStep === num;
              const done = currentStep > num;
              return (
                <div
                  key={num}
                  className="p-2.5 rounded flex items-center justify-between"
                  style={{
                    background: active ? "var(--color-human-soft)" : "var(--color-paper-2)",
                    border: `var(--rule-hair) solid ${active ? "var(--color-human)" : "var(--color-rule)"}`
                  }}
                >
                  <strong className={active ? "" : "ade-muted"}>{label}</strong>
                  {done ? (
                    <span className="ade-chip ade-chip--ok ade-chip--xs">Đạt</span>
                  ) : active ? (
                    <span className="ade-chip ade-chip--human ade-chip--xs">Đang mở</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ade-modal-body space-y-4">
          {errorMessage && (
            <div role="alert" className="ade-panel ade-panel--bad p-2 text-xs">
              {errorMessage}
            </div>
          )}

        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium mb-1">Đường dẫn kho Git (*)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  data-testid="repo-path-input"
                  value={repoPath}
                  onChange={(e) => {
                    setRepoPath(e.target.value);
                    setIsValidRepo(false);
                  }}
                  placeholder="/Users/username/workspace/my-repo"
                  className="ade-input flex-1"
                />
                <button
                  type="button"
                  data-testid="validate-repo-btn"
                  onClick={handleValidateRepo}
                  disabled={isValidating}
                  className="ade-btn ade-btn--sm"
                >
                  {isValidating ? "Đang kiểm tra..." : "Kiểm tra kho Git"}
                </button>
              </div>
              {isValidRepo && (
                <p className="text-green-600 mt-1 font-medium">✓ Kho Git hợp lệ</p>
              )}
            </div>

            <div>
              <label className="block font-medium mb-1">Tên dự án (*)</label>
              <input
                type="text"
                data-testid="project-name-input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Tên dự án"
                className="ade-input w-full"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Nhánh mặc định</label>
              <select
                data-testid="default-branch-select"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="ade-input w-full"
              >
                {availableBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="useRepoInstructions"
                data-testid="use-repo-instructions-checkbox"
                checked={useRepoInstructions}
                onChange={(e) => setUseRepoInstructions(e.target.checked)}
              />
              <label htmlFor="useRepoInstructions" className="cursor-pointer">
                Dùng hướng dẫn của kho mã nguồn (CLAUDE.md / AGENTS.md)
              </label>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                data-testid="wizard-step1-next-btn"
                onClick={handleStep1Next}
                className="ade-btn ade-btn--primary"
              >
                Tiếp tục &gt;
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="space-y-3 text-xs">
            <label className="block font-medium">Chọn bộ mẫu khởi tạo:</label>
            <div className="space-y-2">
              <label
                className={`block p-3 rounded border cursor-pointer ${
                  templateId === "lead_coder_tester_qa" ? "border-blue-500 bg-blue-50/10" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="template"
                    value="lead_coder_tester_qa"
                    checked={templateId === "lead_coder_tester_qa"}
                    onChange={() => setTemplateId("lead_coder_tester_qa")}
                  />
                  <strong>Đội ngũ đầy đủ (Khuyên dùng)</strong>
                </div>
                <p className="ade-muted ml-5 mt-1">
                  Bao gồm 6 agent: @lead, @explorer, @planner, @coder, @tester, @qa và 8 skills chuẩn.
                </p>
              </label>

              <label
                className={`block p-3 rounded border cursor-pointer ${
                  templateId === "planner_coder" ? "border-blue-500 bg-blue-50/10" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="template"
                    value="planner_coder"
                    checked={templateId === "planner_coder"}
                    onChange={() => setTemplateId("planner_coder")}
                  />
                  <strong>Gọn nhẹ (Explorer + Planner + Coder)</strong>
                </div>
                <p className="ade-muted ml-5 mt-1">
                  Bao gồm 3 agent: @explorer, @planner, @coder và 6 skills cơ bản.
                </p>
              </label>

              <label
                className={`block p-3 rounded border cursor-pointer ${
                  templateId === "empty" ? "border-blue-500 bg-blue-50/10" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="template"
                    value="empty"
                    checked={templateId === "empty"}
                    onChange={() => setTemplateId("empty")}
                  />
                  <strong>Dự án trống</strong>
                </div>
                <p className="ade-muted ml-5 mt-1">
                  Không cấu hình sẵn agent hay skill, bạn sẽ tự thêm sau.
                </p>
              </label>
            </div>

            {/* Template preview */}
            <div
              data-testid="wizard-template-preview"
              className="ade-well p-3 rounded text-xs space-y-1"
            >
              <div className="font-semibold mb-1">Xem trước Agent sẽ được tạo:</div>
              {templateId === "lead_coder_tester_qa" && (
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>@lead (Main Agent điều phối luồng)</li>
                  <li>@explorer (Tra cứu chỉ đọc & giải thích code)</li>
                  <li>@planner (Phỏng vấn & lập kế hoạch)</li>
                  <li>@coder (Lập trình viên - write worktree)</li>
                  <li>@tester (Kiểm thử tự động - write worktree)</li>
                  <li>@qa (Đảm bảo chất lượng & review)</li>
                </ul>
              )}
              {templateId === "planner_coder" && (
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>@explorer (Tra cứu chỉ đọc & giải thích code)</li>
                  <li>@planner (Phỏng vấn & lập kế hoạch)</li>
                  <li>@coder (Lập trình viên - write worktree)</li>
                </ul>
              )}
              {templateId === "empty" && (
                <div className="ade-muted">(Chưa có agent nào)</div>
              )}
            </div>

            <div className="flex justify-between pt-3">
              <button
                type="button"
                data-testid="wizard-step2-back-btn"
                onClick={() => setCurrentStep(1)}
                className="ade-btn"
              >
                &lt; Quay lại
              </button>
              <button
                type="button"
                data-testid="wizard-step2-next-btn"
                onClick={handleStep2Next}
                className="ade-btn ade-btn--primary"
              >
                Tiếp tục &gt;
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <div className="space-y-3 text-xs">
            <h3 className="font-semibold">Trạng thái Harness trên máy:</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-muted/10 border-b">
                  <tr>
                    <th className="p-2">Harness</th>
                    <th className="p-2">Trạng thái</th>
                    <th className="p-2">Phiên bản</th>
                    <th className="p-2">Hồ sơ</th>
                  </tr>
                </thead>
                <tbody>
                  {harnesses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center ade-muted">
                        Claude Code & Codex ACP đã sẵn sàng
                      </td>
                    </tr>
                  ) : (
                    harnesses.map((h) => (
                      <tr key={h.id} className="border-b">
                        <td className="p-2 font-medium">{h.displayName}</td>
                        <td className="p-2">
                          {h.detected ? (
                            <span className="text-green-600">✓ Sẵn sàng</span>
                          ) : (
                            <span className="ade-muted">Chưa cài đặt</span>
                          )}
                        </td>
                        <td className="p-2 font-mono">{h.version ?? "1.0.0"}</td>
                        <td className="p-2 font-mono">
                          {h.profiles.map((p) => p.name).join(", ")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-3">
              <button
                type="button"
                data-testid="wizard-step3-back-btn"
                onClick={() => setCurrentStep(2)}
                className="ade-btn"
              >
                &lt; Quay lại
              </button>
              <button
                type="button"
                data-testid="wizard-submit-btn"
                disabled={isSubmitting}
                onClick={handleFinish}
                className="ade-btn ade-btn--primary"
              >
                {isSubmitting ? "Đang tạo..." : "Hoàn tất tạo dự án"}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
