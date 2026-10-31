import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P2 Tool Permission Approval Card in Thread Panel — p2-permission.spec.ts", () => {
  test("AC-UI-RN-01-03, AC-UI-RN-01-04 & AC-UI-RN-01-13: bấm Cho phép thì chạy tiếp, chạy lại bấm Từ chối ghi rõ Đã từ chối", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      scenarioMap: { "@fake_perm": "tests/scenarios/p2-permission-npm-test.yaml" },
    });
    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`);

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // Lượt 1: Cho phép (Approve)
      await threadPanel.getByTestId("composer-input").fill("@fake_perm chạy test lần 1");
      await threadPanel.getByTestId("send-message-btn").click();

      const permCard1 = threadPanel.getByTestId("permission-card").first();
      await expect(permCard1).toBeVisible({ timeout: 5000 });
      await expect(permCard1.getByTestId("permission-gate-mark")).toBeVisible();
      await expect(permCard1.getByTestId("permission-command")).toContainText("Bash: npm test");
      await expect(
        page.getByTestId(`thread-reply-bar-${ctx.threadId}`).getByTestId("thread-run-summary"),
      ).toHaveText("@fake_perm: Chờ cấp quyền Bash");
      await permCard1.getByTestId("permission-approve-btn").click();

      await expect(permCard1.getByTestId("permission-card-status")).toHaveText("Đã cho phép");
      await expect(threadPanel.getByTestId("live-card").first().getByTestId("live-card-status")).toHaveText(
        "Hoàn thành",
        { timeout: 8000 },
      );

      // Lượt 2: Từ chối (Deny)
      await threadPanel.getByTestId("composer-input").fill("@fake_perm chạy test lần 2");
      await threadPanel.getByTestId("send-message-btn").click();

      const permCard2 = threadPanel.getByTestId("permission-card").nth(1);
      await expect(permCard2).toBeVisible({ timeout: 5000 });
      await permCard2.getByTestId("permission-deny-btn").click();

      await expect(permCard2.getByTestId("permission-card-status")).toHaveText("Đã từ chối");
    } finally {
      await ctx.close();
    }
  });
});
