# Message & Validation Catalog

**SSOT** mã message (MSG*) + quy tắc validate dùng chung cho UI/API DD và code.

| Layer | Path |
|-------|------|
| Spec (đọc/duyệt) | `specs/message.md` (file này) |
| Machine-readable | `packages/contracts/src/validation-catalog.ts` |
| API business errors | `packages/contracts/src/error-messages.ts` (`ERROR_CODES`) |
| FE copy | `apps/web/src/i18n/{ja,en}.ts` — map MSG / catalog |

Cook / FE / BE **không** hardcode chuỗi “bắt buộc” rời — lấy từ catalog.

---

## 1. Message template (MSG*)

| Mã | Template VI | Template JA | Template EN | Dùng khi |
|----|-------------|-------------|-------------|----------|
| **MSG01** | `{field} là bắt buộc.` | `{field}は必須です。` | `{field} is required.` | `required` · `min:1` (chuỗi rỗng) |
| **MSG04** | `Định dạng {field} không hợp lệ.` | `{field}の形式が正しくありません。` | `{field} format is invalid.` | `email` · `max` · `min` (số) · `in:` · `integer` · `boolean` · `date` · regex |
| **MSG14** | `Cập nhật thành công.` | `更新しました。` | `Updated successfully.` | Toast success (optional) |
| **MSG19** ※ | Đăng nhập thất bại… | ログインに失敗… | Login failed… | Auth credentials |
| **MSG20** | Tài khoản bị khóa… | アカウントがロック… | Account locked… | Auth locked |
| **MSG_PASSWORD_MIN_8** | `Mật khẩu tối thiểu 8 ký tự.` | `パスワードは8文字以上で入力してください。` | `Password must be at least 8 characters long.` | `password` · `min:8` |

`{field}` = nhãn field (bảng §2), **không** dùng technical key thô trên UI.

---

## 2. Field labels (`{field}`)

| Key | VI | JA | EN |
|-----|----|----|-----|
| `name` | Họ tên | 氏名 | Name |
| `email` | Email | メールアドレス | Email |
| `password` | Mật khẩu | パスワード | Password |
| `role` | Vai trò | ロール | Role |
| `status` | Trạng thái | 状態 | Status |
| `company_id` | Công ty | 会社 | Company |
| `permissionKey` | Mã màn hình | 画面コード | Permission key |
| `allowed` | Cho phép | 許可 | Allowed |
| `username` | Account ID | アカウントID | Account ID |
| `page` / `pageSize` / `search` / `id` | … | … | … |

Mở rộng label trong `FIELD_LABELS` (contracts) khi thêm field DD.

---

## 3. Rule tokens (cột “Quy tắc kiểm tra” trong DD)

Mỗi dòng **một** rule (xem `reference.md`).

| Rule token | Ý nghĩa | MSG mặc định |
|------------|---------|--------------|
| `required` | Bắt buộc | MSG01 |
| `trim` | Chuẩn hóa trước validate | — (kèm required/min) |
| `min:N` | Độ dài/số ≥ N | MSG01 nếu N=1 chuỗi; MSG_PASSWORD_MIN_8 nếu password≥8; else MSG04 |
| `max:N` | Độ dài/số ≤ N | MSG04 |
| `email` | Định dạng email | MSG04 |
| `integer` | Số nguyên | MSG04 |
| `boolean` | true/false | MSG04 |
| `date` | Ngày hợp lệ | MSG04 |
| `in:a,b,c` | Enum | MSG04 |
| `regex:…` | Pattern | MSG04 |
| `immutable` | Cấm đổi (vd. email PATCH) | ERR_* / MSG04 |
| `nullable` | Cho phép null/omit | MSG — (không message) |

---

## 4. Catalog form (collect khi cook)

Nguồn code: `VALIDATION_CATALOG` trong contracts.

| Catalog key | Form / API | Ghi chú |
|-------------|------------|---------|
| `auth.login` | Login | username/password |
| `user.create` | POST `/api/users` · modal tạo | CM-06 |
| `user.update` | PATCH `/api/users/:id` · modal sửa | name required khi gửi |
| `user.listQuery` | GET list query | page/pageSize/search/role/status |
| `settings.permission.put` | PUT permissions | role/permissionKey/allowed |

**Cách cook thu thập:**

```ts
import { collectRules, resolveMsg, resolveZodIssueMessage } from "@ai-filldata/contracts";

const rules = collectRules("user.create");
// → Zod schema + FE fieldErrors + DD § Validate rows
```

DD §II Validate: mỗi dòng = 1 phần tử catalog (`field` · `rule` · `msg`).

