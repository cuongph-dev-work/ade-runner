import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

test.describe("P5 Agent Form — e2e/p5-agent-form.spec.ts", () => {
  test("User adds or edits agent via form and persists to .ade/agents/*.yaml", async ({
    page,
  }) => {
    const ctx = await startTestHub();

    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}`);

      // Bấm nút bánh răng mở Cài đặt dự án
      const settingsBtn = page.getByTestId("project-settings-btn");
      await expect(settingsBtn).toBeVisible();
      await settingsBtn.click();

      // Modal cài đặt xuất hiện
      await expect(page.getByTestId("project-settings-page")).toBeVisible();

      // Chuyển sang Tab Agents
      await page.getByTestId("tab-agents-btn").click();

      // Bấm Thêm agent
      await page.getByTestId("add-agent-btn").click();

      // Điền thông tin form
      await page.getByTestId("agent-handle-input").fill("@devbot");
      await page.getByTestId("agent-display-name-input").fill("Dev Bot");
      await page.getByTestId("agent-role-input").fill("Lập trình viên tự động triển khai");

      // Chọn harness codex và hồ sơ sub-chatgpt
      await page.getByTestId("agent-harness-select").selectOption("codex");
      await page.getByTestId("agent-credential-select").selectOption("sub-chatgpt");

      // Bật quyền write
      await page.getByTestId("agent-write-checkbox").check();

      // Bấm Lưu agent
      await page.getByTestId("save-agent-btn").click();

      // Kiểm tra tệp .ade/agents/devbot.yaml trên đĩa
      const agentFilePath = join(ctx.repoDir, ".ade", "agents", "devbot.yaml");
      expect(existsSync(agentFilePath)).toBe(true);

      const content = parseYaml(readFileSync(agentFilePath, "utf8"));
      expect(content.handle).toBe("devbot");
      expect(content.display_name).toBe("Dev Bot");
      expect(content.harness).toBe("codex");
      expect(content.credential_profile).toBe("sub-chatgpt");
      expect(content.write).toBe(true);
    } finally {
      await ctx.close();
    }
  });
});
