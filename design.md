# Design: ade-runner

The locked system. Every Hallmark run and frontend worker reads this first and all screens share it. Change it on purpose; this file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: Slack-style collaborative chat workspace (`Project Rail -> Channel Sidebar -> Channel Chat Box + Resizable Thread Reply Panel`)
- Modes: `light+dark` (`[data-mode="light"]` = **Coral**, `[data-mode="dark"]` = **Console**, default follows OS `prefers-color-scheme` persisted in `localStorage["ade-theme-mode"]`)
- Light Theme (`Coral`): `light/grotesk-sans/warm` · posture: restrained · felt desk ground, cotton stationery cards lit from the left, letterpress controls, coral signal for human gates and human mentions, cobalt ink for bot/agent instruments
- Dark Theme (`Console`): `dark/grotesk-sans/chromatic-amber` · posture: restrained · stepped graphite ground, 1px hairline panels, shadows off, warm amber for a person and cool blue for an instrument

## Tokens
`apps/web/src/styles/tokens.css` is the source of truth. Every component consumes semantic tokens only (never literal hex/rgb/oklch outside `tokens.css`):

```css
:root,
[data-mode="light"] {
  color-scheme: light;
  --space-3xs: 2px; --space-2xs: 4px; --space-xs: 8px; --space-sm: 12px;
  --space-md: 16px; --space-lg: 24px; --space-xl: 40px; --space-2xl: 64px;
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-md: 0.9375rem;
  --text-lg: 1.125rem; --text-xl: 1.35rem; --text-2xl: 1.62rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-micro: 120ms; --dur-short: 200ms; --dur-long: 420ms;
  --rule-hair: 1px;

  /* Light Mode Default: Option 03 — Coral (Felt Desk & Cotton Stock) */
  --color-paper: oklch(94.5% 0.008 62);
  --color-paper-2: oklch(98.8% 0.0045 80);
  --color-paper-3: oklch(91.5% 0.009 56);
  --color-well: oklch(96.4% 0.006 68);
  --color-well-ink: oklch(23% 0.012 38);
  --color-well-muted: oklch(45% 0.013 45);
  --color-ink: oklch(21% 0.012 38);
  --color-ink-2: oklch(30% 0.013 40);
  --color-muted: oklch(45% 0.013 45);
  --color-rule: oklch(86% 0.010 55);
  --color-rule-2: oklch(79% 0.013 55);

  --color-accent: oklch(22% 0.011 40);
  --color-accent-hover: oklch(29% 0.013 40);
  --color-accent-ink: oklch(97% 0.006 70);
  --color-human: oklch(49% 0.175 28);
  --color-human-soft: oklch(91.5% 0.045 30);
  --color-agent: oklch(42% 0.145 255);
  --color-agent-soft: oklch(91.8% 0.038 255);
  --color-ok: oklch(43% 0.12 148);
  --color-ok-soft: oklch(94% 0.025 148);
  --color-bad: oklch(47% 0.17 28);
  --color-bad-soft: oklch(94.5% 0.03 28);
  --color-focus: oklch(54% 0.17 30);
  --color-backdrop: oklch(18% 0.01 40 / 0.52);

  --surface-wash: radial-gradient(85% 110% at 0% 20%, oklch(98.8% 0.0045 80 / 0.65), transparent 62%);
  --font-display: "General Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-display);
  --font-outlier: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
  --radius-card: 8px;
  --radius-ctrl: 8px;
  --radius-chip: 4px;
  --shadow-card: inset 0 1px 0 oklch(100% 0.005 80 / 0.9), 0 0 0 0.5px oklch(32% 0.03 50 / 0.18), 4px 4px 10px -6px oklch(32% 0.03 50 / 0.24);
  --shadow-btn: inset 0 1px 0 oklch(100% 0.005 80 / 0.95), 0 0 0 0.5px oklch(32% 0.03 50 / 0.24), 3px 3px 7px -4px oklch(32% 0.03 50 / 0.25);
  --shadow-btn-primary: 3px 3px 8px -3px oklch(20% 0.01 38 / 0.35);
  --tracking-display: -0.026em;
  --display-weight: 600;
}

/* Dark Mode Override: Option 01 — Console (Graphite Workbench) */
[data-mode="dark"] {
  color-scheme: dark;
  --color-paper: oklch(17% 0.008 250);
  --color-paper-2: oklch(21% 0.009 250);
  --color-paper-3: oklch(24.5% 0.010 250);
  --color-well: oklch(13.5% 0.007 250);
  --color-well-ink: oklch(92% 0.006 250);
  --color-well-muted: oklch(70% 0.01 250);
  --color-ink: oklch(95% 0.005 250);
  --color-ink-2: oklch(83% 0.008 250);
  --color-muted: oklch(71% 0.01 250);
  --color-rule: oklch(31% 0.01 250);
  --color-rule-2: oklch(42% 0.012 250);

  --color-accent: oklch(82% 0.15 80);
  --color-accent-hover: oklch(86% 0.14 80);
  --color-accent-ink: oklch(18% 0.04 75);
  --color-human: oklch(83% 0.155 78);
  --color-human-soft: oklch(28.5% 0.062 78);
  --color-agent: oklch(78% 0.14 248);
  --color-agent-soft: oklch(28% 0.068 248);
  --color-ok: oklch(76% 0.15 150);
  --color-ok-soft: oklch(24.5% 0.03 150);
  --color-bad: oklch(70% 0.17 25);
  --color-bad-soft: oklch(24.5% 0.035 25);
  --color-focus: oklch(82% 0.15 80);
  --color-backdrop: oklch(8% 0.005 250 / 0.68);

  --surface-wash: none;
  --font-display: "Host Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-display);
  --font-outlier: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
  --radius-card: 10px;
  --radius-ctrl: 6px;
  --radius-chip: 4px;
  --shadow-card: none;
  --shadow-btn: none;
  --shadow-btn-primary: none;
  --tracking-display: -0.025em;
  --display-weight: 500;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-mode="light"]) {
    color-scheme: dark;
    --color-paper: oklch(17% 0.008 250);
    --color-paper-2: oklch(21% 0.009 250);
    --color-paper-3: oklch(24.5% 0.010 250);
    --color-well: oklch(13.5% 0.007 250);
    --color-well-ink: oklch(92% 0.006 250);
    --color-well-muted: oklch(70% 0.01 250);
    --color-ink: oklch(95% 0.005 250);
    --color-ink-2: oklch(83% 0.008 250);
    --color-muted: oklch(71% 0.01 250);
    --color-rule: oklch(31% 0.01 250);
    --color-rule-2: oklch(42% 0.012 250);
    --color-accent: oklch(82% 0.15 80);
    --color-accent-hover: oklch(86% 0.14 80);
    --color-accent-ink: oklch(18% 0.04 75);
    --color-human: oklch(83% 0.155 78);
    --color-human-soft: oklch(28.5% 0.062 78);
    --color-agent: oklch(78% 0.14 248);
    --color-agent-soft: oklch(28% 0.068 248);
    --color-ok: oklch(76% 0.15 150);
    --color-ok-soft: oklch(24.5% 0.03 150);
    --color-bad: oklch(70% 0.17 25);
    --color-bad-soft: oklch(24.5% 0.035 25);
    --color-focus: oklch(82% 0.15 80);
    --color-backdrop: oklch(8% 0.005 250 / 0.68);
    --surface-wash: none;
    --font-display: "Host Grotesk", ui-sans-serif, system-ui, sans-serif;
    --font-body: var(--font-display);
    --font-outlier: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
    --radius-card: 10px;
    --radius-ctrl: 6px;
    --radius-chip: 4px;
    --shadow-card: none;
    --shadow-btn: none;
    --shadow-btn-primary: none;
    --tracking-display: -0.025em;
    --display-weight: 500;
  }
}
```

