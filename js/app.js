// ============================================================
// App shell. The office is private: nothing is read until the
// owner signs in (Firestore rules enforce it; the UI follows).
// Every state change: model (pure) -> store.commit (atomic) ->
// realtime listeners re-render. The plan (the calculator's
// settings) saves on its own, debounced.
// ============================================================

import * as M from "./model.js";
import * as R from "./render.js";
import * as C from "./calc.js";
import { DEMO, OWNER_EMAIL } from "./config.js";
import { FirestoreStore, MemoryStore } from "./store.js";
import { initHero } from "./scrub.js";
import { initCalc, renderCalc } from "./calcui.js";

let store = null;
let snap = null;
let state = null;
let plan = C.defaultPlan();
let editUI = false;
let subscribed = false;
let lastLocalEdit = 0;
let saveTimer = null;

const $ = (id) => document.getElementById(id);
// local calendar date (Riyadh), not UTC
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

function buildState(s) {
  if (!s || !s.config) return null;
  return {
    marketValueCents: s.config.marketValueCents,
    totalUnitsMicro: s.config.totalUnitsMicro,
    fxRate: s.config.fxRate,
    zakatPct: s.config.zakatPct,
    members: s.members,
  };
}

function mergePlan(saved) {
  const d = C.defaultPlan();
  if (!saved) return d;
  return {
    ...d, ...saved,
    mix: Object.fromEntries(C.BUCKETS.map((b) => [b.key, { ...d.mix[b.key], ...((saved.mix || {})[b.key] || {}) }])),
    cutPct: { ...d.cutPct, ...(saved.cutPct || {}) },
    members: { ...(saved.members || {}) },
  };
}

function cleanEntry(e) {
  const o = {};
  for (const k of Object.keys(e)) if (e[k] !== undefined && e[k] !== null && e[k] !== "") o[k] = e[k];
  return o;
}

// ---------- rendering ----------

function renderAll() {
  const founded = !!state && state.members.length > 0;
  document.querySelectorAll("[data-needs-office]").forEach((n) => { n.hidden = !founded; });
  $("founding").hidden = founded || !editUI;
  R.springStrip(state);
  R.renderStats(state);
  R.renderMembers(state, editUI);
  R.renderHistory(snap ? snap.history : [], state ? state.fxRate : 3.75, editUI);
  R.renderLedger(snap ? snap.ledger : [], editUI);
  R.populateMemberSelects(state);
  if (founded) renderCalc();
  if (editUI && state) {
    if (document.activeElement !== $("st-fx")) $("st-fx").value = state.fxRate;
    if (document.activeElement !== $("st-zakat")) $("st-zakat").value = state.zakatPct;
  }
}

function onSnap(s, err) {
  if (err) {
    store.unsubscribeAll();
    subscribed = false;
    $("loading").hidden = true;
    $("app").hidden = true;
    $("signin").hidden = false;
    $("gate-msg").textContent = "The office couldn't load. Check the connection, then sign in again.";
    return;
  }
  snap = s;
  state = buildState(s);
  if (Date.now() - lastLocalEdit > 2500) plan = mergePlan(s.plan);
  $("loading").hidden = true;
  $("app").hidden = false;
  renderAll();
}

function updatePlan(p) {
  plan = p;
  lastLocalEdit = Date.now();
  renderCalc();
  if (!editUI) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.savePlan(JSON.parse(JSON.stringify(plan))).catch((e) => console.error("plan save", e));
  }, 700);
}

// ---------- modal ----------

function modalAsk(html) {
  return new Promise((resolve) => {
    const host = $("modal-host");
    const back = document.activeElement;
    host.innerHTML = `<div class="modal-veil"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${html}</div></div>`;
    const h = host.querySelector("h3");
    if (h) h.id = "modal-title";
    const done = (act) => {
      const input = host.querySelector("#modal-input");
      const value = input ? input.value : null;
      host.innerHTML = "";
      if (back && document.contains(back)) back.focus();
      resolve({ act, value });
    };
    host.querySelector(".modal").addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = [...host.querySelectorAll("button, input, select")];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    host.querySelector(".modal-veil").addEventListener("click", (e) => { if (e.target === e.currentTarget) done(null); });
    host.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => done(b.dataset.act)));
    document.addEventListener("keydown", function esc(e) {
      if (!$("modal-host").firstChild) { document.removeEventListener("keydown", esc); return; }
      if (e.key === "Escape") { document.removeEventListener("keydown", esc); done(null); }
      if (e.key === "Enter" && host.querySelector("#modal-input") === document.activeElement) {
        document.removeEventListener("keydown", esc); done("save");
      }
    });
    const input = host.querySelector("#modal-input");
    if (input) { input.focus(); input.select(); }
    else { const safe = host.querySelector('[data-act=""]') || host.querySelector("button"); if (safe) safe.focus(); }
  });
}

