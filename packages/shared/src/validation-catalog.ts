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
  otherText: "Câu trả lời khác",
  decision: "Quyết định",
  threadId: "Mã thread",
  runId: "Mã phiên chạy",
  requestId: "Mã yêu cầu quyền",
  projectId: "Mã dự án"
};

export interface ValidationRuleItem {
  id: string;
  field: string;
  jsonField: string;
  rule: string;
  msg?: MsgCode;
  params?: Record<string, string | number>;
}

export const ALLOWED_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "🔥",
  "🚀",
  "🎉",
  "👀",
  "✅",
  "🙌"
] as const;

export type ReactionEmoji = (typeof ALLOWED_REACTION_EMOJIS)[number];

export const VALIDATION_CATALOG = {
  "chat.channel.create": [
    { id: "V-01", field: "channelName", jsonField: "name", rule: "trim" },
    { id: "V-02", field: "channelName", jsonField: "name", rule: "required", msg: "MSG01" },
    { id: "V-03", field: "channelName", jsonField: "name", rule: "max:80", msg: "MSG02", params: { max: 80 } },
    { id: "V-04", field: "channelName", jsonField: "name", rule: "regex:^[a-z0-9][a-z0-9-_]*$", msg: "MSG04" },
    { id: "V-05", field: "description", jsonField: "description", rule: "nullable" },
    { id: "V-06", field: "description", jsonField: "description", rule: "trim" },
    { id: "V-07", field: "description", jsonField: "description", rule: "max:300", msg: "MSG02", params: { max: 300 } }
  ],
  "chat.channel.update": [
    { id: "V-08", field: "channelName", jsonField: "name", rule: "trim" },
    { id: "V-09", field: "channelName", jsonField: "name", rule: "required", msg: "MSG01" },
    { id: "V-10", field: "channelName", jsonField: "name", rule: "max:80", msg: "MSG02", params: { max: 80 } },
    { id: "V-11", field: "channelName", jsonField: "name", rule: "regex:^[a-z0-9][a-z0-9-_]*$", msg: "MSG04" },
    { id: "V-12", field: "description", jsonField: "description", rule: "nullable" },
    { id: "V-13", field: "description", jsonField: "description", rule: "trim" },
    { id: "V-14", field: "description", jsonField: "description", rule: "max:300", msg: "MSG02", params: { max: 300 } },
    { id: "V-15", field: "memberUserIds", jsonField: "memberUserIds", rule: "nullable" },
    { id: "V-16", field: "memberUserIds", jsonField: "memberUserIds", rule: "array", msg: "MSG04" },
    { id: "V-17", field: "memberAgentIds", jsonField: "memberAgentIds", rule: "nullable" },
    { id: "V-18", field: "memberAgentIds", jsonField: "memberAgentIds", rule: "array", msg: "MSG04" }
  ],
  "chat.thread.create": [
    { id: "V-19", field: "body", jsonField: "body", rule: "trim" },
    { id: "V-20", field: "body", jsonField: "body", rule: "required", msg: "MSG01" },
    { id: "V-21", field: "body", jsonField: "body", rule: "max:20000", msg: "MSG02", params: { max: 20000 } },
    { id: "V-22", field: "title", jsonField: "title", rule: "nullable" },
    { id: "V-23", field: "title", jsonField: "title", rule: "trim" },
    { id: "V-24", field: "title", jsonField: "title", rule: "max:200", msg: "MSG02", params: { max: 200 } }
  ],
  "chat.message.create": [
    { id: "V-25", field: "body", jsonField: "body", rule: "trim" },
    { id: "V-26", field: "body", jsonField: "body", rule: "required", msg: "MSG01" },
    { id: "V-27", field: "body", jsonField: "body", rule: "max:20000", msg: "MSG02", params: { max: 20000 } }
  ],
  "chat.message.react": [
    { id: "V-28", field: "emoji", jsonField: "emoji", rule: "required", msg: "MSG01" },
    { id: "V-29", field: "emoji", jsonField: "emoji", rule: "in:👍,❤️,🔥,🚀,🎉,👀,✅,🙌", msg: "MSG04" }
  ],
  "runner.permission.reply": [
    { id: "V-01", field: "optionId", jsonField: "optionId", rule: "trim" },
    { id: "V-02", field: "optionId", jsonField: "optionId", rule: "required", msg: "MSG01" },
    { id: "V-03", field: "optionId", jsonField: "optionId", rule: "min:1", msg: "MSG01" },
    { id: "V-04", field: "optionId", jsonField: "optionId", rule: "max:64", msg: "MSG02", params: { max: 64 } },
    { id: "V-05", field: "decision", jsonField: "decision", rule: "required", msg: "MSG01" },
    { id: "V-06", field: "decision", jsonField: "decision", rule: "in:allow,deny", msg: "MSG04" }
  ]
} as const satisfies Record<string, readonly ValidationRuleItem[]>;

