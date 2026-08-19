/* ============================================================================
   app.js — orchestration. Wires the DOM to the GitHub client and view layer,
   owns the small amount of app state, and runs the deploy flow.
   ==========================================================================*/
(function (ND) {
  "use strict";
  const U = ND.util, ui = ND.ui, S = ND.config.STORAGE;

  const state = { token: null, user: null, files: [], deploying: false,
                  quota: null, products: [], methods: [], settings: null,
                  proofFile: null, payPlan: null, payMethod: null };

  /* --------------------------------------------------------------- files */
  /* Skip files that never belong on a static host and commonly leak secrets:
     VCS/dependency dirs, OS cruft, and .env files. Content-level secrets (a key
     hard-coded in a .js) can't be caught here — GitHub push protection does that,
     and deploy() surfaces a friendly "remove that file" message when it fires. */
  const JUNK = /(^|\/)(\.git|\.svn|\.hg|node_modules|\.vercel|\.next|\.cache)(\/|$)|(^|\/)(\.DS_Store|Thumbs\.db)$|(^|\/)\.env(\.|$)/i;

  /* High-confidence secret patterns — the same shapes GitHub push protection
     rejects. If any file's text matches, we drop that one file from the upload so
     the deploy still succeeds (dropping the whole project would be worse UX). */
  const SECRETS = [
    /ghp_[A-Za-z0-9]{36}/,                         // GitHub PAT (classic)
    /github_pat_[A-Za-z0-9_]{60,}/,                // GitHub PAT (fine-grained)
    /gh[osur]_[A-Za-z0-9]{36}/,                    // other GitHub tokens
    /vcp_[A-Za-z0-9]{40,}/,                         // Vercel token
    /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/,               // Telegram bot token
    /AKIA[0-9A-Z]{16}/,                             // AWS access key id
    /AIza[0-9A-Za-z_\-]{35}/,                       // Google API key
    /sk-[A-Za-z0-9]{20,}/,                          // OpenAI-style key
    /sk_live_[0-9a-zA-Z]{24,}/,                     // Stripe live key
    /xox[baprs]-[A-Za-z0-9-]{10,}/,                 // Slack token
    /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, // private keys
  ];
  // Binary types can't hold a pasteable secret and are wasteful to read as text.
  const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|svgz|woff2?|ttf|otf|eot|mp[34]|m4[av]|mov|webm|ogg|wav|flac|pdf|zip|gz|tar|rar|7z|wasm|exe|dll|bin|dat)$/i;
  const SCAN_MAX = 3 * 1024 * 1024; // don't read files larger than this to scan

  // Return the subset of entries whose text contains a secret.
  async function findSecretFiles(entries) {
    const flagged = [];
    for (const e of entries) {
      if (BINARY_EXT.test(e.path) || e.file.size > SCAN_MAX || e.file.size === 0) continue;
      let text;
      try { text = await e.file.text(); } catch (_) { continue; }
      if (SECRETS.some((re) => re.test(text))) flagged.push(e);
    }
    return flagged;
  }


  function collectFromInput(fileList, useRelative) {
    const out = [];
    for (const file of fileList) {
      const path = useRelative && file.webkitRelativePath ? file.webkitRelativePath : file.name;
      if (!JUNK.test(path)) out.push({ path: path, file: file });
    }
    return out;
  }

  // Walk a drag-and-drop tree via the Entries API so dropped folders work.
  async function collectFromDataTransfer(dt) {
    const items = Array.from(dt.items || []).filter((i) => i.kind === "file");
    const entries = items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
    if (!entries.length) return collectFromInput(dt.files || [], false);

    const out = [];
    async function walk(entry, prefix) {
      if (entry.isFile) {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        const path = prefix + entry.name;
        if (!JUNK.test(path)) out.push({ path: path, file: file });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const all = [];
        while (true) {
          const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          if (!batch.length) break;
          all.push.apply(all, batch);
        }
        for (const child of all) await walk(child, prefix + entry.name + "/");
      }
    }
    for (const e of entries) await walk(e, "");
    return out;
  }

  // If everything sits under one shared folder, drop it so index.html lands at
  // the repo root. Returns the stripped folder name (useful as a name hint).
  function stripCommonDir(entries) {
    if (!entries.length) return null;
    const segs = entries.map((e) => e.path.split("/"));
    if (!segs.every((s) => s.length > 1)) return null; // some file already at root
    let prefix = segs[0].slice(0, -1);
    for (const s of segs) {
      const dirs = s.slice(0, -1);
      let i = 0;
      while (i < prefix.length && i < dirs.length && prefix[i] === dirs[i]) i++;
      prefix = prefix.slice(0, i);
      if (!prefix.length) break;
    }
    if (!prefix.length) return null;
    const cut = prefix.length;
    entries.forEach((e) => { e.path = e.path.split("/").slice(cut).join("/"); });
    return prefix[prefix.length - 1];
  }

  async function addEntries(entries) {
    const oversized = entries.find((e) => e.file.size > ND.config.MAX_FILE_BYTES);
    if (oversized) { ui.toast(ND.t("toast.fileTooLarge", { path: oversized.path }), "err"); }
    entries = entries.filter((e) => e.file.size <= ND.config.MAX_FILE_BYTES);

    // Drop files that contain secrets so the whole project can be dropped safely
    // and the deploy still goes through (GitHub would otherwise block the push).
    const secretFiles = await findSecretFiles(entries);
    if (secretFiles.length) {
      const flagged = new Set(secretFiles.map((e) => e.path));
      entries = entries.filter((e) => !flagged.has(e.path));
      const names = secretFiles.map((e) => e.path).join(", ");
      ui.toast(ND.t("toast.secretSkipped", { n: secretFiles.length, files: names }), "err");
    }

    const hint = stripCommonDir(entries);
    // merge, newest path wins
    const map = new Map(state.files.map((e) => [e.path, e]));
    entries.forEach((e) => map.set(e.path, e));
    state.files = Array.from(map.values());

    ui.renderFiles(state.files);
    await ui.renderPreview(state.files);

    if (hint && !ui.el.projectName.value) {
      ui.el.projectName.value = hint;
      updateSlug();
    }
    if (entries.length) ui.toast(ND.t("toast.filesAdded", { n: entries.length, s: entries.length === 1 ? "" : "s" }), "info");
  }

  function removeFile(i) {
    state.files.splice(i, 1);
    ui.renderFiles(state.files);
    ui.renderPreview(state.files);
  }
  function clearFiles() {
    state.files = [];
    ui.renderFiles(state.files);
    ui.el.previewWrap.hidden = true;
  }

  /* ------------------------------------------------------------- connect */
  function busy(btn, on, labelWhenBusy) {
    const label = btn.querySelector(".btn-label");
    const spin = btn.querySelector(".spinner");
    btn.disabled = on;
    if (spin) spin.hidden = !on;
    if (label && labelWhenBusy != null) {
      if (on) { label.dataset.prev = label.textContent; label.textContent = labelWhenBusy; }
      else if (label.dataset.prev) { label.textContent = label.dataset.prev; }
    }
  }

  async function connect() {
    const token = ui.el.token.value.trim();
    ui.error("connect", "");
    if (!token) { ui.error("connect", ND.t("err.pasteToken")); return; }
    busy(ui.el.btnConnect, true, ND.t("btn.checking"));
    try {
      const user = await ND.gh.getUser(token);
      state.token = token;
      state.user = user;
      U.store(S.token, token);
      U.store(S.user, { login: user.login, name: user.name, avatar_url: user.avatar_url });
      ui.setConnected(user);
      updateSlug();
      ui.toast(ND.t("toast.connectedAs", { login: user.login }), "ok");
      refreshQuota();
      goto("files");
    } catch (e) {
      ui.error("connect", e.message || ND.t("err.connectGeneric"));
    } finally {
      busy(ui.el.btnConnect, false);
    }
  }

  function forget() {
    state.token = null; state.user = null; state.quota = null;
    U.remove(S.token); U.remove(S.user);
    ui.setDisconnected();
    ui.hideQuota();
    ui.setPlanBadge(null);
    ui.toast(ND.t("toast.forgotten"), "info");
    goto("connect");
  }

  async function restore() {
    const token = U.load(S.token);
    const cached = U.load(S.user, true);
    if (!token) return;
    state.token = token;
    if (cached) { state.user = cached; ui.setConnected(cached); }
    // verify quietly; drop it if the token was revoked or expired
    try {
      const user = await ND.gh.getUser(token);
      state.user = user;
      ui.setConnected(user);
      updateSlug();
      refreshQuota();
    } catch (e) {
      if (e.status === 401) { forget(); ui.toast(ND.t("toast.savedInvalid"), "err"); }
    }
  }

  /* --------------------------------------------------------------- slug */
  function updateSlug() {
    const slug = U.slugify(ui.el.projectName.value);
    ui.echoUrl(state.user && state.user.login, slug);
  }

  /* ------------------------------------------------------------- navigate */
  function goto(panel) {
    if (panel === "files" && !state.token) panel = "connect";
    ui.showPanel(panel);
    document.getElementById("deploy").scrollIntoView({ behavior: ND.fx.reduced ? "auto" : "smooth", block: "start" });
  }

  /* --------------------------------------------------------------- deploy */
  async function deploy() {
    if (state.deploying) return;
    ui.error("config", "");
    const slug = U.slugify(ui.el.projectName.value);
    if (!state.token) { goto("connect"); return; }
    if (!slug) { ui.error("config", ND.t("err.nameProject")); return; }
    if (!state.files.length) { ui.error("config", ND.t("err.addFile")); goto("files"); return; }

    // GitHub Pages needs an index.html at the repo root for the site URL to load.
    // Warn (once) but don't block: some deploys are intentional non-site files.
    const hasIndex = state.files.some((e) => e.path.toLowerCase() === "index.html");
    if (!hasIndex && !state._noIndexOk) {
      state._noIndexOk = true;
      ui.error("config", ND.t("err.noIndex"));
      ui.toast(ND.t("err.noIndex"), "err");
      goto("files");
      return;
    }

    // Quota gate: ask the server before running the browser->GitHub pipeline.
    // Fails open (quota.check returns disabled on error) so an outage never
    // traps a user; only a clear "0 remaining" blocks and opens the upgrade.
    if (ND.db.enabled && state.user && state.user.login) {
      busy(ui.el.btnDeploy, true, ND.t("quota.checking"));
      let info;
      try { info = await ND.quota.check(state.user.login); }
      finally { busy(ui.el.btnDeploy, false); }
      state.quota = info;
      ui.renderQuota(info);
      ui.setPlanBadge(info.plan);
      if (info && !info.disabled && !info.unlimited && info.allowed === false) {
        const limit = info.limit != null ? info.limit : ND.config.FREE_LIMIT;
        ui.error("config", ND.t("err.quotaReached", { limit: limit }));
        ui.toast(ND.t("err.quotaReached", { limit: limit }), "err");
        openUpgrade();
        return;
      }
    }

    state.deploying = true;
    busy(ui.el.btnDeploy, true, ND.t("btn.deploying"));
    ui.el.btnDeploy.classList.add("busy");
    ui.clearLog();
    ui.logRunning(true);

    try {
      const result = await ND.deploy(
        state.token,
        {
          repoName: slug,
          description: ui.el.projectDesc.value.trim(),
          isPrivate: false,
          files: state.files,
        },
        (msg, type) => ui.log(msg, type),
        (step) => ui.deployPhase(step)
      );
      ND.history.add({ repo: result.owner + "/" + result.repoName, url: result.pagesUrl, at: new Date().toISOString() });
      ui.showSuccess(result);
      ui.toast(result.built ? ND.t("toast.deployedLive") : ND.t("toast.deployedBuilding"), "ok");
      // Count this deploy against the quota (skipped server-side for unlimited
      // plans), then refresh the banner so the remaining count stays accurate.
      if (ND.db.enabled && state.user && state.user.login) {
        ND.quota.record(state.user.login, result.owner + "/" + result.repoName, result.pagesUrl)
          .then(() => refreshQuota());
      }
    } catch (e) {
      ui.log(e.message || ND.t("err.deployFailed"), "err");
      ui.toast(e.message || ND.t("err.deployFailed"), "err");
      if (e.status === 401) { forget(); }
    } finally {
      state.deploying = false;
      busy(ui.el.btnDeploy, false);
      ui.el.btnDeploy.classList.remove("busy");
      ui.logRunning(false);
    }
  }

  function deployAnother() {
    clearFiles();
    ui.el.projectName.value = "";
    ui.el.projectDesc.value = "";
    updateSlug();
    ui.renderIdleLog();
    goto("files");
  }

  async function copyLink() {
    const url = ui.el.liveUrl.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
      }
      ui.toast(ND.t("toast.linkCopied"), "ok");
    } catch (_) { ui.toast(ND.t("toast.copyFailed"), "err"); }
  }

  /* --------------------------------------------------- accounts / quota */
  // Load live pricing, announcement, and settings from Supabase (if configured)
  // and keep them fresh via realtime. Everything degrades to config defaults.
  async function initAccounts() {
    ui.renderPlans([], ND.config.FREE_LIMIT); // config-based default first
    await ND.db.init();
    if (!ND.db.enabled) return;
    await refreshLiveData();
    ND.db.subscribeLive(() => { refreshLiveData(); });
  }

  async function refreshLiveData() {
    try {
      const [settings, products, methods, announcement] = await Promise.all([
        ND.db.getSettings(), ND.db.getActiveProducts(), ND.db.listPaymentMethods(),
        ND.db.getActiveAnnouncement(),
      ]);
      state.settings = settings || null;
      state.products = products || [];
      state.methods = methods || [];
      const freeLimit = (settings && settings.free_limit != null) ? settings.free_limit : ND.config.FREE_LIMIT;
      ui.renderPlans(state.products, freeLimit);
      ui.renderMethods(state.methods);
      ui.showAnnouncement(announcement);
    } catch (e) { console.warn("live data refresh failed:", e && e.message); }
  }

  // Ask the quota service where this user stands and reflect it in the banner.
  async function refreshQuota() {
    const login = state.user && state.user.login;
    if (!login) { ui.hideQuota(); ui.setPlanBadge(null); return; }
    if (!ND.db.enabled) { ui.renderQuota({ disabled: true }); ui.setPlanBadge(null); return; }
    ui.renderQuota({ disabled: false, plan: "free", unlimited: false, remaining: null }); // neutral while loading
    try {
      const info = await ND.quota.check(login);
      state.quota = info;
      ui.renderQuota(info);
      ui.setPlanBadge(info.plan);
    } catch (e) {
      console.warn("quota refresh failed:", e && e.message);
      ui.renderQuota({ disabled: true });
    }
  }

  /* --------------------------------------------------- payment / upgrade */
  function telegramHandles() {
    const s = state.settings;
    return {
      dev: (s && s.telegram_dev) || ND.config.PAY.telegramDev,
      support: (s && s.telegram_support) || ND.config.PAY.telegramSupport,
    };
  }
  // planCtx: { planName, amount, days } from the clicked card, or null (default
  // to the first/featured plan the pricing section is showing).
  function openUpgrade(planCtx) {
    state.proofFile = null;
    ui.setProofName("");
    state.payPlan = planCtx && planCtx.amount ? planCtx : {
      planName: (state.products[0] && state.products[0].name) || "Premium",
      amount: ui.currentPrice(),
      days: 30,
    };
    ui.fillPay({
      amount: state.payPlan.amount,
      planName: state.payPlan.planName,
      loggedIn: !!(state.user && state.user.login),
    });
    ui.renderMethods(state.methods, (m) => { state.payMethod = m; });
    ui.openPay();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      return true;
    } catch (_) { return false; }
  }

  const PROOF_MAX = 5 * 1024 * 1024;
  function chooseProof(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { ui.toast(ND.t("pay.proofHint"), "err"); return; }
    if (file.size > PROOF_MAX) { ui.toast(ND.t("pay.proofHint"), "err"); return; }
    state.proofFile = file;
    ui.setProofName(file.name);
  }

  // Upload proof + record a pending payment, then hand off to Telegram with a
  // prefilled message (also copied to the clipboard as a reliable fallback).
  async function confirmPayment(which, btn) {
    const login = state.user && state.user.login;
    if (!login) { ui.toast(ND.t("pay.needLogin"), "err"); ui.closePay(); goto("connect"); return; }

    const handles = telegramHandles();
    const handle = which === "support" ? handles.support : handles.dev;
    const plan = state.payPlan || { amount: ui.currentPrice(), days: 30, planName: "Premium" };
    const amount = plan.amount;
    let proofUrl = "";

    if (ND.db.enabled) {
      if (!state.proofFile) { ui.toast(ND.t("pay.needProof"), "err"); return; }
      busy(btn, true, ND.t("pay.uploading"));
      try {
        proofUrl = await ND.db.uploadProof(state.proofFile, login);
        await ND.db.createPayment(login, {
          amount: amount,
          proofUrl: proofUrl,
          method: (state.payMethod && state.payMethod.label) || "seabank",
          planName: plan.planName || null,
          days: plan.days != null ? plan.days : 30,
        });
        ui.toast(ND.t("pay.submitted"), "ok");
      } catch (e) {
        console.warn("payment submit failed:", e && e.message);
        ui.toast(ND.t("pay.uploadFailed"), "err");
        busy(btn, false);
        return;
      }
      busy(btn, false);
    } else {
      ui.toast(ND.t("pay.disabled"), "info");
    }

    const msg = ND.t("pay.telegramMsg", {
      login: login,
      amount: U.formatIDR(amount),
      proof: proofUrl || "-",
    });
    await copyText(msg);
    const url = "https://t.me/" + encodeURIComponent(handle) + "?text=" + encodeURIComponent(msg);
    window.open(url, "_blank", "noopener");
  }

  /* --------------------------------------------------------------- wire */
  function wire() {
    const c = ui.el;

    // connect
    c.btnConnect.addEventListener("click", connect);
    c.token.addEventListener("keydown", (e) => { if (e.key === "Enter") connect(); });
    c.btnReveal.addEventListener("click", () => {
      const show = c.token.type === "password";
      c.token.type = show ? "text" : "password";
      const label = show ? ND.t("a11y.hideToken") : ND.t("a11y.showToken");
      c.btnReveal.setAttribute("aria-label", label);
      c.btnReveal.setAttribute("title", label);
    });
    c.btnForget.addEventListener("click", forget);
    c.btnForget2.addEventListener("click", forget);
    c.btnContinueFiles.addEventListener("click", () => goto("files"));

    // files: pickers
    c.btnPickFiles.addEventListener("click", () => c.inputFiles.click());
    c.btnPickFolder.addEventListener("click", () => c.inputFolder.click());
    c.inputFiles.addEventListener("change", (e) => { addEntries(collectFromInput(e.target.files, false)); e.target.value = ""; });
    c.inputFolder.addEventListener("change", (e) => { addEntries(collectFromInput(e.target.files, true)); e.target.value = ""; });

    // files: dropzone
    const dz = c.dropzone;
    dz.addEventListener("click", (e) => { if (e.target === dz || e.target.closest(".i-lg, .dz-title, .dz-sub")) c.inputFiles.click(); });
    dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.inputFiles.click(); } });
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("is-drag"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "drop" || e.target === dz) dz.classList.remove("is-drag"); }));
    dz.addEventListener("drop", async (e) => {
      dz.classList.remove("is-drag");
      const entries = await collectFromDataTransfer(e.dataTransfer);
      if (entries.length) addEntries(entries);
    });
    // prevent the browser from opening a file dropped outside the zone
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => { if (!e.target.closest(".dropzone")) e.preventDefault(); });

    // files: list actions (delegated)
    c.filelist.addEventListener("click", (e) => {
      const btn = e.target.closest(".fr-x");
      if (btn) removeFile(Number(btn.dataset.i));
    });
    c.btnClearFiles.addEventListener("click", clearFiles);
    c.btnPreview.addEventListener("click", () => ui.togglePreview(c.previewFrame.hidden));
    c.btnToConfig.addEventListener("click", () => goto("config"));

    // back buttons
    U.qsa("[data-back]").forEach((b) => b.addEventListener("click", () => goto(b.getAttribute("data-back"))));

    // config
    c.projectName.addEventListener("input", updateSlug);
    c.projectName.addEventListener("keydown", (e) => { if (e.key === "Enter") deploy(); });
    c.btnDeploy.addEventListener("click", deploy);

    // success
    c.btnOpen.addEventListener("click", () => window.open(c.liveUrl.href, "_blank", "noopener"));
    c.btnCopy.addEventListener("click", copyLink);
    c.btnAnother.addEventListener("click", deployAnother);

    // pricing / upgrade / payment
    // Plan cards are rendered dynamically; delegate their Upgrade clicks.
    if (c.plans) c.plans.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-upgrade]");
      if (btn) openUpgrade({
        planName: btn.getAttribute("data-plan-name"),
        amount: parseInt(btn.getAttribute("data-amount"), 10),
        days: parseInt(btn.getAttribute("data-days"), 10),
      });
    });
    if (c.btnQuotaUpgrade) c.btnQuotaUpgrade.addEventListener("click", () => openUpgrade());
    if (c.announceClose) c.announceClose.addEventListener("click", () => ui.dismissAnnouncement());
    if (c.payModal) {
      // close on backdrop / X / Escape
      U.qsa("[data-close-pay]", c.payModal).forEach((b) => b.addEventListener("click", () => ui.closePay()));
      // copy buttons — delegated so dynamically rendered method rows work too.
      // data-copy references an element id; data-copyval holds a literal value.
      c.payModal.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-copy],[data-copyval]");
        if (!b) return;
        let text = b.getAttribute("data-copyval");
        if (!text) {
          const target = document.getElementById(b.getAttribute("data-copy"));
          text = target ? target.textContent.trim() : "";
        }
        if (text && await copyText(text)) ui.toast(ND.t("pay.copied"), "ok");
      });
    }
    if (c.btnChooseProof) c.btnChooseProof.addEventListener("click", () => c.inputProof.click());
    if (c.inputProof) c.inputProof.addEventListener("change", (e) => { chooseProof(e.target.files[0]); e.target.value = ""; });
    if (c.btnPayDev) c.btnPayDev.addEventListener("click", () => confirmPayment("dev", c.btnPayDev));
    if (c.btnPaySupport) c.btnPaySupport.addEventListener("click", () => confirmPayment("support", c.btnPaySupport));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.isPayOpen()) ui.closePay(); });

    // anchors: open the token FAQ when linked, smooth-scroll with nav offset
    U.qsa('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (target.tagName === "DETAILS") target.open = true;
      target.scrollIntoView({ behavior: ND.fx.reduced ? "auto" : "smooth", block: "start" });
    }));

    // rate-limit indicator
    ND.onRate = (rate) => ui.setRate(rate);

    // language toggle: EN / ID segmented control
    U.qsa(".lang-opt").forEach((b) => b.addEventListener("click", () => {
      const lang = b.getAttribute("data-lang");
      if (lang && lang !== ND.i18n.lang) ND.i18n.set(lang);
    }));
    // after a language switch, re-render the JS-managed strings apply() can't reach
    ND.i18n.onChange = () => {
      ui.relocalize(state);
      updateSlug();
      // keep the token eye button's current show/hide label in the new language
      const c = ui.el;
      const shown = c.token.type === "text";
      const lbl = shown ? ND.t("a11y.hideToken") : ND.t("a11y.showToken");
      c.btnReveal.setAttribute("aria-label", lbl);
      c.btnReveal.setAttribute("title", lbl);
    };
  }

  /* --------------------------------------------------------------- reveal */
  function initReveal() {
    const els = U.qsa(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* --------------------------------------------------------------- boot */
  function boot() {
    ui.cache();
    ND.i18n.init();
    ND.fx.initHero(ui.el.heroCanvas);
    wire();
    initReveal();
    restore();
    updateSlug();
    initAccounts();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window.ND);
