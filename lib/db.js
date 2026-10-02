const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isDatabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function assertConfigured() {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured");
  }
}

async function dbRequest(path, options = {}) {
  assertConfigured();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.hint || text || `HTTP ${response.status}`;
    throw new Error(`Database request failed: ${message}`);
  }

  return data;
}

export async function upsertTelegramUser(user) {
  if (!user?.id) return null;

  const payload = {
    telegram_user_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    language_code: user.language_code || null,
    updated_at: new Date().toISOString()
  };

  const rows = await dbRequest(
    "telegram_users?on_conflict=telegram_user_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(payload)
    }
  );

  return rows?.[0] || null;
}

export async function getCreatorByTelegramUserId(telegramUserId) {
  const params = new URLSearchParams({
    telegram_user_id: `eq.${telegramUserId}`,
    select: "*",
    limit: "1"
  });

  const rows = await dbRequest(`creators?${params.toString()}`);
  return rows?.[0] || null;
}

export async function ensureCreator(user) {
  await upsertTelegramUser(user);

  const existing = await getCreatorByTelegramUserId(user.id);
  if (existing) return existing;

  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    `Creator ${user.id}`;

  const rows = await dbRequest("creators", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      telegram_user_id: user.id,
      display_name: displayName,
      status: "active"
    })
  });

  return rows?.[0] || null;
}

export async function listPlans(creatorId) {
  const params = new URLSearchParams({
    creator_id: `eq.${creatorId}`,
    select: "id,name,price_stars,duration_days,active,created_at",
    order: "created_at.asc"
  });

  return dbRequest(`plans?${params.toString()}`);
}

export async function createPlan(creatorId, plan) {
  const rows = await dbRequest("plans", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      creator_id: creatorId,
      name: plan.name,
      price_stars: plan.priceStars,
      duration_days: plan.durationDays,
      active: true
    })
  });

  return rows?.[0] || null;
}

export async function getSession(telegramUserId) {
  const params = new URLSearchParams({
    telegram_user_id: `eq.${telegramUserId}`,
    select: "*",
    limit: "1"
  });

  const rows = await dbRequest(`bot_sessions?${params.toString()}`);
  return rows?.[0] || null;
}

export async function setSession(telegramUserId, state, data = {}) {
  const rows = await dbRequest(
    "bot_sessions?on_conflict=telegram_user_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        telegram_user_id: telegramUserId,
        state,
        data,
        updated_at: new Date().toISOString()
      })
    }
  );

  return rows?.[0] || null;
}

export async function clearSession(telegramUserId) {
  const params = new URLSearchParams({
    telegram_user_id: `eq.${telegramUserId}`
  });

  await dbRequest(`bot_sessions?${params.toString()}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
}
