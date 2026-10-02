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

export async function listCommunities(creatorId) {
  return (await dbAction("list_communities", { creator_id: creatorId })) || [];
}

export async function createCommunity(creatorId, community) {
  return dbAction("create_community", {
    creator_id: creatorId,
    community
  });
}

export async function getPlanCommunities(planId) {
  return (await dbAction("get_plan_communities", { plan_id: planId })) || [];
}

export async function setPlanCommunity(planId, communityId, enabled) {
  return dbAction("set_plan_community", {
    plan_id: planId,
    community_id: communityId,
    enabled
  });
}

export async function expireDueSubscriptions() {
  return (await dbAction("expire_due_subscriptions")) || [];
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

export async function listCreatorCustomers(creatorId) {
  return (await dbAction("list_creator_customers", { creator_id: creatorId })) || [];
}

export async function getCreatorStats(creatorId) {
  return (
    (await dbAction("get_creator_stats", { creator_id: creatorId })) || {
      gross_stars: 0,
      gross_stars_30d: 0,
      payment_count: 0,
      payment_count_30d: 0,
      unique_buyers: 0,
      active_subscriptions: 0
    }
  );
}

export async function getUserProfile(telegramUserId) {
  return dbAction("get_user_profile", {
    telegram_user_id: telegramUserId
  });
}

export async function setUserLocale(telegramUserId, locale) {
  return dbAction("set_user_locale", {
    telegram_user_id: telegramUserId,
    locale
  });
}

export async function listQualityPlans() {
  return (await dbAction("list_quality_plans")) || [];
}

export async function getQualityPlan(slug) {
  return dbAction("get_quality_plan", { slug });
}

export async function listQualityProducts(maxTierRank = 3) {
  return (
    (await dbAction("list_quality_products", {
      max_tier_rank: maxTierRank
    })) || []
  );
}

export async function getQualityProduct(slug) {
  return dbAction("get_quality_product", { slug });
}

export async function listQualityTokenPacks() {
  return (await dbAction("list_quality_token_packs")) || [];
}

export async function getQualityTokenPack(packId) {
  return dbAction("get_quality_token_pack", { pack_id: packId });
}

export async function getQualityWallet(telegramUserId) {
  return dbAction("get_quality_wallet", {
    telegram_user_id: telegramUserId
  });
}

export async function creditQualityTokenPack(user, packId, payment) {
  return dbAction("credit_quality_token_pack", {
    user,
    pack_id: packId,
    payment
  });
}

export async function listQualityPhysicalProducts() {
  return (await dbAction("list_quality_physical_products")) || [];
}

export async function getQualityPhysicalProduct(slug) {
  return dbAction("get_quality_physical_product", { slug });
}

export async function createQualityPhysicalOrder({
  telegramUserId,
  product,
  stripeCheckoutSessionId
}) {
  return dbAction("create_quality_physical_order", {
    telegram_user_id: telegramUserId,
    product,
    stripe_checkout_session_id: stripeCheckoutSessionId
  });
}

export async function markQualityPhysicalOrderPaid(data) {
  return dbAction("mark_quality_physical_order_paid", data);
}

export async function getQualityMembership(telegramUserId) {
  return dbAction("get_quality_membership", {
    telegram_user_id: telegramUserId
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
