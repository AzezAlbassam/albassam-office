// ============================================================
// The sluice: pure dividend-salary math on top of the unitized
// model. Every function takes plain numbers/objects and returns
// plain numbers/objects; nothing here touches storage or DOM.
//
// Units: USD dollars (floats) for planning math; percentages are
// passed as percent numbers (5 = 5%). SAR = USD × fxRate.
// ============================================================

import * as M from "./model.js";

export const HIJRI_RATE = 0.025;
export const GREGORIAN_RATE = 0.025 * 365 / 354;   // ZATCA Art. 15(2): 2.5777%

export const BUCKETS = [
  { key: "saudi", label: "Saudi dividend payers", whtPct: 0 },
  { key: "us", label: "US dividend payers", whtPct: 30 },
  { key: "sukuk", label: "Sukuk", whtPct: 0 },
  { key: "cash", label: "Cash", whtPct: 0 },
];

export function defaultPlan() {
  return {
    base: "put",                  // "now" | "put" | "custom"
    customUSD: 250000,
    rateBasis: "hijri",           // "hijri" | "gregorian"
    mix: {
      saudi: { alloc: 50, yieldPct: 5.0 },
      us: { alloc: 50, yieldPct: 3.17 },
      sukuk: { alloc: 0, yieldPct: 3.69 },
      cash: { alloc: 0, yieldPct: 0 },
    },
    whtUSPct: 30,
    cutPct: { saudi: 30, us: 30, sukuk: 0, cash: 0 },
    growthPct: 3,
    inflationPct: 2,
    years: 10,
    sukukBenchPct: 5.53,
    members: {},                  // id -> member settings, see memberPlan()
  };
}

export function memberPlan(plan, id) {
  return {
    zakatMethod: "assets",        // "full" | "assets" | "held" | "none"
    zakatK: 30,                   // % of value that is zakatable (method "assets")
    saudiCompanyPays: true,       // Saudi-listed investor shares: company pays via ZATCA
    targetSAR: 5000,
    allowanceSAR: 0,
    ...((plan.members || {})[id] || {}),
  };
}

// ---------- bases ----------

// Each member's slice of the base, in USD.
export function slices(state, plan) {
  const vals = M.memberValuesCents(state);
  const tot = state.totalUnitsMicro || 1;
  return state.members.map((m, i) => {
    let usd;
    if (plan.base === "now") usd = vals[i] / 100;
    else if (plan.base === "put") usd = m.unitsMicro > 0 ? Math.max(0, m.netContributedCents) / 100 : 0;
    else usd = (plan.customUSD || 0) * (m.unitsMicro / tot);
    return { id: m.id, name: m.name, usd };
  });
}

// ---------- the mix ----------

export function allocTotal(plan) {
  return BUCKETS.reduce((a, b) => a + (+plan.mix[b.key].alloc || 0), 0);
}

export function allocOk(plan) {
  return Math.abs(allocTotal(plan) - 100) < 1e-6;
}

function wht(plan, key) {
  return key === "us" ? (+plan.whtUSPct || 0) / 100 : 0;
}

// Blended yields as fractions of the slice, per year.
export function blended(plan, cuts) {
  let gross = 0, net = 0, leak = 0;
  for (const b of BUCKETS) {
    const a = (+plan.mix[b.key].alloc || 0) / 100;
    const cut = cuts ? (+cuts[b.key] || 0) / 100 : 0;
    const y = (+plan.mix[b.key].yieldPct || 0) / 100 * (1 - cut);
    const w = wht(plan, b.key);
    gross += a * y;
    leak += a * y * w;
    net += a * y * (1 - w);
  }
  return { gross, net, leak };
}

// ---------- zakat ----------

export function zakatRate(plan) {
  return plan.rateBasis === "gregorian" ? GREGORIAN_RATE : HIJRI_RATE;
}

// Annual zakat on one member's slice under their chosen method.
// Saudi shares held as investments owe nothing extra when the company
// already pays through ZATCA; sukuk and cash are always full value.
export function zakatAnnual(plan, sliceUSD, mp, rate) {
  if (mp.zakatMethod === "none") return 0;
  const r = rate || zakatRate(plan);
  let z = 0;
  for (const b of BUCKETS) {
    const v = sliceUSD * (+plan.mix[b.key].alloc || 0) / 100;
    if (b.key === "cash" || b.key === "sukuk") { z += v * r; continue; }
    if (b.key === "saudi" && mp.saudiCompanyPays) continue;
    if (mp.zakatMethod === "full") z += v * r;
    else if (mp.zakatMethod === "assets") z += v * (+mp.zakatK || 0) / 100 * r;
    // "held": zakat only on dividend cash still held on the zakat date,
    // which a monthly salary pays out; nothing on principal.
  }
  return z;
}

// Salaries are per Gregorian month. A Hijri zakat year is 354 days, so the
// amount to set aside per Gregorian year is the same on either basis:
// value x 2.5% x 365/354. The basis only changes the "a year" figure.
export function zakatPerGregYear(plan, sliceUSD, mp) {
  return zakatAnnual(plan, sliceUSD, mp, GREGORIAN_RATE);
}

// ---------- the salary ----------

