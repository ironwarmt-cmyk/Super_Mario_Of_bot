import { createClient } from "npm:@supabase/supabase-js@2";

const EXPECTED_BOT_USERNAME = "Super_Mario_Official_bot";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let key = legacy || "";
  if (secretKeysRaw) {
    try { key = JSON.parse(secretKeysRaw).default || key; } catch {}
  }
  if (!url || !key) throw new Error("Supabase admin credentials unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readAuthHash(supabase: any) {
  const { data, error } = await supabase.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
  if (error) throw error;
  return data?.value?.secret_hash || null;
}

async function requireAuth(req: Request, supabase: any) {
  const supplied = req.headers.get("x-bot-secret") || "";
  if (!supplied) return false;
  const expected = await readAuthHash(supabase);
  return Boolean(expected && supplied === expected);
}

async function bootstrap(body: any, supabase: any) {
  const token = String(body?.telegram_token || "");
  if (!token) return json({ ok: false, error: "telegram_token is required" }, 400);
  const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const tg = await r.json();
  if (!r.ok || !tg?.ok) return json({ ok: false, error: "Telegram token validation failed" }, 401);
  if (tg?.result?.username !== EXPECTED_BOT_USERNAME) return json({ ok: false, error: "Token belongs to a different Telegram bot" }, 403);
  const secretHash = await sha256Hex(token);
  const existing = await readAuthHash(supabase);
  if (existing && existing !== secretHash) return json({ ok: false, error: "Bot database authentication is already initialized with another token" }, 409);
  const { error } = await supabase.from("platform_config").upsert({ key: "bot_auth", value: { secret_hash: secretHash, bot_username: EXPECTED_BOT_USERNAME }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  return json({ ok: true, initialized: true, bot_username: EXPECTED_BOT_USERNAME });
}

async function upsertTelegramUser(supabase: any, user: any) {
  const payload = { telegram_user_id: user.id, username: user.username || null, first_name: user.first_name || null, last_name: user.last_name || null, language_code: user.language_code || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("telegram_users").upsert(payload, { onConflict: "telegram_user_id" }).select().single();
  if (error) throw error;
  return data;
}

const QUALITY_SPECIALISTS = new Set(["brc","ifs","haccp","complaints","capa","audit","documents","suppliers","traceability","labelling","change","management","legal","other"]);

function membershipIsActive(membership: any) {
  if (!membership || membership.status !== "active") return false;
  if (!membership.period_end) return true;
  return new Date(membership.period_end).getTime() > Date.now();
}

async function readQualityMembership(supabase: any, telegramUserId: number) {
  const { data, error } = await supabase.from("quality_memberships").select("*,quality_plans(*)").eq("telegram_user_id", telegramUserId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getQualityProductBySlug(supabase: any, slug: string) {
  const { data, error } = await supabase.from("quality_products").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function readQualityProductAccess(supabase: any, telegramUserId: number, slug: string) {
  const product = await getQualityProductBySlug(supabase, slug);
  if (!product) return { product: null, membership: null, purchased: false, unlocked: false, source: null };
  const [membership, purchase] = await Promise.all([
    readQualityMembership(supabase, telegramUserId),
    supabase.from("quality_product_purchases").select("id,created_at").eq("telegram_user_id", telegramUserId).eq("product_id", product.id).maybeSingle()
  ]);
  if (purchase.error) throw purchase.error;
  const tierRank = Number(membership?.quality_plans?.tier_rank || 0);
  const planUnlocked = membershipIsActive(membership) && tierRank >= Number(product.minimum_tier_rank || 1);
  const purchased = Boolean(purchase.data);
  return { product, membership, purchased, unlocked: planUnlocked || purchased, source: purchased ? "purchase" : planUnlocked ? "plan" : null };
}

async function settleQualityAssistantTime(supabase: any, telegramUserId: number) {
  const membership = await readQualityMembership(supabase, telegramUserId);
  const includedSeconds = Number(membership?.quality_plans?.included_chat_minutes || 0) * 60;
  const { data: session, error: sessionError } = await supabase.from("quality_assistant_sessions").select("*").eq("telegram_user_id", telegramUserId).maybeSingle();
  if (sessionError) throw sessionError;
  let usedSeconds = Number(membership?.assistant_seconds_used || 0);
  let currentSession = session || null;
  if (membershipIsActive(membership) && currentSession?.status === "active" && currentSession.last_heartbeat_at && includedSeconds > usedSeconds) {
    const now = Date.now();
    const last = new Date(currentSession.last_heartbeat_at).getTime();
    const delta = Math.min(Math.max(0, Math.floor((now - last) / 1000)), 60, includedSeconds - usedSeconds);
    if (delta > 0) {
      usedSeconds += delta;
      const { error: membershipError } = await supabase.from("quality_memberships").update({ assistant_seconds_used: usedSeconds, chat_minutes_used: Math.floor(usedSeconds / 60), updated_at: new Date(now).toISOString() }).eq("telegram_user_id", telegramUserId);
      if (membershipError) throw membershipError;
      const remaining = Math.max(0, includedSeconds - usedSeconds);
      const { data: updatedSession, error: updateError } = await supabase.from("quality_assistant_sessions").update({ session_seconds: Number(currentSession.session_seconds || 0) + delta, last_heartbeat_at: new Date(now).toISOString(), status: remaining > 0 ? "active" : "stopped", updated_at: new Date(now).toISOString() }).eq("telegram_user_id", telegramUserId).select().single();
      if (updateError) throw updateError;
      currentSession = updatedSession;
    }
  }
  return { membership, session: currentSession, included_seconds: includedSeconds, used_seconds: usedSeconds, remaining_seconds: Math.max(0, includedSeconds - usedSeconds) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const supabase = adminClient();
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "bootstrap") return await bootstrap(body, supabase);
    if (!(await requireAuth(req, supabase))) return json({ ok: false, error: "Unauthorized" }, 401);

    if (action === "upsert_user") return json({ ok: true, data: await upsertTelegramUser(supabase, body?.user) });

    if (action === "get_user_profile") {
      const uid = body?.telegram_user_id;
      const { data: user, error: userError } = await supabase.from("telegram_users").select("telegram_user_id,username,first_name,last_name,language_code,locale").eq("telegram_user_id", uid).maybeSingle();
      if (userError) throw userError;
      const { data: admin, error: adminError } = await supabase.from("platform_admins").select("telegram_user_id").eq("telegram_user_id", uid).maybeSingle();
      if (adminError) throw adminError;
      return json({ ok: true, data: { ...(user || { telegram_user_id: uid, locale: null }), is_admin: Boolean(admin) } });
    }

    if (action === "set_user_locale") {
      const { data, error } = await supabase.from("telegram_users").update({ locale: body?.locale === "en" ? "en" : "pl", updated_at: new Date().toISOString() }).eq("telegram_user_id", body?.telegram_user_id).select("telegram_user_id,locale").maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "list_quality_plans") {
      const { data, error } = await supabase.from("quality_plans").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_quality_plan") {
      const q = supabase.from("quality_plans").select("*").eq("active", true);
      const { data, error } = body?.slug ? await q.eq("slug", body.slug).maybeSingle() : await q.eq("id", body?.plan_id).maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "list_quality_products") {
      let maxTier = Number(body?.max_tier_rank || 3); if (!Number.isFinite(maxTier)) maxTier = 3;
      const { data, error } = await supabase.from("quality_products").select("*").eq("active", true).lte("minimum_tier_rank", maxTier).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_quality_product") return json({ ok: true, data: await getQualityProductBySlug(supabase, String(body?.slug || "")) });

    if (action === "get_quality_product_access") return json({ ok: true, data: await readQualityProductAccess(supabase, Number(body?.telegram_user_id), String(body?.slug || "")) });

    if (action === "list_quality_services") {
      const { data, error } = await supabase.from("quality_services").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "list_quality_token_packs") {
      const { data, error } = await supabase.from("quality_token_packs").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_quality_wallet") {
      const uid = body?.telegram_user_id;
      const { data, error } = await supabase.from("quality_wallets").select("telegram_user_id,token_balance,updated_at").eq("telegram_user_id", uid).maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || { telegram_user_id: uid, token_balance: 0 } });
    }

    if (action === "get_quality_token_pack") {
      const { data, error } = await supabase.from("quality_token_packs").select("*").eq("tokens", Number(body?.tokens || 0)).eq("active", true).maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "record_quality_token_payment") {
      const user = body?.user; const payment = body?.payment || {};
      const match = /^qa_token:(\d+)$/.exec(String(payment.invoice_payload || ""));
      if (!user?.id || !payment?.telegram_payment_charge_id || !match) return json({ ok: false, error: "Invalid token payment" }, 400);
      const tokens = Number(match[1]);
      const { data: pack, error: packError } = await supabase.from("quality_token_packs").select("*").eq("tokens", tokens).eq("active", true).maybeSingle();
      if (packError) throw packError;
      if (!pack || payment.currency !== "XTR" || Number(payment.total_amount) !== Number(pack.price_stars)) return json({ ok: false, error: "Token payment amount mismatch" }, 400);
      await upsertTelegramUser(supabase, user);
      const { data: existing, error: existingError } = await supabase.from("quality_token_purchases").select("id").eq("telegram_payment_charge_id", payment.telegram_payment_charge_id).maybeSingle();
      if (existingError) throw existingError;
      if (!existing) {
        const { error: purchaseError } = await supabase.from("quality_token_purchases").insert({ telegram_user_id: user.id, tokens, stars_paid: payment.total_amount, telegram_payment_charge_id: payment.telegram_payment_charge_id });
        if (purchaseError) throw purchaseError;
        const { data: balance, error: creditError } = await supabase.rpc("credit_quality_tokens", { p_user: user.id, p_tokens: tokens });
        if (creditError) throw creditError;
        return json({ ok: true, data: { tokens_added: tokens, token_balance: Number(balance || 0), duplicate: false } });
      }
      const wallet = await supabase.from("quality_wallets").select("token_balance").eq("telegram_user_id", user.id).maybeSingle();
      if (wallet.error) throw wallet.error;
      return json({ ok: true, data: { tokens_added: 0, token_balance: Number(wallet.data?.token_balance || 0), duplicate: true } });
    }

    if (action === "get_quality_membership") return json({ ok: true, data: await readQualityMembership(supabase, body?.telegram_user_id) });

    if (action === "record_quality_plan_payment") {
      const user = body?.user; const payment = body?.payment || {};
      const match = /^qa_plan:([a-z0-9-]+)$/i.exec(String(payment.invoice_payload || ""));
      if (!user?.id || !payment?.telegram_payment_charge_id || !match) return json({ ok: false, error: "Invalid quality plan payment" }, 400);
      const { data: plan, error: planError } = await supabase.from("quality_plans").select("*").eq("slug", match[1]).eq("active", true).maybeSingle();
      if (planError) throw planError;
      if (!plan || !plan.checkout_enabled || payment.currency !== "XTR" || Number(payment.total_amount) !== Number(plan.price_stars)) return json({ ok: false, error: "Quality plan payment amount mismatch" }, 400);
      await upsertTelegramUser(supabase, user);
      const { data: existing, error: existingError } = await supabase.from("quality_plan_payments").select("id").eq("telegram_payment_charge_id", payment.telegram_payment_charge_id).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ ok: true, data: { plan, membership: await readQualityMembership(supabase, user.id), duplicate: true } });
      const periodEnd = payment.subscription_expiration_date ? new Date(Number(payment.subscription_expiration_date) * 1000) : new Date(Date.now() + 30 * 86400000);
      const { error: payError } = await supabase.from("quality_plan_payments").insert({ telegram_user_id: user.id, plan_id: plan.id, stars_paid: payment.total_amount, telegram_payment_charge_id: payment.telegram_payment_charge_id, telegram_subscription_charge_id: payment.telegram_payment_charge_id || null });
      if (payError) throw payError;
      const { data: membership, error: memError } = await supabase.from("quality_memberships").upsert({ telegram_user_id: user.id, plan_id: plan.id, status: "active", period_start: new Date().toISOString(), period_end: periodEnd.toISOString(), custom_docs_used: 0, chat_minutes_used: 0, assistant_seconds_used: 0, selected_training_product_id: null, telegram_subscription_charge_id: payment.telegram_payment_charge_id, auto_renew: true, updated_at: new Date().toISOString() }, { onConflict: "telegram_user_id" }).select("*,quality_plans(*)").single();
      if (memError) throw memError;
      await supabase.from("quality_assistant_sessions").update({ status: "stopped", last_heartbeat_at: null, started_at: null, session_seconds: 0, updated_at: new Date().toISOString() }).eq("telegram_user_id", user.id);
      return json({ ok: true, data: { plan, membership, duplicate: false } });
    }

    if (action === "record_quality_product_payment") {
      const user = body?.user; const payment = body?.payment || {};
      const match = /^qa_product:([a-z0-9-]+)$/i.exec(String(payment.invoice_payload || ""));
      if (!user?.id || !payment?.telegram_payment_charge_id || !match) return json({ ok: false, error: "Invalid quality product payment" }, 400);
      const product = await getQualityProductBySlug(supabase, match[1]);
      if (!product || !product.standalone_purchase_enabled || !product.standalone_price_stars) return json({ ok: false, error: "Product not available" }, 404);
      if (payment.currency !== "XTR" || Number(payment.total_amount) !== Number(product.standalone_price_stars)) return json({ ok: false, error: "Product payment amount mismatch" }, 400);
      await upsertTelegramUser(supabase, user);
      const { data: existing, error: existingError } = await supabase.from("quality_product_purchases").select("*").eq("telegram_payment_charge_id", payment.telegram_payment_charge_id).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ ok: true, data: { product, purchase: existing, duplicate: true } });
      const { data: purchase, error: purchaseError } = await supabase.from("quality_product_purchases").upsert({ telegram_user_id: user.id, product_id: product.id, stars_paid: payment.total_amount, telegram_payment_charge_id: payment.telegram_payment_charge_id }, { onConflict: "telegram_user_id,product_id" }).select().single();
      if (purchaseError) throw purchaseError;
      return json({ ok: true, data: { product, purchase, duplicate: false } });
    }

    if (action === "get_quality_assistant_status") return json({ ok: true, data: await settleQualityAssistantTime(supabase, Number(body?.telegram_user_id)) });

    if (action === "start_quality_assistant_session") {
      const telegramUserId = Number(body?.telegram_user_id); const specialist = String(body?.specialist || "").toLowerCase();
      if (!QUALITY_SPECIALISTS.has(specialist)) return json({ ok: false, error: "Invalid specialist" }, 400);
      const state = await settleQualityAssistantTime(supabase, telegramUserId);
      if (!membershipIsActive(state.membership)) return json({ ok: false, error: "Active membership required" }, 403);
      if (state.included_seconds <= 0) return json({ ok: false, error: "Assistant not included in this plan" }, 403);
      if (state.remaining_seconds <= 0) return json({ ok: false, error: "Assistant allowance exhausted" }, 402);
      const now = new Date().toISOString();
      const { data: session, error } = await supabase.from("quality_assistant_sessions").upsert({ telegram_user_id: telegramUserId, specialist, status: "active", started_at: now, last_heartbeat_at: now, session_seconds: 0, updated_at: now }, { onConflict: "telegram_user_id" }).select().single();
      if (error) throw error;
      return json({ ok: true, data: { ...state, session } });
    }

    if (action === "heartbeat_quality_assistant_session") {
      const state = await settleQualityAssistantTime(supabase, Number(body?.telegram_user_id));
      if (state.session?.status === "active") {
        const { data: session, error } = await supabase.from("quality_assistant_sessions").update({ last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("telegram_user_id", Number(body?.telegram_user_id)).select().single();
        if (error) throw error; state.session = session;
      }
      return json({ ok: true, data: state });
    }

    if (action === "stop_quality_assistant_session") {
      const state = await settleQualityAssistantTime(supabase, Number(body?.telegram_user_id));
      if (state.session) {
        const { data: session, error } = await supabase.from("quality_assistant_sessions").update({ status: "stopped", last_heartbeat_at: null, updated_at: new Date().toISOString() }).eq("telegram_user_id", Number(body?.telegram_user_id)).select().single();
        if (error) throw error; state.session = session;
      }
      return json({ ok: true, data: state });
    }

    if (action === "list_quality_assistant_messages") {
      const { data, error } = await supabase.from("quality_assistant_messages").select("role,content,source_meta,created_at").eq("telegram_user_id", body?.telegram_user_id).eq("specialist", body?.specialist).order("created_at", { ascending: true }).limit(30);
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_quality_customer_profile") {
      const telegramUserId = Number(body?.telegram_user_id);

      const { data, error } = await supabase
        .from("quality_customer_profiles")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "upsert_quality_customer_profile") {
      const user = body?.user;
      const profile = body?.profile || {};

      if (!user?.id) {
        return json({ ok: false, error: "User is required" }, 400);
      }

      const accountType =
        profile.account_type === "company" ? "company" : "individual";

      const clean = (value, max = 180) =>
        String(value || "").trim().slice(0, max);

      const email = clean(profile.email, 254);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, error: "Invalid email address" }, 400);
      }

      const firstName = clean(profile.first_name, 100);
      const lastName = clean(profile.last_name, 100);
      const companyName = clean(profile.company_name, 180);
      const taxId = clean(profile.tax_id, 40);

      if (!firstName || !lastName) {
        return json({ ok: false, error: "First and last name are required" }, 400);
      }

      if (accountType === "company" && !companyName) {
        return json({ ok: false, error: "Company name is required" }, 400);
      }

      await upsertTelegramUser(supabase, user);

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("quality_customer_profiles")
        .upsert(
          {
            telegram_user_id: user.id,
            account_type: accountType,
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: clean(profile.phone, 40) || null,
            job_title: clean(profile.job_title, 140) || null,
            company_name: companyName || null,
            tax_id: taxId || null,
            company_city: clean(profile.company_city, 120) || null,
            company_country_code:
              clean(profile.company_country_code || "PL", 2).toUpperCase(),
            terms_accepted_at: profile.accept_terms ? now : null,
            privacy_accepted_at: profile.accept_privacy ? now : null,
            onboarding_completed_at: now,
            updated_at: now
          },
          { onConflict: "telegram_user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "get_quality_physical_fulfillment") {
      const telegramUserId = Number(body?.telegram_user_id);

      const { data: membership, error: membershipError } = await supabase
        .from("quality_memberships")
        .select("*,quality_plans(*)")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership || membership.status !== "active") {
        return json({ ok: true, data: { membership: null, fulfillment: null } });
      }

      const { data: fulfillment, error } = await supabase
        .from("quality_physical_fulfillments")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .eq("plan_id", membership.plan_id)
        .eq("membership_period_end", membership.period_end)
        .maybeSingle();

      if (error) throw error;

      return json({
        ok: true,
        data: {
          membership,
          fulfillment: fulfillment || null
        }
      });
    }

    if (action === "upsert_quality_physical_fulfillment") {
      const user = body?.user;
      const shipping = body?.shipping || {};

      if (!user?.id) {
        return json({ ok: false, error: "User is required" }, 400);
      }

      const { data: membership, error: membershipError } = await supabase
        .from("quality_memberships")
        .select("*,quality_plans(*)")
        .eq("telegram_user_id", user.id)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (
        !membership ||
        membership.status !== "active" ||
        (membership.period_end &&
          new Date(membership.period_end).getTime() <= Date.now())
      ) {
        return json({ ok: false, error: "Active Quality plan required" }, 403);
      }

      const planSlug = membership.quality_plans?.slug;
      const ebookMap = {
        basic: "ebook-basic-quality-foundations",
        pro: "ebook-pro-food-safety-hazard-analysis",
        vip: "ebook-vip-quality-manager-playbook"
      };
      const ebookSlug = ebookMap[planSlug];

      if (!ebookSlug) {
        return json({ ok: false, error: "E-book not configured for this plan" }, 400);
      }

      const clean = (value, max = 180) =>
        String(value || "").trim().slice(0, max);

      const recipientName = clean(shipping.recipient_name, 180);
      const street1 = clean(shipping.street_line_1, 180);
      const postalCode = clean(shipping.postal_code, 32);
      const city = clean(shipping.city, 120);
      const countryCode = clean(shipping.country_code || "PL", 2).toUpperCase();

      if (!recipientName || !street1 || !postalCode || !city) {
        return json({ ok: false, error: "Incomplete shipping address" }, 400);
      }

      await upsertTelegramUser(supabase, user);

      const { data, error } = await supabase
        .from("quality_physical_fulfillments")
        .upsert(
          {
            telegram_user_id: user.id,
            plan_id: membership.plan_id,
            membership_period_end: membership.period_end,
            ebook_slug: ebookSlug,
            recipient_name: recipientName,
            company_name: clean(shipping.company_name, 180) || null,
            street_line_1: street1,
            street_line_2: clean(shipping.street_line_2, 180) || null,
            postal_code: postalCode,
            city,
            country_code: countryCode,
            phone: clean(shipping.phone, 40) || null,
            status: "new",
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "telegram_user_id,plan_id,membership_period_end"
          }
        )
        .select()
        .single();

      if (error) throw error;

      return json({
        ok: true,
        data: {
          fulfillment: data,
          membership
        }
      });
    }

    if (action === "create_quality_support_ticket") {
      const user = body?.user;
      const ticket = body?.ticket || {};
      const category = String(ticket.category || "other");
      const allowedCategories = new Set(["technical","payment","content","idea","other"]);
      const message = String(ticket.message || "").trim();
      const subject = String(ticket.subject || "").trim().slice(0, 180);
      const contactEmail = String(ticket.contact_email || "").trim().slice(0, 254);

      if (!user?.id) {
        return json({ ok: false, error: "User is required" }, 400);
      }
      if (!allowedCategories.has(category)) {
        return json({ ok: false, error: "Invalid support category" }, 400);
      }
      if (message.length < 5 || message.length > 5000) {
        return json({ ok: false, error: "Support message must contain 5-5000 characters" }, 400);
      }

      await upsertTelegramUser(supabase, user);

      const { data, error } = await supabase
        .from("quality_support_tickets")
        .insert({
          telegram_user_id: user.id,
          category,
          subject: subject || null,
          message,
          contact_email: contactEmail || null,
          status: "new",
          source: "telegram_webapp",
          updated_at: new Date().toISOString()
        })
        .select("id,category,subject,status,created_at")
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "list_quality_support_tickets") {
      const telegramUserId = Number(body?.telegram_user_id);
      const limit = Math.min(20, Math.max(1, Number(body?.limit || 10)));

      const { data, error } = await supabase
        .from("quality_support_tickets")
        .select("id,category,subject,message,status,created_at,updated_at")
        .eq("telegram_user_id", telegramUserId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "save_quality_assistant_message") {
      const { data, error } = await supabase.from("quality_assistant_messages").insert({ telegram_user_id: body?.telegram_user_id, specialist: body?.specialist, role: body?.role, content: body?.content, source_meta: body?.source_meta || {} }).select().single();
      if (error) throw error;
      return json({ ok: true, data });
    }

    const emptyList = new Set(["list_plans","list_public_plans","get_user_subscriptions","list_communities","get_plan_communities","expire_due_subscriptions","list_creator_customers"]);
    if (emptyList.has(action)) return json({ ok: true, data: [] });
    const nullActions = new Set(["get_creator","ensure_creator","get_plan","create_plan","record_successful_payment","create_community","set_plan_community","get_subscription","set_subscription_auto_renew","get_creator_stats","get_session","set_session","clear_session"]);
    if (nullActions.has(action)) return json({ ok: true, data: null });

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("creator_platform_db_error", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Unhandled database error" }, 500);
  }
});
