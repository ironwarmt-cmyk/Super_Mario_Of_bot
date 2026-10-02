import crypto from "node:crypto";

const EDGE_URL =
  process.env.SUPABASE_EDGE_URL ||
  "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/creator-platform-db";

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function botSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isDatabaseConfigured() {
  return Boolean(getToken() && EDGE_URL);
}

async function dbAction(action, payload = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bot-secret": botSecret(token)
    },
    body: JSON.stringify({ action, ...payload })
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Database bridge failed with HTTP ${response.status}`);
  }

  return data.data ?? null;
}

export async function bootstrapDatabase() {
  const token = getToken();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "bootstrap",
      telegram_token: token
    })
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Database bootstrap failed with HTTP ${response.status}`);
  }

  return data;
}

export async function upsertTelegramUser(user) {
  if (!user?.id) return null;
  return dbAction("upsert_user", { user });
}

export async function getCreatorByTelegramUserId(telegramUserId) {
  return dbAction("get_creator", {
    telegram_user_id: telegramUserId
  });
}

export async function ensureCreator(user) {
  if (!user?.id) return null;
  return dbAction("ensure_creator", { user });
}

export async function listPlans(creatorId) {
  return (await dbAction("list_plans", { creator_id: creatorId })) || [];
}

export async function listPublicPlans(creatorId) {
  return (await dbAction("list_public_plans", { creator_id: creatorId })) || [];
}

export async function getPlan(planId) {
  return dbAction("get_plan", { plan_id: planId });
}

export async function createPlan(creatorId, plan) {
  return dbAction("create_plan", {
    creator_id: creatorId,
    plan
  });
}

export async function recordSuccessfulPayment(user, payment) {
  return dbAction("record_successful_payment", {
    user,
    payment
  });
}

export async function getUserSubscriptions(telegramUserId) {
  return (
    (await dbAction("get_user_subscriptions", {
      telegram_user_id: telegramUserId
    })) || []
  );
}

export async function getSubscription(subscriptionId, telegramUserId) {
  return dbAction("get_subscription", {
    subscription_id: subscriptionId,
    telegram_user_id: telegramUserId
  });
}

export async function setSubscriptionAutoRenew(
  subscriptionId,
  telegramUserId,
  autoRenew
) {
  return dbAction("set_subscription_auto_renew", {
    subscription_id: subscriptionId,
    telegram_user_id: telegramUserId,
    auto_renew: autoRenew
  });
}

export async function getSession(telegramUserId) {
  return dbAction("get_session", {
    telegram_user_id: telegramUserId
  });
}

export async function setSession(telegramUserId, state, data = {}) {
  return dbAction("set_session", {
    telegram_user_id: telegramUserId,
    state,
    data
  });
}

export async function clearSession(telegramUserId) {
  await dbAction("clear_session", {
    telegram_user_id: telegramUserId
  });
}