async function modal(html) { return (await modalAsk(html)).act; }

// ---------- actions ----------

async function commitResult(res, fbId, okMsg, opts) {
  await store.commit(res.state, cleanEntry(res.entry), opts || {});
  R.feedback(fbId, okMsg, false);
}

function act(fbId, fn) {
  return async () => {
    try { await fn(); }
    catch (e) {
      R.feedback(fbId, e.message || "Something went wrong.", true);
      if (!(e instanceof M.ModelError)) console.error(e);
    }
  };
}

function wireEditActions() {
  ["dep-date", "wd-date", "hs-date"].forEach((id) => { if ($(id)) $(id).value = today(); });

  $("dep-btn").addEventListener("click", act("fb-dep", async () => {
    const id = $("dep-member").value;
    if (!id) throw new M.ModelError("Add a member first.");
    const amount = M.parseUSDToCents($("dep-amount").value);
    const res = M.deposit(state, id, amount);
    res.entry.dateLabel = $("dep-date").value || today();
    await commitResult(res, "fb-dep", `${res.entry.memberName} deposited ${M.fmtUSD(amount)}.`);
    $("dep-amount").value = "";
  }));

  $("wd-btn").addEventListener("click", act("fb-wd", async () => {
    const id = $("wd-member").value;
    if (!id) throw new M.ModelError("Add a member first.");
    const amount = M.parseUSDToCents($("wd-amount").value);
    const res = M.withdraw(state, id, amount);
    res.entry.dateLabel = $("wd-date").value || today();
    await commitResult(res, "fb-wd", `${res.entry.memberName} withdrew ${M.fmtUSD(amount)}.`);
    $("wd-amount").value = "";
  }));

  $("nm-btn").addEventListener("click", act("fb-nm", async () => {
    const amount = M.parseUSDToCents($("nm-amount").value);
    const res = M.addMember(state, $("nm-name").value, amount);
    await commitResult(res, "fb-nm", `${res.entry.memberName} joined with ${M.fmtUSD(amount)}.`);
    $("nm-name").value = ""; $("nm-amount").value = "";
  }));

  $("rv-btn").addEventListener("click", act("fb-rv", async () => {
    const v = M.parseUSDToCents($("rv-amount").value);
    const res = M.revalue(state, v);
    const opts = $("rv-sync").checked ? { history: { date: today(), valueCents: v } } : {};
    await commitResult(res, "fb-rv", `Portfolio revalued to ${M.fmtUSD(v)}.`, opts);
    $("rv-amount").value = "";
  }));

  $("st-btn").addEventListener("click", act("fb-st", async () => {
    const fx = parseFloat($("st-fx").value);
    const zk = parseFloat($("st-zakat").value);
    const res = M.updateSettings(state, {
      fxRate: Number.isFinite(fx) && fx !== state.fxRate ? fx : null,
      zakatPct: Number.isFinite(zk) && zk !== state.zakatPct ? zk : null,
    });
    await commitResult(res, "fb-st", "Settings updated.");
  }));

  $("hs-btn").addEventListener("click", act("fb-hs", async () => {
    const date = $("hs-date").value;
    if (!date) throw new M.ModelError("Pick a date.");
    const v = M.parseUSDToCents($("hs-value").value);
    if (v <= 0) throw new M.ModelError("Value must be above zero.");
    if ($("hs-sync").checked) {
      const res = M.revalue(state, v);
      await commitResult(res, "fb-hs", `Recorded ${date} and set as current value.`, { history: { date, valueCents: v } });
    } else {
      await store.upsertHistory(date, v);
      R.feedback("fb-hs", `Recorded ${date}: ${M.fmtUSD(v)}.`, false);
    }
    $("hs-value").value = "";
  }));

  $("hs-date").addEventListener("change", () => {
    $("hs-sync-wrap").style.display = $("hs-date").value === today() ? "" : "none";
    if ($("hs-date").value !== today()) $("hs-sync").checked = false;
  });

  document.addEventListener("click", (e) => {
    const manage = e.target.closest("[data-manage]");
    if (manage) manageMember(manage.dataset.manage);
    const histDel = e.target.closest("[data-hist-del]");
    if (histDel) deleteHistoryPoint(histDel.dataset.histDel);
    const histEdit = e.target.closest("[data-hist-edit]");
    if (histEdit) editHistoryPoint(histEdit.dataset.histEdit);
    const ledgerDel = e.target.closest("[data-ledger-del]");
    if (ledgerDel) deleteLedgerEntry(ledgerDel.dataset.ledgerDel);
    const ledgerEdit = e.target.closest("[data-ledger-edit]");
    if (ledgerEdit) editLedgerEntry(ledgerEdit.dataset.ledgerEdit);
  });

  $("bk-export").addEventListener("click", exportBackup);
  $("bk-import-btn").addEventListener("click", () => $("bk-file").click());
  $("bk-file").addEventListener("change", importBackup);

  $("found-add-row").addEventListener("click", () => addFoundingRow());
  $("found-btn").addEventListener("click", act("fb-found", establishOffice));
  addFoundingRow(); addFoundingRow();
}

