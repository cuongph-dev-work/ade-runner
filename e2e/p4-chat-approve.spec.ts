import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P4 Chat Slash Commands — e2e/p4-chat-approve.spec.ts", () => {
  test("User reviews gate via /revise notes and /approve in chat composer", async ({
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

      // Gọi @lead tạo cổng duyệt
      await threadPanel.getByTestId("composer-input").fill("@lead Trình kế hoạch v1");
      await threadPanel.getByTestId("send-message-btn").click();

      // ApprovalGateCard xuất hiện
      const gateCardV1 = page.locator("[data-testid^='approval-gate-card-']").first();
      await expect(gateCardV1).toBeVisible({ timeout: 10000 });
      await expect(gateCardV1.getByTestId("approval-status-badge")).toHaveText("Chờ duyệt");

      // 1. Gõ /revise Cần bổ sung test case trong chat
      await threadPanel.getByTestId("composer-input").fill("/revise Cần bổ sung test case");
      await threadPanel.getByTestId("send-message-btn").click();

      // GateCard v1 chuyển sang trạng thái "Yêu cầu sửa" và hiển thị phản hồi
      await expect(gateCardV1.getByTestId("approval-status-badge")).toHaveText("Yêu cầu sửa", {
        timeout: 5000,
      });
      await expect(gateCardV1.getByTestId("approval-feedback-msg")).toContainText("Cần bổ sung test case");

      // 2. Chờ GateCard v2 xuất hiện (do @lead được wake sau khi revise và trình lại)
      const gateCardV2 = page.locator("[data-testid^='approval-gate-card-']").last();
      await expect(gateCardV2).toBeVisible({ timeout: 10000 });
      await expect(gateCardV2.getByTestId("approval-status-badge")).toHaveText("Chờ duyệt");

      // Gõ /approve trong chat
      await threadPanel.getByTestId("composer-input").fill("/approve");
      await threadPanel.getByTestId("send-message-btn").click();

      // GateCard v2 chuyển sang "Đã duyệt"
      await expect(gateCardV2.getByTestId("approval-status-badge")).toHaveText("Đã duyệt", {
        timeout: 5000,
      });
    } finally {
      await ctx.close();
    }
  });
});
