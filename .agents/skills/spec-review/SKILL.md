---
name: spec-review
description: Dùng để chấm DD (UI/API) đã viết theo nhóm Luồng/UI, Quy tắc, API, Model DB. Chỉ báo thiếu sót và điểm mơ hồ, không sửa file.
---

# Spec Review (DD)

Chấm tài liệu **Detailed Design** trong `specs/dd/`, không tự sửa.

## Đầu vào

Path DD:

- `specs/dd/<module>/<id>/ui-*.md`
- `specs/dd/<module>/<id>/api-*.md`
- `specs/dd/<module>/overview.md` hoặc `specs/dd/domain-model.md`
- nháp `.agent-kit/specs/YYYY-MM-DD-*.md`

## Kiểm tra loại (trước khi chấm)

`specs/dd/` chỉ chứa **thiết kế hệ thống** (màn hình, API, domain, quyết định
module). Kế hoạch migration/ops/CI → “sai loại; dùng `plan` hoặc `docs/`” — dừng.

## Chấm theo 4 nhóm

Khuôn: `specs/templates/ui-spec.template.md` · `api-spec.template.md` ·
`state-machine.template.md`.

| Nhóm | UI | API | Overview / domain |
| --- | --- | --- | --- |
| **Luồng/UI** | Items, init, sự kiện, transition, sequence §IV; hoặc “Không có UI” | Actor/use-case + sequence §7 | Luồng module / ranh giới sub-DD |
| **Quy tắc** | Validate §II, phân quyền, nhánh lỗi/sự kiện | Validate §3, bước server, mã lỗi, precedence | Quyết định đã chốt, scope tenant |
| **API** | Bảng/bullet API chính khớp path thật | Endpoint + **TÊN** Zod hoặc “Không có”; cấm bắt chép field | Trỏ đúng file api-*.md |
| **Model DB** | Cột DB trên Items khi bind | §5.3 bản đồ dữ liệu + §6 bảng thao tác hoặc “Không có”. Không chặn thiếu index/migration | `erDiagram` + state machine của thực thể có `status` |

Chặn thêm:

- Bản đồ file cook / thứ tự CI trong DD.
- Còn “chưa chốt” / TBD trên quyết định ảnh hưởng cook mà tài liệu coi như duyệt.
- UI và API cùng id mâu thuẫn path/quyền/Zod/mã lỗi.
- Link nội bộ phải trỏ `specs/dd/…`.

## Soát chéo: câu chữ, ID, AC, dữ liệu, trạng thái

Áp trên cả 4 nhóm, theo `specs/reference.md` § **Viết requirement**, § **Bản đồ
dữ liệu**, § **State machine**. Chỉ chấm DD mới và phần DD bị sửa trong CR — DD
cũ thiếu AC/ID ở phần không đụng tới thì không báo.

| Kiểm | Loại finding |
| --- | --- |
| Thiếu mục Tóm tắt (UI) / ngoài phạm vi – giả định – câu hỏi mở (API §1) | Thiếu |
| Dòng E, lỗi nghiệp vụ §5.2, vai trò bị chặn, trường validate, `T-NN` dùng tới chưa có Scenario | Thiếu |
| Bảng P/I/V/E/S/T thiếu ID, hoặc Scenario / DD trỏ ID không tồn tại | Thiếu / Mâu thuẫn |
| AC không ở khối `gherkin`, Scenario không có AC-ID, `When` gồm nhiều hành động | Thiếu |
| `Then` không quan sát được (không có MSG / HTTP / URL / giá trị) | Thiếu |
| §5.3 / §6 tả dữ liệu bằng câu văn thay cho bảng | Thiếu |
| Đổi `status` mà không trỏ `<Entity>/T-NN`, hoặc thực thể có `status` chưa có state machine | Thiếu |
| State machine thiếu "Khi bị cấm" (HTTP + mã lỗi), hoặc sơ đồ lệch bảng chuyển | Thiếu / Mâu thuẫn |
| DD tả guard / side effect khác với `T-NN` nó trỏ tới | Mâu thuẫn |
| Còn `[CẦN LÀM RÕ]` hoặc quá 3 marker trên bản trình duyệt | Thiếu |
| Từ cấm, hoặc một dòng có 2 kết quả / "hoặc" giữa 2 hành vi | **Mơ hồ đo được** |
| Câu đọc được hai cách nhưng không vướng luật nào ở trên | Mơ hồ |

## Ba loại finding

- **Thiếu**: nhóm trống hoặc bỏ ngỏ (trừ “Không có” hợp lệ).
- **Mâu thuẫn**: hai chỗ trong cùng DD hoặc UI↔API lệch.
- **Mơ hồ**: một câu hai cách đọc. **Mơ hồ đo được** là Mơ hồ chỉ ra được
  bằng luật trong `reference.md` (từ cấm, câu không đơn nhất).

Thiếu / Mâu thuẫn / Mơ hồ đo được = **chặn**. Mơ hồ còn lại không loop.

## Cách báo

Mỗi finding một dòng: nhóm · loại · trích dẫn · đề xuất.
Không sửa file — người viết sửa qua `spec`.

## Xong rồi thì

- Còn Thiếu / Mâu thuẫn / Mơ hồ đo được → `spec` sửa, chấm lại.
- Chỉ Mơ hồ đã làm rõ bằng lời → ghi vào DD trước khi cook.
- Sạch → việc lớn `plan`, việc nhỏ `cook`.
