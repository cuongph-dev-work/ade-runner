import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export interface AcpClientOptions {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  onUpdate: (params: Record<string, unknown>) => void;
  onPermissionRequest: (params: Record<string, unknown>) => Promise<string>;
}

export class AcpStdioClient {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (val: unknown) => void; reject: (err: Error) => void }
  >();

  constructor(private readonly options: AcpClientOptions) {
    this.proc = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    const rl = createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) return;
      const msg = JSON.parse(trimmed) as {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
        result?: unknown;
        error?: { message: string };
      };

      if (msg.method === "session/update" && msg.params) {
        this.options.onUpdate(msg.params);
      } else if (
        msg.method === "session/request_permission" &&
        msg.id !== undefined &&
        msg.params
      ) {
        void this.options.onPermissionRequest(msg.params).then((optionId) => {
          this.proc.stdin.write(
            `${JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: { outcome: { outcome: "selected", optionId } }
            })}\n`
          );
        });
      } else if (msg.id !== undefined && this.pending.has(msg.id)) {
        const entry = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) {
          entry.reject(new Error(msg.error.message));
        } else {
          entry.resolve(msg.result);
        }
      }
    });
  }

  request<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (val) => resolve(val as T),
        reject
      });
      this.proc.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`
      );
    });
  }

  async close(): Promise<void> {
    this.proc.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      this.proc.once("exit", () => resolve());
      setTimeout(() => resolve(), 500);
    });
  }
}
