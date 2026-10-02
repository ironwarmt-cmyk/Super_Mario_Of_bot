import { createClient } from "npm:@supabase/supabase-js@2";

const EXPECTED_BOT_USERNAME = "Super_Mario_Official_bot";

function json(data, status = 200) {
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
    try {
      const parsed = JSON.parse(secretKeysRaw);
      key = parsed.default || key;
    } catch {
      // Fall back to legacy key if available.
    }
  }

  if (!url || !key) {
    throw new Error("Supabase admin credentials unavailable");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readAuthHash(supabase) {
  const { data, error } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "bot_auth")
    .maybeSingle();

  if (error) throw error;
  return data?.value?.secret_hash || null;
}

async function requireAuth(req, supabase) {
  const supplied = req.headers.get("x-bot-secret") || "";
  if (!supplied) return false;

  const expected = await readAuthHash(supabase);
  return Boolean(expected && supplied === expected);
}

async function bootstrap(reqBody, supabase) {
  const token = String(reqBody?.telegram_token || "");
  if (!token) return json({ ok: false, error: "telegram_token is required" }, 400);

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${token}/getMe`
  );
  const telegram = await telegramResponse.json();

  if (!telegramResponse.ok || !telegram?.ok) {
    return json({ ok: false, error: "Telegram token validation failed" }, 401);
  }

  if (telegram?.result?.username !== EXPECTED_BOT_USERNAME) {
    return json({ ok: false, error: "Token belongs to a different Telegram bot" }, 403);
  }

  const secretHash = await sha256Hex(token);
  const existing = await readAuthHash(supabase);

  if (existing && existing !== secretHash) {
    return json(
      { ok: false, error: "Bot database authentication is already initialized with another token" },
      409
    );
  }

  const { error } = await supabase.from("platform_config").upsert(
    {
      key: "bot_auth",
      value: {
        secret_hash: secretHash,
        bot_username: EXPECTED_BOT_USERNAME
      },
      updated_at: new Date().toISOString()
    },
    { onConflict: "key" }
  );

  if (error) throw error;

  return json({ ok: true, initialized: true, bot_username: EXPECTED_BOT_USERNAME });
}

async function upsertTelegramUser(supabase, user) {
  const payload = {
    telegram_user_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    language_code: user.language_code || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("telegram_users")
    .upsert(payload, { onConflict: "telegram_user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabase = adminClient();
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "bootstrap") {
      return await bootstrap(body, supabase);
    }

    if (!(await requireAuth(req, supabase))) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (action === "upsert_user") {
      const user = body?.user;
      if (!user?.id) return json({ ok: false, error: "user.id is required" }, 400);
      return json({ ok: true, data: await upsertTelegramUser(supabase, user) });
    }

    if (action === "ensure_creator") {
      const user = body?.user;
      if (!user?.id) return json({ ok: false, error: "user.id is required" }, 400);

      await upsertTelegramUser(supabase, user);

      const { data: existing, error: existingError } = await supabase
        .from("creators")
        .select("*")
        .eq("telegram_user_id", user.id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return json({ ok: true, data: existing });

      const displayName =
        [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
        user.username ||
        `Creator ${user.id}`;

      const { data, error } = await supabase
        .from("creators")
        .insert({
          telegram_user_id: user.id,
          display_name: displayName,
          status: "active"
        })
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "get_creator") {
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .eq("telegram_user_id", body?.telegram_user_id)
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "list_plans") {
      const { data, error } = await supabase
        .from("plans")
        .select("id,name,price_stars,duration_days,billing_mode,active,created_at")
        .eq("creator_id", body?.creator_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "list_public_plans") {
      const { data, error } = await supabase
        .from("plans")
        .select("id,name,price_stars,duration_days,billing_mode,active,created_at")
        .eq("creator_id", body?.creator_id)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_plan") {
      const { data, error } = await supabase
        .from("plans")
        .select("id,creator_id,name,price_stars,duration_days,billing_mode,active,created_at")
        .eq("id", body?.plan_id)
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "create_plan") {
      const plan = body?.plan || {};
      const billingMode = plan.billingMode === "monthly" ? "monthly" : "one_time";
      const durationDays = billingMode === "monthly" ? 30 : plan.durationDays;

      const { data, error } = await supabase
        .from("plans")
        .insert({
          creator_id: body?.creator_id,
          name: plan.name,
          price_stars: plan.priceStars,
          duration_days: durationDays,
          billing_mode: billingMode,
          active: true
        })
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "record_successful_payment") {
      const user = body?.user;
      const payment = body?.payment;

      if (!user?.id || !payment?.invoice_payload || !payment?.telegram_payment_charge_id) {
        return json({ ok: false, error: "Incomplete payment payload" }, 400);
      }

      await upsertTelegramUser(supabase, user);

      const payload = String(payment.invoice_payload);
      const match = /^plan:([0-9a-f-]{36})$/i.exec(payload);
      if (!match) {
        return json({ ok: false, error: "Unsupported invoice payload" }, 400);
      }

      const planId = match[1];

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      if (planError) throw planError;
      if (!plan || !plan.active) {
        return json({ ok: false, error: "Plan not available" }, 404);
      }

      if (payment.currency !== "XTR" || Number(payment.total_amount) !== Number(plan.price_stars)) {
        return json({ ok: false, error: "Payment amount mismatch" }, 400);
      }

      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from("payments")
        .select("*")
        .eq("telegram_payment_charge_id", payment.telegram_payment_charge_id)
        .maybeSingle();

      if (existingPaymentError) throw existingPaymentError;

      if (!existingPayment) {
        const expiration = payment.subscription_expiration_date
          ? new Date(Number(payment.subscription_expiration_date) * 1000).toISOString()
          : null;

        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            telegram_user_id: user.id,
            creator_id: plan.creator_id,
            plan_id: plan.id,
            amount: payment.total_amount,
            currency: payment.currency,
            telegram_payment_charge_id: payment.telegram_payment_charge_id,
            provider_payment_charge_id: payment.provider_payment_charge_id || null,
            is_recurring: Boolean(payment.is_recurring),
            is_first_recurring: Boolean(payment.is_first_recurring),
            subscription_expiration_date: expiration,
            status: "paid"
          });

        if (paymentError) throw paymentError;
      }

      const { data: existingSubscription, error: subscriptionReadError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("telegram_user_id", user.id)
        .eq("plan_id", plan.id)
        .maybeSingle();

      if (subscriptionReadError) throw subscriptionReadError;

      let endsAt;
      if (payment.subscription_expiration_date) {
        endsAt = new Date(Number(payment.subscription_expiration_date) * 1000);
      } else {
        const now = new Date();
        const existingEnd = existingSubscription?.ends_at
          ? new Date(existingSubscription.ends_at)
          : null;
        const base = existingEnd && existingEnd > now ? existingEnd : now;
        endsAt = new Date(base.getTime() + Number(plan.duration_days) * 86400000);
      }

      const subscriptionPayload = {
        telegram_user_id: user.id,
        plan_id: plan.id,
        status: "active",
        ends_at: endsAt.toISOString(),
        is_recurring: Boolean(payment.is_recurring || plan.billing_mode === "monthly"),
        telegram_subscription_charge_id:
          existingSubscription?.telegram_subscription_charge_id ||
          payment.telegram_payment_charge_id,
        auto_renew: Boolean(payment.is_recurring || plan.billing_mode === "monthly")
      };

      const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions")
        .upsert(subscriptionPayload, {
          onConflict: "telegram_user_id,plan_id"
        })
        .select()
        .single();

      if (subscriptionError) throw subscriptionError;

      return json({
        ok: true,
        data: {
          plan,
          subscription,
          duplicate: Boolean(existingPayment)
        }
      });
    }

    if (action === "get_user_subscriptions") {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id,status,starts_at,ends_at,is_recurring,auto_renew,telegram_subscription_charge_id,plans(id,name,price_stars,duration_days,billing_mode)")
        .eq("telegram_user_id", body?.telegram_user_id)
        .order("ends_at", { ascending: false });

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "list_communities") {
      const { data, error } = await supabase
        .from("communities")
        .select("id,telegram_chat_id,title,chat_type,active,created_at")
        .eq("creator_id", body?.creator_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "create_community") {
      const community = body?.community || {};
      if (!body?.creator_id || !community.telegramChatId || !community.title || !community.chatType) {
        return json({ ok: false, error: "Incomplete community data" }, 400);
      }

      const { data, error } = await supabase
        .from("communities")
        .upsert(
          {
            creator_id: body.creator_id,
            telegram_chat_id: community.telegramChatId,
            title: community.title,
            chat_type: community.chatType,
            active: true
          },
          { onConflict: "creator_id,telegram_chat_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "get_plan_communities") {
      const { data, error } = await supabase
        .from("plan_communities")
        .select("community_id,communities(id,telegram_chat_id,title,chat_type,active)")
        .eq("plan_id", body?.plan_id);

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "set_plan_community") {
      const planId = body?.plan_id;
      const communityId = body?.community_id;
      const enabled = Boolean(body?.enabled);

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id,creator_id")
        .eq("id", planId)
        .maybeSingle();

      if (planError) throw planError;

      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("id,creator_id")
        .eq("id", communityId)
        .maybeSingle();

      if (communityError) throw communityError;

      if (!plan || !community || plan.creator_id !== community.creator_id) {
        return json({ ok: false, error: "Plan and community do not belong to the same creator" }, 403);
      }

      if (enabled) {
        const { error } = await supabase
          .from("plan_communities")
          .upsert(
            { plan_id: planId, community_id: communityId },
            { onConflict: "plan_id,community_id" }
          );

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("plan_communities")
          .delete()
          .eq("plan_id", planId)
          .eq("community_id", communityId);

        if (error) throw error;
      }

      return json({ ok: true, data: { enabled } });
    }

    if (action === "expire_due_subscriptions") {
      const now = new Date().toISOString();

      const { data: due, error: dueError } = await supabase
        .from("subscriptions")
        .select("id,telegram_user_id,plan_id,ends_at")
        .eq("status", "active")
        .lt("ends_at", now)
        .limit(500);

      if (dueError) throw dueError;

      if (!due?.length) {
        return json({ ok: true, data: [] });
      }

      const ids = due.map((item) => item.id);

      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .in("id", ids);

      if (updateError) throw updateError;

      const planIds = [...new Set(due.map((item) => item.plan_id))];

      const { data: links, error: linkError } = await supabase
        .from("plan_communities")
        .select("plan_id,communities(id,telegram_chat_id,title,chat_type,active)")
        .in("plan_id", planIds);

      if (linkError) throw linkError;

      const targets = [];

      for (const subscription of due) {
        for (const link of links || []) {
          const community = link.communities;
          if (
            link.plan_id === subscription.plan_id &&
            community?.active &&
            community.telegram_chat_id
          ) {
            targets.push({
              subscription_id: subscription.id,
              telegram_user_id: subscription.telegram_user_id,
              telegram_chat_id: community.telegram_chat_id,
              community_title: community.title
            });
          }
        }
      }

      return json({ ok: true, data: targets });
    }

    if (action === "get_subscription") {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id,telegram_user_id,plan_id,status,starts_at,ends_at,is_recurring,auto_renew,telegram_subscription_charge_id,plans(id,name,price_stars,duration_days,billing_mode)")
        .eq("id", body?.subscription_id)
        .eq("telegram_user_id", body?.telegram_user_id)
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "set_subscription_auto_renew") {
      const { data, error } = await supabase
        .from("subscriptions")
        .update({ auto_renew: Boolean(body?.auto_renew) })
        .eq("id", body?.subscription_id)
        .eq("telegram_user_id", body?.telegram_user_id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "get_session") {
      const { data, error } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("telegram_user_id", body?.telegram_user_id)
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "set_session") {
      const { data, error } = await supabase
        .from("bot_sessions")
        .upsert(
          {
            telegram_user_id: body?.telegram_user_id,
            state: body?.state,
            data: body?.data || {},
            updated_at: new Date().toISOString()
          },
          { onConflict: "telegram_user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "clear_session") {
      const { error } = await supabase
        .from("bot_sessions")
        .delete()
        .eq("telegram_user_id", body?.telegram_user_id);

      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    console.error("creator-platform-db error", error);
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown server error" },
      500
    );
  }
});
