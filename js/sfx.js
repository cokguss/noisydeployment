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
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Enabled unless the user muted it before. Under reduced-motion we default to
  // off so the site stays quiet for people who asked for calm.
  let enabled = (function () {
    const saved = U.load(STORE_KEY, false);
    if (saved === "off") return false;
    if (saved === "on") return true;
    return !reduce;
  })();

  let ctx = null;
  // Browsers block audio until the first user gesture; create/resume lazily.
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // A short, quiet mechanical click matched to noisyuploader.vercel.app: a
  // highpassed white-noise burst (the "tick" texture) layered with a fast
  // square-wave pitch sweep. ~30ms total, both layers very soft.
  function tick() {
    if (!enabled) return;
    const ac = audio();
    if (!ac) return;
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

  // Delegate one listener for the whole page. Play a tick on ANY primary click
  // anywhere — not just on obvious controls — so the whole site feels tactile.
  // Capture phase keeps the sound in sync even if a handler stops propagation.
  function wire() {
    if (document.__ndSfxWired) return; // idempotent: safe if called twice
    document.__ndSfxWired = true;
    document.addEventListener("pointerdown", (e) => {
      if (!enabled) return;
      // Left mouse button only; touch and pen always pass.
      if (e.pointerType === "mouse" && e.button !== 0) return;
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
