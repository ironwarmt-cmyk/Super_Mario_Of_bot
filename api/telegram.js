import crypto from "node:crypto";
import {
  answerCallbackQuery,
  editMessage,
  getMainMenu,
  getSectionMessage,
  sendMessage
} from "../lib/telegram.js";

function webhookSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Super_Mario_Official_bot",
      tokenConfigured: Boolean(token),
      mode: "creator-platform-mvp"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!token) {
    return res.status(503).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not configured"
    });
  }

  const expectedSecret = webhookSecret(token);
  const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];

  if (receivedSecret !== expectedSecret) {
    return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
  }

  const update = req.body || {};

  try {
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const messageId = callback.message?.message_id;
      const action = callback.data || "home";

      await answerCallbackQuery(token, callback.id);

      if (chatId && messageId) {
        const section = getSectionMessage(action);
        await editMessage(token, chatId, messageId, section.text, section.reply_markup);
      }

      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || "";

    if (!chatId) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (text === "/start" || text === "/menu" || text === "") {
      const menu = getMainMenu();
      await sendMessage(token, chatId, menu.text, menu.reply_markup);
      return res.status(200).json({ ok: true });
    }

    await sendMessage(
      token,
      chatId,
      "Użyj przycisków w menu. Wpisz /menu, aby wrócić do panelu.",
      getMainMenu().reply_markup
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("telegram_webhook_error", error);
    return res.status(200).json({ ok: true, handledWithError: true });
  }
}
