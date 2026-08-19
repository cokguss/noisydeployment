/* ============================================================================
   supabase.js — thin data layer over supabase-js v2 (loaded from CDN).

   Everything degrades gracefully: if SUPABASE_URL / SUPABASE_ANON_KEY are blank
   (or the CDN can't load, e.g. offline / file://), ND.db.enabled stays false and
   the app runs in "no account" mode — deploys work, but there's no quota,
   premium, payments, or admin. This keeps Phase 1 behavior intact.

   The anon key is public by design; Row-Level Security protects the data and the
   Edge Functions own all quota logic (see supabase/).
   ==========================================================================*/
(function (ND) {
  "use strict";
  const cfg = ND.config;

  const db = {
    enabled: false,
    client: null,
    _ready: null,

    /* Load supabase-js from CDN and create the client. Idempotent; returns a
       promise that resolves to the client (or null if unavailable). */
    init() {
      if (this._ready) return this._ready;
      this._ready = (async () => {
        if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
        try {
          const mod = await import("https://esm.sh/@supabase/supabase-js@2");
          this.client = mod.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true },
          });
          this.enabled = true;
          return this.client;
        } catch (e) {
          console.warn("Supabase unavailable, running without accounts:", e && e.message);
          return null;
        }
      })();
      return this._ready;
    },

    /* ---- reads (public) ---- */
    async getProfile(login) {
      if (!this.enabled || !login) return null;
      const { data } = await this.client
        .from("profiles").select("plan, premium_until, deploy_count")
        .eq("github_login", login).maybeSingle();
      return data || null;
    },

    async getActiveProduct() {
      if (!this.enabled) return null;
      const { data } = await this.client
        .from("products").select("*").eq("active", true).order("sort", { ascending: true }).limit(1);
      return (data && data[0]) || null;
    },

    // All active plans, ordered — the site renders one card per row.
    async getActiveProducts() {
      if (!this.enabled) return [];
      const { data } = await this.client
        .from("products").select("*").eq("active", true).order("sort", { ascending: true });
      return data || [];
    },

    // Active payment methods buyers can choose from (bank, e-wallet, QRIS...).
    async listPaymentMethods() {
      if (!this.enabled) return [];
      const { data } = await this.client
        .from("payment_methods").select("*").eq("active", true).order("sort", { ascending: true });
      return data || [];
    },

    async getSettings() {
      if (!this.enabled) return null;
      const { data } = await this.client.from("settings").select("*").eq("id", 1).maybeSingle();
      return data || null;
    },

    async getActiveAnnouncement() {
      if (!this.enabled) return null;
      const nowIso = new Date().toISOString();
      // Visible = active AND started (starts_at null or in the past) AND not
      // ended (ends_at null or in the future). Pull the newest matching banner.
      const { data } = await this.client
        .from("announcements").select("*").eq("active", true)
        .or("starts_at.is.null,starts_at.lte." + nowIso)
        .or("ends_at.is.null,ends_at.gte." + nowIso)
        .order("created_at", { ascending: false }).limit(1);
      return (data && data[0]) || null;
    },

    /* ---- payment proof ---- */
    // Upload an image to the 'proofs' bucket, return its public URL.
    async uploadProof(file, login) {
      if (!this.enabled) throw new Error("accounts disabled");
      const safe = (login || "user").replace(/[^a-z0-9_-]/gi, "");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      // Unique path per upload so a retry (same file) is always an INSERT, never
      // an overwrite. The 'proofs' bucket only grants INSERT to anon, not UPDATE,
      // so upsert on a repeated path would fail with a 403 RLS violation.
      const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const path = safe + "/" + safe + "-" + uniq + "." + ext;
      const { error } = await this.client.storage.from("proofs").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || "image/png",
      });
      if (error) throw error;
      const { data } = this.client.storage.from("proofs").getPublicUrl(path);
      return data.publicUrl;
    },

    async createPayment(login, opts) {
      if (!this.enabled) throw new Error("accounts disabled");
      opts = opts || {};
      const { error } = await this.client.from("payments").insert({
        github_login: login,
        amount: opts.amount,
        proof_url: opts.proofUrl,
        method: opts.method || "seabank",
        plan_name: opts.planName || null,
        days: opts.days != null ? opts.days : 30,
        status: "pending",
      });
      if (error) throw error;
      return true;
    },

    // Admin only: upload an image (e.g. a QR) to the public 'assets' bucket.
    async uploadAsset(file, name) {
      if (!this.enabled) throw new Error("accounts disabled");
      const base = (name || "img").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-{2,}/g, "-");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = base + "-" + file.size + "." + ext;
      const { error } = await this.client.storage.from("assets").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type || "image/png",
      });
      if (error) throw error;
      const { data } = this.client.storage.from("assets").getPublicUrl(path);
      return data.publicUrl;
    },

    /* ---- realtime: call back on announcement/product/method changes ---- */
    subscribeLive(onChange) {
      if (!this.enabled) return null;
      return this.client
        .channel("nd-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "payment_methods" }, onChange)
        .subscribe();
    },
  };

  ND.db = db;
})(window.ND);
