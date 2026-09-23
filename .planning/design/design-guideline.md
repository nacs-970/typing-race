# Typing Race design guideline

This is the design system for the web client (`apps/web`).
It describes the look that the typewriter / editorial redesign set up on the branch `feat/typewriter-redesign`.
Follow it for every new screen, component or change.

- The approved visual demo is at https://claude.ai/artifact/H9DyYcz2oVjze4B8fKwEEn (private).
- The mood references are in `ui/*.jpg`.
- Open UX work is in `ux-todo.md`, next to this file.

---

## 1. Direction

**Typewriter, editorial, minimal. Not premium.**

The interface should read like a typed page or a small printed poster, not like a SaaS dashboard.

| Do | Don't |
|---|---|
| Paper background, dark ink | Cards with a border, a shadow and rounded corners |
| Hairline rules that separate sections | Boxes around every group |
| One big serif word per screen | Several competing headings |
| Small mono metadata labels | Emoji icons, pill badges |
| Plain words and marks: `No. 1`, `[ mid ]`, `—`, `×` | 🥇 ⚙️ 🚪 ⚠️ ✓ |
| Square corners | `rounded-lg` / `rounded-xl` / `rounded-full` |
| Flat surfaces | Gradients, glows, blur, drop shadows |

When you are unsure, remove something instead of adding something.

---

## 2. Color

Define colors ONLY as tokens in `apps/web/src/styles.css` (`@theme`). In components, use them through Tailwind arbitrary values such as `text-[var(--color-text-bright)]` and `border-[var(--color-border-muted)]`.

**Never hardcode hex in components.** The settings panel overrides the base tokens at runtime (`store/settings.ts → applySettingsToDom`). The Dark, High Contrast and Ocean presets recolor the app only if every color derives from these tokens.

### Base tokens (the settings panel can override these)

| Token | Default | Use |
|---|---|---|
| `--color-bg-base` / `-surface` / `-surface-elevated` | `#fefbe6` | Paper. Cream off-white, not grey |
| `--color-text-bright` | `#1d2114` | Ink: body text, rules, outline buttons |
| `--color-accent-green` | `#5f6f36` | Olive ink: primary buttons, active states, "Winner" |
| `--color-cursor-own` | `#80924a` | Your caret, and your own chip in the lobby |
| `--color-char-correct` | `#1d2114` | Typed-correct characters |
| `--color-status-danger` | `#b3261e` | Errors, "Leave", finish-blocked |

### Derived tokens (never set these directly)

Derived tokens are built with `color-mix()` from the base tokens: `--color-text-muted` (75%), `--color-text-faint` (55%), `--color-border-muted` (20% ink), `--color-border-subtle`, `--color-bg-surface-hover`, `--color-danger-*`.

- Muted text (labels, helper text, inactive options) uses `--color-text-muted`, or the `.label` color (70% ink).
- Hairline rules use `--color-border-muted`. Strong rules (the top of a table, a section start) use `--color-text-bright`.

### Player colors

- `--color-cursor-slot-1` … `-8` are pastel cursor colors.
- A player's slot is their **lobby join index**. Get the color with `cursorSlotColor(slot)` from `core/cursor-manager.ts`, so every viewer sees the same color for the same player.
- Text on a player color uses `--color-on-cursor` (fixed dark ink). The pastels stay light in every theme.

### Rules

- Use one accent (olive). Do not add a second accent color.
- Red is only for errors and destructive actions.
- Text contrast is ≥ 4.5:1 (≥ 3:1 at 24px and above). Faint text is for decoration, never for information you need to read.

---

## 3. Typography

Two families, loaded from Google Fonts in `apps/web/index.html`:

| Role | Family | Token / class |
|---|---|---|
| UI, labels, body, **passage** | Courier Prime (400, 700, 400 italic) | `--font-mono`, `font-mono` (the default on `:root`) |
| Display (one element per screen) | Instrument Serif (400, italic) | `--font-serif`, `.font-serif-display` |

### Scale in use

