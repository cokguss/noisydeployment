/* ============================================================================
   ui.js — DOM rendering and view state. No network here; app.js orchestrates.
   ==========================================================================*/
(function (ND) {
  "use strict";
  const U = ND.util;
  const $ = U.qs, $$ = U.qsa;

  const ICON = {
    ok:   '<svg class="i i-sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    err:  '<svg class="i i-sm" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.3 4.3L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z"/></svg>',
    info: '<svg class="i i-sm" viewBox="0 0 24 24"><path d="M12 16v-4m0-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z"/></svg>',
    x:    '<svg class="i" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    file: '<svg class="i i-sm" viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-6-5z"/></svg>',
  };

  const STEP_ORDER = ["connect", "files", "config", "deploy"];

  // Billing period -> number of days granted on approval.
  const PERIOD_DAYS = { day: 1, daily: 1, week: 7, weekly: 7, month: 30, monthly: 30, quarter: 90, quarterly: 90, year: 365, yearly: 365, annual: 365, lifetime: 36500 };

  // Stable id for an announcement so a user's dismissal sticks to that message.
  function annKey(ann) {
    return ann && (ann.id != null ? String(ann.id) : ann.message) || "";
  }

  /* ---- preview builder ------------------------------------------------------
     The preview iframe uses srcdoc, so an index.html that links "css/style.css"
     or "app.js" would render unstyled — those paths don't exist yet. We resolve
     same-upload references in memory: inline local CSS/JS and turn local images
     into data URLs, so the preview looks like the deployed site. Remote (http)
     and data: refs are left untouched. Runs for any user's project, not just ours. */
  function fileMap(files) {
    const m = new Map();
    files.forEach((f) => m.set(f.path.toLowerCase(), f));
    return m;
  }
  function isRemote(ref) {
    return !ref || /^(https?:)?\/\//i.test(ref) || /^(data|mailto|tel|blob|javascript):/i.test(ref) || ref.charAt(0) === "#";
  }
  function resolvePath(fromPath, ref) {
    ref = ref.split(/[?#]/)[0];
    if (ref.charAt(0) === "/") return ref.replace(/^\/+/, "");
    const stack = fromPath.split("/").slice(0, -1);
    ref.split("/").forEach((p) => {
      if (p === "" || p === ".") return;
      if (p === "..") stack.pop();
      else stack.push(p);
    });
    return stack.join("/");
  }
  async function fileToDataUrl(file) {
    const b64 = await ND.util.fileToBase64(file);
    return "data:" + (file.type || "application/octet-stream") + ";base64," + b64;
  }
  const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  async function inlineCssUrls(css, cssPath, map) {
    const refs = new Set();
    css.replace(CSS_URL, (m, q, ref) => { refs.add(ref); return m; });
    for (const ref of refs) {
      if (isRemote(ref)) continue;
      const f = map.get(resolvePath(cssPath, ref).toLowerCase());
      if (!f) continue;
      const durl = await fileToDataUrl(f.file);
      css = css.replace(CSS_URL, (m, q, r) => (r === ref ? 'url("' + durl + '")' : m));
    }
    return css;
  }
  async function buildPreview(html, indexPath, files) {
    if (!("DOMParser" in window)) return html;
    const map = fileMap(files);
    const doc = new DOMParser().parseFromString(html, "text/html");

    for (const link of Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'))) {
      const href = link.getAttribute("href");
      if (isRemote(href)) continue;
      const f = map.get(resolvePath(indexPath, href).toLowerCase());
      if (!f) continue;
      const css = await inlineCssUrls(await f.file.text(), resolvePath(indexPath, href), map);
      const style = doc.createElement("style");
      style.textContent = css;
      link.replaceWith(style);
    }

    for (const s of Array.from(doc.querySelectorAll("script[src]"))) {
      const src = s.getAttribute("src");
      if (isRemote(src)) continue;
      const f = map.get(resolvePath(indexPath, src).toLowerCase());
      if (!f) continue;
      const code = await f.file.text();
      const inline = doc.createElement("script");
      if (s.type) inline.type = s.type;
      inline.textContent = code;
      s.replaceWith(inline);
    }

    for (const el of Array.from(doc.querySelectorAll("img[src], source[src], video[src], audio[src]"))) {
      const src = el.getAttribute("src");
      if (isRemote(src)) continue;
      const f = map.get(resolvePath(indexPath, src).toLowerCase());
      if (f) el.setAttribute("src", await fileToDataUrl(f.file));
    }

    for (const el of Array.from(doc.querySelectorAll("[style*='url(']"))) {
      el.setAttribute("style", await inlineCssUrls(el.getAttribute("style"), indexPath, map));
    }

    return "<!doctype html>\n" + doc.documentElement.outerHTML;
  }


  const ui = {
    el: {},

    cache() {
      const ids = [
        "heroCanvas", "rate", "connChip", "connAvatar", "connLabel", "btnForget",
        "stepper", "log", "token", "btnReveal", "btnConnect", "connectedCard", "meAvatar",
        "meName", "meLogin", "btnContinueFiles", "btnForget2", "dropzone", "inputFiles",
        "inputFolder", "btnPickFiles", "btnPickFolder", "fileWarn", "filelistWrap",
        "fileCount", "btnClearFiles", "filelist", "previewWrap", "btnPreview", "previewFrame",
        "preview", "btnToConfig", "projectName", "projectDesc", "urlEcho", "btnDeploy",
        "successMark", "successNote", "liveUrl", "liveUrlText", "btnOpen", "btnCopy",
        "btnRepo", "btnAnother", "toasts",
        // Phase 2: announcement, quota, pricing, payment modal
        "announceBar", "announceMsg", "announceClose",
        "quotaBanner", "quotaText", "btnQuotaUpgrade",
        "pricingSub", "freeF1", "plans",
        "payModal", "payNeedLogin", "payAmount", "payMethods", "payMethodDetails",
        "btnChooseProof", "inputProof", "payProofName", "btnPayDev", "btnPaySupport",
        "payPlanName",
      ];
      ids.forEach((id) => { this.el[id] = document.getElementById(id); });
      this.steps = $$(".step", this.el.stepper);
    },

    /* ---- panels + stepper ---- */
    showPanel(name) {
      $$(".panel").forEach((p) => { p.hidden = p.getAttribute("data-panel") !== name; });
      if (name === "success") this.markAllDone();
      else this.setStepper(name);
    },
    setStepper(active) {
      const idx = STEP_ORDER.indexOf(active);
      if (idx < 0) return;
      this.steps.forEach((el, i) => {
        el.classList.toggle("is-active", i === idx);
        el.classList.toggle("is-done", i < idx);
      });
    },
    // During the deploy pipeline the wizard sits on step 4 ("deploy"); internal
    // phases (connect/repo/upload/pages) are shown in the log, not the stepper.
    deployPhase(phase) {
      if (phase === "done") { this.markAllDone(); return; }
      this.setStepper("deploy");
    },
    markAllDone() {
      this.steps.forEach((el) => { el.classList.remove("is-active"); el.classList.add("is-done"); });
    },

    /* ---- connection state ---- */
    setConnected(user) {
      const c = this.el;
      c.connChip.setAttribute("data-state", "on");
      // drop the i18n tag so a later language toggle won't overwrite the login
      c.connLabel.removeAttribute("data-i18n");
      c.connLabel.textContent = user.login;
      if (user.avatar_url) { c.connAvatar.src = user.avatar_url + "&s=44"; c.connAvatar.hidden = false; }
      c.btnForget.hidden = false;

      c.meName.textContent = user.name || user.login;
      c.meLogin.textContent = "@" + user.login;
      if (user.avatar_url) c.meAvatar.src = user.avatar_url + "&s=88";
      c.connectedCard.hidden = false;
      c.token.closest(".field").hidden = true;
      c.btnConnect.hidden = true;
      this.renderIdleLog();
    },
    setDisconnected() {
      const c = this.el;
      c.connChip.setAttribute("data-state", "off");
      c.connLabel.setAttribute("data-i18n", "conn.notConnected");
      c.connLabel.textContent = ND.t("conn.notConnected");
      c.connAvatar.hidden = true;
      c.btnForget.hidden = true;
      c.connectedCard.hidden = true;
      c.token.closest(".field").hidden = false;
      c.btnConnect.hidden = false;
      c.token.value = "";
    },

    setRate(rate) {
      const el = this.el.rate;
      if (rate && rate.remaining != null) {
        el.hidden = false;
        el.textContent = ND.t("rate.left", { n: rate.remaining });
        el.title = ND.t("rate.title", { n: rate.remaining }) +
          (rate.limit ? ND.t("rate.of", { limit: rate.limit }) : "");
      }
    },

    /* ---- inline errors ---- */
    error(scope, msg) {
      const el = $('[data-error="' + scope + '"]');
      if (!el) return;
      if (msg) { el.textContent = msg; el.hidden = false; }
      else { el.textContent = ""; el.hidden = true; }
    },

    /* ---- file list ---- */
    renderFiles(files) {
      const c = this.el;
      c.filelistWrap.hidden = files.length === 0;
      c.fileCount.textContent = ND.t("files.count", { n: files.length, s: files.length === 1 ? "" : "s" });
      c.filelist.innerHTML = "";
      files.forEach((f, i) => {
        const li = document.createElement("li");
        li.className = "file-row";
        li.innerHTML =
          ICON.file +
          '<span class="fr-path">' + U.escapeHtml(f.path) + "</span>" +
          '<span class="fr-size">' + U.formatBytes(f.file.size) + "</span>" +
          '<button class="fr-x" type="button" title="' + U.escapeHtml(ND.t("a11y.removeFile")) +
          '" aria-label="' + U.escapeHtml(ND.t("a11y.removeFilePath", { path: f.path })) +
          '" data-i="' + i + '">' + ICON.x + "</button>";
        c.filelist.appendChild(li);
      });

      const hasIndex = files.some((f) => f.path.toLowerCase() === "index.html");
      if (files.length && !hasIndex) {
        c.fileWarn.hidden = false;
        c.fileWarn.querySelector("span").textContent = ND.t("files.noIndex");
      } else {
        c.fileWarn.hidden = true;
      }
      c.btnToConfig.disabled = files.length === 0;
    },

    async renderPreview(files) {
      const c = this.el;
      const idx = files.find((f) => f.path.toLowerCase() === "index.html") ||
                  files.find((f) => f.path.toLowerCase().endsWith("/index.html"));
      if (!idx) { c.previewWrap.hidden = true; return; }
      c.previewWrap.hidden = false;
      try {
        const html = await idx.file.text();
        c.preview.srcdoc = await buildPreview(html, idx.path, files);
      } catch (_) { c.previewWrap.hidden = true; }
    },
    togglePreview(open) {
      const c = this.el;
      c.previewFrame.hidden = !open;
      c.btnPreview.setAttribute("aria-expanded", String(open));
    },

    /* ---- config echo ---- */
    echoUrl(login, slug) {
      this.el.urlEcho.textContent = (login || "username") + ".github.io/" + (slug || "…") + "/";
    },

    /* ---- live log ---- */
    clearLog() { this.el.log.innerHTML = ""; this._pollLine = null; },
    logRunning(on) { this.el.log.classList.toggle("running", !!on); },
    log(msg, type) {
      // "poll" lines (repeated build-status updates) reuse one line so the log
      // doesn't grow unbounded while waiting for the Pages build.
      if (type === "poll") {
        if (!this._pollLine || !this._pollLine.isConnected) {
          this._pollLine = document.createElement("p");
          this._pollLine.className = "ln poll";
          this.el.log.appendChild(this._pollLine);
        }
        this._pollLine.textContent = msg;
        this.el.log.scrollTop = this.el.log.scrollHeight;
        return;
      }
      this._pollLine = null; // any non-poll line ends the updating run
      const p = document.createElement("p");
      p.className = "ln" + (type ? " " + type : "");
      p.textContent = msg;
      this.el.log.appendChild(p);
      this.el.log.scrollTop = this.el.log.scrollHeight;
    },
    renderIdleLog() {
      const items = ND.history.list();
      const log = this.el.log;
      if (!items.length) {
        const p = document.createElement("p");
        p.className = "log-idle";
        p.textContent = ND.t("idle.waiting");
        log.innerHTML = "";
        log.appendChild(p);
        return;
      }
      const head = document.createElement("p");
      head.className = "log-idle";
      head.textContent = ND.t("idle.recent");
      log.innerHTML = "";
      log.appendChild(head);
      items.slice(0, 5).forEach((it) => {
        const p = document.createElement("p");
        p.className = "ln";
        p.innerHTML = U.escapeHtml(it.repo) + " → " +
          '<a href="' + U.escapeHtml(it.url) + '" target="_blank" rel="noopener noreferrer">' +
          U.escapeHtml(it.url.replace(/^https?:\/\//, "")) + "</a>";
        log.appendChild(p);
      });
    },

    /* ---- success ---- */
    showSuccess(result) {
      const c = this.el;
      this.lastResult = result;
      c.liveUrl.href = result.pagesUrl;
      c.liveUrlText.textContent = result.pagesUrl;
      c.btnRepo.href = result.repoUrl;
      c.successNote.textContent = result.built ? ND.t("success.built") : ND.t("success.building");
      this.showPanel("success");
      c.successMark.classList.remove("pop");
      void c.successMark.offsetWidth; // reflow so the animation replays
      c.successMark.classList.add("pop");
      ND.fx.burst(c.successMark);
    },

    /* Re-render the JS-managed (non-[data-i18n]) bits after a language switch. */
    relocalize(state) {
      if (!state.token) {
        this.el.connLabel.textContent = ND.t("conn.notConnected");
      }
      if (ND.rate) this.setRate(ND.rate);
      if (state.files && state.files.length) this.renderFiles(state.files);
      // refresh the idle/history log unless a deploy is streaming into it
      if (!state.deploying && this.el.log && !this.el.log.classList.contains("running")) {
        this.renderIdleLog();
      }
      // if the success panel is showing, update its note in place
      const successPanel = U.qs('.panel[data-panel="success"]');
      if (this.lastResult && successPanel && !successPanel.hidden) {
        this.el.successNote.textContent = this.lastResult.built ? ND.t("success.built") : ND.t("success.building");
      }
      // Phase 2 dynamic strings: quota banner, pricing cards, plan badge
      if (this._quota) this.renderQuota(this._quota);
      this.renderPlans(this._products, this._freeLimit);
      if (this._methods) this.renderMethods(this._methods);
      if (this._plan) this.setPlanBadge(this._plan);
    },

    /* ---- announcement bar (live from Supabase) ---- */
    showAnnouncement(ann) {
      const c = this.el;
      if (!c.announceBar) return;
      this._announce = ann || null;
      if (!ann || !ann.message || this._announceDismissed === annKey(ann)) {
        c.announceBar.hidden = true;
        return;
      }
      c.announceBar.setAttribute("data-level", ann.level === "warn" ? "warn" : "info");
      c.announceMsg.textContent = ann.message;
      c.announceBar.hidden = false;
    },
    dismissAnnouncement() {
      if (this._announce) this._announceDismissed = annKey(this._announce);
      if (this.el.announceBar) this.el.announceBar.hidden = true;
    },

    /* ---- quota banner ---- */
    // info: { plan, unlimited, remaining, limit, disabled }  (null while loading)
    renderQuota(info) {
      const c = this.el;
      if (!c.quotaBanner) return;
      this._quota = info;
      if (!info) { c.quotaBanner.hidden = true; return; }
      c.quotaBanner.hidden = false;

      let state = "free", text, showUpgrade = false;
      if (info.disabled) {
        state = "disabled"; text = ND.t("quota.disabled");
      } else if (info.plan === "developer") {
        state = "developer"; text = ND.t("quota.developer");
      } else if (info.unlimited) {
        state = "premium"; text = ND.t("quota.premium");
      } else {
        const limit = info.limit != null ? info.limit : ND.config.FREE_LIMIT;
        const remaining = info.remaining != null ? info.remaining : limit;
        if (remaining <= 0) { state = "none"; text = ND.t("quota.none", { limit: limit }); }
        else { state = "free"; text = ND.t("quota.free", { n: remaining, limit: limit }); }
        showUpgrade = true;
      }
      c.quotaBanner.setAttribute("data-state", state);
      c.quotaText.textContent = text;
      if (c.btnQuotaUpgrade) c.btnQuotaUpgrade.hidden = !showUpgrade;
    },
    hideQuota() { this._quota = null; if (this.el.quotaBanner) this.el.quotaBanner.hidden = true; },

    /* ---- pricing cards (live products; falls back to config default) ---- */
    // products: array of plan rows (or empty); freeLimit: number.
    // Each plan row: { id, name, tagline?, price, discount_price, period, features[] }.
    renderPlans(products, freeLimit) {
      const c = this.el;
      this._products = Array.isArray(products) ? products : (products ? [products] : []);
      this._freeLimit = freeLimit || ND.config.FREE_LIMIT;

      if (c.freeF1) c.freeF1.textContent = ND.t("pricing.free.f1", { limit: this._freeLimit });
      if (c.pricingSub) c.pricingSub.textContent = ND.t("pricing.sub", { limit: this._freeLimit });

      // Fall back to a single config-based Premium plan when there is no live data.
      let plans = this._products;
      if (!plans.length) {
        const P = ND.config.PRICE;
        plans = [{
          id: null, name: ND.t("pricing.premium.name"), tagline: ND.t("pricing.premium.tagline"),
          price: P.original, discount_price: P.discounted, period: P.period || "month",
          features: [
            ND.t("pricing.premium.f1"), ND.t("pricing.premium.f2"), ND.t("pricing.premium.f3"),
            ND.t("pricing.premium.f4"), ND.t("pricing.premium.f5"), ND.t("pricing.premium.f6"),
            ND.t("pricing.premium.f7"),
          ],
        }];
      }

      const box = c.plans;
      if (!box) return;
      // Remove any previously rendered premium cards (keep the static Free card).
      U.qsa(".plan-dyn", box).forEach((n) => n.remove());

      // Remember the first plan's price for the default upgrade action.
      const first = plans[0];
      const firstNow = first.discount_price != null ? first.discount_price : first.price;
      this._price = { original: first.price, discounted: firstNow };

      plans.forEach((p, i) => box.appendChild(this._planCard(p, i === 0)));
    },

    // Build one premium plan card element from a data row.
    _planCard(p, featured) {
      const original = p.price != null ? p.price : 0;
      const now = p.discount_price != null ? p.discount_price : original;
      const days = PERIOD_DAYS[p.period] != null ? PERIOD_DAYS[p.period] : 30;

      const card = document.createElement("article");
      card.className = "plan plan-dyn" + (featured ? " plan-featured" : "");

      const pct = original > now ? Math.round((1 - now / original) * 100) : 0;
      const flag = pct > 0
        ? '<span class="plan-flag">' + U.escapeHtml(ND.t("pricing.off", { pct: pct })) + "</span>" : "";
      const was = original > now
        ? '<span class="plan-was">' + U.escapeHtml(U.formatIDR(original)) + "</span>" : "";
      const per = '<span class="plan-per">' + U.escapeHtml(ND.t("period." + (p.period || "month"))) + "</span>";
      const feats = (p.features || []).map((f) => "<li>" + U.escapeHtml(f) + "</li>").join("");

      card.innerHTML =
        flag +
        '<div class="plan-head">' +
          '<h3 class="plan-name">' + U.escapeHtml(p.name || "Premium") + "</h3>" +
          (p.tagline ? '<p class="plan-tagline">' + U.escapeHtml(p.tagline) + "</p>" : "") +
        "</div>" +
        '<div class="plan-price">' + was +
          '<span class="plan-amount">' + U.escapeHtml(U.formatIDR(now)) + "</span>" + per +
        "</div>" +
        '<ul class="plan-feats plan-feats-pro">' + feats + "</ul>" +
        '<button class="btn ' + (featured ? "btn-primary" : "btn-ghost") + ' plan-cta" type="button"' +
          ' data-upgrade data-plan-name="' + U.escapeHtml(p.name || "Premium") + '"' +
          ' data-amount="' + now + '" data-days="' + days + '">' +
          U.escapeHtml(ND.t("pricing.upgradeTo", { name: p.name || "Premium" })) + "</button>";
      return card;
    },
    currentPrice() { return (this._price && this._price.discounted) || ND.config.PRICE.discounted; },

    /* ---- plan badge on the connection chip ---- */
    setPlanBadge(plan) {
      const c = this.el;
      this._plan = plan || null;
      const existing = c.connChip && c.connChip.querySelector(".plan-badge");
      if (existing) existing.remove();
      if (!c.connChip || (plan !== "premium" && plan !== "developer")) return;
      const b = document.createElement("span");
      b.className = "plan-badge";
      b.setAttribute("data-plan", plan);
      b.textContent = ND.t(plan === "developer" ? "badge.developer" : "badge.premium");
      c.connChip.appendChild(b);
    },

    /* ---- payment modal ---- */
    // info: { amount, planName, loggedIn }
    fillPay(info) {
      const c = this.el;
      if (c.payAmount) c.payAmount.textContent = U.formatIDR(info.amount);
      if (c.payPlanName) c.payPlanName.textContent = info.planName || "Premium";
      if (c.payNeedLogin) c.payNeedLogin.hidden = !!info.loggedIn;
    },

    // Render the payment-method picker. methods: rows from payment_methods.
    // onPick(method) is called when the buyer selects one (also for the default).
    renderMethods(methods, onPick) {
      const c = this.el;
      this._methods = Array.isArray(methods) ? methods : [];
      this._onPickMethod = onPick || this._onPickMethod || function () {};
      const wrap = c.payMethods;
      const details = c.payMethodDetails;
      if (!wrap) return;
      wrap.innerHTML = "";
      const list = this._methods.length ? this._methods : [{
        label: ND.config.PAY.bankName, kind: "bank",
        account: ND.config.PAY.bankAccount, holder: ND.config.PAY.bankHolder,
      }];
      const showDetails = (m) => {
        this._onPickMethod(m);
        if (!details) return;
        const rows = [];
        if (m.account) rows.push(this._payRow(ND.t("pay.account"), m.account, true));
        if (m.holder) rows.push(this._payRow(ND.t("pay.holder"), m.holder, false));
        if (m.instructions) rows.push('<p class="pay-note">' + U.escapeHtml(m.instructions) + "</p>");
        const qr = m.qr_url
          ? '<img class="pay-qr" alt="QR" src="' + U.escapeHtml(m.qr_url) + '">' : "";
        details.innerHTML = qr + rows.join("");
      };
      list.forEach((m, i) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pay-method-chip" + (i === 0 ? " is-active" : "");
        chip.textContent = m.label + (m.kind && m.kind !== "bank" ? " (" + m.kind.toUpperCase() + ")" : "");
        chip.addEventListener("click", () => {
          wrap.querySelectorAll(".pay-method-chip").forEach((x) => x.classList.remove("is-active"));
          chip.classList.add("is-active");
          showDetails(m);
        });
        wrap.appendChild(chip);
      });
      if (list[0]) showDetails(list[0]);
    },
    // A copyable account row for the method details area.
    _payRow(label, value, copy) {
      return '<div class="pay-row"><span class="pay-row-label">' + U.escapeHtml(label) + "</span>" +
        '<span class="pay-row-val">' + U.escapeHtml(value) + "</span>" +
        (copy ? '<button class="btn btn-ghost btn-sm" type="button" data-copyval="' + U.escapeHtml(value) + '">' +
          U.escapeHtml(ND.t("pay.copy")) + "</button>" : "") + "</div>";
    },
    openPay() {
      const c = this.el;
      if (!c.payModal) return;
      c.payModal.hidden = false;
      document.body.style.overflow = "hidden";
      const card = c.payModal.querySelector(".modal-card");
      if (card) card.scrollTop = 0;
      const first = c.payModal.querySelector(".modal-x");
      if (first) first.focus();
    },
    closePay() {
      const c = this.el;
      if (!c.payModal) return;
      c.payModal.hidden = true;
      document.body.style.overflow = "";
    },
    isPayOpen() { return this.el.payModal && !this.el.payModal.hidden; },
    setProofName(name) {
      if (this.el.payProofName) this.el.payProofName.textContent = name ? ND.t("pay.proofSelected", { name: name }) : "";
    },

    /* ---- toasts ---- */
    toast(msg, type) {
      type = type || "info";
      const t = document.createElement("div");
      t.className = "toast " + type;
      t.innerHTML = (ICON[type] || ICON.info) + "<span>" + U.escapeHtml(msg) + "</span>";
      this.el.toasts.appendChild(t);
      setTimeout(() => {
        t.classList.add("leaving");
        setTimeout(() => t.remove(), 260);
      }, 4200);
    },
  };

  /* ---- small history store (surfaced in the idle log for return visits) ---- */
  ND.history = {
    list() { return U.load(ND.config.STORAGE.history, true) || []; },
    add(entry) {
      const all = this.list().filter((e) => e.url !== entry.url);
      all.unshift(entry);
      U.store(ND.config.STORAGE.history, all.slice(0, 8));
    },
  };

  ND.ui = ui;
})(window.ND);