## Workspace Layout & Interaction Architecture (Locked via Prototype)
- **Slack-style 3+1 Column Shell**:
  1. **Project Rail (`64px`)**: Vertical icon rail on the far left showing 2-letter project initials buttons, `+` icon button (opens `Create Project Wizard` modal), theme toggle icon button, and `⚙` gear icon button (`aria-label="Cài đặt dự án"`, opens `Project Settings` modal).
  2. **Channel & Team Sidebar (`224px` Desktop / `200px` Tablet)**: Project title header, Channels section (`# <name>` items **with no count/workflow badge next to channel names** + `+` icon button to open `Create Channel` modal), Colleagues (`Human`) section with presence dots, and `Bot / Agent` roster (`.ade/agents/`) with idle/running dots.
  3. **Channel Chat Box (`1fr`)**:
     - **2-line Channel Header**: Left column stacks Line 1 `# <channels.name>` (`font-weight: 600`) and Line 2 `<channels.description>` (muted secondary line); right side holds the Channel Members pill (stacked avatars + total member count) and the icon-only Channel Settings gear button (`⚙`, `aria-label="Cài đặt kênh"`).
     - **1 Root Message = 1 Thread**: There is no separate Thread List column and no "Create Thread" modal. Posting a message in the Channel Composer creates a new `Thread` + its root `Message` immediately in the channel feed (used both for human-to-human discussion and `@agent` task dispatch). Clicking `Trả lời` or the inline reply summary bar beneath a root message opens the `Thread Reply Panel` on the right.
     - **Clean Message Rows & Hover Popover Toolbar (`.ade-msg-toolbar`)**: Message rows render **no fixed emoji or reply buttons in the top-right corner**. Hovering or focusing a message reveals `.ade-msg-toolbar` floating at the top-right with 4 quick emojis (`👍`, `❤️`, `🔥`, `🚀`), an emoji-picker button, and `Trả lời`.
     - **Emoji Reactions**: Displayed below message text as compact emoji + count pills (`👍`, `❤️`, `🔥`, `🚀`, `🎉`, `👀`, `✅`, `🙌`) with `.is-mine` highlight; never text-label reaction badges.
  4. **Resizable Thread Reply Panel (`340px` – `780px`, default `448px`)**:
     - **Width Resizer**: Left-edge vertical drag handle (`role="separator"`, `aria-orientation="vertical"`, keyboard `ArrowLeft`/`ArrowRight` step `24px`, persisted in `localStorage["ade-thread-panel-w"]`) plus a quick Expand/Collapse width icon button (`448px` ↔ `640px`) in the Topbar.
     - **2-Tier Reply Box Header**:
       - *Tier 1 (Topbar — shown on all Threads)*: Left shows `Thread` title, `#channel` label, and reply count; right shows Shield `Quyền (N)` button (when grants exist or in Work Thread), Expand/Collapse width icon button, and Close `×` icon button.
       - *Tier 2 (Subbar — shown only on Work Threads with `main_agent_id` or active/past runs; hidden on human-only threads)*: Left shows unified Segmented Switch (`Phản hồi` | `Sổ nháp`); right shows Main Agent `.ade-mention--agent` chip, `threads.state` badge, and budget readout.
