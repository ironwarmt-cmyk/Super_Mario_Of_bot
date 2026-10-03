import crypto from "node:crypto";
import {
  createQualitySupportTicket,
  listQualitySupportTickets,
  getUserProfile
} from "../lib/db.js";

const SUPPORT_EMAIL = "qasupportmt@gmail.com";

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
      error: "Open Support from the Telegram bot."
    });
  }

  try {
    if (req.method === "GET") {
      const [profile, tickets] = await Promise.all([
        getUserProfile(user.id),
        listQualitySupportTickets(user.id, 8)
      ]);

      return res.status(200).json({
        ok: true,
        supportEmail: SUPPORT_EMAIL,
        locale: profile?.locale || "pl",
        tickets
      });
    }

    const category = String(req.body?.category || "other");
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();
    const contactEmail = String(req.body?.contact_email || "").trim();

    if (message.length < 5 || message.length > 5000) {
      return res.status(400).json({
        ok: false,
        error: "Message must contain 5-5000 characters."
      });
    }

    if (
      contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid email address."
      });
    }

    const ticket = await createQualitySupportTicket(user, {
      category,
      subject,
      message,
      contact_email: contactEmail
    });

    return res.status(201).json({
      ok: true,
      supportEmail: SUPPORT_EMAIL,
      ticket
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Support request failed"
    });
  }
}
