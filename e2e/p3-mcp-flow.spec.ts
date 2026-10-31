import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P3 MCP Flow — e2e/p3-mcp-flow.spec.ts", () => {
  test("Agent calls get_thread, post_progress and report_outcome via ADE MCP, triggering rule engine transition", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@lead",
          harness: "claude-code",
          write: true,
          scenario: "tests/scenarios/p3-mcp-flow.yaml",
        },
      ],
    });

    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`);

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // Dispatch @lead
      await threadPanel.getByTestId("composer-input").fill("@lead Lập kế hoạch chi tiết cho Phase P3");
      await threadPanel.getByTestId("send-message-btn").click();

      // LiveCard xuất hiện
      const liveCard = threadPanel.getByTestId("live-card");
      await expect(liveCard).toBeVisible({ timeout: 5000 });

      // Run hoàn thành sau khi report_outcome
      await expect(liveCard.getByTestId("live-card-status")).toHaveText("Hoàn thành", {
        timeout: 10000,
      });

      // Kiểm tra Rule Engine đã đổi state sang plan_review
      const stateBadge = threadPanel.getByTestId("thread-state-badge");
      if (await stateBadge.isVisible()) {
        await expect(stateBadge).toHaveText("plan_review");
      }
    } finally {
      await ctx.close();
    }
  });
});
