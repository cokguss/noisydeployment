/* ============================================================================
   fx.js — canvas effects. Plain canvas + requestAnimationFrame (no framework
   state touched). All effects honour prefers-reduced-motion by rendering a
   single static frame instead of animating. The page background itself is now
   pure CSS (drifting neon orbs, see .bg in style.css) — no canvas grain.
   ==========================================================================*/
(function (ND) {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Hero visual: a field of points that flickers as noise, then eases
     into a clean grid ("signal"), holds, dissolves, and repeats. Motive: it
     literally illustrates the product name and the deploy story. */
  function initHero(canvas) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let pts = [];
    const COLS = 22, ROWS = 18;

    function build() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = [];
      const padX = W * 0.1, padY = H * 0.12;
      const gw = (W - padX * 2) / (COLS - 1);
      const gh = (H - padY * 2) / (ROWS - 1);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          pts.push({
            gx: padX + x * gw, gy: padY + y * gh,       // grid ("signal") target
            nx: Math.random() * W, ny: Math.random() * H, // noise position
            cx: Math.random() * W, cy: Math.random() * H, // current
          });
        }
      }
    }
    build();
    window.addEventListener("resize", build);

    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        ctx.fillStyle = "rgba(34,211,238,0.85)";
        ctx.fillRect(p.gx - 1, p.gy - 1, 2, 2);
      }
    }
    if (reduce) { drawStatic(); return; }

    // Cycle: 0..1 noise->signal (ease in), hold, 1..0 dissolve.
    let phase = 0; // 0 gather, 1 hold, 2 scatter
    let k = 0, holdT = 0;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    (function loop() {
      ctx.clearRect(0, 0, W, H);
      if (phase === 0) { k += 0.012; if (k >= 1) { k = 1; phase = 1; holdT = 0; } }
      else if (phase === 1) { holdT += 1; if (holdT > 130) phase = 2; }
      else { k -= 0.016; if (k <= 0) { k = 0; phase = 0; for (const p of pts) { p.nx = Math.random() * W; p.ny = Math.random() * H; } } }

      const e = easeOut(Math.max(0, Math.min(1, k)));
      for (const p of pts) {
        const tx = p.nx + (p.gx - p.nx) * e;
        const ty = p.ny + (p.gy - p.ny) * e;
        // jitter fades out as the grid resolves
        const j = (1 - e) * 6;
        p.cx = tx + (Math.random() - 0.5) * j;
        p.cy = ty + (Math.random() - 0.5) * j;
        const a = 0.25 + e * 0.65;
        // hint of violet in the noisy phase, pure cyan once resolved (ambient only)
        ctx.fillStyle = e > 0.7
          ? "rgba(34,211,238," + a + ")"
          : "rgba(167,139,250," + (a * 0.8) + ")";
        const s = 1 + e;
        ctx.fillRect(p.cx - s / 2, p.cy - s / 2, s, s);
      }

      // faint connecting lines once mostly resolved — reads as a wireframe
      if (e > 0.6) {
        ctx.strokeStyle = "rgba(34,211,238," + ((e - 0.6) * 0.4) + ")";
        ctx.lineWidth = 0.5;
        for (let y = 0; y < ROWS; y++) {
          ctx.beginPath();
          for (let x = 0; x < COLS; x++) {
            const p = pts[y * COLS + x];
            if (x === 0) ctx.moveTo(p.cx, p.cy); else ctx.lineTo(p.cx, p.cy);
          }
          ctx.stroke();
        }
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ---- Success burst: a short particle pop centered on an element (motive:
     reward feedback on a completed deploy). Spawns a throwaway viewport-sized
     overlay, animates, then removes itself. Safe under reduced motion. */
  function burst(centerEl) {
    if (reduce || !centerEl) return;
    const rect = centerEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:70";
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ["52,211,153", "34,211,238", "167,139,250"];
    const parts = [];
    for (let i = 0; i < 110; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      parts.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        life: 1, c: colors[i % colors.length], s: 2 + Math.random() * 2,
      });
    }
    let frames = 0;
    (function loop() {
      frames++;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = false;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.99; p.life -= 0.018;
        ctx.fillStyle = "rgba(" + p.c + "," + Math.max(0, p.life) + ")";
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      if (alive && frames < 90) requestAnimationFrame(loop);
      else cv.remove();
    })();
  }

  ND.fx = { initHero: initHero, burst: burst, reduced: reduce };
})(window.ND);
