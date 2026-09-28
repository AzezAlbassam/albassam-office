// ============================================================
// The sluice UI: renders every calculator section from the
// current state + plan, and turns input into plan changes.
// Plan changes re-render at once and save (debounced) through
// the store, so every open device follows.
// ============================================================

import * as C from "./calc.js";
import { PRESETS } from "./presets.js";
import { esc } from "./render.js";

const $ = (id) => document.getElementById(id);
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(/[,\s$%]/g, "")); return Number.isFinite(n) ? n : d; };
const f2 = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let ctx = null;            // { getState, getPlan, updatePlan }

export function initCalc(context) {
  ctx = context;
  const up = (fn) => { const p = structuredClone(ctx.getPlan()); fn(p); ctx.updatePlan(p); };
  const mem = (p, id) => { p.members = p.members || {}; p.members[id] = { ...C.memberPlan(p, id), ...(p.members[id] || {}) }; return p.members[id]; };

  // the gate
  document.querySelectorAll("[data-base]").forEach((b) => b.addEventListener("click", () => up((p) => { p.base = b.dataset.base; })));
  $("custom-usd").addEventListener("change", () => up((p) => { p.customUSD = Math.max(0, num($("custom-usd").value, p.customUSD)); }));
  $("yield-range").addEventListener("input", () => up((p) => setBlendedYield(p, num($("yield-range").value))));

  // the mix
  $("mix-rows").addEventListener("change", (e) => {
    const row = e.target.closest("[data-bucket]");
    if (!row) return;
    const k = row.dataset.bucket;
    up((p) => {
      if (e.target.matches(".alloc")) p.mix[k].alloc = Math.max(0, Math.min(100, num(e.target.value)));
      if (e.target.matches(".yld")) p.mix[k].yieldPct = Math.max(0, Math.min(40, num(e.target.value)));
      if (e.target.matches(".preset") && e.target.value !== "") p.mix[k].yieldPct = +e.target.value;
    });
  });
  $("wht-us").addEventListener("change", () => up((p) => { p.whtUSPct = Math.max(0, Math.min(100, num($("wht-us").value, 30))); }));

  // how much would it take
  $("need-member").addEventListener("change", () => renderNeed());
  $("need-target").addEventListener("change", () => { if ($("need-member").value) up((p) => { mem(p, $("need-member").value).targetSAR = Math.max(0, num($("need-target").value)); }); });

  // zakat
  document.querySelectorAll("[data-rate]").forEach((b) => b.addEventListener("click", () => up((p) => { p.rateBasis = b.dataset.rate; })));
  $("zakat-rows").addEventListener("change", (e) => {
    const row = e.target.closest("[data-member]");
    if (!row) return;
    up((p) => {
      const m = mem(p, row.dataset.member);
      if (e.target.matches(".zmethod")) m.zakatMethod = e.target.value;
      if (e.target.matches(".zk")) m.zakatK = Math.max(0, Math.min(100, num(e.target.value, 30)));
      if (e.target.matches(".zsaudi")) m.saudiCompanyPays = e.target.checked;
    });
  });

  // if companies cut
  $("cut-saudi").addEventListener("input", () => up((p) => { p.cutPct = { ...p.cutPct, saudi: num($("cut-saudi").value) }; }));
  $("cut-us").addEventListener("input", () => up((p) => { p.cutPct = { ...p.cutPct, us: num($("cut-us").value) }; }));
  document.querySelectorAll("[data-cut-preset]").forEach((b) => b.addEventListener("click", () =>
    up((p) => { p.cutPct = { ...p.cutPct, saudi: +b.dataset.cutPreset }; })));

  // spend or grow
  $("grow-member").addEventListener("change", () => renderGrow());
  $("grow-years").addEventListener("input", () => up((p) => { p.years = num($("grow-years").value, 10); }));
  $("grow-g").addEventListener("input", () => up((p) => { p.growthPct = num($("grow-g").value, 3); }));
  $("grow-inf").addEventListener("input", () => up((p) => { p.inflationPct = num($("grow-inf").value, 2); }));

  // eating the spring
  $("burn-member").addEventListener("change", () => renderBurn());
  $("burn-allowance").addEventListener("change", () => { if ($("burn-member").value) up((p) => { mem(p, $("burn-member").value).allowanceSAR = Math.max(0, num($("burn-allowance").value)); }); });

  // worth the risk
  $("sukuk-bench").addEventListener("change", () => up((p) => { p.sukukBenchPct = Math.max(0, Math.min(40, num($("sukuk-bench").value, 5.53))); }));

  // toggle groups: one tab stop, arrow keys move the choice
  document.querySelectorAll('[role="radiogroup"]').forEach((g) => g.addEventListener("keydown", (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    const opts = [...g.querySelectorAll('[role="radio"]')];
    const i = opts.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = opts[(i + keys[e.key] + opts.length) % opts.length];
    next.click();
    next.focus();
  }));
}

