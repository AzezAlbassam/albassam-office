// ============================================================
// ALBASSAM — PRIVATE FAMILY OFFICE
// Core accounting model: a shares fund.
//
// The family's rule (2026-10-07): shares follow the money put in.
//  - Money coming in buys shares at $1.00 each, whatever the fund is
//    worth today. So a newcomer's share is their money ÷ all money put
//    in, and past losses (or gains) are shared with them.
//  - Money going out cancels shares at today's price, so taking out
//    40% of what your share is worth shrinks your share by 40% and
//    leaves everyone else's money untouched.
//
// Invariants:
//  - USD amounts are stored as integer cents.
//  - Units are stored as integer micro-units (units × 1,000,000);
//    one unit = one dollar put in, so "put in" == units ÷ 1,000,000.
//  - Ownership % is always DERIVED: member units ÷ total units.
//  - Revaluation changes the fund's worth only; unit counts never move.
//  - Every mutation returns a ledger-ready description of itself.
//
// All functions are pure: they take a state snapshot and return
// { state, entry } without touching storage. The store layer is
// responsible for persisting atomically.
//
// State shape:
//   {
//     marketValueCents: int,
//     totalUnitsMicro:  int,
//     fxRate:  number   (USD → SAR, e.g. 3.75),
//     zakatPct: number  (e.g. 2.5),
//     members: [{ id, name, unitsMicro, netContributedCents, createdAt }]
//   }
// ============================================================

export const MICRO = 1_000_000;

export class ModelError extends Error {
  constructor(message, data) { super(message); this.data = data || {}; }
}

// ---------- helpers ----------

export function assertCents(n, label) {
  if (!Number.isInteger(n) || n < 0) throw new ModelError(`${label || 'Amount'} must be a whole number of cents ≥ 0.`);
}

function clone(state) {
  return {
    ...state,
    members: state.members.map((m) => ({ ...m })),
  };
}

function findMember(state, id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) throw new ModelError('That person is no longer in the fund.');
  return m;
}

let uidCounter = 0;
export function newId() {
  uidCounter += 1;
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + uidCounter.toString(36);
}

// Largest-remainder allocation: split `total` (integer) across
// `weights` (non-negative numbers) so parts are integers summing
// exactly to `total`, each as close as possible to proportional.
export function allocateProportional(total, weights) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const base = raw.map(Math.floor);
  let leftover = total - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < order.length && leftover > 0; k++, leftover--) base[order[k].i] += 1;
  return base;
}

// ---------- derived values ----------

// NAV in cents per whole unit (float, display/derivation only).
export function navCentsPerUnit(state) {
  if (state.totalUnitsMicro <= 0) return 0;
  return state.marketValueCents / (state.totalUnitsMicro / MICRO);
}

// A member's current value in cents (integer, exact reconciliation:
// all member values sum to marketValueCents via largest remainder).
export function memberValuesCents(state) {
  return allocateProportional(
    state.marketValueCents,
    state.members.map((m) => m.unitsMicro),
  );
}

export function memberValueCents(state, memberId) {
  const i = state.members.findIndex((m) => m.id === memberId);
  if (i < 0) throw new ModelError('Member not found.');
  return memberValuesCents(state)[i];
}

export function maxWithdrawableCents(state, memberId) {
  return memberValueCents(state, memberId);
}

// Display percentages in hundredths of a percent (integers summing
// to 10000 == 100.00%), largest-remainder rounded.
export function displayPercentsBp2(state) {
  return allocateProportional(10000, state.members.map((m) => m.unitsMicro));
}

export function totalContributedCents(state) {
  return state.members.reduce((a, m) => a + m.netContributedCents, 0);
}

// ---------- mutations (pure) ----------

// One unit per dollar put in.
const UNITS_PER_CENT = MICRO / 100;

// Units to redeem for a USD amount at current NAV.
// Computed as amount × (totalUnitsMicro / marketValueCents) to stay
// well inside double precision, then rounded to integer micro-units.
function unitsForAmountMicro(state, amountCents) {
  return Math.round(amountCents * (state.totalUnitsMicro / state.marketValueCents));
}

