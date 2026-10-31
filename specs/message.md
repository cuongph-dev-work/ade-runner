# Message & Error Catalog — ADE Solo MVP

**SSOT** mã thông báo kiểm tra hợp lệ (`MSG*`) và mã lỗi nghiệp vụ (`ERR_*`) dùng chung cho mọi UI/API DD và mã nguồn trong `ade-runner`.

| Tầng | Đường dẫn dự kiến |
| --- | --- |
| Spec (đọc/duyệt) | `specs/message.md` (file này) |
| Validation catalog (Zod + rule) | `packages/shared/src/validation-catalog.ts` |
| Mã lỗi API & MCP (`ERROR_CODES`) | `packages/shared/src/error-codes.ts` |
| Bản dịch UI tiếng Việt | `apps/web/src/i18n/vi.ts` (`translateApiError`, `resolveMsg`) |

UI và Hub **không** hardcode chuỗi lỗi rời rạc; mọi thông báo đều tra qua `MSG*` hoặc `ERR_*`.

---

## 1. Message template (`MSG*`)

| Mã | Template tiếng Việt | Dùng khi |
| --- | --- | --- |
| **MSG01** | `{field} là bắt buộc.` | `required` · `min:1` (chuỗi rỗng sau khi `trim`) |
| **MSG02** | `{field} không được vượt quá {max} ký tự.` | `max:N` (độ dài chuỗi) |
| **MSG03** | `{field} phải có ít nhất {min} ký tự.` | `min:N` (`N > 1`, độ dài chuỗi) |
| **MSG04** | `Định dạng {field} không hợp lệ.` | `regex:...` · `integer` · `number` · `boolean` · `in:...` · `min:N`/`max:N` (giá trị số) |
| **MSG06** | `Đường dẫn {field} không tồn tại hoặc không phải kho Git hợp lệ.` | Kiểm tra `repoPath` phía client/form |
| **MSG07** | `Nội dung {field} không đúng cú pháp YAML.` | Kiểm tra cú pháp YAML trong editor Workflow / Config |
| **MSG08** | `Tên skill chỉ được gồm chữ thường, số và dấu gạch ngang (không chứa khoảng trắng, dấu ngoặc, dấu phẩy).` | `regex:^[a-z0-9]+(?:-[a-z0-9]+)*$` trên tên skill |
| **MSG14** | `Đã lưu thay đổi.` | Toast thành công khi cập nhật cấu hình / memory / workflow |
| **MSG15** | `Đã tạo thành công.` | Toast thành công khi tạo project / channel / thread / agent / skill |
| **MSG16** | `Đã gửi phản hồi duyệt.` | Toast thành công khi bấm nút trên Approval Card / Permission Card / Memory Card |

`{field}` được thay bằng nhãn tiếng Việt trong bảng §2 (không hiển thị tên biến kỹ thuật thô lên giao diện).

---

## 2. Nhãn trường (`FIELD_LABELS`)

