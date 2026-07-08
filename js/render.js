// ============================================================
// Rendering. Pure DOM output from a snapshot + derived model
// state. No storage or auth logic lives here.
// ============================================================

import * as M from "./model.js";

const TONES = ["#C9A96A", "#E6D3A7", "#8F7443", "#D7BB82", "#A98D5B", "#6E5B38", "#F0E2C0", "#B89B68"];

export function tone(i) { return TONES[i % TONES.length]; }

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function el(id) { return document.getElementById(id); }

// ---------- hero ----------

export function renderHero(state) {
  const value = el("hero-value"), sar = el("hero-sar"), chips = el("hero-chips");
  if (!value) return;
  if (!state) {
    value.textContent = "Not yet established";
    sar.textContent = "The office opens with its founding members' first entry.";
    chips.innerHTML = "";
    return;
  }
  const mv = state.marketValueCents;
  value.textContent = M.fmtUSD(mv);
  sar.textContent = `≈ ${M.fmtSAR(mv, state.fxRate)} at ${state.fxRate} SAR / USD`;
  const pl = mv - M.totalContributedCents(state);
  const contributed = M.totalContributedCents(state);
  const plPct = contributed > 0 ? (pl / contributed) * 100 : 0;
  const sign = pl >= 0 ? "+" : "−";
  chips.innerHTML = `
    <span class="chip ${pl >= 0 ? "gain" : "loss"}">${sign}${M.fmtUSD(Math.abs(pl))} · ${sign}${Math.abs(plPct).toFixed(2)}% all time</span>
    <span class="chip neutral">Zakat ${M.fmtUSD(M.zakatCents(mv, state.zakatPct))}</span>`;
}

// ---------- the seal ----------