function syncRadios(selector) {
  document.querySelectorAll(selector).forEach((b) => b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1);
}

// Scale every bucket's yield so the blended gross yield equals g%.
// The gate never goes to zero (min 0.25%), so the ratios between buckets
// survive any drag and come back exactly when the gate returns.
function setBlendedYield(p, g) {
  g = Math.max(0.25, g);
  const y = C.blended(p).gross * 100;
  if (y > 1e-9) {
    const k = g / y;
    for (const b of C.BUCKETS) p.mix[b.key].yieldPct = Math.min(40, p.mix[b.key].yieldPct * k);
    return;
  }
  let live = C.BUCKETS.filter((b) => b.key !== "cash" && p.mix[b.key].alloc > 0);
  if (!live.length) live = C.BUCKETS.filter((b) => p.mix[b.key].alloc > 0);
  const share = live.reduce((a, b) => a + p.mix[b.key].alloc, 0) / 100;
  if (share <= 0) return;
  live.forEach((b) => { p.mix[b.key].yieldPct = Math.min(40, g / share); });
}

// ---------- render everything ----------

export function renderCalc() {
  const state = ctx.getState();
  if (!state) return;
  const plan = ctx.getPlan();
  renderGate(state, plan);
  renderPayslips(state, plan);
  renderNeed();
  renderLeak(state, plan);
  renderZakat(state, plan);
  renderCut(state, plan);
  renderGrow();
  renderBurn();
  renderWorth(state, plan);
}

function setIfIdle(el, value) { if (el && document.activeElement !== el) el.value = value; }

function memberOptions(sel, state) {
  const prev = sel.value;
  sel.innerHTML = state.members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
  if (prev && state.members.some((m) => m.id === prev)) sel.value = prev;
}

// ---------- the gate ----------

