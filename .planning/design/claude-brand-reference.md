# Claude.com Brand Reference

> Saved 2026-08-30 from user paste. Reference for typing-race UI design later.
> Source: user-provided (not authored here). Used as design language inspiration.

## Overview

Claude.com is the warmest, most editorial interface in the AI-product category. The base atmosphere is a **tinted cream canvas** (`{colors.canvas}` — #faf9f5) — distinctly warm, deliberately not the cool gray-white that every other AI brand uses. Headlines run a **slab-serif display** ("Copernicus" / Tiempos Headline) at weight 400 with negative letter-spacing, paired with **StyreneB / Inter** body sans. The combination feels like a literary publication, not a SaaS marketing page.

Brand voltage comes from the **cream + coral pairing** — coral (`{colors.primary}` — #cc785c) is the signature Anthropic accent, used on every primary CTA, on the brand wordmark, and on full-bleed callout cards. The coral is warm, slightly muted, never cyan/blue — a deliberate counter-positioning against OpenAI's cool slate, Google's saturated blue, and Microsoft's corporate cyan.

The system has three surface modes that alternate page-by-page:
1. **Cream canvas** (`{colors.canvas}`) — default body floor
2. **Light cream cards** (`{colors.surface-card}`) — feature card backgrounds
3. **Dark navy product surfaces** (`{colors.surface-dark}`) — code editor mockups, model showcase cards, pre-footer CTAs, footer itself

The dark surfaces are where Claude shows its product chrome — code blocks, terminal output, model comparison tables, agentic-flow diagrams. The cream-to-dark contrast is the page's pacing rhythm.

## Colors

### Brand & Accent
- Coral / Primary — `#cc785c` (signature Anthropic warm coral)
- Coral Active — `#a9583e` (press/hover-darker variant)
- Coral Disabled — `#e6dfd8` (desaturated cream-tinted disabled)
- Accent Teal — `#5db8a6` (sparing, secondary surfaces, status indicators)
- Accent Amber — `#e8a55a` (category badges, inline highlights)

### Surface
- Canvas — `#faf9f5` (default page floor, tinted cream)
- Surface Soft — `#f5f0e8` (section dividers, very-soft band backgrounds)
- Surface Card — `#efe9de` (feature cards, content cards)
- Surface Cream Strong — `#e8e0d2` (selected category tabs, emphasized section bands)
- Surface Dark — `#181715` (code editor mockups, model cards, footer)
- Surface Dark Elevated — `#252320` (elevated cards inside dark bands)
- Surface Dark Soft — `#1f1e1b` (code block backgrounds inside larger dark cards)
- Hairline — `#e6dfd8` (1px border on cream)
- Hairline Soft — `#ebe6df` (barely-visible divider)

### Text
- Ink — `#141413` (headlines, primary text — warm dark, off-pure-black)
- Body Strong — `#252523` (emphasized paragraphs, lead text)
- Body — `#3d3d3a` (default running text)
- Muted — `#6c6a64` (sub-headings, breadcrumbs, footer-adjacent)
- Muted Soft — `#8e8b82` (captions, fine-print, copyright)
- On Primary — `#ffffff` (text on coral buttons)
- On Dark — `#faf9f5` (cream-tinted white on dark surfaces)
- On Dark Soft — `#a09d96` (footer body, secondary labels)

### Semantic
- Success — `#5db872`
- Warning — `#d4a017`
- Error — `#c64545`

## Typography

- Display: Copernicus (or Tiempos Headline) — slab-serif, weight 400, negative tracking
- Body: StyreneB (or Inter) — humanist sans
- Code: JetBrains Mono

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| display-xl | 64px | 400 | 1.05 | -1.5px | Homepage h1 |
| display-lg | 48px | 400 | 1.1 | -1px | Section heads |
| display-md | 36px | 400 | 1.15 | -0.5px | Sub-section heads, model names |
| display-sm | 28px | 400 | 1.2 | -0.3px | Pricing tier names, callout headlines |
| title-lg | 22px | 500 | 1.3 | 0 | Pricing plan size labels |
| title-md | 18px | 500 | 1.4 | 0 | Feature card titles |
| title-sm | 16px | 500 | 1.4 | 0 | Connector tile titles |
| body-md | 16px | 400 | 1.55 | 0 | Default running-text |
| body-sm | 14px | 400 | 1.55 | 0 | Footer body, fine-print |
| caption | 13px | 500 | 1.4 | 0 | Badge labels |
| caption-uppercase | 12px | 500 | 1.4 | 1.5px | "NEW" badges |
| code | 14px | 400 | 1.6 | 0 | Code blocks |
| button | 14px | 500 | 1.0 | 0 | Button labels |
| nav-link | 14px | 500 | 1.4 | 0 | Top-nav menu items |

### Substitutes
- If Copernicus unavailable → Cormorant Garamond at weight 500 with -0.02em
- If StyreneB unavailable → Inter (closest), Söhne (alternative)

## Layout

- Base unit: 4px
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 96px
- Section padding: 96px
- Card internal padding: 32px (feature/pricing), 24px (code-window/connector)
- Callout/CTA bands: 48px inside coral, 64px inside dark
- Max content width: ~1200px centered
- Grid: 12-col, hero 6/6, feature cards 3-up/2-up/1-up

## Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Body sections, top nav, hero bands |
| Soft hairline | 1px hairline border | Inputs, sub-nav |
| Cream card | Surface-card background, no shadow | Feature cards |
| Dark surface card | Surface-dark background, no shadow | Code editor mockups |
| Subtle drop shadow | `0 1px 3px rgba(20,20,19,0.08)` | Hover-elevated states (rare) |

Philosophy: **color-block first, shadow rare**. Most depth comes from cream-vs-dark contrast.

## Shapes

| Token | Value | Use |
|---|---|---|
| rounded.xs | 4px | Tiny dropdowns |
| rounded.sm | 6px | Inline buttons, dropdown items |
| rounded.md | 8px | Standard CTA buttons, inputs, tabs |
| rounded.lg | 12px | Content cards |
| rounded.xl | 16px | Hero illustration container |
| rounded.pill | 9999px | Badge pills |
| rounded.full | 9999px | Avatars, icon buttons |

## Components

### Buttons
- `button-primary` — coral fill, white text, 8px radius, 40px height, 12px×20px padding
- `button-secondary` — cream fill, hairline border, ink text
- `button-secondary-on-dark` — surface-dark-elevated fill, on-dark text
- `button-text-link` — inline, no background, used for "Sign in"
- `button-icon-circular` — 36px circle, canvas fill, hairline border

### Cards
- `hero-band` — cream, 6/6 grid, 96px padding
- `hero-illustration-card` — large card holding right-side artifact
- `feature-card` — surface-card, 12px radius, 32px padding, icon+title+body
- `product-mockup-card-dark` — surface-dark, 12px radius, 32px padding, product chrome
- `code-window-card` — surface-dark with inner surface-dark-soft, line numbers, syntax-highlighted code, optional Run button
- `model-comparison-card` — canvas with hairline, model name + blurb + text-link
- `pricing-tier-card` — canvas with hairline, plan name + price + checklist + CTA
- `pricing-tier-card-featured` — flips to surface-dark, on-dark text
- `callout-card-coral` — full-bleed coral, 12px radius, 48px padding, cream inverted button
- `connector-tile` — canvas with hairline, 20px padding, logo + name + description

### Inputs
- `text-input` — canvas, hairline border, ink text, 8px radius, 40px height
- `text-input-focused` — coral border, 3px coral-15%-alpha outer ring

### Tags/Badges
- `badge-pill` — surface-card, ink text, caption, 4px×12px
- `badge-coral` — coral fill, white text, caption-uppercase, "NEW"/"BETA"

### Tabs
- `category-tab` / `category-tab-active` — transparent/muted vs surface-card/ink, 8px×14px padding, 8px radius

### CTA/Footer
- `cta-band-coral` — full-width coral, 64px padding, cream inverted button
- `cta-band-dark` — surface-dark, 64px padding, often paired with code-window
- `footer` — surface-dark, 4-col link list, 64px padding, spike-mark + wordmark at top

## Do's

- Anchor every page on cream canvas
- Use Copernicus serif for display, StyreneB sans for body
- Reserve coral for primary CTAs + full-bleed callout cards
- Show real product chrome (code blocks) over marketing illustrations
- Pair cream feature cards with dark mockup cards in alternating bands
- Use spike-mark glyph as wordmark prefix
- Apply 96px between major bands

## Don'ts

- Don't use cool grays or pure white
- Don't bold serif display weight
- Don't use cool blue / cyan as accent
- Don't put coral everywhere
- Don't use Inter for display headlines
- Don't repeat the same surface mode in two consecutive bands
- Don't add hover state styling beyond what system encodes

## Responsive

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Hamburger nav; h1 64→32px; grids collapse to 1-up; footer 4→1 col |
| Tablet | 768–1024px | Tight nav; 2-up grids; pricing 2-up |
| Desktop | 1024–1440px | Full layout; 3-up features; 4-6-up connectors |
| Wide | > 1440px | More outer breathing room; max-width caps at 1200px |

Touch targets: buttons min 40×40, icon-circular 36×36 (centered), inputs 40px height, connector tiles tap area >> 44px.

Collapsing: nav → hamburger at <768, hero 6/6 → single-col, feature/pricing columns reduce, code blocks horizontal-scroll on mobile (no wrapping).

## Iteration Guide

1. ONE component at a time; reference YAML key
2. Variants (-active, -disabled, -focused) as separate entries
3. Use `{token.refs}` everywhere — never inline hex
4. Never document hover. Default and Active/Pressed states only
5. Display headlines stay Copernicus 400 negative tracking. Body stays StyreneB/Inter 400. Split is unbreakable.
6. Cream + coral + dark navy is the trinity. No fourth surface tone.
7. Emphasis: bigger Copernicus before bolder weight

## Known Gaps

- Copernicus/StyreneB are licensed, not public web fonts (substitutes documented)
- Spike-mark is inline SVG logo asset, not formalized token
- Animation/transitions not in scope
- Form validation states beyond focused not extracted
- Product surface (chat UI) out of scope
- "computer use" animated demos don't fully capture in static screenshots

---
*Saved as reference for typing-race UI design decisions. User will be asked later how to apply.*