| Element | Size | Notes |
|---|---|---|
| Landing title "Typing *Race.*" | `clamp(2.75rem, 13vw, 96px)` | The second word is italic and olive |
| Lobby room code | `clamp(3.5rem, 10vw, 88px)` | Tracking `0.04em`. Click to copy |
| Results heading | ~88px | Serif |
| Countdown numeral | 96px | `.countdown-num`, `line-height: 1` |
| Race WPM | 52px serif | Paired with a `wpm` label |
| Rank | ~30px serif | |
| Body / buttons | 16px mono | Buttons: bold, tracking `0.04em` |
| Helper text | 14–15px mono italic | Muted |
| Labels | 11px mono caps | `.label` |

### Rules

- **The passage must stay monospace.** `core/layout.ts` measures character widths with the font string `"Courier Prime", ui-monospace, monospace` (also in `RaceView.tsx`). If you change the passage font, change that string too, or the caret drifts away from the characters.
- Use serif for ONE display element per screen. Everything else is mono.
- Use `.label` for metadata, never for sentences: `Room · Host`, `Competitors (3)`, `Track`, `wpm`, `Passage · Mid`.
- Use sentence case for copy (`Copy room link`, `Leave room`). Title Case stays only where a test pins the exact string (see §9).
- Numbers in tables use `tabular-nums`.

---

## 4. Layout and spacing

- **One fixed column.** `main` has `max-width: 860px`, `margin-inline: auto` and `padding: 2rem`. `#root` is `width: 100%`. Without that width, `#root` shrinks to its content and a view's width follows its longest line. Do not reintroduce content-driven widths.
- Content starts at the top (`body` `padding-top: 4rem`), not centered vertically.
- Separate sections with **rules, not boxes**:
  - a strong rule (1px ink) where a section starts, e.g. `Competitors`, the table head, the host controls
  - hairline rules (1px `--color-border-muted`/`-subtle`) between rows
- Settings rows use `flex justify-between`, with a `.label` on the left and the control on the right, `py-3`.
- Typical gaps: 22px in form stacks, 28px (`mt-7`) between sections, 36–56px around the display element.
- Corner crop marks (`+`, faint, `aria-hidden`, `pointer-events-none`) appear **on the landing only**.
- Everything must work at 375px width, with no horizontal scroll. Use `clamp()` for display sizes, and `flex-1 max-w-[…]` instead of fixed widths inside rows.

---

## 5. Components

### Buttons

| Kind | Look | Example |
|---|---|---|
| Primary | Solid `--color-accent-green`, paper-colored text, bold mono, square, `py-3.5` | Create Room, Start Race, Ready Up, Play Again |
| Secondary | Transparent, 1px ink border, ink text, square | Join Room, Force Start Race, Return to Lobby, Cancel Ready |
| Text link | No border, underline, `underline-offset-4`, 14px | Copy room link |
| Destructive | A text link in `--color-status-danger` | Leave room, Leave |

- A disabled button gets a visible disabled style and `cursor-not-allowed`.
- Press feedback is global (`button:active { translateY(1px) }`). Do not add scale effects.

### Choices (segmented options)

- Use `<button class="choice" aria-pressed={active}>` (see `LobbyView.tsx`).
- The active option shows `[ … ]` brackets from CSS `::before`/`::after`, and the button text stays plain (`"mid"`). The brackets always reserve their width, so toggling never shifts the row.
- **Always** set `aria-pressed`.

### Inputs

- Bottom rule only: `border-0 border-b border-[var(--color-text-bright)] bg-transparent`, mono 18px.
- Put a `.label` `<label htmlFor>` above the input.
- Codes use `uppercase`, wide tracking and centered text.

### Lists and tables

- Competitor rows: a number chip in the player's color (`01`, `02`), the name, an italic `(you)` / `host` mark, a dotted leader, and the status (`Ready` in olive, italic `Waiting…`).
- Results: rank as serif `No. N` with `aria-label="Nth Place"`, and right-aligned numeric columns. Your row gets `font-bold`, a faint olive tint and a 2px olive inset left edge.

### Feedback

| Surface | Look |
|---|---|
| Toast | A paper panel with a 1px hairline border, a **2px left edge** in the type color, and a mono tag `ERR` / `NOTE` / `OK` / `INFO`. Dismiss with `×` (`aria-label="Dismiss notification"`) |
| Banner (grace, reconnect) | A flat ruled strip: 1px ink top, hairline bottom, a 1px track with a 2px ink fill. Text starts with `— ` |
| Inline notice | The same ruled style. It is dismissible when it lasts longer than a few seconds |
| Copy success | The copied element fades to a lighter olive while a `.label` says `Code copied` (`aria-live="polite"`) |
| Errors in text | Red characters with a 1px underline. No background tint |