function renderGate(state, plan) {
  document.querySelectorAll("[data-base]").forEach((b) => b.setAttribute("aria-checked", String(plan.base === b.dataset.base)));
  syncRadios("[data-base]");
  $("custom-wrap").hidden = plan.base !== "custom";
  setIfIdle($("custom-usd"), f2(plan.customUSD));

  const y = C.blended(plan);
  const g = y.gross * 100;
  setIfIdle($("yield-range"), g.toFixed(2));
  $("yield-out").textContent = g.toFixed(2) + "%";
  $("yield-net").textContent = `after US tax ${(y.net * 100).toFixed(2)}%`;
  document.querySelector(".gate-frame").style.setProperty("--lift", Math.min(1, g / 12).toFixed(3));

  const sal = C.salaries(state, plan);
  const n = sal.length;
  const ch = $("channels");
  const trunk = `M300 0 V28`;
  const branches = sal.map((_, i) => { const x = ((i + 0.5) / n) * 600; return `M300 28 C300 58 ${x} 46 ${x} 90`; });
  ch.innerHTML = [trunk, ...branches].map((d) => `<path d="${d}"/>`).join("") + [trunk, ...branches].map((d) => `<path class="flow" d="${d}"/>`).join("");
  ch.style.setProperty("--flow", Math.min(1, 0.15 + g / 8).toFixed(2));
  ch.style.setProperty("--flow-dur", `${Math.max(0.6, 3 - Math.round(g) * 0.22).toFixed(2)}s`);

  // pools fill against the most any member could get at the top of the gate
  const ref = Math.max(1, ...C.slices(state, plan).map((s) => s.usd)) * 0.12 / 12 * state.fxRate;
  const host = $("basins");
  host.style.setProperty("--n", n);
  if (host.children.length !== n) {
    host.innerHTML = sal.map((s) => `<div class="basin" data-id="${esc(s.id)}">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="floor" cx="60" cy="60" r="50"/><circle class="pool" cx="60" cy="60" r="48"/>
      <circle class="ripple" cx="60" cy="60" r="44"/><circle class="ripple r2" cx="60" cy="60" r="44"/><circle class="rim" cx="60" cy="60" r="52"/></svg>
      <div class="who"></div><div class="amt num"></div><div class="per"></div></div>`).join("");
  }
  sal.forEach((s, i) => {
    const b = host.children[i];
    b.querySelector(".who").textContent = s.name;
    b.querySelector(".amt").textContent = C.sar(s.netSAR);
    b.querySelector(".per").textContent = `a month · ${C.usd(s.netUSD)}`;
    const fill = Math.max(0.06, Math.min(1, Math.sqrt(Math.max(0, s.netSAR) / ref)));
    b.querySelector(".pool").style.setProperty("--fill", fill.toFixed(3));
  });
  const tot = sal.reduce((a, s) => a + s.netUSD, 0);
  $("family-total").textContent = C.sar(tot * state.fxRate);
  $("family-total-usd").textContent = C.usd(tot) + " a month";

  // the mix drawer
  const rows = $("mix-rows");
  if (!rows.children.length) {
    rows.innerHTML = C.BUCKETS.map((b) => `<div class="mix-row" data-bucket="${b.key}">
      <div class="name">${b.label}<small>${b.key === "us" ? "US tax withheld at source" : b.key === "cash" ? "Earns what you type" : "No tax for Saudi residents"}</small></div>
      <label>Share %<input type="text" inputmode="decimal" class="alloc" aria-label="${b.label}: share of the money, percent"></label>
      <label>Yield %<input type="text" inputmode="decimal" class="yld" aria-label="${b.label}: yield, percent a year"></label>
      <label class="preset-wrap">Reference yields<select class="preset" aria-label="${b.label}: reference yields to try"><option value="">Pick one to try</option>${(PRESETS[b.key] || []).map((p) =>
        `<option value="${p.yieldPct}">${esc(p.label)} · ${p.yieldPct.toFixed(2)}% · ${esc(p.freq)} · ${p.asOf}${p.note ? " · " + esc(p.note) : ""}</option>`).join("")}</select></label>
    </div>`).join("");
  }
  C.BUCKETS.forEach((b) => {
    const row = rows.querySelector(`[data-bucket="${b.key}"]`);
    setIfIdle(row.querySelector(".alloc"), String(+plan.mix[b.key].alloc));
    setIfIdle(row.querySelector(".yld"), (+plan.mix[b.key].yieldPct).toFixed(2));
    if (document.activeElement !== row.querySelector(".preset")) row.querySelector(".preset").value = "";
  });
  const at = C.allocTotal(plan);
  const ok = C.allocOk(plan);
  const tEl = $("alloc-total");
  tEl.textContent = ok ? "Shares add up to 100%" : `Shares add up to ${+at.toFixed(2)}%. Set them to 100% to count every riyal.`;
  tEl.classList.toggle("bad", !ok);
  setIfIdle($("wht-us"), String(+plan.whtUSPct));
  $("mix-summary").textContent = C.BUCKETS.filter((b) => +plan.mix[b.key].alloc > 0)
    .map((b) => `${+(+plan.mix[b.key].alloc).toFixed(2)}% ${b.label.split(" ")[0]} at ${(+plan.mix[b.key].yieldPct).toFixed(2)}%`).join(", ");
}

// ---------- payslips ----------

function renderPayslips(state, plan) {
  const sal = C.salaries(state, plan);
  $("payslips").innerHTML = sal.map((s) => `<article class="slip">
    <h3 class="who">${esc(s.name)}</h3>
    <dl>
      <dt>Dividends</dt><dd>${C.sar(s.grossSAR)}</dd>
      <dt>US tax</dt><dd class="minus">${s.taxSAR > 0.004 ? "−" + C.sar(s.taxSAR) : C.sar(0)}</dd>
      <dt>Zakat set aside</dt><dd class="minus">${s.zakatSAR > 0.004 ? "−" + C.sar(s.zakatSAR) : C.sar(0)}</dd>
    </dl>
    <div class="net"><span>Lands in the account</span><b>${C.sar(s.netSAR)}</b></div>
    <div class="usd">${C.usd(s.netUSD)} a month</div>
    ${s.zakatCoverage >= 1 ? `<p class="warn">Zakat is larger than what this share earns after tax. See zakat below.</p>` : ""}
  </article>`).join("");
}

