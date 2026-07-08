// ============================================================
// Pointer tilt for the hero gyroscope. Desktop pointers only;
// touch devices keep the idle precession, reduced-motion gets
// a static seal. Transform-only, lerped through one rAF loop.
// ============================================================

export function initTilt() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const root = document.documentElement.style;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

  function loop() {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    root.setProperty("--gyro-y", cx.toFixed(3) + "deg");
    root.setProperty("--gyro-x", cy.toFixed(3) + "deg");
    raf = (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01)
      ? requestAnimationFrame(loop)
      : null;
  }
  function nudge() { if (!raf) raf = requestAnimationFrame(loop); }

  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 12;
    ty = -((e.clientY - r.top) / r.height - 0.5) * 9;
    nudge();
  });
  hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; nudge(); });
}
