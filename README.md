# Albassam · Falaj

Aziz's private family fund. Static site (GitHub Pages) + Firebase Firestore
realtime backend. No build step, no server.

- **The fund:** `index.html`. Private: nothing loads until the owner signs in
  with Google (azizbassam2018@gmail.com). Firestore rules enforce it.
- `edit.html` redirects to `index.html` so old bookmarks keep working.
- **Demo:** `?demo=1` for seeded in-memory data (`&empty=1` starts empty).
  Nothing is written to the database in demo mode.

## The page

1. The falaj hero: a 6-second film scrubbed by scroll (`js/scrub.js`), with a
   still hero on phones and under reduced motion.
2. The fund: what it's worth today, and per person their share, money put in,
   worth today, and zakat a year (2.5% of worth).
3. Money in and out: add a person, add money, take money out. Each shows
   everyone's new share before saving.
4. History and backup (folded): every change, with correct and undo.

## The share rule (decided by the family, 2026-10-07)

Shares follow the money put in. In `js/model.js`:

- Money in buys shares at $1.00 each, whatever the fund is worth. A newcomer's
  share is their money divided by all money put in, so past losses (or gains)
  are shared with them. Example: Dad with $800,000 into a fund worth $4,474.83
  with $269,473 put in gets 74.80%.
- Money out cancels shares at today's price: taking out 40% of what your share
  is worth shrinks your share by 40%, and nobody else's money changes.
- Tests: `tests/model.test.html` (30), run in the browser.

## Firestore layout (project `albassam-fund`)

```
familyOffice/office                    config: marketValueCents, totalUnitsMicro, fxRate, zakatPct
familyOffice/office/members/{id}       name, unitsMicro (1 unit = $1 put in), netContributedCents, createdAt
familyOffice/office/ledger/{id}        type, memberId?, memberName?, amountCents,
                                       unitsDeltaMicro, note?, dateLabel?, at
familyOffice/office/history/{date}     date, valueCents (written on every new worth)
```

(`familyOffice/office/plan/current` is left over from the retired calculator and
is no longer read.)

Reads and writes both require the owner's verified Google account. Firestore has
one ruleset per project: `firestore.rules` covers BOTH apps sharing it (`/trades`
and `/meta` for the fund tracker, public reads; `/familyOffice` for this app,
private). Keep it identical in both repos; deploy with
`firebase deploy --only firestore:rules`.

## Backup

History and backup, Download a backup saves everything. Restore shows a summary
and asks before replacing anything; it is all or nothing.
