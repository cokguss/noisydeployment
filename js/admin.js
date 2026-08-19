/* ============================================================================
   admin.js — hidden dashboard logic for the two admin accounts.

   Loads on admin/index.html only. Uses ND.db (from supabase.js) to reach the
   same Supabase project the site uses, then signs in with Supabase Auth. Every
   privileged action below is also enforced server-side by Row-Level Security
   (the is_admin() policy): this UI is a convenience, not the security boundary.
   A non-admin who somehow loads this page can sign in but every write fails.

   No secrets are ever logged. The typed password goes straight to
   supabase-js signInWithPassword and is never stored or printed.
   ==========================================================================*/
(function (ND) {
  "use strict";

  const U = ND.util;
  const $ = (id) => document.getElementById(id);
  const MONTH_DAYS = 30;

  const A = {
    client: null,
    adminEmail: null,
    tab: "payments",
    _pendingOnly: true,

    /* -------------------------------------------------------------- boot */
    async boot() {
      this.cacheStatics();
      this.wire();

      await ND.db.init();
      if (!ND.db.enabled) {
        // Supabase not configured (or CDN blocked): the dashboard can't work.
        $("configWarn").hidden = false;
        $("btnLogin").disabled = true;
        return;
      }
      this.client = ND.db.client;

      // Resume an existing admin session if one is stored.
      try {
        const { data } = await this.client.auth.getSession();
        if (data && data.session) {
          await this.afterLogin(data.session);
          return;
        }
      } catch (_) { /* fall through to login */ }
      this.showLogin();
    },

    cacheStatics() {
      this.loginView = $("loginView");
      this.dashView = $("dashView");
    },

    wire() {
      $("btnLogin").addEventListener("click", () => this.signIn());
      ["email", "password"].forEach((id) => {
        $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") this.signIn(); });
      });
      $("btnLogout").addEventListener("click", () => this.signOut());
      $("btnRefresh").addEventListener("click", () => this.reloadTab());

      // Tabs
      $("adminTabs").addEventListener("click", (e) => {
        const btn = e.target.closest(".admin-tab");
        if (btn) this.switchTab(btn.getAttribute("data-tab"));
      });

      // Payments filter
      $("pendingOnly").addEventListener("change", (e) => {
        this._pendingOnly = e.target.checked;
        this.loadPayments();
      });

      // Users search
      $("btnUserSearch").addEventListener("click", () => this.searchUsers());
      $("userSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") this.searchUsers(); });

      // Announcements
      $("btnAnnCreate").addEventListener("click", () => this.createAnnouncement());
      // Settings
      $("btnSaveSettings").addEventListener("click", () => this.saveSettings());

      // Delegated actions inside the panels (approve/reject/user/product/ann).
      document.querySelector(".admin-main")
        .addEventListener("click", (e) => this.onPanelClick(e));
    },

    /* -------------------------------------------------------------- auth */
    async signIn() {
      const email = $("email").value.trim();
      const password = $("password").value;
      const err = $("loginError");
      err.hidden = true;
      if (!email || !password) {
        err.textContent = "Enter your email and password.";
        err.hidden = false;
        return;
      }
      this.busy($("btnLogin"), true);
      try {
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await this.afterLogin(data.session);
      } catch (e) {
        err.textContent = (e && e.message) || "Sign in failed.";
        err.hidden = false;
      } finally {
        this.busy($("btnLogin"), false);
      }
    },

    // Confirm the signed-in user is actually on the admin allowlist. The
    // admins table is readable only when is_admin() is true, so a non-admin
    // sees zero rows: treat that as "not an admin" and sign back out.
    async afterLogin(session) {
      const email = session && session.user && session.user.email;
      let ok = false;
      try {
        const { data, error } = await this.client.from("admins").select("email");
        if (!error && data && data.length > 0) ok = true;
      } catch (_) { ok = false; }

      if (!ok) {
        await this.client.auth.signOut();
        this.showLogin();
        const err = $("loginError");
        err.textContent = "This account is not an admin. Ask a developer to add your email to the allowlist.";
        err.hidden = false;
        return;
      }

      this.adminEmail = email;
      $("adminWho").textContent = email || "";
      this.showDash();
      this.switchTab("payments");
      this.refreshPendingBadge();
    },

    async signOut() {
      try { await this.client.auth.signOut(); } catch (_) {}
      this.adminEmail = null;
      $("password").value = "";
      this.showLogin();
    },

    showLogin() { this.loginView.hidden = false; this.dashView.hidden = true; },
    showDash() { this.loginView.hidden = true; this.dashView.hidden = false; },

    /* -------------------------------------------------------------- tabs */
    switchTab(name) {
      this.tab = name;
      U.qsa(".admin-tab", $("adminTabs")).forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-tab") === name);
      });
      U.qsa(".admin-panel").forEach((p) => {
        p.hidden = p.getAttribute("data-panel") !== name;
      });
      this.reloadTab();
    },

    reloadTab() {
      switch (this.tab) {
        case "payments": return this.loadPayments();
        case "users": return this.searchUsers();
        case "products": return this.loadProducts();
        case "methods": return this.loadMethods();
        case "announcements": return this.loadAnnouncements();
        case "settings": return this.loadSettings();
      }
    },

    onPanelClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      const card = btn.closest(".admin-item");
      switch (act) {
        case "approve": return this.decide(btn.getAttribute("data-id"), btn.getAttribute("data-login"), true, btn, parseInt(btn.getAttribute("data-days"), 10) || MONTH_DAYS);
        case "reject": return this.decide(btn.getAttribute("data-id"), btn.getAttribute("data-login"), false, btn);
        case "user-apply": return this.applyPlan(card, btn);
        case "user-extend": return this.extendPremium(btn.getAttribute("data-login"), btn);
        case "user-reset": return this.resetQuota(btn.getAttribute("data-login"), btn);
        case "user-create": return this.createProfile(btn);
        case "user-delete": return this.deleteProfile(btn.getAttribute("data-login"), btn);
        case "product-save": return this.saveProduct(card, btn);
        case "product-delete": return this.deleteProduct(btn.getAttribute("data-id"), btn);
        case "product-add": return this.createProduct(btn);
        case "ann-toggle": return this.toggleAnnouncement(btn.getAttribute("data-id"), btn.getAttribute("data-active") !== "true", btn);
        case "ann-delete": return this.deleteAnnouncement(btn.getAttribute("data-id"), btn);
        case "method-save": return this.saveMethod(card, btn);
        case "method-delete": return this.deleteMethod(btn.getAttribute("data-id"), btn);
        case "method-add": return this.addMethod(btn);
        case "method-qr": return this.uploadMethodQr(card, btn);
      }
    },

    /* ---------------------------------------------------------- payments */
    async loadPayments() {
      const box = $("paymentsList");
      box.innerHTML = '<p class="admin-empty">Loading…</p>';
      try {
        let q = this.client.from("payments").select("*").order("created_at", { ascending: false }).limit(100);
        if (this._pendingOnly) q = q.eq("status", "pending");
        const { data, error } = await q;
        if (error) throw error;
        this.renderPayments(data || []);
        this.refreshPendingBadge();
      } catch (e) {
        box.innerHTML = '<p class="admin-empty">Could not load payments: ' + U.escapeHtml((e && e.message) || "error") + "</p>";
      }
    },

    renderPayments(rows) {
      const box = $("paymentsList");
      if (!rows.length) {
        box.innerHTML = '<p class="admin-empty">' + (this._pendingOnly ? "No pending payments." : "No payments yet.") + "</p>";
        return;
      }
      box.innerHTML = rows.map((p) => {
        const login = U.escapeHtml(p.github_login || "");
        const amount = p.amount ? U.formatIDR(p.amount) : "not set";
        const method = U.escapeHtml(p.method || "seabank");
        const planInfo = p.plan_name
          ? " &middot; " + U.escapeHtml(p.plan_name) + " (" + (p.days != null ? p.days : 30) + "d)" : "";
        const when = this.fmtDate(p.created_at);
        const proof = p.proof_url
          ? '<a href="' + U.escapeHtml(p.proof_url) + '" target="_blank" rel="noopener noreferrer" class="admin-proof-link">' +
            '<img class="admin-proof" src="' + U.escapeHtml(p.proof_url) + '" alt="Payment proof from ' + login + '" loading="lazy" /></a>'
          : '<p class="admin-note-line">No proof image was uploaded.</p>';
        const reviewed = p.reviewed_at
          ? '<p class="admin-item-sub">Reviewed by ' + U.escapeHtml(p.reviewed_by || "?") + " on " + this.fmtDate(p.reviewed_at) + "</p>"
          : "";
        const actions = p.status === "pending"
          ? '<div class="admin-item-actions">' +
              '<button class="btn btn-primary btn-sm" data-act="approve" data-id="' + p.id + '" data-login="' + login + '" data-days="' + (p.days != null ? p.days : 30) + '" data-amount="' + (p.amount || "") + '">Approve, activate Premium</button>' +
              '<button class="btn btn-ghost btn-sm" data-act="reject" data-id="' + p.id + '" data-login="' + login + '">Reject</button>' +
            "</div>"
          : "";
        return '<div class="admin-item" data-id="' + p.id + '">' +
          '<div class="admin-item-head"><div>' +
            '<p class="admin-item-title">@' + login + "</p>" +
            '<p class="admin-item-sub">' + amount + " &middot; " + method + planInfo + " &middot; " + when + "</p>" +
            reviewed +
          "</div>" + this.statusBadge(p.status) + "</div>" +
          '<div class="admin-item-body">' + proof + "</div>" +
          actions +
        "</div>";
      }).join("");
    },

    // Approve = flip payment to approved AND grant/extend Premium. Reject just
    // marks the payment. Both stamp the reviewer + time.
    async decide(id, login, approve, btn, days) {
      this.busy(btn, true);
      try {
        if (approve && login) {
          await this.grantPremium(login, days != null ? days : MONTH_DAYS);
        }
        const { error } = await this.client.from("payments").update({
          status: approve ? "approved" : "rejected",
          reviewed_by: this.adminEmail,
          reviewed_at: this.nowIso(),
        }).eq("id", id);
        if (error) throw error;
        this.toast(approve ? ("Premium activated for @" + login) : "Payment rejected", "ok");
        this.loadPayments();
      } catch (e) {
        this.toast("Action failed: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    // Upsert a profile to premium, extending from the later of now / current
    // expiry. Never downgrades a developer.
    async grantPremium(login, days) {
      const cur = await this.client.from("profiles")
        .select("plan, premium_until").eq("github_login", login).maybeSingle();
      const existing = cur && cur.data;
      if (existing && existing.plan === "developer") return; // already unlimited
      const until = this.addDays(days != null ? days : MONTH_DAYS, existing && existing.premium_until);
      const { error } = await this.client.from("profiles").upsert({
        github_login: login,
        plan: "premium",
        premium_until: until,
        updated_at: this.nowIso(),
      }, { onConflict: "github_login" });
      if (error) throw error;
    },

    async refreshPendingBadge() {
      try {
        const { count } = await this.client.from("payments")
          .select("id", { count: "exact", head: true }).eq("status", "pending");
        const badge = $("pendingBadge");
        if (count && count > 0) { badge.textContent = String(count); badge.hidden = false; }
        else { badge.hidden = true; }
      } catch (_) { /* non-fatal */ }
    },

    /* ------------------------------------------------------------- users */
    async searchUsers() {
      const term = $("userSearch").value.trim();
      const box = $("usersList");
      box.innerHTML = '<p class="admin-empty">' + (term ? "Searching…" : "Loading…") + "</p>";
      try {
        // No term: list the most recently touched profiles so newly-approved
        // premium users show up without the admin knowing their login. With a
        // term: filter by login. The create-a-profile card is only useful when
        // an exact login was typed, so pass the term through either way.
        let q = this.client.from("profiles").select("*")
          .order("updated_at", { ascending: false }).limit(term ? 25 : 50);
        if (term) q = q.ilike("github_login", "%" + term + "%");
        const { data, error } = await q;
        if (error) throw error;
        this.renderUsers(data || [], term);
      } catch (e) {
        box.innerHTML = '<p class="admin-empty">Search failed: ' + U.escapeHtml((e && e.message) || "error") + "</p>";
      }
    },

    renderUsers(rows, term) {
      const box = $("usersList");
      let html = rows.map((u) => this.userCard(u)).join("");
      // Only offer "create a profile" when an exact login was typed; on the
      // plain (no-term) listing it would just be noise.
      if (term) {
        const safeTerm = U.escapeHtml(term);
        html += '<div class="admin-item" data-new="1">' +
          '<div class="admin-item-head"><div>' +
            '<p class="admin-item-title">Create or set a profile</p>' +
            '<p class="admin-item-sub">GitHub login: @' + safeTerm + "</p>" +
          "</div></div>" +
          '<div class="admin-item-actions">' +
            this.planSelect("new") +
            '<button class="btn btn-primary btn-sm" data-act="user-create" data-login="' + safeTerm + '">Create / set plan</button>' +
          "</div></div>";
      } else if (!rows.length) {
        html = '<p class="admin-empty">No users yet.</p>';
      }
      box.innerHTML = html;
    },

    userCard(u) {
      const login = U.escapeHtml(u.github_login || "");
      const until = u.premium_until ? this.fmtDate(u.premium_until) : "not set";
      const planLabel = u.plan === "developer" ? "developer (unlimited)"
        : u.plan === "premium" ? "premium" : "free";
      return '<div class="admin-item" data-login="' + login + '">' +
        '<div class="admin-item-head"><div>' +
          '<p class="admin-item-title">@' + login + "</p>" +
          '<p class="admin-item-sub">Deploys used: ' + (u.deploy_count || 0) +
            " &middot; Premium until: " + until + "</p>" +
        "</div><span class=\"admin-badge\" data-plan=\"" + U.escapeHtml(u.plan || "free") + "\">" + planLabel + "</span></div>" +
        '<div class="admin-item-actions">' +
          this.planSelect(login, u.plan) +
          '<button class="btn btn-ghost btn-sm" data-act="user-apply" data-login="' + login + '">Apply plan</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="user-extend" data-login="' + login + '">Extend +30d</button>' +
          '<button class="btn btn-quiet btn-sm" data-act="user-reset" data-login="' + login + '">Reset quota</button>' +
          '<button class="btn btn-danger btn-sm" data-act="user-delete" data-login="' + login + '">Delete user</button>' +
        "</div></div>";
    },

    // Delete the profile row only. Past payments/deployments are intentionally
    // kept as an archive (they reference the login as plain text, no FK).
    async deleteProfile(login, btn) {
      if (!login) return;
      if (!window.confirm("Delete profile @" + login + "? Their payment and deploy history stays as an archive.")) return;
      this.busy(btn, true);
      try {
        const { error } = await this.client.from("profiles").delete().eq("github_login", login);
        if (error) throw error;
        this.toast("Profile @" + login + " deleted (history kept)", "ok");
        this.searchUsers();
      } catch (e) {
        this.toast("Delete failed: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    planSelect(key, current) {
      const opt = (v, label) => '<option value="' + v + '"' + (current === v ? " selected" : "") + ">" + label + "</option>";
      return '<select class="admin-plan-select" data-plan-for="' + key + '">' +
        opt("free", "free") + opt("premium", "premium") + opt("developer", "developer") + "</select>";
    },

    planFor(card, key) {
      const sel = card.querySelector('[data-plan-for="' + key + '"]');
      return sel ? sel.value : "free";
    },

    async applyPlan(card, btn) {
      const login = btn.getAttribute("data-login");
      const plan = this.planFor(card, login);
      await this.setPlan(login, plan, btn);
    },

    async createProfile(btn) {
      const login = btn.getAttribute("data-login");
      const card = btn.closest(".admin-item");
      const plan = this.planFor(card, "new");
      if (!login) return;
      await this.setPlan(login, plan, btn);
      $("userSearch").value = login;
      this.searchUsers();
    },

    async setPlan(login, plan, btn) {
      this.busy(btn, true);
      try {
        const row = { github_login: login, plan, updated_at: this.nowIso() };
        if (plan === "premium") {
          const cur = await this.client.from("profiles")
            .select("premium_until").eq("github_login", login).maybeSingle();
          row.premium_until = this.addDays(MONTH_DAYS, cur && cur.data && cur.data.premium_until);
        } else {
          row.premium_until = null; // free and developer don't use an expiry
        }
        const { error } = await this.client.from("profiles").upsert(row, { onConflict: "github_login" });
        if (error) throw error;
        this.toast("Set @" + login + " to " + plan, "ok");
        if (this.tab === "users") this.searchUsers();
      } catch (e) {
        this.toast("Could not set plan: " + ((e && e.message) || "error"), "err");
      } finally {
        this.busy(btn, false);
      }
    },

    async extendPremium(login, btn) {
      this.busy(btn, true);
      try {
        const cur = await this.client.from("profiles")
          .select("plan, premium_until").eq("github_login", login).maybeSingle();
        const existing = cur && cur.data;
        if (existing && existing.plan === "developer") {
          this.toast("@" + login + " is a developer (already unlimited)", "info");
          return;
        }
        const until = this.addDays(MONTH_DAYS, existing && existing.premium_until);
        const { error } = await this.client.from("profiles").upsert({
          github_login: login, plan: "premium", premium_until: until, updated_at: this.nowIso(),
        }, { onConflict: "github_login" });
        if (error) throw error;
        this.toast("Extended @" + login + " to " + this.fmtDate(until), "ok");
        this.searchUsers();
      } catch (e) {
        this.toast("Could not extend: " + ((e && e.message) || "error"), "err");
      } finally {
        this.busy(btn, false);
      }
    },

    // Reset the free counter for a login AND zero the IP counters tied to that
    // login's past deploys, so a shared-IP false-block is cleared too.
    async resetQuota(login, btn) {
      this.busy(btn, true);
      try {
        const { error } = await this.client.from("profiles")
          .update({ deploy_count: 0, updated_at: this.nowIso() }).eq("github_login", login);
        if (error) throw error;

        const dep = await this.client.from("deployments")
          .select("ip_hash").eq("github_login", login).limit(50);
        const hashes = Array.from(new Set((dep.data || []).map((d) => d.ip_hash).filter(Boolean)));
        if (hashes.length) {
          await this.client.from("ip_usage").update({ deploy_count: 0 }).in("ip_hash", hashes);
        }
        this.toast("Reset quota for @" + login + (hashes.length ? " and " + hashes.length + " IP(s)" : ""), "ok");
        this.searchUsers();
      } catch (e) {
        this.toast("Could not reset quota: " + ((e && e.message) || "error"), "err");
      } finally {
        this.busy(btn, false);
      }
    },

    /* ---------------------------------------------------------- products */
    async loadProducts() {
      const box = $("productsList");
      box.innerHTML = '<p class="admin-empty">Loading…</p>';
      try {
        const { data, error } = await this.client.from("products")
          .select("*").order("sort", { ascending: true });
        if (error) throw error;
        this.renderProducts(data || []);
      } catch (e) {
        box.innerHTML = '<p class="admin-empty">Could not load products: ' + U.escapeHtml((e && e.message) || "error") + "</p>";
      }
    },

    /* -------------------------------------------------- payment methods */
    async loadMethods() {
      const box = $("methodsList");
      if (!box) return;
      box.innerHTML = '<p class="admin-empty">Loading…</p>';
      try {
        const { data, error } = await this.client.from("payment_methods")
          .select("*").order("sort", { ascending: true });
        if (error) throw error;
        this.renderMethods(data || []);
      } catch (e) {
        box.innerHTML = '<p class="admin-empty">Could not load payment methods: ' + U.escapeHtml((e && e.message) || "error") + "</p>";
      }
    },

    renderMethods(rows) {
      const box = $("methodsList");
      if (!box) return;
      const addBtn = '<div class="admin-item-actions admin-add-row">' +
        '<button class="btn btn-ghost btn-sm" data-act="method-add">+ Add payment method</button></div>';
      const kindOpt = (cur) => ["bank", "ewallet", "qris", "other"].map((k) =>
        '<option value="' + k + '"' + (cur === k ? " selected" : "") + ">" + k + "</option>").join("");
      const items = rows.map((m) => {
        const qr = m.qr_url
          ? '<img class="admin-qr-thumb" src="' + U.escapeHtml(m.qr_url) + '" alt="QR for ' + U.escapeHtml(m.label || "") + '" loading="lazy" />'
          : '<p class="admin-note-line">No QR image.</p>';
        return '<div class="admin-item" data-id="' + m.id + '">' +
          '<div class="admin-form">' +
            this.fieldRow("Label", '<input type="text" data-f="label" value="' + U.escapeHtml(m.label || "") + '" />') +
            '<div class="field"><label>Kind</label><select class="admin-plan-select" data-f="kind">' + kindOpt(m.kind) + "</select></div>" +
            '<div class="field"><label>Confirm to</label><select class="admin-plan-select" data-f="confirm_target">' +
              '<option value="dev"' + (m.confirm_target !== "support" ? " selected" : "") + ">Developer</option>" +
              '<option value="support"' + (m.confirm_target === "support" ? " selected" : "") + ">Support</option>" +
            "</select></div>" +
            this.fieldRow("Account / number (optional)", '<input type="text" data-f="account" value="' + U.escapeHtml(m.account || "") + '" />') +
            this.fieldRow("Holder (optional)", '<input type="text" data-f="holder" value="' + U.escapeHtml(m.holder || "") + '" />') +
            this.fieldRow("Instructions (optional)", '<input type="text" data-f="instructions" value="' + U.escapeHtml(m.instructions || "") + '" />') +
            '<div class="field"><label>QR image (optional)</label>' + qr +
              '<input type="file" accept="image/*" data-f="qrfile" class="admin-file" />' +
              '<button class="btn btn-ghost btn-sm" data-act="method-qr" data-id="' + m.id + '">Upload QR</button></div>' +
            '<label class="admin-inline admin-active"><input type="checkbox" data-f="active"' + (m.active ? " checked" : "") + " /> Active (shown to buyers)</label>" +
            '<div class="admin-item-actions">' +
              '<button class="btn btn-primary btn-sm" data-act="method-save" data-id="' + m.id + '">Save method</button>' +
              '<button class="btn btn-danger btn-sm" data-act="method-delete" data-id="' + m.id + '">Delete</button>' +
            "</div>" +
          "</div></div>";
      }).join("");
      box.innerHTML = (rows.length ? items : '<p class="admin-empty">No payment methods yet.</p>') + addBtn;
    },

    async saveMethod(card, btn) {
      this.busy(btn, true);
      try {
        const val = (f) => { const el = card.querySelector('[data-f="' + f + '"]'); return el ? el.value : ""; };
        const active = card.querySelector('[data-f="active"]').checked;
        const patch = {
          label: val("label").trim(),
          kind: val("kind") || "bank",
          confirm_target: val("confirm_target") === "support" ? "support" : "dev",
          account: val("account").trim() || null,
          holder: val("holder").trim() || null,
          instructions: val("instructions").trim() || null,
          active,
          updated_at: this.nowIso(),
        };
        // If a QR file is selected, upload it as part of Save so the buyer sees it.
        const input = card.querySelector('[data-f="qrfile"]');
        const file = input && input.files && input.files[0];
        if (file) patch.qr_url = await ND.db.uploadAsset(file, "qr-" + card.getAttribute("data-id"));
        const { error } = await this.client.from("payment_methods")
          .update(patch).eq("id", card.getAttribute("data-id"));
        if (error) throw error;
        this.toast(file ? "Method + QR saved. The site updates live." : "Payment method saved. The site updates live.", "ok");
        if (file) this.loadMethods();
      } catch (e) {
        console.error("saveMethod failed:", e);
        this.toast("Could not save method: " + ((e && e.message) || "error"), "err");
      } finally {
        this.busy(btn, false);
      }
    },

    async addMethod(btn) {
      this.busy(btn, true);
      try {
        const { error } = await this.client.from("payment_methods").insert({
          label: "New method", kind: "bank", active: false, sort: 100,
        });
        if (error) throw error;
        this.toast("Method added. Fill in the details, then set it Active.", "ok");
        this.loadMethods();
      } catch (e) {
        this.toast("Could not add method: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    async deleteMethod(id, btn) {
      if (!window.confirm("Delete this payment method?")) return;
      this.busy(btn, true);
      try {
        const { error } = await this.client.from("payment_methods").delete().eq("id", id);
        if (error) throw error;
        this.toast("Payment method deleted.", "ok");
        this.loadMethods();
      } catch (e) {
        this.toast("Could not delete method: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    async uploadMethodQr(card, btn) {
      const input = card.querySelector('[data-f="qrfile"]');
      const file = input && input.files && input.files[0];
      if (!file) { this.toast("Choose an image first.", "err"); return; }
      this.busy(btn, true);
      try {
        const url = await ND.db.uploadAsset(file, "qr-" + card.getAttribute("data-id"));
        const { error } = await this.client.from("payment_methods")
          .update({ qr_url: url, updated_at: this.nowIso() }).eq("id", card.getAttribute("data-id"));
        if (error) throw error;
        this.toast("QR uploaded.", "ok");
        this.loadMethods();
      } catch (e) {
        console.error("uploadMethodQr failed:", e);
        this.toast("Could not upload QR: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    renderProducts(rows) {
      const box = $("productsList");
      const addBtn = '<div class="admin-item-actions admin-add-row">' +
        '<button class="btn btn-ghost btn-sm" data-act="product-add">+ Add plan</button></div>';
      if (!rows.length) {
        box.innerHTML = '<p class="admin-empty">No products defined.</p>' + addBtn;
        return;
      }
      box.innerHTML = rows.map((p) => {
        const feats = (p.features || []).join("\n");
        return '<div class="admin-item" data-id="' + p.id + '">' +
          '<div class="admin-form">' +
            this.fieldRow("Name", '<input type="text" data-f="name" value="' + U.escapeHtml(p.name || "") + '" />') +
            this.fieldRow("Tagline (optional)", '<input type="text" data-f="tagline" value="' + U.escapeHtml(p.tagline || "") + '" placeholder="e.g. For people who ship a lot" />') +
            this.fieldRow("Original price (IDR)", '<input type="text" inputmode="numeric" data-f="price" value="' + (p.price || 0) + '" />') +
            this.fieldRow("Discount price (IDR)", '<input type="text" inputmode="numeric" data-f="discount_price" value="' + (p.discount_price != null ? p.discount_price : "") + '" placeholder="blank = no sale" />') +
            this.fieldRow("Period", '<input type="text" data-f="period" value="' + U.escapeHtml(p.period || "month") + '" placeholder="day, week, month, quarter, year" />') +
            '<div class="field"><label>Features (one per line)</label>' +
              '<textarea class="admin-textarea" data-f="features" rows="7">' + U.escapeHtml(feats) + "</textarea></div>" +
            '<label class="admin-inline admin-active"><input type="checkbox" data-f="active"' + (p.active ? " checked" : "") + " /> Active (shown on site)</label>" +
            '<div class="admin-item-actions">' +
              '<button class="btn btn-primary btn-sm" data-act="product-save" data-id="' + p.id + '">Save product</button>' +
              '<button class="btn btn-danger btn-sm" data-act="product-delete" data-id="' + p.id + '">Delete plan</button>' +
            "</div>" +
          "</div></div>";
      }).join("") + addBtn;
    },

    async saveProduct(card, btn) {
      this.busy(btn, true);
      try {
        const val = (f) => { const el = card.querySelector('[data-f="' + f + '"]'); return el ? el.value : ""; };
        const price = parseInt(val("price"), 10);
        const discRaw = val("discount_price").trim();
        const disc = discRaw === "" ? null : parseInt(discRaw, 10);
        const feats = val("features").split("\n").map((s) => s.trim()).filter(Boolean);
        const active = card.querySelector('[data-f="active"]').checked;
        const { error } = await this.client.from("products").update({
          name: val("name").trim(),
          tagline: val("tagline").trim() || null,
          price: isNaN(price) ? 0 : price,
          discount_price: disc != null && isNaN(disc) ? null : disc,
          period: val("period").trim() || "month",
          features: feats,
          active,
          updated_at: this.nowIso(),
        }).eq("id", card.getAttribute("data-id"));
        if (error) throw error;
        this.toast("Product saved. The site updates live.", "ok");
      } catch (e) {
        this.toast("Could not save product: " + ((e && e.message) || "error"), "err");
      } finally {
        this.busy(btn, false);
      }
    },

    async createProduct(btn) {
      this.busy(btn, true);
      try {
        const { error } = await this.client.from("products").insert({
          name: "New plan", price: 50000, discount_price: null, period: "month",
          features: ["Unlimited deploys"], active: false, sort: 100,
        });
        if (error) throw error;
        this.toast("Plan added. Edit it, then set it Active to show it on the site.", "ok");
        this.loadProducts();
      } catch (e) {
        this.toast("Could not add plan: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    async deleteProduct(id, btn) {
      if (!window.confirm("Delete this plan? It will disappear from the site.")) return;
      this.busy(btn, true);
      try {
        const { error } = await this.client.from("products").delete().eq("id", id);
        if (error) throw error;
        this.toast("Plan deleted.", "ok");
        this.loadProducts();
      } catch (e) {
        this.toast("Could not delete plan: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    /* ----------------------------------------------------- announcements */
    async loadAnnouncements() {
      const box = $("annList");
      box.innerHTML = '<p class="admin-empty">Loading…</p>';
      try {
        const { data, error } = await this.client.from("announcements")
          .select("*").order("created_at", { ascending: false }).limit(50);
        if (error) throw error;
        this.renderAnnouncements(data || []);
      } catch (e) {
        box.innerHTML = '<p class="admin-empty">Could not load announcements: ' + U.escapeHtml((e && e.message) || "error") + "</p>";
      }
    },

    renderAnnouncements(rows) {
      const box = $("annList");
      if (!rows.length) { box.innerHTML = '<p class="admin-empty">No announcements yet.</p>'; return; }
      box.innerHTML = rows.map((a) => {
        return '<div class="admin-item" data-id="' + a.id + '">' +
          '<div class="admin-item-head"><div>' +
            '<p class="admin-item-title">' + U.escapeHtml(a.message || "") + "</p>" +
            '<p class="admin-item-sub">' + U.escapeHtml(a.level || "info") + " &middot; " + this.fmtDate(a.created_at) + "</p>" +
          "</div><span class=\"admin-badge\" data-active=\"" + (a.active ? "1" : "0") + "\">" + (a.active ? "live" : "hidden") + "</span></div>" +
          '<div class="admin-item-actions">' +
            '<button class="btn btn-ghost btn-sm" data-act="ann-toggle" data-id="' + a.id + '" data-active="' + (a.active ? "true" : "false") + '">' + (a.active ? "Hide" : "Show") + "</button>" +
            '<button class="btn btn-quiet btn-sm" data-act="ann-delete" data-id="' + a.id + '">Delete</button>' +
          "</div></div>";
      }).join("");
    },

    async createAnnouncement() {
      const input = $("annMsg");
      const msg = input.value.trim();
      if (!msg) { this.toast("Type a message first.", "err"); return; }
      const btn = $("btnAnnCreate");
      this.busy(btn, true);
      try {
        // Only one banner shows on the site (the newest active). Hide older
        // ones so publishing a new banner replaces the current one.
        await this.client.from("announcements").update({ active: false }).eq("active", true);
        const { error } = await this.client.from("announcements").insert({
          message: msg, level: $("annLevel").value, active: true,
        });
        if (error) throw error;
        input.value = "";
        this.toast("Announcement published.", "ok");
        this.loadAnnouncements();
      } catch (e) {
        this.toast("Could not publish: " + ((e && e.message) || "error"), "err");
      } finally {
        this.busy(btn, false);
      }
    },

    async toggleAnnouncement(id, makeActive, btn) {
      this.busy(btn, true);
      try {
        if (makeActive) {
          // Enforce single live banner.
          await this.client.from("announcements").update({ active: false }).eq("active", true);
        }
        const { error } = await this.client.from("announcements").update({ active: makeActive }).eq("id", id);
        if (error) throw error;
        this.loadAnnouncements();
      } catch (e) {
        this.toast("Could not update: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    async deleteAnnouncement(id, btn) {
      this.busy(btn, true);
      try {
        const { error } = await this.client.from("announcements").delete().eq("id", id);
        if (error) throw error;
        this.loadAnnouncements();
      } catch (e) {
        this.toast("Could not delete: " + ((e && e.message) || "error"), "err");
        this.busy(btn, false);
      }
    },

    /* ---------------------------------------------------------- settings */
    async loadSettings() {
      try {
        const { data, error } = await this.client.from("settings").select("*").eq("id", 1).maybeSingle();
        if (error) throw error;
        const s = data || {};
        $("setBankName").value = s.bank_name || "";
        $("setBankAccount").value = s.bank_account || "";
        $("setBankHolder").value = s.bank_holder || "";
        $("setTeleDev").value = s.telegram_dev || "";
        $("setTeleSupport").value = s.telegram_support || "";
        $("setFreeLimit").value = s.free_limit != null ? s.free_limit : "";
      } catch (e) {
        this.toast("Could not load settings: " + ((e && e.message) || "error"), "err");
      }
    },

    async saveSettings() {
      const btn = $("btnSaveSettings");
      this.busy(btn, true);
      try {
        const limit = parseInt($("setFreeLimit").value, 10);
        const { error } = await this.client.from("settings").upsert({
          id: 1,
          bank_name: $("setBankName").value.trim(),
          bank_account: $("setBankAccount").value.trim(),
          bank_holder: $("setBankHolder").value.trim(),
          telegram_dev: $("setTeleDev").value.trim().replace(/^@/, ""),
          telegram_support: $("setTeleSupport").value.trim().replace(/^@/, ""),
          free_limit: isNaN(limit) ? 3 : Math.max(0, limit),
          updated_at: this.nowIso(),
        }, { onConflict: "id" });
        if (error) throw error;
        this.toast("Settings saved.", "ok");
      } catch (e) {
        this.toast("Could not save settings: " + ((e && e.message) || "error"), "err");
      } finally {
        this.busy(btn, false);
      }
    },

    /* --------------------------------------------------------- utilities */
    statusBadge(status) {
      const s = status || "pending";
      return '<span class="admin-badge" data-status="' + U.escapeHtml(s) + '">' + U.escapeHtml(s) + "</span>";
    },

    fieldRow(label, control) {
      return '<div class="field"><label>' + U.escapeHtml(label) + "</label>" + control + "</div>";
    },

    // Browser JS: Date is available here (the no-Date rule is for Workflow
    // scripts only). Compute expiry from the later of now / current expiry.
    addDays(days, fromIso) {
      const now = new Date();
      let start = now;
      if (fromIso) {
        const f = new Date(fromIso);
        if (!isNaN(f.getTime()) && f.getTime() > now.getTime()) start = f;
      }
      return new Date(start.getTime() + days * 86400000).toISOString();
    },

    nowIso() { return new Date().toISOString(); },

    fmtDate(iso) {
      if (!iso) return "unknown";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "unknown";
      try {
        return d.toLocaleString(undefined, {
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
      } catch (_) { return d.toISOString().slice(0, 16).replace("T", " "); }
    },

    busy(btn, on) {
      if (!btn) return;
      btn.disabled = on;
      const label = btn.querySelector(".btn-label");
      const spin = btn.querySelector(".spinner");
      if (label && spin) { label.hidden = on; spin.hidden = !on; }
    },

    toast(msg, type) {
      type = type || "info";
      const box = $("toasts");
      if (!box) return;
      const t = document.createElement("div");
      t.className = "toast " + type;
      const span = document.createElement("span");
      span.textContent = msg;
      t.appendChild(span);
      box.appendChild(t);
      setTimeout(() => {
        t.classList.add("leaving");
        setTimeout(() => t.remove(), 260);
      }, 3600);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => A.boot());
  } else {
    A.boot();
  }

  ND.admin = A;
})(window.ND);
