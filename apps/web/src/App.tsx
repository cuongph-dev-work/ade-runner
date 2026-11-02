import { useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiRequestError, fetchHealth } from "./api/health.js";
import { fetchProjects } from "./api/chat.js";
import { ChatWorkspace } from "./components/ChatWorkspace.js";
import { SmokeShell, type ThemeMode } from "./components/SmokeShell.js";

function readInitialMode(): ThemeMode {
  const stored = window.localStorage.getItem("ade-theme-mode");
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return "system";
}

export function App(): JSX.Element {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readInitialMode);

  const applyThemeMode = (next: ThemeMode): void => {
    setThemeMode(next);
    if (next === "system") {
      window.localStorage.removeItem("ade-theme-mode");
      delete document.documentElement.dataset.mode;
    } else {
      window.localStorage.setItem("ade-theme-mode", next);
      document.documentElement.dataset.mode = next;
    }
  };

  const cycleThemeMode = (): void => {
    const order: ThemeMode[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(themeMode) + 1) % order.length]!;
    applyThemeMode(next);
  };

  const isSmokeRoute = window.location.pathname === "/smoke";

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: (failureCount, error) => {
      if (error instanceof ApiRequestError && error.status < 500) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: 100
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: !isSmokeRoute && healthQuery.isSuccess,
    retry: (failureCount, error) => {
      if (error instanceof ApiRequestError && error.status < 500) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: 100
  });

  if (
    isSmokeRoute ||
    healthQuery.isPending ||
    healthQuery.isError ||
    projectsQuery.isPending
  ) {
    return (
      <SmokeShell
        themeMode={themeMode}
        onChangeTheme={applyThemeMode}
        healthQuery={healthQuery}
      />
    );
  }

  if (projectsQuery.isError) {
    return (
      <div className="ade-shell">
        <section data-testid="error-500-panel" role="alert" className="ade-panel ade-panel--warn">
          <h2 className="ade-head">Không thể tải danh sách dự án</h2>
          <button
            type="button"
            data-testid="retry-projects-btn"
            className="ade-btn ade-btn--primary"
            onClick={() => {
              void projectsQuery.refetch();
            }}
          >
            Thử lại
          </button>
        </section>
      </div>
    );
  }

  const projects = projectsQuery.data ?? [];
  if (projects.length === 0) {
    return (
      <SmokeShell
        themeMode={themeMode}
        onChangeTheme={applyThemeMode}
        healthQuery={healthQuery}
      />
    );
  }

  return (
    <ChatWorkspace
      projects={projects}
      themeMode={themeMode}
      onCycleTheme={cycleThemeMode}
    />
  );
}
