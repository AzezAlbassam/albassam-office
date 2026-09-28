# Albassam · Falaj

Aziz's private family office: a unitized family fund plus a dividend "monthly
salary" calculator. Static site (GitHub Pages) + Firebase Firestore realtime
backend. No build step, no server.

- **The office:** `index.html`. Private: nothing loads until the owner signs in
  with Google (azizbassam2018@gmail.com). Firestore rules enforce it.
- `edit.html` redirects to `index.html` so old bookmarks keep working.
- **Demo:** `?demo=1` for seeded in-memory data (`&empty=1` shows the founding
  flow). Nothing is written to the database in demo mode.

## The page

1. The falaj hero: a 6-second film scrubbed by scroll (`js/scrub.js`), with a
   composed still hero on phones and under reduced motion.
2. The gate: set a blended yield; each member's monthly salary fills a basin.
   Base: money put in, today's value, or any amount. The mix: Saudi payers, US
   payers, sukuk, cash, with dated reference yields (`js/presets.js`).
3. What each person gets (payslips), How much would it take?, What America keeps
   (30% US withholding, no treaty for Saudi residents), Zakat before the salary
   (per-member modes), If companies cut, Spend it or let it grow?, Are we eating
   the spring?, Worth the risk? (government sukuk benchmark).
4. The registry: deposits, withdrawals, members, revaluation, history, ledger
   with edit and undo, backup.

## Accounting model

A unitized fund, in `js/model.js`: USD as integer cents, units as integer
micro-units, ownership % derived and shown with largest-remainder rounding.
Salary math is in `js/calc.js`. Tests run in the browser:
`tests/model.test.html` (24) and `tests/calc.test.html` (18).

## Firestore layout (project `albassam-fund`)

```
familyOffice/office                    config: marketValueCents, totalUnitsMicro, fxRate, zakatPct
familyOffice/office/members/{id}       name, unitsMicro, netContributedCents, createdAt
familyOffice/office/ledger/{id}        type, memberId?, memberName?, amountCents,
                                       unitsDeltaMicro, note?, dateLabel?, at
familyOffice/office/history/{date}     date, valueCents
familyOffice/office/plan/current       the calculator's saved settings (mix, zakat modes, targets)
```

Reads and writes both require the owner's verified Google account. Firestore has
one ruleset per project: `firestore.rules` covers BOTH apps sharing it (`/trades`
and `/meta` for the fund tracker, public reads; `/familyOffice` for this app,
private). Keep it identical in both repos; deploy with
`firebase deploy --only firestore:rules`.

## Backup

Registry, Backup, Export JSON downloads everything, including the plan. Import
shows a summary and asks before replacing anything.
