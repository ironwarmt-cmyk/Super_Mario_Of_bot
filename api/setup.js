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
  const results = [];

  async function safe(method, payload) {
    try {
      const result = await telegramCall(token, method, payload);
      results.push({ method, ok: true });
      return result;
    } catch (error) {
      results.push({
        method,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return null;
    }
  }

  await safe("setMyName", {
    name: "Quality Assurance Support"
  });

  const plDescription =
    "Quality Assurance Support — centrum jakości i bezpieczeństwa żywności. Pakiety BASIC/PRO/VIP, edytowalne procedury, analiza zagrożeń, szkolenia, asystent Quality, tokeny oraz fizyczny segregator dokumentacji.";

  const enDescription =
    "Quality Assurance Support — food quality and safety hub. BASIC/PRO/VIP plans, editable procedures, hazard analysis, training, Quality Assistant, tokens and a printed documentation binder.";

  await safe("setMyDescription", {
    description: plDescription
  });

  await safe("setMyDescription", {
    description: plDescription,
    language_code: "pl"
  });

  await safe("setMyDescription", {
    description: enDescription,
    language_code: "en"
  });

  await safe("setMyShortDescription", {
    short_description:
      "Quality Assurance Support: dokumenty, szkolenia, asystent i narzędzia QA."
  });

  await safe("setMyShortDescription", {
    short_description:
      "Dokumenty, szkolenia, asystent i narzędzia dla jakości żywności.",
    language_code: "pl"
  });

  await safe("setMyShortDescription", {
    short_description:
      "Documents, training, assistant and tools for food quality professionals.",
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

  await safe("setMyCommands", {
    commands: plCommands,
    language_code: "pl"
  });

  await safe("setMyCommands", {
    commands: enCommands,
    language_code: "en"
  });

  await safe("setMyCommands", {
    commands: plCommands
  });

  await safe("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Quality Hub",
      web_app: {
        url: "https://supermarioofbot-iron-war.vercel.app/quality/"
      }
    }
  });

  return { ok: true, results, menu: "Quality Hub" };
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
