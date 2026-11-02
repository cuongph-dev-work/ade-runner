export interface FakeMcpCallParams {
  mcpUrl: string;
  mcpToken: string;
  tool: string;
  args: Record<string, unknown>;
}

export async function invokeAdeMcpTool(params: FakeMcpCallParams): Promise<unknown> {
  const response = await fetch(params.mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${params.mcpToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `call_${Date.now()}`,
      method: "tools/call",
      params: {
        name: params.tool,
        arguments: params.args,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ code: "ERR_UNKNOWN" }));
    const err = new Error(
      `MCP HTTP ${response.status}: ${(errorBody as { code?: string }).code ?? ""}`
    );
    Object.assign(err, { status: response.status, body: errorBody });
    throw err;
  }

  const payload = (await response.json()) as {
    result?: { structuredContent?: unknown; content?: Array<{ text?: string }> };
    error?: { message: string };
  };
  if (payload.error) {
    throw new Error(payload.error.message);
  }
  return payload.result?.structuredContent ?? payload.result;
}
