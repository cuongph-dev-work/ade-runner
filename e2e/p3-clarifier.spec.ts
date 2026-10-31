import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P3 Clarifier QuestionCard — e2e/p3-clarifier.spec.ts", () => {
  test("Agent calls ask_human via MCP, QuestionCard is displayed, user selects option and submits answer", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@clarifier",
          harness: "claude-code",
          write: false,
          scenario: "tests/scenarios/p3-clarifier.yaml",
        },
      ],
    });

    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`);

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // Mention @clarifier
      await threadPanel.getByTestId("composer-input").fill("@clarifier Hãy hỏi tôi các lựa chọn lưu trữ");
      await threadPanel.getByTestId("send-message-btn").click();

      // Thẻ QuestionCard xuất hiện trong thread
      const questionCard = threadPanel.locator('[data-testid^="question-card-"]').first();
      await expect(questionCard).toBeVisible({ timeout: 8000 });
      await expect(questionCard.getByTestId("question-prompt")).toHaveText(
        "Bạn chọn cơ sở dữ liệu nào cho ADE Hub?"
      );

      // Chọn option "SQLite local"
      const optSqlite = questionCard.locator('label:has-text("SQLite local")');
      await optSqlite.click();

      // Gửi câu trả lời
      const submitBtn = questionCard.getByTestId("question-submit-btn");
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();

      // Card cập nhật trạng thái "Đã trả lời"
      await expect(questionCard.getByTestId("question-card-status")).toHaveText("Đã trả lời", {
        timeout: 5000,
      });
      await expect(questionCard.getByTestId("question-answered-box")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
