# Reference — Quy ước viết Detailed Design (DD) cho ADE

Quy ước định dạng dùng chung cho UI/API DD trong `specs/dd/` của dự án `ade-runner`.

## Cấu trúc thư mục

```text
specs/dd/<module>/<id>/ui-*.md
specs/dd/<module>/<id>/api-*.md
specs/dd/<module>/overview.md               # quyết định module, erDiagram con, state machine riêng
specs/dd/domain-model.md                    # domain dùng chung (E0), erDiagram tổng, state machine chung
specs/templates/ui-spec.template.md
specs/templates/api-spec.template.md
specs/templates/state-machine.template.md   # chèn vào domain-model.md / overview.md
specs/message.md                            # SSOT mã MSG* và ERR_*
```

- Module hợp lệ theo `AGENTS.md`: `chat`, `runner`, `trigger`, `orchestration`, `settings`, `memory`.
- Nháp đặt tại `.agent-kit/specs/` (không commit); chỉ chuyển vào `specs/dd/` sau khi người dùng duyệt.
- Kế hoạch scaffold, migration, CI, script ops thuộc `.agent-kit/plans/` hoặc `docs/`, **không** đặt trong `specs/dd/`.

## § Viết requirement — EARS, ID, AC

Áp cho mọi DD mới và phần DD bị sửa trong CR.

### Mẫu câu (EARS tiếng Việt)

Mỗi dòng bảng (`P` / `I` / `E` / `S`) và mỗi câu hành vi đi theo **đúng một** mẫu, mệnh đề luôn theo thứ tự dưới:

| Mẫu | Câu | Ví dụ |
| --- | --- | --- |
| Luôn đúng | `<Hệ thống / màn hình> phải <phản hồi>.` | Danh sách thread phải sắp theo `updated_at` giảm dần. |
| Sự kiện | `Khi <sự kiện>, … phải <phản hồi>.` | Khi nhấn Gửi tin nhắn, màn hình phải gọi `POST /api/threads/:threadId/messages`. |
| Trạng thái | `Trong khi <trạng thái>, … phải <phản hồi>.` | Trong khi approval đang ở trạng thái `pending`, hệ thống phải chặn chuyển sang state sau cổng. |
| Lỗi | `Nếu <điều kiện lỗi>, thì … phải <phản hồi>.` | Nếu trùng `handle` trong project, thì API phải trả HTTP 409 `ERR_AGENT_HANDLE_EXISTS`. |
| Tùy chọn | `Ở nơi có <tính năng / cấu hình>, … phải <phản hồi>.` | Ở nơi bật `use_repo_instructions`, driver Claude phải truyền `settingSources: ["project"]`. |

Trong bảng sự kiện UI, cột "Kích hoạt" mang mệnh đề `Khi / Nếu / Trong khi`, cột "Mô tả" mang phần `phải …`.

### Chất lượng một câu (ISO/IEC/IEEE 29148)

- **Đơn nhất**: 1 kích hoạt → 1 kết quả. Hai kết quả khác nhau → tách dòng.
- **Kiểm chứng được**: kết quả quan sát được (`MSG*`, HTTP + `ERR_*`, URL, trạng thái phần tử UI, giá trị cột SQLite, file trong `.ade/`, event trong `events`) — không phải cảm nhận.
- **Không mơ hồ**: một cách đọc duy nhất; không dùng `hoặc` giữa hai hành vi chưa chốt.
- **Cần thiết**: bỏ câu đi mà không thiếu hành vi nào → câu thừa, xóa.
- **Đầy đủ**: ngưỡng, giới hạn, mã lỗi, vai trò ghi bằng giá trị cụ thể (ví dụ `< 1000 ms`, `max_depth = 3`, `causation <= 20`, `30 phút`).

**Từ cấm** trong câu hành vi (gặp → viết lại bằng giá trị cụ thể):
`phù hợp`, `hợp lý`, `thích hợp`, `nhanh`, `dễ dùng`, `thân thiện`, `tương tự`, `v.v.`, `...` (cuối liệt kê), `nếu cần`, `khi cần`, `tối ưu`, `khoảng`, `xử lý` (đứng một mình, không nói xử lý gì), `có thể` (khi chủ ngữ là hệ thống), `hoặc` (giữa hai hành vi hiển thị chưa chốt).

