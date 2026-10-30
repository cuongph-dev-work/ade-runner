@AGENTS.md

## Riêng cho Claude Code

- Skill được nạp từ `.claude/skills/` (symlink sang `.agents/skills/`). Muốn sửa skill thì sửa ở `.agents/skills/` để Codex và Claude Code dùng chung một bản.
- Subagent `worker`, `reviewer`, `spec-reviewer` ở `.claude/agents/`; mỗi subagent đã preload đúng skill của nó qua trường `skills`. `reviewer` và `spec-reviewer` không có quyền Edit/Write. Sửa subagent nào thì sửa luôn bản Codex tương ứng trong `.codex/agents/`.
- `handoff` nhắc hook `save-state` / `restore-state`; **hiện chưa cài**. Ghi nhật ký thẳng vào file plan trong `.agent-kit/plans/` như skill hướng dẫn.
- Khi viết driver Claude trong `packages/runner`, tham khảo tài liệu Agent SDK cho `settingSources`, `plugins`, `skills`, `canUseTool`, `hooks`; đừng giả định hành vi của Claude Code CLI tương tác áp dụng y nguyên cho SDK.
