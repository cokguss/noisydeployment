/* ============================================================================
   sfx.js — synthetic click sounds via the Web Audio API. No audio files: every
   sound is generated on the fly, so it adds zero bytes to the page weight and
   stays crisp at any volume. A single global click listener plays a soft tick
   on interactive elements. Users can mute it; the choice is remembered, and
   prefers-reduced-motion starts muted by default.
   ==========================================================================*/
(function (ND) {
  "use strict";

  const U = ND.util;
  const STORE_KEY = "nd.sound";

  // Enabled unless the user muted it before. Sound is not motion, so we do NOT
  // couple this to prefers-reduced-motion — otherwise phones with Reduce Motion
  // on (common, and sometimes auto-enabled) would stay silent for no reason.
  let enabled = (function () {
    const saved = U.load(STORE_KEY, false);
    if (saved === "off") return false;
    return true; // default on for everyone; explicit mute is remembered
  })();

  let ctx = null;
  // Browsers block audio until the first user gesture; create lazily. We do NOT
  // resume() here — resume is async, and callers must not schedule sound until
  // the context is actually "running" (see tick()), or mobile drops the audio.
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  // Mobile (esp. iOS Safari) keeps the AudioContext suspended until it is
  // resumed inside a real user gesture, and some browsers also want an actual
  // buffer started once. Run this on the first touch/pointer so later ticks
  // reliably sound. resume() is async; we don't await it here.
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    const ac = audio();
    if (!ac) return;
    unlocked = true;
    try { ac.resume(); } catch (_) { /* best effort */ }
    try {
      const b = ac.createBuffer(1, 1, 22050);
      const s = ac.createBufferSource();
      s.buffer = b;
      s.connect(ac.destination);
      s.start(0);
    } catch (_) { /* best effort */ }
  }

  // A short, quiet mechanical click matched to noisyuploader.vercel.app: a
  // highpassed white-noise burst (the "tick" texture) layered with a fast
  // square-wave pitch sweep. ~30ms total, both layers very soft.
  function tick() {
    if (!enabled) return;
    const ac = audio();
    if (!ac) return;
    // If the context isn't running yet (very first taps on mobile), resume it
    // and play once it's actually running so the sound isn't scheduled into a
    // suspended context and silently dropped.
    if (ac.state !== "running") {
      ac.resume().then(playTick).catch(function () {});
      return;
    }
    playTick();
  }

  function playTick() {
    const ac = ctx;
    if (!ac || ac.state !== "running") return;
    const t = ac.currentTime;

    // Noise layer: 30ms buffer shaped by an exponential fade, highpassed.
    const n = Math.floor(ac.sampleRate * 0.03);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let c = 0; c < n; c++) {
      data[c] = (Math.random() * 2 - 1) * Math.pow(1 - c / n, 2.5);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const nGain = ac.createGain();
    nGain.gain.setValueAtTime(0.18, t);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    src.connect(hp); hp.connect(nGain); nGain.connect(ac.destination);

    // Tone layer: square wave sweeping 2400 -> 900 Hz, barely audible.
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.02);
    const oGain = ac.createGain();
    oGain.gain.setValueAtTime(0.05, t);
    oGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    osc.connect(oGain); oGain.connect(ac.destination);

    src.start(t); src.stop(t + 0.03);
    osc.start(t); osc.stop(t + 0.03);
  }

  // Public one-shots. Both map to the same soft click; kept as two names so
  // existing callers (press/soft) keep working.
  function press() { tick(); }
  function soft() { tick(); }

  function setEnabled(on) {
    enabled = !!on;
    U.store(STORE_KEY, enabled ? "on" : "off");
    if (enabled) press(); // audible confirmation when turning it on
  }
  function toggle() { setEnabled(!enabled); return enabled; }
  function isEnabled() { return enabled; }

  // Delegate one listener for the whole page. We must NOT play on pointerdown,
  // because on touch a pointerdown is also the start of a scroll — that made the
  // click sound fire while scrolling. Instead we remember where the pointer went
  // down and only play on pointerup when it barely moved and was quick, i.e. a
  // real tap/click rather than a scroll or drag.
  const TAP_MOVE = 10;   // px of slop allowed for a "tap"
  const TAP_TIME = 600;  // ms; longer press-and-hold isn't a click either
  function wire() {
    if (document.__ndSfxWired) return; // idempotent: safe if called twice
    document.__ndSfxWired = true;

    // First real gesture unlocks audio on mobile. iOS honors touchend/click for
    // audio unlocking more reliably than touchstart, so listen on several so the
    // context is running by the time the first tick tries to play.
    const unlockOnce = () => { unlock(); };
    ["touchstart", "touchend", "pointerdown", "click"].forEach(function (evt) {
      document.addEventListener(evt, unlockOnce, { capture: true, passive: true });
    });

    let down = null; // { x, y, t, id } of the current primary pointer
    document.addEventListener("pointerdown", (e) => {
      // Left mouse button only; touch and pen always pass.
      if (e.pointerType === "mouse" && e.button !== 0) { down = null; return; }
      unlock(); // ensure audio is unlocking from within this real gesture
      down = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    }, true);

    // If the finger/mouse moves past the slop, it's a scroll or drag — cancel.
    document.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== down.id) return;
      if (Math.abs(e.clientX - down.x) > TAP_MOVE || Math.abs(e.clientY - down.y) > TAP_MOVE) {
        down = null;
      }
    }, { capture: true, passive: true });

    document.addEventListener("pointercancel", () => { down = null; }, true);

    document.addEventListener("pointerup", (e) => {
      const d = down;
      down = null;
      if (!enabled || !d || e.pointerId !== d.id) return;
      // Only a quick, near-stationary release counts as a click.
      if (Date.now() - d.t > TAP_TIME) return;
      if (Math.abs(e.clientX - d.x) > TAP_MOVE || Math.abs(e.clientY - d.y) > TAP_MOVE) return;
      // Skip disabled controls so they stay "dead".
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
