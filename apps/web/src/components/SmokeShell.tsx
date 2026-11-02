import type { JSX } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { HealthResponse } from "@ade/shared";
import { ApiRequestError } from "../api/health.js";
import { translateApiError } from "../i18n/vi.js";

export type ThemeMode = "system" | "light" | "dark";

interface SmokeShellProps {
  themeMode: ThemeMode;
  onChangeTheme: (next: ThemeMode) => void;
  healthQuery: UseQueryResult<HealthResponse, Error>;
}

export function SmokeShell({
  themeMode,
  onChangeTheme,
  healthQuery
}: SmokeShellProps): JSX.Element {
  const isForbiddenOrigin =
    healthQuery.isError &&
    healthQuery.error instanceof ApiRequestError &&
    healthQuery.error.status === 403;

  return (
    <div className="ade-shell">
      <header className="ade-header">
        <div className="ade-mode-group">
          <h1 data-testid="app-title" className="ade-head">
            ADE Runner
          </h1>
          {healthQuery.isSuccess && healthQuery.data.mode === "solo" && (
            <span data-testid="mode-badge" className="ade-chip ade-chip--agent">
              Solo
            </span>
          )}
        </div>

        <div className="ade-mode-group" role="group" aria-label="Chế độ giao diện">
          <button
            type="button"
            className={themeMode === "light" ? "ade-btn ade-btn--primary" : "ade-btn"}
            onClick={() => onChangeTheme("light")}
          >
            Sáng
          </button>
          <button
            type="button"
            className={themeMode === "dark" ? "ade-btn ade-btn--primary" : "ade-btn"}
            onClick={() => onChangeTheme("dark")}
          >
            Tối
          </button>
          <button
            type="button"
            className={themeMode === "system" ? "ade-btn ade-btn--primary" : "ade-btn"}
            onClick={() => onChangeTheme("system")}
          >
            Hệ thống
          </button>
        </div>
      </header>

      <main>
        {healthQuery.isPending && (
          <div data-testid="health-loading" className="ade-panel">
            Đang kiểm tra kết nối Hub
          </div>
        )}

        {isForbiddenOrigin && (
          <section data-testid="error-403-panel" role="alert" className="ade-panel ade-panel--bad">
            {translateApiError("ERR_LOCAL_ORIGIN_ONLY")}
          </section>
        )}

        {healthQuery.isError && !isForbiddenOrigin && (
          <section data-testid="error-500-panel" role="alert" className="ade-panel ade-panel--warn">
            <h2 className="ade-head">Không thể kết nối tới ADE Hub</h2>
            <p>Kiểm tra lại tiến trình Hub và tệp SQLite trên máy local.</p>
            <button
              type="button"
              data-testid="retry-health-btn"
              className="ade-btn ade-btn--primary"
              disabled={healthQuery.isFetching}
              onClick={() => {
                void healthQuery.refetch();
              }}
            >
              Thử lại
            </button>
          </section>
        )}

        {healthQuery.isSuccess && !healthQuery.isError && (
          <section className="ade-panel">
            <p data-testid="health-status">
              <strong>Hub &amp; SQLite: Đã kết nối</strong>
            </p>
            <p data-testid="event-count" className="ade-mono">
              Số sự kiện đã ghi: {healthQuery.data.eventCount}
            </p>
            <p data-testid="hub-version" className="ade-mono">
              Phiên bản: {healthQuery.data.version}
            </p>
            <button
              type="button"
              data-testid="refresh-health-btn"
              className="ade-btn ade-btn--primary"
              disabled={healthQuery.isFetching}
              onClick={() => {
                void healthQuery.refetch();
              }}
            >
              Làm mới trạng thái
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
