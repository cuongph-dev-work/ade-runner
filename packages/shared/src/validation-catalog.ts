export const MSG_TEMPLATES = {
  MSG01: "{field} là bắt buộc.",
  MSG02: "{field} không được vượt quá {max} ký tự.",
  MSG03: "{field} phải có ít nhất {min} ký tự.",
  MSG04: "Định dạng {field} không hợp lệ.",
  MSG06: "Đường dẫn {field} không tồn tại hoặc không phải kho Git hợp lệ.",
  MSG07: "Nội dung {field} không đúng cú pháp YAML.",
  MSG08: "Tên skill chỉ được gồm chữ thường, số và dấu gạch ngang (không chứa khoảng trắng, dấu ngoặc, dấu phẩy).",
  MSG14: "Đã lưu thay đổi.",
  MSG15: "Đã tạo thành công.",
  MSG16: "Đã gửi phản hồi duyệt."
} as const;

export type MsgCode = keyof typeof MSG_TEMPLATES;

export const FIELD_LABELS: Record<string, string> = {
  name: "Tên",
  projectName: "Tên dự án",
  repoPath: "Đường dẫn kho mã nguồn",
  defaultBranch: "Nhánh mặc định",
  defaultMainAgent: "Main agent mặc định",
  defaultWorkflow: "Workflow mặc định",
  channelName: "Tên kênh",
  title: "Tiêu đề",
  body: "Nội dung tin nhắn",
  handle: "Handle của agent",
  displayName: "Tên hiển thị",
  role: "Mô tả vai trò",
  harness: "Harness",
  model: "Model",
  credentialProfile: "Hồ sơ xác thực",
  skills: "Danh sách skill",
  maxDepth: "Độ sâu gọi tối đa",
  budgetUsd: "Ngân sách (USD)",
  timeoutS: "Thời gian chờ tối đa (giây)",
  skillName: "Tên skill",
  description: "Mô tả",
  skillContent: "Nội dung SKILL.md",
  sourcePath: "Đường dẫn nguồn",
  gitUrl: "Địa chỉ Git",
  workflowYaml: "Nội dung Workflow YAML",
  comment: "Ghi chú phản hồi",
  optionId: "Lựa chọn",
  answer: "Câu trả lời",
  targetFile: "Tên tệp memory",
  content: "Nội dung",
  reason: "Lý do đề xuất",
  emoji: "Biểu cảm",
  memberUserIds: "Danh sách đồng nghiệp",
  memberAgentIds: "Danh sách agent",
  messageId: "Mã tin nhắn",
  explorer: "Thẻ giải thích mã nguồn",
  topic: "Chủ đề giải thích",
  flowSteps: "Các bước luồng xử lý",
  traceSteps: "Nhật ký tra cứu",
  citations: "Danh sách trích dẫn mã nguồn",
  questions: "Danh sách câu hỏi làm rõ",
  answers: "Danh sách câu trả lời",
  otherText: "Câu trả lời khác"
};

export interface ValidationRuleItem {
  field: string;
  rule: string;
  msg?: MsgCode;
  params?: Record<string, string | number>;
}

export const VALIDATION_CATALOG = {
  "chat.channel.create": [
    { field: "channelName", rule: "trim" },
    { field: "channelName", rule: "required", msg: "MSG01" },
    { field: "channelName", rule: "max:80", msg: "MSG02", params: { max: 80 } }
  ],
  "chat.channel.update": [
    { field: "channelName", rule: "trim" },
    { field: "channelName", rule: "required", msg: "MSG01" },
    { field: "channelName", rule: "max:80", msg: "MSG02", params: { max: 80 } },
    { field: "description", rule: "trim" },
    { field: "description", rule: "max:300", msg: "MSG02", params: { max: 300 } },
    { field: "memberUserIds", rule: "array", msg: "MSG04" },
    { field: "memberAgentIds", rule: "array", msg: "MSG04" }
  ],
  "chat.thread.create": [
    { field: "body", rule: "trim" },
    { field: "body", rule: "required", msg: "MSG01" },
    { field: "body", rule: "max:20000", msg: "MSG02", params: { max: 20000 } },
    { field: "title", rule: "nullable" },
    { field: "title", rule: "trim" },
    { field: "title", rule: "max:200", msg: "MSG02", params: { max: 200 } }
  ],
  "chat.message.create": [
    { field: "body", rule: "trim" },
    { field: "body", rule: "required", msg: "MSG01" },
    { field: "body", rule: "max:20000", msg: "MSG02", params: { max: 20000 } }
  ],
  "chat.message.react": [
    { field: "emoji", rule: "required", msg: "MSG01" },
    { field: "emoji", rule: "in:👍,❤️,🔥,🚀,🎉,👀,✅,🙌", msg: "MSG04" }
  ]
} as const satisfies Record<string, readonly ValidationRuleItem[]>;

export type ValidationCatalogKey = keyof typeof VALIDATION_CATALOG;

export function collectRules(key: ValidationCatalogKey): readonly ValidationRuleItem[] {
  return VALIDATION_CATALOG[key];
}

export function resolveMsg(
  code: MsgCode,
  fieldKey?: string,
  params?: Record<string, string | number>
): string {
  let result: string = MSG_TEMPLATES[code];
  const label = fieldKey ? (FIELD_LABELS[fieldKey] ?? fieldKey) : "";
  result = result.replace("{field}", label);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
}
