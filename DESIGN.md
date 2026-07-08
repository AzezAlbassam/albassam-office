---
name: "Albassam — Private Family Office"
category: Brands
surface: web
colors:
  obsidian-scene: "#0B0D11"
  plate: "#14171D"
  ivory: "#ECE7DC"
  ink-60: "#A8A296"
  hair: "#262B33"
  gold: "#C9A96A"
  terracotta-loss: "#D96C57"
---

# Albassam — Private Family Office

> Category: Brands

> Surface: web

*Albassam*

A private family office ledger — lacquered obsidian scene, one gold gyroscope,
editorial serif numerals for the figures that matter. v3 "The Instrument"
(2026-07-09); supersedes v2's paper-light system and v1's flat obsidian.

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Obsidian scene | `#0B0D11` | page ground (from --scene); a fixed radial lift to `#141821` at top center gives the scene depth; a fixed 5%-opacity SVG grain overlay breaks flatness |
| surface | Plate | `#14171D` | cards/panels as vertical lacquer gradients `#1A1E25` → `#14171D` (from --plate-2/--plate), 1px hairline, inner top-light `rgba(255,235,200,.07)` |
| foreground | Ivory | `#ECE7DC` | body text and figures (from --ink) |
| muted | Ink 60 | `#A8A296` | labels, captions, secondary text (from --ink-2; faint tier --ink-3 `#938D81` for hints and chart axes) |
| border | Hair | `#262B33` | hairlines, dividers, plate edges (from --hair; softer `#1E232B` between rows) |
| accent | Gold | `#C9A96A` | the gyroscope, percentages, ledger tags, gold-faced primary buttons, chart line (from --gold; pale `#E6D3A7`, deep `#8F7443`, tint `rgba(201,169,106,.12)`) |
| accent-secondary | Terracotta / Loss | `#D96C57` | negative figures, destructive actions only (from --loss; tint `rgba(217,108,87,.13)`; never decorative) |

Extra semantic tone outside the 7-role schema:
- **Gain (emerald) `#5FB48A`** — positive figures only (tint `rgba(95,180,138,.13)`).

Shadows are layered black composites always paired with the inner top-light
(`0 1px 0 rgba(255,235,200,.07) inset, 0 2px 6px rgba(0,0,0,.35), 0 14px 34px rgba(0,0,0,.35)`;
hover deepens both drops) so plates read as lit objects.

## Typography
- **Display:** Fraunces — weights 300, 400, 500 — fallbacks: Georgia, Times New Roman, serif.
  Hero holdings figure (300, soft glow text-shadow), headings and panel titles (500), stat
  values and percentages (400).
- **Body:** Geist — weights 400, 500, 600 — fallbacks: -apple-system, SF Pro Text, Segoe UI, sans-serif.
  All UI, labels, buttons, data rows; `font-variant-numeric: tabular-nums` globally.

## Voice & Tone

- **Adjectives:** private, custodial, understated, precise
- **Tone:** Quiet-luxury and custodial rather than corporate-SaaS. Short, formal nouns
  (Registry, Ledger, Members, Portfolio history) stand in for feature names. Sentence case
  everywhere; no exclamation points, no growth verbs. English only — Arabic script was
  removed by the owner's decision (2026-07-06); do not reintroduce it.

### Messaging pillars
- Albassam
- Members
- Portfolio history
- Ledger

### Vocabulary
- **Use:** registry, ledger, members, stewarded, family office, portfolio history
- **Avoid:** dashboard, users, clients, app, exclamation points, growth/marketing verbs ("unlock", "supercharge"), Arabic script

## Imagery

- **Style:** No photography — the identity is the 3D gyroscope seal (member ownership arcs
  in preserve-3d with a gold underglow and blurred echo ring), a fixed film grain, and the
  numbers themselves set in Fraunces.
- **Treatment:** Lacquer-dark plates lit from above, thin gold linework, ±7° precession
  over 22s plus pointer tilt on fine pointers (js/tilt.js), tick ring at 300s. All motion
  is transform/opacity, eased `cubic-bezier(0.22,1,0.36,1)`, disabled under
  prefers-reduced-motion. Structural gradients only (scene lift, plate lacquer, chart
  area, gold button face).
- **Avoid:** photography, human figures/faces, stock illustration, emoji/icon packs,
  neon glow or RGB-gamer dark mode, pure-black flat `#000`, glassmorphism

## Layout

- **Radius:** 18px plates / 9–10px controls / 999px pills
- **Border weight:** 1px
- **Spacing:** 4px base unit; 16–24px component padding; 58–76px section rhythm

### Posture rules
- Left-aligned product topbar (gold khatam + "Albassam · Family office" in Fraunces, status pills right).
- Asymmetric hero: holdings figure left in HTML type, the 3D gyroscope right; stacks centered on mobile. The value never renders inside the seal SVG.
- The gyroscope is the only theatre — three preserve-3d layers (underglow −80px, echo −42px, crisp SVG at 0), idle precession, pointer tilt on desktop only.
- Stats are one segmented plaque (single plate, hairline-divided cells), not floating boxes.
- Sentence-case Fraunces headings with muted one-line subtitles; the hero eyebrow is the only tracked-caps element.
- Semantic color rationed: gold = brand, emerald gains only, terracotta losses only — never decorative.
- Motion: precession + tilt, one hero entrance, hover lift on plates, active scale(0.98) — nothing else; fully disabled under prefers-reduced-motion.
- Buttons: gold-faced primary with dark ink text, plate-quiet, terracotta-ghost danger; gold focus rings on all interactive elements.
