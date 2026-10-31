import React, { useState, useEffect } from "react";
import {
  fetchProjectSettingsApi,
  updateProjectGeneralApi,
  createAgentApi,
  updateAgentApi,
  deleteAgentApi,
  testAgentApi,
  fetchProjectSkillsApi,
  createSkillApi,
  updateSkillApi,
  deleteSkillApi,
  fetchHarnessesApi
} from "../../api/settings.js";
import {
  fetchMemoryFilesApi,
  saveMemoryFileApi,
  fetchMemoryProposalsApi,
  decideMemoryProposalApi,
  fetchWorkflowDetailApi,
  saveWorkflowYamlApi
} from "../../api/memory.js";
import type {
  ProjectSettingsResponse,
  SkillItem,
  TestAgentResult,
  HarnessItem,
  MemoryFile,
  MemoryProposal
} from "@ade/shared";

export interface ProjectSettingsModalProps {
  projectId: string;
  initialTab?: "general" | "agents" | "skills" | "harnesses";
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  projectId,
  initialTab = "general",
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<
    "general" | "agents" | "skills" | "workflows" | "memory" | "harnesses"
  >(initialTab);

  const [settings, setSettings] = useState<ProjectSettingsResponse | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [harnesses, setHarnesses] = useState<HarnessItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // General tab state
  const [projectName, setProjectName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [defaultMainAgent, setDefaultMainAgent] = useState<string | null>(null);
  const [defaultWorkflow, setDefaultWorkflow] = useState("feature");
  const [useRepoInstructions, setUseRepoInstructions] = useState(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Agent form drawer state
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentHandle, setAgentHandle] = useState("");
  const [agentDisplayName, setAgentDisplayName] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [agentHarness, setAgentHarness] = useState<"claude-code" | "codex">("claude-code");
  const [agentCredProfile, setAgentCredProfile] = useState("sub-claude");
  const [agentSkills, setAgentSkills] = useState<string[]>([]);
  const [agentWrite, setAgentWrite] = useState(false);
  const [agentCanBeMain, setAgentCanBeMain] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [isSavingAgent, setIsSavingAgent] = useState(false);

  // Test agent modal state
  const [testResult, setTestResult] = useState<TestAgentResult | null>(null);
  const [isTestingAgent, setIsTestingAgent] = useState(false);

  // Skill editor modal state
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkillName, setEditingSkillName] = useState<string | null>(null);
  const [skillNameInput, setSkillNameInput] = useState("");
  const [skillContentInput, setSkillContentInput] = useState("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [isSavingSkill, setIsSavingSkill] = useState(false);

  // Workflows tab state
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("feature");
  const [workflowYaml, setWorkflowYaml] = useState<string>("");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);

  // Memory tab state
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [selectedMemoryFileName, setSelectedMemoryFileName] = useState<string | null>(null);
  const [memoryFileContent, setMemoryFileContent] = useState<string>("");
  const [memoryProposals, setMemoryProposals] = useState<MemoryProposal[]>([]);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [isSavingMemoryFile, setIsSavingMemoryFile] = useState(false);

  const loadWorkflowYaml = async (wfId: string) => {
    setWorkflowError(null);
    try {
      const res = await fetchWorkflowDetailApi(projectId, wfId);
      setWorkflowYaml(res.workflowYaml);
      if (res.parseError) {
        setWorkflowError(`Lỗi cấu trúc Workflow: ${res.parseError.message}`);
      }
    } catch (err: any) {
      setWorkflowError(err.message || "Không thể tải chi tiết Workflow.");
    }
  };

  const loadMemoryData = async () => {
    setMemoryError(null);
    try {
      const [filesRes, proposalsRes] = await Promise.all([
        fetchMemoryFilesApi(projectId),
        fetchMemoryProposalsApi(projectId)
      ]);
      setMemoryFiles(filesRes.files);
      setMemoryProposals(proposalsRes.proposals);
      if (filesRes.files.length > 0) {
        const curFile = selectedMemoryFileName
          ? filesRes.files.find((f) => f.fileName === selectedMemoryFileName) ?? filesRes.files[0]
          : filesRes.files[0];
        setSelectedMemoryFileName(curFile.fileName);
        setMemoryFileContent(curFile.content);
      }
    } catch (err: any) {
      setMemoryError(err.message || "Không thể tải dữ liệu Memory.");
    }
  };

