import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P2 Live Card in Slack Thread Panel — p2-live-card.spec.ts", () => {
  test("AC-UI-RN-01-01, AC-UI-RN-01-02 & AC-API-RN-01-02: mention @fake trong Ngăn phản hồi Thread hiện 1 live card < 5s, đồng bộ thanh tóm tắt kênh + chấm Sidebar, đủ 5 bước, đóng/mở aria-expanded và Hoàn thành", async ({
    page,
  }) => {
    const ctx = await startTestHub({ scenarioMap: { "@fake": "tests/scenarios/p2-five-steps.yaml" } });
    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`);

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      const t0 = Date.now();
      await threadPanel.getByTestId("composer-input").fill("@fake chạy kịch bản 5 bước");
      await threadPanel.getByTestId("send-message-btn").click();

      const liveCard = threadPanel.getByTestId("live-card");
      await expect(liveCard).toHaveCount(1, { timeout: 5000 });
      expect(Date.now() - t0).toBeLessThan(5000);

      const replyBar = page.getByTestId(`thread-reply-bar-${ctx.threadId}`);
      await expect(replyBar).toBeVisible();
      await expect(replyBar.getByTestId("thread-run-summary")).toBeVisible();
      await expect(page.getByTestId("sidebar-agent-dot-fake")).toHaveClass(/ade-presence--running/);

      await expect(liveCard.getByTestId("live-card-status")).toHaveText("Hoàn thành", {
        timeout: 10000,
      });
      await expect(liveCard).toHaveCount(1);
      await expect(replyBar.getByTestId("thread-run-summary")).toHaveCount(0);
      await expect(page.getByTestId("sidebar-agent-dot-fake")).not.toHaveClass(/ade-presence--running/);

      const toggleBtn = liveCard.getByTestId("live-card-toggle-steps");
      await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
      const stepItems = liveCard.getByTestId("live-card-steps").locator("li");
      await expect(stepItems).toHaveCount(5);
      await expect(liveCard.getByRole("button", { name: "Huỷ run" })).toHaveCount(0);

      await toggleBtn.click();
      await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
      await expect(liveCard.getByTestId("live-card-steps")).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
