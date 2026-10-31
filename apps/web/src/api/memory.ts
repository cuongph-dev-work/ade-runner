import {
  type MemoryFile,
  type MemoryFileListResponse,
  type MemoryProposal,
  type MemoryProposalListResponse,
  type WorkflowDetailResponse
} from "@ade/shared";
import { ChatApiError } from "./chat.js";

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  expectedStatus: number | number[] = 200
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });

  const validStatuses = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];
  if (!validStatuses.includes(res.status)) {
    let code = `HTTP_${res.status}`;
    let message = "Yêu cầu thất bại.";
    let fieldErrors = {};
    try {
      const errJson = await res.json();
      if (errJson && typeof errJson === "object") {
        code = errJson.code ?? code;
        message = errJson.message ?? message;
        fieldErrors = errJson.details?.fieldErrors ?? {};
      }
    } catch {
      // Ignore
    }
    throw new ChatApiError(res.status, code, message, fieldErrors);
  }

  return (await res.json()) as T;
}

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
