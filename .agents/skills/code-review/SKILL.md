---
name: code-review
description: Dùng để chấm code đã sửa hoặc một merge request. Chạy lint/typecheck của repo trước, đọc luật riêng theo ngôn ngữ từ thư mục .agents của repo tương ứng. Chỉ báo finding, không sửa.
---

# Code Review

Chấm code đã sửa hoặc một merge request để phát hiện lỗi, không tự sửa.

## Đầu vào

Diff của branch hiện tại so với `develop`, hoặc số MR cần chấm.

## Gate cơ học — chạy trước khi đọc diff

Máy bắt được nhóm lỗi mà mắt bỏ sót. Chạy lint và typecheck của repo trên
đúng phạm vi diff **trước** khi đọc code:

| Stack    | Lệnh                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| Python   | `ruff check <file đã sửa>` (repo có config), hoặc lệnh lint khai trong `.agents/rules/` |
| React/TS | `npm run lint`, `npm run typecheck`, và `npx -y react-doctor@latest --scope changed` (hoặc `apps/web/src`) |
| Flutter  | `dart analyze` và `dart format --output=none --set-exit-if-changed <file đã sửa>`       |

- Vi phạm ở file trong diff → finding **nên sửa**, dẫn nguyên văn dòng lỗi
  của công cụ. Vi phạm sẵn có ở file không đụng tới → không tính.
- Riêng `react-doctor` trên React/TS:
  - Error (crash, memory/secret leak, impure render) → mức **chặn**.
  - Warning Bugs (`no-adjust-state-on-prop-change`), Impure state updater, a11y (`no-autofocus`, thiếu nhãn) → mức **nên sửa**.
  - Warning Maintainability (`no-giant-component`, độ phức tạp cao, UI kit export) → mức **gợi ý**.
- Không chạy được (thiếu script, thiếu dependency, không có mạng) → ghi
  `lint: không chạy được — <lý do>` vào báo cáo. **Không** được im lặng bỏ
  qua và cũng không được coi là đã sạch.
- `.agents/rules/` của repo khai lệnh khác thì lệnh của repo thắng bảng này.

## Lấy luật theo ngôn ngữ

Với mỗi ngôn ngữ trong diff, đọc `coding_guide.md` và mục **Khi chấm** trong
`review.md`. `.agents/rules/README.md` nói thư mục nào và giữ
thang ba mức finding; diff đụng nhiều ngôn ngữ thì đọc nhiều cặp file.

Rồi tới luật repo trong `.agents/rules/<ngôn ngữ>/`, đọc theo thứ tự này:

1. `README.md` của thư mục đó nếu có — nó là mục lục.
2. `review.md` và `coding_guide.md`.
3. **Mọi file mà hai file trên gọi tên** (`security.md`, `form-ux.md`,
   `risk-lenses.md`, `testing-*.md`...). Chúng giữ phần chi tiết mà
   `review.md` chỉ trỏ tới; bỏ qua là mất đúng phần load-bearing.

Không đọc những file còn lại không ai tham chiếu và không khớp việc đang làm.

Không tìm thấy nguồn nào thì nói rõ trong báo cáo là chỉ chấm bằng nguyên tắc
chung, không im lặng bỏ qua.

## Chấm gì

- Bám spec nếu có: code có đúng hành vi đã tả không.
- Đúng/sai logic: nhánh rẽ, biên dữ liệu, giá trị null.
- Lỗi bị nuốt: catch rỗng, log rồi bỏ qua, trả mặc định thay vì báo lỗi.
- Test có phủ phần vừa đổi không, không chỉ phủ phần cũ.
- Luật ngôn ngữ vừa đọc ở bước trên, cả luật nền lẫn luật repo.

## Cách báo

Mỗi finding một dòng: `file:dòng`, **mức độ** (chặn / nên sửa / gợi ý), vấn
đề, đề xuất, và **`rule:`** trỏ tới luật đã dẫn (`<file luật>:<dòng>`, hoặc
tên rule của lint). Không dẫn được luật nào thì finding đó chỉ có thể là
`gợi ý`.

Thang mức độ và cách xử phân vân: theo mục "Ba mức finding" trong
`rules/README.md`.

**Không tự sửa** — trả danh sách finding lại cho người dùng, người sửa code
qua `cook`.

## Xong rồi thì

- Còn finding mức **chặn** hoặc **nên sửa** → `cook` sửa, rồi chấm
  lại đúng phần vừa sửa.
- Sạch, hoặc chỉ còn mức **gợi ý** mà người dùng chấp nhận bỏ qua → sẵn sàng
  `ship`.
- Người dùng muốn đăng finding lên GitLab MR → `git-review`. Skill này
  **không** tự đăng comment.

Không tự chuyển sang `ship`. Nói rõ đang ở trạng thái nào rồi để
người dùng quyết.
