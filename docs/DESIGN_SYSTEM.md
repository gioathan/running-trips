# Design System — "Athletic Editorial Runner"

Source: Figma file `KD9K5ul4JXrKAtijVk4xPj` (templates: Home, Destinations,
Services ×2, Contact, Login/Signup — desktop + mobile) plus the design-system
spec you provided directly.

## Brand voice

Avant-garde editorial, not mass-market athletic. Ink-black type on soft
pale-concrete surfaces, with two surgical accent colors — no orange, no
heavy dark blocks. Uppercase tracked labels (Swiss sports-timing feel),
ExtraBold display type, hairline borders instead of blurred shadows, hard
2px offset shadows on interactive lift, pill-shaped buttons/chips, 10px
radius cards.

## Color tokens

> **Note on the two color lists you provided**: the YAML `colors:` block
> reads like a full exported Material-3 tonal palette (includes
> `on-*`/`*-container`/`*-fixed` roles for every color, plus `error` and
> `tertiary` which the brand prose never mentions). The prose "Colors"
> section is the hand-authored, practical spec — it's what the component
> descriptions (buttons, cards, chips) actually reference, and its hex
> values don't all line up 1:1 with the YAML's `primary`/`secondary` roles
> (e.g. the prose's primary action color `#D686EA` is the YAML's
> `primary-container`, not its `primary`). I'm treating **prose as the
> source of truth for the 6 functional brand colors** below, and pulling
> from the YAML ramp only for roles the prose doesn't define (error state,
> disabled, elevated/inverse surfaces). Flag it if you'd rather reconcile
> these into one clean palette before we build — easy to do, just wanted it
> decided explicitly rather than picked silently.

**Core (prose, authoritative for UI)**

| Token | Hex | Usage |
|---|---|---|
| `canvas` | `#E6E6E6` | Global page background |
| `surface` | `#FFFFFF` | Cards, modals, inset media frames |
| `ink` | `#14161A` | Display type, hairline borders, solid pills, secondary buttons |
| `ink-muted` | `#5C6068` | Secondary/tertiary text, placeholders |
| `primary` (Lilac) | `#D686EA` | Primary CTAs, focal badges, interactive signal — always paired with `ink` text |
| `accent` (Volt) | `#D4FF3F` | Performance/highlight actions, "editorial badges" secondary accent — paired with `ink` text |

**Supplementary (from YAML ramp, used where prose is silent)**

