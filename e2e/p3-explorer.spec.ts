import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";

test.describe("P3 Exploder ExplorerCard — e2e/p3-explorer.spec.ts", () => {
  test("Agent calls post_message kind explorer_card via MCP, card is rendered with flow steps and expandable code citations", async ({
    page,
  }) => {
    const ctx = await startTestHub({
      agents: [
        {
          handle: "@exploder",
          harness: "claude-code",
          write: false,
          scenario: "tests/scenarios/p3-explorer.yaml",
        },
      ],
    });

    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}/threads/${ctx.threadId}`);

      const threadPanel = page.getByTestId("thread-panel");
      await expect(threadPanel).toBeVisible();

      // Mention @exploder
      await threadPanel.getByTestId("composer-input").fill("@exploder Giải thích luồng xác thực MCP token");
      await threadPanel.getByTestId("send-message-btn").click();

      // Thẻ ExplorerCard xuất hiện
      const explorerCard = threadPanel.getByTestId("explorer-card");
      await expect(explorerCard).toBeVisible({ timeout: 8000 });

      // Tiêu đề topic
      await expect(explorerCard.getByTestId("explorer-topic")).toHaveText(
        "Luồng xác thực Token MCP và Grant Check"
      );

      // Danh sách flow steps
      const flowSteps = explorerCard.getByTestId("explorer-flow-steps").locator("li");
      await expect(flowSteps).toHaveCount(3);

      // Bấm Xem mã nguồn để mở rộng citations
      const toggleCitationBtn = explorerCard.getByTestId("explorer-toggle-citations");
      await expect(toggleCitationBtn).toHaveText("Xem mã nguồn");
      await toggleCitationBtn.click();

      // Citations code snippet hiển thị
      const citationsList = explorerCard.getByTestId("explorer-citations-list");
      await expect(citationsList).toBeVisible();
      await expect(citationsList).toContainText("apps/hub/src/mcp/mcp-server.ts#L45-L55");
      await expect(citationsList).toContainText("const grant = grantService.hasActiveGrant(agentId, threadId);");
    } finally {
      await ctx.close();
    }
  });
});
