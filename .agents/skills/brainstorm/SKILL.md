---
name: brainstorm
description: Dùng khi có ý tưởng mới hoặc yêu cầu chưa rõ, cần làm rõ và chốt hướng trước khi viết DD. Bao gồm cả change request trên DD đã có.
---

# Brainstorm

Biến ý tưởng/yêu cầu mơ hồ thành hướng đã duyệt, trước khi viết DD (UI/API).

Fork skill `brainstorming` Superpowers — xem `NOTICE` (MIT).

## Chốt đầu vào

Từ vào skill tới khi user duyệt thiết kế: **không viết code, không scaffold,
không gọi skill triển khai**. Đọc code được; sửa code không.

## Bước đầu: tìm DD hiện có

Tìm trong `specs/dd/` theo từ khóa (module, mã màn `MC-…`, API id, route).

- **Tìm thấy** → **CR**. Đọc UI/API/overview liên quan; chỉ đổi phần ảnh hưởng.
- **Không thấy** → yêu cầu mới; chuẩn bị viết DD theo
  `specs/templates/ui-spec.template.md` và/hoặc `api-spec.template.md`.

Nói rõ mode (CR / mới) trước khi hỏi tiếp.

## Làm rõ yêu cầu

- **Một câu một lúc.** Ưu tiên A/B/C.
- Mục đích, ràng buộc, tiêu chí thành công.
- Đụng app nào (`api` / `web` / `contracts`); có đổi Zod/Prisma không; tương thích
  ngược / hiệu năng.
- Nêu giả định ngầm thành câu khẳng định để user chốt.
- Biên: rỗng, trùng, hết hạn, sai format, mất mạng, thiếu quyền, concurrent.
- Nhiều khối độc lập → tách trước khi đào sâu một khối.

## Đề xuất phương án

- 2–3 phương án + trade-off; khuyến nghị trước.
- Cắt scope thừa.

## Trình bày thiết kế

- Từng phần: kiến trúc, luồng, màn hình, API, quyền, model — xin chốt từng phần.
- Độ dài theo độ phức tạp.

## Chốt & chuyển viết DD

Sau khi user chốt hướng → skill `spec` viết DD.

- **Mới**: nháp `.agent-kit/specs/YYYY-MM-DD-<slug>-ui|api.md` →
  `spec-reviewer` → chốt `specs/dd/<module>/<id>/…`.
- **CR**: sửa trực tiếp file trong `specs/dd/` (hoặc nháp nếu đổi lớn).

## Xong rồi thì

→ `spec`. Không tự triển khai; chỉ gợi ý bước tiếp và chờ user.
