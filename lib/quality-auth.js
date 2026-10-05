import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

function safeEqualHex(a, b) {
  const aa = Buffer.from(String(a || ""), "hex");
  const bb = Buffer.from(String(b || ""), "hex");
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400 || authDate > now + 60) return null;

  const entries = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b));
  const check = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(check)
    .digest("hex");

  if (!safeEqualHex(hash, expected)) return null;

  try {
    const rawUser = params.get("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function bearerToken(req) {
  const value = String(req.headers?.authorization || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function supabaseUser(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function claimIdentity(accessToken) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/quality-web-auth`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    }
  );

  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.data || null;
}

export async function resolveQualityIdentity(req) {
  const initData =
    req.headers?.["x-telegram-init-data"] ||
    req.query?.initData ||
    req.body?.initData ||
    "";

  const telegramUser = verifyTelegramInitData(
    String(initData),
    process.env.TELEGRAM_BOT_TOKEN
  );

  if (telegramUser?.id) {
    return {
      source: "telegram",
      telegramUserId: Number(telegramUser.id),
      user: telegramUser,
      authUserId: null,
      email: null
    };
  }

  const accessToken = bearerToken(req);
  if (!accessToken) return null;

  const authUser = await supabaseUser(accessToken);
  if (!authUser?.id) return null;

  const identity = await claimIdentity(accessToken);

  if (!identity?.telegram_user_id) {
    return {
      source: "web_unlinked",
      telegramUserId: null,
      user: null,
      authUserId: authUser.id,
      email: authUser.email || null
    };
  }

  const telegramUserId = Number(identity.telegram_user_id);
  return {
    source: "web",
    telegramUserId,
    user: { id: telegramUserId },
    authUserId: authUser.id,
    email: authUser.email || identity.email || null
  };
}

export function publicSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY
  };
}
