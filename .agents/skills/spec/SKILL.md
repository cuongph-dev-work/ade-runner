---
name: spec
description: Dùng sau khi brainstorm đã chốt hướng, để viết DD (UI/API) bằng tiếng Việt (nháp local rồi chốt commit) cho người dùng duyệt. Không viết code.
---

# Spec (DD)

Viết **Detailed Design (DD)** bằng **tiếng Việt**: nháp local trong
`.agent-kit/specs/`, sau khi người dùng duyệt chốt vào `specs/dd/` để commit.
DD là entity chốt OK trước triển khai.

DD = **UI màn hình +/hoặc API endpoint** (logic, validate, response, DB, flow).
**Không** bản đồ file cook / thứ tự triển khai / CI (thuộc `plan`).

## Khi nào cần DD

- Tính năng mới hoặc CR đổi UI/API/quyền/model hành vi → viết hoặc cập nhật DD.
- Việc nhỏ, một repo, phạm vi đã rõ → bỏ qua, đi thẳng `cook`.
- Chỉ nghiệp vụ/hợp đồng hệ thống. Kế hoạch migration/ops/CI → `plan` hoặc
  `docs/`, **không** đưa vào `specs/dd/`.

## Không viết code

Chỉ viết DD. Không sửa app code, không scaffold. Đọc code để bám hiện trạng được.

## Cấu trúc chốt

```text
specs/dd/<module>/<id>/
  ui-*.md          # theo specs/templates/ui-spec.template.md
  api-*.md         # theo specs/templates/api-spec.template.md
specs/dd/<module>/overview.md   # optional: quyết định cross-cutting module, state machine của module
specs/dd/domain-model.md        # domain dùng chung (E0), erDiagram, state machine dùng chung
specs/message.md                # mã message dùng chung
specs/reference.md              # quy ước validate/format
```

- **Module** ví dụ: `company-master-data-management`, `define-fill`, `review`,
  `website-scan-template-version`, `document-processing`.
- **id** ví dụ: `cm-01`, `df-03`, `assignment`.
- Một thay đổi có thể cần **cặp** UI + API, hoặc chỉ một bên (ghi rõ “Không có UI”
  / engine nội bộ không HTTP).

## Đầu ra & thứ tự

1. **Nháp** — `.agent-kit/specs/YYYY-MM-DD-<slug>-ui.md` và/hoặc
   `…-api.md` theo template UI/API. File cục bộ, **không commit**, tiếng Việt.
2. **Hỏi GitLab issue một lần** (không bắt). Từ chối → không tạo issue;
   branch `feat/<slug>`. Đồng ý → tạo issue, ghi URL + `#iid`.
3. `spec-reviewer` chấm theo skill `spec-review` (nhóm DD) → người dùng duyệt →
   chốt vào `specs/dd/...` (**COMMIT**).

## Tạo GitLab issue (main agent, GitLab MCP)

**Không bắt.** Chỉ khi user duyệt trong lượt hiện tại.

- Preview title + body + project + labels; labels theo `docs/labels.md`.
- Body gọn: bối cảnh, mục tiêu, phạm vi, acceptance + **link path DD**
  `specs/dd/...`. Không nhồi full DD.
- CR: cập nhật issue cũ. Có `#iid` → `feat/<iid>-<slug>`.

## Nội dung

Theo `specs/reference.md`, ba mục:

