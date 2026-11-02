import { describe, expect, it } from "vitest";
import {
  assemblePrompt,
  estimateTokens,
  TOOLS_HINT_TEXT
} from "../src/context/prompt-assembler.js";

describe("PromptAssembler — P6 Context Assembly", () => {
  const baseThread = {
    title: "Triển khai tính năng đăng nhập OTP",
    state: "building",
    summary: "Đã thiết kế schema DB và kiểm tra kết nối Redis."
  };

  const sampleMemory = [
    { fileName: "rules.md", content: "- Viết TypeScript nghiêm ngặt\n- Viết test Vitest" },
    { fileName: "api.md", content: "# API Docs\nPOST /api/auth/otp" }
  ];

  const sampleMessages = [
    { createdAt: "10:00", author: "Cuong PH", body: "Bắt đầu làm module auth nhé" },
    { createdAt: "10:01", author: "@coder", body: "Đang kiểm tra schema DB" }
  ];

  it("Khớp thứ tự 6 khối chuẩn XML và nội dung khi chưa vượt trần token", () => {
    const prompt = assemblePrompt({
      projectMemoryFiles: sampleMemory,
      thread: baseThread,
      recentMessages: sampleMessages,
      skill: {
        agentSkills: [{ name: "cook", description: "Viết mã chức năng" }]
      },
      task: "Viết hàm verifyOtp trong auth-service.ts"
    });

    // Kiểm tra thứ tự xuất hiện của các thẻ XML
    const idxMem = prompt.indexOf("<project_memory>");
    const idxThr = prompt.indexOf("<thread>");
    const idxMsg = prompt.indexOf("<recent_messages>");
    const idxSkl = prompt.indexOf("<skill>");
    const idxTsk = prompt.indexOf("<task>");
    const idxTls = prompt.indexOf("<tools_hint>");

    expect(idxMem).toBeGreaterThanOrEqual(0);
    expect(idxThr).toBeGreaterThan(idxMem);
    expect(idxMsg).toBeGreaterThan(idxThr);
    expect(idxSkl).toBeGreaterThan(idxMsg);
    expect(idxTsk).toBeGreaterThan(idxSkl);
    expect(idxTls).toBeGreaterThan(idxTsk);

    // Thứ tự file memory phải sắp xếp theo bảng chữ cái A-Z: api.md trước rules.md
    const idxApi = prompt.indexOf("### api.md");
    const idxRules = prompt.indexOf("### rules.md");
    expect(idxApi).toBeLessThan(idxRules);

    // Kiểm tra nội dung các khối
    expect(prompt).toContain("Title: Triển khai tính năng đăng nhập OTP");
    expect(prompt).toContain("Summary:\nĐã thiết kế schema DB và kiểm tra kết nối Redis.");
    expect(prompt).toContain("[10:00] Cuong PH: Bắt đầu làm module auth nhé");
    expect(prompt).toContain("cook: Viết mã chức năng");
    expect(prompt).toContain("<task>\nViết hàm verifyOtp trong auth-service.ts\n</task>");
    expect(prompt).toContain(TOOLS_HINT_TEXT);
  });

  it("Worker ở chế độ scope = brief thì khối recent_messages mang chuỗi chú thích brief", () => {
    const prompt = assemblePrompt({
      thread: baseThread,
      recentMessages: sampleMessages,
      scope: "brief",
      task: "Viết hàm helper"
    });

    expect(prompt).toContain(
      "<recent_messages>\n(chế độ brief — dùng ade.get_thread nếu được cấp full)\n</recent_messages>"
    );
    expect(prompt).not.toContain("Bắt đầu làm module auth nhé");
  });

  it("Khi không có file memory thì project_memory ghi (trống)", () => {
    const prompt = assemblePrompt({
      projectMemoryFiles: [],
      thread: { title: "Dự án mới", state: "planning", summary: null },
      task: "Lên kế hoạch"
    });

    expect(prompt).toContain("<project_memory>\n(trống)\n</project_memory>");
    expect(prompt).toContain("Summary:\n(chưa có tóm tắt)");
  });

  it("Khi vượt trần token, Bước 1 lược bớt recent_messages từ tin cũ nhất", () => {
    // 5 tin nhắn
    const manyMessages = [
      { createdAt: "09:00", author: "A", body: "Tin nhắn số 1 rất dài ".repeat(10) },
      { createdAt: "09:01", author: "B", body: "Tin nhắn số 2 rất dài ".repeat(10) },
      { createdAt: "09:02", author: "C", body: "Tin nhắn số 3 rất dài ".repeat(10) },
      { createdAt: "09:03", author: "D", body: "Tin nhắn số 4 rất dài ".repeat(10) },
      { createdAt: "09:04", author: "E", body: "Tin nhắn số 5 mới nhất" }
    ];

    // Đặt trần token nhỏ vừa đủ để phải cắt tin nhắn cũ nhưng chưa cần cắt memory
    const maxTokens = 200;
    const prompt = assemblePrompt({
      projectMemoryFiles: [{ fileName: "a.md", content: "Nội dung ngắn" }],
      thread: { title: "Test cắt tin nhắn", state: "active", summary: "Tóm tắt ngắn" },
      recentMessages: manyMessages,
      task: "Nhiệm vụ",
      maxTokens
    });

    expect(estimateTokens(prompt)).toBeLessThanOrEqual(maxTokens);
    // Tin số 1 cũ nhất đã bị loại bỏ
    expect(prompt).not.toContain("Tin nhắn số 1");
    // Khối thread và task được bảo toàn
    expect(prompt).toContain("Test cắt tin nhắn");
    expect(prompt).toContain("Nhiệm vụ");
  });

  it("Khi tin nhắn đã lược hết mà vẫn vượt token, Bước 2 cắt bớt project_memory và giữ nguyên các khối cốt lõi", () => {
    const hugeMemory = [
      { fileName: "a-guide.md", content: "Dữ liệu lớn ".repeat(300) },
      { fileName: "z-reference.md", content: "Tài liệu phụ ".repeat(200) }
    ];

    // maxTokens nhỏ (260 tokens = ~1040 chars)
    const maxTokens = 260;
    const prompt = assemblePrompt({
      projectMemoryFiles: hugeMemory,
      thread: { title: "Thread mục tiêu", state: "done", summary: "Tóm tắt" },
      recentMessages: sampleMessages,
      task: "Nhiệm vụ cốt lõi không được cắt",
      maxTokens
    });

    expect(estimateTokens(prompt)).toBeLessThanOrEqual(maxTokens);
    // recent_messages đã về placeholder cắt hết
    expect(prompt).toContain("[đã lược bớt tin nhắn cũ — dùng ade.get_thread để đọc đầy đủ]");
    // project_memory có ghi chú đã cắt bớt
    expect(prompt).toContain("[đã cắt bớt — dùng ade.read_memory để đọc đầy đủ]");
    // Thread và Task bảo toàn nguyên vẹn
    expect(prompt).toContain("<thread>\nTitle: Thread mục tiêu\nState: done\nSummary:\nTóm tắt\n</thread>");
    expect(prompt).toContain("<task>\nNhiệm vụ cốt lõi không được cắt\n</task>");
  });
});