async function manageMember(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;
  const balance = M.memberValueCents(state, id);
  try {
    if (balance === 0 && m.unitsMicro === 0) {
      const actn = await modal(`<h3>Remove ${R.esc(m.name)}?</h3>
        <p>Their balance is $0.00, so they can be removed directly. This is recorded in the ledger.</p>
        <div class="btnrow"><button class="btn danger" data-act="zero">Remove member</button>
        <button class="btn quiet" data-act="">Cancel</button></div>`);
      if (actn !== "zero") return;
      const res = M.removeMemberZero(state, id);
      await store.commit(res.state, cleanEntry(res.entry), { removedMemberIds: [id] });
      return;
    }
    const others = state.members.length - 1;
    const actn = await modal(`<h3>Remove ${R.esc(m.name)}</h3>
      <p>${R.esc(m.name)} currently holds <b>${M.fmtUSD(balance)}</b>. That value can't just disappear, so choose how to settle it. Both paths are recorded in the ledger.</p>
      <button class="choice" data-act="redeem"><b>Redeem and pay out</b>
        Their full ${M.fmtUSD(balance)} is recorded as a withdrawal, then the member is removed. Portfolio value decreases accordingly.</button>
      ${others > 0 ? `<button class="choice" data-act="reassign"><b>Reassign to remaining members</b>
        Their units are redistributed pro-rata to the other ${others} member(s). Portfolio value is unchanged.</button>` : ""}
      <div class="btnrow"><button class="btn quiet" data-act="">Cancel</button></div>`);
    if (!actn) return;
    const res = actn === "redeem" ? M.removeMemberRedeem(state, id) : M.removeMemberReassign(state, id);
    await store.commit(res.state, cleanEntry(res.entry), { removedMemberIds: [id] });
  } catch (e) {
    R.feedback("fb-nm", e.message, true);
  }
}

