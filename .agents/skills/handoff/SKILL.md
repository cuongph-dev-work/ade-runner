---
name: handoff
description: Dùng khi cần ghi lại tiến độ công việc kéo dài, hoặc nén trạng thái đang làm dở thành một bản bàn giao tự chứa cho agent khác tiếp quản.
---

# Handoff

Hai việc: giữ file tiến độ cục bộ, và khi được yêu cầu thì nén nó thành bản
bàn giao cho người hoặc agent khác tiếp quản.

## File tiến độ

`.agent-kit/plans/YYYY-MM-DD-<slug>.md` — cùng file mà `plan` sinh
ra. Việc không cần plan nhưng kéo dài thì vẫn tạo, chỉ có bảng phạm vi và
nhật ký.

Luôn đặt ở **thư mục gốc của repo chính**, kể cả khi đang làm trong worktree
— worktree bị xoá là mất sạch nhật ký, và nhật ký cần theo bạn giữa các
worktree.

**Khi nào cần:** việc kéo dài qua nhiều lượt, đụng nhiều repo, hoặc biết
trước sẽ bàn giao. Sửa một file xong trong một lượt thì không cần —
`git log` đã đủ.

`.agent-kit/` **không** được commit. Nó là trí nhớ làm việc cục bộ, không
phải kênh truyền trạng thái sang máy khác.

## Mục Nhật ký

Đặt cuối file tiến độ. **Chỉ thêm dòng mới, không sửa hay xoá dòng cũ** —
dòng sai cũng để nguyên rồi thêm dòng đính chính bên dưới. Lịch sử bị viết
lại thì không còn tin được nữa.

```markdown
## Nhật ký

- 2026-08-06 14:30 — xong backend, bảng phạm vi dòng 2 → ✅ (a1b2c3d..e4f5g6h)
- 2026-08-06 15:10 — chốt optimistic lock thay SELECT FOR UPDATE, vì tần
  suất ghi thấp và tránh giữ transaction dài
- 2026-08-06 16:02 — vướng: seed staging thiếu `region_id`. Đã thử tạo tay,
  bị migration ghi đè.
```

Ghi bốn loại: **mốc hoàn thành** kèm khoảng commit, **quyết định đã chốt**
kèm lý do, **đang vướng** kèm thứ đã thử, và **hướng đã bỏ** kèm lý do bỏ —
để người sau không đi lại đường cụt đó. Ghi ngay khi sự kiện xảy ra —
dồn tới cuối thì đúng lúc context bị nén là mất sạch.

## Bản bàn giao

Khi người dùng yêu cầu bàn giao, đọc file tiến độ, `git log` của nhánh,
`git status`, và diff đang dang dở nếu có.

Người nhận có thể ở máy khác, provider khác, **không có file tiến độ và
không có lịch sử hội thoại**. Bản bàn giao phải **tự chứa**: không viết
"như đã bàn ở trên", không trỏ tới file họ không có — đường dẫn trong repo
thì được, vì họ clone được.

In thẳng bản bàn giao ra hội thoại để người dùng copy sang chỗ khác, đồng
thời lưu một bản vào `.agent-kit/handoffs/YYYY-MM-DD-<slug>.md`. **Không để
chung `plans/`**: hook `save-state` ghi snapshot vào file `.md` mới nhất ở đó
và `restore-state` đọc lại file ấy như plan đang chạy, nên bản bàn giao nằm
chung sẽ cướp chỗ của plan. Slug bắt buộc — hai bàn giao cùng ngày mà thiếu
nó thì cái sau đè cái trước.

Gồm đúng những mục sau:

| Mục        | Nội dung                                                |
| ---------- | ------------------------------------------------------- |
| Mục tiêu   | Đang làm gì, để giải quyết vấn đề gì                    |
| Đang ở đâu | Repo, nhánh, commit cuối, phần nào xong phần nào chưa   |
| Đã chốt    | Các quyết định kèm lý do — thứ dễ bị làm ngược lại nhất |
| Còn lại    | Việc chưa làm, theo thứ tự                              |
| Đang vướng | Vấn đề chưa gỡ được, kèm thứ đã thử                     |
| Cạm bẫy    | Chỗ đã mất thời gian, hướng đã thử và bỏ                |
| Kiểm chứng | Lệnh chạy test, cách biết là đúng                       |

Mục nào không có nội dung thì ghi "không có", đừng bỏ trống — người nhận cần
phân biệt được giữa _không có gì_ và _quên ghi_.

## Xong rồi thì

Bàn giao xong thì dừng, không tự làm tiếp phần đã bàn giao trừ khi người
dùng bảo tiếp.
