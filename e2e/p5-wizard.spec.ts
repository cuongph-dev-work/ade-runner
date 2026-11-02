import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

test.describe("P5 Wizard — e2e/p5-wizard.spec.ts", () => {
  test("User creates project from empty git repo via 3-step wizard", async ({
    page,
  }) => {
    const ctx = await startTestHub();
    const tempRepo = mkdtempSync(join(tmpdir(), "ade-wizard-test-"));
    execSync("git init -b main", { cwd: tempRepo, stdio: "ignore" });
    execSync('git config user.email "test@ade.local"', { cwd: tempRepo, stdio: "ignore" });
    execSync('git config user.name "Test Dev"', { cwd: tempRepo, stdio: "ignore" });
    writeFileSync(join(tempRepo, "README.md"), "# New Repo\n", "utf8");
    execSync("git add . && git commit -m 'Initial'", { cwd: tempRepo, stdio: "ignore" });

    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}`);

      // Bấm nút + tạo dự án mới trên rail
      const addBtn = page.getByTestId("add-project-btn");
      await expect(addBtn).toBeVisible();
      await addBtn.click();

      // Modal wizard xuất hiện
      const wizardModal = page.getByTestId("project-wizard");
      await expect(wizardModal).toBeVisible();

      // Bước 1: Nhập repoPath và bấm kiểm tra
      await page.getByTestId("repo-path-input").fill(tempRepo);
      await page.getByTestId("validate-repo-btn").click();
      await expect(page.getByText("Kho Git hợp lệ")).toBeVisible();

      // Bấm tiếp tục bước 2
      await page.getByTestId("wizard-step1-next-btn").click();

      // Bước 2: Xem trước mẫu agent
      await expect(page.getByTestId("wizard-template-preview")).toBeVisible();
      await expect(page.getByTestId("wizard-template-preview")).toContainText("@lead");

      // Bấm tiếp tục bước 3
      await page.getByTestId("wizard-step2-next-btn").click();

      // Bước 3: Hoàn tất tạo dự án
      await page.getByTestId("wizard-submit-btn").click();

      // Kiểm tra tệp trên đĩa được sinh ra
      expect(existsSync(join(tempRepo, ".ade", "project.yaml"))).toBe(true);
      expect(existsSync(join(tempRepo, ".ade", "agents", "lead.yaml"))).toBe(true);
      expect(existsSync(join(tempRepo, ".ade", "agents", "coder.yaml"))).toBe(true);

      // Chuyển thẳng sang Modal Settings tại tab agents
      await expect(page.getByTestId("project-settings-page")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("tab-agents-btn")).toBeVisible();
    } finally {
      await ctx.close();
      rmSync(tempRepo, { recursive: true, force: true });
    }
  });
});