| Token | Hex | Usage |
|---|---|---|
| `error` | `#BA1A1A` | Form validation errors |
| `on-error` | `#FFFFFF` | Text on error fill |
| `error-container` | `#FFDAD6` | Error banner background |
| `surface-container-low` | `#F4F3F3` | Subtle nested surface (e.g. table row hover, matches prose's implied `#F0F0F0`) |
| `surface-dim` | `#DADADA` | Disabled fill |
| `outline` | `#807380` | Non-hairline dividers where `ink` at 10–12% is too heavy |
| `inverse-surface` | `#2F3131` | Reserved for a future dark-mode pass — not used at launch except the footer (see below) |

**Footer is the one deliberately dark surface on an otherwise light site**
(your call): background `ink` (`#14161A`), text `inverse-on-surface`
(`#F1F1F1`), links/headings in white, newsletter input as a white pill on
the dark field. Every other page/section stays on the light `canvas`/
`surface` pairing above — the footer is the single intentional contrast
point, consistent with `ink` already being the brand's "solid" color for
pills and secondary buttons elsewhere.

## Typography

Font: **Inter**, loaded via Google Fonts (self-hostable later if needed).

| Style | Size / Weight / Line-height / Tracking | Use |
|---|---|---|
| `headline-xl` (56/800/60, −0.03em) — mobile 38/800/42, −0.025em | Hero H1 |
| `headline-lg` (36/800/40, −0.02em) — mobile 28/800/32 | Section H2 |
| `headline-md` (24/700/30, −0.015em) | Card/widget H3 |
| `headline-sm` (18/700/24, −0.01em) | Sub-headings |
| `body-lg` (16/400/24) | Primary paragraph text |
| `body-md` (14/400/20) | Secondary text, form labels' helper text |
| `body-sm` (12/400/16) | Fine print |
| `label-lg` (13/700/16, +0.12em, uppercase) | Button labels, tab labels |
| `label-md` (11/700/14, +0.14em, uppercase) | Chip/badge text |
| `label-sm` (10/700/12, +0.16em, uppercase) | Micro-labels (timestamps, eyebrow text) |
| `metric-display` (48/800/48, −0.04em) | Big numbers (stat bands, telemetry) |

## Shape, spacing, elevation

- Radius: cards/modules `10px` (`rounded-md`); buttons, chips, badges, inputs
  → full pill (`rounded-full`).
- Spacing scale (4/8px modular): `xs 4px · sm 8px · md 16px · lg 24px · xl 40px`.
  Gutter `16px` mobile / `24px` desktop. Page margin `16px` mobile /
  `32px` tablet / `48px` desktop.
- No blurred drop shadows. Depth = flat `canvas` background + `surface`
  cards lifted with a **1px solid `ink` hairline border**; active/hover
  state adds a **hard 2px offset `ink` shadow, 0px blur**.
- Grid: 12-col desktop / 8-col tablet / 4-col mobile.

## Components (spec → implementation notes)

- **Buttons**: Primary = `primary` fill + `ink` text, pill, uppercase
  `label-lg`. Highlight = `accent` fill + `ink` text (reserve for the single
  highest-priority action on a page — e.g. "Book Now"). Secondary = `ink`
  fill + white text. Ghost = transparent, 1px `ink` border, fills `surface`
  on hover.
- **Cards**: `surface` fill, 1px `ink` border, `10px` radius, internal
  dividers at `ink` 10% opacity.
- **Chips/Badges**: pill, 4px/10px padding. Status pills = solid `ink` +
  white uppercase `label-sm` (e.g. race-category tags on trip cards).
  Telemetry/highlight tags = `accent` fill + `ink` text (e.g. a "Full" or
  "X spots left" badge on a trip card — reuse this pattern for the
  `is_full_override` state). Editorial badges = `primary` fill + `ink` text
  (e.g. "Featured").
- **Inputs**: white, `10px` radius, 1px `ink` border, `ink-muted`
  placeholder, focus = 2px `ink` ring + `primary` accent dot/icon.
- **Checkboxes/radios**: 2px `ink` border, `4px` radius (checkbox) /
  pill (radio), checked mark in `accent`.
- **Lists/telemetry rows**: bottom-border rows, `label-md` tracked header,
  values in `metric-display`/`headline-md`, hover fill
  `surface-container-low`.

## Reference Tailwind config (for when we scaffold)

```js
// tailwind.config.ts — theme.extend, to be wired up once the Next.js app exists
export default {
  theme: {
    extend: {
      colors: {
        canvas: '#E6E6E6',
        surface: '#FFFFFF',
        'surface-low': '#F4F3F3',
        'surface-dim': '#DADADA',
        ink: '#14161A',
        'ink-muted': '#5C6068',
        primary: '#D686EA',
        accent: '#D4FF3F',
        error: '#BA1A1A',
        'error-container': '#FFDAD6',
        'footer-bg': '#14161A',
        'footer-fg': '#F1F1F1',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      fontSize: {
        'headline-xl': ['56px', { lineHeight: '60px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'headline-xl-mobile': ['38px', { lineHeight: '42px', letterSpacing: '-0.025em', fontWeight: '800' }],
        'headline-lg': ['36px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-lg-mobile': ['28px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-md': ['24px', { lineHeight: '30px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        'body-md': ['14px', { lineHeight: '20px' }],
        'body-sm': ['12px', { lineHeight: '16px' }],
        'label-lg': ['13px', { lineHeight: '16px', letterSpacing: '0.12em', fontWeight: '700' }],
        'label-md': ['11px', { lineHeight: '14px', letterSpacing: '0.14em', fontWeight: '700' }],
        'label-sm': ['10px', { lineHeight: '12px', letterSpacing: '0.16em', fontWeight: '700' }],
        'metric-display': ['48px', { lineHeight: '48px', letterSpacing: '-0.04em', fontWeight: '800' }],
      },
      borderRadius: { sm: '2px', DEFAULT: '4px', md: '6px', lg: '8px', xl: '12px', full: '9999px' },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
      boxShadow: { hard: '2px 2px 0 0 #14161A' },
    },
  },
};
```