- **Resizable Composers (`Channel Composer` & `Thread Reply Composer`)**: Top-edge horizontal drag handle (`48px` – `260px`), auto-expand on multiline input, and quick height toggle icon button (`⇕`).
- **Responsive Breakpoints**:
  - **Desktop (`>= 1025px`)**: Inline 3-column grid (`64px 224px 1fr`), expanding to 4 columns (`64px 224px 1fr var(--thread-panel-w, 448px)`) when a thread is open.
  - **Tablet (`768px – 1024px`)**: `64px 200px 1fr` main workspace; `Thread Reply Panel` renders as a right-hand slide-over overlay (`position: fixed`, `width: min(448px, 88vw)`) over `--color-backdrop`.
  - **Mobile (`< 768px`)**: Full-width `Channel Chat Box` with a Hamburger icon button in the Channel Header opening an off-canvas Left Drawer (`Project Rail + Channel Sidebar`); opening a thread renders `Thread Reply Panel` as a `100vw` fullscreen sheet.
- **Modal Architecture for Settings & Creation**:
  - `Create Channel`, `Channel Settings` (2 tabs: `Thông tin chung` + `Thành viên`, **no channel default workflow field**), `Create Project Wizard` (`/projects/new`), and `Project Settings` (`/projects/:projectId/settings?tab=...`, 6 tabs) all render inside structured modals (`ade-modal-shell`) over the Chat Workspace backdrop.
  - Every Modal, Drawer, and Popover uses an icon-only `×` close button (`ade-icon-btn`, `aria-label="Đóng"`) in its top-right header — never duplicate text `"Hủy"` in the header.

