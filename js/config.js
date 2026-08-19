/* ============================================================================
   config.js — constants + small pure helpers, hung off a single ND namespace
   so classic <script> tags can share state without a build step or modules.
   ==========================================================================*/
window.ND = window.ND || {};

ND.config = {
  API: "https://api.github.com",
  API_VERSION: "2022-11-28",
  COMMIT_MESSAGE: "Deploy via Noisy Deploy",
  POLL_MAX: 40,          // ~2 min of polling for the first Pages build
  POLL_INTERVAL: 3000,   // ms between poll attempts
  MAX_FILE_BYTES: 40 * 1024 * 1024, // guard against absurd single-file uploads
  STORAGE: { token: "nd.token", user: "nd.user", history: "nd.history", lang: "nd.lang" },

  // --- Supabase (accounts, quota, premium, admin) --------------------------
  // Paste your project's values here after running supabase/SETUP.md. Both are
  // safe to expose publicly: the anon key is protected by Row-Level Security,
  // and quota enforcement happens in Edge Functions. Leave blank to run the app
  // in "no account" mode (unlimited local deploys, no premium/admin — good for
  // opening index.html directly from disk).
  SUPABASE_URL: "https://fwtheocwchrnunxewiml.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dGhlb2N3Y2hybnVueGV3aW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMTI3MjMsImV4cCI6MjEwMjY4ODcyM30.bOtRT7V4ZtFCM089a6pjyVfJ0uss-4HzaqaEtTodaVY",

  FREE_LIMIT: 3, // fallback shown in UI; the server's settings.free_limit wins

  // Safe defaults for the payment + contact info (the live values come from the
  // Supabase `settings` row, editable in the admin dashboard).
  PAY: {
    bankName: "SeaBank",
    bankAccount: "901561211717",
    bankHolder: "Cokorda Bagus Yudhistira P.",
    telegramDev: "noisy05",
    telegramSupport: "bloodskil2",
  },
  // Fallback pricing if Supabase is unreachable (IDR).
  PRICE: { original: 50000, discounted: 30000, period: "month" },
};

ND.util = {
  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },

  /* GitHub repo names: letters, digits, dot, hyphen, underscore. Mirror the
     original bot's "lowercase + spaces to dashes" behaviour, then harden it. */
  slugify(input) {
    return String(input || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 100);
  },

  formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  },

  /* Rupiah, no decimals: 30000 -> "Rp30.000" (Indonesian grouping). */
  formatIDR(n) {
    const s = String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return "Rp" + s;
  },

  escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  },

  qs(sel, root) { return (root || document).querySelector(sel); },
  qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },

  /* Read a File as base64 (no data-URL prefix). readAsDataURL handles binary
     content correctly, which matters for images and fonts. */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read " + (file.name || "file")));
      reader.onload = () => {
        const res = String(reader.result);
        resolve(res.slice(res.indexOf(",") + 1));
      };
      reader.readAsDataURL(file);
    });
  },

  store(key, value) {
    try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); }
    catch (_) { /* private mode / quota — non-fatal */ }
  },
  load(key, asJson) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      return asJson ? JSON.parse(raw) : raw;
    } catch (_) { return null; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch (_) {} },
};
