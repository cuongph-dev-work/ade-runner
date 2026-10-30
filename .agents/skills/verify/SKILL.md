---
name: verify
description: Dùng sau code-review và trước ship: sinh bộ test case theo kỹ thuật QC từ AC/BR, chờ người dùng duyệt, rồi chạy thật trên môi trường local. Scope quyết định tầng bắt buộc: backend thì API, frontend/app thì e2e UI, cả hai thì cả hai cộng tích hợp.
---

# Verify

Sinh bộ test case như một QC, chờ duyệt, rồi chạy thật trên môi trường local.
Khác `test`: skill kia viết unit test lúc đang code, skill này kiểm
chứng thứ đã code có chạy đúng trên môi trường thật không.

Chạy khi thay đổi đụng hành vi người dùng thấy được hoặc hợp đồng API. Bỏ qua
với refactor không đổi hành vi, sửa text/i18n thuần, docs, config — nhưng
**nói rõ đã bỏ và vì sao**, đừng im lặng.

## Scope quyết định tầng bắt buộc

Đọc scope từ bảng phạm vi của plan; không có plan thì từ diff so với `develop`.

| Scope đụng tới              | Tầng bắt buộc               |
| --------------------------- | --------------------------- |
| backend                     | **API**                     |
| frontend / app              | **e2e UI**                  |
| cả backend lẫn frontend/app | **API + e2e UI + tích hợp** |

Tầng bắt buộc mà thiếu công cụ hoặc môi trường để chạy → **dừng và báo**,
không được đánh dấu đạt rồi đi tiếp. Tầng ngoài scope thì bỏ, ghi rõ đã bỏ.

## Bước 1 — Dựng bộ test case

Nguồn theo thứ tự: AC trong DD (Scenario Gherkin, ID `AC-…`) → bảng P/V/E/S
của DD và bảng chuyển `T-NN` của state machine (kỹ thuật "Chuyển trạng thái"
lấy cả cặp bị cấm) → bảng phạm vi trong plan → diff của nhánh so với `develop`.
DD cũ chưa có AC thì suy case từ bảng P/V/E/S, cột `Nguồn` ghi ID dòng (vd
`MC-0001/E-04`). Không có spec thì nói rõ đang suy case từ diff.

Mỗi AC/BR đi qua năm kỹ thuật, mỗi kỹ thuật đẻ ra case riêng:

| Kỹ thuật             | Sinh ra                                     |
| -------------------- | ------------------------------------------- |
| Chia lớp tương đương | mỗi lớp một case hợp lệ và một case không   |
| Giá trị biên         | rỗng, 0, 1, max, max+1                      |
| Bảng quyết định      | mọi tổ hợp cờ điều kiện                     |
| Chuyển trạng thái    | bật → tắt → bật: giữ gì, mất gì             |
| Phân quyền           | mỗi vai trò một case, kể cả vai trò bị chặn |

AC là **sàn chứ không phải trần**: case spec chưa viết ra mà kỹ thuật trên chỉ
tới thì vẫn đưa vào bảng, ghi nguồn là `suy ra (AC-…)`. Mỗi AC-ID của DD
phải có ít nhất một case; AC nào không có case thì nói rõ lý do.

Ghi vào `.agent-kit/e2e/YYYY-MM-DD-<slug>.md` ở gốc repo chính, tiếng Việt,
không commit. Cột: `#`, `Tầng` (`API` / `FE` / `TÍCH HỢP`), `Case`, `Kỳ vọng`,
`Nguồn`, `Kết quả`. **Một file duy nhất** — chạy xong điền kết quả vào chính
bảng đó, tách hai file thì sớm muộn lệch nhau.

## Bước 2 — Xin duyệt

Dừng. Chờ người dùng duyệt bảng **trong lượt hiện tại**; họ thêm hoặc bớt case
rồi mới chạy tiếp. Không tự chạy chỉ vì bảng trông đã đầy đủ.

## Bước 3 — Kiểm tra môi trường