// Establish the office. entries: [{ name, valueCents, contributedCents }]
// Opening NAV is $1.00/unit, so units = valueCents / 100.
export function found(entries, opts) {
  if (!entries.length) throw new ModelError('At least one founding member is required.');
  const seen = new Set();
  entries.forEach((e) => {
    if (!e.name || !e.name.trim()) throw new ModelError('Every founding member needs a name.');
    const key = e.name.trim().toLowerCase();
    if (seen.has(key)) throw new ModelError(`Duplicate member name: ${e.name.trim()}.`);
    seen.add(key);
    assertCents(e.valueCents, `${e.name}'s value`);
    assertCents(e.contributedCents, `${e.name}'s contributed capital`);
    if (e.valueCents <= 0) throw new ModelError(`${e.name}'s opening value must be above zero.`);
  });
  const now = (opts && opts.now) || Date.now();
  const members = entries.map((e) => ({
    id: newId(),
    name: e.name.trim(),
    unitsMicro: e.valueCents * (MICRO / 100),
    netContributedCents: e.contributedCents,
    createdAt: now,
  }));
  const marketValueCents = entries.reduce((a, e) => a + e.valueCents, 0);
  const state = {
    marketValueCents,
    totalUnitsMicro: members.reduce((a, m) => a + m.unitsMicro, 0),
    fxRate: (opts && opts.fxRate) || 3.75,
    zakatPct: (opts && opts.zakatPct) != null ? opts.zakatPct : 2.5,
    members,
  };
  return {
    state,
    entry: { type: 'founding', amountCents: marketValueCents, unitsDeltaMicro: state.totalUnitsMicro },
  };
}

// Money in buys shares at $1.00 each (the family's rule), not at
// today's price.
export function deposit(state, memberId, amountCents) {
  assertCents(amountCents);
  if (amountCents <= 0) throw new ModelError('The amount must be above zero.');
  const s = clone(state);
  const m = findMember(s, memberId);
  const issued = amountCents * UNITS_PER_CENT;
  m.unitsMicro += issued;
  m.netContributedCents += amountCents;
  s.totalUnitsMicro += issued;
  s.marketValueCents += amountCents;
  return {
    state: s,
    entry: { type: 'deposit', memberId, memberName: m.name, amountCents, unitsDeltaMicro: issued },
  };
}

export function withdraw(state, memberId, amountCents) {
  assertCents(amountCents);
  if (amountCents <= 0) throw new ModelError('The amount must be above zero.');
  const s = clone(state);
  const m = findMember(s, memberId);
  const max = maxWithdrawableCents(s, memberId);
  if (amountCents > max) {
    throw new ModelError(
      `That's more than ${m.name}'s share is worth. The most they can take out is $${fmt2(max / 100)}.`,
      { maxWithdrawableCents: max },
    );
  }
  // Full redemption: hand over every unit so no dust remains.
  const redeemed = amountCents === max ? m.unitsMicro : unitsForAmountMicro(s, amountCents);
  m.unitsMicro -= redeemed;
  m.netContributedCents = Math.round(m.unitsMicro / UNITS_PER_CENT);   // put in shrinks with the share
  s.totalUnitsMicro -= redeemed;
  s.marketValueCents -= amountCents;
  return {
    state: s,
    entry: { type: 'withdrawal', memberId, memberName: m.name, amountCents, unitsDeltaMicro: -redeemed },
  };
}

export function addMember(state, name, openingDepositCents, opts) {
  name = (name || '').trim();
  if (!name) throw new ModelError('Give the new person a name.');
  if (state.members.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
    throw new ModelError('Someone with that name is already in the fund.');
  }
  assertCents(openingDepositCents, 'Opening deposit');
  if (openingDepositCents <= 0) throw new ModelError('The amount must be above zero.');
  const s = clone(state);
  const member = {
    id: newId(),
    name,
    unitsMicro: 0,
    netContributedCents: 0,
    createdAt: (opts && opts.now) || Date.now(),
  };
  s.members.push(member);
  const dep = deposit(s, member.id, openingDepositCents);
  return {
    state: dep.state,
    entry: {
      type: 'member-added', memberId: member.id, memberName: name,
      amountCents: openingDepositCents, unitsDeltaMicro: dep.entry.unitsDeltaMicro,
    },
  };
}