### ID ổn định

| Bảng | ID | Ví dụ |
| --- | --- | --- |
| Phân quyền (UI §III.1) | `P-NN` | `P-01` |
| Khởi tạo (UI §III.2) | `I-NN` | `I-01` |
| Validate (UI §II · API §3) | `V-NN` | `V-03` |
| Sự kiện (UI §III.3) | `E-NN` | `E-04` |
| Bước server (UI §III.4 · API §4) | `S-NN`, nhiều API: `S<N>-NN` | `S2-03` |
| Tiêu chí chấp nhận | `AC-<mã DD>-NN`; state machine: `AC-<Entity>-NN` | `AC-UI-CH-01-01`, `AC-API-RN-01-02`, `AC-Run-01` |
| Chuyển trạng thái (§ State machine) | `T-NN`, trỏ chéo `<Entity>/T-NN` | `Run/T-03`, `Approval/T-02` |

- ID cố định sau khi duyệt: thêm dòng thì nối số mới; xóa dòng thì bỏ số, không đánh lại.
- Trỏ chéo file: `<mã DD>/<ID>` (ví dụ `UI-CH-01/E-04`); chuyển trạng thái luôn trỏ `<Entity>/T-NN`.
- `AC-ID` là khóa truy vết bắt buộc:
  1. Mỗi `AC-ID` trong DD phải truy được tới ít nhất một dòng nghiệm thu trong `docs/phases.md` (hoặc ghi rõ spec nghiệm thu bổ sung vào `pnpm accept:all`).
  2. File Plan trong `.agent-kit/plans/` ghi `AC-ID` ở bước hiện thực tương ứng.
  3. Tên test (Vitest / Playwright / verify script) hoặc mô tả case trong `verify` trỏ đúng `AC-ID`.

### Tiêu chí chấp nhận (AC) — Gherkin

