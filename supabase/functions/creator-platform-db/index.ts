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
      return json({ ok: true, data });
    }

    if (action === "ensure_creator") {
      const user = body?.user;
      if (!user?.id) return json({ ok: false, error: "user.id is required" }, 400);

      const { error: userError } = await supabase
        .from("telegram_users")
        .upsert(
          {
            telegram_user_id: user.id,
            username: user.username || null,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            language_code: user.language_code || null,
            updated_at: new Date().toISOString()
          },
          { onConflict: "telegram_user_id" }
        );

      if (userError) throw userError;

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
        .select("id,name,price_stars,duration_days,active,created_at")
        .eq("creator_id", body?.creator_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "create_plan") {
      const plan = body?.plan || {};
      const { data, error } = await supabase
        .from("plans")
        .insert({
          creator_id: body?.creator_id,
          name: plan.name,
          price_stars: plan.priceStars,
          duration_days: plan.durationDays,
          active: true
        })
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, data });
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
