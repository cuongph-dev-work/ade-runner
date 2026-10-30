---
name: debug
description: Dùng khi có bug, test fail, hành vi lạ hoặc build hỏng mà chưa biết nguyên nhân. Tìm nguyên nhân gốc trước khi sửa, thay vì đoán và vá triệu chứng.
---

# Debug

Tìm nguyên nhân gốc rồi mới sửa. Fork từ skill `systematic-debugging` của
Superpowers, rút gọn và Việt hóa. Xem `NOTICE` để biết attribution MIT.

## Khi nào cần

Bug, test fail, hành vi lạ, build hỏng, vấn đề hiệu năng — mà **chưa chỉ ra
được nguyên nhân**. Biết chắc nguyên nhân rồi (đọc log ra ngay, thiếu null
check ở đúng dòng) thì đi thẳng `cook`.

Càng gấp càng nên dùng: đoán bừa dưới áp lực thời gian thường tốn nhiều thời
gian hơn là làm tuần tự.

## Giai đoạn 1 — Tìm nguyên nhân gốc

Chưa xong giai đoạn này thì chưa đề xuất cách sửa.

- **Đọc kỹ thông báo lỗi.** Đọc hết stack trace, ghi lại số dòng, đường dẫn,
  mã lỗi. Đừng lướt qua warning.
- **Reproduce cho ổn định.** Các bước chính xác là gì, có xảy ra mọi lần
  không. Chưa reproduce được thì đi thu thập thêm dữ liệu, đừng đoán.
- **Xem thay đổi gần đây.** `git diff`, commit gần nhất, dependency mới, đổi
  config, khác biệt môi trường.
- **Hệ nhiều thành phần thì đo ở từng ranh giới.** Với luồng đi qua nhiều
  lớp (API → service → DB, CI → build → sign): log dữ liệu vào và ra ở mỗi
  ranh giới, chạy một lần để thấy **lớp nào hỏng**, rồi mới đào vào lớp đó.
- **Truy ngược dòng dữ liệu.** Giá trị sai xuất hiện đầu tiên ở đâu, ai
  truyền nó vào. Đi ngược lên tới nguồn. Sửa ở nguồn, không sửa ở chỗ triệu
  chứng lộ ra.

## Giai đoạn 2 — So với cái đang chạy đúng

- Tìm đoạn code tương tự đang hoạt động đúng trong cùng repo.
- Liệt kê **mọi** khác biệt giữa bên chạy được và bên hỏng, kể cả khác biệt
  trông có vẻ không liên quan. Xem cả config, biến môi trường, giả định.

## Giai đoạn 3 — Giả thuyết và kiểm chứng

- Nêu **một** giả thuyết, viết ra thành câu: "tôi nghĩ X là nguyên nhân vì Y".
- Kiểm chứng bằng thay đổi **nhỏ nhất có thể**, mỗi lần một biến.
- Đúng → sang giai đoạn 4. Sai → nêu giả thuyết mới, **không chồng thêm bản
  vá lên bản vá trước**.
- Không hiểu chỗ nào thì nói thẳng là chưa hiểu, đừng giả vờ đã hiểu.

## Giai đoạn 4 — Sửa

- Viết test reproduce lỗi trước, thấy nó fail — dùng `test`.
- Sửa đúng nguyên nhân gốc, không vá triệu chứng.
- Chạy lại test đó và các test liên quan.

## Xong rồi thì

Nói rõ nguyên nhân gốc đã tìm ra trước khi đi tiếp — đó là thứ người dùng
cần để đánh giá bản vá, không phải danh sách file đã sửa.

- Bản vá gọn trong một repo → `cook`.
- Phải sửa nhiều repo, hoặc đổi hợp đồng API → `plan` trước để
  chốt thứ tự, rồi mới `cook`.

## Dấu hiệu đang làm sai

- Sửa nhiều chỗ cùng lúc rồi xem cái nào ăn
- Thêm `try/catch` để lỗi biến mất thay vì hiểu vì sao lỗi
- Nói "chắc là do..." mà chưa reproduce được
- Bản vá thứ ba cho cùng một triệu chứng
- Tăng timeout hoặc thêm `sleep` để test hết flaky

Gặp mấy dấu hiệu này thì quay lại giai đoạn 1.

## Không tìm ra nguyên nhân gốc

Nói rõ đã thử gì, loại trừ được gì, còn nghi ngờ chỗ nào, và cần thêm dữ
liệu gì. Bàn giao lại cho người dùng với đúng những thứ đó — đừng vá đại một
cái rồi coi như xong.