// Delete with zero balance only.
export function removeMemberZero(state, memberId) {
  const s = clone(state);
  const m = findMember(s, memberId);
  const val = memberValueCents(s, memberId);
  if (val !== 0 || m.unitsMicro !== 0) {
    throw new ModelError(
      `${m.name}'s share is still worth $${fmt2(val / 100)}. Pay it out, or give the share to the others.`,
      { balanceCents: val },
    );
  }
  s.members = s.members.filter((x) => x.id !== memberId);
  return { state: s, entry: { type: 'member-removed', memberId, memberName: m.name, amountCents: 0, unitsDeltaMicro: 0 } };
}

// Delete by redeeming the member's full balance as a withdrawal.
export function removeMemberRedeem(state, memberId) {
  const s0 = clone(state);
  const m = findMember(s0, memberId);
  const val = memberValueCents(s0, memberId);
  let s = s0, wEntry = null;
  if (val > 0) {
    const w = withdraw(s0, memberId, val);
    s = w.state; wEntry = w.entry;
  }
  s.totalUnitsMicro -= s.members.find((x) => x.id === memberId).unitsMicro;   // 0 after a full payout
  s.members = s.members.filter((x) => x.id !== memberId);
  return {
    state: s,
    entry: {
      type: 'member-removed-redeemed', memberId, memberName: m.name,
      amountCents: val, unitsDeltaMicro: wEntry ? wEntry.unitsDeltaMicro : 0,
    },
  };
}

// Delete by reassigning the member's units pro-rata to the others.
export function removeMemberReassign(state, memberId) {
  const s = clone(state);
  const m = findMember(s, memberId);
  const others = s.members.filter((x) => x.id !== memberId);
  const holders = others.filter((x) => x.unitsMicro > 0);
  if (!holders.length) throw new ModelError("No one else holds a share. Pay it out instead.");
  const val = memberValueCents(s, memberId);
  const shares = allocateProportional(m.unitsMicro, holders.map((o) => o.unitsMicro));
  holders.forEach((o, i) => { o.unitsMicro += shares[i]; });
  // Their money put in moves with the share, so put in keeps matching shares.
  const contrib = allocateProportional(Math.max(0, m.netContributedCents), holders.map((o) => o.unitsMicro));
  holders.forEach((o, i) => { o.netContributedCents += contrib[i]; });
  s.members = others;
  return {
    state: s,
    entry: {
      type: 'member-removed-reassigned', memberId, memberName: m.name,
      amountCents: val, unitsDeltaMicro: 0,
      note: `${m.name}'s share given to the other ${holders.length === 1 ? 'person' : holders.length + ' people'}`,
    },
  };
}

export function revalue(state, newMarketValueCents) {
  assertCents(newMarketValueCents, 'Market value');
  if (newMarketValueCents <= 0) throw new ModelError("The fund's worth must be above zero.");
  if (state.totalUnitsMicro <= 0) throw new ModelError('Add a person first: no one holds a share yet.');
  const s = clone(state);
  const prev = s.marketValueCents;
  s.marketValueCents = newMarketValueCents;
  return {
    state: s,
    entry: {
      type: 'revaluation', amountCents: newMarketValueCents, unitsDeltaMicro: 0,
      note: `from $${fmt2(prev / 100)} to $${fmt2(newMarketValueCents / 100)}`,
    },
  };
}

// Undo and correct are exact only when nothing moved money or the fund's
// worth after the record: every later move was priced with it in place.
const LATER_MOVES = ['founding', 'deposit', 'withdrawal', 'member-added', 'member-removed-redeemed',
  'member-removed-reassigned', 'revaluation', 'import'];
export function hasLaterMoves(ledger, entry) {
  return ledger.some((x) => x.id !== entry.id && x.atMs > entry.atMs && LATER_MOVES.includes(x.type));
}