// ---------- how much would it take ----------

function renderNeed() {
  const state = ctx.getState(); if (!state) return;
  const plan = ctx.getPlan();
  memberOptions($("need-member"), state);
  const id = $("need-member").value;
  if (!id) { $("need-out").innerHTML = ""; return; }
  const mp = C.memberPlan(plan, id);
  setIfIdle($("need-target"), f2(mp.targetSAR));
  const capUSD = C.capitalNeeded(state, plan, id, mp.targetSAR);
  const slice = C.slices(state, plan).find((s) => s.id === id).usd;
  const name = esc(state.members.find((m) => m.id === id).name);
  if (!Number.isFinite(capUSD)) {
    $("need-out").innerHTML = `<div class="stat-big"><div class="k">Not reachable at this mix</div><div class="v">Zakat and tax take the whole yield.</div><div class="s">Raise the yield at the gate or change ${name}'s zakat method.</div></div>`;
    return;
  }
  const gap = capUSD - slice;
  const fx = state.fxRate;
  $("need-out").innerHTML = `
    <div class="stat-big accent"><div class="k">${name} would need</div><div class="v">${C.sarShort(capUSD * fx)}</div><div class="s">${C.usd(capUSD)}</div></div>
    <div class="stat-big"><div class="k">${name} has now</div><div class="v">${C.sarShort(slice * fx)}</div><div class="s">${C.usd(slice)} · ${plan.base === "now" ? "today's value" : plan.base === "put" ? "money put in" : "your amount"}</div></div>
    <div class="stat-big"><div class="k">${gap > 0 ? "Still to go" : "Already there"}</div><div class="v">${gap > 0 ? C.sarShort(gap * fx) : "Covered"}</div><div class="s">${gap > 0 ? C.usd(gap) : C.usd(-gap) + " to spare"}</div></div>`;
}

// ---------- what America keeps ----------

function renderLeak(state, plan) {
  const pen = C.capitalPenaltyPct(plan);
  $("penalty").innerHTML = Number.isFinite(pen)
    ? `To pay the same salary, US money needs <b>${pen.toFixed(2)}% more</b> capital than Saudi money at the same yield.`
    : "At this tax rate US dividends pay nothing.";
  const sal = C.salaries(state, plan);
  if (+plan.mix.us.alloc <= 0) {
    $("leak").innerHTML = `<p class="note">No US money in the mix right now, so nothing is withheld. Add a US share at the gate to see the cut.</p>`;
    return;
  }
  $("leak").innerHTML = sal.map((s) => {
    const g = s.grossSAR > 0 ? s.grossSAR : 1;
    const lost = s.grossSAR > 0 ? s.taxSAR / g : 0;
    return `<div class="leak-row"><div class="top"><span class="who">${esc(s.name)}</span><span class="lost">${C.sar(s.taxSAR)} a month</span></div>
      <div class="bar"><i class="kept" style="--w:1"></i><i class="lost" style="--w:${lost.toFixed(4)}"></i></div>
      <div class="bar-legend">Kept ${((1 - lost) * 100).toFixed(1)}% · Taxed ${(lost * 100).toFixed(1)}% · ${C.sar(s.taxSAR * 12)} a year</div></div>`;
  }).join("");
}

// ---------- zakat ----------

