# Albassam — Private Family Office

A private family office ledger — warm paper ground, one bronze seal, editorial serif
numerals, hairline surfaces. Codified from the v2 redesign shipped 2026-07-06
(Stripe/Apple/Claude-inspired light system; supersedes the original obsidian/gold theme).

This is a prose brief for an autonomous design agent building anything in this system:
a landing page, a deck, a component, an email. Read it before you touch color or type.

## The one-sentence brief

Old-money custodial ledger in a modern product idiom: warm paper ground, white
hairline cards, one bronze seal, serif numerals when a figure matters, and total
restraint everywhere else.

## Color

Measured from the site's live `:root` custom properties (never guessed):

| Role | Hex | Use it for |
| --- | --- | --- |
| background — Paper | `#FAF9F6` | the page ground, warm off-white |
| surface — Card | `#FFFFFF` | cards, stat strip, panels, ledger |
| foreground — Ink | `#1C1A17` | body text, figures, primary buttons |
| muted — Ink 60 | `#6F6A61` | labels, captions, secondary text (faint tier `#A29C93` for hints/axes) |
| border — Hair | `#EAE6DE` | hairlines and dividers (`#DBD5C9` on inputs) |
| accent — Bronze | `#8A6B3B` | the seal, percentages, brand emphasis — text-safe; `#B08D55` for strokes/graphics, `#F3EDE1` as tint fill |
| loss — Terracotta | `#B4453A` | negative figures and destructive actions ONLY (tint `#FBEDEB`) |

One extra semantic tone is load-bearing:
- **Gain (emerald) `#1E7A4F`** — positive figures only (tint `#E9F4EE`).

Discipline matters more than the palette itself: bronze marks brand, emerald marks
gains, terracotta marks losses — none of the three is ever decorative. Shadows are
warm-tinted (`rgba(92,76,51,…)`), never pure black, and stay soft: cards rest on
hairlines first, shadows second.

## Typography

Two typefaces, each with one job:

- **Fraunces** (display serif, 300/400/500) — the signature voice: the hero holdings
  figure (300, tight tracking), section headings and card titles (500), stat values and
  ownership percentages (400). When a number is important enough to notice, it switches
  to Fraunces. Never for body copy.
- **Geist** (UI sans, 400/500/600) — everything else: labels, buttons, forms, data rows,
  captions. Tabular numerals on all data.

Marcellus (v1's display face) is retired. Do not reintroduce it.

## Logo

One mark — the khatam seal (two rotated squares + center dot), 1px+ bronze stroke:
- `logos/header.svg` — full lockup mark for mastheads.
- `logos/favicon.svg` — simplified two-square favicon (no center dot).

There is no raster logo and no og:image; the site is `noindex`. The seal is the entire
mark — don't invent a photographic hero or a new lockup.

## Imagery

No photography. The identity is the line-art seal and the numbers themselves: thin
bronze strokes, generous negative space, one slow ambient rotation on the seal's tick
ring (switched off under `prefers-reduced-motion`). If a new artifact seems to need a
hero image, it doesn't — reach for typographic composition, the seal, and a hairline.

## Layout posture

- **Left-aligned product topbar** — small seal + "Albassam · Family office" wordmark in
  Fraunces, status pills right. Not a centered ceremonial masthead (that was v1).
- **Asymmetric hero:** the holdings figure left, the seal right on desktop; stacked and
  centered on mobile. The value lives in HTML type, not inside the seal.
- **Segmented stat strip** — one white card, hairline-divided cells, not floating boxes.
- **Two-tier radius:** 18px content cards, 9–10px controls, 999px pills. Never one
  global radius.
- **Sentence case everywhere.** One uppercase eyebrow ("Total holdings") is the only
  tracked-caps survivor. Section headings are Fraunces sentence case with a one-line
  muted subtitle — no flanking rules, no icons.
- **1px hairlines + soft warm shadows;** 4px base spacing; 56–72px section rhythm.
- **Motion:** the seal's slow rotation, a fade-up entrance stagger, and hover lift on
  cards — nothing else. All disabled under `prefers-reduced-motion`.

## Voice

Private, custodial, understated, precise. English only — the Arabic subtitle was
removed by the owner's decision on 2026-07-06; do not reintroduce Arabic script.
The copy reads like a ledger kept by a family office: "Registry," "Ledger," "Members,"
"Portfolio history," "Family wealth, stewarded." No exclamation points, no growth
verbs, never "users" or "dashboard."

## What "good" looks like here

If a new artifact could be mistaken for a generic fintech dashboard — saturated
accents, icon rows, heavy shadows, a peppy CTA — it has drifted. The tell of this
brand is restraint: one bronze seal, one hairline, one register-shift to Fraunces when
a number really matters, and silence everywhere else.
