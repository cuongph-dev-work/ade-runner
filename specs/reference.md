# Reference

Quy ước định dạng dùng chung cho UI/API DD trong `specs/dd/`.

## Cấu trúc thư mục

```text
specs/dd/<module>/<id>/ui-*.md
specs/dd/<module>/<id>/api-*.md
specs/dd/<module>/overview.md          # optional
specs/dd/domain-model.md
specs/templates/ui-spec.template.md
specs/templates/api-spec.template.md
specs/templates/state-machine.template.md   # chèn vào domain-model.md / overview.md
specs/message.md
specs/_dd-pipeline/…                   # auth context, flow patterns
```

Nháp: `.agent-kit/specs/` (không commit).

## § Viết requirement — EARS, ID, AC

Áp cho DD mới và phần DD bị sửa trong CR; DD cũ không bắt migrate.

### Mẫu câu (EARS tiếng Việt)

Mỗi dòng bảng (P / I / E / S) và mỗi câu hành vi đi theo **đúng một** mẫu,
mệnh đề luôn theo thứ tự dưới:

| Mẫu | Câu | Ví dụ |
| --- | --- | --- |
| Luôn đúng | `<Hệ thống / màn hình> phải <phản hồi>.` | Danh sách phải sắp theo `updated_at` giảm dần. |
| Sự kiện | `Khi <sự kiện>, … phải <phản hồi>.` | Khi nhấn Lưu, màn hình phải gọi `PATCH /api/…`. |
| Trạng thái | `Trong khi <trạng thái>, … phải <phản hồi>.` | Trong khi đang gửi, nút Lưu phải bị vô hiệu. |
| Lỗi | `Nếu <điều kiện lỗi>, thì … phải <phản hồi>.` | Nếu trùng khóa, thì API phải trả 409 `ERR_DUPLICATE_BUSINESS_KEY`. |
| Tùy chọn | `Ở nơi có <tính năng / cấu hình>, … phải <phản hồi>.` | Ở nơi bật AI seed, màn hình phải hiện nút Nhập AI. |

Trong bảng, cột "Kích hoạt" mang mệnh đề `Khi / Nếu / Trong khi`, cột "Mô tả"
mang phần `phải …`.

### Chất lượng một câu (ISO/IEC/IEEE 29148)

- **Đơn nhất**: 1 kích hoạt → 1 kết quả. Hai kết quả khác nhau → tách dòng.
- **Kiểm chứng được**: kết quả quan sát được (MSG, HTTP + `ERR_…`, URL, trạng
  thái control, giá trị DB) — không phải cảm nhận.
- **Không mơ hồ**: một cách đọc duy nhất; không "hoặc" giữa hai hành vi.
- **Cần thiết**: bỏ câu đi mà không thiếu hành vi nào → câu thừa, xóa.
- **Đầy đủ**: ngưỡng, giới hạn, mã lỗi, vai trò ghi bằng giá trị cụ thể.

**Từ cấm** trong câu hành vi (gặp → viết lại bằng giá trị cụ thể):
`phù hợp`, `hợp lý`, `thích hợp`, `nhanh`, `dễ dùng`, `thân thiện`,
`tương tự`, `v.v.`, `...` (cuối liệt kê), `nếu cần`, `khi cần`, `tối ưu`,
`khoảng`, `xử lý` (đứng một mình, không nói xử lý gì), `có thể` (khi chủ ngữ
là hệ thống), `hoặc` (giữa hai hành vi hiển thị chưa chốt).

### ID ổn định

| Bảng | ID | Ví dụ |
| --- | --- | --- |
| Phân quyền (UI §III.1) | `P-NN` | `P-02` |
| Khởi tạo (UI §III.2) | `I-NN` | `I-01` |
| Validate (UI §II · API §3) | `V-NN` | `V-03` |
| Sự kiện (UI §III.3) | `E-NN` | `E-04` |
| Bước server (UI §III.4 · API §4) | `S-NN`, nhiều API: `S<N>-NN` | `S2-03` |
| Tiêu chí chấp nhận | `AC-<mã DD>-NN`; state machine: `AC-<Entity>-NN` | `AC-MC-0001-03`, `AC-API-CM-03-1-02`, `AC-FillJob-02` |
| Chuyển trạng thái (§ State machine) | `T-NN`, trỏ chéo `<Entity>/T-NN` | `FillJob/T-03` |

- ID cố định sau khi duyệt: thêm dòng thì nối số mới; xóa dòng thì bỏ số, không
  đánh lại.
