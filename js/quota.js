/* ============================================================================
   quota.js — client side of deploy limits.

   ND.quota.check(login)  -> { allowed, unlimited, remaining, plan, disabled }
   ND.quota.record(login, repo, url) -> best-effort; increments server counters.

   When Supabase is not configured (ND.db.enabled === false), quota is DISABLED:
   check() returns { allowed:true, disabled:true } so the app still deploys. This
   is the Phase 1 fallback for offline / file:// use.
   ==========================================================================*/
(function (ND) {
  "use strict";
  const cfg = ND.config;

  function fnUrl(name) {
    // Edge Functions live at <project>.functions.supabase.co/<name>, but the
    // stable form is <SUPABASE_URL>/functions/v1/<name>.
    return cfg.SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/" + name;
  }

  async function callFn(name, body) {
    const res = await fetch(fnUrl(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Functions are invoked with the anon key as a bearer (Supabase gateway
        // requires it); the function itself uses the service role internally.
        "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY,
        "apikey": cfg.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("quota service error " + res.status));
    return data;
  }

  const quota = {
    async check(login) {
      await ND.db.init();
      if (!ND.db.enabled) return { allowed: true, disabled: true, unlimited: true, remaining: null };
      try {
        const r = await callFn("check-quota", { github_login: login });
        return {
          allowed: !!r.allowed,
          unlimited: !!r.unlimited,
          remaining: r.remaining,
          plan: r.plan || "free",
          limit: r.limit,
          disabled: false,
        };
      } catch (e) {
        // Fail OPEN: if the quota service is unreachable we don't want to trap a
        // paying user out of deploying. Surface it, but allow.
        console.warn("quota check failed, allowing:", e && e.message);
        return { allowed: true, disabled: true, error: e && e.message, unlimited: false, remaining: null };
      }
    },

    async record(login, repo, url) {
      if (!ND.db.enabled) return;
      try { await callFn("record-deploy", { github_login: login, repo: repo, url: url }); }
      catch (e) { console.warn("record-deploy failed:", e && e.message); }
    },
  };

  ND.quota = quota;
})(window.ND);