- § **Viết requirement**: câu EARS tiếng Việt, mỗi dòng 1 kích hoạt → 1 kết
  quả quan sát được, không từ cấm, ID `P/I/V/E/S/T/AC` ổn định, AC viết bằng
  **Gherkin** (` ```gherkin `, `Scenario` / `Scenario Outline`), chỗ chưa chốt
  dùng `[CẦN LÀM RÕ: …]` (tối đa 3).
- § **Bản đồ dữ liệu**: dữ liệu viết bằng bảng / `erDiagram`, trỏ tên Zod /
  Prisma — không tả bằng câu văn.
- § **State machine**: DD đổi `status` của thực thể thì trỏ `<Entity>/T-NN`.
  Thực thể chưa có state machine → viết mục theo
  `specs/templates/state-machine.template.md` vào `domain-model.md` hoặc
  `overview.md` của module **trước**, rồi mới viết DD UI/API.

CR trên DD cũ: áp cho phần mình sửa và thêm AC cho phần đó; không bắt viết lại
cả file.

### UI (`ui-*.md`)

Bám `specs/templates/ui-spec.template.md`:

- Header: mã màn hình, URL, ngày
- TÓM TẮT: mục tiêu, actor, trong / ngoài phạm vi, giả định, câu hỏi mở
- Lịch sử sửa đổi
- BỐ CỤC (ảnh optional; thiếu ảnh không chặn nếu Items đủ)
- LOGIC: I Items · II Validate · III Logic (quyền, init, sự kiện, server) · IV sequence
- TIÊU CHÍ CHẤP NHẬN (Gherkin, mỗi Scenario trỏ ID nguồn)
- Màn hình liên quan
- Phân quyền theo `specs/_dd-pipeline/ADMIN-ACCESS-CONTEXT.md` khi admin
- Flow theo `specs/_dd-pipeline/FLOW-DIAGRAM-PATTERNS.md`
- Message code → `specs/message.md`

### API (`api-*.md`)

Bám `specs/templates/api-spec.template.md`:

- Header: API ID, method, endpoint, quyền, **TÊN** Zod
- 1 Mục đích (kèm ngoài phạm vi, giả định, câu hỏi mở) · 2 Request · 3 Validate
  · 4 Server · 5 Response (5.3 Bản đồ dữ liệu) · 6 DB (bảng thao tác) · 7 Flow
  · 8 Liên quan · 9 Tiêu chí chấp nhận (Gherkin)
- Zod tên trong `packages/contracts` — cấm chép field trừ khi cần rule
- Ghi rõ BE đã có / chưa implement nếu khác hiện trạng code

### Overview module (optional)

Quyết định chốt, ranh giới module, ma trận sub-DD, scope tenant, `erDiagram`
các model của module, state machine của thực thể thuộc module (theo
`specs/templates/state-machine.template.md`). Không thay UI/API chi tiết.

## Tự soát

- Placeholder TBD / bảng trống (trừ “Không có” hợp lệ) → sửa.
- Grep từ cấm trong câu hành vi → viết lại bằng giá trị cụ thể.
- Mỗi dòng E, mỗi lỗi nghiệp vụ, mỗi vai trò bị chặn, mỗi trường validate,
  mỗi `T-NN` dùng tới đã có ≥ 1 Scenario; mỗi Scenario trỏ ID tồn tại.
- Không còn đoạn văn tả dữ liệu ở §5.3 / §6 — đã thành bảng.
- Mỗi chỗ đổi `status` trỏ `<Entity>/T-NN` có thật.
- Marker `[CẦN LÀM RÕ]` ≤ 3 và đã liệt kê ở Tóm tắt / Mục đích.
- UI↔API cùng module: path, mã lỗi, quyền, Zod khớp.
- Không nhét plan/CI/file map.
- Link nội bộ trỏ `specs/dd/...`.

## Vòng chấm

User OK sơ bộ → spawn `spec-reviewer` + path tuyệt đối + skill `spec-review`.

- Finding **chặn** (Thiếu / Mâu thuẫn) → sửa, chấm lại. Tối đa **3 vòng**.
- Sạch chặn → trình bản cuối.

## Duyệt

Chỉ “Đã duyệt” khi user nói rõ trong hội thoại, và DD không còn marker
`[CẦN LÀM RÕ]`.

## Xong rồi thì

Chốt file vào `specs/dd/...`. Việc lớn → `plan`; việc nhỏ → `cook`. Không tự code.
