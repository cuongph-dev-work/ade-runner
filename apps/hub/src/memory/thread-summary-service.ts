import { ulid } from "ulid";
import type Database from "better-sqlite3";
import type { InMemoryEventBus } from "../events/event-bus.js";

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function trimSummaryTo500Words(fullText: string, threadTitle: string): string {
  const words = fullText.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 500) {
    return fullText.trim();
  }

  const titlePrefix = `Mục tiêu: ${threadTitle}`;
  const titleWords = titlePrefix.split(/\s+/).filter(Boolean);
  const allowedBodyWords = Math.max(0, 500 - titleWords.length);

  // Lấy thân nội dung sau title
  const bodyText = fullText.startsWith(titlePrefix)
    ? fullText.slice(titlePrefix.length).trim()
    : fullText.trim();
  const bodyWords = bodyText.split(/\s+/).filter(Boolean);

  const retainedBodyWords = bodyWords.slice(-allowedBodyWords);
  return `${titlePrefix}\n${retainedBodyWords.join(" ")}`.trim();
}

export class ThreadSummaryService {
  constructor(
    private deps: {
      sqlite: Database.Database;
      eventBus: InMemoryEventBus;
      appendEvent: (env: any) => any;
    }
  ) {}

  public updateOnRunCompleted(params: {
    threadId: string;
    runId: string;
    agentHandle: string;
    outcome?: string | null;
    summary?: string | null;
    decisions?: string[];
  }): string {
    const thread = this.deps.sqlite
      .prepare("SELECT id, project_id, title, summary FROM threads WHERE id = ?")
      .get(params.threadId) as
      | { id: string; project_id: string; title: string; summary: string | null }
      | undefined;
    if (!thread) return "";

    let currentSummary = (thread.summary ?? "").trim();
    if (currentSummary.length === 0) {
      currentSummary = `Mục tiêu: ${thread.title}`;
    }

    const outcome = params.outcome ?? "unknown";
    const hasReportedSummary =
      Boolean(params.summary && params.summary.trim().length > 0) &&
      ["done", "blocked", "needs_revision"].includes(outcome);

    let newEntry = "";
    let source = "report_outcome";

    if (hasReportedSummary) {
      newEntry = `[@${params.agentHandle.replace("@", "")} · ${outcome}] ${params.summary!.trim()}`;
      if (params.decisions && params.decisions.length > 0) {
        newEntry += `\nQuyết định: ${params.decisions.join("; ")}`;
      }
    } else {
      source = "fallback_last_message";
      // Fallback 1: Tin nhắn text hoặc explorer_card mới nhất của run
      const lastMsg = this.deps.sqlite
        .prepare(
          "SELECT body FROM messages WHERE run_id = ? AND kind IN ('text', 'explorer_card') ORDER BY created_at DESC LIMIT 1"
        )
        .get(params.runId) as { body: string } | undefined;

      let fallbackText = "";
      if (lastMsg && lastMsg.body.trim().length > 0) {
        fallbackText = lastMsg.body.trim();
      } else {
        // Fallback 2: lastMessageText từ live_card
        const liveMsg = this.deps.sqlite
          .prepare(
            "SELECT card_json FROM messages WHERE run_id = ? AND kind = 'live_card' ORDER BY created_at DESC LIMIT 1"
          )
          .get(params.runId) as { card_json: string } | undefined;
        if (liveMsg && liveMsg.card_json) {
          try {
            const card = JSON.parse(liveMsg.card_json);
            if (card.lastMessageText && typeof card.lastMessageText === "string") {
              fallbackText = card.lastMessageText.trim();
            }
          } catch {}
        }
      }

      if (fallbackText.length === 0) {
        fallbackText = "(không có nội dung phản hồi)";
      }

      // Chuẩn hoá khoảng trắng
      fallbackText = fallbackText.replace(/\s+/g, " ");
      newEntry = `[@${params.agentHandle.replace("@", "")} · fallback] ${fallbackText}`;
    }

    const combined = `${currentSummary}\n${newEntry}`;
    const finalizedSummary = trimSummaryTo500Words(combined, thread.title);

    // Cập nhật DB
    const nowIso = new Date().toISOString();
    this.deps.sqlite
      .prepare("UPDATE threads SET summary = ?, updated_at = ? WHERE id = ?")
      .run(finalizedSummary, nowIso, thread.id);

    // Append event
    const event = {
      id: `evt_${ulid()}`,
      seq: 0,
      type: "thread.summary_updated",
      project_id: thread.project_id,
      thread_id: thread.id,
      run_id: params.runId,
      actor: { type: "system", id: "ade_summary" },
      payload: {
        thread_id: thread.id,
        summary: finalizedSummary,
        source
      },
      ts: nowIso
    };
    this.deps.appendEvent(event);

    // Publish WebSocket
    this.deps.eventBus.publish({
      type: "thread.summary_updated",
      projectId: thread.project_id,
      threadId: thread.id,
      data: {
        thread_id: thread.id,
        summary: finalizedSummary,
        source
      }
    } as any);

    return finalizedSummary;
  }
}
