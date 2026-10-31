import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { ApprovalGateCard } from "../ApprovalGateCard.js";

describe("ApprovalGateCard component", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders pending approval gate with approve and revise buttons", async () => {
    const onDecision = vi.fn();
    render(
      <ApprovalGateCard
        card={{
          approval_id: "appr_01",
          gate: "plan",
          version: 1,
          title: "Cổng duyệt PLAN v1",
          summary: "Phương án triển khai chi tiết",
          status: "pending",
          target_state: "spec_review",
        }}
        threadId="thr_01"
        onDecision={onDecision}
      />
    );

    expect(screen.getByText("Cổng duyệt PLAN v1")).toBeDefined();
    expect(screen.getByText("Chờ duyệt")).toBeDefined();
    expect(screen.getByText("Phương án triển khai chi tiết")).toBeDefined();

    const approveBtn = screen.getByTestId("btn-approve-gate");
    fireEvent.click(approveBtn);
    expect(onDecision).toHaveBeenCalledWith({
      approvalId: "appr_01",
      decision: "approve",
    });
  });

  it("handles changes requested with feedback input", async () => {
    const onDecision = vi.fn();
    render(
      <ApprovalGateCard
        card={{
          approval_id: "appr_02",
          gate: "plan",
          version: 2,
          title: "Cổng duyệt PLAN v2",
          summary: "Phương án v2",
          status: "pending",
        }}
        threadId="thr_01"
        onDecision={onDecision}
      />
    );

    const reviseBtn = screen.getByTestId("btn-revise-gate");
    fireEvent.click(reviseBtn);

    const textarea = screen.getByTestId("gate-feedback-input");
    fireEvent.change(textarea, { target: { value: "Cần bổ sung thêm unit test" } });

    const submitBtn = screen.getByTestId("btn-submit-feedback");
    fireEvent.click(submitBtn);

    expect(onDecision).toHaveBeenCalledWith({
      approvalId: "appr_02",
      decision: "changes_requested",
      feedback: "Cần bổ sung thêm unit test",
    });
  });

  it("renders approved status", () => {
    render(
      <ApprovalGateCard
        card={{
          approval_id: "appr_03",
          gate: "spec",
          version: 1,
          title: "Cổng duyệt SPEC v1",
          summary: "Đặc tả kỹ thuật",
          status: "approved",
          decided_by: "Cuong",
        }}
        threadId="thr_01"
        onDecision={vi.fn()}
      />
    );

    expect(screen.getByText("Đã duyệt")).toBeDefined();
    expect(screen.getByTestId("approval-resolved-msg").textContent).toContain("Cuong");
  });
});