- Trỏ chéo file: `<mã DD>/<ID>` (vd `MC-0001/E-04`); chuyển trạng thái luôn
  trỏ `<Entity>/T-NN`.
- AC-ID là khóa truy vết: plan ghi AC-ID ở bước hiện thực nó, tên test chứa
  AC-ID, verify ghi AC-ID ở cột `Nguồn`.

### Tiêu chí chấp nhận (AC) — Gherkin

Viết trong khối ` ```gherkin `, **từ khóa tiếng Anh**, nội dung tiếng Việt:

- Một `Feature:` mỗi DD (`<mã DD> — <tên>`); điều kiện chung của mọi kịch bản
  đưa vào `Background:`.
- Mỗi AC là một `Scenario:` tên `AC-<mã DD>-NN — <tóm tắt> (nguồn: <ID>)`.
- Nhiều bộ dữ liệu cùng một luồng (thường là validate) → `Scenario Outline:` +
  `Examples:`; một Outline vẫn là **một** AC-ID.
- `Given` = trạng thái trước (dữ liệu, vai trò, trạng thái thực thể); `When` =
  **một** hành động nghiệp vụ (dữ liệu đi kèm không tính là hành động riêng, vd
  "gửi form đăng nhập với Account ID … và mật khẩu sai"); `Then` = kết quả quan
  sát được; nối thêm bằng `And` / `But`.
- Giá trị cụ thể trong nháy kép (`"a@example.jp"`), không viết "một email hợp lệ".

Phủ tối thiểu:

- UI: luồng thành công chính; mỗi dòng E; mỗi vai trò bị chặn (P);
  mỗi trường ở §II ≥ 1 AC (gom các V cùng trường).
- API: mỗi endpoint 1 AC thành công; mỗi lỗi nghiệp vụ ở §5.2 (mã `ERR_…`);
  403 cho vai trò bị chặn; mỗi trường ở §3 ≥ 1 AC.
- Đổi `status`: mỗi `T-NN` dùng tới ≥ 1 AC, cộng ≥ 1 AC chuyển trạng thái bị
  cấm (mã lỗi ghi trong state machine).

AC là **sàn**: verify vẫn sinh thêm case biên / bảng quyết định từ AC.

### Câu hỏi mở

Chưa chốt → marker `[CẦN LÀM RÕ: <câu hỏi cụ thể>]` đúng tại chỗ, liệt kê lại ở
mục Tóm tắt / Mục đích. Tối đa **3** marker mỗi DD; nhiều hơn → quay lại
`brainstorm`. Còn marker → không được "Đã duyệt". Không dùng `TBD`, `???`.

## § Bản đồ dữ liệu (Data schema)

Dữ liệu viết bằng **bảng hoặc sơ đồ**, không bằng câu văn. Nguồn chân lý về hình
dạng: Zod (`packages/contracts`) cho API, Prisma (`apps/api/prisma/schema.prisma`)
cho DB — DD **trỏ tên** schema/model, chỉ chép field khi cần ánh xạ hoặc rule.

| Chỗ | Dạng bắt buộc |
| --- | --- |
| UI §I Items | Cột "Cột trong DB" = `table.column` hoặc `—` |
| API §2.2–2.3 Request | Bảng param/body + tên Zod |
| API §5.3 Bản đồ dữ liệu | Bảng `Field` · `Nguồn` (`table.column` / tính toán / hằng) · `Biến đổi` · `Ghi chú` cho mọi field response không phải chép thẳng một cột |
| API §6 Database | Bảng `Model` · `Thao tác` (R/C/U/D) · `Field` · `Điều kiện / filter` · `Ghi chú`; invariant và transaction ghi thành dòng riêng |
| `domain-model.md` / `overview.md` | `erDiagram` (mermaid) cho các model và quan hệ của module; bảng field chỉ khi khác Prisma |

Kiểu dữ liệu, nullable, default lấy từ Zod/Prisma — DD không định nghĩa lại;
lệch với code thì ghi rõ "BE chưa implement" như mục API trong skill `spec`.

## § State machine (thực thể có trạng thái)

Thực thể có cột trạng thái (`status`, `verificationStatus`… — Prisma enum hoặc
chuỗi cố định) được mô tả **một lần** theo `specs/templates/state-machine.template.md`,
đặt trong `specs/dd/domain-model.md` (thực thể dùng chung) hoặc
`specs/dd/<module>/overview.md` (thực thể của một module).

- `stateDiagram-v2` + bảng chuyển `T-NN`: `Từ` · `Sự kiện` · `Guard` · `Sang` ·
  `Actor` · `Side effect` · `API / job`.
- Cặp (trạng thái, sự kiện) **không có** trong bảng = bị cấm; ghi HTTP + mã lỗi
  trả về khi bị cấm, theo mã đang có trong code (vd 400 `ERR_INVALID_STATUS`,
  `GLOSSARY_INVALID_TRANSITION`) — mã mới thì thêm vào `specs/message.md`.
- DD UI/API đổi trạng thái thì trỏ `<Entity>/T-NN` ở bước server (S) hoặc sự
  kiện (E); không mô tả lại luồng trạng thái bằng lời.
- Thêm trạng thái hoặc chuyển mới = CR trên state machine trước, rồi mới sửa DD
  UI/API.

## § Validate §II — Định dạng dòng rule

Mỗi dòng một quy tắc kiểm tra, không gộp nhiều rule bằng `;`.

- Trường tùy chọn: dòng đầu là `nullable` (MSG —); các rule `integer` / `min` / `max` / `file` trên dòng riêng.
- Rule chéo trường: dòng `nullable` trước, rồi rule có tên (`from_lt_to`, `from_rank_lt_to_rank`) — không kèm chữ "(when both provided)".
- Mã message tham chiếu [message.md](./message.md).
- **Thu thập rule**: ưu tiên `VALIDATION_CATALOG` trong `@ai-filldata/contracts` (`collectRules("user.create")` …). DD chỉ mirror catalog; cook không hardcode message.
- **Resolve text**: `resolveMsg(MSG01, "name", "ja")` → `氏名は必須です。` · Zod issue → `resolveZodIssueMessage(issue, locale)`.

## Scope multi-company (đã chốt)

| Nhóm | Scope |
|------|--------|
| `Government`, `TemplateVersion`, `DocumentSchema` | Catalog **global** (không `company_id`) |
| 9 bảng master con, `companies`, `User` | **Tenant** — `company_id` / JWT `companyId` |
| `FillJob`, `Review`, `Assignment`, `QualDeadline`, `Attachment` | **Tenant** qua JWT `companyId` (hoặc chuỗi job/user) |
| `RolePermission` | **Global** (role × permissionKey) |

Cross-tenant luôn trả 404 (không lộ tồn tại bản ghi công ty khác) trừ khi DD ghi khác.

## Phân quyền nhanh

- `admin`: full trong scope (trừ khi DD thu hẹp).
- `staff` + permissionKey: **fail-open** nếu chưa có dòng `RolePermission`.
- `bpo_operator` + permissionKey: **fail-closed**.
- `bpo_operator`: không Define/Fill; Review chỉ `Verify`.

## Xử lý lỗi web (đã chốt 2026-09-29)

Quy tắc mặc định cho mọi màn `apps/web`, xử lý tập trung ở `QueryCache` / `MutationCache`. DD màn hình chỉ ghi khi **lệch** mặc định (opt-out).

| Loại request | HTTP | Hành vi |
|---|---|---|
| GET (query) | 401 | Chuyển màn đăng nhập (auth boundary), không toast |
| GET (query) | 403 | Trang lỗi 403 trong layout (sidebar/header giữ nguyên) |
| GET (query) | 404 | Trang lỗi 404 trong layout |
| GET (query) | ≥ 500 hoặc mất mạng | Trang lỗi 500 trong layout, có nút `再試行` |
| GET (query) | 400 và mã khác | Toast |
| POST / PUT / PATCH / DELETE (mutation) | ≠ 401 | Toast, không chuyển trang |

- Toast luôn qua `translateApiError` (không hiện `err.message` thô — xem [message.md](./message.md) §6).
- Query lỗi 4xx không retry; 5xx / mất mạng retry 1 lần trước khi hiện trang 500.
- Trang lỗi biến mất khi đổi route hoặc bấm `再試行` thành công.
- Opt-out: query phụ (dropdown, badge, summary, polling, dữ liệu trong dialog/drawer) đặt `meta.errorPage = false` → rơi về toast hoặc lỗi tại chỗ; mutation tự hiện lỗi inline / dialog đặt `meta.toast = false`.
- Route không tồn tại → trang 404; thiếu vai trò/quyền ở phía web (`PermissionGate`) → trang 403.

Chi tiết admin shop context (nếu dùng): `_dd-pipeline/ADMIN-ACCESS-CONTEXT.md`.
Sequence: `_dd-pipeline/FLOW-DIAGRAM-PATTERNS.md`.
