import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { QuestionCard } from "../QuestionCard.js";
import { ExplorerCard } from "../ExplorerCard.js";
import type { QuestionCardPayload, ExplorerCardPayload } from "@ade/shared";

describe("P3 UI Cards: QuestionCard & ExplorerCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("QuestionCard: renders single-choice options and fires onReplyQuestion on submit", async () => {
    const onReply = vi.fn().mockResolvedValue(undefined);
    const card: QuestionCardPayload = {
      question_id: "q_123",
      source: "mcp",
      run_id: "run_test_01",
      agent_handle: "@clarifier",
      question: "Chọn kiến trúc lưu trữ token?",
      options: [
        { id: "opt_sqlite", label: "SQLite Drizzle", description: "Lưu local vào ade.db" } as any,
        { id: "opt_file", label: "File JSON", description: "Lưu vào thư mục cấu hình" } as any,
      ],
      questions: [],
      status: "pending",
      selected_option_id: null,
      answer: null,
      answers: [],
      answered_by: null,
      answered_at: null,
      expires_at: null,
    };

    render(<QuestionCard card={card} onReplyQuestion={onReply} />);

    expect(screen.getByTestId("question-card-q_123")).toBeDefined();
    expect(screen.getByText("Chọn kiến trúc lưu trữ token?")).toBeDefined();

    // Click option SQLite
    const optSqlite = screen.getByTestId("question-option-opt_sqlite");
    fireEvent.click(optSqlite);

    // Click submit
    const submitBtn = screen.getByTestId("question-submit-btn");
    fireEvent.click(submitBtn);

    expect(onReply).toHaveBeenCalledWith({
      questionId: "q_123",
      answer: "opt_sqlite",
      optionId: "opt_sqlite",
    });
  });

  it("QuestionCard: renders answered status with read-only badge", () => {
    const card: QuestionCardPayload = {
      question_id: "q_done",
      source: "mcp",
      run_id: "run_test_01",
      agent_handle: "@clarifier",
      question: "Đã chọn phương án?",
      options: [{ id: "opt_1", label: "Phương án A", description: null } as any],
      questions: [],
      status: "answered",
      selected_option_id: "opt_1",
      answer: "Phương án A",
      answers: [],
      answered_by: "usr_cuong",
      answered_at: "2026-10-31T20:00:00.000Z",
      expires_at: null,
    };

    render(<QuestionCard card={card} />);
    expect(screen.getByText("Đã trả lời")).toBeDefined();
    expect(screen.queryByTestId("question-submit-btn")).toBeNull();
  });

  it("ExplorerCard: renders topic, summary, flow steps and expandable citations", () => {
    const card: ExplorerCardPayload = {
      cardType: "explorer",
      agent_handle: "@exploder",
      topic: "Truy vết luồng cấp phát token MCP",
      flow_steps: [
        "1. Tạo token Bearer: Caller gửi token trong header",
        "2. Kiểm tra quyền grant: Xác minh agent có trong thread_agents",
      ],
      trace_steps: [],
      citations: [
        {
          file: "apps/hub/src/mcp/mcp-server.ts",
          start_line: 45,
          end_line: 55,
          role: "declaration",
          snippet: "const grant = grantService.hasActiveGrant(agentId, threadId);",
          note: "Hàm kiểm tra grant",
        },
      ],
      cost_usd: 0.0025,
      duration_ms: 1250,
    };

    render(<ExplorerCard card={card} />);
    expect(screen.getByTestId("explorer-card")).toBeDefined();
    expect(screen.getByText("Truy vết luồng cấp phát token MCP")).toBeDefined();

    // Toggle citation snippet
    const citationBtn = screen.getByTestId("explorer-toggle-citations");
    fireEvent.click(citationBtn);
    expect(screen.getByText("apps/hub/src/mcp/mcp-server.ts#L45-L55")).toBeDefined();
    expect(screen.getByText(/const grant = grantService/)).toBeDefined();
  });
});
