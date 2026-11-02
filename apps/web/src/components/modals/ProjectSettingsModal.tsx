import React, { useEffect, useState } from "react";
import type {
  ProjectSettingsResponse,
  SkillItem,
  HarnessItem,
  HarnessType,
  TestAgentResult,
  MemoryFile,
  MemoryProposal
} from "@ade/shared";
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
import { GeneralTab, type AgentSummary } from "./settings/GeneralTab.js";
import { AgentsTab } from "./settings/AgentsTab.js";
import { SkillsTab } from "./settings/SkillsTab.js";
import { HarnessesTab } from "./settings/HarnessesTab.js";
import { WorkflowsTab } from "./settings/WorkflowsTab.js";
import { MemoryTab } from "./settings/MemoryTab.js";
import { IconButton, Icon } from "../ui/index.js";

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

  // General tab states
  const [projectName, setProjectName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [defaultMainAgent, setDefaultMainAgent] = useState<string | null>(null);
  const [defaultWorkflow, setDefaultWorkflow] = useState("feature");
  const [useRepoInstructions, setUseRepoInstructions] = useState(true);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Agent tab states
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentHandle, setAgentHandle] = useState("");
  const [agentDisplayName, setAgentDisplayName] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [agentHarness, setAgentHarness] = useState<HarnessType>("claude-code");
  const [agentCredProfile, setAgentCredProfile] = useState("sub-claude");
  const [agentSkills, setAgentSkills] = useState<string[]>([]);
  const [agentWrite, setAgentWrite] = useState(false);
  const [agentCanBeMain, setAgentCanBeMain] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [testResult, setTestResult] = useState<TestAgentResult | null>(null);
  const [isTestingAgent, setIsTestingAgent] = useState(false);

  // Skills tab states
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkillName, setEditingSkillName] = useState<string | null>(null);
  const [skillNameInput, setSkillNameInput] = useState("");
  const [skillContentInput, setSkillContentInput] = useState("");
  const [isSavingSkill, setIsSavingSkill] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  // Workflows tab states
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("feature");
  const [workflowYaml, setWorkflowYaml] = useState<string>("");
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  // Memory tab states
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [selectedMemoryFileName, setSelectedMemoryFileName] = useState<string | null>(null);
  const [memoryFileContent, setMemoryFileContent] = useState<string>("");
  const [memoryProposals, setMemoryProposals] = useState<MemoryProposal[]>([]);
  const [isSavingMemoryFile, setIsSavingMemoryFile] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [st, sk, hn] = await Promise.all([
        fetchProjectSettingsApi(projectId),
        fetchProjectSkillsApi(projectId),
        fetchHarnessesApi()
      ]);
      setSettings(st);
      setSkills(sk.skills);
      setHarnesses(hn.harnesses);

      setProjectName(st.project.name);
      setDefaultBranch(st.project.defaultBranch);
      setDefaultMainAgent(st.project.defaultMainAgent);
      setDefaultWorkflow(st.project.defaultWorkflow);
      setUseRepoInstructions(st.project.useRepoInstructions);

      if (st.workflows && st.workflows.length > 0) {
        setSelectedWorkflow(st.workflows[0] ?? "feature");
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không thể nạp dữ liệu cấu hình."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId]);

  useEffect(() => {
    if (activeTab === "workflows") {
      void loadWorkflowDetail(selectedWorkflow);
    } else if (activeTab === "memory") {
      void loadMemoryData();
    }
  }, [activeTab, selectedWorkflow]);

  const loadWorkflowDetail = async (wfName: string) => {
    setWorkflowError(null);
    try {
      const res = await fetchWorkflowDetailApi(projectId, wfName);
      setWorkflowYaml(res.workflowYaml);
    } catch (err: unknown) {
      setWorkflowError(err instanceof Error ? err.message : "Lỗi khi nạp workflow.");
    }
  };

  const loadMemoryData = async () => {
    setMemoryError(null);
    try {
      const [filesRes, propsRes] = await Promise.all([
        fetchMemoryFilesApi(projectId),
        fetchMemoryProposalsApi(projectId)
      ]);
      setMemoryFiles(filesRes.files);
      setMemoryProposals(propsRes.proposals);
      if (filesRes.files.length > 0 && !selectedMemoryFileName) {
        setSelectedMemoryFileName(filesRes.files[0]!.fileName);
        setMemoryFileContent(filesRes.files[0]!.content);
      }
    } catch (err: unknown) {
      setMemoryError(err instanceof Error ? err.message : "Lỗi khi nạp memory.");
    }
  };

  // General tab actions
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateProjectGeneralApi(projectId, {
        projectName,
        defaultBranch,
        defaultMainAgent: defaultMainAgent || null,
        defaultWorkflow,
        useRepoInstructions
      });
      setSettings(updated);
      setSuccessMessage("Cập nhật cài đặt chung thành công!");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi lưu cài đặt chung.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Agent tab actions
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

  const openEditAgentDrawer = (ag: AgentSummary) => {
    setEditingAgentId(ag.id);
    setAgentHandle(ag.handle);
    setAgentDisplayName(ag.displayName);
    setAgentRole(ag.role);
    setAgentHarness(ag.harness as HarnessType);
    setAgentCredProfile(ag.credentialProfile);
    setAgentSkills(ag.skills ?? []);
    setAgentWrite(ag.write);
    setAgentCanBeMain(ag.canBeMain);
    setAgentEnabled(ag.enabled);
    setIsAgentDrawerOpen(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAgent(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const agentInput = {
        handle: agentHandle,
        displayName: agentDisplayName,
        role: agentRole,
        harness: agentHarness,
        credentialProfile: agentCredProfile as "sub-claude" | "sub-chatgpt" | "api-key",
        skills: agentSkills,
        write: agentWrite,
        canBeMain: agentCanBeMain,
        enabled: agentEnabled,
        maxDepth: 3,
        timeoutS: 600,
        mcpAllow: []
      };
      if (editingAgentId) {
        await updateAgentApi(projectId, editingAgentId, agentInput);
      } else {
        await createAgentApi(projectId, agentInput);
      }
      setIsAgentDrawerOpen(false);
      setSuccessMessage("Đã lưu cấu hình Agent thành công!");
      await loadData();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi lưu Agent.");
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (ag: AgentSummary) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa agent ${ag.handle}?`)) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAgentApi(projectId, ag.id);
      setSuccessMessage(`Đã xóa agent ${ag.handle} thành công.`);
      await loadData();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi xóa Agent.");
    }
  };

  const handleTestAgent = async (ag: AgentSummary) => {
    setIsTestingAgent(true);
    setTestResult(null);
    setErrorMessage(null);
    try {
      const res = await testAgentApi(projectId, ag.id);
      setTestResult(res);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi test agent.");
    } finally {
      setIsTestingAgent(false);
    }
  };

  // Skill tab actions
  const openNewSkillModal = () => {
    setEditingSkillName(null);
    setSkillNameInput("");
    setSkillContentInput("---\nname: my-skill\ndescription: Mô tả skill\n---\n\n# Hướng dẫn");
    setSkillError(null);
    setIsSkillModalOpen(true);
  };

  const openEditSkillModal = (sk: SkillItem) => {
    setEditingSkillName(sk.name);
    setSkillNameInput(sk.name);
    const customContent = (sk as unknown as { content?: string }).content;
    setSkillContentInput(
      customContent ?? `---\nname: ${sk.name}\ndescription: ${sk.description}\n---\n\n# Nội dung skill`
    );
    setSkillError(null);
    setIsSkillModalOpen(true);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSkillError(null);

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
        await updateSkillApi(projectId, editingSkillName, { skillContent: skillContentInput });
      } else {
        await createSkillApi(projectId, { skillName: skillNameInput.trim(), skillContent: skillContentInput });
      }
      setIsSkillModalOpen(false);
      setSuccessMessage("Đã lưu skill thành công!");
      const res = await fetchProjectSkillsApi(projectId);
      setSkills(res.skills);
    } catch (err: unknown) {
      setSkillError(err instanceof Error ? err.message : "Lỗi khi lưu skill.");
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleDeleteSkill = async (sk: SkillItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa skill ${sk.name}?`)) return;
    setErrorMessage(null);
    try {
      await deleteSkillApi(projectId, sk.name);
      setSuccessMessage(`Đã xóa skill ${sk.name}.`);
      const res = await fetchProjectSkillsApi(projectId);
      setSkills(res.skills);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi xóa skill.");
    }
  };

  // Workflow tab actions
  const handleSaveWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWorkflow(true);
    setWorkflowError(null);
    try {
      await saveWorkflowYamlApi(projectId, selectedWorkflow, workflowYaml);
      setSuccessMessage("Đã lưu workflow YAML thành công!");
    } catch (err: unknown) {
      setWorkflowError(err instanceof Error ? err.message : "Lỗi khi lưu workflow.");
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  // Memory tab actions
  const handleSaveMemoryFile = async () => {
    if (!selectedMemoryFileName) return;
    setIsSavingMemoryFile(true);
    setMemoryError(null);
    try {
      await saveMemoryFileApi(projectId, selectedMemoryFileName, memoryFileContent);
      setSuccessMessage(`Đã cập nhật .ade/memory/${selectedMemoryFileName}!`);
      await loadMemoryData();
    } catch (err: unknown) {
      setMemoryError(err instanceof Error ? err.message : "Lỗi khi lưu memory file.");
    } finally {
      setIsSavingMemoryFile(false);
    }
  };

  const handleDecideMemoryProposal = async (proposalId: string, decision: "approve" | "reject") => {
    setMemoryError(null);
    try {
      await decideMemoryProposalApi(proposalId, decision);
      setSuccessMessage(
        decision === "approve"
          ? "Đã duyệt và ghi đề xuất vào memory!"
          : "Đã từ chối đề xuất."
      );
      await loadMemoryData();
    } catch (err: unknown) {
      setMemoryError(err instanceof Error ? err.message : "Lỗi khi xử lý đề xuất.");
    }
  };

  const eligibleAgents: AgentSummary[] = (settings?.agents ?? []).filter(
    (a: AgentSummary) => a.canBeMain && a.enabled
  );

  return (
    <div
      className="ade-backdrop ade-backdrop--layer-1"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="project-settings-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-project-heading"
        className="ade-panel ade-modal-shell ade-modal-shell--xl"
      >
        {/* Modal Header */}
        <div className="ade-modal-header">
          <div>
            <h2 id="settings-project-heading" className="ade-head text-base font-semibold">
              Cài đặt dự án: {projectName || settings?.project.name || "ade-runner"}
            </h2>
            <p className="text-xs ade-muted m-0 mt-0.5">
              Nguồn sự thật nằm trong thư mục <code>.ade/</code> của kho Git; SQLite chỉ lưu bộ nhớ đệm.
            </p>
          </div>
          <IconButton
            data-testid="close-project-settings-btn"
            variant="ghost"
            size={28}
            onClick={onClose}
            aria-label="Đóng cài đặt dự án"
            title="Đóng"
          >
            <Icon name="close" size={16} />
          </IconButton>
        </div>

        {/* Tab Navigation */}
        <div className="ade-modal-subbar">
          <div id="settings-tabs" className="flex items-center gap-1.5 flex-nowrap" role="tablist">
            <button
              type="button"
              className={`ade-btn ade-btn--sm ${activeTab === "general" ? "ade-btn--primary" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              Chung
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
        </div>

        <div className="ade-modal-body space-y-4">
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
            {activeTab === "general" && (
              <GeneralTab
                projectName={projectName}
                onChangeProjectName={setProjectName}
                repoPath={settings?.project.repoPath ?? ""}
                defaultBranch={defaultBranch}
                onChangeDefaultBranch={setDefaultBranch}
                branches={settings?.branches ?? ["main"]}
                defaultMainAgent={defaultMainAgent}
                onChangeDefaultMainAgent={setDefaultMainAgent}
                eligibleAgents={eligibleAgents}
                defaultWorkflow={defaultWorkflow}
                onChangeDefaultWorkflow={setDefaultWorkflow}
                workflows={settings?.workflows ?? ["feature"]}
                useRepoInstructions={useRepoInstructions}
                onChangeUseRepoInstructions={setUseRepoInstructions}
                isSavingGeneral={isSavingGeneral}
                onSaveGeneral={handleSaveGeneral}
              />
            )}

            {activeTab === "agents" && (
              <AgentsTab
                agents={settings?.agents ?? []}
                skills={skills}
                openNewAgentDrawer={openNewAgentDrawer}
                openEditAgentDrawer={openEditAgentDrawer}
                handleDeleteAgent={handleDeleteAgent}
                handleTestAgent={handleTestAgent}
                isTestingAgent={isTestingAgent}
                isAgentDrawerOpen={isAgentDrawerOpen}
                setIsAgentDrawerOpen={setIsAgentDrawerOpen}
                editingAgentId={editingAgentId}
                agentHandle={agentHandle}
                setAgentHandle={setAgentHandle}
                agentDisplayName={agentDisplayName}
                setAgentDisplayName={setAgentDisplayName}
                agentRole={agentRole}
                setAgentRole={setAgentRole}
                agentHarness={agentHarness}
                setAgentHarness={setAgentHarness}
                agentCredProfile={agentCredProfile}
                setAgentCredProfile={setAgentCredProfile}
                agentSkills={agentSkills}
                setAgentSkills={setAgentSkills}
                agentWrite={agentWrite}
                setAgentWrite={setAgentWrite}
                agentCanBeMain={agentCanBeMain}
                setAgentCanBeMain={setAgentCanBeMain}
                agentEnabled={agentEnabled}
                setAgentEnabled={setAgentEnabled}
                isSavingAgent={isSavingAgent}
                handleSaveAgent={handleSaveAgent}
                testResult={testResult}
                setTestResult={setTestResult}
              />
            )}

            {activeTab === "skills" && (
              <SkillsTab
                skills={skills}
                openNewSkillModal={openNewSkillModal}
                openEditSkillModal={openEditSkillModal}
                handleDeleteSkill={handleDeleteSkill}
                isSkillModalOpen={isSkillModalOpen}
                setIsSkillModalOpen={setIsSkillModalOpen}
                editingSkillName={editingSkillName}
                skillError={skillError}
                handleSaveSkill={handleSaveSkill}
                skillNameInput={skillNameInput}
                setSkillNameInput={setSkillNameInput}
                skillContentInput={skillContentInput}
                setSkillContentInput={setSkillContentInput}
                isSavingSkill={isSavingSkill}
              />
            )}

            {activeTab === "harnesses" && <HarnessesTab harnesses={harnesses} />}

            {activeTab === "workflows" && (
              <WorkflowsTab
                workflows={settings?.workflows ?? ["feature"]}
                selectedWorkflow={selectedWorkflow}
                onSelectWorkflow={setSelectedWorkflow}
                workflowError={workflowError}
                workflowYaml={workflowYaml}
                onChangeWorkflowYaml={setWorkflowYaml}
                isSavingWorkflow={isSavingWorkflow}
                onSaveWorkflow={handleSaveWorkflow}
              />
            )}

            {activeTab === "memory" && (
              <MemoryTab
                memoryError={memoryError}
                memoryFiles={memoryFiles}
                selectedMemoryFileName={selectedMemoryFileName}
                onSelectMemoryFile={(f) => {
                  setSelectedMemoryFileName(f.fileName);
                  setMemoryFileContent(f.content);
                }}
                memoryFileContent={memoryFileContent}
                onChangeMemoryFileContent={setMemoryFileContent}
                isSavingMemoryFile={isSavingMemoryFile}
                onSaveMemoryFile={handleSaveMemoryFile}
                memoryProposals={memoryProposals}
                onDecideMemoryProposal={handleDecideMemoryProposal}
              />
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
};
