# ade-runner — hướng dẫn cho agent

File này dùng chung cho mọi agent (Codex đọc trực tiếp, Claude Code đọc qua `CLAUDE.md`). Trả lời người dùng bằng **tiếng Việt**; giữ nguyên symbol, path, lệnh.

## Dự án

ADE (agentic development environment) chạy local-first, làm việc qua chat: project → channel → thread. Người dùng @mention agent trong thread; mỗi thread có một main agent điều phối các worker chạy song song; plan, spec và review phải qua cổng duyệt của người.

- Thiết kế tổng thể: `docs/spec.md`
- Kế hoạch theo phase và cách nghiệm thu: `docs/phases.md`
- MVP chỉ làm chế độ **Solo** (hub + runner trên một máy). Team và VPS chỉ có trong thiết kế, chưa triển khai.
- Tên `ade-runner`, `.ade/`, `ADE_MODE` là tên tạm.

**Trạng thái:** chưa có code, chưa khởi tạo git. Việc tiếp theo là P0 trong `docs/phases.md`. Khi khởi tạo git: tạo `.gitignore` có `.agent-kit/`, `node_modules/`, thư mục data local của hub; tạo nhánh `develop` làm nhánh tích hợp.

## Cấu trúc dự kiến (dựng ở P0)

| Thư mục | Nội dung |
| --- | --- |
| `apps/hub` | Server: chat API, event store (SQLite), rule engine, ADE MCP server, phục vụ SPA |
| `apps/web` | React SPA (Vite) |
| `packages/runner` | `ade-runner`: driver Claude (Agent SDK), driver ACP (Codex), worktree theo thread |
| `packages/shared` | Type event, schema Zod dùng chung |
| `tests/scenarios/` | Kịch bản YAML cho fake harness |
| `scripts/verify/` | Script nghiệm thu, in PASS/FAIL, exit code ≠ 0 khi fail |
| `e2e/` | Playwright spec theo phase (`p<N>-*.spec.ts`) |

`.ade/` là thư mục cấu hình **runtime** mà sản phẩm đọc trong repo người dùng; đừng nhầm với `.agents/` và `.claude/` là cấu hình agent của chính repo này.

## Lệnh

Stack: Node/TS, pnpm monorepo. Các lệnh dưới đây được tạo ở P0; lệnh nào chưa có thì nói rõ là chưa có, không bịa lệnh khác.

