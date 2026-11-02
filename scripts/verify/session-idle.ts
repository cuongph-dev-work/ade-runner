import {
  AcpSessionPool,
  assemblePrompt
} from "../../packages/runner/src/index.js";

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=== BẮT ĐẦU KIỂM CHỨNG: scripts/verify/session-idle.ts ===");

  // Rút ngắn idleTimeoutMs xuống 1000ms (1 giây), maxSessions = 4
  const pool = new AcpSessionPool({
    maxSessions: 4,
    idleTimeoutMs: 1000
  });

  // 1. Mở 4 session đầu tiên
  const r1 = pool.acquireSession("thr_01", "agt_coder");
  const r2 = pool.acquireSession("thr_02", "agt_coder");
  const r3 = pool.acquireSession("thr_03", "agt_coder");
  const r4 = pool.acquireSession("thr_04", "agt_coder");

  console.log("Số session active/idle ban đầu:", pool.getActiveOrIdleCount());
  if (pool.getActiveOrIdleCount() !== 4) {
    throw new Error(`FAIL: Mong đợi 4 session mở, nhận ${pool.getActiveOrIdleCount()}`);
  }

  // 2. Chuyển s1 và s2 sang idle (s1 cũ hơn s2)
  pool.releaseSession("thr_01", "agt_coder");
  await sleep(50);
  pool.releaseSession("thr_02", "agt_coder");

  // 3. Mở session thứ 5 (thr_05, agt_coder)
  // Quy tắc LRU: s1 là session idle cũ nhất nên phải bị đóng (closed)
  const r5 = pool.acquireSession("thr_05", "agt_coder");
  console.log("Session 5 vừa mở:", r5.session.sessionKey);

  const s1 = pool.getSession("thr_01", "agt_coder");
  console.log("Trạng thái Session 1 sau LRU eviction:", s1?.status);
  if (s1?.status !== "closed") {
    throw new Error(`FAIL: Session 1 không bị chuyển sang closed khi mở session thứ 5, status=${s1?.status}`);
  }

  // 4. Kiểm tra tự động đóng sau idle timeout (chờ 1.2s > 1.0s)
  console.log("Chờ 1200ms để kiểm tra idle timeout...");
  await sleep(1200);

  const s2 = pool.getSession("thr_02", "agt_coder");
  console.log("Trạng thái Session 2 sau idle timeout:", s2?.status);
  if (s2?.status !== "closed") {
    throw new Error(`FAIL: Session 2 không tự đóng sau thời gian idle timeout, status=${s2?.status}`);
  }

  // 5. Reply vào thread 1 (đã closed) -> mở session mới kèm summary
  const reopened = pool.acquireSession("thr_01", "agt_coder", { supportsLoadSession: false });
  console.log("Mở lại Session 1: isReopened =", reopened.isReopened);
  if (!reopened.isReopened) {
    throw new Error("FAIL: Kỳ vọng isReopened = true khi mở lại session đã đóng");
  }

  // Prompt tiêm summary hiện tại của thread
  const threadSummary = "Mục tiêu: Đăng nhập OTP\n[@coder · done] Đã hoàn thành schema DB";
  const prompt = assemblePrompt({
    thread: {
      title: "Đăng nhập OTP",
      state: "active",
      summary: threadSummary
    },
    task: "Viết tiếp API xác thực mã OTP"
  });

  if (!prompt.includes("<thread>") || !prompt.includes(threadSummary)) {
    throw new Error("FAIL: Prompt không chứa summary khi mở lại session đã đóng");
  }
  console.log("Prompt chứa thread summary:\n" + prompt.slice(0, 300) + "...\n");

  pool.clearAll();
  console.log("[PASS] Session idle lifecycle & prompt summary verified!");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
