import {
  type ValidateRepoInput,
  type ValidateRepoResponse,
  type CreateProjectWizardInput,
  type ProjectSettingsResponse,
  type UpdateProjectGeneralInput,
  type UpsertAgentInput,
  type AgentConfigResponse,
  type DeleteAgentResponse,
  type TestAgentResult,
  type SkillItem,
  type CreateSkillInput,
  type UpdateSkillInput,
  type SkillDetailResponse,
  type DeleteSkillResponse,
  type HarnessItem
} from "@ade/shared";
import { requestJson } from "./client.js";

export async function validateRepoApi(body: ValidateRepoInput): Promise<ValidateRepoResponse> {
  return requestJson<ValidateRepoResponse>("/api/projects/validate-repo", {
    method: "POST",
    body: JSON.stringify(body)
  }, 200);
}

export async function createProjectApi(body: CreateProjectWizardInput): Promise<ProjectSettingsResponse> {
  return requestJson<ProjectSettingsResponse>("/api/projects", {
    method: "POST",
    body: JSON.stringify(body)
  }, 201);
}

export async function fetchProjectSettingsApi(projectId: string): Promise<ProjectSettingsResponse> {
  return requestJson<ProjectSettingsResponse>(`/api/projects/${encodeURIComponent(projectId)}/settings`, {
    method: "GET"
  }, 200);
}

export async function updateProjectGeneralApi(
  projectId: string,
  body: UpdateProjectGeneralInput
): Promise<ProjectSettingsResponse> {
  return requestJson<ProjectSettingsResponse>(`/api/projects/${encodeURIComponent(projectId)}/general`, {
    method: "PATCH",
    body: JSON.stringify(body)
  }, 200);
}

export async function createAgentApi(
  projectId: string,
  body: UpsertAgentInput
): Promise<AgentConfigResponse> {
  return requestJson<AgentConfigResponse>(`/api/projects/${encodeURIComponent(projectId)}/agents`, {
    method: "POST",
    body: JSON.stringify(body)
  }, 201);
}

export async function updateAgentApi(
  projectId: string,
  agentId: string,
  body: UpsertAgentInput
): Promise<AgentConfigResponse> {
  return requestJson<AgentConfigResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`,
    {
      method: "PUT",
      body: JSON.stringify(body)
    },
    200
  );
}

export async function deleteAgentApi(
  projectId: string,
  agentId: string
): Promise<DeleteAgentResponse> {
  return requestJson<DeleteAgentResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`,
    {
      method: "DELETE"
    },
    200
  );
}

export async function testAgentApi(
  projectId: string,
  agentId: string
): Promise<TestAgentResult> {
  return requestJson<TestAgentResult>(
    `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/test`,
    {
      method: "POST"
    },
    200
  );
}

export async function fetchProjectSkillsApi(
  projectId: string,
  scope: "all" | "project" | "global" = "all"
): Promise<{ skills: SkillItem[] }> {
  return requestJson<{ skills: SkillItem[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/skills?scope=${scope}`,
    {
      method: "GET"
    },
    200
  );
}

export async function createSkillApi(
  projectId: string,
  body: CreateSkillInput
): Promise<SkillDetailResponse> {
  return requestJson<SkillDetailResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/skills`,
    {
      method: "POST",
      body: JSON.stringify(body)
    },
    201
  );
}

export async function updateSkillApi(
  projectId: string,
  skillName: string,
  body: UpdateSkillInput
): Promise<SkillDetailResponse> {
  return requestJson<SkillDetailResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillName)}`,
    {
      method: "PUT",
      body: JSON.stringify(body)
    },
    200
  );
}

export async function deleteSkillApi(
  projectId: string,
  skillName: string
): Promise<DeleteSkillResponse> {
  return requestJson<DeleteSkillResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillName)}`,
    {
      method: "DELETE"
    },
    200
  );
}

export async function fetchHarnessesApi(): Promise<{ harnesses: HarnessItem[] }> {
  return requestJson<{ harnesses: HarnessItem[] }>("/api/harnesses", {
    method: "GET"
  }, 200);
}