async function editLedgerEntry(id) {
  const l = snap.ledger.find((x) => x.id === id);
  if (!l || !R.EDITABLE_TYPES.includes(l.type) || !state) return;
  const label = (R.TYPE_LABELS[l.type] || l.type).toLowerCase();
  const who = l.memberName ? `${R.esc(l.memberName)} · ` : "";
  const newerReval = l.type === "revaluation" && snap.ledger.some((x) => x.type === "revaluation" && x.atMs > l.atMs);
  const how = l.type !== "revaluation"
    ? "The original movement is reversed exactly, then re-applied at the corrected amount. Balances follow."
    : newerReval
      ? "A newer revaluation already set today's value, so only this record is corrected."
      : "Today's pool value moves by the same difference as the correction, and this record is replaced.";
  const prefill = (l.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { act, value } = await modalAsk(`<h3>Correct this ${label}</h3>
    <p>${who}currently ${M.fmtUSD(l.amountCents)}. ${how}</p>
    <div class="field"><label for="modal-input">Corrected amount (USD)</label>
    <input type="text" inputmode="decimal" id="modal-input" value="${prefill}"></div>
    <div class="btnrow"><button class="btn" data-act="save">Save correction</button>
    <button class="btn quiet" data-act="">Cancel</button></div>`);
  if (act !== "save") return;
  try {
    const amount = M.parseUSDToCents(value);
    let res;
    if (l.type === "revaluation") {
      const target = newerReval ? state.marketValueCents : state.marketValueCents + (amount - l.amountCents);
      if (target <= 0) throw new M.ModelError("That correction would take the pool to zero or below.");
      res = newerReval ? { state, entry: { type: "revaluation", amountCents: amount, unitsDeltaMicro: 0 } } : M.revalue(state, target);
      res.entry.amountCents = amount;
      res.entry.note = `amended from ${M.fmtUSD(l.amountCents)}${newerReval ? ", record only" : ""}`;
    } else {
      const rev = M.reverseEntry(state, l);
      res = l.type === "deposit"
        ? M.deposit(rev.state, l.memberId, amount)
        : M.withdraw(rev.state, l.memberId, amount);
      if (l.dateLabel) res.entry.dateLabel = l.dateLabel;
      res.entry.note = `amended from ${M.fmtUSD(l.amountCents)}`;
    }
    await store.commit(res.state, cleanEntry(res.entry), { deleteLedgerIds: [id] });
  } catch (e) {
    await modal(`<h3>Couldn't apply the correction</h3><p>${R.esc(e.message)}</p>
      <div class="btnrow"><button class="btn quiet" data-act="">Close</button></div>`);
  }
}

async function editHistoryPoint(id) {
  const h = snap.history.find((x) => x.id === id);
  if (!h) return;
  const prefill = (h.valueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { act, value } = await modalAsk(`<h3>Edit history point</h3>
    <p>${R.esc(h.date)}. This changes the chart only; balances and the ledger stay as they are.</p>
    <div class="field"><label for="modal-input">Value on that date (USD)</label>
    <input type="text" inputmode="decimal" id="modal-input" value="${prefill}"></div>
    <div class="btnrow"><button class="btn" data-act="save">Save</button>
    <button class="btn quiet" data-act="">Cancel</button></div>`);
  if (act !== "save") return;
  try {
    const v = M.parseUSDToCents(value);
    if (v <= 0) throw new M.ModelError("Value must be above zero.");
    await store.upsertHistory(h.date, v);
  } catch (e) {
    await modal(`<h3>Couldn't save</h3><p>${R.esc(e.message)}</p>
      <div class="btnrow"><button class="btn quiet" data-act="">Close</button></div>`);
  }
}

async function deleteLedgerEntry(id) {
  const l = snap.ledger.find((x) => x.id === id);
  if (!l) return;
  const desc = `${R.TYPE_LABELS[l.type] || R.esc(l.type)}${l.memberName ? " · " + R.esc(l.memberName) : ""}${l.amountCents ? " · " + M.fmtUSD(l.amountCents) : ""}`;
  let rev = null, revErr = null;
  if (state && ["deposit", "withdrawal", "member-added"].includes(l.type)) {
    try { rev = M.reverseEntry(state, l); } catch (e) { revErr = e.message; }
  }
  try {
    const actn = await modal(`<h3>Delete ledger record?</h3>
      <p><b>${desc}</b></p>
      ${rev ? `<button class="choice" data-act="undo"><b>Undo the movement</b>
        Reverses the exact units and amount, then deletes the record. Balances return to what they were, as if it never happened.</button>` : ""}
      ${revErr ? `<p style="font-size:13px">This movement can't be reversed automatically: ${R.esc(revErr)}</p>` : ""}
      <button class="choice" data-act="del"><b>Delete the record only</b>
        Balances and units stay exactly as they are. Only this line disappears from the ledger.</button>
      <div class="btnrow"><button class="btn quiet" data-act="">Cancel</button></div>`);
    if (actn === "undo" && rev) {
      await store.commit(rev.state, null, {
        removedMemberIds: rev.removedMemberId ? [rev.removedMemberId] : [],
        deleteLedgerIds: [id],
      });
    } else if (actn === "del") {
      await store.deleteLedger(id);
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteHistoryPoint(id) {
  const h = snap.history.find((x) => x.id === id);
  if (!h) return;
  const actn = await modal(`<h3>Delete history point?</h3>
    <p>${R.esc(h.date)} · ${M.fmtUSD(h.valueCents)} will be removed from the chart. The ledger is not affected.</p>
    <div class="btnrow"><button class="btn danger" data-act="del">Delete point</button>
    <button class="btn quiet" data-act="">Cancel</button></div>`);
  if (actn === "del") await store.deleteHistory(id);
}

// ---------- founding ----------

function addFoundingRow() {
  const row = document.createElement("div");
  row.className = "found-row";
  row.style.cssText = "display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-bottom:10px";
  const n = $("found-rows").children.length + 1;
  if (n === 1) {
    const head = document.createElement("div");
    head.className = "found-head";
    head.setAttribute("aria-hidden", "true");
    head.style.cssText = "display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-bottom:6px;font-size:13px;color:var(--ink-2)";
    head.innerHTML = "<span>Name</span><span>Value today (USD)</span><span>Put in (USD, optional)</span>";
    $("found-rows").before(head);
  }
  row.innerHTML = `<input type="text" placeholder="Name" data-f-name aria-label="Member ${n}: name">
    <input type="text" inputmode="decimal" placeholder="Value today" data-f-value aria-label="Member ${n}: value today in USD">
    <input type="text" inputmode="decimal" placeholder="Put in" data-f-contrib aria-label="Member ${n}: money put in, USD, optional">`;
  $("found-rows").appendChild(row);
}

async function establishOffice() {
  const entries = [];
  document.querySelectorAll(".found-row").forEach((row) => {
    const name = row.querySelector("[data-f-name]").value.trim();
    const valueTxt = row.querySelector("[data-f-value]").value.trim();
    const contribTxt = row.querySelector("[data-f-contrib]").value.trim();
    if (!name && !valueTxt) return;
    const valueCents = M.parseUSDToCents(valueTxt);
    entries.push({
      name,
      valueCents,
      contributedCents: contribTxt ? M.parseUSDToCents(contribTxt) : valueCents,
    });
  });
  const fx = parseFloat($("found-fx").value) || 3.75;
  const zk = $("found-zakat").value === "" ? 2.5 : parseFloat($("found-zakat").value);
  const res = M.found(entries, { fxRate: fx, zakatPct: zk });
  await store.commit(res.state, cleanEntry(res.entry), {
    history: { date: today(), valueCents: res.state.marketValueCents },
  });
  R.feedback("fb-found", "The office is established.", false);
}

// ---------- backup ----------

async function exportBackup() {
  let ledger = snap.ledger;
  try { ledger = await store.fullLedger(); } catch (e) { console.error("full ledger", e); }
  const { updatedAt, ...config } = snap.config || {};
  const data = {
    app: "albassam-family-office",
    version: 1,
    exportedAt: new Date().toISOString(),
    config,
    members: snap.members,
    history: snap.history,
    ledger,
    plan,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `albassam-office-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  R.feedback("fb-bk", "Backup downloaded.", false);
}

// A backup is untrusted input: check every field and keep only known ones,
// so nothing unexpected can reach the database or the page.
function sanitizeBackup(d) {
  const int = Number.isInteger, fin = (v) => typeof v === "number" && Number.isFinite(v);
  const str = (v, max = 200) => typeof v === "string" && v.length <= max;
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  if (!d || d.app !== "albassam-family-office" || !d.config) return null;
  const c = d.config;
  if (!int(c.marketValueCents) || !int(c.totalUnitsMicro) || !fin(c.fxRate) || !fin(c.zakatPct)) return null;
  if (![d.members, d.history, d.ledger].every(Array.isArray)) return null;
  if (!d.members.every((m) => isId(m.id) && str(m.name, 80) && m.name.trim() && int(m.unitsMicro) && int(m.netContributedCents) && (m.createdAt === undefined || fin(m.createdAt)))) return null;
  if (!d.history.every((h) => isDate(h.date) && int(h.valueCents))) return null;
  if (!d.ledger.every((l) => l && typeof l.type === "string" && l.type in R.TYPE_LABELS
      && (l.amountCents === undefined || int(l.amountCents)) && (l.unitsDeltaMicro === undefined || int(l.unitsDeltaMicro))
      && (l.memberId === undefined || isId(l.memberId)) && (l.memberName === undefined || str(l.memberName, 80))
      && (l.note === undefined || str(l.note, 300)) && (l.dateLabel === undefined || isDate(l.dateLabel))
      && (l.atMs === undefined || fin(l.atMs)))) return null;
  if (d.plan !== undefined && d.plan !== null && (typeof d.plan !== "object" || Array.isArray(d.plan))) return null;
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
  return {
    app: d.app, exportedAt: str(d.exportedAt, 40) ? d.exportedAt : "",
    config: pick(c, ["marketValueCents", "totalUnitsMicro", "fxRate", "zakatPct"]),
    members: d.members.map((m) => pick(m, ["id", "name", "unitsMicro", "netContributedCents", "createdAt"])),
    history: d.history.map((h) => ({ date: h.date, valueCents: h.valueCents })),
    ledger: d.ledger.map((l) => pick(l, ["type", "memberId", "memberName", "amountCents", "unitsDeltaMicro", "note", "dateLabel", "atMs"])),
    plan: d.plan ? JSON.parse(JSON.stringify(d.plan)) : null,
  };
}

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = sanitizeBackup(JSON.parse(await file.text()));
    if (!data) throw new M.ModelError("That file is not a valid office backup. Nothing was changed.");
    const cur = snap;
    const fmtSide = (cfg, members, history, ledger) =>
      `${members.length} members · ${M.fmtUSD(cfg ? cfg.marketValueCents : 0)}\n${history.length} history points · ${ledger.length} ledger entries`;
    const actn = await modal(`<h3>Restore from backup?</h3>
      <p>This replaces everything currently stored. Review before confirming:</p>
      <pre>NOW\n${fmtSide(cur.config, cur.members, cur.history, cur.ledger)}\n\nBACKUP (${R.esc(data.exportedAt || "unknown date")})\n${fmtSide(data.config, data.members, data.history, data.ledger)}</pre>
      <div class="btnrow"><button class="btn danger" data-act="go">Replace everything</button>
      <button class="btn quiet" data-act="">Cancel</button></div>`);
    if (actn !== "go") return;
    await store.importAll(data);
    R.feedback("fb-bk", "Backup restored.", false);
  } catch (err) {
    R.feedback("fb-bk", err.message || "Import failed.", true);
  }
}

// ---------- auth: the office is private ----------

function showSignedIn(on) {
  document.querySelectorAll("[data-signed-in]").forEach((n) => { n.hidden = !on; });
  $("signin").hidden = on;
  if (!on) { $("app").hidden = true; $("loading").hidden = true; }
}

async function setupAuth() {
  const A = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js");
  const auth = A.getAuth(store.app);
  $("gate-btn").addEventListener("click", async () => {
    $("gate-msg").textContent = "";
    if (auth.currentUser && auth.currentUser.email === OWNER_EMAIL) { location.reload(); return; }
    try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); }
    catch (err) { if (err.code !== "auth/popup-closed-by-user") $("gate-msg").textContent = "Sign-in didn't finish. Try again."; }
  });
  $("signout-btn").addEventListener("click", () => A.signOut(auth));
  A.onAuthStateChanged(auth, (user) => {
    const owner = !!user && user.email === OWNER_EMAIL && user.emailVerified;
    if (user && !owner) {
      $("gate-msg").textContent = `${user.email} can't open this office.`;
      A.signOut(auth);
    }
    editUI = owner;
    showSignedIn(owner);
    if (owner && !subscribed) {
      subscribed = true;
      $("loading").hidden = false;
      store.subscribe(onSnap);
    }
    if (!owner && subscribed) {
      // signed out: drop every figure from memory and the page
      subscribed = false;
      store.unsubscribeAll();
      $("modal-host").innerHTML = "";
      location.reload();
    }
  });
}

