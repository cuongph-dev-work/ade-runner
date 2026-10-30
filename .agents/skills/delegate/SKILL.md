---
name: delegate
description: Orchestrator của chặng triển khai. Giao từng dòng bảng phạm vi cho agent worker code, agent reviewer chấm, loop fix tối đa 3 vòng trong chặng, rồi main agent tự kiểm chứng lại trước khi tick. Main điều phối, không tự code.
---

# Delegate

Main agent là điều phối thuần của chặng triển khai: mỗi dòng bảng phạm vi
giao cho agent `worker` code, agent `reviewer` chấm, loop fix ngay trong
chặng. Đổi tốc độ lấy cô lập context — **không** nhanh hơn.

## Vòng làm việc cho một dòng plan

```
spawn worker(gói giao việc) ──► done | blocked
  blocked → main hỏi người dùng → bổ sung gói → spawn lại
  done    → spawn reviewer(branch/diff) ──► finding
     chặn / nên sửa → spawn worker(gói + finding, cùng branch) → chấm lại
     chỉ còn gợi ý → main kiểm chứng → tick ✅ → dòng kế
```

Loop trên **cả `blocking` lẫn `should_fix`** — `should_fix` là vi phạm luật
có dẫn nguồn, không phải ý kiến; bỏ qua nó chính là cách vi phạm coding guide
sống sót qua nhiều vòng review. Chỉ `suggestions` mới không loop — đính kèm
báo cáo cuối cho người dùng.

Tối đa **3 vòng** chấm-fix mỗi dòng. Chạm trần mà còn `blocking` hoặc
`should_fix` → dừng, trình người dùng finding còn lại + diff + lịch sử vòng
để phân xử.

## Gói giao việc

Chạy `handoff` cho riêng dòng đó làm lõi gói — nó vốn được viết
cho người nhận không có lịch sử hội thoại. Thêm vào đó:

- Repo, thư mục phạm vi và branch cụ thể phải làm việc trên.
- **Đường dẫn tuyệt đối** tới spec, skill `cook`, `.agents/rules/README.md`
  và `.agents/rules/` của repo — agent chạy context riêng, không thấy đường
  dẫn tương đối của hội thoại này. Gói cho `reviewer` cần thêm đường dẫn skill
  `code-review`.
- **Không commit vào `main`, `master`, `develop`** — nhắc lại nguyên văn,
  agent không thừa hưởng ràng buộc từ hội thoại này.
- Thứ dòng trước tạo ra mà dòng này cần: signature API thật, tên field thật,
  mã lỗi thật. Chép giá trị chính xác, không mô tả suông.
- Vòng ≥2: danh sách finding `blocking` và `should_fix` phải fix, kèm
  `file:line` và nguồn luật reviewer đã dẫn.

**Không** dán lịch sử các dòng đã xong vào gói. Worker cần đúng việc của nó,
không cần biết đường đi trước đó.

## Song song

**Một dòng, một dispatch.** Chỉ spawn song song những dòng **khác repo** và
không phụ thuộc nhau; cùng repo, hoặc dòng sau tiêu thụ hợp đồng của dòng
trước (backend → frontend/app) → tuần tự theo thứ tự plan.

## Host không có subagent

Một số host không có subagent — không giả lập bằng process ngoài (YAGNI). Main
agent tự chạy tuần tự `cook` rồi `code-review` cho từng
dòng bảng phạm vi, ngay trong context hiện tại, không gọi Task tool. Vẫn giữ
nguyên loop chấm-fix tối đa 3 vòng và tiêu chí chặn/nên sửa/gợi ý ở trên; chỉ
khác chỗ không cô lập được context giữa các dòng như khi có subagent thật.

## Blocked và tắc

Worker trả `blocked` → main mang câu hỏi ra hỏi người dùng, bổ sung gói rồi
spawn lại. Tắc hai lần liên tiếp cùng một lý do → dừng giao, main tự làm
dòng đó — giao lại y nguyên chỉ tốn thêm lượt. Agent chết không trả báo cáo
→ retry một lần với gói y nguyên; vẫn chết → báo người dùng kèm tên
branch đang dở.

## Kiểm chứng — mục quan trọng nhất

Main agent **tự chạy lại test** của dòng vừa xong, trên máy mình.

> Báo cáo của agent về test **không tính là bằng chứng**. Chỉ `git diff` và
> output test do chính mình chạy mới tính.

Đây không phải đề phòng lý thuyết: đã có agent báo "đã chạy test, pass" mà
thực tế chưa từng chạy. Reviewer đối chiếu trong vòng chấm; main đối chiếu
lần cuối trước khi tick. Đọc `git diff` của dòng đó — agent làm dư ngoài
phạm vi là chuyện thường gặp.

## Ghi lại trước khi sang dòng kế

- Đổi `⬜` thành `✅` trong bảng phạm vi.
- Thêm một dòng vào `## Nhật ký` sau **mỗi vòng** chấm-fix (vòng mấy, finding
  nào còn), kèm khoảng commit, theo `handoff`.

Ghi ngay, không dồn. Context bị nén giữa chừng thì file plan là thứ duy nhất
còn lại để biết đã tới đâu — tin nó và `git log`, đừng tin trí nhớ.

## Xong rồi thì

Hết bảng phạm vi → `ship`. Mỗi dòng đã qua `reviewer` trong loop
nên không bắt buộc vòng review tổng; người dùng muốn chấm lại toàn bộ thì
gọi `code-review`.
