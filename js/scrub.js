// ============================================================
// The falaj hero: scroll-scrubbed video with paced caption bands.
// Standard: Blob fetch behind a ring (with watchdog), dt-normalized
// lerp in a resting rAF loop, gated seeks, delta-gated DOM writes,
// five live static-hero gates, reduced motion in both directions,
// and a page that is complete if the video never arrives.
// ============================================================

const VIDEO_URL = "assets/hero-scrub.mp4";
const VIDEO_BYTES = 5085036;   // fallback when Content-Length is missing
const POSTER_URL = "assets/hero-poster.jpg";

// Must match the CSS media queries character for character.
const GATES = [
  "(max-width: 720px)",
  "(orientation: portrait) and (max-width: 1024px)",
  "(orientation: portrait) and (pointer: coarse)",
  "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
  "(prefers-reduced-motion: reduce)",
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (p, e0, e1) => {
  const t = clamp((p - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// Split each [data-split] line into word and character spans once.
// Screen readers get the plain sentence; the visual copy is aria-hidden.
function splitBand(band, seed) {
  const r = rng(seed);
  band.querySelectorAll("[data-split]").forEach((el) => {
    const text = el.textContent.trim();
    const mode = el.dataset.split;            // "words" | "chars"
    const spread = +(band.dataset.spread || 0.5);
    el.textContent = "";
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    const vis = document.createElement("span");
    vis.setAttribute("aria-hidden", "true");
    const words = text.split(" ");
    const totalChars = text.replace(/ /g, "").length;
    let ci = 0;
    words.forEach((w, wi) => {
      const ws = document.createElement("span");
      ws.className = "w";
      if (mode === "words") {
        ws.style.setProperty("--th", (wi / Math.max(1, words.length) * 0.55).toFixed(3));
        ws.textContent = w;
      } else {
        for (const ch of w) {
          const cs = document.createElement("span");
          cs.className = "c";
          cs.textContent = ch;
          cs.style.setProperty("--th", (ci / Math.max(1, totalChars) * spread + r() * 0.06).toFixed(3));
          cs.style.setProperty("--jx", `${(-14 - r() * 18).toFixed(1)}px`);
          ci++;
          ws.appendChild(cs);
        }
      }
      vis.appendChild(ws);
      if (wi < words.length - 1) vis.appendChild(document.createTextNode(" "));
    });
    el.append(sr, vis);
  });
}

export function initHero() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const stage = hero.querySelector(".stage");
  const video = hero.querySelector("video");
  const posterLayer = hero.querySelector(".poster");
  const ring = hero.querySelector(".ring");
  const bands = [...hero.querySelectorAll(".band")].map((el, i) => {
    splitBand(el, 1009 * (i + 1));
    return { el, a: +el.dataset.a, b: +el.dataset.b, ramp: +(el.dataset.ramp || 0), op: -1, k: -1, first: i === 0 };
  });
  const lastIndex = bands.length - 1;

  // ---------- geometry ----------
  function heroProgress() {
    const r = hero.getBoundingClientRect();
    const range = hero.offsetHeight - innerHeight;
    return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
  }

  // ---------- captions (delta-gated) ----------
  let loadK = 0;
  function updateCaptions(p) {
    bands.forEach((b, i) => {
      const f = Math.min(0.02, (b.b - b.a) / 3);
      const inO = i === 0 ? 1 : smoothstep(p, b.a, b.a + f);
      const outO = i === lastIndex ? 1 : 1 - smoothstep(p, b.b - f, b.b);
      const op = p < b.a - 0.0001 && i !== 0 ? 0 : inO * outO;
      const ramp = b.ramp || Math.min(0.025, (b.b - b.a) * 0.35);
      let k = clamp((p - b.a) / ramp, 0, 1);
      if (b.first) k = Math.max(k, loadK);
      if (Math.abs(op - b.op) > 0.004) { b.op = op; b.el.style.opacity = op.toFixed(3); b.el.classList.toggle("on", op > 0.02); }
      if (Math.abs(k - b.k) > 0.008 || (k === 1 && b.k !== 1)) { b.k = k; b.el.style.setProperty("--k", k.toFixed(3)); }
    });
  }

  // band one assembles on load, then hands over to scroll
  function loadRamp() {
    const t0 = performance.now();
    const step = (now) => {
      loadK = Math.min(1, (now - t0) / 1100);
      loadK = 1 - Math.pow(1 - loadK, 3);
      updateCaptions(heroProgress());
      if (loadK < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- gated seeks ----------
  let seekBusy = false, pendingTime = null;
  function requestSeek(t) {
    if (!video.duration || !videoReady) return;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true;
    video.currentTime = t;
  }
  video.addEventListener("seeked", () => {
    seekBusy = false;
    if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener("error", () => { seekBusy = false; pendingTime = null; failVideo(); });

  // ---------- the resting lerp loop ----------
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true, videoReady = false;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) { shown = target; rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
    if (videoReady) requestSeek(shown * video.duration);
    updateCaptions(shown);
  }
  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }
  new IntersectionObserver((es) => { heroOnScreen = es[0].isIntersecting; if (heroOnScreen) onScroll(); })
    .observe(hero);

  // ---------- the Blob loader (streamed, with ring + watchdog) ----------
  let heroInit = false;
  function initHeroOnce() {
    if (heroInit) return;
    heroInit = true;
    posterLayer.style.backgroundImage = `url('${POSTER_URL}')`;
    let started = false;
    const start = () => { if (started) return; started = true; loadHeroBlob().catch(failVideo); };
    const img = new Image();
    img.onload = start; img.onerror = start; img.src = POSTER_URL;
    setTimeout(start, 4000);
  }
  async function loadHeroBlob() {
    const ctrl = new AbortController();
    let watchdog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(VIDEO_URL, { priority: "low", signal: ctrl.signal });
    if (!res.ok || !res.body) throw new Error("video " + res.status);
    const total = Number(res.headers.get("Content-Length")) || VIDEO_BYTES;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0, lastRing = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => ctrl.abort(), 20000);
      chunks.push(value);
      got += value.length;
      const frac = Math.min(1, got / total);
      const now = performance.now();
      if (now - lastRing > 100 || frac === 1) { lastRing = now; ring.style.setProperty("--ld", Math.round(126 * (1 - frac))); }
    }
    clearTimeout(watchdog);
    ring.style.setProperty("--ld", 0);
    video.src = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
    video.load();
    video.addEventListener("canplay", () => {
      videoReady = true;
      stage.classList.add("video-ready");
      requestSeek(heroProgress() * video.duration);
    }, { once: true });
  }
  function failVideo() {
    stage.classList.add("video-failed");
  }

  // ---------- reduced motion and the five gates, live ----------
  function pinToFinalStates() {
    document.documentElement.classList.add("pinned");
    bands.forEach((b) => { b.op = 1; b.k = 1; b.el.style.opacity = "1"; b.el.style.setProperty("--k", "1"); });
  }
  function unpinFinalStates() {
    document.documentElement.classList.remove("pinned");
  }
  let scrubOn = false;
  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    initHeroOnce();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    bands.forEach((b) => { b.op = -1; b.k = -1; });
    unpinFinalStates();
    updateCaptions(heroProgress());
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function applyHeroMode() {
    if (GATES.some((q) => matchMedia(q).matches)) disableScrub();
    else enableScrub();
  }
  const MQLS = GATES.map((q) => matchMedia(q));
  MQLS.forEach((m) => m.addEventListener("change", applyHeroMode));
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
    if (e.matches) pinToFinalStates();
    else applyHeroMode();
  });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) pinToFinalStates();
  applyHeroMode();
  if (scrubOn) loadRamp();

  return { heroProgress, MQLS };
}