export const RUNNER_PERMISSION_REPLY_RULES = [
  { id: "V-01", field: "optionId", label: "Lựa chọn", rule: "trim", msgCode: null },
  { id: "V-02", field: "optionId", label: "Lựa chọn", rule: "required", msgCode: "MSG01" },
  { id: "V-03", field: "optionId", label: "Lựa chọn", rule: "min:1", msgCode: "MSG01" },
  { id: "V-04", field: "optionId", label: "Lựa chọn", rule: "max:64", msgCode: "MSG02" },
  { id: "V-05", field: "decision", label: "Quyết định", rule: "required", msgCode: "MSG01" },
  { id: "V-06", field: "decision", label: "Quyết định", rule: "in:allow,deny", msgCode: "MSG04" }
] as const;

export const RUNNER_PATH_PARAM_RULES = [
  { id: "V-07", field: "threadId", label: "Mã thread", rule: "regex:^thr_[a-zA-Z0-9_-]{2,32}$", msgCode: "MSG04" },
  { id: "V-08", field: "runId", label: "Mã phiên chạy", rule: "regex:^run_[a-zA-Z0-9_-]{2,32}$", msgCode: "MSG04" },
  { id: "V-09", field: "requestId", label: "Mã yêu cầu quyền", rule: "regex:^req_[a-zA-Z0-9_-]{2,32}$", msgCode: "MSG04" },
  { id: "V-10", field: "projectId", label: "Mã dự án", rule: "regex:^prj_[a-zA-Z0-9_-]{2,32}$", msgCode: "MSG04" }
] as const;

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

export interface FieldValidationIssue {
  code: MsgCode;
  message: string;
}

export type FieldErrorMap = Record<string, FieldValidationIssue[]>;

export function validateByCatalog(
  key: ValidationCatalogKey,
  rawInput: Record<string, unknown>
): { ok: true; normalized: Record<string, unknown> } | { ok: false; fieldErrors: FieldErrorMap } {
  const rules = collectRules(key);
  const normalized: Record<string, unknown> = { ...rawInput };
  const fieldErrors: FieldErrorMap = {};
  const nullableFields = new Set<string>();

  for (const item of rules) {
    if (item.rule === "nullable") {
      nullableFields.add(item.jsonField);
    }
  }

  for (const item of rules) {
    const target = item.jsonField;
    if ((fieldErrors[target]?.length ?? 0) > 0) {
      continue;
    }

    const current = normalized[target];

    if (item.rule === "nullable") {
      continue;
    }

    if (item.rule === "trim") {
      if (typeof current === "string") {
        normalized[target] = current.trim();
      }
      continue;
    }

    if ((current === undefined || current === null) && nullableFields.has(target)) {
      continue;
    }

    if (item.rule === "required") {
      const missing =
        current === undefined ||
        current === null ||
        (typeof current === "string" && current.length === 0);
      if (missing && item.msg) {
        fieldErrors[target] = [{ code: item.msg, message: resolveMsg(item.msg, item.field, item.params) }];
      }
      continue;
    }

    if (item.rule === "array") {
      if (!Array.isArray(current) && item.msg) {
        fieldErrors[target] = [{ code: item.msg, message: resolveMsg(item.msg, item.field, item.params) }];
      }
      continue;
    }

    if (item.rule.startsWith("max:")) {
      const maxLen = Number(item.rule.slice(4));
      if (typeof current !== "string") {
        if (item.msg) {
          fieldErrors[target] = [{ code: "MSG04", message: resolveMsg("MSG04", item.field) }];
        }
      } else if (current.length > maxLen && item.msg) {
        fieldErrors[target] = [
          { code: item.msg, message: resolveMsg(item.msg, item.field, { max: maxLen }) }
        ];
      }
      continue;
    }

    if (item.rule.startsWith("regex:")) {
      const pattern = new RegExp(item.rule.slice(6));
      if (typeof current === "string" && current.length > 0 && !pattern.test(current) && item.msg) {
        fieldErrors[target] = [{ code: item.msg, message: resolveMsg(item.msg, item.field, item.params) }];
      }
      continue;
    }

    if (item.rule.startsWith("in:")) {
      const allowed = item.rule.slice(3).split(",");
      if ((typeof current !== "string" || !allowed.includes(current)) && item.msg) {
        fieldErrors[target] = [{ code: item.msg, message: resolveMsg(item.msg, item.field, item.params) }];
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, normalized };
}
