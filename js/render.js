// ============================================================
// Rendering: the fund table, share previews, and the ledger.
// Pure DOM output; no storage or auth.
// ============================================================

import * as M from "./model.js";

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function el(id) { return document.getElementById(id); }


// ---------- the fund ----------

export function renderFund(state, editMode) {
  const host = el("members");
  el("fund-value").textContent = M.fmtUSD(state.marketValueCents);
  el("fund-value-sar").textContent = M.fmtSAR(state.marketValueCents, state.fxRate);
  if (!state.members.length) {
    host.innerHTML = `<div class="empty">No one in the fund yet. Add the first person below.</div>`;
    return;
  }
  const pcts = M.displayPercentsBp2(state);
  const vals = M.memberValuesCents(state);
  const zak = vals.map((v) => M.zakatCents(v, state.zakatPct));
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const row = (cls, who, share, bar, put, worth, z, btn) => `<div class="s-row ${cls}">
      <div class="who">${who}</div>
      <div class="share"><b>${share}</b>${bar}</div>
      <div class="cell"><div class="k">Put in</div><div class="v">${put}</div></div>
      <div class="cell"><div class="k">Worth today</div><div class="v">${worth}</div></div>
      <div class="cell"><div class="k">Zakat a year</div><div class="v">${z}</div></div>
      ${btn}
    </div>`;
  host.innerHTML = state.members.map((m, i) => row("",
    esc(m.name), M.fmtPctBp2(pcts[i]), `<div class="track"><i style="--w:${(pcts[i] / 10000).toFixed(4)}"></i></div>`,
    M.fmtUSD(m.netContributedCents), M.fmtUSD(vals[i]), M.fmtUSD(zak[i]),
    editMode ? `<button class="manage" data-manage="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">Remove</button>` : "<span></span>",
  )).join("") + row("total", "Everyone", "100.00%", "",
    M.fmtUSD(M.totalContributedCents(state)), M.fmtUSD(state.marketValueCents),
    `${M.fmtUSD(sum(zak))}<span class="sar">${M.fmtSAR(sum(zak), state.fxRate)}</span>`, "<span></span>");
}

// "After this: Dad 74.80% (worth $601,…) · Aziz 13.56% · …" for a
// state the user hasn't saved yet. `focusId` gets its worth shown.
export function shareLine(next, focusId) {
  const pcts = M.displayPercentsBp2(next);
  const vals = M.memberValuesCents(next);
  return "After this: " + next.members.map((m, i) => {
    const w = m.id === focusId ? ` (worth ${M.fmtUSD(vals[i])} today)` : "";
    return `${m.name} ${M.fmtPctBp2(pcts[i])}${w}`;
  }).join(" · ");
}

// ---------- ledger ----------

export const EDITABLE_TYPES = ["deposit", "withdrawal", "revaluation"];

export const TYPE_LABELS = {
  founding: "Start", deposit: "Money in", withdrawal: "Money out",
  "member-added": "New person", "member-removed": "Removed",
  "member-removed-redeemed": "Left, paid out", "member-removed-reassigned": "Left, share given",
  revaluation: "New worth", settings: "Settings", import: "Restore",
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
