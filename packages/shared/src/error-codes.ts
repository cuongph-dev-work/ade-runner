import { z } from "zod";

export const ERROR_CODES = {
  ERR_LOCAL_ORIGIN_ONLY: {
    http: 403,
    defaultMessage: "ADE ở chế độ Solo chỉ cho phép truy cập từ localhost."
  },
  ERR_INTERNAL_ERROR: {
    http: 500,
    defaultMessage: "Đã xảy ra lỗi hệ thống nội bộ trên ADE Hub."
  },
  ERR_VALIDATION: {
    http: 422,
    defaultMessage: "Dữ liệu gửi lên không hợp lệ."
  },
  ERR_NOT_FOUND: {
    http: 404,
    defaultMessage: "Không tìm thấy dữ liệu yêu cầu."
  },
  ERR_INVALID_STATUS: {
    http: 400,
    defaultMessage: "Thao tác không hợp lệ với trạng thái hiện tại."
  },
  ERR_PROJECT_PATH_INVALID: {
    http: 400,
    defaultMessage: "Đường dẫn không tồn tại hoặc chưa khởi tạo Git."
  },
  ERR_PROJECT_ALREADY_EXISTS: {
    http: 409,
    defaultMessage: "Kho mã nguồn này đã được thêm vào ADE."
  },
  ERR_ADE_CONFIG_INVALID: {
    http: 422,
    defaultMessage: "Tệp cấu hình trong .ade/ không hợp lệ."
  },
  ERR_CHANNEL_NAME_EXISTS: {
    http: 409,
    defaultMessage: "Tên kênh đã tồn tại trong dự án này."
  },
  ERR_LAST_CHANNEL_DELETE: {
    http: 409,
    defaultMessage: "Dự án phải giữ lại ít nhất 1 kênh hoạt động."
  },
  ERR_RUNNER_UNAVAILABLE: {
    http: 503,
    defaultMessage: "Runner hoặc harness chưa sẵn sàng để khởi chạy agent."
  },
  ERR_CREDENTIAL_MODE_MISMATCH: {
    http: 400,
    defaultMessage: "Hồ sơ xác thực không được phép trong chế độ hiện tại."
  },
  ERR_PERMISSION_ALREADY_RESOLVED: {
    http: 409,
    defaultMessage: "Yêu cầu cấp quyền này đã được xử lý trước đó."
  },
  ERR_RUN_NOT_CANCELLABLE: {
    http: 409,
    defaultMessage: "Run đã kết thúc nên không thể huỷ."
  },
  ERR_RUN_TIMEOUT: {
    http: 408,
    defaultMessage: "Run đã vượt quá thời gian thực thi cho phép."
  },
  ERR_DRIVER_EXECUTION: {
    http: 500,
    defaultMessage: "Tiến trình thực thi agent gặp lỗi ngoài dự kiến."
  },
  ERR_MCP_TOKEN_INVALID: {
    http: 401,
    defaultMessage: "Token kết nối ADE MCP không hợp lệ."
  },
  ERR_MCP_TOKEN_EXPIRED: {
    http: 401,
    defaultMessage: "Token kết nối ADE MCP đã hết hiệu lực."
  },
  ERR_GRANT_REQUIRED: {
    http: 403,
    defaultMessage: "Agent chưa được cấp quyền truy cập ngữ cảnh của thread này."
  },
  ERR_FORBIDDEN_TOOL: {
    http: 403,
    defaultMessage: "Agent không có quyền sử dụng công cụ này."
  },
  ERR_QUESTION_TIMEOUT: {
    http: 408,
    defaultMessage: "Đã hết thời gian chờ người dùng trả lời câu hỏi."
  },
  ERR_QUESTION_ALREADY_RESOLVED: {
    http: 409,
    defaultMessage: "Câu hỏi này đã được trả lời trước đó."
  },
  ERR_LOOP_DEPTH_EXCEEDED: {
    http: 409,
    defaultMessage: "Đã chạm giới hạn độ sâu gọi agent tối đa (max_depth)."
  },
  ERR_CAUSATION_LIMIT_EXCEEDED: {
    http: 409,
    defaultMessage: "Rule engine đã tạm dừng do chuỗi sự kiện vượt quá giới hạn an toàn (20 bước)."
  },
  ERR_MAIN_AGENT_ONLY: {
    http: 403,
    defaultMessage: "Chỉ main agent hiện tại của thread mới được thực hiện thao tác này."
  },
  ERR_AGENT_CANNOT_BE_MAIN: {
    http: 400,
    defaultMessage: "Agent được chọn không có quyền làm main agent."
  },
  ERR_GATE_APPROVAL_REQUIRED: {
    http: 409,
    defaultMessage: "Không thể chuyển trạng thái khi cổng duyệt của người dùng chưa được chấp thuận."
  },
  ERR_APPROVAL_PENDING_LOCK: {
    http: 409,
    defaultMessage: "Thread đang chờ người dùng duyệt cổng hiện tại, chưa thể giao việc mới."
  },
  ERR_APPROVAL_ALREADY_DECIDED: {
    http: 409,
    defaultMessage: "Yêu cầu duyệt này đã được quyết định trước đó."
  },
  ERR_AGENT_HANDLE_EXISTS: {
    http: 409,
    defaultMessage: "Handle của agent đã tồn tại trong dự án."
  },
  ERR_SKILL_NAME_EXISTS: {
    http: 409,
    defaultMessage: "Tên skill đã tồn tại trong thư viện."
  },
  ERR_SKILL_IN_USE: {
    http: 409,
    defaultMessage: "Không thể xóa skill đang được gắn cho agent."
  },
  ERR_WORKFLOW_INVALID: {
    http: 422,
    defaultMessage: "Cấu hình workflow không hợp lệ (thiếu state khởi tạo hoặc tham chiếu sai state/agent)."
  },
  ERR_BUDGET_EXCEEDED: {
    http: 409,
    defaultMessage: "Đã vượt hạn mức ngân sách cho phép (budget_exceeded)."
  },
  ERR_MEMORY_PROPOSAL_DECIDED: {
    http: 409,
    defaultMessage: "Đề xuất ghi nhớ này đã được xử lý trước đó."
  }
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export const ErrorCodeSchema = z.enum(
  Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]]
);
