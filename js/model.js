// ============================================================
// ALBASSAM — PRIVATE FAMILY OFFICE
// Core accounting model: a unitized fund (mutual-fund style).
//
// Invariants:
//  - USD amounts are stored as integer cents.
//  - Units are stored as integer micro-units (units × 1,000,000).
//  - Ownership % is always DERIVED: member units ÷ total units.
//  - Revaluation changes NAV per unit only; unit counts never move.
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
  if (!m) throw new ModelError('Member not found.');
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

// Units to issue/redeem for a USD amount at current NAV.
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

export function deposit(state, memberId, amountCents) {
  assertCents(amountCents);
  if (amountCents <= 0) throw new ModelError('Deposit must be above zero.');
  if (state.marketValueCents <= 0 || state.totalUnitsMicro <= 0) {
    throw new ModelError('Portfolio value is zero — revalue it above zero before recording deposits.');
  }
  const s = clone(state);
  const m = findMember(s, memberId);
  const issued = unitsForAmountMicro(s, amountCents);
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
  if (amountCents <= 0) throw new ModelError('Withdrawal must be above zero.');
  const s = clone(state);
  const m = findMember(s, memberId);
  const max = maxWithdrawableCents(s, memberId);
  if (amountCents > max) {
    throw new ModelError(
      `That exceeds ${m.name}'s balance. Maximum withdrawable: $${fmt2(max / 100)}.`,
      { maxWithdrawableCents: max },
    );
  }
  // Full redemption: hand over every unit so no dust remains.
  const redeemed = amountCents === max ? m.unitsMicro : unitsForAmountMicro(s, amountCents);
  m.unitsMicro -= redeemed;
  m.netContributedCents -= amountCents;
  s.totalUnitsMicro -= redeemed;
  s.marketValueCents -= amountCents;
  return {
    state: s,
    entry: { type: 'withdrawal', memberId, memberName: m.name, amountCents, unitsDeltaMicro: -redeemed },
  };
}

export function addMember(state, name, openingDepositCents, opts) {
  name = (name || '').trim();
  if (!name) throw new ModelError('Give the new member a name.');
  if (state.members.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
    throw new ModelError('A member with that name already exists.');
  }
  assertCents(openingDepositCents, 'Opening deposit');
  if (openingDepositCents <= 0) throw new ModelError('Opening deposit must be above zero.');
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
      `${m.name} still holds $${fmt2(val / 100)}. Choose: redeem their units as a withdrawal, or reassign them to the remaining members.`,
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
  if (!others.length) throw new ModelError('Cannot reassign — no remaining members. Redeem instead.');
  const val = memberValueCents(s, memberId);
  const shares = allocateProportional(m.unitsMicro, others.map((o) => o.unitsMicro));
  others.forEach((o, i) => { o.unitsMicro += shares[i]; });
  // Their contributed capital transfers pro-rata too, so total P/L reconciles.
  const contrib = allocateProportional(Math.max(0, m.netContributedCents), others.map((o) => o.unitsMicro));
  others.forEach((o, i) => { o.netContributedCents += contrib[i]; });
  s.members = others;
  return {
    state: s,
    entry: {
      type: 'member-removed-reassigned', memberId, memberName: m.name,
      amountCents: val, unitsDeltaMicro: 0,
      note: `${m.name}'s units reassigned pro-rata to ${others.length} member(s)`,
    },
  };
}

export function revalue(state, newMarketValueCents) {
  assertCents(newMarketValueCents, 'Market value');
  if (newMarketValueCents <= 0) throw new ModelError('Market value must be above zero.');
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

// Reverse a ledger entry's effect exactly (undo). Only movements
// that recorded an exact unit delta are reversible — the reversal
// uses the stored units, so it is exact even after later
// revaluations. Returns { state, removedMemberId? }.
export function reverseEntry(state, entry) {
  const t = entry.type;
  if (t === "deposit" || t === "member-added") {
    const s = clone(state);
    const m = s.members.find((x) => x.id === entry.memberId);
    if (!m) throw new ModelError("That member no longer exists, so the movement can't be reversed.");
    const units = entry.unitsDeltaMicro;
    if (!Number.isInteger(units) || units <= 0) throw new ModelError("This record carries no unit delta to reverse.");
    if (m.unitsMicro < units) {
      throw new ModelError(`${m.name} now holds less than this movement issued — record a withdrawal instead.`);
    }
    const mvAfter = s.marketValueCents - entry.amountCents;
    if (mvAfter < 0 || (mvAfter === 0 && s.totalUnitsMicro - units > 0)) {
      throw new ModelError("Reversing this would take the portfolio value below the remaining members' holdings.");
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
    if (!m) throw new ModelError("That member no longer exists, so the movement can't be reversed.");
    const units = -entry.unitsDeltaMicro;
    if (!Number.isInteger(units) || units <= 0) throw new ModelError("This record carries no unit delta to reverse.");
    m.unitsMicro += units;
    m.netContributedCents += entry.amountCents;
    s.totalUnitsMicro += units;
    s.marketValueCents += entry.amountCents;
    return { state: s };
  }
  throw new ModelError("Only deposits, withdrawals, and member admissions can be reversed.");
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
  if (!t || !/^\d*\.?\d*$/.test(t) || t === '.') throw new ModelError('Enter a valid USD amount.');
  const v = Math.round(parseFloat(t) * 100);
  if (!Number.isFinite(v)) throw new ModelError('Enter a valid USD amount.');
  return v;
}

export function zakatCents(valueCents, zakatPct) {
  return Math.round(valueCents * (zakatPct / 100));
}
