// ============================================================
// Storage layer. Two interchangeable stores:
//   FirestoreStore — live data, realtime onSnapshot, batched
//                    atomic writes. Reads public, writes gated
//                    by security rules to the owner's account.
//   MemoryStore    — ?demo=1: seeded sample data, no network.
//
// Snapshot shape passed to subscribers:
//   {
//     config:  null | { marketValueCents, totalUnitsMicro, fxRate, zakatPct },
//     members: [{ id, name, unitsMicro, netContributedCents, createdAt }],
//     history: [{ id, date, valueCents }]           (sorted by date asc),
//     ledger:  [{ id, type, memberName?, amountCents, unitsDeltaMicro, note?, dateLabel?, atMs }] (newest first),
//   }
// ============================================================

import { NS, OFFICE_DOC, firebaseConfig } from "./config.js";

// ---------- Firestore ----------

export class FirestoreStore {
  async init() {
    const [{ initializeApp }, fs] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"),
    ]);
    this.fs = fs;
    this.app = initializeApp(firebaseConfig);
    this.db = fs.getFirestore(this.app);
    this.parts = { config: undefined, members: undefined, history: undefined, ledger: undefined };
    this.subscribers = [];
  }

  officeRef() { return this.fs.doc(this.db, NS, OFFICE_DOC); }
  colRef(name) { return this.fs.collection(this.db, NS, OFFICE_DOC, name); }

  subscribe(cb) {
    this.subscribers.push(cb);
    if (this.unsubs) { this.emit(); return; }
    const { onSnapshot, query, orderBy, limit } = this.fs;
    const push = (key, val) => { this.parts[key] = val; this.emit(); };
    this.unsubs = [
      onSnapshot(this.officeRef(), (d) => push("config", d.exists() ? d.data() : null),
        (e) => this.fail(e)),
      onSnapshot(this.colRef("members"), (qs) => {
        push("members", qs.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (e) => this.fail(e)),
      onSnapshot(query(this.colRef("history"), orderBy("date", "asc")), (qs) => {
        push("history", qs.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (e) => this.fail(e)),
      onSnapshot(query(this.colRef("ledger"), orderBy("at", "desc"), limit(300)), (qs) => {
        push("ledger", qs.docs.map((d) => {
          const x = d.data();
          return { id: d.id, ...x, atMs: x.at && x.at.toMillis ? x.at.toMillis() : Date.now() };
        }));
      }, (e) => this.fail(e)),
    ];
  }

  fail(e) {
    console.error("Firestore listener error", e);
    this.subscribers.forEach((cb) => cb(null, e));
  }

  emit() {
    const p = this.parts;
    if (p.config === undefined || !p.members || !p.history || !p.ledger) return;
    const snap = {
      config: p.config,
      members: [...p.members].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.name.localeCompare(b.name)),
      history: p.history,
      ledger: p.ledger,
    };
    this.subscribers.forEach((cb) => cb(snap));
  }

  // Persist a model state + one ledger entry atomically.
  // opts: { removedMemberIds?: [], history?: { date, valueCents } }
  async commit(state, entry, opts = {}) {
    const { writeBatch, doc, serverTimestamp } = this.fs;
    const b = writeBatch(this.db);
    b.set(this.officeRef(), {
      marketValueCents: state.marketValueCents,
      totalUnitsMicro: state.totalUnitsMicro,
      fxRate: state.fxRate,
      zakatPct: state.zakatPct,
      updatedAt: serverTimestamp(),
    });
    for (const m of state.members) {
      b.set(doc(this.colRef("members"), m.id), {
        name: m.name,
        unitsMicro: m.unitsMicro,
        netContributedCents: m.netContributedCents,
        createdAt: m.createdAt,
      });
    }
    for (const id of opts.removedMemberIds || []) b.delete(doc(this.colRef("members"), id));
    if (entry) b.set(doc(this.colRef("ledger")), { ...entry, at: serverTimestamp() });
    if (opts.history) {
      b.set(doc(this.colRef("history"), opts.history.date), {
        date: opts.history.date,
        valueCents: opts.history.valueCents,
      });
    }
    await b.commit();
  }

  async upsertHistory(date, valueCents) {
    const { setDoc, doc } = this.fs;
    await setDoc(doc(this.colRef("history"), date), { date, valueCents });
  }

  async deleteHistory(id) {
    const { deleteDoc, doc } = this.fs;
    await deleteDoc(doc(this.colRef("history"), id));
  }

  // Full restore from a backup file: wipe namespace, rewrite.
  async importAll(data) {
    const { writeBatch, doc, getDocs, serverTimestamp, Timestamp } = this.fs;
    const wipe = writeBatch(this.db);
    for (const col of ["members", "history", "ledger"]) {
      const qs = await getDocs(this.colRef(col));
      qs.docs.forEach((d) => wipe.delete(d.ref));
    }
    await wipe.commit();
    const b = writeBatch(this.db);
    b.set(this.officeRef(), { ...data.config, updatedAt: serverTimestamp() });
    for (const m of data.members) {
      const { id, ...rest } = m;
      b.set(doc(this.colRef("members"), id), rest);
    }
    for (const h of data.history) b.set(doc(this.colRef("history"), h.date), { date: h.date, valueCents: h.valueCents });
    for (const l of data.ledger) {
      const { id, atMs, ...rest } = l;
      b.set(doc(this.colRef("ledger")), { ...rest, at: Timestamp.fromMillis(atMs || Date.now()) });
    }
    b.set(doc(this.colRef("ledger")), {
      type: "import", amountCents: 0, unitsDeltaMicro: 0,
      note: `backup restored (${data.members.length} members, ${data.ledger.length} ledger entries)`,
      at: serverTimestamp(),
    });
    await b.commit();
  }
}

// ---------- In-memory demo ----------

const DAY = 86400000;
function demoSeed() {
  const now = Date.now();
  const d = (n) => new Date(now - n * DAY).toISOString().slice(0, 10);
  const members = [
    { id: "demoA", name: "Abdulaziz", unitsMicro: 153656600 * 1000, netContributedCents: 14499100, createdAt: now - 220 * DAY },
    { id: "demoM", name: "Mom", unitsMicro: 115128800 * 1000, netContributedCents: 10848200, createdAt: now - 220 * DAY },
    { id: "demoT", name: "Turki", unitsMicro: 17614600 * 1000, netContributedCents: 1639600, createdAt: now - 160 * DAY },
  ];
  return {
    config: {
      marketValueCents: 28640000,
      totalUnitsMicro: members.reduce((a, m) => a + m.unitsMicro, 0),
      fxRate: 3.75,
      zakatPct: 2.5,
    },
    members,
    history: [
      { id: d(180), date: d(180), valueCents: 24100000 },
      { id: d(150), date: d(150), valueCents: 24960000 },
      { id: d(120), date: d(120), valueCents: 23310000 },
      { id: d(90), date: d(90), valueCents: 26480000 },
      { id: d(60), date: d(60), valueCents: 27020000 },
      { id: d(30), date: d(30), valueCents: 27950000 },
      { id: d(0), date: d(0), valueCents: 28640000 },
    ],
    ledger: [
      { id: "l3", type: "revaluation", amountCents: 28640000, unitsDeltaMicro: 0, note: "monthly mark", atMs: now - 2 * DAY },
      { id: "l2", type: "deposit", memberName: "Turki", amountCents: 500000, unitsDeltaMicro: 4832000000, atMs: now - 40 * DAY },
      { id: "l1", type: "founding", amountCents: 24100000, unitsDeltaMicro: 241000000000, atMs: now - 220 * DAY },
    ],
  };
}

export class MemoryStore {
  async init() {
    // ?demo=1&empty=1 exercises the first-run founding flow.
    this.data = new URLSearchParams(location.search).has("empty")
      ? { config: null, members: [], history: [], ledger: [] }
      : demoSeed();
    this.subscribers = [];
  }

  subscribe(cb) { this.subscribers.push(cb); this.emit(); }

  emit() {
    const d = this.data;
    const snap = {
      config: d.config ? { ...d.config } : null,
      members: d.members.map((m) => ({ ...m })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
      history: [...d.history].sort((a, b) => a.date.localeCompare(b.date)),
      ledger: [...d.ledger].sort((a, b) => b.atMs - a.atMs),
    };
    this.subscribers.forEach((cb) => cb(snap));
  }

  async commit(state, entry, opts = {}) {
    this.data.config = {
      marketValueCents: state.marketValueCents,
      totalUnitsMicro: state.totalUnitsMicro,
      fxRate: state.fxRate,
      zakatPct: state.zakatPct,
    };
    this.data.members = state.members.map((m) => ({ ...m }));
    if (entry) this.data.ledger.push({ ...entry, id: "l" + Math.random().toString(36).slice(2), atMs: Date.now() });
    if (opts.history) await this.upsertHistory(opts.history.date, opts.history.valueCents, true);
    this.emit();
  }

  async upsertHistory(date, valueCents, silent) {
    const f = this.data.history.find((h) => h.date === date);
    if (f) f.valueCents = valueCents;
    else this.data.history.push({ id: date, date, valueCents });
    if (!silent) this.emit();
  }

  async deleteHistory(id) {
    this.data.history = this.data.history.filter((h) => h.id !== id);
    this.emit();
  }

  async importAll(data) {
    this.data = {
      config: { ...data.config },
      members: data.members.map((m) => ({ ...m })),
      history: data.history.map((h) => ({ ...h, id: h.date })),
      ledger: data.ledger.map((l) => ({ ...l })),
    };
    this.data.ledger.push({
      id: "imp" + Date.now(), type: "import", amountCents: 0, unitsDeltaMicro: 0,
      note: `backup restored (${data.members.length} members)`, atMs: Date.now(),
    });
    this.emit();
  }
}