## Controls & Semantic Discipline
- **Semantic split (Human vs Bot/Agent)**:
  - **Human Mention (`.ade-mention--human`)**: Rounded pill (`border-radius: 999px`), `--color-human` ink + border on `--color-human-soft` ground, `--font-display` (`font-weight: 600`), leading `12x12` `user` SVG icon; mentioning the current user adds `.ade-mention--me` ring. `--color-human` / `--color-human-soft` also marks human approval gates (`plan` / `spec` / `review`) and `ask_human` / `Clarifier` cards.
  - **Bot/Agent Mention (`.ade-mention--agent`)**: Technical chip (`border-radius: var(--radius-chip)` = `4px`), `--color-agent` ink + border on `--color-agent-soft` ground, `--font-outlier` monospace (`font-weight: 600`), leading `12x12` `bot` SVG icon; agent message author headers carry a `BOT` badge. `--color-agent` / `--color-agent-soft` also marks `LiveCard`, `ExplorerCard`, Worker Sub-cards, and MCP/ACP readouts.
  - **`@mention` Autocomplete Popup**: Divided into two distinct sections: `Đồng nghiệp` (Human project members) and `Bot / Agent` (`.ade/agents/`).
- **Explorer Insight Card (`.ade-explorer-card`, `messages.kind = 'explorer_card'`)**:
  - Rendered inside the Thread Reply Panel when a read-only agent such as `@explorer` (`write: false`) posts structured codebase explanations via `post_message(kind: 'explorer_card')`.
  - Uses a `1px` `--color-agent` hairline border all-round (never `border-left: 3px+` side stripes), read-only chip (`Chỉ đọc · 0 file sửa`), `--font-outlier` `tabular-nums` cost & duration readout, collapsible `Trace (N)` log well, numbered flow steps (`.ade-flow-step` + `.ade-flow-num`), expandable `file:start_line-end_line` citation accordions (`.ade-code-ref` + `.ade-code-snippet` with `tabular-nums` line numbers and `Chép vị trí`), `Hỏi sâu thêm @explorer`, and `Nhờ @planner lập phương án từ kết quả này` handoff button; the root message's thread summary bar in the channel feed displays a `Chỉ đọc · {N} file` chip.
- **Clarifier / Multi-Question `ask_human` Card (`.ade-clarify-card` / `.ade-gate-card`, `messages.kind = 'question_card'`)**:
  - Rendered inside the Thread Reply Panel when `@planner`, `@spec`, `@lead`, or a workflow rule calls `ask_human`.
  - Uses a `1px` `--color-human` hairline border all-round + `8x8` `--color-human` square mark (`.ade-gate-mark`), live progress chip `Đã trả lời X/N` (`--color-human` while incomplete, `--color-ok` when `X === N`), and supports both single-question `ask_human` and multi-question interview arrays (`questions[]`) with three block types inside `.ade-q-block`:
    1. `single` (`Chọn 1 đáp án` — radio option cards `.ade-choice-option` with optional `hint` and `Khác` inline custom text input when `allow_other` is selected),
    2. `multi` (`Chọn nhiều đáp án` — checkbox option cards `.ade-choice-option` + `Khác` inline custom text input),
    3. `text` (`Điền câu trả lời` — `textarea` accompanied by 1-tap quick suggestion chips `+ <suggestion>`).
  - Once answered (`status = 'answered'`), collapses to a read-only `.ade-well` summary listing each finalized answer; while `pending`, the root message's thread summary bar in the channel feed displays `{pendingCount} chờ trả lời`.
- **Primary button & Icon button**: Primary button uses `--color-accent` fill with `--color-accent-ink` text, `--radius-ctrl`, `36px` min-height, 8 states (`default`, `hover`, `:focus-visible`, `:active`, `disabled` with fill+ink+cursor, `loading`, `error`, `success`). Settings (`⚙`), Close (`×`), Width/Height toggle buttons use compact icon-only `.ade-icon-btn` (`32px x 32px`, `44px` touch target on mobile) with mandatory `aria-label`.
- **Floor invariants**: No literal hex/rgb/oklch outside `tokens.css`; no `transition: all` and no `transition` on `width`/`height` (animate `transform`/`opacity`/`background-color`/`border-color` only); no tracked-capital eyebrows; no sub-12px text; no `border-left: 3px+` side stripes on cards (use 1px `--color-human` hairline all-round + 8x8 square mark on Gate cards); `tabular-nums slashed-zero` via `--font-outlier` on every metric, cost, duration, version and ID.

## Motion
- Character: `brisk` (`--dur-micro: 120ms`, `--dur-short: 200ms` on `--ease-out`); state-driven only (`background-color`, `border-color`, `transform`, `opacity`); instant under `prefers-reduced-motion: reduce`.

## Exports
- `apps/web/src/styles/tokens.css` and `apps/web/src/styles/base.css` initialized in Phase P0 and shared across Phases P0 -> P6.
