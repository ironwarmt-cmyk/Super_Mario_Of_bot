import crypto from "node:crypto";
import { bootstrapDatabase } from "../lib/db.js";

async function telegramCall(token, method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(`Telegram ${method} failed: ${data?.description || response.status}`);
  }

  return data.result;
}

async function configureBotProfile(token) {
  await telegramCall(token, "setMyName", {
    name: "Quality Assurance Support"
  });

  await telegramCall(token, "setMyDescription", {
    description:
      "Quality Assurance Support — dwujęzyczna społeczność dla jakości i bezpieczeństwa żywności. Procedury, analiza zagrożeń, szkolenia, biblioteka dokumentów i wsparcie QA.",
    language_code: "pl"
  });

  await telegramCall(token, "setMyDescription", {
    description:
      "Quality Assurance Support — bilingual community for food quality and food safety. Procedures, hazard analysis, training, document library and QA support.",
    language_code: "en"
  });

  await telegramCall(token, "setMyShortDescription", {
    short_description:
      "Jakość i bezpieczeństwo żywności: dokumenty, szkolenia i wsparcie QA.",
    language_code: "pl"
  });

  await telegramCall(token, "setMyShortDescription", {
    short_description:
      "Food quality & safety: documents, training and QA support.",
    language_code: "en"
  });

  const plCommands = [
    { command: "start", description: "Uruchom Quality Assurance Support" },
    { command: "menu", description: "Otwórz menu główne" },
    { command: "language", description: "Zmień język PL / EN" },
    { command: "paysupport", description: "Pomoc dotycząca płatności" },
    { command: "admin", description: "Panel właściciela" }
  ];

  const enCommands = [
    { command: "start", description: "Start Quality Assurance Support" },
    { command: "menu", description: "Open main menu" },
    { command: "language", description: "Change language PL / EN" },
    { command: "paysupport", description: "Payment support" },
    { command: "admin", description: "Owner panel" }
  ];

  await telegramCall(token, "setMyCommands", {
    commands: plCommands,
    language_code: "pl"
  });

  await telegramCall(token, "setMyCommands", {
    commands: enCommands,
    language_code: "en"
  });

  await telegramCall(token, "setMyCommands", {
    commands: plCommands
  });

  return { ok: true };
}

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

  try {
    const database = await bootstrapDatabase();

    const profile = await configureBotProfile(token);

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
      database,
      profile,
      telegram
    });
  } catch (error) {
    console.error("setup_error", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Setup failed"
    });
  }
}
