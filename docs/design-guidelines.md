# Design Guidelines — DevPowers

Extracted from <https://devpowers.com/> on 2026-11-25 (Playwright CLI, headed Chrome, desktop viewport). Machine-readable tokens live in [`assets/design-tokens.json`](../assets/design-tokens.json).

## Assets

| File | Purpose |
|---|---|
| [`../assets/homepage.png`](../assets/homepage.png) | Full-page reference screenshot (light theme, no overlays) |
| [`../assets/logo.svg`](../assets/logo.svg) | DevPowers wordmark, `fill="currentColor"` |
| [`../assets/favicon.svg`](../assets/favicon.svg) | Favicon; `#004581`, switches to white under `prefers-color-scheme: dark` |
| [`../assets/design-tokens.json`](../assets/design-tokens.json) | Colors, typography, spacing, radii, shadows, components |

No font files are stored locally: the site loads its fonts from Google Fonts (see Typography).

## Colors

The site defines its palette as CSS custom properties on `:root`. Reuse the same names in the app.

### Light theme (default)

| CSS variable | Token | Hex | Usage |
|---|---|---|---|
| `--surface` | `background.default` | `#fff9eb` | Page background (warm cream paper) |
| `--surface-raised` | `background.raised` | `#ffffff` | Cards, raised sections, light buttons |
| `--surface-strong` | `brand.primary` | `#004581` | Dark-blue bands, logo, favicon |
| — | `brand.primaryDark` | `#003761` | Alternate dark band |
| — | `brand.primaryBright` | `#038bfe` | Bright "comic" blue bands (villain band, side missions) |
| — | `background.footer` | `#002d52` | Footer |
| `--on-surface` | `text.primary` | `#101820` | Body text, headings, **all outlines and shadows** |
| `--on-surface-strong` | `text.onDark` | `#ffffff` | Text on blue bands |
| `--muted` | `text.muted` | `#4c5b66` | Secondary text |
| `--accent` | `brand.accent` | `#d30f10` | Primary CTA, emphasis, negative state |
| `--on-accent` | `text.onAccent` | `#ffffff` | Text on red |
| `--accent-warm` | `brand.accentWarm` | `#ffd447` | Stickers, active tabs, highlights |
| `--on-accent-warm` | `text.onAccentWarm` | `#101820` | Text on yellow |
| `--positive` | `brand.success` | `#167a3e` | Success, check marks |
| `--negative` | `brand.error` | `#d30f10` | Errors, "the old trap" |
| `--chat-client` | `background.chatClient` | `#fff1b8` | Client chat bubble |
| `--chat-agent` | `background.chatAgent` | `#d9ecff` | Agent chat bubble |
| `--soft-red` | `background.softRed` | `#fff0ed` | Soft negative panels |
| `--soft-blue` | `background.softBlue` | `#eaf5ff` | Soft info panels |
| `--hairline`, `--shadow` | `line.*` | `#101820` | Borders and hard drop shadows |

### Dark theme (`html.dark`, toggled from the header)

| Variable | Hex |
|---|---|
| `--surface` | `#17121d` |
| `--surface-raised` | `#241c2e` |
| `--surface-strong` | `#0d3b66` |
| `--on-surface` | `#f7efe1` |
| `--muted` | `#c3b4a6` |
| `--accent` / `--on-accent` | `#ff3b30` / `#1a0d0c` |
| `--accent-warm` / `--on-accent-warm` | `#ffd233` / `#191016` |
| `--positive` / `--negative` | `#6bdd97` / `#ff5a4d` |
| `--chat-client` / `--chat-agent` | `#4a3a12` / `#14395c` |
| `--hairline` / `--hairline-strong` | `#f7efe1` / `#fff` |
| `--shadow` | `#000` |
| `--soft-red` / `--soft-blue` | `#3b1a1a` / `#132c44` |

## Typography

Two Google Fonts, loaded with:

```html
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bangers&display=swap" rel="stylesheet">
```

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display (h1–h3, buttons, stickers) | `Bangers, sans-serif` | 400 | Comic-book caps; slight positive letter-spacing (~0.02em) |
| Body, nav, UI | `"Atkinson Hyperlegible", sans-serif` | 400, 700 | High-legibility sans; nav links are 700 |

Both fonts are published under the SIL Open Font License on Google Fonts. Confirm the license still fits your use before you bundle them. No self-hosted `@font-face` files were found, so nothing was downloaded to `assets/fonts/`.

### Size scale (desktop)