  useEffect(() => {
    if (activeTab === "workflows") {
      void loadWorkflowYaml(selectedWorkflow);
    } else if (activeTab === "memory") {
      void loadMemoryData();
    }
  }, [activeTab, selectedWorkflow]);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const s = await fetchProjectSettingsApi(projectId);
      setSettings(s);
      setProjectName(s.project.name);
      setDefaultBranch(s.project.defaultBranch);
      setDefaultMainAgent(s.project.defaultMainAgent);
      setDefaultWorkflow(s.project.defaultWorkflow);
      setUseRepoInstructions(s.project.useRepoInstructions);

      const sk = await fetchProjectSkillsApi(projectId);
      setSkills(sk.skills);

      const h = await fetchHarnessesApi();
      setHarnesses(h.harnesses);
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể tải cài đặt dự án.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await updateProjectGeneralApi(projectId, {
        projectName: projectName.trim(),
        defaultBranch: defaultBranch.trim() || "main",
        defaultMainAgent,
        defaultWorkflow: defaultWorkflow.trim() || "feature",
        useRepoInstructions
      });
      setSettings(res);
      setSuccessMessage("Đã lưu cấu hình chung thành công!");
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi lưu cấu hình chung.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const openNewAgentDrawer = () => {
    setEditingAgentId(null);
    setAgentHandle("");
    setAgentDisplayName("");
    setAgentRole("");
    setAgentHarness("claude-code");
    setAgentCredProfile("sub-claude");
    setAgentSkills([]);
    setAgentWrite(false);
    setAgentCanBeMain(false);
    setAgentEnabled(true);
    setIsAgentDrawerOpen(true);
  };

