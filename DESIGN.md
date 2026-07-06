---
name: "Albassam — Private Family Office"
category: Brands
surface: web
colors:
  paper: "#FAF9F6"
  card: "#FFFFFF"
  ink: "#1C1A17"
  ink-60: "#6F6A61"
  hair: "#EAE6DE"
  bronze: "#8A6B3B"
  terracotta-loss: "#B4453A"
---

# Albassam — Private Family Office

> Category: Brands

> Surface: web

*Albassam*

A private family office ledger — warm paper ground, bronze seal, editorial serif
numerals for the figures that matter. v2 light system (2026-07-06); supersedes the
original obsidian/gold theme.

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Paper | `#FAF9F6` | page canvas — warm off-white (from --paper, on <body>) |
| surface | Card | `#FFFFFF` | cards, stat strip, panels, ledger, inputs (from --card) |
| foreground | Ink | `#1C1A17` | body text, figures, primary buttons (from --ink) |
| muted | Ink 60 | `#6F6A61` | labels, captions, secondary text (from --ink-2; faint tier --ink-3 #A29C93 for hints and chart axes) |
| border | Hair | `#EAE6DE` | hairlines, dividers, card edges (from --hair; inputs use --hair-2 #DBD5C9 one step stronger) |
| accent | Bronze | `#8A6B3B` | the seal, ownership percentages, brand emphasis (from --accent; --accent-soft #B08D55 for strokes/graphics, --accent-tint #F3EDE1 as fill) |
| accent-secondary | Terracotta / Loss | `#B4453A` | negative figures, destructive actions only (from --loss; tint #FBEDEB; never decorative) |

Extra semantic tone outside the 7-role schema:
- **Gain (emerald) `#1E7A4F`** — positive figures only (tint `#E9F4EE`).

Shadows are warm-tinted composites (`0 1px 2px rgba(92,76,51,.05), 0 2px 8px rgba(92,76,51,.05)`;
hover steps to a deeper `0 12px 32px rgba(92,76,51,.09)`). Never pure-black shadows.

## Typography
- **Display:** Fraunces — weights 300, 400, 500 — fallbacks: Georgia, Times New Roman, serif.
  Hero holdings figure (300), headings and card titles (500), stat values and percentages (400).
- **Body:** Geist — weights 400, 500, 600 — fallbacks: -apple-system, SF Pro Text, Segoe UI, sans-serif.
  All UI, labels, buttons, data rows; `font-variant-numeric: tabular-nums` globally.
- Marcellus (v1 display face) is retired — do not reintroduce.

## Voice & Tone

- **Adjectives:** private, custodial, understated, precise
- **Tone:** Quiet-luxury and custodial rather than corporate-SaaS: the copy reads like the
  ledger of a family office, not a fintech dashboard. Short, formal nouns (Registry, Ledger,
  Members, Portfolio history) stand in for feature names. Sentence case everywhere; no
  exclamation points, no growth verbs. English only — Arabic script was removed by the
  owner's decision (2026-07-06); do not reintroduce it.

### Messaging pillars
- Albassam
- Members
- Portfolio history
- Ledger

### Vocabulary
- **Use:** registry, ledger, members, stewarded, family office, portfolio history
- **Avoid:** dashboard, users, clients, app, exclamation points, growth/marketing verbs ("unlock", "supercharge"), Arabic script

## Imagery

- **Style:** No photography — the identity is the line-art khatam seal (two rotated squares +
  center dot) in bronze strokes on paper, plus the numbers themselves.
- **Subjects:** the geometric seal mark, financial figures set in Fraunces
- **Treatment:** Thin bronze linework, generous negative space, one slow ambient rotation on
  the seal's tick ring (300s; disabled under prefers-reduced-motion). Soft warm shadows allowed;
  no gradients beyond the chart's faint bronze area fill.
- **Avoid:** photography, human figures/faces, stock illustration, emoji or icon packs, saturated accents, pure-black shadows

## Layout

- **Radius:** 18px cards / 9–10px controls / 999px pills
- **Border weight:** 1px
- **Spacing:** 4px base unit; 16–24px component padding; 56–72px section rhythm

### Posture rules
- Left-aligned product topbar (seal + "Albassam · Family office" in Fraunces, status pills right) — not a centered ceremonial masthead.
- Asymmetric hero: holdings figure left in HTML type, seal right; stacks centered on mobile. The value never renders inside the seal SVG.
- Stats are one segmented white card with hairline-divided cells, not floating boxes.
- Sentence case headings in Fraunces with a one-line muted subtitle; the only tracked-caps element is the hero eyebrow ("Total holdings").
- Two numeral registers: tabular Geist for UI copy and dates; Fraunces reserved for the figures that matter (hero value, stat values, percentages).
- Semantic color rationed: bronze = brand, emerald #1E7A4F = gains only, terracotta #B4453A = losses/danger only — never decorative.
- Motion: seal rotation, fade-up entrance stagger, card hover lift — nothing else; all disabled under prefers-reduced-motion.
- Buttons: ink-filled primary with hover shift and active scale(0.98); quiet (white/hairline) and danger (terracotta ghost) variants; visible focus rings (bronze) on all interactive elements.
