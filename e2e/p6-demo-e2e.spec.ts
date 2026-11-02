import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { startTestHub } from "./helpers/test-hub";

test.describe("P6 End-to-End Demo Flow — e2e/p6-demo-e2e.spec.ts", () => {
  test("Full lifecycle: @lead plans -> plan gate approved -> @coder executes & proposes memory -> memory approved -> summary updated", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@lead",
          harness: "claude-code",
          write: true,
          scenario: "tests/scenarios/p6-demo-lead.yaml",
        },
        {
          handle: "@coder",
          harness: "claude-code",
          write: true,
          scenario: "tests/scenarios/p6-demo-coder.yaml",
        },
      ],
    });

    try {
      await page.goto(
        `${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`
      );

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // Bước 1: Gọi @lead lên phương án điều phối
      await threadPanel.getByTestId("composer-input").fill("@lead Hãy lên phương án điều phối và trình kế hoạch");
      await threadPanel.getByTestId("send-message-btn").click();

      // Cổng duyệt Plan xuất hiện
      const gateCard = page.locator("[data-testid^='approval-gate-card-']").first();
      await expect(gateCard).toBeVisible({ timeout: 10000 });
      await expect(gateCard.getByTestId("approval-status-badge")).toHaveText("Chờ duyệt");

      // Bước 2: Người dùng phê duyệt cổng duyệt Plan
      const approveGateBtn = gateCard.getByTestId("btn-approve-gate");
      await expect(approveGateBtn).toBeVisible();
      await approveGateBtn.click();

      // Cổng chuyển trạng thái thành "Đã duyệt"
      await expect(gateCard.getByTestId("approval-status-badge")).toHaveText("Đã duyệt", {
        timeout: 5000,
      });

      // Bước 3: Người dùng gọi worker @coder để triển khai mã nguồn
      await threadPanel.getByTestId("composer-input").fill("@coder Kế hoạch đã duyệt, tiến hành triển khai code nhé");
      await threadPanel.getByTestId("send-message-btn").click();

      // Thẻ MemoryProposalCard do @coder đề xuất xuất hiện
      const memCard = page.locator("[data-testid='memory-proposal-card']").first();
      await expect(memCard).toBeVisible({ timeout: 10000 });
      await expect(memCard).toContainText(".ade/memory/decisions.md");
      await expect(memCard).toContainText("Chờ duyệt");

      // Bước 4: Người dùng duyệt thẻ đề xuất Memory
      const approveMemBtn = memCard.getByTestId("approve-memory-btn");
      await approveMemBtn.click();

      // Thẻ Memory chuyển sang trạng thái "✓ Đã duyệt"
      await expect(memCard).toContainText("✓ Đã duyệt", { timeout: 5000 });

      // File trên đĩa được tạo thành công
      const targetFilePath = join(ctx.repoDir, ".ade", "memory", "decisions.md");
      expect(existsSync(targetFilePath)).toBe(true);
      const memDiskContent = readFileSync(targetFilePath, "utf8");
      expect(memDiskContent).toContain("Hoàn tất Auth module theo kế hoạch");

      // Bước 5: Kiểm tra Thread Summary Box được hiển thị trên giao diện
      // Sau khi reload nhẹ hoặc do invalidate query, summary box xuất hiện
      await page.reload();
      const summaryBox = page.getByTestId("thread-summary-box");
      await expect(summaryBox).toBeVisible({ timeout: 5000 });
      await expect(summaryBox).toContainText("Tóm tắt tiến độ Thread");
    } finally {
      await ctx.close();
    }
  });
});
