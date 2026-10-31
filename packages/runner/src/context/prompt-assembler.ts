export interface MemoryFileEntry {
  fileName: string;
  content: string;
}

export interface ThreadContextEntry {
  title: string;
  state: string;
  summary?: string | null;
}

export interface MessageContextEntry {
  createdAt: string;
  author: string;
  body: string;
}

export interface SkillContextEntry {
  fullSkillMd?: string | null;
  agentSkills?: Array<{ name: string; description: string }>;
}

export interface AssemblePromptOptions {
  projectMemoryFiles?: MemoryFileEntry[];
  thread: ThreadContextEntry;
  recentMessages?: MessageContextEntry[];
  scope?: "brief" | "full";
  skill?: SkillContextEntry;
  task: string;
  maxTokens?: number;
}

export const TOOLS_HINT_TEXT =
  "Dùng ade.post_progress để báo tiến độ, ade.ask_human để đặt câu hỏi cho người dùng, ade.read_memory và ade.get_thread để đọc thêm ngữ cảnh, và bắt buộc gọi ade.report_outcome trước khi kết thúc run.";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function assemblePrompt(options: AssemblePromptOptions): string {
  const maxTokens = options.maxTokens ?? 8000;

  // Khối 2: <thread> (Bất biến 100%)
  const summaryText =
    options.thread.summary && options.thread.summary.trim().length > 0
      ? options.thread.summary.trim()
      : "(chưa có tóm tắt)";
  const threadBlock = `<thread>\nTitle: ${options.thread.title}\nState: ${options.thread.state}\nSummary:\n${summaryText}\n</thread>`;

  // Khối 4: <skill> (Bất biến 100%)
  let skillContent = "(không chỉ định skill riêng)";
  if (options.skill?.fullSkillMd && options.skill.fullSkillMd.trim().length > 0) {
    skillContent = options.skill.fullSkillMd.trim();
  } else if (options.skill?.agentSkills && options.skill.agentSkills.length > 0) {
    skillContent = options.skill.agentSkills
      .map((s) => `${s.name}: ${s.description}`)
      .join("\n");
  }
  const skillBlock = `<skill>\n${skillContent}\n</skill>`;

  // Khối 5: <task> (Bất biến 100%)
  const taskBlock = `<task>\n${options.task.trim()}\n</task>`;

  // Khối 6: <tools_hint> (Bất biến 100%)
  const toolsHintBlock = `<tools_hint>\n${TOOLS_HINT_TEXT}\n</tools_hint>`;

  // Hàm render <recent_messages>
  const isBrief = options.scope === "brief";
  const activeMessages: MessageContextEntry[] = isBrief
    ? []
    : [...(options.recentMessages ?? []).slice(-10)];

  const renderRecentMessages = (msgs: MessageContextEntry[], prunedAll = false): string => {
    if (isBrief) {
      return "<recent_messages>\n(chế độ brief — dùng ade.get_thread nếu được cấp full)\n</recent_messages>";
    }
    if (prunedAll) {
      return "<recent_messages>\n[đã lược bớt tin nhắn cũ — dùng ade.get_thread để đọc đầy đủ]\n</recent_messages>";
    }
    if (msgs.length === 0) {
      return "<recent_messages>\n(không có tin nhắn gần đây)\n</recent_messages>";
    }
    const lines = msgs.map((m) => `[${m.createdAt}] ${m.author}: ${m.body}`);
    return `<recent_messages>\n${lines.join("\n")}\n</recent_messages>`;
  };

  // Hàm render <project_memory>
  const memoryFiles = [...(options.projectMemoryFiles ?? [])].sort((a, b) =>
    a.fileName.localeCompare(b.fileName, "en")
  );

  const renderProjectMemory = (files: MemoryFileEntry[]): string => {
    if (files.length === 0) {
      return "<project_memory>\n(trống)\n</project_memory>";
    }
    const parts = files.map((f) => `### ${f.fileName}\n${f.content}`);
    return `<project_memory>\n${parts.join("\n\n")}\n</project_memory>`;
  };

  // Kiểm tra ban đầu với full prompt
  let memBlock = renderProjectMemory(memoryFiles);
  let msgBlock = renderRecentMessages(activeMessages);

  const buildCandidate = (mem: string, msg: string) =>
    `${mem}\n\n${threadBlock}\n\n${msg}\n\n${skillBlock}\n\n${taskBlock}\n\n${toolsHintBlock}`;

  let candidate = buildCandidate(memBlock, msgBlock);
  if (estimateTokens(candidate) <= maxTokens) {
    return candidate;
  }

  // Bước 1 — Lược bớt <recent_messages> từ tin cũ nhất
  if (!isBrief) {
    while (activeMessages.length > 0 && estimateTokens(candidate) > maxTokens) {
      activeMessages.shift(); // Loại bỏ tin cũ nhất
      msgBlock = renderRecentMessages(activeMessages, activeMessages.length === 0);
      candidate = buildCandidate(memBlock, msgBlock);
    }

    if (activeMessages.length === 0) {
      msgBlock = renderRecentMessages([], true);
      candidate = buildCandidate(memBlock, msgBlock);
    }

    if (estimateTokens(candidate) <= maxTokens) {
      return candidate;
    }
  }

  // Bước 2 — Cắt đuôi từng tệp trong <project_memory>
  const otherFiveBlocks = `\n\n${threadBlock}\n\n${msgBlock}\n\n${skillBlock}\n\n${taskBlock}\n\n${toolsHintBlock}`;
  const wrapperOverhead = "<project_memory>\n".length + "\n</project_memory>".length;
  const budgetChars = Math.max(
    0,
    maxTokens * 4 - otherFiveBlocks.length - wrapperOverhead
  );

  const prunedSuffix = "\n[đã cắt bớt — dùng ade.read_memory để đọc đầy đủ]";
  let remainingChars = budgetChars;
  const prunedFilesParts: string[] = [];
  let isPruningTailFiles = false;

  for (let i = 0; i < memoryFiles.length; i++) {
    const f = memoryFiles[i];
    const header = `### ${f.fileName}\n`;
    if (isPruningTailFiles) {
      prunedFilesParts.push(`### ${f.fileName}\n[đã cắt bớt — dùng ade.read_memory để đọc đầy đủ]`);
      continue;
    }

    const fullFileStr = `${header}${f.content}`;
    const sepLen = prunedFilesParts.length > 0 ? 2 : 0; // "\n\n"

    // Tính dự trù dung lượng cho các tệp kế tiếp nếu tệp này bị cắt
    let tailOverhead = 0;
    for (let j = i + 1; j < memoryFiles.length; j++) {
      tailOverhead += 2 + `### ${memoryFiles[j].fileName}\n`.length + prunedSuffix.length;
    }

    if (fullFileStr.length + sepLen + tailOverhead <= remainingChars) {
      prunedFilesParts.push(fullFileStr);
      remainingChars -= fullFileStr.length + sepLen;
    } else {
      // Tệp đầu tiên vượt trần
      isPruningTailFiles = true;
      const availableForThis = Math.max(0, remainingChars - sepLen - tailOverhead);
      const minRequired = header.length + prunedSuffix.length;
      if (availableForThis <= minRequired) {
        prunedFilesParts.push(
          `### ${f.fileName}\n[đã cắt bớt — dùng ade.read_memory để đọc đầy đủ]`
        );
      } else {
        const allowedContentLen = availableForThis - header.length - prunedSuffix.length;
        const sliced = f.content.slice(0, Math.max(0, allowedContentLen));
        prunedFilesParts.push(`${header}${sliced}${prunedSuffix}`);
      }
      remainingChars = 0;
    }
  }

  const finalMemContent =
    prunedFilesParts.length > 0 ? prunedFilesParts.join("\n\n") : "(trống)";
  memBlock = `<project_memory>\n${finalMemContent}\n</project_memory>`;

  return buildCandidate(memBlock, msgBlock);
}
