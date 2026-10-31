import type {
  LiveCardPayload,
  NormalizedRunEvent,
  PlanItem,
  StepLogItem,
  ToolCallLogItem,
} from "@ade/shared";

interface BufferEntry {
  dirty: boolean;
  timer: NodeJS.Timeout | null;
  plan: PlanItem[];
  toolCalls: ToolCallLogItem[];
  steps: StepLogItem[];
  lastMessageText: string;
}

export class ProgressAggregator {
  private readonly buffers = new Map<string, BufferEntry>();
  private readonly seqCounters = new Map<string, number>();

  constructor(
    private readonly options: {
      intervalMs?: number;
      insertRunLog: (row: {
        runId: string;
        seq: number;
        kind: NormalizedRunEvent["kind"];
        dataJson: string;
        ts: string;
      }) => void;
      emitAggregatedProgress: (
        runId: string,
        snapshot: Pick<LiveCardPayload, "plan" | "toolCalls" | "steps" | "lastMessageText">,
      ) => void;
    },
  ) {}

  ingest(runId: string, ts: string, event: NormalizedRunEvent): void {
    const nextSeq = (this.seqCounters.get(runId) ?? 0) + 1;
    this.seqCounters.set(runId, nextSeq);
    this.options.insertRunLog({
      runId,
      seq: nextSeq,
      kind: event.kind,
      dataJson: JSON.stringify(event.data),
      ts,
    });

    let buf = this.buffers.get(runId);
    if (!buf) {
      buf = {
        dirty: false,
        timer: null,
        plan: [],
        toolCalls: [],
        steps: [],
        lastMessageText: "",
      };
      this.buffers.set(runId, buf);
    }

    if (event.kind === "plan") {
      buf.plan = event.data.items;
    } else if (event.kind === "tool_call") {
      const idx = buf.toolCalls.findIndex((t) => t.callId === event.data.callId);
      if (idx >= 0) {
        buf.toolCalls[idx] = event.data;
      } else {
        buf.toolCalls.push(event.data);
      }
    } else if (event.kind === "step") {
      buf.steps.push(event.data);
    } else if (event.kind === "message_chunk") {
      buf.lastMessageText = `${buf.lastMessageText}${event.data.textDelta}`.slice(-4000);
    }

    buf.dirty = true;
    if (!buf.timer) {
      const waitMs = this.options.intervalMs ?? 1000;
      buf.timer = setTimeout(() => {
        this.flush(runId);
      }, waitMs);
      buf.timer.unref?.();
    }
  }

  flush(runId: string): void {
    const buf = this.buffers.get(runId);
    if (!buf) return;
    if (buf.timer) {
      clearTimeout(buf.timer);
      buf.timer = null;
    }
    if (!buf.dirty) return;
    buf.dirty = false;
    this.options.emitAggregatedProgress(runId, {
      plan: structuredClone(buf.plan),
      toolCalls: structuredClone(buf.toolCalls),
      steps: structuredClone(buf.steps),
      lastMessageText: buf.lastMessageText,
    });
  }

  clear(runId: string): void {
    this.flush(runId);
    this.buffers.delete(runId);
    this.seqCounters.delete(runId);
  }
}
