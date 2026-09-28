// ============================================================
// Registry rendering: the spring summary, members, the history
// line, and the ledger. Pure DOM output; no storage or auth.
// ============================================================

import * as M from "./model.js";

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function el(id) { return document.getElementById(id); }

const sign = (v) => (v >= 0 ? "+" : "−");

// ---------- the spring today ----------

export function renderStats(state) {
  const host = el("stats");
  if (!host) return;
  if (!state) { host.innerHTML = ""; return; }
  const mv = state.marketValueCents;
  const put = M.totalContributedCents(state);
  const pl = mv - put;
  const plPct = put > 0 ? (pl / put) * 100 : 0;
  const zakat = M.zakatCents(mv, state.zakatPct);
  host.innerHTML = `
    <div class="cell"><div class="k">Pool value today</div><div class="v">${M.fmtUSD(mv)}</div><div class="s">${M.fmtSAR(mv, state.fxRate)}</div></div>
    <div class="cell"><div class="k">Money put in</div><div class="v">${M.fmtUSD(put)}</div><div class="s">${M.fmtSAR(put, state.fxRate)}</div></div>
    <div class="cell"><div class="k">Profit or loss</div><div class="v ${pl >= 0 ? "gain" : "loss"}">${sign(pl)}${M.fmtUSD(Math.abs(pl))}</div><div class="s">${sign(pl)}${Math.abs(plPct).toFixed(2)}% on the money put in</div></div>
    <div class="cell"><div class="k">Zakat at ${esc(state.zakatPct)}% of value</div><div class="v">${M.fmtUSD(zakat)}</div><div class="s">${M.fmtSAR(zakat, state.fxRate)}</div></div>`;
}

export function springStrip(state) {
  const host = el("spring-strip");
  if (!host || !state) return;
  const put = M.totalContributedCents(state);
  host.innerHTML = `<span>Pool today<b>${M.fmtUSD(state.marketValueCents)}</b></span>
    <span>Money put in<b>${M.fmtUSD(put)}</b></span>
    <span>Members<b>${state.members.length}</b></span>`;
}

// ---------- members ----------

export function renderMembers(state, editMode) {
  const host = el("members");
  el("member-count").textContent = state ? `${state.members.length}` : "";
  if (!state || !state.members.length) { host.innerHTML = `<div class="empty">No members yet.</div>`; return; }
  const pcts = M.displayPercentsBp2(state);
  const vals = M.memberValuesCents(state);
  host.innerHTML = state.members.map((m, i) => {
    const v = vals[i];
    const pl = v - m.netContributedCents;
    const plPct = m.netContributedCents > 0 ? (pl / m.netContributedCents) * 100 : 0;
    return `<div class="m-row">
      <div class="who">${esc(m.name)}</div>
      <div class="share"><b>${M.fmtPctBp2(pcts[i])}</b><div class="track"><i style="--w:${(pcts[i] / 10000).toFixed(4)}"></i></div></div>
      <div class="cell"><div class="k">Value today</div><div class="v">${M.fmtUSD(v)}</div></div>
      <div class="cell"><div class="k">Put in</div><div class="v">${M.fmtUSD(m.netContributedCents)}</div></div>
      <div class="cell"><div class="k">Profit or loss</div><div class="v ${pl >= 0 ? "gain" : "loss"}">${sign(pl)}${M.fmtUSD(Math.abs(pl))} (${sign(pl)}${Math.abs(plPct).toFixed(2)}%)</div></div>
      ${editMode ? `<button class="manage" data-manage="${esc(m.id)}" aria-label="Manage ${esc(m.name)}">Manage</button>` : "<span></span>"}
    </div>`;
  }).join("");
}

// ---------- history line ----------

function shortDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function renderHistory(history, fxRate, editMode) {
  const host = el("chart");
  const H = history;
  if (!H.length) {
    host.innerHTML = `<div class="empty">No history yet. Add a dated value to start the line.</div>`;
    el("hist-list").innerHTML = "";
    return;
  }
  const Ht = 300, padL = 78, padR = 40, padT = 30, padB = 44;
  const W = Math.max(720, padL + padR + (H.length - 1) * 92);
  const vals = H.map((h) => h.valueCents / 100);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min *= 0.92; max = max * 1.08 || 10; }
  const span = max - min;
  min = Math.max(0, min - span * 0.1); max += span * 0.1;
  const xs = (i) => (H.length === 1 ? padL + (W - padL - padR) / 2 : padL + (i * (W - padL - padR)) / (H.length - 1));
  const ys = (v) => Ht - padB - ((v - min) / (max - min)) * (Ht - padT - padB);

  let s = `<defs><linearGradient id="wat" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7FD6C4" stop-opacity=".22"/><stop offset="1" stop-color="#7FD6C4" stop-opacity="0"/></linearGradient></defs>`;
  for (let g = 0; g <= 4; g++) {
    const v = max - ((max - min) * g) / 4, gy = ys(v);
    s += `<line x1="${padL}" x2="${W - padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="rgba(237,230,216,.08)"/>
      <text x="${padL - 10}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#A89A82">$${Math.round(v).toLocaleString("en-US")}</text>`;
  }
  const pts = H.map((h, i) => `${xs(i).toFixed(1)},${ys(h.valueCents / 100).toFixed(1)}`);
  if (H.length > 1) {
    s += `<path d="M${xs(0).toFixed(1)},${Ht - padB} L${pts.join(" L")} L${xs(H.length - 1).toFixed(1)},${Ht - padB} Z" fill="url(#wat)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="#7FD6C4" stroke-width="2"/>`;
  }
  H.forEach((h, i) => {
    const X = xs(i), Y = ys(h.valueCents / 100);
    const above = i % 2 === 0;
    const anchor = i === H.length - 1 ? "end" : i === 0 ? "start" : "middle";
    s += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="3.4" fill="#12312E" stroke="#7FD6C4" stroke-width="1.6"><title>${esc(h.date)} · ${M.fmtUSD(h.valueCents)}</title></circle>
      <text x="${X.toFixed(1)}" y="${(above ? Y - 13 : Y + 22).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="500" fill="#EDE6D8">$${Math.round(h.valueCents / 100).toLocaleString("en-US")}</text>
      <text x="${X.toFixed(1)}" y="${Ht - padB + 20}" text-anchor="${anchor}" font-size="10.5" fill="#A89A82">${esc(shortDate(h.date))}</text>`;
  });
  host.innerHTML = `<div class="chart-scroll"><svg viewBox="0 0 ${W} ${Ht}" style="min-width:${W}px" role="img" aria-label="Pool value over time" font-family="Hanken Grotesk, sans-serif">${s}</svg></div>`;
  const scroller = host.querySelector(".chart-scroll");
  scroller.scrollLeft = scroller.scrollWidth;

  el("hist-list").innerHTML = [...H].reverse().map((h) => `
    <div class="hist-row"><span>${esc(h.date)}</span>
      <span><span class="v">${M.fmtUSD(h.valueCents)}</span><span class="sar">${M.fmtSAR(h.valueCents, fxRate)}</span>
      ${editMode ? `<button class="del edit" data-hist-edit="${esc(h.id)}" aria-label="Edit ${esc(h.date)}">✎</button><button class="del" data-hist-del="${esc(h.id)}" aria-label="Delete ${esc(h.date)}">✕</button>` : ""}</span>
    </div>`).join("");
}

// ---------- ledger ----------

export const EDITABLE_TYPES = ["deposit", "withdrawal", "revaluation"];

export const TYPE_LABELS = {
  founding: "Founding", deposit: "Deposit", withdrawal: "Withdrawal",
  "member-added": "New member", "member-removed": "Removed",
  "member-removed-redeemed": "Removed, paid out", "member-removed-reassigned": "Removed, reassigned",
  revaluation: "Revaluation", settings: "Settings", import: "Restore",
};

export function renderLedger(ledger, editMode) {
  const host = el("ledger");
  if (!ledger.length) { host.innerHTML = `<div class="empty">Every movement will be recorded here.</div>`; return; }
  host.innerHTML = ledger.map((l) => {
    const when = new Date(l.atMs).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const who = l.memberName ? `<b>${esc(l.memberName)}</b>${l.note ? " · " : ""}` : "";
    const note = l.note ? esc(l.note) : "";
    let amt = "", cls = "";
    if (["deposit", "founding", "member-added"].includes(l.type)) { amt = "+" + M.fmtUSD(l.amountCents); cls = "gain"; }
    else if (["withdrawal", "member-removed-redeemed"].includes(l.type)) { amt = "−" + M.fmtUSD(l.amountCents); cls = "loss"; }
    else if (l.amountCents) amt = M.fmtUSD(l.amountCents);
    const whenLine = l.dateLabel ? `for ${esc(l.dateLabel)} · recorded ${when}` : when;
    return `<div class="ledger-row">
      <span class="what"><span class="tag">${TYPE_LABELS[l.type] || esc(l.type)}</span>${who}${note}<span class="when">${whenLine}</span></span>
      <span class="right"><span class="amt ${cls}">${amt}</span>${editMode && EDITABLE_TYPES.includes(l.type) ? `<button class="del edit" data-ledger-edit="${esc(l.id)}" aria-label="Correct this amount">✎</button>` : ""}${editMode ? `<button class="del" data-ledger-del="${esc(l.id)}" aria-label="Delete this record">✕</button>` : ""}</span>
    </div>`;
  }).join("");
}

// ---------- helpers ----------

export function populateMemberSelects(state) {
  document.querySelectorAll("select[data-members]").forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = (state ? state.members : []).map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
    if (prev && state && state.members.some((m) => m.id === prev)) sel.value = prev;
  });
}

export function feedback(id, text, isError) {
  const box = el(id);
  if (!box) return;
  box.textContent = text;
  box.className = "feedback " + (isError ? "err" : "ok");
  clearTimeout(box._t);
  if (text) box._t = setTimeout(() => { box.textContent = ""; box.className = "feedback"; }, 7000);
}
