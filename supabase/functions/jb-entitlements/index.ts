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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLANS = new Set(["pro", "premium", "firma"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const supabase = adminClient();
    const supplied = req.headers.get("x-bot-secret") || "";
    const { data: cfg, error: cfgErr } = await supabase.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
    if (cfgErr) throw cfgErr;
    const expected = cfg?.value?.secret_hash || null;
    if (!supplied || !expected || supplied !== expected) return json({ ok: false, error: "Unauthorized" }, 401);
    const b = await req.json().catch(() => ({}));
    const action = String(b?.action || "");

    if (action === "upsert") {
      const userId = String(b.user_id || "");
      const plan = String(b.plan || "");
      if (!UUID.test(userId) || !PLANS.has(plan)) return json({ ok: false, error: "Invalid entitlement" }, 400);
      const row = {
        user_id: userId, plan, status: String(b.status || "active"), source: "stripe",
        stripe_customer_id: b.customer_id || null, stripe_subscription_id: b.subscription_id || null,
        current_period_end: b.period_end || null, cancel_at_period_end: Boolean(b.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("jb_entitlements").upsert(row, { onConflict: "user_id" });
      if (error) throw error;
      return json({ ok: true, data: { saved: true } });
    }

    if (action === "sync_subscription") {
      const sub = String(b.subscription_id || "");
      if (!sub) return json({ ok: false, error: "Missing subscription" }, 400);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.status) patch.status = String(b.status);
      if (b.period_end) patch.current_period_end = b.period_end;
      if (typeof b.cancel_at_period_end === "boolean") patch.cancel_at_period_end = b.cancel_at_period_end;
      if (PLANS.has(String(b.plan || ""))) patch.plan = String(b.plan);
      const { data, error } = await supabase.from("jb_entitlements").update(patch).eq("stripe_subscription_id", sub).select("user_id");
      if (error) throw error;
      return json({ ok: true, data: { updated: data?.length || 0 } });
    }

    if (action === "get") {
      const userId = String(b.user_id || "");
      if (!UUID.test(userId)) return json({ ok: false, error: "Invalid user" }, 400);
      const { data, error } = await supabase.from("jb_entitlements").select("plan,status,current_period_end,cancel_at_period_end,source").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "assistant_usage") {
      const userId = String(b.user_id || "");
      const month = String(b.month || "");
      const limit = Number(b.limit || 0);
      if (!UUID.test(userId) || !/^\d{4}-\d{2}$/.test(month)) return json({ ok: false, error: "Invalid usage" }, 400);
      const { data: cur, error: e1 } = await supabase.from("jb_assistant_usage").select("messages").eq("user_id", userId).eq("month", month).maybeSingle();
      if (e1) throw e1;
      const used = Number(cur?.messages || 0);
      if (limit > 0 && used >= limit) return json({ ok: true, data: { allowed: false, used } });
      const { error: e2 } = await supabase.from("jb_assistant_usage").upsert({ user_id: userId, month, messages: used + 1 }, { onConflict: "user_id,month" });
      if (e2) throw e2;
      return json({ ok: true, data: { allowed: true, used: used + 1 } });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
