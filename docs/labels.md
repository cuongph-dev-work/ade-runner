# Nhãn & thuộc tính issue/MR — quy ước dự án

Bảng **gợi ý** để agent gán nhãn nhất quán. KHÔNG áp cứng:

- Trước khi gán, **xác minh nhãn tồn tại** trong project qua GitLab MCP
  (`@cuongph.dev/mcp-gitlab`); nhãn chưa có chỉ tạo khi người dùng duyệt.
- Thuộc tính chưa rõ → **HỎI người dùng** (xem skill `spec` / `ship`), không tự
  mặc định.

## Nhãn (labels)

### `type:` — bắt buộc đúng 1 (khớp `<type>` của branch)

| Nhãn            | Dùng cho                        |
| --------------- | ------------------------------- |
| `type:feature`  | Tính năng mới                   |
| `type:fix`      | Sửa lỗi                         |
| `type:refactor` | Tái cấu trúc, không đổi hành vi |
| `type:chore`    | Việc vặt, build, deps           |
| `type:docs`     | Tài liệu                        |

### `area:` — ≥ 1 (theo phần bị ảnh hưởng)

| Nhãn             | Phạm vi                                 |
| ---------------- | --------------------------------------- |
| `area:api`       | `apps/api` — NestJS                     |
| `area:web`       | `apps/web` — React                      |
| `area:contracts` | `packages/contracts` — Zod schema/types |
| `area:db`        | Prisma schema / migration               |
| `area:infra`     | Docker, CI, deploy                      |

### `priority:` — tùy chọn

`priority:high` · `priority:medium` · `priority:low`

### `status:` — tùy chọn (board workflow)

`status:blocked` · `status:in-review`

## Assignee

Mặc định: người thực hiện (author của branch/MR). Nhiều người hoặc chưa rõ → hỏi.

## Milestone

Theo sprint/release đang mở. Chưa rõ → liệt kê milestone qua GitLab MCP để người
dùng chọn, hoặc bỏ trống nếu người dùng xác nhận.

## Nhánh & MR (nhắc lại)

- Branch: `<type>/<iid>-<slug>` (vd `feat/123-fill-report`).
- MR title theo Conventional Commit; MR description có `Closes #<iid>`.
- `type:` của nhãn khớp `<type>` của branch/commit.