| Token | Size | Line height | Usage |
|---|---|---|---|
| `h1` | 55.2px (fluid) | 1.0 | Hero headline |
| `h2` | 51.4px (fluid) | ~1.1 | Section headlines |
| `h3` | 29.6–32px | 1.08 | Card titles |
| `2xl` | 28px | 32px | Small panel headings |
| `lead` | 21.6px | 35.1px (1.625) | Hero intro paragraph |
| `lg` | 20px | 20px | Buttons, stickers (Bangers) |
| `md` | 18px | — | Large body |
| `base` | 16px | 24px (1.5) | Body text |
| `sm` | 14px | 20px | Navigation |
| `xs` | 12px | — | Captions, fine print |

Headings scale fluidly with the viewport (hence the fractional pixel values). Use `clamp()` in the app.

## Spacing

The base unit is 4px, following the Tailwind scale, which the site uses. Common values: 4, 8, 12, 16, 20, 24, 32, 48 and 64px. Sections use about 65px of vertical padding (64px at the top of the hero). Cards use 24px padding. Prose columns are capped at about 832px, narrow text at 672px.

## Border radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 6px | Small chips |
| `button` | 7px | All buttons |
| `md` | 8px | Inner panels |
| `card` | 10px | Cards, stickers (most common radius) |
| `lg` | 16px | Large panels |
| `bubble` | `14px 14px 14px 4px` / `14px 14px 4px` | Chat bubbles (one sharp corner) |
| `circle` | 50% | Numbered chat tabs, avatars |

## Borders and shadows (signature style)

Every interactive or raised element gets a solid **#101820 outline**: 3px by default, 2px for small items and 4px for emphasis. Shadows are **hard offset comic shadows with no blur**:

| Token | Value | Usage |
|---|---|---|
| `shadow.sm` | `3px 3px 0 0 #101820` | Stickers, tabs |
| `shadow.md` | `4px 4px 0 0 #101820` | Buttons |
| `shadow.lg` | `6px 6px 0 0 #101820` | Cards |
| `shadow.accent` | `6px 6px 0 0 #d30f10` | Highlighted card |
| `shadow.warm` | `6px 6px 0 0 #ffd447` | Highlighted card on dark bands |

Never use soft or blurred shadows or gradients.

## Components

- **Header**: sticky, 76px tall, `--surface` background. Logo on the left, nav in the middle, then a theme toggle and a "Get a quote" primary button on the right.
- **Nav links**: Atkinson Hyperlegible 14px, weight 700, `#101820`, no text transform. Short labels with question marks ("Why?", "How?").
- **Primary button** (`.btn-primary`): `#d30f10` background, white Bangers 20px text, padding `10.4px 16px`, 7px radius, 3px `#101820` border, `4px 4px 0` hard shadow.
- **Light button** (`.btn-light`): same shape with a white background and `#101820` text. Used for secondary CTAs and icon buttons (theme toggle, mobile menu).
- **Sticker / chapter label** (`.sticker`): `#ffd447` background, Bangers 20px, padding `5.6px 11.2px`, 10px radius, 3px outline, `3px 3px 0` shadow, **rotated -1deg**. Used for kickers such as "CHAPTER 01 - MEET THE VILLAIN" and corner badges ("5 WORKING DAYS").
- **Card** (`article`): white, 24px padding, 10px radius, 3px outline, `6px 6px 0` shadow.
- **Bands** (`.section.band`): full-width sections in `#038bfe`, `#004581` or `#003761` with white text and a 3px `#101820` top border. They alternate with cream sections and white "raised" sections that have 3px borders top and bottom.
- **Chat mock**: client bubbles in `#fff1b8`, agent bubbles in `#d9ecff`, one sharp corner. Numbered circular tabs (yellow when active).
- **Footer**: `#002d52` background, white text, 48px vertical padding.
- **Inputs**: there are no form inputs on the homepage. Style them like cards: white, 3px `#101820` border, 7–8px radius, Atkinson Hyperlegible 16px, and a yellow (`--accent-warm`) focus ring.

## Logo usage

- `assets/logo.svg` is a single-color wordmark (`viewBox 0 0 449.8 100`) using `fill="currentColor"`. Set its color via CSS: `#004581` or `#101820` on light surfaces, `#ffffff` on blue bands, the footer or dark theme.
- Place it top-left in the header at about 32–40px height. Keep clear space at least equal to the height of the "D".
- `assets/favicon.svg` is the standalone mark. It already adapts to dark mode through `prefers-color-scheme`.
- No separate inverted file is needed; recolor the wordmark with `currentColor`.

## Visual style summary

DevPowers looks like a **comic book**. The headlines are in the Bangers display face, and every card and button has a thick ink outline with a hard offset shadow, like printed panels. The palette is primary-color pop: cream paper, a bold comic blue, alarm red for action, and highlighter yellow for stickers and labels. The superhero and villain storytelling ("Your website. Your superpowers.", "Meet the villain") is playful and confident. Body copy in Atkinson Hyperlegible keeps long text readable. Contrast is high, nothing is blurred or soft, and small tilted stickers add energy without hurting readability.
