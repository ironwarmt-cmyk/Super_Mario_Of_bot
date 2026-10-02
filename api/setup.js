import crypto from "node:crypto";

function webhookSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return res.status(503).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not configured"
    });
  }

  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    "https://supermarioofbot-iron-war.vercel.app";

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram`;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret(token),
        allowed_updates: ["message", "callback_query", "pre_checkout_query"]
      })
    }
  );

  const telegram = await response.json();

  return res.status(response.ok ? 200 : 502).json({
    ok: Boolean(telegram.ok),
    webhook: webhookUrl,
    telegram
  });
}