export function salaries(state, plan) {
  const fx = state.fxRate;
  const y = blended(plan);
  return slices(state, plan).map((s) => {
    const mp = memberPlan(plan, s.id);
    const gross = s.usd * y.gross / 12;
    const tax = s.usd * y.leak / 12;
    const zakat = zakatPerGregYear(plan, s.usd, mp) / 12;
    const net = gross - tax - zakat;
    const zakatYear = zakatAnnual(plan, s.usd, mp);
    return {
      id: s.id, name: s.name, sliceUSD: s.usd, zakatYearUSD: zakatYear, zakatYearSAR: zakatYear * fx,
      grossUSD: gross, taxUSD: tax, zakatUSD: zakat, netUSD: net,
      netSAR: net * fx, grossSAR: gross * fx, taxSAR: tax * fx, zakatSAR: zakat * fx,
      zakatCoverage: (gross - tax) > 0 ? (zakat / (gross - tax)) : (zakat > 0 ? Infinity : 0),
    };
  });
}

// ---------- how much would it take ----------

// Capital needed (USD) for a member's target monthly SAR salary, net of
// US tax and their zakat. Infinity when zakat eats the whole yield.
export function capitalNeeded(state, plan, id, targetSAR) {
  const mp = memberPlan(plan, id);
  const y = blended(plan);
  const zEff = zakatPerGregYear(plan, 1, mp);   // zakat per 1 USD of slice, per Gregorian year
  const perDollar = y.net - zEff;
  if (perDollar <= 0) return Infinity;
  return (12 * targetSAR / state.fxRate) / perDollar;
}

// The same target with no US tax at all: shows what the US cut costs.
export function capitalPenaltyPct(plan) {
  const w = (+plan.whtUSPct || 0) / 100;
  return w >= 1 ? Infinity : (1 / (1 - w) - 1) * 100;
}

// ---------- if companies cut ----------

export function floorSalaries(state, plan) {
  const fx = state.fxRate;
  const y = blended(plan, plan.cutPct);
  return slices(state, plan).map((s) => {
    const mp = memberPlan(plan, s.id);
    const net = s.usd * y.net / 12 - zakatPerGregYear(plan, s.usd, mp) / 12;
    return { id: s.id, name: s.name, netUSD: net, netSAR: net * fx };
  });
}

// ---------- spend it, or let it grow ----------

// Year-by-year monthly salary for one slice, after US tax and zakat
// (zPer = zakat per 1 USD per Gregorian year). Spend: the salary is taken
// and only prices grow the principal. Reinvest: what is left after tax and
// zakat buys more units. Real = in today's riyals after inflation.
export function snowball(sliceUSD, plan, fx, zPer = 0) {
  const y = blended(plan);
  const net = y.net - zPer;
  const g = (+plan.growthPct || 0) / 100;
  const inf = (+plan.inflationPct || 0) / 100;
  const years = Math.max(1, Math.min(40, Math.round(+plan.years || 10)));
  const rows = [];
  let spend = sliceUSD, grow = sliceUSD;
  for (let t = 0; t <= years; t++) {
    const deflate = Math.pow(1 + inf, t);
    const spendSAR = Math.max(0, spend * net) / 12 * fx;
    const growSAR = Math.max(0, grow * net) / 12 * fx;
    rows.push({ year: t, spendSAR, growSAR, spendRealSAR: spendSAR / deflate, growRealSAR: growSAR / deflate, growValueUSD: grow });
    // when zakat is larger than the dividend, the shortfall comes out of the money itself
    spend = Math.max(0, spend * (1 + g) + Math.min(0, spend * net));
    grow = Math.max(0, grow * (1 + g + net));
  }
  return rows;
}

// ---------- are we eating the spring ----------

// Months until a slice runs dry when a fixed monthly allowance (SAR) is
// taken, after US tax and zakat. Infinity when the spring keeps up.
export function monthsUntilDry(sliceUSD, plan, allowanceSAR, fx, zPer = 0) {
  const y = blended(plan);
  const g = (+plan.growthPct || 0) / 100;
  // dividends are paid out (a twelfth of the yearly net each month); only price growth compounds
  const r = (y.net - zPer) / 12 + (Math.pow(1 + g, 1 / 12) - 1);
  const draw = (+allowanceSAR || 0) / fx;
  if (!(sliceUSD > 0)) return 0;
  if (draw <= 0) return Infinity;   // with no draw a slice only shrinks toward zero, never reaches it
  if (r > 0 && draw <= sliceUSD * r) return Infinity;
  if (Math.abs(r) < 1e-12) return Math.ceil(sliceUSD / draw);
  const n = Math.log(draw / (draw - sliceUSD * r)) / Math.log(1 + r);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : Infinity;
}

// ---------- worth the risk ----------

// The same slice in government sukuk, after the member's zakat (sukuk are
// zakatable at full value; no US tax).
export function benchmarkMonthlySAR(sliceUSD, plan, fx, mp) {
  const z = mp && mp.zakatMethod === "none" ? 0 : GREGORIAN_RATE;
  return sliceUSD * ((+plan.sukukBenchPct || 0) / 100 - z) / 12 * fx;
}

// ---------- formatting ----------

const NF0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export function sar(v) { return (v < 0 ? "−" : "") + "SAR " + M.fmt2(Math.abs(v)); }
export function usd(v) { return (v < 0 ? "−$" : "$") + M.fmt2(Math.abs(v)); }
export function sarShort(v) { return "SAR " + NF0.format(Math.round(v)); }
export function pct(v, d = 2) { return v.toFixed(d) + "%"; }
export function duration(months) {
  if (!Number.isFinite(months)) return "never runs dry";
  const y = Math.floor(months / 12), m = months % 12;
  return (y ? `${y} year${y === 1 ? "" : "s"}` : "") + (y && m ? ", " : "") + (m ? `${m} month${m === 1 ? "" : "s"}` : "");
}
