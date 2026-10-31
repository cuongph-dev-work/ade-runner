import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { buildHubApp, type HubServerBundle } from "../apps/hub/dist/index.js";

const webDistDir = resolve(import.meta.dirname, "../apps/web/dist");

async function startConfigErrorFixture(): Promise<{
  bundle: HubServerBundle;
  baseUrl: string;
  repoDir: string;
  cleanup: () => Promise<void>;
}> {
  process.env.ADE_TEST = "1";
  const sandbox = mkdtempSync(join(tmpdir(), "ade-e2e-p1-cfg-"));
  const repoDir = join(sandbox, "repo");
  mkdirSync(join(repoDir, ".ade", "agents"), { recursive: true });
  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

  writeFileSync(
    join(repoDir, ".ade", "project.yaml"),
    `name: "Config Isolation Repo"\ndefault_branch: "main"\nworkflow: "feature"\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "planner.yaml"),
    `handle: "planner"\ndisplay_name: "Planner"\nharness: "claude"\nenabled: true\n`
  );
  writeFileSync(
    join(repoDir, ".ade", "agents", "broken.yaml"),
    `handle: "broken"\ndisplay_name: "Broken Agent"\nharness: "invalid_engine"\n`
  );

  const bundle = await buildHubApp({
    dbPath: join(sandbox, "ade.db"),
    mode: "solo",
    version: "0.1.0",
    webDistDir,
    defaultRepoPath: repoDir,
    watchAdeFiles: true
  });
  await bundle.app.listen({ host: "127.0.0.1", port: 0 });
  const address = bundle.app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind port");
  }
  return {
    bundle,
    repoDir,
    baseUrl: `http://127.0.0.1:${address.port}`,
    cleanup: async () => {
      await bundle.app.close();
      rmSync(sandbox, { recursive: true, force: true });
    }
  };
}

test.describe("P1 .ade/ Config Error Isolation & Live File Watcher", () => {
  test("hiện đúng tên tệp và trường sai trong .ade/agents/broken.yaml, vẫn dùng được @planner và tự cập nhật khi sửa tệp", async ({
    page
  }) => {
    const hub = await startConfigErrorFixture();
    try {
      await page.goto(`${hub.baseUrl}/`);

      const banner = page.getByTestId("config-error-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(".ade/agents/broken.yaml");
      await expect(banner).toContainText("harness");

      // @planner vẫn gợi ý và gửi tin nhắn bình thường
      const input = page.getByTestId("channel-composer-input");
      await input.fill("@");
      await expect(page.getByTestId("mention-option-planner")).toBeVisible();
      await page.getByTestId("mention-option-planner").click();
      await input.fill("@planner vẫn hoạt động tốt");
      await page.getByTestId("channel-send-btn").click();
      await expect(page.getByTestId("thread-list")).toContainText(
        "@planner vẫn hoạt động tốt"
      );

      // Sửa tệp broken.yaml trên đĩa -> watcher đẩy project.config_updated qua /ws -> ẩn banner lỗi
      writeFileSync(
        join(hub.repoDir, ".ade", "agents", "broken.yaml"),
        `handle: "broken"\ndisplay_name: "Fixed Agent"\nharness: "codex"\nenabled: true\n`
      );
      await expect(banner).toHaveCount(0, { timeout: 2500 });
      await expect(page.getByTestId("agent-sidebar-item-broken")).toBeVisible();
    } finally {
      await hub.cleanup();
    }
  });
});
