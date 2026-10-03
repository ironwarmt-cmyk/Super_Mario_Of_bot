import crypto from "node:crypto";
import {
  getQualityPhysicalFulfillment,
  upsertQualityPhysicalFulfillment,
  getUserProfile
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
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const initData =
    req.headers["x-telegram-init-data"] ||
    req.query?.initData ||
    req.body?.initData ||
    "";

  const user = verifyTelegramInitData(String(initData), token);
  if (!user?.id) {
    return res.status(401).json({
      ok: false,
      error: "Open shipping from the Telegram bot."
    });
  }

  try {
    if (req.method === "GET") {
      const [profile, data] = await Promise.all([
        getUserProfile(user.id),
        getQualityPhysicalFulfillment(user.id)
      ]);

      return res.status(200).json({
        ok: true,
        locale: profile?.locale || "pl",
        membership: data?.membership || null,
        fulfillment: data?.fulfillment || null
      });
    }

    const shipping = {
      recipient_name: req.body?.recipient_name,
      company_name: req.body?.company_name,
      street_line_1: req.body?.street_line_1,
      street_line_2: req.body?.street_line_2,
      postal_code: req.body?.postal_code,
      city: req.body?.city,
      country_code: req.body?.country_code || "PL",
      phone: req.body?.phone
    };

    const result = await upsertQualityPhysicalFulfillment(user, shipping);

    return res.status(200).json({
      ok: true,
      fulfillment: result?.fulfillment || null,
      membership: result?.membership || null
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shipping request failed";

    const status =
      /active quality plan|required/i.test(message) ? 403 : 500;

    return res.status(status).json({ ok: false, error: message });
  }
}
