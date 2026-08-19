// ============================================================================
// check-quota — Edge Function (Deno). Called by the browser BEFORE a deploy.
//
// Derives the caller IP from request headers (only the server can do this
// reliably), then reports whether this GitHub user is allowed to deploy:
//   - developer / premium (unexpired) -> unlimited
//   - free -> allowed while BOTH the username count AND the IP count are < limit
//
// No user auth required. Uses the service-role key to read/write freely; the
// anon key is never trusted for quota. CORS is open (static site calls it).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function callerIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

async function hashIp(ip: string): Promise<string> {
  // Salted SHA-256 so the stored value can't be reversed to a raw IP.
  const salt = Deno.env.get("IP_SALT") || "noisy-deploy";
  const data = new TextEncoder().encode(salt + "|" + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { github_login } = await req.json().catch(() => ({}));
    if (!github_login) return json({ error: "missing github_login" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // limit is configurable in settings (default 3)
    const { data: settings } = await supabase.from("settings").select("free_limit").eq("id", 1).single();
    const limit = settings?.free_limit ?? 3;

    const { data: profile } = await supabase
      .from("profiles").select("plan, premium_until, deploy_count")
      .eq("github_login", github_login).maybeSingle();

    const now = Date.now();
    const plan = profile?.plan ?? "free";
    const premiumActive =
      plan === "developer" ||
      (plan === "premium" && profile?.premium_until && new Date(profile.premium_until).getTime() > now);

    if (premiumActive) {
      return json({ allowed: true, plan, unlimited: true, remaining: null });
    }

    const userCount = profile?.deploy_count ?? 0;

    const ipHash = await hashIp(callerIp(req));
    const { data: ipRow } = await supabase
      .from("ip_usage").select("deploy_count").eq("ip_hash", ipHash).maybeSingle();
    const ipCount = ipRow?.deploy_count ?? 0;

    const used = Math.max(userCount, ipCount);
    const remaining = Math.max(0, limit - used);
    return json({ allowed: remaining > 0, plan: "free", unlimited: false, remaining, limit });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
