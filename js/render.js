// ============================================================
// Rendering. Pure DOM output from a snapshot + derived model
// state. No storage or auth logic lives here.
// ============================================================

import * as M from "./model.js";

const TONES = ["#C8A96E", "#E0CFA5", "#8C6F4A", "#D4BC8A", "#A6905E", "#77623F", "#B89B68", "#EADFC1"];

export function tone(i) { return TONES[i % TONES.length]; }

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function el(id) { return document.getElementById(id); }

// ---------- the seal ----------

export function renderSeal(state) {
  const CX = 310, CY = 230, R = 165, C = 2 * Math.PI * R;
  let arcs = "", nodes = "", labels = "";

  if (state && state.totalUnitsMicro > 0) {
    const pcts = M.displayPercentsBp2(state);
    const n = state.members.length;
    const gap = n > 1 ? 12 : 0;
    let acc = 0;
    state.members.forEach((m, i) => {
      const frac = m.unitsMicro / state.totalUnitsMicro;
      const len = Math.max(frac * C - gap, 1.5);
      arcs += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${tone(i)}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${CX} ${CY})"/>`;
      const midFrac = (acc + (frac * C) / 2) / C;
      const a = -Math.PI / 2 + midFrac * 2 * Math.PI;
      const nx = CX + R * Math.cos(a), ny = CY + R * Math.sin(a);
      const initial = esc(m.name.trim().charAt(0).toUpperCase());
      nodes += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="13" fill="#0A0C0F" stroke="${tone(i)}" stroke-width="1.2"/>
        <text x="${nx.toFixed(1)}" y="${(ny + 4).toFixed(1)}" text-anchor="middle" font-family="Marcellus,serif" font-size="12" fill="${tone(i)}">${initial}</text>`;
      const lx = CX + (R + 34) * Math.cos(a), ly = CY + (R + 34) * Math.sin(a);
      const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
      const dy = Math.sin(a) < -0.85 ? -6 : Math.sin(a) > 0.85 ? 12 : 0;
      labels += `<g class="seal-label"><text x="${lx.toFixed(1)}" y="${(ly - 3 + dy).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" fill="#EAE6DD">${esc(m.name)}</text>
        <text x="${lx.toFixed(1)}" y="${(ly + 13 + dy).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" font-weight="500" fill="#C8A96E">${M.fmtPctBp2(pcts[i])}</text></g>`;
      acc += frac * C;
    });
  }

  let center;
  if (!state) {
    center = `<text x="${CX}" y="${CY + 5}" text-anchor="middle" font-size="13" letter-spacing="2" fill="#9C968A">NOT YET ESTABLISHED</text>`;
  } else {
    const mv = state.marketValueCents;
    const usd = M.fmtUSD(mv);
    const size = usd.length > 14 ? 34 : usd.length > 11 ? 40 : 46;
    const pl = mv - M.totalContributedCents(state);
    const contributed = M.totalContributedCents(state);
    const plPct = contributed > 0 ? (pl / contributed) * 100 : 0;
    const plColor = pl >= 0 ? "#58A47C" : "#C25E4C";
    const plSign = pl >= 0 ? "+" : "−";
    center = `
      <text x="${CX}" y="${CY - 44}" text-anchor="middle" font-size="10.5" letter-spacing="3" fill="#C8A96E">TOTAL HOLDINGS</text>
      <text x="${CX}" y="${CY + 4}" text-anchor="middle" font-family="Fraunces,serif" font-weight="300" font-size="${size}" fill="#F2EEE4">${usd}</text>
      <text x="${CX}" y="${CY + 32}" text-anchor="middle" font-size="13.5" fill="#C8A96E">≈ ${M.fmtSAR(mv, state.fxRate)}</text>
      <text x="${CX}" y="${CY + 58}" text-anchor="middle" font-size="12" font-weight="500" fill="${plColor}">${plSign}${M.fmtUSD(Math.abs(pl)).slice(pl < 0 ? 1 : 0)} · ${plSign}${Math.abs(plPct).toFixed(2)}% all time</text>`;
  }

  el("seal").innerHTML = `
    <svg viewBox="0 0 620 460" role="img" aria-label="Family seal: total holdings encircled by member ownership arcs">
      <circle class="seal-spin" cx="${CX}" cy="${CY}" r="${R + 13}" fill="none" stroke="#C8A96E" stroke-width="6" stroke-dasharray="1 14.55" opacity=".18"/>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#23272E" stroke-width="2.5"/>
      ${arcs}
      <circle cx="${CX}" cy="${CY}" r="${R - 40}" fill="none" stroke="#7E6A45" stroke-width=".6" opacity=".5"/>
      <circle cx="${CX}" cy="${CY}" r="${R - 45}" fill="none" stroke="#7E6A45" stroke-width=".5" opacity=".25"/>
      ${nodes}${labels}${center}
    </svg>`;
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
      <div class="v ${pl >= 0 ? "gain" : "loss"}">${pl >= 0 ? "+" : "−"}${M.fmtUSD(Math.abs(pl)).slice(0)}</div>
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
  const W = 720, Ht = 300, padL = 78, padR = 24, padT = 22, padB = 44;
  const vals = H.map((h) => h.valueCents / 100);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min *= 0.92; max = max * 1.08 || 10; }
  const span = max - min;
  min = Math.max(0, min - span * 0.1); max += span * 0.1;
  const xs = (i) => (H.length === 1 ? padL + (W - padL - padR) / 2 : padL + (i * (W - padL - padR)) / (H.length - 1));
  const ys = (v) => Ht - padB - ((v - min) / (max - min)) * (Ht - padT - padB);

  let s = `<defs><linearGradient id="au" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C8A96E" stop-opacity=".16"/><stop offset="1" stop-color="#C8A96E" stop-opacity="0"/></linearGradient></defs>`;
  for (let g = 0; g <= 4; g++) {
    const v = max - ((max - min) * g) / 4, gy = ys(v);
    s += `<line x1="${padL}" x2="${W - padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#1C2026" stroke-width="1"/>
      <text x="${padL - 10}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6B665C">$${Math.round(v).toLocaleString("en-US")}</text>`;
  }
  const pts = H.map((h, i) => `${xs(i).toFixed(1)},${ys(h.valueCents / 100).toFixed(1)}`);
  if (H.length > 1) {
    s += `<path d="M${xs(0).toFixed(1)},${Ht - padB} L${pts.join(" L")} L${xs(H.length - 1).toFixed(1)},${Ht - padB} Z" fill="url(#au)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="#C8A96E" stroke-width="2"/>`;
  }
  const step = Math.max(1, Math.ceil(H.length / 8));
  H.forEach((h, i) => {
    const X = xs(i), Y = ys(h.valueCents / 100);
    s += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="3.4" fill="#0A0C0F" stroke="#C8A96E" stroke-width="1.6"><title>${h.date} · ${M.fmtUSD(h.valueCents)}</title></circle>`;
    if (H.length <= 8) s += `<text x="${X.toFixed(1)}" y="${(Y - 12).toFixed(1)}" text-anchor="middle" font-size="11" fill="#EAE6DD">$${Math.round(h.valueCents / 100).toLocaleString("en-US")}</text>`;
    if (i % step === 0 || i === H.length - 1) {
      s += `<text x="${X.toFixed(1)}" y="${Ht - padB + 20}" text-anchor="middle" font-size="10.5" fill="#6B665C">${shortDate(h.date)}</text>`;
    }
  });
  svgHost.innerHTML = `<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Portfolio value over time">${s}</svg>`;

  el("hist-list").innerHTML = [...H].reverse().map((h) => `
    <div class="hist-row"><span>${h.date}</span>
      <span><span class="v">${M.fmtUSD(h.valueCents)}</span><span class="sar">≈ ${M.fmtSAR(h.valueCents, fxRate)}</span>
      ${editMode ? `<button class="del" data-hist-del="${h.id}" aria-label="Delete ${h.date}">✕</button>` : ""}</span>
    </div>`).join("");
}

// ---------- ledger ----------

const TYPE_LABELS = {
  founding: "Founding", deposit: "Deposit", withdrawal: "Withdrawal",
  "member-added": "New member", "member-removed": "Removed",
  "member-removed-redeemed": "Removed · redeemed", "member-removed-reassigned": "Removed · reassigned",
  revaluation: "Revaluation", settings: "Settings", import: "Restore",
};

export function renderLedger(ledger) {
  const host = el("ledger");
  if (!ledger.length) { host.innerHTML = `<div class="empty">Every movement will be recorded here.</div>`; return; }
  host.innerHTML = ledger.map((l) => {
    const when = new Date(l.atMs).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const who = l.memberName ? `<b>${esc(l.memberName)}</b> · ` : "";
    const note = l.note ? esc(l.note) : "";
    let amt = "", cls = "";
    if (l.type === "deposit" || l.type === "founding" || l.type === "member-added") { amt = "+" + M.fmtUSD(l.amountCents); cls = "gain"; }
    else if (l.type === "withdrawal" || l.type === "member-removed-redeemed") { amt = "−" + M.fmtUSD(l.amountCents); cls = "loss"; }
    else if (l.amountCents) amt = M.fmtUSD(l.amountCents);
    return `<div class="ledger-row">
      <span class="what"><span class="tag">${TYPE_LABELS[l.type] || esc(l.type)}</span>${who}${note}
        ${l.dateLabel ? `<span class="when">for ${l.dateLabel} · recorded ${when}</span>` : `<span class="when">${when}</span>`}</span>
      <span class="amt ${cls}">${amt}</span></div>`;
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
