---
name: "Albassam — Private Family Office"
category: Brands
surface: web
colors:
  obsidian: "#0a0c0f"
  panel: "#14171c"
  ivory: "#eae6dd"
  stone: "#9c968a"
  line: "#23272e"
  gold: "#c8a96e"
  terracotta-loss: "#c25e4c"
---

# Albassam — Private Family Office

> Category: Brands

> Surface: web

*ALBASSAM*

A private family office ledger — obsidian ground, brushed-gold seal, tabular-numeral portfolio history for members of the Albassam family.

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Obsidian | `#0a0c0f` | page canvas — near-black ground (measured from --obsidian, used on <body> and input fields) |
| surface | Panel | `#14171c` | cards, stat tiles, member panels — raised surface over obsidian (measured from --panel, paired with a --panel-2 #191D23 for modal surfaces one step brighter) |
| foreground | Ivory | `#eae6dd` | primary body text and ledger figures (measured from --ivory; headline/emphasis text steps up to --ivory-bright #F2EEE4) |
| muted | Stone | `#9c968a` | secondary text — dt labels, captions, footnote copy (measured from --stone) |
| border | Line | `#23272e` | hairlines, dividers, input borders (measured from --line; card edges use a softer --line-soft #1C2026 one step down) |
| accent | Gold | `#c8a96e` | the brand's signal color — wordmark, seal, section eyebrows, primary buttons, positive brand emphasis (56 occurrences in the stylesheet, by far the most-used literal) |
| accent-secondary | Terracotta / Loss | `#c25e4c` | negative figures, destructive actions, danger states only (measured from --loss; reserved exclusively for loss/decrease semantics, never decorative) |

## Typography
- **Display:** Marcellus — weights 400 — fallbacks: Times New Roman, serif
- **Body:** Inter — weights 400, 500, 600 — fallbacks: -apple-system, Segoe UI, system-ui, sans-serif
- **Mono:** Fraunces — weights 300, 400 — fallbacks: Georgia, serif

## Voice & Tone

- **Adjectives:** private, custodial, understated, precise, ceremonial
- **Tone:** Quiet-luxury and custodial rather than corporate-SaaS: the copy reads like the ledger of an old family office, not a fintech dashboard. Short, formal nouns (Registry, Ledger, Members, Portfolio history) stand in for feature names. No exclamation points, no growth-hacking verbs, no casual contractions. The Arabic subtitle beneath the English wordmark (مكتب عائلة البسّام) signals heritage and is treated as co-equal identity, not a translation afterthought.

### Messaging pillars
- ALBASSAM
- Members ·
- Portfolio history
- Ledger

### Vocabulary
- **Use:** registry, ledger, members, stewarded, family office, portfolio history
- **Avoid:** dashboard, users, clients, app, exclamation points, growth/marketing verbs ("unlock", "supercharge")

## Imagery

- **Style:** No photography anywhere on the site — the entire visual identity is a single line-art heraldic seal (concentric rotated squares + center dot) rendered in 1px gold strokes on the obsidian ground.
- **Subjects:** the geometric seal/compass mark, tabular financial figures set in Fraunces
- **Treatment:** Thin 1px linework only, generous negative space, perfect bilateral symmetry, one slow 240s ambient rotation on the seal (disabled under prefers-reduced-motion). No gradients, no texture, no iconography per heading.
- **Avoid:** photography, human figures/faces, stock illustration, emoji or icon packs, gradients, drop shadows

## Layout

- **Radius:** 14px cards / 9px controls / 999px pills
- **Border weight:** 1px
- **Spacing:** 4px base unit; 14–22px component padding; 42–70px section rhythm

### Posture rules
- Centered, symmetrical masthead with extreme letter-spacing (.3em on the wordmark, .32em on its descriptor) — ceremonial, not a left-aligned corporate nav.
- Uppercase, heavily tracked (.14em–.28em) micro-labels for every section heading and status pill; hairline rules flank each h2 instead of an icon.
- Two-tier radius system: 14px for content cards (stat/member/panel), a tighter 9px for interactive controls (buttons/inputs), 999px pills for status chips — never one global radius.
- Two distinct numeral registers: tabular Inter for UI copy and dates, Fraunces serif numerals reserved for the figures that matter (stat values, percentages, ledger amounts) — a deliberate typographic shift that marks financial significance.
- Semantic color is rationed: gold marks brand/primary/positive emphasis, emerald #58A47C is reserved solely for gains, terracotta #C25E4C solely for losses/danger — none of the three is ever used decoratively outside its meaning.
- Motion is a single restrained flourish: one 240s slow-rotating seal, nothing else animates, and it is fully disabled under prefers-reduced-motion.
- Bilingual identity line (Arabic beneath the English wordmark) is structural, not incidental — reserve a line for it in any masthead treatment.
