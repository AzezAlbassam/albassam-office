// ============================================================
// App bootstrap + actions. index.html calls boot({ edit:false }),
// edit.html calls boot({ edit:true }).
//
// Every state-changing action:
//   model (pure) → store.commit (atomic) → realtime listeners
//   re-render every open client. The UI never mutates locally.
// ============================================================

import * as M from "./model.js";
import * as R from "./render.js";
import { DEMO, OWNER_EMAIL } from "./config.js";
import { FirestoreStore, MemoryStore } from "./store.js";

let store = null;
let snap = null;      // latest raw snapshot from the store
let state = null;     // model state derived from snap (null = not founded)
let editUI = false;   // edit surface active (authed owner, or demo)

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);

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

function cleanEntry(e) {
  const o = {};
  for (const k of Object.keys(e)) if (e[k] !== undefined && e[k] !== null && e[k] !== "") o[k] = e[k];
  return o;
}

// ---------- rendering ----------

function renderAll() {
  const founded = !!state;
  document.querySelectorAll("[data-needs-office]").forEach((n) => { n.hidden = !founded; });
  const founding = $("founding");
  if (founding) founding.hidden = founded || !editUI;

  R.renderHero(state);
  R.renderSeal(state);
  R.renderStats(state);
  R.renderMembers(state, editUI);
  R.renderHistory(snap ? snap.history : [], state ? state.fxRate : 3.75, editUI);
  R.renderLedger(snap ? snap.ledger : []);
  R.populateMemberSelects(state);

  if (editUI && state) {
    if ($("st-fx") && document.activeElement !== $("st-fx")) $("st-fx").value = state.fxRate;
    if ($("st-zakat") && document.activeElement !== $("st-zakat")) $("st-zakat").value = state.zakatPct;
  }
}

function onSnap(s, err) {
  if (err) {
    $("loading") && ($("loading").hidden = true);
    $("main-shell").hidden = false;
    $("main-shell").innerHTML = `<div class="empty">Couldn't reach the data service. Check your connection and reload.</div>`;
    return;
  }
  snap = s;
  state = buildState(s);
  $("loading") && ($("loading").hidden = true);
  $("main-shell").hidden = false;
  renderAll();
}

// ---------- modal ----------

function modal(html) {
  return new Promise((resolve) => {
    const host = $("modal-host");
    host.innerHTML = `<div class="modal-veil"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const done = (act) => { host.innerHTML = ""; resolve(act); };
    host.querySelector(".modal-veil").addEventListener("click", (e) => { if (e.target === e.currentTarget) done(null); });
    host.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => done(b.dataset.act)));
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { document.removeEventListener("keydown", esc); done(null); }
    });
    const first = host.querySelector("button"); if (first) first.focus();
  });
}

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
      <p>${R.esc(m.name)} currently holds <b style="color:#EAE6DD">${M.fmtUSD(balance)}</b>. That value cannot be silently destroyed — choose how to settle it. Both paths are recorded in the ledger.</p>
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

async function deleteHistoryPoint(id) {
  const h = snap.history.find((x) => x.id === id);
  if (!h) return;
  const actn = await modal(`<h3>Delete history point?</h3>
    <p>${h.date} · ${M.fmtUSD(h.valueCents)} will be removed from the chart. The ledger is not affected.</p>
    <div class="btnrow"><button class="btn danger" data-act="del">Delete point</button>
    <button class="btn quiet" data-act="">Cancel</button></div>`);
  if (actn === "del") await store.deleteHistory(id);
}

// ---------- founding ----------

function addFoundingRow() {
  const row = document.createElement("div");
  row.className = "found-row";
  row.style.cssText = "display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-bottom:10px";
  row.innerHTML = `<input type="text" placeholder="Member name" data-f-name>
    <input type="text" inputmode="decimal" placeholder="Current value $" data-f-value>
    <input type="text" inputmode="decimal" placeholder="Contributed $ (optional)" data-f-contrib>`;
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

function exportBackup() {
  const data = {
    app: "albassam-family-office",
    version: 1,
    exportedAt: new Date().toISOString(),
    config: snap.config,
    members: snap.members,
    history: snap.history,
    ledger: snap.ledger,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `albassam-office-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  R.feedback("fb-bk", "Backup downloaded.", false);
}

function validBackup(d) {
  return d && d.app === "albassam-family-office" && d.config
    && Number.isInteger(d.config.marketValueCents) && Number.isInteger(d.config.totalUnitsMicro)
    && Array.isArray(d.members) && d.members.every((m) => m.id && m.name && Number.isInteger(m.unitsMicro) && Number.isInteger(m.netContributedCents))
    && Array.isArray(d.history) && Array.isArray(d.ledger);
}

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!validBackup(data)) throw new M.ModelError("That file is not a valid office backup.");
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

// ---------- auth (edit mode) ----------

async function setupAuth() {
  const A = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js");
  const auth = A.getAuth(store.app);
  $("gate-btn").addEventListener("click", async () => {
    try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); }
    catch (err) { $("gate-msg").textContent = err.message; }
  });
  $("signout-btn").addEventListener("click", () => A.signOut(auth));
  A.onAuthStateChanged(auth, (user) => {
    const owner = user && user.email === OWNER_EMAIL;
    if (user && !owner) {
      $("gate-msg").textContent = `${user.email} is not authorized to manage this office.`;
      A.signOut(auth);
    }
    editUI = !!owner;
    $("gate").hidden = editUI;
    $("edit-shell").hidden = !editUI;
    $("whoami").textContent = owner ? user.email : "";
    renderAll();
  });
}

// ---------- boot ----------

export async function boot({ edit }) {
  store = DEMO ? new MemoryStore() : new FirestoreStore();
  await store.init();

  if (edit) {
    wireEditActions();
    if (DEMO) {
      editUI = true;
      $("gate").hidden = true;
      $("edit-shell").hidden = false;
      $("whoami").textContent = "Demo steward";
    } else {
      await setupAuth();
    }
  }

  if (DEMO) document.querySelectorAll("[data-demo-pill]").forEach((n) => { n.hidden = false; });
  store.subscribe(onSnap);
}
