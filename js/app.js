// ============================================================
// App shell. The office is private: nothing is read until the
// owner signs in (Firestore rules enforce it; the UI follows).
// Every change: model (pure) -> store.commit (atomic) -> realtime
// listeners re-render. Shares follow the money put in (model.js).
// ============================================================

import * as M from "./model.js";
import * as R from "./render.js";
import { DEMO, OWNER_EMAIL } from "./config.js";
import { FirestoreStore, MemoryStore } from "./store.js";
import { initHero } from "./scrub.js";

let store = null;
let snap = null;
let state = null;
let editUI = false;
let subscribed = false;

const $ = (id) => document.getElementById(id);
// local calendar date (Riyadh), not UTC
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

// An empty fund is a valid fund: the first "Add a person" founds it.
function buildState(s) {
  const c = (s && s.config) || { marketValueCents: 0, totalUnitsMicro: 0, fxRate: 3.75, zakatPct: 2.5 };
  return {
    marketValueCents: c.marketValueCents,
    totalUnitsMicro: c.totalUnitsMicro,
    fxRate: c.fxRate,
    zakatPct: c.zakatPct,
    members: s ? s.members : [],
  };
}

function cleanEntry(e) {
  const o = {};
  for (const k of Object.keys(e)) if (e[k] !== undefined && e[k] !== null && e[k] !== "") o[k] = e[k];
  return o;
}

// ---------- rendering ----------

function renderAll() {
  R.renderFund(state, editUI);
  R.renderLedger(snap ? snap.ledger : [], editUI);
  R.populateMemberSelects(state);
  $("move").hidden = !editUI;
  $("rv-open").hidden = !editUI || !state.members.length;
  ["dep", "wd"].forEach((k) => { $(k + "-member").closest(".panel").hidden = !state.members.length; });
  previews();
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
  $("loading").hidden = true;
  $("app").hidden = false;
  renderAll();
}

// ---------- live share previews ----------

// Run the move on a copy of the fund and show everyone's new share
// before anything is saved. Nothing typed yet: nothing shown.
function preview(hostId, amountId, run, extra) {
  const host = $(hostId);
  const txt = $(amountId).value.trim();
  host.classList.remove("err");
  if (!txt || !state) { host.textContent = ""; return; }
  try {
    const res = run(M.parseUSDToCents(txt));
    host.textContent = R.shareLine(res.state, res.entry.memberId) + (extra ? extra(res) : "");
  } catch (e) {
    host.textContent = e instanceof M.ModelError ? e.message : "";
    host.classList.add("err");
  }
}

function previews() {
  preview("pv-nm", "nm-amount", (c) => M.addMember(state, $("nm-name").value || "New person", c));
  preview("pv-dep", "dep-amount", (c) => M.deposit(state, $("dep-member").value, c));
  preview("pv-wd", "wd-amount", (c) => M.withdraw(state, $("wd-member").value, c), (res) => {
    const before = state.members.find((m) => m.id === res.entry.memberId);
    const after = res.state.members.find((m) => m.id === res.entry.memberId);
    const cut = before.netContributedCents - after.netContributedCents;
    if (Math.abs(cut - res.entry.amountCents) <= 1) return "";
    const pct = before.netContributedCents ? ((cut / before.netContributedCents) * 100).toFixed(1) : "0";
    return ` ${after.name}'s put in becomes ${M.fmtUSD(after.netContributedCents)}: taking out ${pct}% of what the share is worth takes ${pct}% off the money put in too.`;
  });
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
  ["nm-name", "nm-amount", "dep-member", "dep-amount", "wd-member", "wd-amount"].forEach((id) =>
    $(id).addEventListener("input", previews));

  $("nm-btn").addEventListener("click", act("fb-nm", async () => {
    const amount = M.parseUSDToCents($("nm-amount").value);
    const res = M.addMember(state, $("nm-name").value, amount);
    await commitResult(res, "fb-nm", `${res.entry.memberName} joined with ${M.fmtUSD(amount)}.`);
    $("nm-name").value = ""; $("nm-amount").value = ""; previews();
  }));

  $("dep-btn").addEventListener("click", act("fb-dep", async () => {
    const id = $("dep-member").value;
    if (!id) throw new M.ModelError("Add a person first.");
    const amount = M.parseUSDToCents($("dep-amount").value);
    const res = M.deposit(state, id, amount);
    await commitResult(res, "fb-dep", `${res.entry.memberName} added ${M.fmtUSD(amount)}.`);
    $("dep-amount").value = ""; previews();
  }));

  $("wd-btn").addEventListener("click", act("fb-wd", async () => {
    const id = $("wd-member").value;
    if (!id) throw new M.ModelError("Add a person first.");
    const amount = M.parseUSDToCents($("wd-amount").value);
    const res = M.withdraw(state, id, amount);
    await commitResult(res, "fb-wd", `${res.entry.memberName} took out ${M.fmtUSD(amount)}.`);
    $("wd-amount").value = ""; previews();
  }));

  $("rv-open").addEventListener("click", revalueFund);

  document.addEventListener("click", (e) => {
    const manage = e.target.closest("[data-manage]");
    if (manage) manageMember(manage.dataset.manage);
    const ledgerDel = e.target.closest("[data-ledger-del]");
    if (ledgerDel) deleteLedgerEntry(ledgerDel.dataset.ledgerDel);
    const ledgerEdit = e.target.closest("[data-ledger-edit]");
    if (ledgerEdit) editLedgerEntry(ledgerEdit.dataset.ledgerEdit);
  });

  $("bk-export").addEventListener("click", exportBackup);
  $("bk-import-btn").addEventListener("click", () => $("bk-file").click());
  $("bk-file").addEventListener("change", importBackup);
}