Viết trong khối ```` ```gherkin ````, **từ khóa tiếng Anh**, nội dung tiếng Việt:

- Một `Feature:` mỗi DD (`<mã DD> — <tên>`); điều kiện chung đưa vào `Background:`.
- Mỗi AC là một `Scenario:` tên `AC-<mã DD>-NN — <tóm tắt> (nguồn: <ID>; nghiệm thu: <spec/script trong docs/phases.md>)`.
- Nhiều bộ dữ liệu cùng một luồng (thường là validate) → `Scenario Outline:` + `Examples:`; một Outline vẫn là **một** `AC-ID`.
- `Given` = trạng thái trước (dữ liệu SQLite, file `.ade/`, vai trò, trạng thái thực thể); `When` = **một** hành động nghiệp vụ; `Then` = kết quả quan sát được; nối thêm bằng `And` / `But`.
- Giá trị cụ thể đặt trong dấu nháy kép (`"@coder"`, `"thr_01"`), không viết "một agent hợp lệ".

Phủ tối thiểu:

- UI: luồng thành công chính; mỗi dòng `E`; mỗi trường hợp bị chặn ở `P`; mỗi trường ở §II ≥ 1 AC (gom các `V` cùng trường bằng `Scenario Outline`).
- API / MCP: mỗi endpoint hoặc MCP tool ≥ 1 AC thành công; mỗi lỗi nghiệp vụ ở §5.2 (`ERR_*`); 401/403 cho truy cập không hợp lệ; mỗi trường ở §3 ≥ 1 AC.
- Đổi trạng thái: mỗi `<Entity>/T-NN` dùng tới ≥ 1 AC, cộng ≥ 1 AC chuyển trạng thái bị cấm.

### Câu hỏi mở

Chưa chốt → ghi marker `[CẦN LÀM RÕ: <câu hỏi cụ thể>]` đúng tại chỗ và liệt kê lại ở mục Tóm tắt / Mục đích. Tối đa **3** marker mỗi DD; còn marker thì chưa được coi là "Đã duyệt". Không dùng `TBD`, `???`.

## § Bản đồ dữ liệu (Data schema)

Dữ liệu viết bằng **bảng hoặc sơ đồ**, không tả bằng đoạn văn. Nguồn chân lý về hình dạng dữ liệu:
- **API / Event / Config schema**: Zod trong `packages/shared` (`packages/shared/src/schemas/*`).
- **Database schema**: SQLite qua Drizzle ORM trong `apps/hub/src/db/schema.ts`.
- DD **trỏ tên** Zod schema và tên bảng Drizzle; chỉ liệt kê từng field khi cần nêu quy tắc validate hoặc biến đổi dữ liệu.
- Vì repo đang ở đầu P0 (chưa có code), mọi API DD ghi chú rõ trạng thái hiện trạng: `BE chưa implement (xây mới ở phase tương ứng)`.

| Chỗ | Dạng bắt buộc |
| --- | --- |
| UI §I Items | Cột "Cột trong DB" = `table.column` (hoặc nguồn `.ade/*.yaml` ghi ở Ghi chú và `table.column` cache tương ứng, hoặc `—`) |
| API §2.2–2.3 Request | Bảng param/body + **TÊN** Zod schema trong `packages/shared` |
| API §5.3 Bản đồ dữ liệu | Bảng `Field` · `Nguồn` (`table.column` / file `.ade/` / tính toán / hằng) · `Biến đổi` · `Ghi chú` cho mọi field không chép thẳng 1 cột cùng tên |
| API §6 Database | Bảng `Model` · `Thao tác` (`R`/`C`/`U`/`D`) · `Field` · `Điều kiện / filter` · `Ghi chú` (mọi thao tác làm đổi trạng thái đều phải có dòng `events` `C` append-only!); invariant, transaction, concurrency ghi dòng riêng |
| `domain-model.md` / `overview.md` | `erDiagram` (mermaid) cho các bảng và quan hệ |

## § State machine (thực thể có trạng thái)

Thực thể có cột trạng thái (`runs.status`, `threads.state`, `approvals.status`, `thread_agents` grant lifecycle, `runners.status`, `memory_proposals.status`, `AcpSession.status`) được mô tả **một lần** theo `specs/templates/state-machine.template.md` trong `specs/dd/domain-model.md` (hoặc `overview.md` của module).

- `stateDiagram-v2` + bảng chuyển `T-NN`: `Từ` · `Sự kiện` · `Guard` · `Sang` · `Actor` · `Side effect` · `API / job`.
- Cặp (trạng thái, sự kiện) không có trong bảng = bị cấm; ghi rõ HTTP status + mã lỗi `ERR_*` trả về khi bị cấm (định nghĩa trong `specs/message.md`).
- DD UI/API đổi trạng thái thì trỏ `<Entity>/T-NN` ở bước server (`S`) hoặc sự kiện (`E`), không mô tả lại bằng lời.

## § Validate §II — Định dạng dòng rule

Mỗi dòng **đúng một** quy tắc kiểm tra, không gộp nhiều rule bằng `;`.

- Trường tùy chọn: dòng đầu là `nullable` (`MSG` = `—`); các rule `integer`, `number`, `min:N`, `max:N`, `in:...`, `regex:...` đặt trên từng dòng riêng.
- Mã message tham chiếu [message.md](./message.md).
- Thu thập rule qua `VALIDATION_CATALOG` trong `packages/shared` (`collectRules("<module>.<action>")`). UI và Hub dùng chung catalog, không hardcode chuỗi báo lỗi rời rạc.

## § Chế độ triển khai & Phân quyền trong MVP (`ADE_MODE=solo`)

MVP chỉ triển khai chế độ **Solo** (hub + web + runner chạy cùng máy dev trên `127.0.0.1`).

| Kênh giao tiếp | Cơ chế xác thực & phân quyền | Khi vi phạm |
| --- | --- | --- |
| Web UI & HTTP `/api/*`, WS `/ws` | Chỉ chấp nhận kết nối local với `Origin` / `Host` thuộc `localhost` hoặc `127.0.0.1`; gán actor mặc định `usr_local` (`role = owner`). Không có màn hình đăng nhập ở `ADE_MODE=solo`. | Request có header `Origin` khác `localhost`/`127.0.0.1` → trả HTTP 403 `ERR_LOCAL_ORIGIN_ONLY`. |
| ADE MCP Server (`POST /mcp`) | Bắt buộc header `Authorization: Bearer <mcp_token>`. Token gắn cứng với `(run_id, thread_id, agent_id)` và chỉ sống trong vòng đời run. | Thiếu/sai token → HTTP 401 `ERR_MCP_TOKEN_INVALID`; token của run đã kết thúc/hết hạn → HTTP 401 `ERR_MCP_TOKEN_EXPIRED`. |
| Quyền đọc Thread trong MCP | Mọi tool đọc (`get_thread`, `read_memory` scope `thread`, `read_scratchpad`, `get_results`, `get_run_log`) kiểm tra `mcp_token.thread_id` và bản ghi `thread_agents` có `revoked_at IS NULL`. | Chưa được mention/grant hoặc khác thread → HTTP 403 `ERR_GRANT_REQUIRED`. |
| Quyền Main Agent trong MCP | Các tool điều phối (`delegate`, `request_approval`, `get_results`, `get_run_log`) yêu cầu `runs.role = 'main'` và `threads.main_agent_id = runs.agent_id`. | Worker hoặc main cũ gọi → HTTP 403 `ERR_MAIN_AGENT_ONLY`. |
| Quyền Tool đặc biệt (`mcp_allow`) | Tool `set_state` không cấp cho agent trong MVP; chỉ thực thi nếu `agents.mcp_allow` chứa `"set_state"`, và vẫn chịu kiểm tra Gate Guard của thread. | Không nằm trong `mcp_allow` → HTTP 403 `ERR_FORBIDDEN_TOOL`. |

## § Xử lý lỗi Web (`apps/web`)

Quy tắc mặc định cho mọi màn hình React SPA (`apps/web`, TanStack Query, ngôn ngữ hiển thị: tiếng Việt). DD màn hình chỉ ghi thêm khi khác mặc định.

| Loại request | HTTP | Hành vi mặc định trên UI |
| --- | --- | --- |
| `GET` (query chính) | 403 | Hiển thị khung lỗi 403 trong layout (giữ nguyên sidebar) |
| `GET` (query chính) | 404 | Hiển thị khung lỗi 404 trong layout |
| `GET` (query chính) | ≥ 500 hoặc đứt kết nối | Retry tự động 1 lần; nếu vẫn lỗi thì hiển thị khung lỗi 500 trong layout kèm nút `Thử lại` |
| `GET` (query chính) | 400 / 422 | Hiển thị toast qua `translateApiError` |
| `POST` / `PUT` / `PATCH` / `DELETE` (mutation) | 422 | Gắn lỗi inline dưới từng trường form từ `details.fieldErrors`; nếu không gắn trường thì hiện toast |
| `POST` / `PUT` / `PATCH` / `DELETE` (mutation) | 400 / 403 / 404 / 409 / ≥ 500 | Hiển thị toast tiếng Việt qua `translateApiError` (tuyệt đối không hiển thị `err.message` thô), không chuyển trang |
| WebSocket `/ws` | Mất kết nối | Hiển thị banner `Đang kết nối lại...` ở đầu khung chat và tự động reconnect theo backoff `1s → 2s → 5s`, sau khi nối lại gọi query đồng bộ event bị lỡ |

## § Hệ thống Design Tokens & Giao diện (`design.md`)

Giao diện `apps/web` tuân thủ hệ thống thiết kế đã khoá tại [design.md](../design.md) (theo chuẩn Hallmark v2 `modes: light+dark`):

| Chế độ | Theme Hallmark | Đặc trưng vật liệu & Ngữ nghĩa màu |
| --- | --- | --- |
| **Light mode** (`:root`, `[data-mode="light"]`) | **Coral** (`modern-minimal`) | Mặt bàn nỉ ấm (`--color-paper`), thẻ giấy Cotton (`--color-paper-2`) có gờ sáng trái và bóng nghiêng phải (`--shadow-card`), nút chính Ink Board, chữ `General Sans` + `Atkinson Hyperlegible Mono`; tín hiệu người duyệt và mention đồng nghiệp màu đất nung `--color-human` (`oklch(49% 0.175 28)`), tín hiệu Bot/Agent màu xanh kỹ thuật `--color-agent` (`oklch(42% 0.145 255)`). |
| **Dark mode** (`[data-mode="dark"]` và `prefers-color-scheme: dark` khi chưa gán `light`) | **Console** (`modern-minimal`) | Nền than chì 3 bậc (`17%` → `21%` → khoang code `13.5%`), vách hairline `1px`, tắt toàn bộ bóng đổ (`--shadow-card: none`), chữ `Host Grotesk` + `Atkinson Hyperlegible Mono`; tín hiệu người duyệt và mention đồng nghiệp màu Amber `--color-human` (`oklch(83% 0.155 78)`), tín hiệu Bot/Agent màu Cool Blue `--color-agent` (`oklch(78% 0.14 248)`). |

Quy tắc bắt buộc khi hiện thực `apps/web` (`cook` & `code-review`):
- Nguồn token duy nhất đặt tại `apps/web/src/styles/tokens.css` + `apps/web/src/styles/base.css`; cấm hardcode mã màu (`#hex`, `rgb()`, `oklch()`) hay `font-family` trực tiếp trong JSX/CSS ngoài `tokens.css`.
- Lựa chọn chế độ giao diện (`light` | `dark` | `system`) lưu tại `localStorage["ade-theme-mode"]` và được áp lên `document.documentElement.dataset.mode` bằng inline script trong `apps/web/index.html` trước first paint để chống nháy sáng/tối (FOUC).
- Cấm dùng chữ nhỏ hơn `12px` (`0.75rem`), cấm dùng nhãn eyebrow in hoa giãn chữ (`uppercase tracking-widest`), cấm dùng vạch màu dọc cạnh thẻ `border-left >= 3px` (dùng viền hairline `1px` bao quanh thẻ kèm dấu vuông `8x8` trên Gate/Clarifier card), cấm dùng `transition: all` và cấm dùng `transition` trên `width` / `height`.

## § Tám quy tắc bất biến của sản phẩm (từ `AGENTS.md` & `docs/spec.md`)

Mọi DD đi ngược một trong 8 quy tắc dưới đây là finding mức **Mâu thuẫn (chặn)**:

1. Token đăng nhập harness không rời máy dev; Hub chỉ lưu tên `credential_profile`.
2. Harness chạy trong hồ sơ ADE cô lập (`CLAUDE_CONFIG_DIR` riêng + `settingSources: []` cho Claude trừ khi bật `"project"`; `CODEX_HOME` riêng cho Codex); không đọc/ghi `~/.claude`, `~/.codex`, `~/.agents` cá nhân để ghi dữ liệu của ADE.
3. Mọi thay đổi trạng thái là event append-only trong bảng `events`; projection dựng lại được 100% từ `events` (cùng cache `.ade/`).
4. Chỉ rule engine đổi `threads.state` trong luồng nghiệp vụ; agent báo kết quả qua `report_outcome`.
5. Không vượt cổng duyệt (`gate: plan | spec | review`) khi chưa có `approval` trạng thái `approved` của đúng `kind` cho lượt cổng hiện tại, dù lệnh đến từ MCP hay rule.
6. Agent chỉ đọc được dữ liệu thread sau khi có grant active (`thread_agents.revoked_at IS NULL`); mọi tool đọc của ADE MCP đều kiểm tra grant.
7. Cấu hình project, agent, skill, workflow, project memory có nguồn sự thật là thư mục `.ade/` trên đĩa; SQLite chỉ là cache.
8. Kiểm thử tự động trên CI chỉ dùng fake harness (`FakeClaudeDriver`, `ade-fake-agent`); script gọi model thật mang tag `@real`.