// ---------- the page around the numbers ----------

function initPageMotion() {
  document.querySelectorAll(".sect > *:not(.grow-bg)").forEach((c) => c.classList.add("rise"));
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      setTimeout(() => e.target.classList.add("settled"), 1200);
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -12% 0px" }) : null;
  document.querySelectorAll(".sect").forEach((s) => (io ? io.observe(s) : s.classList.add("in", "settled")));

  const line = document.querySelector(".waterline i");
  if (line) {
    let last = -1, ticking = false;
    const upd = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, scrollY / max) : 0;
      if (Math.abs(p - last) > 0.002) { last = p; line.style.transform = `scaleY(${p.toFixed(4)})`; }
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }
  document.addEventListener("visibilitychange", () => document.body.classList.toggle("paused", document.hidden));
}

// ---------- boot ----------

export async function boot() {
  initHero();
  initPageMotion();
  store = DEMO ? new MemoryStore() : new FirestoreStore();
  await store.init();
  wireEditActions();
  initCalc({ getState: () => state, getPlan: () => plan, updatePlan });

  if (DEMO) {
    editUI = true;
    document.querySelectorAll("[data-demo-pill]").forEach((n) => { n.hidden = false; });
    showSignedIn(true);
    $("signout-btn").hidden = true;
    subscribed = true;
    store.subscribe(onSnap);
    return;
  }
  await setupAuth();
}
