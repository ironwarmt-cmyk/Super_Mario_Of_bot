// QASUPPORT społeczność – most do bazy dla @MT_Social_Control_bot.
// Autoryzacja: nagłówek x-community-secret = sha256(tokenu bota), hash w platform_config.community_bot_auth.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPECTED_BOT = "MT_Social_Control_bot";
const TIERS = ["regular", "basic", "pro", "vip"];
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function expectedHash() {
  const { data } = await db.from("platform_config").select("value").eq("key", "community_bot_auth").maybeSingle();
  return data?.value?.secret_hash || null;
}
const now = () => new Date().toISOString();
const safeId = (v: unknown) => { const n = Number(v); return Number.isSafeInteger(n) && n !== 0 ? n : null; };

// Pakiet z członkostwa QA (to samo źródło co aplikacja). Brak aktywnego planu = REGULAR (free).
async function tierOf(webUserId: number) {
  const { data, error } = await db.from("quality_memberships")
    .select("status,period_end,quality_plans(slug,name_pl)").eq("telegram_user_id", webUserId).maybeSingle();
  if (error) throw error;
  const active = data && ["active", "trial"].includes(String(data.status)) && (!data.period_end || new Date(data.period_end).getTime() > Date.now());
  const slug = active ? String((data as any).quality_plans?.slug || "").toLowerCase() : "";
  return { tier: TIERS.includes(slug) ? slug : "regular", period_end: active ? data!.period_end : null };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = String(body?.action || "");

  try {
    // Jednorazowa konfiguracja: zapisuje hash tokenu po sprawdzeniu, że token należy do właściwego bota.
    if (action === "bootstrap") {
      const token = String(body?.bot_token || "");
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const tg = await r.json().catch(() => ({}));
      if (!tg?.ok) return json({ ok: false, error: "Telegram token validation failed" }, 401);
      if (tg.result?.username !== EXPECTED_BOT) return json({ ok: false, error: "Token belongs to a different bot" }, 403);
      const hash = await sha256Hex(token);
      const current = await expectedHash();
      if (current && current !== hash && body?.rotate !== true) return json({ ok: false, error: "Already configured" }, 409);
      await db.from("platform_config").upsert({ key: "community_bot_auth", value: { secret_hash: hash, bot: EXPECTED_BOT }, updated_at: now() });
      return json({ ok: true, data: { bot: EXPECTED_BOT } });
    }

    const supplied = req.headers.get("x-community-secret") || "";
    const expected = await expectedHash();
    if (!supplied || !expected || supplied !== expected) return json({ ok: false, error: "Unauthorized" }, 401);

    if (action === "create_link_token") {
      const web = safeId(body.web_user_id); if (!web) return json({ ok: false, error: "Invalid user" }, 400);
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      const { error } = await db.from("quality_community_link_tokens").insert({ token, web_user_id: web });
      if (error) throw error;
      const t = await tierOf(web);
      const { data: member } = await db.from("quality_community_members").select("telegram_user_id,nickname,tier,joined_chats").eq("web_user_id", web).maybeSingle();
      return json({ ok: true, data: { token, ...t, member: member || null } });
    }

    if (action === "member_status") {
      const web = safeId(body.web_user_id); if (!web) return json({ ok: false, error: "Invalid user" }, 400);
      const t = await tierOf(web);
      const { data: member } = await db.from("quality_community_members").select("nickname,tier,joined_chats").eq("web_user_id", web).maybeSingle();
      return json({ ok: true, data: { ...t, member: member || null } });
    }

    if (action === "consume_link_token") {
      const tg = safeId(body.telegram_user_id); const token = String(body.token || "");
      if (!tg || !/^[a-f0-9]{24}$/.test(token)) return json({ ok: false, error: "Invalid token" }, 400);
      const { data: row } = await db.from("quality_community_link_tokens").select("*").eq("token", token).maybeSingle();
      if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: "Token expired" }, 410);
      await db.from("quality_community_link_tokens").update({ consumed_at: now(), consumed_by: tg }).eq("token", token);
      // Jedno konto Telegram = jedno konto QASUPPORT.
      await db.from("quality_community_members").delete().eq("web_user_id", row.web_user_id).neq("telegram_user_id", tg);
      const t = await tierOf(row.web_user_id);
      const { data: existing } = await db.from("quality_community_members").select("*").eq("telegram_user_id", tg).maybeSingle();
      const patch = { telegram_user_id: tg, web_user_id: row.web_user_id, tier: t.tier, updated_at: now(), last_checked_at: now(),
        state: existing?.nickname ? "ready" : "await_nick" };
      const { data, error } = await db.from("quality_community_members").upsert(patch).select("*").single();
      if (error) throw error;
      return json({ ok: true, data: { member: data, ...t } });
    }

    if (action === "get_member") {
      const tg = safeId(body.telegram_user_id); if (!tg) return json({ ok: false, error: "Invalid user" }, 400);
      const { data } = await db.from("quality_community_members").select("*").eq("telegram_user_id", tg).maybeSingle();
      if (!data) return json({ ok: true, data: null });
      const t = await tierOf(data.web_user_id);
      if (t.tier !== data.tier) await db.from("quality_community_members").update({ tier: t.tier, updated_at: now() }).eq("telegram_user_id", tg);
      return json({ ok: true, data: { ...data, tier: t.tier, period_end: t.period_end } });
    }

    if (action === "set_nickname") {
      const tg = safeId(body.telegram_user_id); const nick = String(body.nickname || "").trim();
      if (!tg || !/^[\p{L}\p{N} ._-]{2,10}$/u.test(nick)) return json({ ok: false, error: "Invalid nickname" }, 400);
      const { data: taken } = await db.from("quality_community_members").select("telegram_user_id").ilike("nickname", nick.replace(/[\\%_]/g, (m) => "\\" + m)).neq("telegram_user_id", tg).maybeSingle();
      if (taken) return json({ ok: false, error: "Nickname taken" }, 409);
      const { data, error } = await db.from("quality_community_members").update({ nickname: nick, state: "ready", updated_at: now() }).eq("telegram_user_id", tg).select("*").single();
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "set_joined") {
      const tg = safeId(body.telegram_user_id); if (!tg) return json({ ok: false, error: "Invalid user" }, 400);
      const chats = Array.isArray(body.joined_chats) ? body.joined_chats.map(Number).filter(Number.isSafeInteger) : [];
      await db.from("quality_community_members").update({ joined_chats: chats, updated_at: now() }).eq("telegram_user_id", tg);
      return json({ ok: true, data: true });
    }

    if (action === "list_groups") {
      const { data, error } = await db.from("quality_community_groups").select("*");
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "set_group") {
      const tier = String(body.tier || ""); const chat = Number(body.telegram_chat_id);
      if (!TIERS.includes(tier) || !Number.isSafeInteger(chat)) return json({ ok: false, error: "Invalid group" }, 400);
      await db.from("quality_community_groups").delete().eq("telegram_chat_id", chat).neq("tier", tier);
      const { data, error } = await db.from("quality_community_groups")
        .upsert({ tier, telegram_chat_id: chat, title: String(body.title || "").slice(0, 120), topics: body.topics || {}, updated_at: now() })
        .select("*").single();
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "list_members_for_sweep") {
      const { data, error } = await db.from("quality_community_members").select("*").order("last_checked_at", { ascending: true, nullsFirst: true }).limit(25);
      if (error) throw error;
      const out = [];
      for (const m of data || []) {
        const t = await tierOf(m.web_user_id);
        await db.from("quality_community_members").update({ tier: t.tier, last_checked_at: now() }).eq("telegram_user_id", m.telegram_user_id);
        out.push({ ...m, previous_tier: m.tier, tier: t.tier });
      }
      return json({ ok: true, data: out });
    }

    if (action === "is_admin") {
      const tg = safeId(body.telegram_user_id);
      const { data } = await db.from("platform_admins").select("*").eq("telegram_user_id", tg).maybeSingle();
      return json({ ok: true, data: Boolean(data) });
    }

    // ---------- zgłoszenia z rynku i wycofania (agent -> strona) ----------
    if (action === "report_create") {
      const text = String(body.source_text || "").trim().slice(0, 6000);
      if (text.length < 8) return json({ ok: false, error: "Too short" }, 400);
      const row = {
        kind: body.kind === "report" ? "report" : "recall", source_text: text,
        source_url: /^https?:\/\//i.test(String(body.source_url || "")) ? String(body.source_url).slice(0, 500) : null,
        photo_file_id: body.photo_file_id ? String(body.photo_file_id).slice(0, 200) : null,
        submitted_by: safeId(body.submitted_by), submitted_name: String(body.submitted_name || "").slice(0, 60),
        submitted_admin: body.submitted_admin === true, chat_id: safeId(body.chat_id), message_id: safeId(body.message_id), status: "processing"
      };
      const { data, error } = await db.from("quality_market_reports").insert(row).select("*").single();
      if (error) { if (String(error.code) === "23505") return json({ ok: false, error: "Duplicate" }, 409); throw error; }
      return json({ ok: true, data });
    }
    if (action === "report_get") {
      const { data } = await db.from("quality_market_reports").select("*").eq("id", String(body.id || "")).maybeSingle();
      return json({ ok: true, data: data || null });
    }
    if (action === "report_set") {
      const allowed = ["processing", "pending_review", "published", "rejected", "error"];
      const patch: any = { updated_at: now() };
      if (allowed.includes(body.status)) patch.status = body.status;
      if (body.data && typeof body.data === "object") patch.data = body.data;
      if (body.error !== undefined) patch.error = body.error ? String(body.error).slice(0, 500) : null;
      if (body.reviewed_by) patch.reviewed_by = safeId(body.reviewed_by);
      if (patch.status === "published") patch.published_at = now();
      let q = db.from("quality_market_reports").update(patch).eq("id", String(body.id || ""));
      if (Array.isArray(body.only_if_status)) q = q.in("status", body.only_if_status);
      const { data, error } = await q.select("*").maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }
    if (action === "reports_published") {
      const limit = Math.min(30, Math.max(1, Number(body.limit) || 12));
      const { data, error } = await db.from("quality_market_reports").select("id,kind,data,published_at")
        .eq("status", "published").order("published_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }
    if (action === "list_admins") {
      const { data, error } = await db.from("platform_admins").select("telegram_user_id");
      if (error) throw error;
      return json({ ok: true, data: (data || []).map((r: any) => Number(r.telegram_user_id)).filter(Boolean) });
    }

    // ---------- newsletter Jem Bezpiecznie ----------
    if (action === "newsletter_subscribe") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(email)) return json({ ok: false, error: "Invalid email" }, 400);
      const consent = String(body.consent_text || "").slice(0, 600);
      if (!consent) return json({ ok: false, error: "Consent required" }, 400);
      const { data: existing } = await db.from("jem_newsletter_subscribers").select("id,status").ilike("email", email.replace(/[\\%_]/g, (m) => "\\" + m)).maybeSingle();
      if (existing) {
        await db.from("jem_newsletter_subscribers").update({ status: "subscribed", consent_text: consent, consent_at: now(), updated_at: now(), unsubscribed_at: null }).eq("id", existing.id);
        return json({ ok: true, data: { created: false, resubscribed: existing.status !== "subscribed" } });
      }
      const { error } = await db.from("jem_newsletter_subscribers").insert({ email, consent_text: consent, source: String(body.source || "jembezpiecznie.com").slice(0, 80) });
      if (error) { if (String(error.code) === "23505") return json({ ok: true, data: { created: false } }); throw error; }
      const { count } = await db.from("jem_newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "subscribed");
      return json({ ok: true, data: { created: true, total: count || 0 } });
    }
    if (action === "newsletter_unsubscribe") {
      const t = String(body.token || "");
      if (!/^[a-f0-9]{32}$/.test(t)) return json({ ok: false, error: "Invalid token" }, 400);
      const { data } = await db.from("jem_newsletter_subscribers").update({ status: "unsubscribed", unsubscribed_at: now(), updated_at: now() }).eq("unsubscribe_token", t).select("id").maybeSingle();
      return json({ ok: true, data: { done: Boolean(data) } });
    }

    if (action === "newsletter_active") {
      const { data, error } = await db.from("jem_newsletter_subscribers").select("email,unsubscribe_token").eq("status", "subscribed").order("created_at").limit(2000);
      if (error) throw error;
      return json({ ok: true, data: (data || []).map((r: any) => ({ email: r.email, token: r.unsubscribe_token })) });
    }
    if (action === "newsletter_log") {
      const { data: cur } = await db.from("platform_config").select("value").eq("key", "newsletter_issues").maybeSingle();
      const list = Array.isArray(cur?.value?.issues) ? cur.value.issues : [];
      list.unshift({ at: now(), subject: String(body.subject || "").slice(0, 120), sent: Number(body.sent) || 0, failed: Number(body.failed) || 0, mode: String(body.mode || "") });
      await db.from("platform_config").upsert({ key: "newsletter_issues", value: { issues: list.slice(0, 50) }, updated_at: now() });
      return json({ ok: true, data: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message || "Server error" }, 500);
  }
});
