---
name: ship
description: Dùng khi code đã xong và cần đẩy lên remote rồi mở merge request vào develop trên GitLab. Hỏi có muốn tạo GitLab issue kèm theo không, nhưng không bắt buộc.
---

# Ship

Đẩy branch đã commit xong lên remote và mở **merge request (MR)** vào `develop`
trên **GitLab**. Skill duy nhất trong kit có hành động ra bên ngoài (push, tạo
MR) — mọi bước trước khi chạy lệnh thật đều để phục vụ việc xác nhận đó.

## Loại MR — hỏi một lần nếu chưa rõ

| Loại        | Khi nào                                       | Template (byte-identical)                                                        |
| ----------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| **Spec**    | Diff ⊆ whitelist dưới                         | `.gitlab/merge_request_templates/Spec.md` ≡ `.agents/templates/mr-Spec.md`       |
| **Feature** | Có `apps/` / `packages/` hoặc ngoài whitelist | `.gitlab/merge_request_templates/Feature.md` ≡ `.agents/templates/mr-Feature.md` |

Whitelist Spec:

```text
specs/**
.agents/templates/**
.agents/skills/spec/**
.agents/skills/spec-review/**
.agents/skills/ship/**
.gitlab/merge_request_templates/**
.gitlab-ci.yml
.claude/agents/spec-reviewer.md
.codex/agents/spec-reviewer.toml
.omp/agents/spec-reviewer.md
```

Diff gắn Spec mà **ngoài** whitelist → hỏi đổi Feature hoặc tách MR; **không**
tạo MR Spec lệch.

Description **toàn văn** theo file template, tiếng Việt. Feature: `Closes #<iid>`
nếu có issue; path spec hoặc một dòng “không spec vì việc nhỏ / một repo / phạm
vi đã rõ”.

## Issue

Chưa có issue liên quan thì **hỏi** (không bắt). Refactor/fix/kit spec-only đi
thẳng MR. Có tạo thì GitLab MCP hoặc `glab issue create`, rồi `Closes #<iid>`
trên **Feature**.

Thuộc tính issue/MR: **chưa rõ → HỎI**, không tự mặc định (`docs/labels.md`).

## Gate cục bộ

### Feature

**PASS toàn bộ** trước khi push:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

Fail → **DỪNG**, không push. Hiện pass/fail từng bước trước Preview.

### Spec

**Không** bắt `pnpm lint` / `typecheck` / `build` / `test` app. Kiểm chứng:
spec-review không còn Thiếu/Mâu thuẫn; diff trong whitelist.

## Preview trước khi push

Trước khi chạy bất kỳ lệnh nào, hiện đủ:

- loại MR (Spec | Feature)
- remote `origin` và branch sẽ push
- khoảng commit sẽ đẩy lên
- target: `develop`
- tiêu đề MR
- **toàn văn** MR description (copy từ template đã điền)
- đúng lệnh sẽ chạy ở mục Chạy

## Xin xác nhận

Xác nhận phải nằm trong **lượt hiện tại**.

| Người dùng trả lời        | Được làm                   |
| ------------------------- | -------------------------- |
| "commit thôi"             | Không push, không tạo MR   |
| "push thôi"               | Push branch; không tạo MR  |
| "push và tạo MR"          | Chạy đúng preview đã duyệt |
| Mơ hồ, hoặc preview đã cũ | Hỏi lại, hiện preview mới  |

## Chạy

```bash
git -C '<worktree>' push --set-upstream 'origin' '<branch>'

glab mr create --source-branch '<branch>' --target-branch 'develop' \
  --title '<title>' --description "$(cat '<đường dẫn description>')" --yes
```

Không `glab` → GitLab MCP / API. Không push `main`/`master`/`develop`. Target
luôn `develop`.

## Thuộc tính MR

Labels, assignee, reviewer, milestone: hỏi nếu chưa rõ.

## Đã có MR rồi

`glab mr list --source-branch '<branch>'`. Có rồi thì báo URL, không tạo trùng.

## Xong rồi thì

Báo URL MR rồi **dừng** — không tự merge, không xoá nhánh.