function renderZakat(state, plan) {
  document.querySelectorAll("[data-rate]").forEach((b) => b.setAttribute("aria-checked", String((plan.rateBasis || "hijri") === b.dataset.rate)));
  syncRadios("[data-rate]");
  const yearWord = (plan.rateBasis || "hijri") === "hijri" ? "Zakat a Hijri year" : "Zakat a year";
  const sal = C.salaries(state, plan);
  const host = $("zakat-rows");
  if (host.children.length !== sal.length) {
    host.innerHTML = sal.map((s) => `<div class="z-row" data-member="${esc(s.id)}">
      <div class="who"></div>
      <div class="opts">
        <select class="zmethod" aria-label="Zakat method">
          <option value="full">Full market value</option>
          <option value="assets">Zakatable assets only</option>
          <option value="held">Only dividends still held on the zakat date</option>
          <option value="none">Leave zakat out</option>
        </select>
        <label class="kwrap">Zakatable share <input type="text" inputmode="decimal" class="zk">% of value</label>
        <label class="check"><input type="checkbox" class="zsaudi"> Saudi shares: the company already pays through ZATCA</label>
      </div>
      <div class="stat-big"><div class="k zyk">Zakat a year</div><div class="v zy"></div><div class="s zm"></div></div>
      <div class="stat-big accent"><div class="k">Salary after zakat</div><div class="v zs"></div><div class="s">a month</div></div>
      <p class="warn" hidden></p>
    </div>`).join("");
  }
  sal.forEach((s, i) => {
    const row = host.children[i];
    const mp = C.memberPlan(plan, s.id);
    row.dataset.member = s.id;
    row.querySelector(".who").textContent = s.name;
    row.querySelector(".zmethod").setAttribute("aria-label", `Zakat method for ${s.name}`);
    row.querySelector(".zk").setAttribute("aria-label", `Zakatable share of value for ${s.name}, percent`);
    row.querySelector(".zyk").textContent = yearWord;
    if (document.activeElement !== row.querySelector(".zmethod")) row.querySelector(".zmethod").value = mp.zakatMethod;
    setIfIdle(row.querySelector(".zk"), String(mp.zakatK));
    row.querySelector(".kwrap").hidden = mp.zakatMethod !== "assets";
    row.querySelector(".zsaudi").checked = !!mp.saudiCompanyPays;
    row.querySelector(".zy").textContent = C.sar(s.zakatYearSAR);
    row.querySelector(".zm").textContent = `${C.sar(s.zakatSAR)} set aside a month`;
    row.querySelector(".zs").textContent = C.sar(s.netSAR);
    const w = row.querySelector(".warn");
    w.hidden = !(s.zakatCoverage >= 1);
    w.textContent = "Zakat here is larger than the dividend after US tax, so the salary eats into the money itself.";
  });
}

// ---------- if companies cut ----------

function renderCut(state, plan) {
  const cut = plan.cutPct || { saudi: 30, us: 30 };
  setIfIdle($("cut-saudi"), String(cut.saudi || 0));
  setIfIdle($("cut-us"), String(cut.us || 0));
  $("cut-saudi-out").textContent = `${cut.saudi || 0}%`;
  $("cut-us-out").textContent = `${cut.us || 0}%`;
  const normal = C.salaries(state, plan);
  const floor = C.floorSalaries(state, plan);
  $("floors").innerHTML = floor.map((f, i) => {
    const n = normal[i].netSAR;
    const ratio = n > 0 ? Math.max(0, f.netSAR / n) : 0;
    return `<div class="floor-row"><span class="who">${esc(f.name)}</span>
      <div class="bar"><i class="kept" style="--w:${Math.min(1, ratio).toFixed(4)}"></i></div>
      <span class="nums"><b>${C.sar(f.netSAR)}</b> of ${C.sar(n)}</span></div>`;
  }).join("");
}

// ---------- spend or grow ----------