| Key kỹ thuật | Nhãn tiếng Việt (`{field}`) |
| --- | --- |
| `name` | Tên |
| `projectName` | Tên dự án |
| `repoPath` | Đường dẫn kho mã nguồn |
| `defaultBranch` | Nhánh mặc định |
| `defaultMainAgent` | Main agent mặc định |
| `defaultWorkflow` | Workflow mặc định |
| `channelName` | Tên kênh |
| `title` | Tiêu đề |
| `body` | Nội dung tin nhắn |
| `handle` | Handle của agent |
| `displayName` | Tên hiển thị |
| `role` | Mô tả vai trò |
| `harness` | Harness |
| `model` | Model |
| `credentialProfile` | Hồ sơ xác thực |
| `skills` | Danh sách skill |
| `maxDepth` | Độ sâu gọi tối đa |
| `budgetUsd` | Ngân sách (USD) |
| `timeoutS` | Thời gian chờ tối đa (giây) |
| `skillName` | Tên skill |
| `description` | Mô tả |
| `skillContent` | Nội dung SKILL.md |
| `sourcePath` | Đường dẫn nguồn |
| `gitUrl` | Địa chỉ Git |
| `workflowYaml` | Nội dung Workflow YAML |
| `comment` | Ghi chú phản hồi |
| `optionId` | Lựa chọn |
| `answer` | Câu trả lời |
| `targetFile` | Tên tệp memory |
| `content` | Nội dung |
| `reason` | Lý do đề xuất |
| `decision` | Quyết định |
| `scope` | Phạm vi ngữ cảnh |
| `task` | Nhiệm vụ giao việc |
| `expects` | Kết quả kỳ vọng |
| `kind` | Loại cổng duyệt |
| `runId` | Mã phiên chạy |
| `limit` | Giới hạn số dòng |
| `inputs` | Dữ liệu đầu vào |
| `delegationId` | Mã đợt giao việc |
| `artifacts` | Tài liệu đính kèm |
| `options` | Danh sách lựa chọn |
| `to` | Trạng thái đích |
| `reasonText` | Lý do chuyển trạng thái |
| `agent` | Agent nhận việc |
| `threadId` | Mã thread |
| `projectId` | Mã dự án |
| `channelId` | Mã kênh |
| `requestId` | Mã yêu cầu quyền |
| `questionId` | Mã câu hỏi |
| `approvalId` | Mã yêu cầu duyệt |
| `proposalId` | Mã đề xuất ghi nhớ |
| `workflowId` | Mã workflow |
| `fileName` | Tên tệp |
| `status` | Trạng thái |
| `summary` | Bản tóm tắt |
| `decisions` | Danh sách quyết định |
| `text` | Nội dung |
| `step` | Bước thực hiện |
| `percent` | Phần trăm tiến độ |
| `question` | Câu hỏi |
| `query` | Từ khóa truy vấn |
| `includeMessages` | Số lượng tin nhắn đính kèm |
| `avatar` | Avatar |
| `zipBase64` | Tệp nén ZIP |
| `mode` | Chế độ nhập |
| `overwrite` | Ghi đè |
| `templateId` | Bộ mẫu agent |
| `useRepoInstructions` | Dùng hướng dẫn của kho mã nguồn |
| `agentId` | Mã agent |
| `write` | Quyền ghi |
| `canBeMain` | Quyền main agent |
| `enabled` | Trạng thái bật |
| `mcpAllow` | Danh sách công cụ MCP |
| `emoji` | Biểu cảm |
| `memberUserIds` | Danh sách đồng nghiệp |
| `memberAgentIds` | Danh sách agent |
| `messageId` | Mã tin nhắn |
| `explorer` | Thẻ giải thích mã nguồn |
| `topic` | Chủ đề giải thích |
| `flowSteps` | Các bước luồng xử lý |
| `traceSteps` | Nhật ký tra cứu |
| `citations` | Danh sách trích dẫn mã nguồn |
| `questions` | Danh sách câu hỏi làm rõ |
| `answers` | Danh sách câu trả lời |
| `otherText` | Câu trả lời khác |

---

## 3. Rule tokens (cột “Quy tắc kiểm tra” trong DD)

Mỗi dòng bảng Validate chỉ ghi **đúng một** rule token:

| Rule token | Ý nghĩa | Mã MSG mặc định |
| --- | --- | --- |
| `required` | Bắt buộc có mặt và khác rỗng | `MSG01` |
| `trim` | Cắt khoảng trắng hai đầu trước khi kiểm tra | `—` |
| `min:1` | Chuỗi sau `trim` có độ dài ≥ 1 | `MSG01` |
| `min:N` (chuỗi, `N > 1`) | Độ dài chuỗi ≥ `N` | `MSG03` |
| `max:N` (chuỗi) | Độ dài chuỗi ≤ `N` | `MSG02` |
| `min:N` (số) | Giá trị số ≥ `N` | `MSG04` |
| `max:N` (số) | Giá trị số ≤ `N` | `MSG04` |
| `integer` | Số nguyên | `MSG04` |
| `number` | Số thực hợp lệ (không `NaN`/`Infinity`) | `MSG04` |
| `boolean` | Kiểu logic `true` / `false` | `MSG04` |
| `array` | Giá trị phải là mảng JSON hợp lệ | `MSG04` |
| `in:a,b,c` | Thuộc tập giá trị liệt kê | `MSG04` |
| `regex:<pattern>` | Khớp biểu thức chính quy | `MSG04` (riêng `skillName` dùng `MSG08`) |
| `yaml` | Cú pháp YAML parse thành công | `MSG07` |
| `nullable` | Cho phép `null` hoặc bỏ qua trường tùy chọn | `—` |

---

## 4. Danh mục `VALIDATION_CATALOG` (`packages/shared`)

