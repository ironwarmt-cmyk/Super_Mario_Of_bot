import crypto from "node:crypto";
import {
  getUserProfile,
  getQualityMembership,
  getQualityWallet,
  getQualityAssistantStatus
} from "../lib/db.js";

function safeEqualHex(a, b) {
  const aa = Buffer.from(String(a || ""), "hex");
  const bb = Buffer.from(String(b || ""), "hex");
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400 || authDate > now + 60) return null;

  const entries = [];
  for (const [key, value] of params.entries()) {
    if (key !== "hash") entries.push([key, value]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = entries
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!safeEqualHex(hash, expected)) return null;

  try {
    const rawUser = params.get("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const initData =
    req.headers["x-telegram-init-data"] ||
    req.body?.initData ||
    "";

  const user = verifyTelegramInitData(String(initData), botToken);
  if (!user?.id) {
    return res.status(401).json({
      ok: false,
      error: "Open Quality Hub from the Telegram bot."
    });
  }

  try {
    const [profile, membership, wallet, assistant] = await Promise.all([
      getUserProfile(user.id),
      getQualityMembership(user.id),
      getQualityWallet(user.id),
      getQualityAssistantStatus(user.id)
    ]);

    const plan = membership?.quality_plans || null;
    const docsLeft = membership && plan
      ? Math.max(
          0,
          Number(plan.included_custom_docs || 0) -
            Number(membership.custom_docs_used || 0)
        )
      : 0;

    return res.status(200).json({
      ok: true,
      profile,
      membership: membership
        ? {
            status: membership.status,
            period_end: membership.period_end,
            plan,
            docs_left: docsLeft
          }
        : null,
      wallet: {
        token_balance: Number(wallet?.token_balance || 0)
      },
      assistant: {
        status: assistant?.session?.status || "stopped",
        specialist: assistant?.session?.specialist || null,
        used_seconds: Number(assistant?.used_seconds || 0),
        remaining_seconds: Number(assistant?.remaining_seconds || 0),
        included_seconds: Number(assistant?.included_seconds || 0)
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Dashboard error"
    });
  }
}