async function revalueFund() {
  const prefill = (state.marketValueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { act: a, value } = await modalAsk(`<h3>What is the fund worth today?</h3>
    <p>Everyone's worth and zakat follow the new figure. Shares don't change.</p>
    <div class="field"><label for="modal-input">Worth today (USD)</label>
    <input type="text" inputmode="decimal" id="modal-input" value="${prefill}"></div>
    <div class="btnrow"><button class="btn" data-act="save">Save</button>
    <button class="btn quiet" data-act="">Cancel</button></div>`);
  if (a !== "save") return;
  try {
    const v = M.parseUSDToCents(value);
    const r = M.revalue(state, v);
    await store.commit(r.state, cleanEntry(r.entry), { history: { date: today(), valueCents: v } });
  } catch (e) {
    await modal(`<h3>Couldn't save that</h3><p>${R.esc(e.message)}</p>
      <div class="btnrow"><button class="btn quiet" data-act="">Close</button></div>`);
  }
}

async function manageMember(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;
  const balance = M.memberValueCents(state, id);
  try {
    if (balance === 0 && m.unitsMicro === 0) {
      const actn = await modal(`<h3>Remove ${R.esc(m.name)}?</h3>
        <p>Their share is worth $0.00, so they can be removed. It's recorded in the history.</p>
        <div class="btnrow"><button class="btn danger" data-act="zero">Remove</button>
        <button class="btn quiet" data-act="">Cancel</button></div>`);
      if (actn !== "zero") return;
      const res = M.removeMemberZero(state, id);
      await store.commit(res.state, cleanEntry(res.entry), { removedMemberIds: [id] });
      $("members").focus();
      return;
    }
    const others = state.members.filter((x) => x.id !== id && x.unitsMicro > 0).length;
    const actn = await modal(`<h3>Remove ${R.esc(m.name)}</h3>
      <p>${R.esc(m.name)}'s share is worth <b>${M.fmtUSD(balance)}</b> today. Choose what happens to it. Either way it's recorded in the history.</p>
      <button class="choice" data-act="redeem"><b>Pay it out</b>
        ${R.esc(m.name)} takes out the full ${M.fmtUSD(balance)} and leaves. The fund is worth that much less.</button>
      ${others > 0 ? `<button class="choice" data-act="reassign"><b>Give the share to the others</b>
        The share is split between the other ${others === 1 ? "person" : others + " people"} by their shares. The fund's worth doesn't change.</button>` : ""}
      <div class="btnrow"><button class="btn quiet" data-act="">Cancel</button></div>`);
    if (!actn) return;
    const res = actn === "redeem" ? M.removeMemberRedeem(state, id) : M.removeMemberReassign(state, id);
    await store.commit(res.state, cleanEntry(res.entry), { removedMemberIds: [id] });
    $("members").focus();
  } catch (e) {
    R.feedback("fb-nm", e.message, true);
  }
}

async function editLedgerEntry(id) {
  const l = snap.ledger.find((x) => x.id === id);
  if (!l || !R.EDITABLE_TYPES.includes(l.type) || !state) return;
  const label = (R.TYPE_LABELS[l.type] || l.type).toLowerCase();
  const who = l.memberName ? `${R.esc(l.memberName)} · ` : "";
  const later = M.hasLaterMoves(snap.ledger, l);
  if (later && l.type !== "revaluation") {
    await modal(`<h3>This can't be corrected now</h3>
      <p>Money has moved since this record, so changing it would shift money between people. Record new money in or out instead.</p>
      <div class="btnrow"><button class="btn quiet" data-act="">Close</button></div>`);
    return;
  }
  const newerReval = l.type === "revaluation" && later;
  const how = l.type !== "revaluation"
    ? "It's undone exactly, then done again at the corrected amount. Everyone's share follows."
    : newerReval
      ? "Money has moved or the worth was updated since, so only this record changes."
      : "Today's worth moves by the same difference, and this record is replaced.";
  const prefill = (l.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { act, value } = await modalAsk(`<h3>Correct the amount (${label})</h3>
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
      if (target <= 0) throw new M.ModelError("That would take the fund's worth to zero or below.");
      res = newerReval ? { state, entry: { type: "revaluation", amountCents: amount, unitsDeltaMicro: 0 } } : M.revalue(state, target);
      res.entry.amountCents = amount;
      res.entry.note = `corrected from ${M.fmtUSD(l.amountCents)}${newerReval ? ", record only" : ""}`;
    } else {
      const rev = M.reverseEntry(state, l);
      res = l.type === "deposit"
        ? M.deposit(rev.state, l.memberId, amount)
        : M.withdraw(rev.state, l.memberId, amount);
      if (l.dateLabel) res.entry.dateLabel = l.dateLabel;
      res.entry.note = `corrected from ${M.fmtUSD(l.amountCents)}`;
    }
    await store.commit(res.state, cleanEntry(res.entry), { deleteLedgerIds: [id] });
    $("ledger").focus();
  } catch (e) {
    await modal(`<h3>Couldn't apply the correction</h3><p>${R.esc(e.message)}</p>
      <div class="btnrow"><button class="btn quiet" data-act="">Close</button></div>`);
  }
}

async function deleteLedgerEntry(id) {
  const l = snap.ledger.find((x) => x.id === id);
  if (!l) return;
  const desc = `${R.TYPE_LABELS[l.type] || R.esc(l.type)}${l.memberName ? " · " + R.esc(l.memberName) : ""}${l.amountCents ? " · " + M.fmtUSD(l.amountCents) : ""}`;
  let rev = null, revErr = null;
  if (state && ["deposit", "withdrawal", "member-added"].includes(l.type)) {
    if (M.hasLaterMoves(snap.ledger, l)) revErr = "money has moved since, so undoing it would shift money between people. Record new money in or out instead.";
    else try { rev = M.reverseEntry(state, l); } catch (e) { revErr = e.message; }
  }
  try {
    const actn = await modal(`<h3>Delete this record?</h3>
      <p><b>${desc}</b></p>
      ${rev ? `<button class="choice" data-act="undo"><b>Undo it</b>
        Puts everyone's share and money back exactly as they were, as if it never happened, then deletes the record.</button>` : ""}
      ${revErr ? `<p style="font-size:13px">This can't be undone: ${R.esc(revErr)}</p>` : ""}
      <button class="choice" data-act="del"><b>Delete the record only</b>
        Shares and money stay exactly as they are. Only this line disappears from the history.</button>
      <div class="btnrow"><button class="btn quiet" data-act="">Cancel</button></div>`);
    if (actn === "undo" && rev) {
      await store.commit(rev.state, null, {
        removedMemberIds: rev.removedMemberId ? [rev.removedMemberId] : [],
        deleteLedgerIds: [id],
      });
    } else if (actn === "del") {
      await store.deleteLedger(id);
    }
    if (actn) $("ledger").focus();
  } catch (e) {
    console.error(e);
  }
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
  if (d.members.reduce((a, m) => a + (int(m.unitsMicro) ? m.unitsMicro : NaN), 0) !== c.totalUnitsMicro) return null;
  if (c.totalUnitsMicro <= 0 && c.marketValueCents > 0) return null;
  if (!d.members.every((m) => isId(m.id) && str(m.name, 80) && m.name.trim() && int(m.unitsMicro) && int(m.netContributedCents) && (m.createdAt === undefined || fin(m.createdAt)))) return null;
  if (!d.history.every((h) => isDate(h.date) && int(h.valueCents))) return null;
  if (!d.ledger.every((l) => l && typeof l.type === "string" && l.type in R.TYPE_LABELS
      && (l.amountCents === undefined || int(l.amountCents)) && (l.unitsDeltaMicro === undefined || int(l.unitsDeltaMicro))
      && (l.memberId === undefined || isId(l.memberId)) && (l.memberName === undefined || str(l.memberName, 80))
      && (l.note === undefined || str(l.note, 300)) && (l.dateLabel === undefined || isDate(l.dateLabel))
      && (l.atMs === undefined || fin(l.atMs)))) return null;
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
  return {
    app: d.app, exportedAt: str(d.exportedAt, 40) ? d.exportedAt : "",
    config: pick(c, ["marketValueCents", "totalUnitsMicro", "fxRate", "zakatPct"]),
    members: d.members.map((m) => pick(m, ["id", "name", "unitsMicro", "netContributedCents", "createdAt"])),
    history: d.history.map((h) => ({ date: h.date, valueCents: h.valueCents })),
    ledger: d.ledger.map((l) => pick(l, ["type", "memberId", "memberName", "amountCents", "unitsDeltaMicro", "note", "dateLabel", "atMs"])),
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
      `${members.length} people · worth ${M.fmtUSD(cfg ? cfg.marketValueCents : 0)}\n${ledger.length} history lines · ${history.length} saved worths`;
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
  document.querySelectorAll(".sect > *").forEach((c) => c.classList.add("rise"));
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
