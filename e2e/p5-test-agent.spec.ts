import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P5 Test Agent — e2e/p5-test-agent.spec.ts", () => {
  test("Click Test agent displays 3 verification items: harness boot, skills loaded, MCP connected", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@coder",
          harness: "claude-code",
          write: true
        }
      ]
    });

    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}`);

      // Mở cài đặt
      await page.getByTestId("project-settings-btn").click();
      await expect(page.getByTestId("project-settings-page")).toBeVisible();

      // Chuyển sang Tab Agents
      await page.getByTestId("tab-agents-btn").click();

      // Bấm Test agent của @coder
      const testBtn = page.getByTestId("test-agent-btn-coder");
      await expect(testBtn).toBeVisible();
      await testBtn.click();

      // Modal kết quả Test agent xuất hiện
      const modal = page.getByTestId("test-agent-modal");
      await expect(modal).toBeVisible();

      // Hiện đủ 3 mục kiểm tra
      await expect(modal).toContainText("1. Khởi động Harness");
      await expect(modal).toContainText("2. Nạp danh sách Skill");
      await expect(modal).toContainText("3. Kết nối ADE MCP");

      // Bấm nút đóng
      await page.getByTestId("close-test-result-btn").click();
      await expect(modal).not.toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
