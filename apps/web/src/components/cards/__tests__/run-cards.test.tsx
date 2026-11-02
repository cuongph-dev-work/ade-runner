import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LiveCard } from "../LiveCard";
import { PermissionCard } from "../PermissionCard";
import {
  computeThreadRunSummary,
  isAgentRunning,
  shouldShowThreadReplyBar,
} from "../run-presence";

describe("UI-RN-01 LiveCard, PermissionCard & Run Presence", () => {
  afterEach(() => {
    cleanup();
  });
  it("AC-UI-RN-01-02 & AC-UI-RN-01-10: đóng/mở danh sách bước với aria-expanded + max-h-[240px] và hiển thị mã lỗi khi failed", () => {
    render(
      <LiveCard
        currentUserId="usr_local"
        currentUserRole="owner"
        onCancelRun={vi.fn()}
        card={{
          cardType: "live_card",
          runId: "run_01JBCDEF0123456789ABCDEFGH",
          agentId: "agt_01JBCDEF0123456789ABCDEFGH",
          agentHandle: "@coder",
          agentDisplayName: "Coder",
          invokedBy: "usr_local",
          runnerMachineName: "Cuong-MBP",
          status: "failed",
          plan: [],
          toolCalls: [],
          steps: [{ text: "Bước 1", step: 1, percent: 20 }],
          lastMessageText: "",
          outcome: null,
          stopReason: "budget_exceeded",
          errorCode: "ERR_BUDGET_EXCEEDED",
          costUsd: 0.09,
          startedAt: "2026-10-31T06:00:00.000Z",
          endedAt: "2026-10-31T06:00:05.000Z",
        }}
      />,
    );

    expect(screen.getByTestId("live-card-status").textContent).toBe("Thất bại");
    expect(screen.getByTestId("live-card-footer").textContent).toContain("ERR_BUDGET_EXCEEDED");
    expect(screen.getByTestId("live-card-footer").textContent).toContain("5.0s");
    const toggleBtn = screen.getByTestId("live-card-toggle-steps");
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("live-card-steps").className).toContain("max-h-[240px]");
    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("live-card-steps")).toBeNull();
  });

  it("AC-UI-RN-01-09: hiển thị MSG01 ở client và MSG04 khi server trả lỗi 422 optionId không khớp", async () => {
    const onReply = vi.fn().mockRejectedValue({ validationCode: "MSG04" });
    const { rerender } = render(
      <PermissionCard
        currentUserId="usr_local"
        currentUserRole="owner"
        onReplyPermission={onReply}
        card={{
          cardType: "tool_permission",
          runId: "run_01JBCDEF0123456789ABCDEFGH",
          requestId: "req_01JBCDEF0123456789ABCDEFGH",
          agentHandle: "@coder",
          invokedBy: "usr_local",
          tool: "Bash",
          args: { command: "npm test" },
          displayCommand: "Bash: npm test",
          options: [
            { id: "   ", label: "Cho phép", decision: "allow" },
            { id: "deny", label: "Từ chối", decision: "deny" },
          ],
          status: "pending",
          selectedOptionId: null,
          decidedBy: null,
          decidedAt: null,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("permission-approve-btn"));
    expect(screen.getByTestId("permission-validation-error").textContent).toContain("MSG01");

    rerender(
      <PermissionCard
        currentUserId="usr_local"
        currentUserRole="owner"
        onReplyPermission={onReply}
        card={{
          cardType: "tool_permission",
          runId: "run_01JBCDEF0123456789ABCDEFGH",
          requestId: "req_01JBCDEF0123456789ABCDEFGH",
          agentHandle: "@coder",
          invokedBy: "usr_local",
          tool: "Bash",
          args: { command: "npm test" },
          displayCommand: "Bash: npm test",
          options: [
            { id: "opt_khong_ton_tai", label: "Cho phép", decision: "allow" },
            { id: "deny", label: "Từ chối", decision: "deny" },
          ],
          status: "pending",
          selectedOptionId: null,
          decidedBy: null,
          decidedAt: null,
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("permission-approve-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("permission-validation-error").textContent).toContain("MSG04");
    });
  });

  it("AC-UI-RN-01-01, AC-UI-RN-01-12 & AC-UI-RN-01-13: hiển thị nhãn BOT, chip .ade-mention--agent, dấu .ade-gate-mark, ẩn nút thao tác với khách và tính đúng thanh tóm tắt run trên kênh (kể cả khi replyCount = 0) + chấm Sidebar", () => {
    render(
      <>
        <LiveCard
          currentUserId="usr_guest"
          currentUserRole="member"
          onCancelRun={vi.fn()}
          card={{
            cardType: "live_card",
            runId: "run_01JBCDEF0123456789ABCDEFGH",
            agentId: "agt_01JBCDEF0123456789ABCDEFGH",
            agentHandle: "@coder",
            agentDisplayName: "Coder",
            invokedBy: "usr_local",
            runnerMachineName: null,
            status: "queued",
            plan: [],
            toolCalls: [],
            steps: [],
            lastMessageText: "",
            outcome: null,
            stopReason: null,
            errorCode: null,
            costUsd: 0,
            startedAt: null,
            endedAt: null,
          }}
        />
        <PermissionCard
          currentUserId="usr_guest"
          currentUserRole="member"
          onReplyPermission={vi.fn()}
          card={{
            cardType: "tool_permission",
            runId: "run_01JBCDEF0123456789ABCDEFGH",
            requestId: "req_01JBCDEF0123456789ABCDEFGH",
            agentHandle: "@coder",
            invokedBy: "usr_local",
            tool: "Bash",
            args: { command: "npm test" },
            displayCommand: "Bash: npm test",
            options: [
              { id: "allow", label: "Cho phép", decision: "allow" },
              { id: "deny", label: "Từ chối", decision: "deny" },
            ],
            status: "pending",
            selectedOptionId: null,
            decidedBy: null,
            decidedAt: null,
          }}
        />
      </>,
    );

    expect(screen.getByTestId("agent-bot-badge").textContent).toBe("BOT");
    expect(screen.getByTestId("live-card").querySelector(".ade-mention--agent")?.textContent).toBe(
      "@coder",
    );
    expect(screen.getByTestId("live-card").textContent).toContain("· chờ runner");
    expect(screen.getByTestId("permission-card").className).toContain("ade-gate-card");
    expect(screen.getByTestId("permission-gate-mark").className).toContain("ade-gate-mark");
    expect(screen.queryByRole("button", { name: "Huỷ run" })).toBeNull();
    expect(screen.queryByTestId("permission-approve-btn")).toBeNull();
    expect(screen.queryByTestId("permission-deny-btn")).toBeNull();

    const activeRuns = [
      {
        agentHandle: "@coder",
        status: "waiting_permission" as const,
        pendingPermissionTool: "Bash",
      },
    ];
    expect(isAgentRunning(activeRuns, "@coder")).toBe(true);
    expect(shouldShowThreadReplyBar(0, activeRuns)).toBe(true);
    expect(computeThreadRunSummary(activeRuns)).toBe("@coder: Chờ cấp quyền Bash");

    const settledRuns = [
      {
        agentHandle: "@coder",
        status: "completed" as const,
        pendingPermissionTool: null,
      },
    ];
    expect(shouldShowThreadReplyBar(0, settledRuns)).toBe(false);
    expect(shouldShowThreadReplyBar(2, settledRuns)).toBe(true);
    expect(computeThreadRunSummary(settledRuns)).toBeNull();
  });
});
