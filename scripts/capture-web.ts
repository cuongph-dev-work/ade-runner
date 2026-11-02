import { chromium } from "@playwright/test";
import * as path from "node:path";

const CAPTURE_DIR = "/Users/cuongph/.gemini/antigravity/brain/56bbf59f-4859-4260-b675-53a783eb2ea6/captures";
const BASE_URL = "http://127.0.0.1:5173";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log("Navigating to Web app root...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 1. web-01-main-chat.png
  console.log("Capturing 01: Main Chat...");
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-01-main-chat.png"), fullPage: false });

  // 2. web-02-hover-toolbar.png
  console.log("Capturing 02: Hover Toolbar...");
  const firstMsg = page.locator(".ade-chat-msg").first();
  await firstMsg.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-02-hover-toolbar.png"), fullPage: false });

  // 3. web-03-thread-gate.png
  console.log("Capturing 03: Thread Gate Approval...");
  const replyBarThr01 = page.locator('[data-testid="thread-reply-bar-thr_01"]');
  if (await replyBarThr01.isVisible()) {
    await replyBarThr01.click();
  } else {
    const replyBtn = page.locator('[data-testid="reply-in-thread-btn-thr_01"]');
    if (await replyBtn.isVisible()) await replyBtn.click();
  }
  await page.waitForSelector('[data-testid="thread-panel"]', { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-03-thread-gate.png"), fullPage: false });

  // 4. web-04-explorer-clarifier.png
  console.log("Capturing 04: Explorer & Clarifier Cards...");
  // Close previous drawer or click thread clarify directly
  const replyBarClarify = page.locator('[data-testid="thread-reply-bar-thr_clarify_01"]');
  if (await replyBarClarify.isVisible()) {
    await replyBarClarify.click();
  } else {
    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);
    const parts = urlObj.pathname.split("/threads/")[0];
    await page.goto(`${urlObj.origin}${parts}/threads/thr_clarify_01`, { waitUntil: "networkidle" });
  }
  await page.waitForSelector('[data-testid="thread-panel"]', { timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-04-explorer-clarifier.png"), fullPage: false });

  // 5. web-05-settings-agents.png
  console.log("Capturing 05: Project Settings - Agents...");
  await page.click('[data-testid="project-settings-btn"]');
  await page.waitForSelector('[data-testid="project-settings-page"]', { timeout: 5000 });
  await page.click('[data-testid="tab-agents-btn"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-05-settings-agents.png"), fullPage: false });

  // 6. web-06-settings-workflows.png
  console.log("Capturing 06: Project Settings - Workflows...");
  await page.click('[data-testid="tab-workflows-btn"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-06-settings-workflows.png"), fullPage: false });

  // 7. web-07-settings-memory.png
  console.log("Capturing 07: Project Settings - Memory...");
  await page.click('[data-testid="tab-memory-btn"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-07-settings-memory.png"), fullPage: false });

  // Close project settings modal
  await page.click('[data-testid="close-project-settings-btn"]');
  await page.waitForTimeout(400);

  // 8. web-08-channel-settings.png
  console.log("Capturing 08: Channel Settings Modal...");
  await page.click('[data-testid="channel-settings-btn"]');
  await page.waitForSelector('[data-testid="channel-settings-modal"]', { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-08-channel-settings.png"), fullPage: false });
  await page.click('[data-testid="close-channel-settings-btn"]');
  await page.waitForTimeout(400);

  // 9. web-09-wizard-modal.png
  console.log("Capturing 09: Wizard Modal...");
  await page.click('[data-testid="add-project-btn"]');
  await page.waitForSelector('[data-testid="project-wizard"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-09-wizard-modal.png"), fullPage: false });
  await page.click('[data-testid="close-project-wizard-btn"]');
  await page.waitForTimeout(400);

  // 10. web-10-dark-mode.png
  console.log("Capturing 10: Dark Mode...");
  const replyBarThr01Again = page.locator('[data-testid="thread-reply-bar-thr_01"]');
  if (await replyBarThr01Again.isVisible()) {
    await replyBarThr01Again.click();
    await page.waitForSelector('[data-testid="thread-panel"]', { timeout: 5000 });
  }
  await page.evaluate(() => {
    document.documentElement.dataset.mode = "dark";
    localStorage.setItem("ade-theme-mode", "dark");
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(CAPTURE_DIR, "web-10-dark-mode.png"), fullPage: false });

  await browser.close();
  console.log("All 10 captures completed successfully!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