---

## 5. CM-06 Users — bảng rule đầy đủ (tham chiếu)

### Create (`user.create`)

| field | rule | msg | Text JA (resolve) |
|-------|------|-----|-------------------|
| name | required / min:1 | MSG01 | 氏名は必須です。 |
| name | max:100 | MSG04 | 氏名の形式が正しくありません。 |
| email | required | MSG01 | メールアドレスは必須です。 |
| email | email / max:200 | MSG04 | メールアドレスの形式が正しくありません。 |
| role | required | MSG01 | ロールは必須です。 |
| role | in:admin,staff,bpo_operator | MSG04 | ロールの形式が正しくありません。 |
| password | required | MSG01 | パスワードは必須です。 |
| password | min:8 | MSG_PASSWORD_MIN_8 | パスワードは8文字以上… |
| password | max:200 | MSG04 | … |

### Update (`user.update`)

| field | rule | msg |
|-------|------|-----|
| name | required / min:1 (khi gửi) | MSG01 |
| name | max:100 | MSG04 |
| role | in:… | MSG04 |
| status | in:active,inactive | MSG04 |
| password | min:8 nếu có | MSG_PASSWORD_MIN_8 |
| email | immutable | `ERR_EMAIL_IMMUTABLE` |

### Business errors (không phải MSG template)

| Code | HTTP | Khi |
|------|------|-----|
| `ERR_EMAIL_EXISTS` | 409 | Trùng email |
| `ERR_LAST_ADMIN` | 409 | Hạ/xóa admin cuối công ty |
| `ERR_EMAIL_IMMUTABLE` | 400 | PATCH có `email` |
| `ERR_USER_NOT_FOUND` | 404 | Ngoài scope / soft-deleted |

---

## 6. ERROR_CODES (API)

Xem đầy đủ `packages/contracts/src/error-messages.ts`.  
DD API § lỗi: ghi **ERROR_CODE** + HTTP; UI toast map qua `translateApiError`.
UI tuyệt đối **không hiển thị thô `err.message`** từ server khi bắt lỗi (catch) mà phải qua `translateApiError` hoặc `translateValidationMessage`.

---

## 7. Quy chuẩn giao tiếp đa ngôn ngữ (HTTP i18n)

1. **Frontend (Client)**:
   - Mọi HTTP request (bao gồm `apiFetch` và các request tải tệp nhị phân) phải tự động đính kèm header `Accept-Language` tương ứng với ngôn ngữ đang chọn trên giao diện (`ja` hoặc `en`).
2. **Backend (API)**:
   - Phân giải header `Accept-Language` qua middleware/context (mặc định fallback là `ja`).
   - `ZodValidationPipe` tự động áp dụng locale từ request context để sinh thông điệp `messages` qua `resolveZodIssueMessage(issue, locale, labelOverrides)`.
   - Tránh hardcode chuỗi message ngôn ngữ cụ thể trong controller hoặc service.

---

## 8. Quy trình khi thêm field / form mới

1. Thêm label vào `FIELD_LABELS` (contracts) + i18n FE nếu cần copy riêng.
2. Thêm rules vào `VALIDATION_CATALOG["module.action"]`.
3. DD § Validate: copy rows từ catalog (field · rule · MSG).
4. Zod schema: mirror rule tokens.
5. FE: `safeParse` + `resolveZodIssueMessage` (hoặc `resolveMsg`).
6. Không invent message ad-hoc trên UI.

---

## 9. API ERROR list (rút gọn — full trong contracts)