| Catalog key | Module / Phase | Dùng ở |
| --- | --- | --- |
| `chat.channel.create` | `chat` (P1) | `POST /api/projects/:projectId/channels`, modal tạo channel |
| `chat.channel.update` | `chat` (P1) | `PATCH /api/channels/:channelId`, modal cài đặt channel |
| `chat.thread.create` | `chat` (P1) | `POST /api/channels/:channelId/threads`, khung nhập tin nhắn gốc của channel |
| `chat.message.create` | `chat` (P1) | `POST /api/threads/:threadId/messages`, khung nhập phản hồi trong thread |
| `chat.message.react` | `chat` (P1) | `POST /api/messages/:messageId/reactions`, thanh biểu cảm trên tin nhắn |
| `runner.permission.reply` | `runner` (P2) | `POST /api/runs/:runId/permissions/:requestId/reply`, Permission Card |
| `trigger.question.reply` | `trigger` (P3) | `POST /api/threads/:threadId/questions/:questionId/reply`, Question Card |
| `trigger.mcp.reportOutcome` | `trigger` (P3) | MCP tool `report_outcome` |
| `trigger.mcp.postProgress` | `trigger` (P3) | MCP tool `post_progress` |
| `trigger.mcp.postMessage` | `trigger` (P3) | MCP tool `post_message` |
| `trigger.mcp.askHuman` | `trigger` (P3) | MCP tool `ask_human` |
| `trigger.mcp.readMemory` | `trigger` (P3) | MCP tool `read_memory` |
| `trigger.mcp.getThread` | `trigger` (P3) | MCP tool `get_thread` |
| `trigger.mcp.loadSkill` | `trigger` (P3) | MCP tool `load_skill` |
| `trigger.mcp.setState` | `trigger` (P3) | MCP tool `set_state` |
| `orchestration.approval.decide` | `orchestration` (P4) | `POST /api/approvals/:approvalId/decide`, Approval Gate Card |
| `orchestration.mcp.delegate` | `orchestration` (P4) | MCP tool `delegate` |
| `orchestration.mcp.getResults` | `orchestration` (P4) | MCP tool `get_results` |
| `orchestration.mcp.requestApproval` | `orchestration` (P4) | MCP tool `request_approval` |
| `orchestration.mcp.getRunLog` | `orchestration` (P4) | MCP tool `get_run_log` |
| `orchestration.mcp.writeScratchpad` | `orchestration` (P4) | MCP tool `write_scratchpad` |
| `orchestration.chat.command` | `orchestration` (P4) | Slash commands `/main`, `/approve`, `/revise` |
| `settings.project.create` | `settings` (P5) | `POST /api/projects` (Wizard 3 bước) |
| `settings.project.update` | `settings` (P5) | `PATCH /api/projects/:projectId/general`, Tab General |
| `settings.agent.upsert` | `settings` (P5) | `POST` / `PUT` `/api/projects/:projectId/agents`, Form Agent |
| `settings.skill.upsert` | `settings` (P5) | `POST` / `PUT` `/api/projects/:projectId/skills`, Skill Editor |
| `settings.skill.import` | `settings` (P5) | `POST /api/projects/:projectId/skills/import` |
| `memory.file.put` | `memory` (P6) | `PUT /api/projects/:projectId/memory/:fileName`, Tab Memory |
| `memory.proposal.decide` | `memory` (P6) | `POST /api/memory-proposals/:proposalId/decide`, Memory Card |
| `memory.mcp.propose` | `memory` (P6) | MCP tool `propose_memory` |
| `memory.workflow.put` | `memory` (P6) | `PUT /api/projects/:projectId/workflows/:workflowId`, Tab Workflow |

---

## 5. Bảng mã lỗi nghiệp vụ (`ERROR_CODES`)

Mọi phản hồi lỗi HTTP từ `apps/hub` (cả REST `/api/*` và MCP `/mcp`) trả về body chuẩn `ApiErrorResponseSchema`:

```json
{
  "code": "ERR_...",
  "message": "...",
  "details": {}
}
```

