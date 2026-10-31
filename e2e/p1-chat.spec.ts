import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { buildHubApp, type HubServerBundle } from "../apps/hub/dist/index.js";

const webDistDir = resolve(import.meta.dirname, "../apps/web/dist");

async function startChatFixture(): Promise<{
  bundle: HubServerBundle;
  baseUrl: string;
  repoDir: string;
  cleanup: () => Promise<void>;
}> {
  process.env.ADE_TEST = "1";
  const sandbox = mkdtempSync(join(tmpdir(), "ade-e2e-p1-chat-"));
  const repoDir = join(sandbox, "repo");
  mkdirSync(join(repoDir, ".ade", "agents"), { recursive: true });
  mkdirSync(join(repoDir, ".ade", "workflows"), { recursive: true });
  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    `name: "ADE Demo"\ndefault_branch: "main"\nworkflow: "feature"\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "planner.yaml"),
    `handle: "planner"\ndisplay_name: "Planner"\nharness: "claude"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "coder.yaml"),
    `handle: "coder"\ndisplay_name: "Coder"\nharness: "codex"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "workflows", "feature.yaml"),
    `id: "feature"\ninitial: "open"\nstates:\n  - open\n  - planning\n  - done\n`
  );

  const bundle = await buildHubApp({
    dbPath: join(sandbox, "ade.db"),
    mode: "solo",
    version: "0.1.0",
    webDistDir,
    defaultRepoPath: repoDir
  });
  await bundle.app.listen({ host: "127.0.0.1", port: 0 });
  const address = bundle.app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind port");
  }
  return {
    bundle,
    repoDir,
    baseUrl: `http://127.0.0.1:${address.port}`,
    cleanup: async () => {
      await bundle.app.close();
      rmSync(sandbox, { recursive: true, force: true });
    }
  };
}