| Mã | HTTP | Điều kiện |
|----|------|-----------|
| `INVALID_CREDENTIALS` | 401 | Sai login |
| `COMPANY_INACTIVE` | 403 | Company inactive non-admin |
| `ERR_FORBIDDEN` | 403 | Thiếu quyền |
| `ERR_VALIDATION` | 400/422 | Zod fail |
| `ERR_EMAIL_EXISTS` | 409 | Email trùng |
| `ERR_LAST_ADMIN` | 409 | Admin cuối |
| `ERR_EMAIL_IMMUTABLE` | 400 | Đổi email |
| `ERR_USER_NOT_FOUND` | 404 | User không thấy |
| `ARTIFACT_NOT_AVAILABLE` | 409 | FillJob chưa sinh thành phẩm hoặc đang xử lý |
| `ERR_ARTIFACT_NOT_FOUND` | 404 | Tệp thành phẩm không tồn tại trong storage |
| `ERR_REVIEW_NOT_VERIFIED` | 400 | Tệp chưa được BPO duyệt, bị khóa tải xuống |
| `JOB_FAILED` | 400 | Job thất bại, không có thành phẩm/báo cáo |
| `REPORT_NOT_READY` | 400 | Báo cáo điền chưa sẵn sàng |
| `SCAN_PENDING_REVIEW` | 409 | 自治体 có version `DRAFT` chờ duyệt, không được scan — `レビュー待ちの版があるため、スキャンできません。` |
| `MANUAL_UPLOAD_DUPLICATE` | 409 | Upload tay trùng tập file của version đã có — `同じファイル構成の版が既に存在します。` |
| `SOURCE_DOCUMENT_NOT_FOUND` | 404 | File template không tồn tại / không thuộc version nào — `指定されたファイルが見つかりません。` |
| `MANUAL_UPLOAD_ANALYSIS_NOT_FOUND` | 404 | Phiên phân tích upload tay không tồn tại / hết hạn — `解析セッションが見つかりません。もう一度ファイルを選択してください。` |
| `MANUAL_UPLOAD_ANALYSIS_NOT_READY` | 409 | Phiên phân tích chưa hoàn thành — `解析が完了していません。しばらくお待ちください。` |
| `MANUAL_UPLOAD_ANALYSIS_CANCELLED` | 409 | Phiên phân tích đã bị hủy — `解析はキャンセルされました。もう一度ファイルを選択してください。` |
| `MANUAL_UPLOAD_ANALYSIS_EXPIRED` | 409 | Phiên phân tích hết hạn — `解析セッションの有効期限が切れました。もう一度ファイルを選択してください。` |
| `MANUAL_UPLOAD_ANALYSIS_SUBMITTED` | 409 | Phiên phân tích đã được submit trước đó — `このファイルは既に登録されています。` |
| `MANUAL_UPLOAD_ANALYSIS_NOT_RETRYABLE` | 409 | Phiên phân tích không thể retry (chỉ FAILED mới retry) — `この解析は再実行できません。` |
| `FILL_JOB_NOT_RETRYABLE` | 409 | Retry FillJob không ở trạng thái `failed` — `このジョブは再実行できません。` |
| `FILL_RECORD_CONTEXT_INVALID` | 422 | `recordContext` trỏ bản ghi không thuộc company / đã xóa / manager ngoài ứng viên (`details.invalid`) — `選択された対象データが見つかりません。` |
| `FILL_RECORD_CONTEXT_REQUIRED` | 422 | Thiếu 営業所 / 担当者 / 管理者 bắt buộc (`details.missing`) — `対象の営業所・担当者を選択してください。` |
| `FILL_JOB_INPUT_REQUIRED` | 422 | Thiếu `job_input` bắt buộc (`details.keys`) — `必須の入力項目が未入力です。` |
| `DEFINE_SPLIT_INCOMPLETE` | 409 | Verify schema Excel khi còn field vừa có `db_column` vừa có `split_incomplete` — `分割セルの変換が揃っていません。` |
| `ERR_INVALID_STATUS` | 400 | Thao tác không hợp lệ với trạng thái hiện tại của thực thể (`dd/domain-model.md` §9) |
| `ERR_CHECKLIST_INCOMPLETE` | 400 | Hoàn tất Review khi còn FeedbackItem `isVerified = false` |
| `ERR_SUBMISSION_NOT_READY` | 400 | Nộp khi Review chưa `verified` hoặc requirement chưa `ready` |
| `ERR_ALREADY_SUBMITTED` | 400 | Nộp hồ sơ đã `submitted` |
| `ERR_NOT_SUBMITTED` | 400 | Huỷ nộp hồ sơ chưa `submitted` |
| `QUALIFICATION_CONFIRMATION_REQUIRED` | 409 | Bàn giao sang Define khi bundle chưa xác nhận qualification |
| `PREVIOUS_SELECTION_REQUIRED` | 409 | Bàn giao sang Define khi bundle chưa xác nhận bản trước |
| … | | (contracts) |

`FILL_TIMEOUT`, `QUEUE_ENQUEUE_FAILED` là giá trị `FillJob.errorCode`, không phải mã HTTP.

| ERR_DOCUMENT_CODE_EXISTS | Mã chứng từ đã tồn tại trong công ty. |
| ERR_DOCUMENT_NOT_FOUND | Không tìm thấy chứng từ. |
| ERR_DOCUMENT_LINKED | Chứng từ đang được liên kết ma trận; không xóa được. |
| ERR_MATRIX_ROW_NOT_FOUND | Không tìm thấy dòng ma trận. |
| ERR_DOCUMENT_KIND_MISMATCH | Mã chứng từ không khớp kind yêu cầu. |


