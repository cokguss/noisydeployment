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

  // A short filtered click: a fast pitch drop through a band-pass, enveloped so
  // it reads as a tactile "tick" rather than a beep. freq/gain tune the flavour.
  function tick(freq, gain) {
    if (!enabled) return;
    const ac = audio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const bp = ac.createBiquadFilter();
    const amp = ac.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.03);

    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 6;

    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(bp); bp.connect(amp); amp.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Public one-shots. `press` is the firmer down-click; `soft` a lighter tick
  // for hovers/secondary actions if we ever want it.
  function press() { tick(660, 0.06); }
  function soft() { tick(880, 0.03); }

  function setEnabled(on) {
    enabled = !!on;
    U.store(STORE_KEY, enabled ? "on" : "off");
    if (enabled) press(); // audible confirmation when turning it on
  }
  function toggle() { setEnabled(!enabled); return enabled; }
  function isEnabled() { return enabled; }

  // Delegate one listener for the whole page. Only fire on genuinely clickable
  // controls so we don't tick on every stray click. Capture phase keeps the
  // sound in sync even if a handler calls stopPropagation.
  const CLICKABLE = "button, a, .btn, [role='button'], input[type='checkbox'], input[type='radio'], select, .tab, .admin-tab, .chip, .method-chip";
  function wire() {
    document.addEventListener("pointerdown", (e) => {
      if (!enabled) return;
      const el = e.target.closest(CLICKABLE);
      if (!el || el.disabled) return;
      press();
    }, true);
  }

  ND.sfx = {
    press: press, soft: soft,
    setEnabled: setEnabled, toggle: toggle, isEnabled: isEnabled,
    wire: wire,
  };
})(window.ND);
