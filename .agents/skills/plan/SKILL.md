---
name: plan
description: Dùng khi đã rõ việc cần làm và cần chia thành các bước kiểm chứng được, hoặc khi việc trải trên nhiều repo và cần chốt phạm vi với thứ tự thực hiện.
---

# Plan

Chia yêu cầu đã rõ thành bước nhỏ, kiểm chứng được; nhiều repo thì chốt phạm vi
và thứ tự trước khi code.

Fork `writing-plans` Superpowers — xem `NOTICE` (MIT).

## Khi nào cần plan

- Việc nhỏ, một repo, phạm vi rõ → `cook`, không plan.
- Cần plan khi: nhiều repo, đổi hợp đồng API, hoặc >3 bước phụ thuộc.

## Phạm vi & thứ tự

Bảng đầu file plan, ngay dưới tiêu đề:

```markdown
## Phạm vi & thứ tự

| # | Phạm vi | Repo | Branch | Xong |
| --- | --- | --- | --- | --- |
| 1 | dd | specs/dd/ | — | ⬜ |
| 2 | contracts | packages/contracts | feat/<slug>/<summary> | ⬜ |
| 3 | backend | apps/api | feat/<slug>/<summary> | ⬜ |
| 4 | frontend | apps/web | feat/<slug>/<summary> | ⬜ |
| Thư mục dự kiến đụng tới: `<liệt kê>` |
```

Thứ tự mặc định: **dd → contracts → backend → frontend**.
Chỉ liệt kê dòng trong phạm vi. User đảo thứ tự → hỏi xác nhận một lần.
User duyệt bảng = chốt scope.

`cook` đọc bảng, tick `Xong` sau mỗi dòng.

## Chia bước

Mỗi bước 2–5 phút, kiểm chứng được (lệnh, output, file). Có code thì viết code
thật trong plan — không “TBD”, không “xử lý phù hợp”. Bước hiện thực hành vi
có AC trong DD thì ghi AC-ID ở bước đó (vd `→ AC-MC-0001-03`).

## Đầu ra

`.agent-kit/plans/YYYY-MM-DD-<slug>.md` ở **root repo chính** (không worktree).
Tiếng Việt; giữ nguyên symbol/path/lệnh. Cuối file `## Nhật ký` rỗng cho `handoff`.

## Tự soát

Đối chiếu plan với DD (hoặc yêu cầu gốc):

- Mỗi yêu cầu DD có bước phủ? DD có AC thì mỗi AC-ID xuất hiện ở ít nhất một
  bước.
- Tên hàm/kiểu bước sau khớp bước định nghĩa?

Sửa tại chỗ, không hỏi lại vì lệch tên.

## Xong rồi thì

→ `delegate`: mỗi dòng phạm vi → `worker` (`cook`) ⇄ `reviewer`, đúng thứ tự bảng.
