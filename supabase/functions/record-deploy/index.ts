// ============================================================================
// record-deploy — Edge Function (Deno). Called by the browser AFTER a deploy
// succeeds. Increments the deploy counters for BOTH the GitHub username and the
// caller IP, and appends an audit row. Idempotency is best-effort; a determined
// client could skip this call, which is an accepted limitation (see plan).
//
// Never increments for developer/premium users (their usage is unlimited, so we
// only log the deployment for history).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function callerIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("IP_SALT") || "noisy-deploy";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { github_login, repo, url } = await req.json().catch(() => ({}));
    if (!github_login) return json({ error: "missing github_login" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ipHash = await hashIp(callerIp(req));

    // Ensure a profile row exists, then read its plan.
    const { data: profile } = await supabase
      .from("profiles").select("plan, premium_until, deploy_count")
      .eq("github_login", github_login).maybeSingle();

    const now = Date.now();
    const plan = profile?.plan ?? "free";
    const unlimited =
      plan === "developer" ||
      (plan === "premium" && profile?.premium_until && new Date(profile.premium_until).getTime() > now);

    // Always log the deployment for history.
    await supabase.from("deployments").insert({ github_login, ip_hash: ipHash, repo, url });

    if (!unlimited) {
      // Increment username counter (upsert).
      const nextUser = (profile?.deploy_count ?? 0) + 1;
      await supabase.from("profiles").upsert(
        { github_login, deploy_count: nextUser, updated_at: new Date().toISOString() },
        { onConflict: "github_login" },
      );
      // Increment IP counter (read-modify-write; low contention for this scale).
      const { data: ipRow } = await supabase
        .from("ip_usage").select("deploy_count").eq("ip_hash", ipHash).maybeSingle();
      await supabase.from("ip_usage").upsert(
        { ip_hash: ipHash, deploy_count: (ipRow?.deploy_count ?? 0) + 1, last_at: new Date().toISOString() },
        { onConflict: "ip_hash" },
      );
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
