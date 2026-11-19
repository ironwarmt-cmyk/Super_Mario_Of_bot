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

    if (action === "usage") {
      const userId = String(b.user_id || "");
      const kind = String(b.kind || "");
      const month = String(b.month || "");
      const limit = Number(b.limit || 0);
      if (!UUID.test(userId) || !["receipt", "plan"].includes(kind) || !/^\d{4}-\d{2}$/.test(month)) return json({ ok: false, error: "Invalid usage" }, 400);
      const { data: cur, error: e1 } = await supabase.from("jb_usage").select("count").eq("user_id", userId).eq("kind", kind).eq("month", month).maybeSingle();
      if (e1) throw e1;
      const used = Number(cur?.count || 0);
      if (limit > 0 && used >= limit) return json({ ok: true, data: { allowed: false, used } });
      const { error: e2 } = await supabase.from("jb_usage").upsert({ user_id: userId, kind, month, count: used + 1 }, { onConflict: "user_id,kind,month" });
      if (e2) throw e2;
      return json({ ok: true, data: { allowed: true, used: used + 1 } });
    }

    if (action === "auth_link") {
      // Link potwierdzenia konta / resetu hasła wysyłany przez nas po polsku (bez wysyłki maili przez Supabase).
      const email = String(b.email || "").trim().toLowerCase();
      let kind = String(b.kind || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["signup", "recovery", "magiclink"].includes(kind)) return json({ ok: false, error: "Invalid request" }, 400);
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { data: recent, error: rErr } = await supabase.from("jb_auth_mail").select("sent_at").eq("email", email).gte("sent_at", since).order("sent_at", { ascending: false }).limit(10);
      if (rErr) throw rErr;
      if ((recent || []).length && Date.now() - new Date(recent![0].sent_at).getTime() < 60e3) return json({ ok: true, data: { status: "rate", wait: 60 } });
      if ((recent || []).length >= 6) return json({ ok: true, data: { status: "rate", wait: 3600 } });
      const { data: uid } = await supabase.rpc("jb_user_by_email", { p_email: email });
      let user: { id: string; confirmed: boolean } | null = null;
      if (uid) {
        const { data: u } = await supabase.auth.admin.getUserById(String(uid));
        if (u?.user) user = { id: u.user.id, confirmed: Boolean(u.user.email_confirmed_at) };
      }
      if (kind === "signup" && user) {
        if (user.confirmed) return json({ ok: true, data: { status: "exists" } });
        kind = "magiclink";
      }
      if (kind !== "signup" && !user) return json({ ok: true, data: { status: "none" } });
      if (kind === "magiclink" && user?.confirmed) return json({ ok: true, data: { status: "exists" } });
      const params: Record<string, unknown> = { type: kind, email };
      if (kind === "signup") {
        const password = String(b.password || "");
        if (password.length < 8) return json({ ok: false, error: "Weak password" }, 400);
        params.password = password;
      }
      const { data: link, error: lErr } = await supabase.auth.admin.generateLink(params as any);
      if (lErr) return json({ ok: false, error: lErr.message }, 400);
      await supabase.from("jb_auth_mail").insert({ email, kind });
      return json({ ok: true, data: { status: "ok", kind, hashed_token: link?.properties?.hashed_token || null } });
    }

    if (action === "push_save") {
      const userId = String(b.user_id || "");
      const sub = b.subscription;
      const endpoint = String(sub?.endpoint || "");
      if (!UUID.test(userId) || !/^https:\/\//.test(endpoint)) return json({ ok: false, error: "Invalid subscription" }, 400);
      const { error } = await supabase.from("jb_push_subscriptions").upsert({ endpoint, user_id: userId, subscription: sub, enabled: b.enabled !== false }, { onConflict: "endpoint" });
      if (error) throw error;
      return json({ ok: true, data: { saved: true } });
    }

    if (action === "push_due") {
      // Subskrypcje + pozycje lodówki z terminem w ciągu `days` dni (domyślnie 2), dla porannych przypomnień.
      const days = Math.min(7, Math.max(0, Number(b.days ?? 2)));
      const { data: subs, error } = await supabase.from("jb_push_subscriptions").select("endpoint,user_id,subscription,last_sent_at").eq("enabled", true).limit(5000);
      if (error) throw error;
      const users = [...new Set((subs || []).map((s) => s.user_id))];
      const fridge: Record<string, unknown> = {};
      for (let i = 0; i < users.length; i += 200) {
        const { data: rows, error: e2 } = await supabase.from("jb_user_data").select("user_id,value").eq("key", "fridge").in("user_id", users.slice(i, i + 200));
        if (e2) throw e2;
        for (const r of rows || []) fridge[r.user_id] = r.value;
      }
      const today = new Date(); const limit = new Date(today.getTime() + days * 864e5).toISOString().slice(0, 10);
      const out = (subs || []).map((s) => {
        const items = Array.isArray(fridge[s.user_id]) ? (fridge[s.user_id] as any[]) : [];
        const due = items.filter((x) => x && typeof x.expires === "string" && x.expires <= limit && Number(x.qty ?? 1) > 0).map((x) => ({ name: String(x.name || ""), expires: x.expires }));
        return { endpoint: s.endpoint, user_id: s.user_id, subscription: s.subscription, last_sent_at: s.last_sent_at, due };
      });
      return json({ ok: true, data: out });
    }

    if (action === "push_mark") {
      const endpoints = Array.isArray(b.sent) ? b.sent.map(String) : [];
      const gone = Array.isArray(b.gone) ? b.gone.map(String) : [];
      if (endpoints.length) await supabase.from("jb_push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("endpoint", endpoints);
      if (gone.length) await supabase.from("jb_push_subscriptions").delete().in("endpoint", gone);
      return json({ ok: true, data: { marked: endpoints.length, removed: gone.length } });
    }

    if (action === "delete_jb_data") {
      const userId = String(b.user_id || "");
      if (!UUID.test(userId)) return json({ ok: false, error: "Invalid user" }, 400);
      for (const t of ["jb_user_data", "jb_push_subscriptions", "jb_assistant_usage", "jb_usage"]) {
        const { error } = await supabase.from(t).delete().eq("user_id", userId);
        if (error) throw error;
      }
      return json({ ok: true, data: { deleted: true } });
    }

    if (action === "delete_account") {
      const userId = String(b.user_id || "");
      if (!UUID.test(userId)) return json({ ok: false, error: "Invalid user" }, 400);
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true, data: { deleted: true } });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
