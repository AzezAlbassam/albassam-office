---
name: "Albassam · Falaj"
category: Brands
surface: web
colors:
  deep-water: "#12312E"
  shade-pool: "#183F3A"
  limestone: "#EDE6D8"
  sandstone: "#BFAE92"
  faint: "#A89A82"
  spring-water: "#7FD6C4"
  clay-loss: "#E59A7E"
  gain: "#93D3A8"
---

# Albassam · Falaj

> Category: Brands

> Surface: web

*One spring. Every share.*

Aziz's private family office. The family's money is one spring; the falaj (the old
Arabian water channel) carries its water to every member by their share. The site
is a scroll-scrubbed film of that channel, then one plain table of who owns what.
v4.1 (2026-10-07): the dividend calculator was removed at Aziz's request; keep it
simple. Supersedes v4 (2026-09-28) and v3.

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Deep water | `#12312E` | page canvas, sampled from the hero's final frame (#13332E) |
| surface | Shade pool | `#183F3A` | panels and cards, as a gradient from `#1D4842` |
| foreground | Limestone | `#EDE6D8` | text and figures |
| muted | Sandstone | `#BFAE92` | secondary text (6.4:1); faint `#A89A82` (5.0:1) for labels |
| border | Hair | `rgba(237,230,216,.10)` / `.20` | hairlines, field borders |
| accent | Spring water | `#7FD6C4` | actions, share figures, share previews, focus; rare doses |
| accent-secondary | Clay | `#E59A7E` | losses, money out, errors, destructive actions only |

Gains: `#93D3A8`.

## Typography

- **Display:** Newsreader 400/500 (opsz 6..72): headings, hero captions, every money figure.
- **Body:** Hanken Grotesk 400/500/600: all reading text and controls.
- **Mono:** Martian Mono 400: tiny labels only (the hero kicker, stat labels).
- Tabular lining numerals everywhere money appears.

## Imagery

One world only: the falaj seen straight down in soft early-morning light. Pale
limestone, clear aquamarine water, feathered date-palm shadows. Assets:
`assets/hero-scrub.mp4` (6 s, -g 8, crf 24, 1728 px, 4.8 MB), `hero-poster.jpg`,
`hero-ending.jpg` (the static hero and og:image).
No people, no coins, no decorative charts, no text inside images.

## Layout and motion

- Hero: 400vh pinned stage; bands at 0 to 0.30, 0.34 to 0.64, 0.70 to 1; entrances
  drift-down, grid snap-along, word rise plus staged CTA. Flick test: 6 to 7 steps at
  120 px, nothing skippable at 360 px. Worst-pixel contrast 4.2 to 5.5:1 with soft
  oval scrims (`radial-gradient(closest-side, ...)`, box inset -48% -44%).
- Static hero on the five gates (phones, portrait tablets, coarse portrait, landscape
  phones, reduced motion): the final frame with "One spring. Every share."
- Below the hero: the fund (worth today, one row per person: share with a bar, put
  in, worth today, zakat a year, plus an Everyone row), money in and out (three
  panels with a live "After this:" share preview), and a folded history.
- Accent in rare doses. Transform and
  opacity only; everything pinned under reduced motion; loops pause on hidden tabs.

## Voice

Calm, safe, plain. Water words (spring, share). Everyday money words: put in, worth
today, money in, money out, take money out. No finance jargon (units, NAV, redeem).
Sentence case, no exclamation points, no em dashes. English only.