  const openEditAgentDrawer = (ag: any) => {
    setEditingAgentId(ag.id);
    setAgentHandle(ag.handle);
    setAgentDisplayName(ag.displayName);
    setAgentRole(ag.role);
    setAgentHarness(ag.harness);
    setAgentCredProfile(ag.credentialProfile);
    setAgentSkills(ag.skills || []);
    setAgentWrite(Boolean(ag.write));
    setAgentCanBeMain(Boolean(ag.canBeMain));
    setAgentEnabled(Boolean(ag.enabled));
    setIsAgentDrawerOpen(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAgent(true);
    setErrorMessage(null);
    try {
      const payload = {
        handle: agentHandle.trim().startsWith("@") ? agentHandle.trim() : `@${agentHandle.trim()}`,
        displayName: agentDisplayName.trim(),
        role: agentRole.trim(),
        harness: agentHarness,
        credentialProfile: agentCredProfile as any,
        skills: agentSkills,
        write: agentWrite,
        canBeMain: agentCanBeMain,
        enabled: agentEnabled,
        maxDepth: 3,
        timeoutS: 600,
        mcpAllow: []
      };

      if (editingAgentId) {
        await updateAgentApi(projectId, editingAgentId, payload);
      } else {
        await createAgentApi(projectId, payload);
      }
      setIsAgentDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi lưu agent.");
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (ag: any) => {
    if (!window.confirm(`Bạn có chắc muốn xóa agent ${ag.handle}?`)) return;
    try {
      await deleteAgentApi(projectId, ag.id);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi xóa agent.");
    }
  };

  const handleTestAgent = async (ag: any) => {
    setIsTestingAgent(true);
    try {
      const res = await testAgentApi(projectId, ag.id);
      setTestResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi chạy Test agent.");
    } finally {
      setIsTestingAgent(false);
    }
  };

  const openNewSkillModal = () => {
    setEditingSkillName(null);
    setSkillNameInput("");
    setSkillContentInput(
      "---\nname: my-skill\ndescription: Mô tả skill\n---\n\n# Skill\nNội dung hướng dẫn.\n"
    );
    setSkillError(null);
    setIsSkillModalOpen(true);
  };

  const openEditSkillModal = (sk: SkillItem) => {
    setEditingSkillName(sk.name);
    setSkillNameInput(sk.name);
    setSkillContentInput(
      `---\nname: ${sk.name}\ndescription: ${sk.description}\n---\n\n# Skill: ${sk.name}\n`
    );
    setSkillError(null);
    setIsSkillModalOpen(true);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSkillError(null);

    // Validate name: no spaces, only a-z0-9 and hyphens
    if (!editingSkillName) {
      const name = skillNameInput.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        setSkillError(
          "Tên skill chỉ được gồm chữ thường, số và dấu gạch ngang (không chứa khoảng trắng, dấu ngoặc, dấu phẩy)."
        );
        return;
      }
    }

    setIsSavingSkill(true);
    try {
      if (editingSkillName) {
        await updateSkillApi(projectId, editingSkillName, {
          skillContent: skillContentInput
        });
      } else {
        await createSkillApi(projectId, {
          skillName: skillNameInput.trim(),
          skillContent: skillContentInput
        });
      }
      setIsSkillModalOpen(false);
      await loadData();
    } catch (err: any) {
      setSkillError(err.message || "Lỗi khi lưu skill.");
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleDeleteSkill = async (sk: SkillItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa skill ${sk.name}?`)) return;
    try {
      await deleteSkillApi(projectId, sk.name);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi xóa skill.");
    }
  };

  const handleSaveWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkflowError(null);
    setIsSavingWorkflow(true);
    setSuccessMessage(null);
    try {
      await saveWorkflowYamlApi(projectId, selectedWorkflow, workflowYaml);
      setSuccessMessage("Đã lưu workflow thành công.");
      await loadWorkflowYaml(selectedWorkflow);
    } catch (err: any) {
      setWorkflowError(err.message || "Lỗi khi lưu workflow.");
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const handleSaveMemoryFile = async () => {
    if (!selectedMemoryFileName) return;
    setMemoryError(null);
    setIsSavingMemoryFile(true);
    setSuccessMessage(null);
    try {
      await saveMemoryFileApi(projectId, selectedMemoryFileName, memoryFileContent);
      setSuccessMessage(`Đã lưu tệp .ade/memory/${selectedMemoryFileName} thành công.`);
      await loadMemoryData();
    } catch (err: any) {
      setMemoryError(err.message || "Lỗi khi lưu tệp memory.");
    } finally {
      setIsSavingMemoryFile(false);
    }
  };

  const handleDecideMemoryProposal = async (proposalId: string, decision: "approve" | "reject") => {
    setMemoryError(null);
    setSuccessMessage(null);
    try {
      await decideMemoryProposalApi(proposalId, decision);
      setSuccessMessage(`Đã ${decision === "approve" ? "duyệt" : "từ chối"} đề xuất thành công.`);
      await loadMemoryData();
    } catch (err: any) {
      setMemoryError(err.message || "Lỗi khi xử lý đề xuất.");
    }
  };

  return (
    <div className="ade-modal-backdrop" style={{ zIndex: 9999 }}>
      <div
        role="dialog"
        aria-modal="true"
        data-testid="project-settings-page"
        className="ade-modal-shell ade-panel p-6 space-y-4"
        style={{ maxWidth: "1040px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <h2 className="ade-head text-base font-bold">
              Cài đặt dự án — {settings?.project.name ?? "..."}
            </h2>
          </div>
          <button
            type="button"
            data-testid="close-project-settings-btn"
            aria-label="Đóng"
            onClick={onClose}
            className="ade-icon-btn"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b pb-2 text-xs">
          <button
            type="button"
            className={`ade-btn ade-btn--sm ${activeTab === "general" ? "ade-btn--primary" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            Chung (General)
          </button>
          <button
            type="button"
            data-testid="tab-agents-btn"
            className={`ade-btn ade-btn--sm ${activeTab === "agents" ? "ade-btn--primary" : ""}`}
            onClick={() => setActiveTab("agents")}
          >
            Agents ({settings?.agents.length ?? 0})
          </button>
          <button
            type="button"
            data-testid="tab-skills-btn"
            className={`ade-btn ade-btn--sm ${activeTab === "skills" ? "ade-btn--primary" : ""}`}
            onClick={() => setActiveTab("skills")}
          >
            Skills ({skills.length})
          </button>
          <button
            type="button"
            data-testid="tab-harnesses-btn"
            className={`ade-btn ade-btn--sm ${activeTab === "harnesses" ? "ade-btn--primary" : ""}`}
            onClick={() => setActiveTab("harnesses")}
          >
            Harnesses
          </button>
          <button
            type="button"
            data-testid="tab-workflows-btn"
            className={`ade-btn ade-btn--sm ${activeTab === "workflows" ? "ade-btn--primary" : ""}`}
            onClick={() => setActiveTab("workflows")}
          >
            Workflows
          </button>
          <button
            type="button"
            data-testid="tab-memory-btn"
            className={`ade-btn ade-btn--sm ${activeTab === "memory" ? "ade-btn--primary" : ""}`}
            onClick={() => setActiveTab("memory")}
          >
            Memory
          </button>
        </div>

        {errorMessage && (
          <div role="alert" className="ade-panel ade-panel--bad p-2 text-xs">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div role="status" className="ade-panel ade-panel--ok p-2 text-xs text-green-700">
            {successMessage}
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center ade-muted text-xs">Đang tải dữ liệu cấu hình...</div>
        ) : (
          <>
            {/* TAB: GENERAL */}
            {activeTab === "general" && (
              <form onSubmit={handleSaveGeneral} className="space-y-3 text-xs max-w-xl">
                <div>
                  <label className="block font-medium mb-1">Tên dự án</label>
                  <input
                    type="text"
                    data-testid="general-project-name-input"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="ade-input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Đường dẫn kho Git</label>
                  <input
                    type="text"
                    value={settings?.project.repoPath ?? ""}
                    readOnly
                    className="ade-input w-full bg-muted/20 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Nhánh mặc định</label>
                  <select
                    value={defaultBranch}
                    onChange={(e) => setDefaultBranch(e.target.value)}
                    className="ade-input w-full"
                  >
                    {(settings?.branches ?? ["main"]).map((b) => (
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
                    onChange={(e) => setDefaultMainAgent(e.target.value || null)}
                    className="ade-input w-full"
                  >
                    <option value="">Tự động theo mention đầu tiên</option>
                    {(settings?.agents ?? [])
                      .filter((a) => a.canBeMain && a.enabled)
                      .map((a) => (
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
                    onChange={(e) => setDefaultWorkflow(e.target.value)}
                    className="ade-input w-full"
                  >
                    {(settings?.workflows ?? ["feature"]).map((w) => (
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
                    onChange={(e) => setUseRepoInstructions(e.target.checked)}
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
            )}

            {/* TAB: AGENTS */}
            {activeTab === "agents" && (
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
                      {(settings?.agents ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-3 text-center ade-muted">
                            Chưa có agent nào được cấu hình
                          </td>
                        </tr>
                      ) : (
                        settings!.agents.map((ag) => (
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
            )}

            {/* TAB: SKILLS */}
            {activeTab === "skills" && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="ade-muted">
                    Các Skill được nạp từ <code>.ade/skills/</code> (dự án) và <code>~/.ade/skills/</code> (toàn cục)
                  </span>
                  <button
                    type="button"
                    data-testid="create-skill-btn"
                    onClick={openNewSkillModal}
                    className="ade-btn ade-btn--primary ade-btn--sm"
                  >
                    + Tạo skill mới
                  </button>
                </div>

                <div className="border rounded overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-muted/10 border-b">
                      <tr>
                        <th className="p-2">Tên Skill</th>
                        <th className="p-2">Phạm vi</th>
                        <th className="p-2">Mô tả</th>
                        <th className="p-2">Script</th>
                        <th className="p-2 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skills.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-3 text-center ade-muted">
                            Chưa có skill nào
                          </td>
                        </tr>
                      ) : (
                        skills.map((sk) => (
                          <tr key={sk.name} className="border-b hover:bg-muted/5">
                            <td className="p-2 font-mono font-medium">{sk.name}</td>
                            <td className="p-2">
                              <span className={sk.scope === "project" ? "ade-chip ade-chip--agent" : "ade-chip"}>
                                {sk.scope}
                              </span>
                            </td>
                            <td className="p-2">{sk.description}</td>
                            <td className="p-2">
                              {sk.hasShellScript ? <span className="text-amber-600 font-semibold">có shell</span> : <span className="ade-muted">không</span>}
                            </td>
                            <td className="p-2 text-right space-x-1">
                              {sk.scope === "project" && (
                                <>
                                  <button
                                    type="button"
                                    data-testid={`edit-skill-btn-${sk.name}`}
                                    onClick={() => openEditSkillModal(sk)}
                                    className="ade-btn ade-btn--sm"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`delete-skill-btn-${sk.name}`}
                                    onClick={() => handleDeleteSkill(sk)}
                                    className="ade-btn ade-btn--sm ade-btn--danger"
                                  >
                                    Xóa
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Skill Modal */}
                {isSkillModalOpen && (
                  <div className="ade-modal-backdrop" style={{ zIndex: 10000 }}>
                    <div className="ade-modal-shell ade-panel p-5 space-y-3" style={{ maxWidth: "600px", width: "100%" }}>
                      <div className="flex items-center justify-between border-b pb-2">
                        <strong className="text-sm font-bold">
                          {editingSkillName ? `Sửa Skill: ${editingSkillName}` : "Tạo Skill mới"}
                        </strong>
                        <button
                          type="button"
                          onClick={() => setIsSkillModalOpen(false)}
                          className="ade-icon-btn"
                          aria-label="Đóng"
                        >
                          ✕
                        </button>
                      </div>

                      {skillError && (
                        <div
                          role="alert"
                          data-testid="skill-error"
                          className="ade-panel ade-panel--bad p-2 text-xs"
                        >
                          {skillError}
                        </div>
                      )}

                      <form onSubmit={handleSaveSkill} className="space-y-2.5 text-xs">
                        <div>
                          <label className="block font-medium mb-1">Tên Skill (*)</label>
                          <input
                            type="text"
                            data-testid="skill-name-input"
                            value={skillNameInput}
                            disabled={Boolean(editingSkillName)}
                            onChange={(e) => setSkillNameInput(e.target.value)}
                            placeholder="my-skill"
                            className={`ade-input w-full ${editingSkillName ? "bg-muted/20 cursor-not-allowed" : ""}`}
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-medium mb-1">Nội dung SKILL.md (*)</label>
                          <textarea
                            data-testid="skill-content-input"
                            value={skillContentInput}
                            onChange={(e) => setSkillContentInput(e.target.value)}
                            rows={8}
                            className="ade-input w-full font-mono text-xs"
                            required
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <button
                            type="button"
                            onClick={() => setIsSkillModalOpen(false)}
                            className="ade-btn"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            data-testid="save-skill-btn"
                            disabled={isSavingSkill}
                            className="ade-btn ade-btn--primary"
                          >
                            {isSavingSkill ? "Đang lưu..." : "Lưu skill"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: HARNESSES */}
            {activeTab === "harnesses" && (
              <div className="space-y-3 text-xs">
                <span className="ade-muted">Harness và hồ sơ đăng nhập phát hiện trên máy local:</span>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-muted/10 border-b">
                      <tr>
                        <th className="p-2">Harness</th>
                        <th className="p-2">Trạng thái</th>
                        <th className="p-2">Phiên bản</th>
                        <th className="p-2">Hồ sơ</th>
                        <th className="p-2">Thư mục cấu hình</th>
                      </tr>
                    </thead>
                    <tbody>
                      {harnesses.map((h) => (
                        <tr key={h.id} className="border-b">
                          <td className="p-2 font-medium">{h.displayName}</td>
                          <td className="p-2">
                            {h.detected ? (
                              <span className="text-green-600 font-semibold">✓ Đã phát hiện</span>
                            ) : (
                              <span className="ade-muted">Chưa phát hiện</span>
                            )}
                          </td>
                          <td className="p-2 font-mono">{h.version ?? "1.0.0"}</td>
                          <td className="p-2 font-mono">
                            {h.profiles.map((p) => p.name).join(", ")}
                          </td>
                          <td className="p-2 font-mono text-xs ade-muted">{h.configDir}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: WORKFLOWS */}
            {activeTab === "workflows" && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold">Chọn Workflow:</label>
                    <select
                      value={selectedWorkflow}
                      onChange={(e) => setSelectedWorkflow(e.target.value)}
                      className="ade-input font-mono"
                    >
                      {(settings?.workflows ?? ["feature"]).map((wf) => (
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

                <form onSubmit={handleSaveWorkflow} className="space-y-3">
                  <div>
                    <label className="block font-medium mb-1">Cú pháp Workflow YAML</label>
                    <textarea
                      data-testid="workflow-yaml-editor"
                      value={workflowYaml}
                      onChange={(e) => setWorkflowYaml(e.target.value)}
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
            )}

            {/* TAB: MEMORY */}
            {activeTab === "memory" && (
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
                            onClick={() => {
                              setSelectedMemoryFileName(f.fileName);
                              setMemoryFileContent(f.content);
                            }}
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
                          onClick={handleSaveMemoryFile}
                          className="ade-btn ade-btn--sm ade-btn--primary"
                        >
                          {isSavingMemoryFile ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                      </div>
                      <textarea
                        data-testid="memory-content-editor"
                        value={memoryFileContent}
                        onChange={(e) => setMemoryFileContent(e.target.value)}
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
                                onClick={() => handleDecideMemoryProposal(p.id, "reject")}
                                className="ade-btn ade-btn--sm ade-btn--danger"
                              >
                                Từ chối
                              </button>
                              <button
                                type="button"
                                data-testid="approve-memory-proposal-btn"
                                onClick={() => handleDecideMemoryProposal(p.id, "approve")}
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
            )}
          </>
        )}
      </div>
    </div>
  );
};
