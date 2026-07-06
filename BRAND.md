# Albassam — Private Family Office

A private family office ledger — obsidian ground, brushed-gold seal, tabular-numeral portfolio history for members of the Albassam family. Extracted and measured from https://azezalbassam.github.io/albassam-office.

This is a prose brief for an autonomous design agent building anything in this system: a landing page, a deck, a component, an email. Read it before you touch color or type.

## The one-sentence brief

Old-money custodial ledger, not fintech dashboard: obsidian ground, one gold seal, hairline rules, tabular numerals, and total restraint everywhere else.

## Color

Seven roles, all measured from the site's live `:root` custom properties (never guessed):

| Role | Hex | Use it for |
| --- | --- | --- |
| background — Obsidian | `#0a0c0f` | the page ground, near-black |
| surface — Panel | `#14171c` | cards, stat tiles, member rows |
| foreground — Ivory | `#eae6dd` | body text and ledger figures |
| muted — Stone | `#9c968a` | labels, captions, secondary text |
| border — Line | `#23272e` | hairlines and dividers |
| accent — Gold | `#c8a96e` | the wordmark, the seal, primary actions — the signal color, used more than anything else |
| accent-secondary — Terracotta | `#c25e4c` | negative figures and destructive actions ONLY |

Two extra semantic tones live outside the 7-role schema but are load-bearing on the real site — carry them into any new build:
- **Gain (emerald) `#58a47c`** — positive/gain figures only.
- **Gold tints** — `#e0cfa5` pale (hover), `#7e6a45` deep (secondary labels/sub-values), `#8c6f4a` bronze (tags).

Discipline matters more than the palette itself: gold marks brand and positive/primary emphasis, emerald marks gains, terracotta marks losses — and none of the three is ever used decoratively outside that meaning. If you're tempted to add a fourth "accent" for variety, don't — the whole system runs on the tension between one warm gold seal and an otherwise near-monochrome ground.

## Typography

Three real typefaces, each with one job:

- **Marcellus** (display, weight 400 only) — the masthead wordmark and panel/modal headings. Track it hard: the source uses .3em+ letter-spacing on the wordmark. Never use it for body copy or long text — it isn't legible at small sizes.
- **Inter** (body/UI, 400/500/600) — everything else: labels, buttons, form fields, section eyebrows.
- **Fraunces** (numeral display, 300/400) — reserved exclusively for the figures that matter: stat values, percentages, ledger amounts. This is the system's signature typographic move — when a number is important enough to notice, it switches from Inter to Fraunces. Don't use Fraunces for prose.

## Logo

One mark, two saved weights, both in `logos/`:
- `logos/header.svg` — the full masthead lockup: two rotated 18×18 squares plus a center dot, 1px gold stroke. Use this as primary.
- `logos/favicon.svg` — the simplified two-square favicon (no center dot), for small/tight placements.

There is no raster logo, no apple-touch-icon, and no og:image on the real site — it's marked `noindex` and isn't built for social sharing. Don't invent a wordmark lockup or a photographic hero; the seal is the entire mark.

## Imagery

There is no photography on the source site — none. The entire visual identity is the line-art seal: thin 1px gold strokes, generous negative space, perfect symmetry, one slow 240s ambient rotation (switched off under `prefers-reduced-motion`). If a new artifact needs a "hero image," the honest answer is: it doesn't get one. Reach for typographic composition, the seal mark, and a hairline rule before reaching for a photo, an illustration, or a gradient.

## Layout posture

- **Two-tier radius, not one number:** 14px on content cards (stat tiles, member panels), a tighter 9px on interactive controls (buttons, inputs), and 999px pills for status chips. Don't collapse this to a single global radius.
- **Centered, ceremonial masthead** — not a left-aligned SaaS nav bar. Wide letter-spacing, a bilingual identity line (English wordmark, Arabic subtitle beneath it as co-equal identity), a thin descriptor rule either side.
- **Uppercase micro-labels everywhere**, heavily tracked (.14em–.28em), with hairline rules flanking section headings instead of icons. No icon-per-heading pattern.
- **1px hairlines throughout** — no shadows, no heavy borders.
- **4px base spacing unit**; component padding sits in the 14–22px range; section rhythm is generous, 42–70px between major blocks.
- **Motion is a single flourish** — the seal's slow rotation — and nothing else animates. Respect `prefers-reduced-motion` completely.

## Voice

Private, custodial, understated, precise, ceremonial. The copy reads like a ledger kept by a family office, not a fintech product: "Registry," "Ledger," "Members," "Portfolio history," "Family wealth, stewarded." No exclamation points. No growth-marketing verbs ("unlock," "supercharge"). No calling members "users" or "clients." Say "family office," not "app" or "dashboard."

## What "good" looks like here

If a new artifact in this system could be mistaken for a generic fintech dashboard — bright cards, icon rows, drop shadows, a peppy CTA — it has drifted. The tell of this brand is restraint: one gold seal, one hairline rule, one register-shift when a number really matters, and silence everywhere else.
