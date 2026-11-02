import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P4 Orchestration — e2e/p4-orchestration.spec.ts", () => {
  test("Lead agent requests plan approval, ApprovalGateCard appears and user approves it via UI", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@lead",
          harness: "claude-code",
          write: true,
          scenario: "tests/scenarios/p4-lead-orchestrate.yaml",
        },
      ],
    });

    try {
      await page.goto(
        `${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`
      );

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // Gọi @lead lập plan
      await threadPanel.getByTestId("composer-input").fill("@lead Lập kế hoạch điều phối");
      await threadPanel.getByTestId("send-message-btn").click();

      // ApprovalGateCard xuất hiện
      const gateCard = page.locator("[data-testid^='approval-gate-card-']");
      await expect(gateCard).toBeVisible({ timeout: 10000 });
      await expect(gateCard.getByTestId("approval-status-badge")).toHaveText("Chờ duyệt");

      // Click Duyệt (Approve)
      const approveBtn = gateCard.getByTestId("btn-approve-gate");
      await expect(approveBtn).toBeVisible();
      await approveBtn.click();

      // Trạng thái cập nhật thành "Đã duyệt"
      await expect(gateCard.getByTestId("approval-status-badge")).toHaveText("Đã duyệt", {
        timeout: 5000,
      });
      await expect(gateCard.getByTestId("approval-resolved-msg")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