export function renderSeal(state) {
  const CX = 280, CY = 210, R = 150, C = 2 * Math.PI * R;
  let arcs = "", echoArcs = "", nodes = "", labels = "";

  if (state && state.totalUnitsMicro > 0) {
    const pcts = M.displayPercentsBp2(state);
    const n = state.members.length;
    const gap = n > 1 ? 12 : 0;
    let acc = 0;
    state.members.forEach((m, i) => {
      const frac = m.unitsMicro / state.totalUnitsMicro;
      const len = Math.max(frac * C - gap, 1.5);
      const dash = `stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${CX} ${CY})"`;
      arcs += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${tone(i)}" stroke-width="2.5" stroke-linecap="round" ${dash}/>`;
      echoArcs += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${tone(i)}" stroke-width="3.5" stroke-linecap="round" ${dash}/>`;
      const midFrac = (acc + (frac * C) / 2) / C;
      const a = -Math.PI / 2 + midFrac * 2 * Math.PI;
      const nx = CX + R * Math.cos(a), ny = CY + R * Math.sin(a);
      const initial = esc(m.name.trim().charAt(0).toUpperCase());
      nodes += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="13" fill="#14171D" stroke="${tone(i)}" stroke-width="1.3"/>
        <text x="${nx.toFixed(1)}" y="${(ny + 4).toFixed(1)}" text-anchor="middle" font-family="Fraunces,serif" font-size="12" fill="${tone(i)}">${initial}</text>`;
      const lx = CX + (R + 34) * Math.cos(a), ly = CY + (R + 34) * Math.sin(a);
      const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
      const dy = Math.sin(a) < -0.85 ? -6 : Math.sin(a) > 0.85 ? 12 : 0;
      labels += `<g class="seal-label"><text x="${lx.toFixed(1)}" y="${(ly - 3 + dy).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" font-weight="500" fill="#ECE7DC">${esc(m.name)}</text>
        <text x="${lx.toFixed(1)}" y="${(ly + 13 + dy).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" fill="#C9A96A">${M.fmtPctBp2(pcts[i])}</text></g>`;
      acc += frac * C;
    });
  }

  const mark = `
    <g transform="translate(${CX} ${CY})" aria-hidden="true">
      <rect x="-9" y="-9" width="18" height="18" fill="none" stroke="#C9A96A" stroke-width="1"/>
      <rect x="-9" y="-9" width="18" height="18" fill="none" stroke="#C9A96A" stroke-width="1" transform="rotate(45)"/>
      <circle r="2" fill="#C9A96A"/>
    </g>`;
  const center = state
    ? `${mark}<text x="${CX}" y="${CY + 34}" text-anchor="middle" font-size="13" fill="#A8A296">${state.members.length} member${state.members.length === 1 ? "" : "s"}</text>`
    : `${mark}<text x="${CX}" y="${CY + 34}" text-anchor="middle" font-size="13" fill="#938D81">Not yet established</text>`;

  el("seal").innerHTML = `
    <div class="gyro"><div class="gyro-idle">
      <div class="gyro-glow" aria-hidden="true"></div>
      <div class="gyro-echo" aria-hidden="true">
        <svg viewBox="0 0 560 420">
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#262B33" stroke-width="3.5"/>
          ${echoArcs}
        </svg>
      </div>
      <div class="gyro-main">
        <svg viewBox="0 0 560 420" role="img" aria-label="Family seal: member ownership shares drawn as arcs of one ring">
          <circle class="seal-spin" cx="${CX}" cy="${CY}" r="${R + 13}" fill="none" stroke="#C9A96A" stroke-width="6" stroke-dasharray="1 13.34" opacity=".2"/>
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#262B33" stroke-width="2.5"/>
          ${arcs}
          <circle cx="${CX}" cy="${CY}" r="${R - 40}" fill="none" stroke="#8F7443" stroke-width=".6" opacity=".5"/>
          <circle cx="${CX}" cy="${CY}" r="${R - 45}" fill="none" stroke="#8F7443" stroke-width=".5" opacity=".25"/>
          ${nodes}${labels}${center}
        </svg>
      </div>
    </div></div>`;
}

// ---------- stats ----------

export function renderStats(state) {
  const host = el("stats");
  if (!state) { host.innerHTML = ""; return; }
  const mv = state.marketValueCents;
  const contributed = M.totalContributedCents(state);
  const pl = mv - contributed;
  const plPct = contributed > 0 ? (pl / contributed) * 100 : 0;
  const zakat = M.zakatCents(mv, state.zakatPct);
  host.innerHTML = `
    <div class="stat"><div class="k">Capital contributed</div>
      <div class="v">${M.fmtUSD(contributed)}</div>
      <div class="sub gold">≈ ${M.fmtSAR(contributed, state.fxRate)}</div></div>
    <div class="stat"><div class="k">Profit / loss</div>
      <div class="v ${pl >= 0 ? "gain" : "loss"}">${pl >= 0 ? "+" : "−"}${M.fmtUSD(Math.abs(pl))}</div>
      <div class="sub">${pl >= 0 ? "+" : "−"}${Math.abs(plPct).toFixed(2)}% on capital</div></div>
    <div class="stat"><div class="k">Zakat due (${state.zakatPct}%)</div>
      <div class="v gold">${M.fmtUSD(zakat)}</div>
      <div class="sub gold">≈ ${M.fmtSAR(zakat, state.fxRate)}</div></div>
    <div class="stat"><div class="k">Exchange rate</div>
      <div class="v">${state.fxRate}</div>
      <div class="sub">USD → SAR</div></div>`;
}

// ---------- members ----------

export function renderMembers(state, editMode) {
  const host = el("members");
  el("member-count").textContent = state ? `${state.members.length}` : "";
  if (!state || !state.members.length) {
    host.innerHTML = `<div class="empty">No members yet.</div>`;
    return;
  }
  const pcts = M.displayPercentsBp2(state);
  const vals = M.memberValuesCents(state);
  host.innerHTML = state.members.map((m, i) => {
    const v = vals[i];
    const pl = v - m.netContributedCents;
    const plPct = m.netContributedCents > 0 ? (pl / m.netContributedCents) * 100 : 0;
    const zakat = M.zakatCents(v, state.zakatPct);
    return `<article class="member">
      <div class="head"><span class="name">${esc(m.name)}</span><span class="pct">${M.fmtPctBp2(pcts[i])}</span></div>
      <div class="share-track"><div class="share-fill" style="width:${(pcts[i] / 100).toFixed(2)}%;background:${tone(i)}"></div></div>
      <dl>
        <dt>Value</dt><dd>${M.fmtUSD(v)}<span class="sar">≈ ${M.fmtSAR(v, state.fxRate)}</span></dd>
        <dt>Contributed</dt><dd>${M.fmtUSD(m.netContributedCents)}</dd>
        <dt>Profit / loss</dt><dd class="${pl >= 0 ? "gain" : "loss"}">${pl >= 0 ? "+" : "−"}${M.fmtUSD(Math.abs(pl))} (${pl >= 0 ? "+" : "−"}${Math.abs(plPct).toFixed(2)}%)</dd>
        <dt>Zakat</dt><dd class="gold">${M.fmtUSD(zakat)}<span class="sar">≈ ${M.fmtSAR(zakat, state.fxRate)}</span></dd>
      </dl>
      ${editMode ? `<button class="manage" data-manage="${m.id}">Manage · remove</button>` : ""}
    </article>`;
  }).join("");
}

// ---------- history chart + list ----------

function shortDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function renderHistory(history, fxRate, editMode) {
  const svgHost = el("chart");
  const H = history;
  if (!H.length) {
    svgHost.innerHTML = `<div class="empty">No history yet — add a dated value to begin the trend.</div>`;
    el("hist-list").innerHTML = "";
    return;
  }
  const Ht = 300, padL = 78, padR = 40, padT = 30, padB = 44;
  // The chart widens with the data so every point keeps its label;
  // it scrolls horizontally and parks at the most recent point.
  const W = Math.max(720, padL + padR + (H.length - 1) * 92);
  const vals = H.map((h) => h.valueCents / 100);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min *= 0.92; max = max * 1.08 || 10; }
  const span = max - min;
  min = Math.max(0, min - span * 0.1); max += span * 0.1;
  const xs = (i) => (H.length === 1 ? padL + (W - padL - padR) / 2 : padL + (i * (W - padL - padR)) / (H.length - 1));
  const ys = (v) => Ht - padB - ((v - min) / (max - min)) * (Ht - padT - padB);

  let s = `<defs><linearGradient id="au" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C9A96A" stop-opacity=".18"/><stop offset="1" stop-color="#C9A96A" stop-opacity="0"/></linearGradient>
    <filter id="lineglow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs>`;
  for (let g = 0; g <= 4; g++) {
    const v = max - ((max - min) * g) / 4, gy = ys(v);
    s += `<line x1="${padL}" x2="${W - padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#20242C" stroke-width="1"/>
      <text x="${padL - 10}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#938D81">$${Math.round(v).toLocaleString("en-US")}</text>`;
  }
  const pts = H.map((h, i) => `${xs(i).toFixed(1)},${ys(h.valueCents / 100).toFixed(1)}`);
  if (H.length > 1) {
    s += `<path d="M${xs(0).toFixed(1)},${Ht - padB} L${pts.join(" L")} L${xs(H.length - 1).toFixed(1)},${Ht - padB} Z" fill="url(#au)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="#C9A96A" stroke-width="3" opacity=".45" filter="url(#lineglow)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="#C9A96A" stroke-width="2"/>`;
  }
  H.forEach((h, i) => {
    const X = xs(i), Y = ys(h.valueCents / 100);
    s += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="3.4" fill="#0B0D11" stroke="#C9A96A" stroke-width="1.6"><title>${h.date} · ${M.fmtUSD(h.valueCents)}</title></circle>`;
    // every point keeps its number — alternate above/below the line
    const above = i % 2 === 0;
    const anchor = i === H.length - 1 ? "end" : i === 0 ? "start" : "middle";
    s += `<text x="${X.toFixed(1)}" y="${(above ? Y - 13 : Y + 22).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="500" fill="#ECE7DC">$${Math.round(h.valueCents / 100).toLocaleString("en-US")}</text>`;
    s += `<text x="${X.toFixed(1)}" y="${Ht - padB + 20}" text-anchor="${anchor}" font-size="10.5" fill="#938D81">${shortDate(h.date)}</text>`;
  });
  svgHost.innerHTML = `<div class="chart-scroll"><svg viewBox="0 0 ${W} ${Ht}" style="min-width:${W}px" role="img" aria-label="Portfolio value over time">${s}</svg></div>`;
  const scroller = svgHost.querySelector(".chart-scroll");
  scroller.scrollLeft = scroller.scrollWidth;

  el("hist-list").innerHTML = [...H].reverse().map((h) => `
    <div class="hist-row"><span>${h.date}</span>
      <span><span class="v">${M.fmtUSD(h.valueCents)}</span><span class="sar">≈ ${M.fmtSAR(h.valueCents, fxRate)}</span>
      ${editMode ? `<button class="del edit" data-hist-edit="${h.id}" aria-label="Edit ${h.date}">✎</button>
      <button class="del" data-hist-del="${h.id}" aria-label="Delete ${h.date}">✕</button>` : ""}</span>
    </div>`).join("");
}

// ---------- ledger ----------

export const EDITABLE_TYPES = ["deposit", "withdrawal", "revaluation"];

export const TYPE_LABELS = {
  founding: "Founding", deposit: "Deposit", withdrawal: "Withdrawal",
  "member-added": "New member", "member-removed": "Removed",
  "member-removed-redeemed": "Removed · redeemed", "member-removed-reassigned": "Removed · reassigned",
  revaluation: "Revaluation", settings: "Settings", import: "Restore",
};

export function renderLedger(ledger, editMode) {
  const host = el("ledger");
  if (!ledger.length) { host.innerHTML = `<div class="empty">Every movement will be recorded here.</div>`; return; }
  host.innerHTML = ledger.map((l) => {
    const when = new Date(l.atMs).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const who = l.memberName ? `<b>${esc(l.memberName)}</b>${l.note ? " · " : ""}` : "";
    const note = l.note ? esc(l.note) : "";
    let amt = "", cls = "";
    if (l.type === "deposit" || l.type === "founding" || l.type === "member-added") { amt = "+" + M.fmtUSD(l.amountCents); cls = "gain"; }
    else if (l.type === "withdrawal" || l.type === "member-removed-redeemed") { amt = "−" + M.fmtUSD(l.amountCents); cls = "loss"; }
    else if (l.amountCents) amt = M.fmtUSD(l.amountCents);
    return `<div class="ledger-row">
      <span class="what"><span class="tag">${TYPE_LABELS[l.type] || esc(l.type)}</span>${who}${note}
        ${l.dateLabel ? `<span class="when">for ${l.dateLabel} · recorded ${when}</span>` : `<span class="when">${when}</span>`}</span>
      <span class="right"><span class="amt ${cls}">${amt}</span>${editMode && EDITABLE_TYPES.includes(l.type) ? `<button class="del edit" data-ledger-edit="${l.id}" aria-label="Edit this amount">✎</button>` : ""}${editMode ? `<button class="del" data-ledger-del="${l.id}" aria-label="Delete this record">✕</button>` : ""}</span></div>`;
  }).join("");
}

// ---------- edit-mode helpers ----------

export function populateMemberSelects(state) {
  document.querySelectorAll("select[data-members]").forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = (state ? state.members : [])
      .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
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