### Caret

- Your caret is a square 2px bar in `--color-cursor-own` that blinks (`@keyframes caret`, 1.1s `steps(1)`).
- Opponent carets are 2px bars in their slot color, with a square uppercase name tag. No glow on either.

---

## 6. Motion

- Motion is small and functional: color changes (`transition-colors`, ~300ms), the caret blink, the countdown fade, and progress fills.
- Animate `opacity`, `transform` and colors only. Don't animate layout properties.
- No glows, pulses (`animate-pulse`), zooms or bounces.
- Respect `prefers-reduced-motion`: the caret blink and the countdown animation turn off (see the media query in `styles.css`). Every new animation must be added there.

---

## 7. Copy and voice

- Plain, short and specific: "Finish blocked. Backspace to fix errors first."
- No exclamation marks: "Race started", not "Race Started!"
- Use no emoji, and no "Oops".
- Use an em dash `—` to start a notice line.
- Error text says what happened and what to do next.

---

## 8. Accessibility

- Use real elements: `<button>`, `<label htmlFor>`, `<input>`. Never put `onClick` on a `<div>` or `<span>`.
- Focus is visible everywhere: a global `:focus-visible` gives a 2px olive outline, offset 2px. Do not remove it with `outline-none` on buttons.
- Icon-only or symbol-only controls need an `aria-label` (`×`, `Aa`, the room code button).
- Toggles use `aria-pressed`. Live updates use `role="status"` / `aria-live="polite"`.
- Decoration (crop marks, the caret, brackets) is `aria-hidden`, or it is CSS content with empty alt text (`content: "[ " / ""`).
- Touch targets are ≥ 44px where possible (the settings "Aa" is 44×44).

---

## 9. Implementation rules

### CSS layers (read this before you write CSS)

Tailwind utilities live in `@layer utilities`. **Plain (unlayered) rules in `styles.css` always beat utilities, whatever their specificity.** This rule already caused four bugs:
- a global `h1` rule capped the landing title at 3rem
- `.passage-track { margin: 0 auto }` cancelled `mt-12`
- `.label` blocked color utilities
- `th, td { text-align: left }` blocked right-aligned columns

Because of this:
- Put shared utility classes (`.label`, `.rule`, `.font-serif-display`) in `@layer components`.
- Global element rules (`h1`, `main`, `body`) set font and color only. They never set size, margin or tracking.
- A legacy class that is only a hook (`.lobby-view`, `.results-board`, `.race-view`) keeps its selector but gets no box styles.
- Before you add an unlayered rule, check that no component sets the same property with a utility.

### Tokens and theming

- New colors are new tokens in `@theme`, derived from the base tokens with `color-mix()` wherever possible.
- To change the default look, update `DEFAULT_SETTINGS` and the "Olive" preset in `store/settings.ts` too, so that "Reset" matches.

### Tests that pin UI

Some strings, classes and test ids are asserted in `apps/web/src/__tests__/`. If you change one, update the test in the same commit, and never weaken an assertion:
- Strings: "Waiting for Competitors", "Ready Up", "Cancel Ready", "Start Race", "Force Start Race", "Waiting…", "Ready", "Passage", "Random words", "Winner", "Fastest", "(You)", "Awaiting Race Finishers", `Play Again ({Type} - {Length})`, `Reconnecting... ({n}s)`, "GO!", the rank badge `#N`, and the tooltip labels "Net WPM:", "Raw WPM:", "Accuracy:" and "Errors:".
- Classes and ids: `.char`, `.char-pending` / `-correct` / `-error`, `.cursor-overlay`, `.local-cursor`, `.opponent-cursor`, `font-bold` on your results row, and every `data-testid`.

### Checklist for a UI change

1. Colors come from tokens; there is no hex in components.
2. Corners are square, with no shadow, glow, gradient or blur.
3. It works at 375px and in the Dark / High Contrast / Ocean presets.
4. Focus is visible, controls have labels, and toggles use `aria-pressed`.
5. Any new animation is added to the `prefers-reduced-motion` block.
6. There are no unlayered CSS rules that fight utilities.
7. `bunx vitest run` and `bunx tsc --noEmit` pass in `apps/web`.