| Mã lỗi (`code`) | HTTP | Module chính | Điều kiện kích hoạt | Thông điệp tiếng Việt mặc định (`translateApiError`) |
| --- | --- | --- | --- | --- |
| `ERR_LOCAL_ORIGIN_ONLY` | 403 | Chung | Request đến `/api/*` hoặc `/ws` từ `Origin` hoặc `Host` khác `localhost` / `127.0.0.1` ở `ADE_MODE=solo` | `ADE ở chế độ Solo chỉ cho phép truy cập từ localhost.` |
| `ERR_INTERNAL_ERROR` | 500 | Chung | Lỗi truy vấn cơ sở dữ liệu hoặc lỗi không mong đợi ở tầng server | `Lỗi hệ thống nội bộ.` |
| `ERR_VALIDATION` | 422 | Chung | Request params/query/body không vượt qua kiểm tra Zod schema | `Dữ liệu gửi lên không hợp lệ.` |
| `ERR_NOT_FOUND` | 404 | Chung | Không tìm thấy tài nguyên theo ID (`project`, `channel`, `thread`, `run`, `agent`, `skill`, `approval`, `proposal`) | `Không tìm thấy dữ liệu yêu cầu.` |
| `ERR_INVALID_STATUS` | 400 | Chung | Chuyển trạng thái thực thể không nằm trong bảng chuyển hợp lệ của State Machine | `Thao tác không hợp lệ với trạng thái hiện tại.` |
| `ERR_PROJECT_PATH_INVALID` | 400 | `chat` / `settings` | `repoPath` không tồn tại trên đĩa hoặc không chứa kho Git hợp lệ (`.git`) | `Đường dẫn không tồn tại hoặc chưa khởi tạo Git.` |
| `ERR_PROJECT_ALREADY_EXISTS` | 409 | `settings` | Đã có project quản lý cùng `repoPath` trong Hub | `Kho mã nguồn này đã được thêm vào ADE.` |
| `ERR_ADE_CONFIG_INVALID` | 422 | `chat` / `settings` | File YAML trong `.ade/` sai cú pháp hoặc sai schema khi đọc/ghi | `Tệp cấu hình trong .ade/ không hợp lệ.` |
| `ERR_CHANNEL_NAME_EXISTS` | 409 | `chat` | Tạo hoặc đổi tên channel trùng `name` trong cùng `project_id` | `Tên kênh đã tồn tại trong dự án này.` |
| `ERR_LAST_CHANNEL_DELETE` | 409 | `chat` | Xóa channel duy nhất còn hoạt động trong `project_id` | `Dự án phải giữ lại ít nhất 1 kênh hoạt động.` |
| `ERR_RUNNER_UNAVAILABLE` | 503 | `runner` | Runner chưa sẵn sàng hoặc harness yêu cầu chưa khả dụng trên máy | `Runner hoặc harness chưa sẵn sàng để khởi chạy agent.` |
| `ERR_CREDENTIAL_MODE_MISMATCH` | 400 | `runner` | Dùng profile `sub-*` khi `ADE_MODE=vps` hoặc profile không tồn tại | `Hồ sơ xác thực không được phép trong chế độ hiện tại.` |
| `ERR_PERMISSION_ALREADY_RESOLVED` | 409 | `runner` | Bấm trả lời `request_permission` đã được quyết định hoặc run không còn chờ quyền | `Yêu cầu cấp quyền này đã được xử lý trước đó.` |
| `ERR_RUN_NOT_CANCELLABLE` | 409 | `runner` | Huỷ run đã ở trạng thái kết thúc (`completed`, `failed`, `cancelled`) | `Run đã kết thúc nên không thể huỷ.` |
| `ERR_RUN_TIMEOUT` | 408 | `runner` / `orchestration` | Thời gian chạy của run vượt quá `runs.timeout_s` (chốt từ `timeout_s` giao việc hoặc `agents.timeout_s`) | `Run đã vượt quá thời gian thực thi cho phép.` |
| `ERR_DRIVER_EXECUTION` | 500 | `runner` | Tiến trình driver harness gặp lỗi runtime hay thoát mã khác `0` | `Tiến trình thực thi agent gặp lỗi ngoài dự kiến.` |
| `ERR_MCP_TOKEN_INVALID` | 401 | `trigger` (MCP) | Thiếu hoặc sai chữ ký/giá trị `Bearer <mcp_token>` khi gọi `/mcp` | `Token kết nối ADE MCP không hợp lệ.` |
| `ERR_MCP_TOKEN_EXPIRED` | 401 | `trigger` (MCP) | `mcp_token` gắn với run đã kết thúc hoặc quá hạn TTL | `Token kết nối ADE MCP đã hết hiệu lực.` |
| `ERR_GRANT_REQUIRED` | 403 | `trigger` (MCP) | Agent chưa có grant active trong `thread_agents` của thread đang truy cập, hoặc gọi chéo sang thread khác | `Agent chưa được cấp quyền truy cập ngữ cảnh của thread này.` |
| `ERR_FORBIDDEN_TOOL` | 403 | `trigger` (MCP) | Agent gọi tool không nằm trong `mcp_allow` (ví dụ `set_state` trong MVP) | `Agent không có quyền sử dụng công cụ này.` |
| `ERR_QUESTION_TIMEOUT` | 408 | `trigger` | Hết `timeout_s` của `ask_human` mà người dùng chưa trả lời | `Đã hết thời gian chờ người dùng trả lời câu hỏi.` |
| `ERR_QUESTION_ALREADY_RESOLVED` | 409 | `trigger` | Trả lời `question_card` đã có câu trả lời hoặc đã hết hạn | `Câu hỏi này đã được trả lời trước đó.` |
| `ERR_LOOP_DEPTH_EXCEEDED` | 409 | `trigger` / `orchestration` | `depth` của run con vượt `agents.max_depth` (mặc định `3`) | `Đã chạm giới hạn độ sâu gọi agent tối đa (max_depth).` |
| `ERR_CAUSATION_LIMIT_EXCEEDED` | 409 | `trigger` | Chuỗi `causation_id` vượt `20` sự kiện liên tiếp trong cùng thread (`engine_halted = true`) | `Rule engine đã tạm dừng do chuỗi sự kiện vượt quá giới hạn an toàn (20 bước).` |
| `ERR_MAIN_AGENT_ONLY` | 403 | `orchestration` | Worker hoặc main agent cũ gọi `delegate`, `request_approval`, `get_results`, `get_run_log` | `Chỉ main agent hiện tại của thread mới được thực hiện thao tác này.` |
| `ERR_AGENT_CANNOT_BE_MAIN` | 400 | `orchestration` | Lệnh `/main @x` chỉ định agent có `can_be_main = false` hoặc `enabled = false` | `Agent được chọn không có quyền làm main agent.` |
| `ERR_GATE_APPROVAL_REQUIRED` | 409 | `orchestration` | Chuyển `threads.state` vượt qua cổng (`gate: plan \| spec \| review`) khi chưa có `approvals.status = 'approved'` đúng `kind` | `Không thể chuyển trạng thái khi cổng duyệt của người dùng chưa được chấp thuận.` |
| `ERR_APPROVAL_PENDING_LOCK` | 409 | `orchestration` | Main agent gọi `delegate` mới trong khi thread đang có `approval` ở trạng thái `pending` | `Thread đang chờ người dùng duyệt cổng hiện tại, chưa thể giao việc mới.` |
| `ERR_APPROVAL_ALREADY_DECIDED` | 409 | `orchestration` | Duyệt/từ chối một bản `approval` không còn ở trạng thái `pending` | `Yêu cầu duyệt này đã được quyết định trước đó.` |
| `ERR_AGENT_HANDLE_EXISTS` | 409 | `settings` | Tạo/nhân bản agent có `handle` đã tồn tại trong project | `Handle của agent đã tồn tại trong dự án.` |
| `ERR_SKILL_NAME_EXISTS` | 409 | `settings` | Tạo/import skill trùng `name` trong cùng `scope` (`project` hoặc `global`) mà không bật ghi đè | `Tên skill đã tồn tại trong thư viện.` |
| `ERR_SKILL_IN_USE` | 409 | `settings` | Xóa skill đang được gắn trong `.ade/agents/*.yaml` | `Không thể xóa skill đang được gắn cho agent.` |
| `ERR_WORKFLOW_INVALID` | 422 | `settings` / `memory` | File workflow YAML thiếu `initial`, state trong rule không khai báo ở `states`, hoặc agent tham chiếu không hợp lệ | `Cấu hình workflow không hợp lệ (thiếu state khởi tạo hoặc tham chiếu sai state/agent).` |
| `ERR_BUDGET_EXCEEDED` | 409 | `memory` / `runner` | Chi phí luỹ kế vượt `agents.budget_usd` hoặc `threads.budget_usd` | `Đã vượt hạn mức ngân sách cho phép (budget_exceeded).` |
| `ERR_MEMORY_PROPOSAL_DECIDED` | 409 | `memory` | Duyệt hoặc từ chối `memory_proposal` không còn ở trạng thái `pending` | `Đề xuất ghi nhớ này đã được xử lý trước đó.` |