function renderGrow() {
  const state = ctx.getState(); if (!state) return;
  const plan = ctx.getPlan();
  memberOptions($("grow-member"), state);
  setIfIdle($("grow-years"), String(plan.years));
  setIfIdle($("grow-g"), String(plan.growthPct));
  setIfIdle($("grow-inf"), String(plan.inflationPct));
  $("grow-years-out").textContent = String(plan.years);
  $("grow-g-out").textContent = `${plan.growthPct}%`;
  $("grow-inf-out").textContent = `${plan.inflationPct}%`;
  const id = $("grow-member").value;
  const s = C.slices(state, plan).find((x) => x.id === id);
  if (!s) { $("grow-chart").innerHTML = ""; $("grow-line").textContent = ""; return; }
  const rows = C.snowball(s.usd, plan, state.fxRate, C.zakatPerGregYear(plan, 1, C.memberPlan(plan, id)));
  const W = 720, H = 240, pl = 70, pr = 20, pt = 16, pb = 30;
  const max = Math.max(1, ...rows.map((r) => r.growSAR));
  const X = (t) => pl + (t / (rows.length - 1)) * (W - pl - pr);
  const Y = (v) => H - pb - (v / max) * (H - pt - pb);
  const line = (key) => rows.map((r, i) => `${i ? "L" : "M"}${X(r.year).toFixed(1)},${Y(r[key]).toFixed(1)}`).join(" ");
  let g = "";
  for (let k = 0; k <= 3; k++) {
    const v = (max * k) / 3, y = Y(v);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(237,230,216,.08)"/><text x="${pl - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#A89A82">${Math.round(v).toLocaleString("en-US")}</text>`;
  }
  const step = Math.max(1, Math.ceil(rows.length / 10));
  rows.forEach((r, i) => { if (i % step === 0 || i === rows.length - 1) g += `<text x="${X(r.year).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#A89A82">yr ${r.year}</text>`; });
  $("grow-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly salary over the years: spending versus reinvesting" font-family="Hanken Grotesk, sans-serif">${g}
    <path d="${line("spendSAR")}" fill="none" stroke="#CDBB9C" stroke-width="2"/>
    <path d="${line("growSAR")}" fill="none" stroke="#7FD6C4" stroke-width="2.4"/>
    <path d="${line("growRealSAR")}" fill="none" stroke="#7FD6C4" stroke-width="1.4" stroke-dasharray="5 5" opacity=".7"/></svg>
    <div class="legend"><span><i style="background:#7FD6C4"></i>Let it grow</span><span><i style="background:#7FD6C4;opacity:.6"></i>Let it grow, in today's riyals</span><span><i style="background:#CDBB9C"></i>Spend it every month</span></div>`;
  const last = rows[rows.length - 1];
  const name = esc(state.members.find((m) => m.id === id).name);
  $("grow-line").innerHTML = `In ${last.year} years, if ${name} lets it grow, the salary reaches <b>${C.sar(last.growSAR)}</b> a month (${C.sar(last.growRealSAR)} in today's riyals). Spending it every month instead: ${C.sar(last.spendSAR)}.`;
}

// ---------- eating the spring ----------

function renderBurn() {
  const state = ctx.getState(); if (!state) return;
  const plan = ctx.getPlan();
  memberOptions($("burn-member"), state);
  const id = $("burn-member").value;
  const mp = C.memberPlan(plan, id);
  setIfIdle($("burn-allowance"), f2(mp.allowanceSAR));
  const s = C.slices(state, plan).find((x) => x.id === id);
  const out = $("burn-out");
  if (!s) { out.textContent = ""; return; }
  if (!(mp.allowanceSAR > 0)) { out.className = "burn-out"; out.textContent = "Type a monthly amount to see how long the share lasts."; return; }
  const m = C.monthsUntilDry(s.usd, plan, mp.allowanceSAR, state.fxRate, C.zakatPerGregYear(plan, 1, mp));
  if (!Number.isFinite(m)) { out.className = "burn-out safe"; out.textContent = "the share keeps up. The spring does not shrink."; }
  else { out.className = "burn-out dry"; out.textContent = `the share runs dry in ${C.duration(m)}.`; }
}

// ---------- worth the risk ----------

function renderWorth(state, plan) {
  setIfIdle($("sukuk-bench"), (+plan.sukukBenchPct).toFixed(2));
  const sal = C.salaries(state, plan);
  const slices = C.slices(state, plan);
  const rows = sal.map((s, i) => ({ s, suk: C.benchmarkMonthlySAR(slices[i].usd, plan, state.fxRate, C.memberPlan(plan, s.id)) }));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.s.netSAR, r.suk)));
  const bar = (v) => (Math.max(0, v) / max).toFixed(4);
  $("worth-rows").innerHTML = rows.map(({ s, suk }) => `<div class="worth-row">
    <div class="top"><span class="who">${esc(s.name)}</span><span class="note">${s.netSAR >= suk ? "The mix pays more" : "Sukuk would pay more"}</span></div>
    <div class="pair">
      <div><span>Your mix</span><span class="track"><i class="mixb" style="--w:${bar(s.netSAR)}"></i></span><span>${C.sar(s.netSAR)}</span></div>
      <div><span>Gov. sukuk</span><span class="track"><i class="sukb" style="--w:${bar(suk)}"></i></span><span>${C.sar(suk)}</span></div>
    </div></div>`).join("");
}
