# Design References for Typing-Race

> User-curated references for UI direction. Inspect at the right phase (Phase 5: Frontend Polish).
> Do NOT apply directly to Phase 1-4 plans — those are infra/data correctness phases.

## Primary Reference: Renkit

**Repo:** https://github.com/nacs-970/renkit
**Why it matters:** Tactile, minimalist, keyboard-driven React 19 app. User already ships this style.
**Visual language:**
- Light/dark mode toggled via `[data-theme]` on `<html>`
- Single accent color overridable via CSS custom property (default `#AFE876` lime-green)
- Three "styles" for the same component: Classic (serif Times), Modern (sans), Mono (monospace)
- CSS custom properties as the only theming primitive — no Tailwind, no styled-components, no CSS-in-JS
- `--t-scale` per-component custom property lets the same component scale visually
- Mailbox-slot archive + print-out receipt animation as the signature interaction
- "Color picker accent" feature: user changes accent live via input → JS sets `--accent` + computed `--accent-bg` at 15% alpha

**Patterns to adopt for typing-race:**
- Theme via `data-theme` attribute (light/dark) — togglable from settings
- `--accent` CSS var on `:root` for the brand accent (use Anthropic coral #cc785c OR user-chosen accent)
- `--accent-bg` computed at 15% alpha for hover/glow states
- Per-component `--t-scale` for visual scaling
- Single React app with TypeScript, Vite, CSS Modules — same stack as typing-race
- Keyboard-first: typing race already gets this for free (it's the game)

**Key code patterns (from Renkit):**
```css
/* index.css */
:root {
  --text: #6b6375;
  --text-h: #121212;
  --bg: #fff;
  --border: #e5e4e7;
  --code-bg: #f4f3ec;
  --accent: #AFE876;
  --accent-bg: rgba(175, 232, 118, 0.15);
  --accent-border: rgba(175, 232, 118, 0.5);
  --shadow: rgba(0, 0, 0, 0.1) 0 10px 15px -3px;
  --sans: system-ui, 'Segoe UI', Roboto, sans-serif;
  --heading: system-ui, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, Consolas, monospace;
}
[data-theme='dark'] { /* dark overrides */ }
```
```ts
// Settings.tsx
const handleAccentChange = (color: string) => {
  document.documentElement.style.setProperty('--accent', color);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-bg', `rgba(${r}, ${g}, ${b}, 0.15)`);
};
```

## Secondary Reference: Gallery

**Repo:** https://github.com/nacs-970/gallery
**Why it matters:** Minimal Vite + React + TS scaffold. Confirms the stack baseline.

## Tertiary Reference: Claude.com Brand Spec

**File:** `.planning/design/claude-brand-reference.md`
**Why it matters:** If user picks "Anthropic-style" aesthetic (cream + coral + dark navy, slab serif display, literary editorial voice). Heavy contrast with Renkit's lime accent — pick ONE direction.

## Direction Decision (Phase 5 will ask)

User wants a demo-friendly visual. Three options to surface when Phase 5 starts:
1. **Renkit-style** (minimalist + tactile, light/dark, accent picker) — closer to user-experience preference
2. **Claude-style** (cream + coral + navy, serif display, editorial) — closer to "AI tool" feel
3. **Hybrid** (cream canvas + coral accent + tactile ticket-style race components) — try to merge

**Default to Renkit-style unless user says otherwise** — user's own code already uses this, lower risk of design regret.

---
*Saved 2026-08-30 from user-provided GitHub URLs.*