Backend local trả lời, frontend local trả lời, migration đã chạy, token đăng
nhập còn hạn. Thiếu thứ nào thì báo và **dừng** — không tự dựng container,
không tự chạy migration; đó là quyết định của người dùng.

## Bước 4 — Chạy theo tầng

Đúng thứ tự, không đảo; tầng nào bắt buộc theo bảng scope ở trên thì không
được bỏ:

1. **API** — bắt buộc khi scope đụng backend. Gọi HTTP thật vào local bằng
   token thật, đối chiếu status, body và hàng trong DB. Bắt được thứ pytest
   không bắt: claim thiếu trong token thật, route chưa khai, migration chưa
   chạy.
2. **Frontend** — bắt buộc khi scope đụng frontend/app; chạy trên trình
   duyệt theo thang công cụ bên dưới.
3. **Tích hợp** — luồng người dùng thật đi xuyên suốt: đăng nhập → thao tác →
   dữ liệu ghi xuống → tải lại → vẫn đúng.

**API còn đỏ thì dừng, không sang frontend** — lỗi tầng dưới làm sai lệch mọi
kết luận tầng trên.

## Thang công cụ

Thử lần lượt, dùng cái đầu tiên chạy được, **ghi vào báo cáo đã dùng cái nào**.

| Việc         | Thứ tự ưu tiên                 | Coi là có khi                                |
| ------------ | ------------------------------ | -------------------------------------------- |
| Trình duyệt  | Orca                           | `orca status --json` → `ok` và `app.running` |
|              | Browser use của Claude/Codex   | tool có trong phiên                          |
|              | Chrome DevTools MCP            | server đã kết nối                            |
|              | Playwright MCP                 | server đã kết nối                            |
| Kiểm dữ liệu | TablePro MCP                   | `list_connections` có kết nối tới DB local   |
|              | MySQL MCP                      | server đã kết nối                            |
|              | `mysql` CLI hoặc `docker exec` | lệnh chạy được                               |

Không công cụ trình duyệt nào chạy → dừng ở tầng API và nói rõ. **Không** kết
luận frontend đạt bằng cách đọc code.

## Luật kiểm chứng

- **Không kết luận bằng một nguồn.** Mỗi case đối chiếu tối thiểu hai nguồn
  độc lập: giao diện và request thật trong network; có ghi DB thì thêm truy vấn.
- **Chụp lại tham chiếu phần tử trước mỗi thao tác** — trang vẽ lại thì ref cũ
  trỏ sang phần tử khác.
- **Kiểm origin đang test.** Trình duyệt có thể phục vụ ứng dụng qua host
  riêng; khác origin là khác phiên đăng nhập, là đang xem dữ liệu tổ chức khác.
- **Nghi có lỗi thì truy tới nguyên nhân rồi mới ghi vào báo cáo.** Phần lớn
  nghi ngờ hoá ra là môi trường chứ không phải bug.

## Dữ liệu test

Tạo dữ liệu riêng có tiền tố nhận biết, không sửa dữ liệu sẵn có. Ngoại lệ
hẹp: luồng buộc phải sửa hàng có sẵn, ví dụ cấu hình singleton của tổ chức
đang đăng nhập — khi đó `SELECT` chụp hàng trước, trả về sau, ghi cả hai lần
vào báo cáo. Chỉ chạy trên DB local.

## Bước 5 — Báo cáo

Điền cột Kết quả vào bảng đã duyệt, rồi thêm ba mục ở cuối: **lỗi tìm được**
kèm nguyên nhân gốc chứ không chỉ triệu chứng, **điểm cần cải thiện** cho thứ
chạy đúng nhưng dùng khó, và **case chưa test được** kèm lý do. Còn dòng bỏ
trống thì không được viết "đã test hết".

## Xong rồi thì

- Có lỗi → `cook` sửa, rồi chạy lại đúng case đã đỏ.
- Sạch, hoặc chỉ còn điểm cải thiện mà người dùng chấp nhận bỏ qua →
  `ship`.

Không tự chuyển sang `ship`.
