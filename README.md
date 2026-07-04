# Albassam — Private Family Office

A private, live family-portfolio ledger. Static site (GitHub Pages) + Firebase
Firestore realtime backend. No build step, no server.

- **Family view (read-only):** `index.html` — live data, zero editing surface.
- **Registry (edit):** `edit.html` — requires Google sign-in as the steward's
  account. UI gating is cosmetic; **Firestore security rules are the real
  enforcement** (see `firestore.rules`).
- **Demo:** append `?demo=1` to either page for seeded in-memory data
  (`&empty=1` on the edit page exercises the first-run founding flow).
  Nothing is written to the database in demo mode.

## Accounting model

A unitized fund (mutual-fund style), implemented in `js/model.js`:

- USD stored as **integer cents**; units as **integer micro-units** (×10⁶).
  Opening NAV is $1.00/unit.
- Ownership % is always derived (member units ÷ total units) and displayed
  with largest-remainder rounding so shares always sum to 100.00%.
- Deposits/withdrawals issue/redeem units at the current NAV; revaluation
  changes NAV only — unit counts never change.
- Removing a member with a balance requires an explicit choice — redeem
  (recorded withdrawal) or pro-rata reassignment — both ledgered.
- `tests/model.test.html` runs the model test suite in the browser.

## Firestore layout (project `albassam-fund`)

```
familyOffice/office                    config: marketValueCents, totalUnitsMicro, fxRate, zakatPct
familyOffice/office/members/{id}       name, unitsMicro, netContributedCents, createdAt
familyOffice/office/ledger/{id}        type, memberId?, memberName?, amountCents,
                                       unitsDeltaMicro, note?, dateLabel?, at (server timestamp)
familyOffice/office/history/{date}     date, valueCents
```

Reads are public (the family link needs no login). Every write requires the
steward's verified Google account — enforced by `firestore.rules`.

**Important:** Firestore has one ruleset per project. `firestore.rules` here
contains the rules for BOTH apps sharing the project (`/trades` for the fund
tracker and `/familyOffice` for this app). Keep it identical in both repos;
deploy with:

```sh
firebase deploy --only firestore:rules
```

## Backup

Registry → Backup → **Export JSON** downloads the complete state (config,
members, history, full ledger). **Import** restores a backup after a
confirmation summary. Keep an exported copy somewhere safe periodically —
that file is everything.