| Lệnh | Dùng khi |
| --- | --- |
| `pnpm install` | Cài dependency |
| `pnpm dev` | Chạy hub + web trên localhost |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` | Gate của `cook` (trên phạm vi sửa) và `ship` (toàn bộ) |
| `pnpm accept:p<N>` | Nghiệm thu phase N: Playwright + script của phase |
| `pnpm accept:all` | Chạy lại nghiệm thu mọi phase đã xong (bắt regression) |
| `pnpm real:<tên>` | Script chạy Claude/Codex thật; chỉ trên máy dev đã đăng nhập, **không** chạy trong CI |

## Quy trình theo skill

Skill nằm ở `.agents/skills/` (Codex đọc trực tiếp; Claude Code đọc qua symlink trong `.claude/skills/`). Sửa skill ở `.agents/skills/`. Luồng chuẩn cho một tính năng:

`brainstorm` → `spec` → `spec-review` → `plan` → `delegate` (`cook` ⇄ `code-review`) → `verify` → `ship`

| Tình huống | Skill |
| --- | --- |
| Ý tưởng hoặc yêu cầu chưa rõ, change request | `brainstorm` |
| Viết thiết kế chi tiết (DD) / chấm DD | `spec` / `spec-review` |
| Việc nhiều bước hoặc đụng nhiều package | `plan` |
| Triển khai theo plan (main điều phối worker và reviewer) | `delegate` |
| Viết code cho yêu cầu đã rõ | `cook` |
| Viết hoặc sửa test | `test` |
| Bug, test fail, hành vi lạ chưa rõ nguyên nhân | `debug` |
| Chấm code đã sửa | `code-review` |
| Kiểm chứng trên môi trường local trước khi ship | `verify` |
| Đẩy branch, mở merge request | `ship` |
| Việc kéo dài, cần ghi nhật ký hoặc bàn giao | `handoff` |

Việc nhỏ, một package, phạm vi rõ → đi thẳng `cook`, không cần `spec` hay `plan`.

### Subagent

`delegate` và `spec` giao việc cho ba subagent. Mỗi subagent có một bản cho Claude Code và một bản cho Codex; sửa thì sửa cả hai cho khớp.

| Subagent | Việc | Claude Code | Codex |
| --- | --- | --- | --- |
| `worker` | Code một dòng bảng phạm vi theo `cook`, trả `done` / `blocked` | `.claude/agents/worker.md` | `.codex/agents/worker.toml` |
| `reviewer` | Chấm diff theo `code-review`, tự chạy lại test, trả `blocking` / `should_fix` / `suggestions` | `.claude/agents/reviewer.md` | `.codex/agents/reviewer.toml` |
| `spec-reviewer` | Chấm DD theo `spec-review`, chỉ đọc | `.claude/agents/spec-reviewer.md` | `.codex/agents/spec-reviewer.toml` |

Subagent không thấy hội thoại của main agent: gói giao việc phải có đường dẫn tuyệt đối tới spec, skill và `AGENTS.md`, như skill `delegate` quy định.

## Ánh xạ skill vào repo này

Bộ skill được viết cho một repo có layout khác. Khi skill nhắc tới các thứ ở cột trái, ở repo này hiểu theo cột phải:

| Skill nhắc | Ở repo này |
| --- | --- |
| DD trong `specs/dd/<module>/<id>/` | Giữ đường dẫn này cho DD của từng tính năng. Module theo phần của spec: `chat`, `runner`, `trigger`, `orchestration`, `settings`, `memory`. Thiết kế gốc vẫn là `docs/spec.md` |
| `apps/api`, `packages/contracts`, Prisma | `apps/hub`, `packages/shared` (Zod), SQLite qua Drizzle |
| Thứ tự plan `dd → contracts → backend → frontend` | `dd → shared → runner / hub → web` |
| Tiêu chí chấp nhận (AC) của DD | Mỗi AC phải truy được tới một dòng nghiệm thu trong `docs/phases.md` hoặc một spec mới thêm vào `pnpm accept:all` |
| Kiểm dữ liệu bằng MySQL / TablePro | SQLite: `sqlite3 <data-dir>/ade.db` |
| `specs/templates/*`, `specs/reference.md`, `.agents/rules/`, `docs/labels.md` | **Chưa có.** Làm theo chỉ dẫn của skill cho trường hợp không tìm thấy nguồn: nói rõ, không bịa nội dung |
| GitLab, MR vào `develop` | Chưa có remote. Giữ quy ước branch và cấm commit `main`/`master`/`develop`; `ship` dừng ở bước push nếu chưa có remote |

## Quy tắc thiết kế không được phá

Đây là các quyết định đã chốt trong `docs/spec.md`, áp cho **code của sản phẩm** (hub, runner, web), không phải cho agent đang làm việc trên repo này. Code đi ngược một quy tắc dưới đây là finding mức **chặn**, trừ khi người dùng đổi spec trước.

1. **Token đăng nhập harness không rời máy dev.** Hub không nhận, không lưu token của Claude Code hay Codex; server chỉ biết tên credential profile.
2. **Harness do runner khởi chạy dùng hồ sơ ADE riêng.** Claude: `settingSources: []`, `CLAUDE_CONFIG_DIR` riêng, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, `strictMcpConfig`. Codex: `CODEX_HOME` riêng. Code của runner không đọc, không ghi `~/.claude`, `~/.codex`, `~/.agents` của dev.
3. **Mọi thay đổi trạng thái là event append-only.** Projection phải dựng lại được từ bảng `events`.
4. **Chỉ rule engine đổi state của thread.** Agent báo kết quả qua `report_outcome`; không để agent tự `set_state` trong MVP.
5. **Không vượt cổng duyệt khi chưa có approval `approved`** đúng kind, dù lệnh đến từ agent hay rule.
6. **Agent chỉ đọc được thread sau khi được mention** (grant); mọi tool đọc của ADE MCP phải kiểm grant.
7. **Cấu hình agent và skill lấy từ `.ade/`** của repo được quản lý; DB chỉ là cache.
8. **CI chỉ dùng fake harness.** Không gọi model thật trong CI; script gọi model thật mang tag `@real`.

## Code intelligence

Trước khi sửa một symbol, tìm mọi chỗ dùng nó:

- `rg -n "<symbol>" apps packages tests scripts e2e`
- Đổi type hoặc schema trong `packages/shared` → chạy `pnpm typecheck` toàn repo, vì hub, web và runner đều phụ thuộc.
- Đổi schema event → cập nhật kịch bản trong `tests/scenarios/` và chạy `scripts/verify/replay-events.ts`.
- Đổi tool của ADE MCP → cập nhật `scripts/verify/mcp-contract.ts` và bảng tool trong `docs/spec.md`.
- Đổi interface driver → kiểm cả hai driver (Claude, ACP) và `FakeClaudeDriver` / `ade-fake-agent`.

## Branch và commit

- Tên nhánh `<type>/<author-slug>/<summary>`, `<type>` ∈ `feat`, `fix`, `refactor`, `chore`, `docs`.
- **Không commit vào `main`, `master`, `develop`.**
- `.agent-kit/` (plan, handoff, nháp spec) là trí nhớ làm việc cục bộ, không commit.
