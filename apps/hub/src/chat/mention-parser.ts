export interface EnabledAgentCandidate {
  id: string;
  handle: string;
  enabled: boolean;
}

export interface HumanColleagueCandidate {
  id: string;
  handle: string;
}

export interface MentionParseResult {
  validMentions: Array<{ handle: string; agentId: string }>;
  humanMentions: string[];
  unknownMentions: string[];
}

function stripCodeZones(markdown: string): string {
  const withoutFenced = markdown.replace(/```[\s\S]*?```/g, " ");
  return withoutFenced.replace(/`[^`\n]*`/g, " ");
}

export function extractRawMentionHandles(body: string): string[] {
  const cleaned = stripCodeZones(body);
  const regex = /(?:^|(?<=[\s([{"']))@([a-z0-9][a-z0-9-_]*)/gi;
  const seen = new Set<string>();
  const handles: string[] = [];

  for (const match of cleaned.matchAll(regex)) {
    const normalized = `@${(match[1] ?? "").toLowerCase()}`;
    if (normalized.length > 1 && !seen.has(normalized)) {
      seen.add(normalized);
      handles.push(normalized);
    }
  }

  return handles;
}

export function resolveMentions(
  body: string,
  agents: EnabledAgentCandidate[],
  colleagues: HumanColleagueCandidate[]
): MentionParseResult {
  const rawHandles = extractRawMentionHandles(body);
  const enabledAgentByHandle = new Map<string, EnabledAgentCandidate>();
  for (const ag of agents) {
    const key = ag.handle.startsWith("@") ? ag.handle.toLowerCase() : `@${ag.handle.toLowerCase()}`;
    if (ag.enabled) {
      enabledAgentByHandle.set(key, { ...ag, handle: key });
    }
  }

  const humanHandleSet = new Set<string>();
  for (const col of colleagues) {
    const key = col.handle.startsWith("@")
      ? col.handle.toLowerCase()
      : `@${col.handle.toLowerCase()}`;
    humanHandleSet.add(key);
  }

  const validMentions: Array<{ handle: string; agentId: string }> = [];
  const humanMentions: string[] = [];
  const unknownMentions: string[] = [];

  for (const handle of rawHandles) {
    const foundAgent = enabledAgentByHandle.get(handle);
    if (foundAgent) {
      validMentions.push({ handle: foundAgent.handle, agentId: foundAgent.id });
      continue;
    }

    if (humanHandleSet.has(handle)) {
      humanMentions.push(handle);
      continue;
    }

    unknownMentions.push(handle);
  }

  return {
    validMentions,
    humanMentions,
    unknownMentions
  };
}
