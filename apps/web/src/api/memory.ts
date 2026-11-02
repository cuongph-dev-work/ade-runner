import {
  type MemoryFile,
  type MemoryFileListResponse,
  type MemoryProposal,
  type MemoryProposalListResponse,
  type WorkflowDetailResponse
} from "@ade/shared";
import { requestJson } from "./client.js";

export async function fetchMemoryFilesApi(projectId: string): Promise<MemoryFileListResponse> {
  return requestJson<MemoryFileListResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/memory`,
    { method: "GET" },
    200
  );
}

export async function fetchMemoryFileApi(projectId: string, fileName: string): Promise<MemoryFile> {
  return requestJson<MemoryFile>(
    `/api/projects/${encodeURIComponent(projectId)}/memory/${encodeURIComponent(fileName)}`,
    { method: "GET" },
    200
  );
}

export async function saveMemoryFileApi(
  projectId: string,
  fileName: string,
  content: string
): Promise<MemoryFile> {
  return requestJson<MemoryFile>(
    `/api/projects/${encodeURIComponent(projectId)}/memory/${encodeURIComponent(fileName)}`,
    {
      method: "PUT",
      body: JSON.stringify({ content })
    },
    200
  );
}

export async function fetchMemoryProposalsApi(
  projectId: string,
  status?: string
): Promise<MemoryProposalListResponse> {
  const url = status
    ? `/api/projects/${encodeURIComponent(projectId)}/memory-proposals?status=${encodeURIComponent(status)}`
    : `/api/projects/${encodeURIComponent(projectId)}/memory-proposals`;
  return requestJson<MemoryProposalListResponse>(url, { method: "GET" }, 200);
}

export async function decideMemoryProposalApi(
  proposalId: string,
  decision: "approve" | "reject"
): Promise<MemoryProposal> {
  return requestJson<MemoryProposal>(
    `/api/memory-proposals/${encodeURIComponent(proposalId)}/decide`,
    {
      method: "POST",
      body: JSON.stringify({ decision })
    },
    200
  );
}

export async function fetchWorkflowDetailApi(
  projectId: string,
  workflowId: string
): Promise<WorkflowDetailResponse> {
  return requestJson<WorkflowDetailResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/workflows/${encodeURIComponent(workflowId)}`,
    { method: "GET" },
    200
  );
}

export async function saveWorkflowYamlApi(
  projectId: string,
  workflowId: string,
  workflowYaml: string
): Promise<WorkflowDetailResponse> {
  return requestJson<WorkflowDetailResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/workflows/${encodeURIComponent(workflowId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ workflowYaml })
    },
    200
  );
}
