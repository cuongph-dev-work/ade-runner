import { chromium } from "@playwright/test";
import * as path from "node:path";

const CAP_DIR = "/Users/cuongph/.gemini/antigravity/brain/56bbf59f-4859-4260-b675-53a783eb2ea6/captures";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  console.log("1. Capturing Prototype views from http://127.0.0.1:4310/...");
  const pageProto = await context.newPage();
  await pageProto.goto("http://127.0.0.1:4310/", { waitUntil: "networkidle" });
  await pageProto.waitForTimeout(600);

  // 1a. Proto Main Chat
  await pageProto.screenshot({ path: path.join(CAP_DIR, "cmp-proto-01-main.png") });

  // 1b. Proto Thread Panel
  await pageProto.click(".ade-thread-bar");
  await pageProto.waitForTimeout(500);
  await pageProto.screenshot({ path: path.join(CAP_DIR, "cmp-proto-02-thread.png") });

  // 1c. Proto Channel Settings Modal
  await pageProto.evaluate(() => (window as any).openChannelSettingsModal("general"));
  await pageProto.waitForTimeout(500);
  await pageProto.screenshot({ path: path.join(CAP_DIR, "cmp-proto-03-channel-settings.png") });
  await pageProto.evaluate(() => (window as any).closeModal());
  await pageProto.waitForTimeout(300);

  // 1d. Proto Wizard Modal
  await pageProto.evaluate(() => (window as any).openWizardModal());
  await pageProto.waitForTimeout(500);
  await pageProto.screenshot({ path: path.join(CAP_DIR, "cmp-proto-04-wizard.png") });
  await pageProto.evaluate(() => (window as any).closeWizardModal());
  await pageProto.waitForTimeout(300);

  // 1e. Proto Project Settings Modal
  await pageProto.evaluate(() => (window as any).openProjectSettingsModal("agents"));
  await pageProto.waitForTimeout(500);
  await pageProto.screenshot({ path: path.join(CAP_DIR, "cmp-proto-05-settings.png") });
  await pageProto.evaluate(() => (window as any).closeProjectSettingsModal());
  await pageProto.close();

  console.log("2. Capturing Web App views from http://127.0.0.1:5173/...");
  const pageWeb = await context.newPage();
  await pageWeb.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await pageWeb.waitForTimeout(800);

  // 2a. Web Main Chat
  await pageWeb.screenshot({ path: path.join(CAP_DIR, "cmp-web-01-main.png") });

  // 2b. Web Thread Panel
  const replyBar = pageWeb.locator('[data-testid="thread-reply-bar-thr_01"]');
  if (await replyBar.isVisible()) {
    await replyBar.click();
    await pageWeb.waitForSelector('[data-testid="thread-panel"]');
    await pageWeb.waitForTimeout(600);
    await pageWeb.screenshot({ path: path.join(CAP_DIR, "cmp-web-02-thread.png") });
  }

  // 2c. Web Channel Settings Modal
  await pageWeb.click('[data-testid="channel-settings-btn"]');
  await pageWeb.waitForSelector('[data-testid="channel-settings-modal"]');
  await pageWeb.waitForTimeout(500);
  await pageWeb.screenshot({ path: path.join(CAP_DIR, "cmp-web-03-channel-settings.png") });
  await pageWeb.click('[data-testid="close-channel-settings-btn"]');
  await pageWeb.waitForTimeout(300);

  // 2d. Web Wizard Modal
  await pageWeb.click('[data-testid="add-project-btn"]');
  await pageWeb.waitForSelector('[data-testid="project-wizard"]');
  await pageWeb.waitForTimeout(500);
  await pageWeb.screenshot({ path: path.join(CAP_DIR, "cmp-web-04-wizard.png") });
  await pageWeb.click('[data-testid="close-project-wizard-btn"]');
  await pageWeb.waitForTimeout(300);

  // 2e. Web Project Settings Modal
  await pageWeb.click('[data-testid="project-settings-btn"]');
  await pageWeb.waitForSelector('[data-testid="project-settings-page"]');
  await pageWeb.click('[data-testid="tab-agents-btn"]');
  await pageWeb.waitForTimeout(500);
  await pageWeb.screenshot({ path: path.join(CAP_DIR, "cmp-web-05-settings.png") });
  await pageWeb.click('[data-testid="close-project-settings-btn"]');
  await pageWeb.close();

  await browser.close();
  console.log("All 5 pairs of comparison captures completed!");
}

main().catch((err) => {
  console.error("Comparison error:", err);
  process.exit(1);
});
