# Quyết định Kiến trúc & Bộ nhớ Dự án ADE Runner

- **Kiến trúc Local-first**: Hub Fastify kết hợp SQLite với mô hình Event Sourcing append-only.
- **Harness Isolation**: Chạy Claude Agent SDK và ACP Codex qua worktree cô lập theo thread (`.ade/wt/<thread_id>`).
- **Giao diện Hallmark**: Coral ở chế độ Sáng và Console ở chế độ Tối, nạp từ `tokens.css`.
- **An toàn & Cổng duyệt**: Mọi phân quyền chạy lệnh hay chuyển trạng thái đều qua các cổng duyệt Plan / Review / Bash.
