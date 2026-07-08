# Albassam — Private Family Office

A private family office ledger — a lacquered obsidian scene, one gold gyroscope, editorial
serif numerals, plates with real depth. Codified from the v3 redesign shipped 2026-07-09
("The Instrument"; supersedes v2's paper-light system and v1's flat obsidian).

This is a prose brief for an autonomous design agent building anything in this system:
a landing page, a deck, a component, an email. Read it before you touch color or type.

## The one-sentence brief

Old-money custodial ledger as a physical instrument: near-black lacquer, one gold
gyroscope, hairline-edged plates lit from above, serif numerals when a figure matters,
and total restraint everywhere else.

## Color

Measured from the site's live `:root` custom properties (never guessed):

| Role | Hex | Use it for |
| --- | --- | --- |
| scene — Obsidian | `#0B0D11` | the page ground; a fixed radial lift (`#141821` at top center) gives the scene depth |
| surface — Plate | `#14171D` → `#1A1E25` | cards and panels as vertical lacquer gradients, 1px `#262B33` hairline, inner top-light `rgba(255,235,200,.07)` |
| foreground — Ivory | `#ECE7DC` | body text and figures (secondary `#A8A296`, faint `#938D81`) |
| accent — Gold | `#C9A96A` | the gyroscope, percentages, tags, primary buttons (pale `#E6D3A7`, deep `#8F7443`, tint `rgba(201,169,106,.12)`) |
| gain — Emerald | `#5FB48A` | positive figures only (tint `rgba(95,180,138,.13)`) |
| loss — Terracotta | `#D96C57` | negative figures and destructive actions only (tint `rgba(217,108,87,.13)`) |

Discipline matters more than the palette: gold marks brand, emerald gains, terracotta
losses — never decorative. Shadows are deep and layered (contact + ambient black), always
paired with the inner top-light hairline so plates read as lit objects, not floating
rectangles. A fixed, 5%-opacity SVG grain overlay breaks digital flatness.

## Typography

Two typefaces, each with one job (unchanged since v2):

- **Fraunces** (display serif, 300/400/500) — the hero holdings figure (300, soft text-shadow
  glow), headings and panel titles (500), stat values and ownership percentages (400).
  When a number matters, it switches to Fraunces. Never body copy.
- **Geist** (UI sans, 400/500/600) — everything else; tabular numerals on all data.

## The gyroscope (signature)

The khatam seal ring — member ownership arcs on one circle — is rendered as a 3D object:
three layers in CSS `preserve-3d` (radial gold underglow at −80px, a blurred echo ring at
−42px, the crisp SVG at 0), idly precessing ±7° over 22s, tilting toward the pointer on
desktop (`js/tilt.js`, transform-only, lerped in one rAF loop, `hover:hover`/`pointer:fine`
guarded). The tick ring rotates once per 5 minutes. Under `prefers-reduced-motion`
everything freezes into a static seal. The hero total lives in HTML type beside it, never
inside the SVG.

## Logo

One mark — the khatam (two rotated squares + center dot), gold stroke:
`logos/header.svg` (lockup) and `logos/favicon.svg` (two-square favicon). No raster logo,
no og:image; the site is `noindex`. The seal is the entire mark.

## Imagery

No photography. The identity is the gyroscope, the grain, and the numbers themselves.
The only gradients are structural: the scene's radial lift, plate lacquer, the chart's
faint gold area, and the gold button face. Nothing else glows except the chart line's
soft blur and the pill status dot.

## Layout posture

- Left-aligned product topbar; asymmetric hero (value left, gyroscope right; stacked and
  centered on mobile); one segmented stats plaque; 18px plates / 9–10px controls / 999px
  pills; sentence-case Fraunces headings with muted one-line subtitles; the hero eyebrow
  is the only tracked-caps element.
- Motion: gyroscope precession + pointer tilt, one hero entrance (rise + settle), hover
  lift on plates, active `scale(0.98)` on buttons — nothing else. All transform/opacity,
  eased with `cubic-bezier(0.22,1,0.36,1)`, fully disabled under reduced motion.
- Buttons: gold-faced primary (dark ink text), plate-quiet, terracotta-ghost danger;
  gold focus rings on everything interactive.

## Voice

Private, custodial, understated, precise. English only — Arabic script was removed by the
owner's decision (2026-07-06); do not reintroduce it. "Registry," "Ledger," "Members,"
"Portfolio history," "Family wealth, stewarded." No exclamation points, no growth verbs,
never "users" or "dashboard."

## What "good" looks like here

If a new artifact could be mistaken for a fintech dashboard or a neon "premium dark mode"
template, it has drifted. The tell of this brand is one lit gold instrument in a dark
room — a single register-shift to Fraunces when a number really matters, and silence
everywhere else.
