import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { startTestHub } from "./helpers/test-hub";

test.describe("P6 Memory & Workflows — e2e/p6-memory.spec.ts", () => {
  test("Agent proposes memory via propose_memory; user approves in chat; verifies disk and Settings Modal", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@lead",
          harness: "claude-code",
          write: true,
          scenario: "tests/scenarios/p6-memory-propose.yaml",
        },
      ],
    });

    try {
      await page.goto(
        `${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`
      );

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // 1. Gọi @lead để kích hoạt kịch bản propose_memory
      await threadPanel.getByTestId("composer-input").fill("@lead Xin hãy ghi nhớ các quyết định kiến trúc");
      await threadPanel.getByTestId("send-message-btn").click();

      // Thẻ MemoryProposalCard xuất hiện
      const memCard = page.locator("[data-testid='memory-proposal-card']").first();
      await expect(memCard).toBeVisible({ timeout: 10000 });
      await expect(memCard).toContainText(".ade/memory/decisions.md");
      await expect(memCard).toContainText("Chờ duyệt");

      // File trên đĩa chưa tồn tại hoặc chưa có nội dung được duyệt
      const targetFilePath = join(ctx.repoDir, ".ade", "memory", "decisions.md");
      const existsBefore = existsSync(targetFilePath);
      expect(existsBefore).toBe(false);

      // 2. Người dùng bấm duyệt
      const approveBtn = memCard.getByTestId("approve-memory-btn");
      await approveBtn.click();

      // Card chuyển trạng thái "✓ Đã duyệt"
      await expect(memCard).toContainText("✓ Đã duyệt", { timeout: 5000 });

      // File trên đĩa đã được tạo với nội dung đề xuất
      expect(existsSync(targetFilePath)).toBe(true);
      const diskContent = readFileSync(targetFilePath, "utf8");
      expect(diskContent).toContain("Dùng SQLite local-first cho ADE Hub");

      // 3. Mở Project Settings Modal để kiểm tra Tab Memory và Tab Workflows
      await page.getByTestId("project-settings-btn").click();
      const settingsModal = page.getByTestId("project-settings-page");
      await expect(settingsModal).toBeVisible();

      // Chuyển sang Tab Memory
      await settingsModal.getByTestId("tab-memory-btn").click();

      // Kiểm tra editor memory hiển thị nội dung tệp decisions.md
      const memEditor = settingsModal.getByTestId("memory-content-editor");
      await expect(memEditor).toBeVisible();
      await expect(memEditor).toHaveValue(diskContent);

      // Sửa nội dung trực tiếp qua UI Settings
      const appendedText = "\n- Bổ sung quy tắc: Tuân thủ tokens.css toàn bộ UI\n";
      await memEditor.fill(diskContent + appendedText);
      await settingsModal.getByTestId("save-memory-file-btn").click();

      // Kiểm tra file trên đĩa đã được cập nhật nội dung mới
      await expect.poll(() => readFileSync(targetFilePath, "utf8")).toContain("Tuân thủ tokens.css");

      // 4. Chuyển sang Tab Workflows
      await settingsModal.getByTestId("tab-workflows-btn").click();

      const wfEditor = settingsModal.getByTestId("workflow-yaml-editor");
      await expect(wfEditor).toBeVisible();
      await expect(wfEditor).toHaveValue(/id:\s*"feature"/, { timeout: 5000 });
      const initialYaml = await wfEditor.inputValue();

      // Chỉnh sửa thêm state vào workflow
      const updatedYaml = initialYaml.replace("states:\n  - open", "states:\n  - open\n  - discovery");
      await wfEditor.fill(updatedYaml);
      await settingsModal.getByTestId("save-workflow-btn").click();

      // Đóng modal
      await settingsModal.getByTestId("close-project-settings-btn").click();
      await expect(settingsModal).not.toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("Rejecting memory proposal leaves file untouched", async ({ page }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@lead",
          harness: "claude-code",
          write: true,
          scenario: "tests/scenarios/p6-memory-propose.yaml",
        },
      ],
    });

    try {
      await page.goto(
        `${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`
      );

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // Gọi agent đề xuất memory
      await threadPanel.getByTestId("composer-input").fill("@lead Ghi nhận kiến trúc");
      await threadPanel.getByTestId("send-message-btn").click();

      const memCard = page.locator("[data-testid='memory-proposal-card']").first();
      await expect(memCard).toBeVisible({ timeout: 10000 });

      // Người dùng bấm Từ chối
      const rejectBtn = memCard.getByTestId("reject-memory-btn");
      await rejectBtn.click();

      // Card chuyển trạng thái "✕ Đã từ chối"
      await expect(memCard).toContainText("✕ Đã từ chối", { timeout: 5000 });

      // File trên đĩa không được tạo
      const targetFilePath = join(ctx.repoDir, ".ade", "memory", "decisions.md");
      expect(existsSync(targetFilePath)).toBe(false);
    } finally {
      await ctx.close();
    }
  });
});
