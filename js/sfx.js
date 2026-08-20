/* ============================================================================
   sfx.js — synthetic click sound. The click is synthesized ONCE with the Web
   Audio API (a highpassed noise burst layered with a fast square sweep, matched
   to noisyuploader.vercel.app), rendered to a small WAV clip, and then played
   through a pool of <audio> elements. This matters on mobile Safari: a live
   AudioContext is aggressively suspended in the background, which made clicks
   lag (async resume) or drop out entirely. HTMLAudio elements are not suspended
   that way, play instantly once unlocked, and stay reliable across app-switches.
   Users can mute it; the choice is remembered.
   ==========================================================================*/
(function (ND) {
  "use strict";

  const U = ND.util;
  const STORE_KEY = "nd.sound";

  // Enabled unless the user muted it before. Sound is not motion, so we do NOT
  // couple this to prefers-reduced-motion.
  let enabled = (function () {
    const saved = U.load(STORE_KEY, false);
    if (saved === "off") return false;
    return true;
  })();

  /* ---------------------------------------------------------- clip rendering */
  const SR = 44100;
  const DUR = 0.035; // seconds of audio in the clip
  let clipUrl = null;    // blob: URL of the rendered WAV
  let pool = [];         // pooled HTMLAudioElement instances
  let poolIdx = 0;
  const POOL_SIZE = 6;   // enough voices for rapid clicking
  let primed = false;    // pool has been unlocked inside a user gesture

  // Encode a mono Float32 sample array as a 16-bit PCM WAV blob.
  function encodeWav(samples, sampleRate) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const view = new DataView(buf);
    const wr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    wr(0, "RIFF");
    view.setUint32(4, 36 + n * 2, true);
    wr(8, "WAVE");
    wr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);          // PCM
    view.setUint16(22, 1, true);          // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    wr(36, "data");
    view.setUint32(40, n * 2, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return new Blob([view], { type: "audio/wav" });
  }

  // Render the click offline (once) so the exact filtered/synthesized tone is
  // baked into a clip, then wire up the <audio> pool. Offline rendering does not
  // need a user gesture, so we can do this at load.
  function buildClip() {
    if (clipUrl) return Promise.resolve();
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) { buildClipManually(); return Promise.resolve(); }

    let oc;
    try { oc = new OAC(1, Math.ceil(SR * DUR), SR); }
    catch (_) { buildClipManually(); return Promise.resolve(); }

    const t = 0;
    // Noise layer: 30ms buffer shaped by an exponential fade, highpassed.
    const nlen = Math.floor(SR * 0.03);
    const nbuf = oc.createBuffer(1, nlen, SR);
    const nd = nbuf.getChannelData(0);
    for (let c = 0; c < nlen; c++) nd[c] = (Math.random() * 2 - 1) * Math.pow(1 - c / nlen, 2.5);
    const src = oc.createBufferSource(); src.buffer = nbuf;
    const nGain = oc.createGain();
    nGain.gain.setValueAtTime(0.18, t);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    const hp = oc.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
    src.connect(hp); hp.connect(nGain); nGain.connect(oc.destination);

    // Tone layer: square wave sweeping 2400 -> 900 Hz, barely audible.
    const osc = oc.createOscillator(); osc.type = "square";
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.02);
    const oGain = oc.createGain();
    oGain.gain.setValueAtTime(0.05, t);
    oGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    osc.connect(oGain); oGain.connect(oc.destination);

    src.start(t); osc.start(t); osc.stop(t + 0.03);

    return oc.startRendering().then((rendered) => {
      finishClip(rendered.getChannelData(0));
    }).catch(() => { buildClipManually(); });
  }

  // Fallback if OfflineAudioContext is unavailable: approximate the click by
  // synthesizing samples directly (no biquad; a simple high-frequency emphasis).
  function buildClipManually() {
    const n = Math.floor(SR * 0.03);
    const s = new Float32Array(n);
    let prev = 0;
    for (let c = 0; c < n; c++) {
      const env = Math.pow(1 - c / n, 2.5);
      const noise = (Math.random() * 2 - 1) * env * 0.18;
      const hp = noise - prev; prev = noise; // crude high-pass (difference)
      const freq = 2400 + (900 - 2400) * (c / n);
      const tone = (Math.sin(2 * Math.PI * freq * (c / SR)) > 0 ? 1 : -1) * 0.05 * env;
      s[c] = Math.max(-1, Math.min(1, hp + tone));
    }
    finishClip(s);
  }

  function finishClip(samples) {
    try {
      clipUrl = URL.createObjectURL(encodeWav(samples, SR));
      for (let i = 0; i < POOL_SIZE; i++) {
        const a = new Audio(clipUrl);
        a.preload = "auto";
        a.volume = 1;
        pool.push(a);
      }
      if (wantPrime) primePool();
    } catch (_) { /* leave clipUrl null; press() becomes a no-op */ }
  }

  // iOS/Safari require the first play() to happen inside a user gesture. Kick
  // each pooled element once (play then immediately pause+rewind) so later
  // plays are allowed and instant.
  let wantPrime = false;
  function primePool() {
    if (primed || !pool.length) return;
    primed = true;
    pool.forEach((a) => {
      try {
        const p = a.play();
        if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
        else { a.pause(); a.currentTime = 0; }
      } catch (_) { /* best effort */ }
    });
  }

  // Called from the first real gesture. Ensures the clip exists and the pool is
  // unlocked. If the clip isn't rendered yet, prime as soon as it is.
  function unlock() {
    wantPrime = true;
    if (!clipUrl) { buildClip(); return; }
    primePool();
  }

  /* ------------------------------------------------------------------ play */
  function tick() {
    if (!enabled || !pool.length) return;
    // Round-robin so rapid clicks don't cut each other off.
    const a = pool[poolIdx];
    poolIdx = (poolIdx + 1) % pool.length;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* ignore */ }
  }

  function press() { tick(); }
  function soft() { tick(); }

  function setEnabled(on) {
    enabled = !!on;
    U.store(STORE_KEY, enabled ? "on" : "off");
    if (enabled) { unlock(); press(); } // audible confirmation when turning on
  }
  function toggle() { setEnabled(!enabled); return enabled; }
  function isEnabled() { return enabled; }

  /* ------------------------------------------------------------------ wire */
  // Only play on real taps/clicks — not while scrolling or dragging. We remember
  // where the pointer went down and play on pointerup when it barely moved and
  // was quick.
  const TAP_MOVE = 10;   // px of slop allowed for a "tap"
  const TAP_TIME = 600;  // ms; a long press-and-hold isn't a click either
  function wire() {
    if (document.__ndSfxWired) return; // idempotent
    document.__ndSfxWired = true;

    // Render the clip up front so it's ready before the first interaction.
    buildClip();

    // First real gesture unlocks/primes the audio pool. Safari unlocks most
    // reliably on touchend/click, so listen on several.
    const unlockOnce = () => { unlock(); };
    ["touchstart", "touchend", "pointerdown", "click"].forEach(function (evt) {
      document.addEventListener(evt, unlockOnce, { capture: true, passive: true });
    });

    let down = null; // { x, y, t, id }
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) { down = null; return; }
      unlock();
      down = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    }, true);

    document.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== down.id) return;
      if (Math.abs(e.clientX - down.x) > TAP_MOVE || Math.abs(e.clientY - down.y) > TAP_MOVE) down = null;
    }, { capture: true, passive: true });

    document.addEventListener("pointercancel", () => { down = null; }, true);

    document.addEventListener("pointerup", (e) => {
      const d = down;
      down = null;
      if (!enabled || !d || e.pointerId !== d.id) return;
      if (Date.now() - d.t > TAP_TIME) return;
      if (Math.abs(e.clientX - d.x) > TAP_MOVE || Math.abs(e.clientY - d.y) > TAP_MOVE) return;
      const ctl = e.target && e.target.closest && e.target.closest("button, input, select, textarea, a, [role='button']");
      if (ctl && ctl.disabled) return;
      press();
    }, true);
  }

  ND.sfx = {
    press: press, soft: soft,
    setEnabled: setEnabled, toggle: toggle, isEnabled: isEnabled,
    wire: wire,
  };
})(window.ND);
