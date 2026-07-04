// ============================================================
// ALBASSAM — PRIVATE FAMILY OFFICE · configuration
// This is the standard public Firebase web config (safe to
// publish). Writes are enforced by Firestore security rules,
// not by secrecy of these values.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAqE1RBIxQ_OZ01hyUcuakU46tElOPbwqg",
  authDomain: "albassam-fund.firebaseapp.com",
  projectId: "albassam-fund",
  storageBucket: "albassam-fund.firebasestorage.app",
  messagingSenderId: "882020792950",
  appId: "1:882020792950:web:d6be1279a2903c52277d57",
};

// Only this verified Google account may write (mirrored in
// firestore.rules — the rules are the real enforcement).
export const OWNER_EMAIL = "azizbassam2018@gmail.com";

// Firestore namespace for this app (the fund tracker uses /trades).
export const NS = "familyOffice";
export const OFFICE_DOC = "office";

// Demo mode (?demo=1): in-memory sample data, no network, no auth.
// Used for design review and local acceptance testing.
export const DEMO = new URLSearchParams(location.search).has("demo");
