import { expect, test } from "@playwright/test";
import { startTestHub } from "./helpers/test-hub";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

test.describe("P5 Skill Editor — e2e/p5-skill-editor.spec.ts", () => {
  test("User creates skill with space blocked, valid name creates .ade/skills/<name>/SKILL.md", async ({
    page,
  }) => {
    const ctx = await startTestHub();

    try {
      await page.goto(`${ctx.baseUrl}/projects/${ctx.projectId}/channels/${ctx.channelId}`);

      // Mở cài đặt
      await page.getByTestId("project-settings-btn").click();
      await expect(page.getByTestId("project-settings-page")).toBeVisible();

      // Chuyển sang Tab Skills
      await page.getByTestId("tab-skills-btn").click();

      // Bấm Tạo skill mới
      await page.getByTestId("create-skill-btn").click();

      // 1. Thử nhập tên có khoảng trắng: "my skill"
      await page.getByTestId("skill-name-input").fill("my invalid skill");
      await page.getByTestId("save-skill-btn").click();

      // Bị chặn với thông báo lỗi
      const errBox = page.getByTestId("skill-error");
      await expect(errBox).toBeVisible();
      await expect(errBox).toContainText("không chứa khoảng trắng");

      // 2. Sửa lại thành tên hợp lệ "custom-tool"
      await page.getByTestId("skill-name-input").fill("custom-tool");
      await page.getByTestId("skill-content-input").fill(
        "---\nname: custom-tool\ndescription: Công cụ tùy chỉnh dự án\n---\n\n# Custom Tool\nHướng dẫn sử dụng công cụ.\n"
      );
      await page.getByTestId("save-skill-btn").click();

      // Kiểm tra tệp SKILL.md trên đĩa được tạo
      const skillMdPath = join(ctx.repoDir, ".ade", "skills", "custom-tool", "SKILL.md");
      expect(existsSync(skillMdPath)).toBe(true);

      const content = readFileSync(skillMdPath, "utf8");
      expect(content).toContain("name: custom-tool");
      expect(content).toContain("Công cụ tùy chỉnh dự án");
    } finally {
      await ctx.close();
    }
  });
});
