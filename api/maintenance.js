import crypto from "node:crypto";
import { expireDueSubscriptions } from "../lib/db.js";
import { banChatMember, unbanChatMember } from "../lib/telegram.js";

function botSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return res.status(503).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not configured"
    });
  }

  const receivedSecret = req.headers["x-bot-secret"];

  if (receivedSecret !== botSecret(token)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const targets = await expireDueSubscriptions();
    const results = [];

    for (const target of targets) {
      try {
        await banChatMember(
          token,
          target.telegram_chat_id,
          target.telegram_user_id
        );

        await unbanChatMember(
          token,
          target.telegram_chat_id,
          target.telegram_user_id
        );

        results.push({
          subscriptionId: target.subscription_id,
          chatId: target.telegram_chat_id,
          userId: target.telegram_user_id,
          removed: true
        });
      } catch (error) {
        results.push({
          subscriptionId: target.subscription_id,
          chatId: target.telegram_chat_id,
          userId: target.telegram_user_id,
          removed: false,
          error: error instanceof Error ? error.message : "Unknown Telegram error"
        });
      }
    }

    return res.status(200).json({
      ok: true,
      expiredTargets: targets.length,
      results
    });
  } catch (error) {
    console.error("maintenance_error", error);

    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Maintenance failed"
    });
  }
}
