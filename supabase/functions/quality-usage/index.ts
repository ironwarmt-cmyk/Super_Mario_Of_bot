import { createClient } from "npm:@supabase/supabase-js@2.117.2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (secretKeysRaw) { try { key = JSON.parse(secretKeysRaw).default || key; } catch { /* ignore */ } }
  if (!url || !key) throw new Error("Supabase admin credentials unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const supabase = adminClient();
    const supplied = req.headers.get("x-bot-secret") || "";
    const { data: cfg, error: cfgErr } = await supabase.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
    if (cfgErr) throw cfgErr;
    const expected = cfg?.value?.secret_hash || null;
    if (!supplied || !expected || supplied !== expected) return json({ ok: false, error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "count_quality_assistant_user_messages") return json({ ok: false, error: "Unknown action" }, 400);
    const telegramUserId = Number(body?.telegram_user_id);
    const since = String(body?.since || "");
    if (!Number.isFinite(telegramUserId) || !since || Number.isNaN(Date.parse(since))) return json({ ok: false, error: "Invalid count request" }, 400);
    const { count, error } = await supabase
      .from("quality_assistant_messages")
      .select("id", { count: "exact", head: true })
      .eq("telegram_user_id", telegramUserId)
      .eq("role", "user")
      .gte("created_at", since);
    if (error) throw error;
    return json({ ok: true, data: { count: count || 0 } });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
