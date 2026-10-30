---
name: test
description: Dùng khi cần viết hoặc sửa test cho một thay đổi code. Nêu quy trình RED-GREEN-REFACTOR và cách viết test bắt được lỗi thật thay vì test hình thức.
---

# Test

Viết test bắt được lỗi thật. Fork từ skill `test-driven-development` của
Superpowers, rút gọn và Việt hóa. Xem `NOTICE` để biết attribution MIT.

## Khi nào cần test

| Bắt buộc có test                                                                 | Không ép                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| Bug reproduce được bằng code: logic sai, biên dữ liệu, null                     | Bug thị giác: layout, spacing, màu, responsive |
| Business rule, validation, tính toán                                             | Sửa text hoặc i18n                             |
| Hợp đồng API, biến đổi dữ liệu                                                   | Animation, transition                          |
| State machine, phân quyền                                                        | Thuần styling                                  |
| API: guard, pipe, service, client, mapping lỗi và side effect ở boundary         | Chỉ đổi class Tailwind hoặc primitive UI      |
| Web: form/filter, navigation, query state, error/loading/empty và callback UI   | Đổi layout thuần không đổi hành vi            |

Câu hỏi phân loại: **viết được một test fail trước khi sửa không?** Viết được
thì thuộc cột trái. Cột phải không cấm test, chỉ không ép và không bịa cho có.

Khi thuộc cột bắt buộc, test phải xuất hiện trước code mới (RED). Nếu chọn
miễn test, ghi rõ lý do trong báo cáo của `cook`; không dùng "việc nhỏ" hoặc
"sẽ thêm sau" làm lý do. Test phải bắt được mutation ở boundary, ví dụ:

- bỏ kiểm tra JWT hoặc đổi ưu tiên cookie/Bearer;
- bỏ quyền trong `RolesGuard` hoặc bỏ path của lỗi Zod;
- nuốt lỗi non-2xx của API client;
- chọn nhầm prefix navigation hoặc render bảng rỗng như có dữ liệu.

Đọc mục **Khi viết test** của `coding_guide.md`; README ở
`.agents/rules/README.md` nói thư mục nào. Chỉ đọc file trong
`.agents/rules/` có tên khớp ngôn ngữ / việc đang làm; không đọc cả thư mục.

## Vòng RED → GREEN → REFACTOR

**RED** — viết một test nhỏ mô tả hành vi đúng, rồi chạy để **xem nó fail**.
Xác nhận: fail chứ không phải lỗi cú pháp, và fail vì thiếu tính năng chứ
không phải vì gõ sai tên. Test pass ngay từ đầu nghĩa là đang test hành vi đã
có sẵn — sửa lại test.

**GREEN** — viết code tối thiểu đủ làm test pass. Chạy lại và xác nhận các test
liên quan không vỡ; test vẫn fail thì sửa code, không sửa test cho khớp.

**REFACTOR** — sau khi xanh: bỏ trùng, đặt tên, tách helper; giữ xanh.

Với bug: viết test reproduce lỗi, thấy fail rồi mới sửa; đó là bằng chứng lỗi
đã được vá.

## Test tốt trông thế nào

Trước khi viết thân test: **thay đổi nào trong code sẽ làm test này fail — và
đó là lỗi hay quyết định?** Không trả lời được thì test chưa có lý do tồn tại.

- **Tự tính giá trị mong đợi.** Dùng số/chuỗi viết tay. Nếu giá trị mong đợi
  do chính hàm đang test sinh ra, test luôn pass dù code sai thế nào.
- **Assert hành vi thật, không assert mock.** Kiểm tra kết quả code tạo ra,
  không kiểm tra "mock đã được gọi mấy lần".
- **Đừng test hằng số.** Không `assert MAX_RETRIES == 5` mà test rằng lần gọi
  thứ 6 không xảy ra.
- **Mỗi test một việc.** Tên có chữ "và" thì tách đôi.
- **Đừng test framework.** Test hợp đồng ở biên code của mình, không test cơ
  chế của thư viện bên thứ ba.
- **Tên test mang AC-ID** khi hành vi có AC trong DD:
  `it("AC-MC-0001-03 keeps Account ID on wrong password")`. Đây là ngoại lệ
  có chủ đích của luật không nhúng ID spec vào code — chỉ cho tên test.

## Kiểm tra đột biến

Trước khi coi là xong, thử tưởng tượng sửa hỏng code theo từng cách sau — mỗi
cách phải có ít nhất một test fail:

- đổi sai hằng số hoặc tham số
- rẽ nhầm nhánh điều kiện
- thiếu một thay đổi trạng thái hoặc side effect
- trả về rỗng hoặc giá trị mặc định
- bỏ kiểm tra `0`, rỗng, `null`, không có quyền, dữ liệu sai định dạng

Không cách nào bị bắt nghĩa là hành vi đó chưa được bảo vệ, hoặc test chỉ
đang chạy cho có.

## Dấu hiệu test kém

- Phần dựng mock dài hơn nửa test, hoặc không giải thích được vì sao cần mock
- Test chỉ fail khi code crash, không fail khi code trả sai kết quả
- Test tồn tại chỉ để tăng coverage, không kiểm tra kết quả nào

## Xong rồi thì

Quay lại `cook` để tiếp tục phần code còn lại.
