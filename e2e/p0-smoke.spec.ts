import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { ApiErrorResponseSchema, HealthResponseSchema } from "../packages/shared/dist/index.js";
import { buildHubApp, type HubServerBundle } from "../apps/hub/dist/index.js";

const webDistDir = resolve(import.meta.dirname, "../apps/web/dist");

async function startTempHub(): Promise<{
  bundle: HubServerBundle;
  baseUrl: string;
  port: number;
  cleanup: () => Promise<void>;
}> {
  process.env.ADE_TEST = "1";
  const tempDir = mkdtempSync(join(tmpdir(), "ade-e2e-p0-"));
  const dbPath = join(tempDir, "ade.db");
  const bundle = await buildHubApp({
    dbPath,
    mode: "solo",
    version: "0.1.0",
    webDistDir
  });
  await bundle.app.listen({ host: "127.0.0.1", port: 0 });
  const address = bundle.app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind ephemeral port");
  }
  return {
    bundle,
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}`,
    cleanup: async () => {
      await bundle.app.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function sendRawHttpGet(
  port: number,
  headers: Record<string, string>
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolveReq, rejectReq) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/health",
        method: "GET",
        headers
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += String(chunk);
        });
        res.on("end", () => {
          resolveReq({ statusCode: res.statusCode ?? 0, body: data });
        });
      }
    );
    req.on("error", rejectReq);
    req.end();
  });
}

test.describe("P0 Smoke — API-P0-01 & UI-P0-01", () => {
  test("AC-UI-P0-01-01 & AC-API-P0-01-01: mở localhost hiển thị trạng thái sẵn sàng và 0 lỗi console", async ({
    page,
    request
  }) => {
    const hub = await startTempHub();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      const apiRes = await request.get(`${hub.baseUrl}/api/health`, {
        headers: { Origin: "http://localhost:5173" }
      });
      expect(apiRes.status()).toBe(200);
      expect(HealthResponseSchema.parse(await apiRes.json())).toEqual({
        status: "ok",
        mode: "solo",
        dbConnected: true,
        eventCount: 0,
        version: "0.1.0"
      });

      await page.goto(`${hub.baseUrl}/`);
      await expect(page.getByTestId("app-title")).toHaveText("ADE Runner");
      await expect(page.getByTestId("mode-badge")).toHaveText("Solo");
      await expect(page.getByTestId("health-status")).toHaveText("Hub & SQLite: Đã kết nối");
      await expect(page.getByTestId("event-count")).toHaveText("Số sự kiện đã ghi: 0");
      await expect(page.getByTestId("hub-version")).toHaveText("Phiên bản: 0.1.0");
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      await hub.cleanup();
    }
  });

  test("AC-UI-P0-01-02 & AC-API-P0-01-02: nhấn Làm mới trạng thái khóa nút khi đang tải và cập nhật eventCount", async ({
    page
  }) => {
    const hub = await startTempHub();
    try {
      await page.goto(`${hub.baseUrl}/`);
      await expect(page.getByTestId("event-count")).toHaveText("Số sự kiện đã ghi: 0");

      hub.bundle.hubDb.appendEvent({
        id: "evt_01JE2E00000000000000000001",
        type: "project.registered",
        ts: "2026-10-31T07:00:00.000Z",
        project_id: "prj_01",
        thread_id: null,
        run_id: null,
        actor: { type: "human", id: "usr_local" },
        causation_id: null,
        correlation_id: null,
        payload: { project_id: "prj_01" }
      });
      hub.bundle.hubDb.appendEvent({
        id: "evt_01JE2E00000000000000000002",
        type: "channel.created",
        ts: "2026-10-31T07:00:01.000Z",
        project_id: "prj_01",
        thread_id: null,
        run_id: null,
        actor: { type: "human", id: "usr_local" },
        causation_id: null,
        correlation_id: null,
        payload: { channel_id: "chn_01" }
      });

      let releaseRefresh!: () => void;
      const gatePromise = new Promise<void>((resolveGate) => {
        releaseRefresh = resolveGate;
      });
      await page.route("**/api/health", async (route) => {
        await gatePromise;
        await route.continue();
      });

      const refreshBtn = page.getByTestId("refresh-health-btn");
      await refreshBtn.click();
      await expect(refreshBtn).toBeDisabled();
      releaseRefresh();

      await expect(page.getByTestId("mode-badge")).toHaveText("Solo");
      await expect(page.getByTestId("event-count")).toHaveText("Số sự kiện đã ghi: 2");
      await expect(refreshBtn).toBeEnabled();
    } finally {
      await hub.cleanup();
    }
  });

  test("AC-API-P0-01-03, AC-API-P0-01-04, AC-API-P0-01-05 & AC-API-P0-01-06: kiểm tra bảo vệ Host + Origin (403) và lỗi DB ERR_INTERNAL_ERROR (500)", async ({
    request
  }) => {
    const hub = await startTempHub();
    try {
      for (const badOrigin of ["https://evil.example.com", "null"]) {
        const badOriginRes = await request.get(`${hub.baseUrl}/api/health`, {
          headers: { Origin: badOrigin }
        });
        expect(badOriginRes.status()).toBe(403);
        expect(ApiErrorResponseSchema.parse(await badOriginRes.json()).code).toBe(
          "ERR_LOCAL_ORIGIN_ONLY"
        );
      }

      const badHostNoOrigin = await sendRawHttpGet(hub.port, {
        Host: "ade.remote.example.com"
      });
      expect(badHostNoOrigin.statusCode).toBe(403);
      expect(ApiErrorResponseSchema.parse(JSON.parse(badHostNoOrigin.body)).code).toBe(
        "ERR_LOCAL_ORIGIN_ONLY"
      );

      const dnsRebind = await sendRawHttpGet(hub.port, {
        Host: "ade.remote.example.com",
        Origin: "http://localhost:5173"
      });
      expect(dnsRebind.statusCode).toBe(403);
      expect(ApiErrorResponseSchema.parse(JSON.parse(dnsRebind.body)).code).toBe(
        "ERR_LOCAL_ORIGIN_ONLY"
      );

      hub.bundle.hubDb.close();
      const dbClosedRes = await request.get(`${hub.baseUrl}/api/health`, {
        headers: { Origin: "http://127.0.0.1:3000" }
      });
      expect(dbClosedRes.status()).toBe(500);
      expect(ApiErrorResponseSchema.parse(await dbClosedRes.json()).code).toBe(
        "ERR_INTERNAL_ERROR"
      );
    } finally {
      await hub.cleanup();
    }
  });

  test("AC-UI-P0-01-03 & AC-UI-P0-01-05: tự động thử lại 1 lần khi HTTP 500 lúc mở trang rồi khôi phục thẻ trạng thái và badge Solo khi nhấn Thử lại", async ({
    page
  }) => {
    const hub = await startTempHub();
    try {
      let callCount = 0;
      let shouldFail = true;
      await page.route("**/api/health", async (route) => {
        callCount += 1;
        if (shouldFail) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              code: "ERR_INTERNAL_ERROR",
              message: "Đã xảy ra lỗi hệ thống nội bộ trên ADE Hub.",
              details: {}
            })
          });
          return;
        }
        await route.continue();
      });

      await page.goto(`${hub.baseUrl}/`);
      await expect(page.getByTestId("error-500-panel")).toContainText(
        "Không thể kết nối tới ADE Hub"
      );
      await expect(page.getByTestId("health-status")).toHaveCount(0);
      expect(callCount).toBe(2);

      shouldFail = false;
      await page.getByTestId("retry-health-btn").click();
      await expect(page.getByTestId("error-500-panel")).toHaveCount(0);
      await expect(page.getByTestId("mode-badge")).toHaveText("Solo");
      await expect(page.getByTestId("health-status")).toHaveText("Hub & SQLite: Đã kết nối");
    } finally {
      await hub.cleanup();
    }
  });

  test("AC-UI-P0-01-04: tự động thử lại 1 lần rồi hiện khung lỗi 500 khi mất kết nối mạng lúc mở trang", async ({
    page
  }) => {
    const hub = await startTempHub();
    try {
      let callCount = 0;
      await page.route("**/api/health", async (route) => {
        callCount += 1;
        await route.abort("failed");
      });

      await page.goto(`${hub.baseUrl}/`);
      await expect(page.getByTestId("error-500-panel")).toContainText(
        "Không thể kết nối tới ADE Hub"
      );
      await expect(page.getByTestId("retry-health-btn")).toBeVisible();
      expect(callCount).toBe(2);
    } finally {
      await hub.cleanup();
    }
  });

  test("AC-UI-P0-01-06: hiển thị khung lỗi 403 và không tự động thử lại khi nhận ERR_LOCAL_ORIGIN_ONLY", async ({
    page
  }) => {
    const hub = await startTempHub();
    try {
      let callCount = 0;
      await page.route("**/api/health", async (route) => {
        callCount += 1;
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            code: "ERR_LOCAL_ORIGIN_ONLY",
            message: "ADE ở chế độ Solo chỉ cho phép truy cập từ localhost.",
            details: {}
          })
        });
      });

      await page.goto(`${hub.baseUrl}/`);
      await expect(page.getByTestId("error-403-panel")).toHaveText(
        "ADE ở chế độ Solo chỉ cho phép truy cập từ localhost."
      );
      await expect(page.getByTestId("health-status")).toHaveCount(0);
      expect(callCount).toBe(1);
    } finally {
      await hub.cleanup();
    }
  });

  test("AC-UI-P0-01-07: nhấn Làm mới trạng thái khi API trả lỗi HTTP 500 liên tiếp chuyển sang khung lỗi 500 với nút Thử lại bật", async ({
    page
  }) => {
    const hub = await startTempHub();
    try {
      await page.goto(`${hub.baseUrl}/`);
      await expect(page.getByTestId("health-status")).toHaveText("Hub & SQLite: Đã kết nối");

      let refreshCalls = 0;
      await page.route("**/api/health", async (route) => {
        refreshCalls += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            code: "ERR_INTERNAL_ERROR",
            message: "Đã xảy ra lỗi hệ thống nội bộ trên ADE Hub.",
            details: {}
          })
        });
      });

      await page.getByTestId("refresh-health-btn").click();
      await expect(page.getByTestId("error-500-panel")).toContainText(
        "Không thể kết nối tới ADE Hub"
      );
      await expect(page.getByTestId("health-status")).toHaveCount(0);
      await expect(page.getByTestId("retry-health-btn")).toBeEnabled();
      expect(refreshCalls).toBe(2);
    } finally {
      await hub.cleanup();
    }
  });
});
