import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { buildHubApp, type HubServerBundle } from "../apps/hub/dist/index.js";

const webDistDir = resolve(import.meta.dirname, "../apps/web/dist");

async function startMentionFixture(): Promise<{
  bundle: HubServerBundle;
  baseUrl: string;
  cleanup: () => Promise<void>;
}> {
  process.env.ADE_TEST = "1";
  const sandbox = mkdtempSync(join(tmpdir(), "ade-e2e-p1-mention-"));
  const repoDir = join(sandbox, "repo");
  mkdirSync(join(repoDir, ".ade", "agents"), { recursive: true });
  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    `name: "Mention Workspace"\ndefault_branch: "main"\nworkflow: "feature"\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "planner.yaml"),
    `handle: "planner"\ndisplay_name: "Planner"\nharness: "claude"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "coder.yaml"),
    `handle: "coder"\ndisplay_name: "Coder"\nharness: "codex"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "disabled-bot.yaml"),
    `handle: "disabled-bot"\ndisplay_name: "Disabled Bot"\nharness: "claude"\nenabled: false\n`
  );

  const bundle = await buildHubApp({
    dbPath: join(sandbox, "ade.db"),
    mode: "solo",
    version: "0.1.0",
    webDistDir,
    defaultRepoPath: repoDir
  });
  await bundle.app.listen({ host: "127.0.0.1", port: 0 });
  const address = bundle.app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind port");
  }
  return {
    bundle,
    baseUrl: `http://127.0.0.1:${address.port}`,
    cleanup: async () => {
      await bundle.app.close();
      rmSync(sandbox, { recursive: true, force: true });
    }
  };
}

test.describe("P1 @mention Autocomplete (2 Groups) & Semantic Highlight", () => {
  test("gõ @ hiện 2 nhóm Đồng nghiệp và Bot / Agent đang bật, tô sáng đúng màu và cảnh báo @unknown", async ({
    page
  }) => {
    const hub = await startMentionFixture();
    try {
      await page.goto(`${hub.baseUrl}/`);
      const channelInput = page.getByTestId("channel-composer-input");

      // Gõ @ mở hộp gợi ý 2 nhóm
      await channelInput.fill("@");
      const popup = page.getByTestId("mention-popup");
      await expect(popup).toBeVisible();
      await expect(page.getByTestId("mention-group-colleagues")).toContainText("@owner");
      await expect(page.getByTestId("mention-group-agents")).toContainText("@planner");
      await expect(page.getByTestId("mention-group-agents")).toContainText("@coder");
      await expect(popup).not.toContainText("@disabled-bot");

      // Nhấn Escape đóng popup nhưng giữ chữ
      await channelInput.press("Escape");
      await expect(popup).toHaveCount(0);
      await expect(channelInput).toHaveValue("@");

      // Chọn @planner từ gợi ý và gửi kèm đồng nghiệp @owner
      await channelInput.fill("@pl");
      await expect(page.getByTestId("mention-option-planner")).toBeVisible();
      await page.getByTestId("mention-option-planner").click();
      await expect(channelInput).toHaveValue("@planner ");
      await channelInput.fill("@planner phối hợp cùng @owner viết spec");
      await page.getByTestId("channel-send-btn").click();

      const rootCard = page.locator('[data-testid^="thread-row-"]').first();
      await expect(rootCard.getByTestId("mention-chip-planner")).toHaveClass(
        /ade-mention--agent/
      );
      await expect(rootCard.getByTestId("mention-chip-owner")).toHaveClass(
        /ade-mention--human/
      );

      // Mở ngăn Thread và gửi @ghost để kiểm chứng dòng cảnh báo hệ thống
      await rootCard.hover();
      await rootCard.locator('[data-testid^="reply-in-thread-btn-"]').click();
      await page.getByTestId("composer-input").fill("Nhờ @ghost kiểm tra");
      await page.getByTestId("send-message-btn").click();

      await expect(page.getByTestId("message-system-warning")).toContainText("@ghost");
    } finally {
      await hub.cleanup();
    }
  });
});
