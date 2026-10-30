---
name: cook
description: Dùng khi bắt tay viết code cho một yêu cầu đã rõ. Tạo branch đúng quy ước, sửa code trong đúng một repo, và chỉ chạy test của phần vừa sửa.
---

# Cook

Viết code cho một yêu cầu đã rõ, trong đúng phạm vi, chạy đúng test phần sửa.

## Trước khi sửa code: kiểm tra spec gap

Chỉ ra đúng dòng nào trong spec nói hành vi đúng là gì?

- Chỉ được → không có gap, làm luôn.
- Không chỉ được, hoặc spec im lặng / mơ hồ / mô tả hành vi mà team nay không
  đồng ý → **có gap**.
- **Không chắc** có gap hay không → tính là **có gap**.

Có gap → `⚠️` cảnh báo và đề xuất chạy `brainstorm` hoặc
`spec`
để cập nhật spec trước. Người dùng có thể bảo bỏ qua.

Đang sửa bug mà **chưa chỉ ra được nguyên nhân** → dùng `debug`
trước, đừng đoán rồi vá.

## Luật ngôn ngữ

Đọc mục **Khi viết** của `coding_guide.md`; README ở
`.agents/rules/README.md` nói thư mục nào. Chỉ đọc file trong
`.agents/rules/` có tên khớp ngôn ngữ / việc đang làm; không đọc cả thư mục.

Ảnh hưởng thay đổi: theo mục "Code intelligence" trong `CLAUDE.md`.

## Phạm vi

Có plan thì làm đúng **một dòng** trong bảng phạm vi mỗi lượt; mỗi spoke là
một repo git riêng nên không gộp chung một MR. Xong thì đổi `⬜` thành `✅`
trong file plan.

Không có plan thì hỏi gọn một câu xác nhận repo và thư mục.

Việc triển khai theo plan đi qua `delegate`; cook là playbook.

Cảnh báo `⚠️` (không chặn) khi: sửa file ngoài thư mục đã khai, hoặc nhảy
sang dòng sau khi dòng trước chưa `✅`.

Việc kéo dài nhiều lượt hoặc đụng nhiều repo: ghi mốc xong, quyết định đã
chốt và chỗ đang vướng vào mục `## Nhật ký` theo `handoff`, ghi
ngay lúc xảy ra.

## Branch

`git status` trước khi sửa. Có thay đổi chưa commit không thuộc phạm vi →
`⚠️` đề xuất tách worktree cho sạch:

```bash
git worktree add ../<type>-<slug>-<summary> -b <type>/<slug>/<summary> develop
```

Người dùng có thể bảo làm tại chỗ. Khi đó chỉ stage đúng file thuộc phạm vi
(`git add <đường dẫn>`, không `git add -A`) và không commit file mình không
sửa.

Tên nhánh `<type>/<author-slug>/<summary>`; `<type>` ∈ `feat`, `fix`,
`refactor`, `chore`, `docs`; `<author-slug>` từ `git config user.name`
lowercase kebab-case.
Có GitLab issue (feature qua `spec`) → đặt nhánh theo issue: `<type>/<iid>-<slug>`
(vd `feat/123-fill-report`).

**Không commit vào `main`, `master`, `develop`** — đây là chặn cứng duy nhất
trong toàn bộ kit.

## Test

```
✅ Chạy test của đúng file/module vừa sửa
✅ Chạy lint/typecheck của repo trên đúng file vừa sửa
❌ KHÔNG full suite
❌ KHÔNG bịa test khi repo chưa có sẵn cho phần đó
```

Lint và typecheck chạy trên **file trong phạm vi**, không phải cả repo:
`ruff check <file>`, `npm run lint` + `npm run typecheck`, `dart analyze`.
Đừng dựa vào pre-commit — nhiều repo không cài, và lỗi lint để sót sẽ quay
lại thành finding **nên sửa** ở vòng review, tốn thêm một vòng worker.

Sửa UI thuần (layout, spacing, màu) mà repo không có test liên quan: bỏ qua.

### Checklist RED → GREEN → REFACTOR

Trước khi sửa logic thuộc nhóm bắt buộc của skill `test` (API guard/pipe/service,
validation, API client, data mapping, Web form/filter/navigation/query state,
loading/error/empty state hoặc phân quyền):

1. Viết test hành vi nhỏ nhất và chạy để xác nhận **RED** vì thiếu hành vi, không
   phải vì lỗi cú pháp hoặc mock sai.
2. Viết implementation tối thiểu để **GREEN**, rồi chạy lại test của scope và
   typecheck/lint tương ứng.
3. **REFACTOR** test/helper sau khi xanh; không đổi assertion chỉ để né lỗi.

Các ví dụ mutation tối thiểu cần được suite bắt: JWT invalid/expired, role
thiếu quyền, Zod nested path, API non-2xx, navigation prefix sai và bảng rỗng
render sai `colSpan`. Với thay đổi chỉ thuộc nhóm "Không ép" của skill `test`,
ghi lý do miễn test trong báo cáo thay đổi.

**Luôn nói rõ một trong hai** trước khi coi là xong, không được im lặng:

- `đã viết/cập nhật test: <đường dẫn>`, hoặc
- `không viết test vì <lý do cụ thể>`

Việc thuộc cột **bắt buộc** trong bảng của `test` → viết test fail
trước rồi mới sửa. "Việc nhỏ" hay "sẽ thêm sau" không tính là lý do.

## Xong rồi thì

### Tự tinh gọn (sau GREEN, trước khi báo xong)

Rà **chỉ các hunk trong diff của mình**, chỉnh _cách viết_, không đổi _hành vi_:
input/output, side effect, thứ tự gọi, thông điệp lỗi giữ nguyên.

- Giảm lồng nhau: early return / guard clause thay cho `if` lồng.
- Bỏ thừa: biến tạm dùng một lần không thêm nghĩa, wrapper/helper mình vừa
  thêm mà chỉ chuyển tiếp, nhánh trùng lặp.
- Đặt tên nói được ý định thay vì cần comment giải thích.
- Rõ ràng hơn ngắn gọn: không đổi sang one-liner dày đặc hay code "khéo",
  không gộp nhiều trách nhiệm vào một hàm, không xóa abstraction có sẵn đang
  giúp tổ chức code.

Có chỉnh gì → chạy lại test + lint/typecheck của scope; đỏ thì hoàn tác chỗ
vừa chỉnh, không sửa test cho xanh. Thay đổi đáng kể thì ghi một câu vào báo
cáo.

### Dọn

Rà lại diff theo mục **Dọn trước khi xong** của `coding_guide.md` — chỉ dọn
file mình vừa sửa, không dọn lan sang code cũ.

Gợi ý `code-review`, rồi `ship`.
