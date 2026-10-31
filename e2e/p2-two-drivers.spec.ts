import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P2 Two Drivers Parity — p2-two-drivers.spec.ts", () => {
  test("AC-UI-RN-01-05 & AC-API-RN-01-13: Claude fake và ACP fake hiển thị Live Card cùng định dạng trong Ngăn phản hồi Thread cho kịch bản 3 bước", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@claude_fake",
          harness: "claude-code",
          write: false,
          scenario: "tests/scenarios/p2-parity-three-steps.yaml",
        },
        {
          handle: "@codex_fake",
          harness: "codex",
          write: false,
          scenario: "tests/scenarios/p2-parity-three-steps.yaml",
        },
      ],
    });
    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`);

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      await threadPanel.getByTestId("composer-input").fill("@claude_fake @codex_fake chạy song song");
      await threadPanel.getByTestId("send-message-btn").click();

      const cards = threadPanel.getByTestId("live-card");
      await expect(cards).toHaveCount(2, { timeout: 5000 });

      for (let i = 0; i < 2; i++) {
        const card = cards.nth(i);
        await expect(card.getByTestId("live-card-status")).toHaveText("Hoàn thành", { timeout: 10000 });
        await expect(card.getByTestId("live-card-plan").locator("li")).toHaveCount(1);
        await expect(card.getByTestId("live-card-steps").locator("li")).toHaveCount(1);
        await expect(card.getByTestId("live-card-message")).toContainText("kịch bản 3 bước đồng nhất");
      }
    } finally {
      await ctx.close();
    }
  });
});