test.describe("P1 Chat Core — Slack 3+1 Workspace, Realtime < 1s, Channels & Reactions", () => {
  test("tạo kênh, gửi tin nhắn gốc mở thread, trả lời đồng bộ sang trang thứ hai < 1s, thả biểu cảm và giữ lại sau reload", async ({
    browser
  }) => {
    const hub = await startChatFixture();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await pageA.goto(`${hub.baseUrl}/`);
      await expect(pageA.getByTestId("active-project-name")).toHaveText("ADE Demo");
      await expect(pageA.getByTestId("ws-status-pill")).toHaveText("Trực tuyến");
      await expect(pageA.getByTestId("channel-header-name")).toHaveText("# general");
      await expect(pageA.getByTestId("empty-state-guide")).toBeVisible();

      // Khóa xóa kênh cuối cùng và đóng modal bằng nút biểu tượng × (aria-label="Đóng")
      await pageA.getByTestId("channel-settings-btn").click();
      await expect(pageA.getByTestId("delete-channel-btn")).toBeDisabled();
      await pageA
        .getByTestId("channel-settings-modal")
        .getByRole("button", { name: "Đóng" })
        .click();

      // Tạo kênh mới #frontend-ui
      await pageA.getByTestId("create-channel-btn").click();
      await pageA.getByTestId("channel-name-input").fill("frontend-ui");
      await pageA.getByTestId("channel-desc-input").fill("Giao diện React");
      await pageA.getByTestId("submit-channel-btn").click();
      await expect(pageA.getByTestId("channel-header-name")).toHaveText("# frontend-ui");
      await expect(pageA.getByTestId("channel-header-desc")).toHaveText("Giao diện React");

      // Kiểm chứng nút biểu tượng ⇕ chuyển bậc chiều cao khung nhập 84px -> 180px -> 84px
      await expect(pageA.getByTestId("channel-composer-input")).toHaveCSS("height", "84px");
      await pageA.getByTestId("channel-height-toggle-btn").click();
      await expect(pageA.getByTestId("channel-composer-input")).toHaveCSS("height", "180px");
      await pageA.getByTestId("channel-height-toggle-btn").click();
      await expect(pageA.getByTestId("channel-composer-input")).toHaveCSS("height", "84px");

      // Đăng tin nhắn gốc mở Thread trong #frontend-ui
      await pageA
        .getByTestId("channel-composer-input")
        .fill("Thiết kế layout Slack 3+1 cột");
      await pageA.getByTestId("channel-send-btn").click();
      await expect(pageA.getByTestId("thread-list")).toContainText(
        "Thiết kế layout Slack 3+1 cột"
      );

      // Mở ngăn phản hồi Thread ở Tab A và mở cùng URL ở Tab B
      const replyBtn = pageA.locator('[data-testid^="reply-in-thread-btn-"]').first();
      await pageA.locator('[data-testid^="thread-row-"]').first().hover();
      await replyBtn.click();
      await expect(pageA.getByTestId("thread-panel")).toBeVisible();
      await expect(pageA.getByTestId("thread-panel-topbar")).toBeVisible();

      const threadUrl = pageA.url();
      await pageB.goto(threadUrl);
      await expect(pageB.getByTestId("thread-panel")).toBeVisible();

      // Tab A gửi phản hồi -> Tab B nhận dưới 1000 ms, replyCount khử trùng lặp đúng bằng 1 ở cả 2 tab
      const sentAt = Date.now();
      await pageA.getByTestId("composer-input").fill("Đồng bộ thời gian thực dưới 1 giây");
      await pageA.getByTestId("send-message-btn").click();

      await expect(pageB.getByTestId("message-list")).toContainText(
        "Đồng bộ thời gian thực dưới 1 giây",
        { timeout: 950 }
      );
      expect(Date.now() - sentAt).toBeLessThan(1000);
      await expect(pageA.locator('[data-testid^="thread-reply-bar-"]').first()).toContainText(
        "1 phản hồi"
      );
      await expect(pageB.locator('[data-testid^="thread-reply-bar-"]').first()).toContainText(
        "1 phản hồi"
      );

      // Thả biểu cảm 🚀 trên tin nhắn gốc ở Cột 3
      const rootRow = pageA.locator('[data-testid^="thread-row-"]').first();
      await rootRow.hover();
      await rootRow.locator('[data-testid^="quick-react-"][data-testid$="-🚀"]').click();
      await expect(rootRow.locator(".ade-reaction-pill.is-mine")).toContainText("🚀");

      // Chuyển độ rộng ngăn Thread 448 -> 640 và reload vẫn giữ dữ liệu
      await pageA.getByTestId("thread-width-toggle-btn").click();
      await expect(pageA.getByTestId("thread-panel")).toHaveCSS("width", "640px");

      await pageA.reload();
      await expect(pageA.getByTestId("message-list")).toContainText(
        "Đồng bộ thời gian thực dưới 1 giây"
      );
      await expect(pageA.getByTestId("thread-panel")).toHaveCSS("width", "640px");

      // Đóng ngăn Thread bằng nút ×
      await pageA.getByTestId("thread-close-btn").click();
      await expect(pageA.getByTestId("thread-panel")).toHaveCount(0);

      // Xóa mềm kênh #frontend-ui khi dự án đã có 2 kênh
      await pageA.getByTestId("channel-settings-btn").click();
      await pageA.getByTestId("delete-channel-btn").click();
      await pageA.getByTestId("confirm-delete-channel-btn").click();
      await expect(pageA.getByTestId("channel-header-name")).toHaveText("# general");
    } finally {
      await ctxA.close();
      await ctxB.close();
      await hub.cleanup();
    }
  });

  test("đáp ứng đúng 2 mốc Tablet (820x900 trượt đè bên phải) và Mobile (390x844 ngăn kéo trái gộp Project Rail + Channel Sidebar)", async ({
    page
  }) => {
    const hub = await startChatFixture();
    try {
      // Khung nhìn Tablet 820x900 (768px - 1024px)
      await page.setViewportSize({ width: 820, height: 900 });
      await page.goto(`${hub.baseUrl}/`);
      await expect(page.getByTestId("mobile-sidebar-btn")).toBeHidden();
      await page.getByTestId("channel-composer-input").fill("Tin nhắn thử Tablet & Mobile");
      await page.getByTestId("channel-send-btn").click();

      const row = page.locator('[data-testid^="thread-row-"]').first();
      await row.hover();
      await row.locator('[data-testid^="reply-in-thread-btn-"]').click();
      await expect(page.getByTestId("thread-panel")).toHaveCSS("position", "fixed");
      await expect(page.getByTestId("thread-backdrop")).toBeVisible();
      await page.getByTestId("thread-close-btn").click();

      // Khung nhìn Mobile 390x844 (< 768px)
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByTestId("mobile-sidebar-btn")).toBeVisible();
      await page.getByTestId("mobile-sidebar-btn").click();
      const drawer = page.getByTestId("mobile-left-drawer");
      await expect(drawer).toHaveClass(/is-open/);
      await expect(drawer.locator("aside.ade-rail")).toBeVisible();
      await expect(drawer.getByTestId("channel-sidebar")).toBeVisible();
      await drawer.locator('[data-testid^="channel-item-"]').first().click();
      await expect(drawer).not.toHaveClass(/is-open/);
    } finally {
      await hub.cleanup();
    }
  });
});