// Reverse a ledger entry's effect exactly (undo). Only movements
// that recorded an exact unit delta are reversible — the reversal
// uses the stored units, so it is exact even after later
// revaluations. Returns { state, removedMemberId? }.
export function reverseEntry(state, entry) {
  const t = entry.type;
  if (t === "deposit" || t === "member-added") {
    const s = clone(state);
    const m = s.members.find((x) => x.id === entry.memberId);
    if (!m) throw new ModelError("That person is no longer in the fund, so this can't be undone.");
    const units = entry.unitsDeltaMicro;
    if (!Number.isInteger(units) || units <= 0) throw new ModelError("This record can't be undone.");
    if (m.unitsMicro < units) {
      throw new ModelError(`${m.name}'s share is now smaller than this added. Take money out instead.`);
    }
    // Money and shares must reach zero together, or someone is left owning
    // money with no share (or a share of nothing).
    const mvAfter = s.marketValueCents - entry.amountCents;
    if (mvAfter < 0 || (mvAfter === 0) !== (s.totalUnitsMicro - units === 0)) {
      throw new ModelError("The fund's worth has changed too much since then to undo this. Take money out instead.");
    }
    m.unitsMicro -= units;
    m.netContributedCents -= entry.amountCents;
    s.totalUnitsMicro -= units;
    s.marketValueCents = mvAfter;
    if (t === "member-added" && m.unitsMicro === 0) {
      s.members = s.members.filter((x) => x.id !== m.id);
      return { state: s, removedMemberId: m.id };
    }
    return { state: s };
  }
  if (t === "withdrawal") {
    const s = clone(state);
    const m = s.members.find((x) => x.id === entry.memberId);
    if (!m) throw new ModelError("That person is no longer in the fund, so this can't be undone.");
    const units = -entry.unitsDeltaMicro;
    if (!Number.isInteger(units) || units <= 0) throw new ModelError("This record can't be undone.");
    m.unitsMicro += units;
    m.netContributedCents = Math.round(m.unitsMicro / UNITS_PER_CENT);
    s.totalUnitsMicro += units;
    s.marketValueCents += entry.amountCents;
    return { state: s };
  }
  throw new ModelError("Only money in, money out and new people can be undone.");
}

export function updateSettings(state, { fxRate, zakatPct }) {
  const s = clone(state);
  const notes = [];
  if (fxRate != null) {
    if (!(fxRate > 0)) throw new ModelError('FX rate must be above zero.');
    notes.push(`USD→SAR ${s.fxRate} → ${fxRate}`);
    s.fxRate = fxRate;
  }
  if (zakatPct != null) {
    if (!(zakatPct >= 0)) throw new ModelError('Zakat rate cannot be negative.');
    notes.push(`zakat ${s.zakatPct}% → ${zakatPct}%`);
    s.zakatPct = zakatPct;
  }
  if (!notes.length) throw new ModelError('Nothing to change.');
  return { state: s, entry: { type: 'settings', amountCents: 0, unitsDeltaMicro: 0, note: notes.join(', ') } };
}

// ---------- formatting ----------

const NF2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmt2(n) { return NF2.format(n); }
export function fmtUSD(cents) { return (cents < 0 ? '−$' : '$') + NF2.format(Math.abs(cents) / 100); }
export function fmtSAR(cents, fxRate) { return NF2.format(Math.abs((cents / 100) * fxRate)) + ' SAR'; }
export function fmtPctBp2(bp2) { return (bp2 / 100).toFixed(2) + '%'; }

// Parse a user-typed USD amount ("25,000.5" → 2500050 cents).
export function parseUSDToCents(text) {
  const t = String(text || '').replace(/[$,\s]/g, '');
  if (!t || !/^\d*\.?\d*$/.test(t) || t === '.') throw new ModelError('Type an amount in dollars, like 25,000.');
  const v = Math.round(parseFloat(t) * 100);
  if (!Number.isFinite(v)) throw new ModelError('Type an amount in dollars, like 25,000.');
  return v;
}

export function zakatCents(valueCents, zakatPct) {
  return Math.round(valueCents * (zakatPct / 100));
}
