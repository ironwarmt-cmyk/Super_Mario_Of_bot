import crypto from "node:crypto";
import {
  answerCallbackQuery,
  editMessage,
  getMainMenu,
  getSectionMessage,
  sendMessage
} from "../lib/telegram.js";
import {
  clearSession,
  createPlan,
  ensureCreator,
  getSession,
  isDatabaseConfigured,
  listPlans,
  setSession,
  upsertTelegramUser
} from "../lib/db.js";

function webhookSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parsePositiveInt(value) {
  const normalized = String(value || "").trim();
  if (!/^\d+$/.test(normalized)) return null;

  const number = Number(normalized);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function renderPlans(plans = []) {
  const lines = plans.length
    ? plans.map(
        (plan, index) =>
          `${index + 1}. <b>${escapeHtml(plan.name)}</b> — ${plan.price_stars} ⭐ / ${plan.duration_days} dni`
      )
    : ["Nie masz jeszcze żadnego planu."];

  return {
    text:
      "<b>💳 Plany subskrypcji</b>\n\n" +
      lines.join("\n") +
      "\n\nDodaj pierwszy plan lub kolejny wariant cenowy.",
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Dodaj plan", callback_data: "plan_create" }],
        [{ text: "⬅️ Menu", callback_data: "home" }]
      ]
    }
  };
}

async function renderCreatorPlans(user) {
  const creator = await ensureCreator(user);
  const plans = await listPlans(creator.id);
  return renderPlans(plans);
}

async function handlePlanWizard(token, message, session) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text?.trim() || "";

  if (text === "/cancel") {
    await clearSession(userId);
    const menu = getMainMenu();
    await sendMessage(token, chatId, "Anulowano tworzenie planu.", menu.reply_markup);
    return true;
  }

  if (session.state === "plan_name") {
    if (text.length < 2 || text.length > 80) {
      await sendMessage(
        token,
        chatId,
        "Nazwa planu musi mieć od 2 do 80 znaków. Wyślij nazwę ponownie albo wpisz /cancel."
      );
      return true;
    }

    await setSession(userId, "plan_price", {
      ...session.data,
      name: text
    });

    await sendMessage(
      token,
      chatId,
      `Plan: <b>${escapeHtml(text)}</b>\n\nPodaj cenę w Telegram Stars, np. <b>250</b>.\nWpisz /cancel, aby przerwać.`
    );
    return true;
  }

  if (session.state === "plan_price") {
    const priceStars = parsePositiveInt(text);

    if (!priceStars || priceStars > 10000000) {
      await sendMessage(
        token,
        chatId,
        "Podaj dodatnią liczbę całkowitą Stars, np. 250. Wpisz /cancel, aby przerwać."
      );
      return true;
    }

    await setSession(userId, "plan_duration", {
      ...session.data,
      priceStars
    });

    await sendMessage(
      token,
      chatId,
      `Cena: <b>${priceStars} ⭐</b>\n\nNa ile dni ma być przyznawany dostęp? Np. <b>30</b>.\nWpisz /cancel, aby przerwać.`
    );
    return true;
  }

  if (session.state === "plan_duration") {
    const durationDays = parsePositiveInt(text);

    if (!durationDays || durationDays > 3650) {
      await sendMessage(
        token,
        chatId,
        "Podaj liczbę dni od 1 do 3650. Wpisz /cancel, aby przerwać."
      );
      return true;
    }

    const creator = await ensureCreator(message.from);
    const plan = await createPlan(creator.id, {
      name: session.data.name,
      priceStars: session.data.priceStars,
      durationDays
    });

    await clearSession(userId);

    const plans = await listPlans(creator.id);
    const view = renderPlans(plans);

    await sendMessage(
      token,
      chatId,
      `✅ Utworzono plan <b>${escapeHtml(plan.name)}</b>: ${plan.price_stars} ⭐ / ${plan.duration_days} dni.`
    );
    await sendMessage(token, chatId, view.text, view.reply_markup);
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Super_Mario_Official_bot",
      tokenConfigured: Boolean(token),
      databaseConfigured: isDatabaseConfigured(),
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

      if (!chatId || !messageId) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      if (action === "home") {
        if (isDatabaseConfigured()) {
          await clearSession(callback.from.id);
          await upsertTelegramUser(callback.from);
        }

        const menu = getMainMenu();
        await editMessage(token, chatId, messageId, menu.text, menu.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "plans") {
        if (!isDatabaseConfigured()) {
          await editMessage(
            token,
            chatId,
            messageId,
            "<b>💳 Plany</b>\n\nBaza danych nie jest jeszcze podłączona. Kod modułu jest gotowy — trzeba dodać połączenie z bazą.",
            { inline_keyboard: [[{ text: "⬅️ Menu", callback_data: "home" }]] }
          );
          return res.status(200).json({ ok: true });
        }

        const view = await renderCreatorPlans(callback.from);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "plan_create") {
        if (!isDatabaseConfigured()) {
          await editMessage(
            token,
            chatId,
            messageId,
            "<b>Nie można jeszcze tworzyć planów.</b>\n\nNajpierw trzeba podłączyć bazę danych.",
            { inline_keyboard: [[{ text: "⬅️ Menu", callback_data: "home" }]] }
          );
          return res.status(200).json({ ok: true });
        }

        const creator = await ensureCreator(callback.from);
        await setSession(callback.from.id, "plan_name", {
          creatorId: creator.id
        });

        await editMessage(
          token,
          chatId,
          messageId,
          "<b>➕ Nowy plan</b>\n\nWyślij teraz nazwę planu, np. <b>VIP</b>.\n\nWpisz /cancel, aby anulować.",
          {
            inline_keyboard: [
              [{ text: "✖️ Anuluj", callback_data: "home" }]
            ]
          }
        );

        return res.status(200).json({ ok: true });
      }

      const section = getSectionMessage(action);
      await editMessage(token, chatId, messageId, section.text, section.reply_markup);
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || "";

    if (!chatId || !message?.from?.id) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (isDatabaseConfigured()) {
      await upsertTelegramUser(message.from);

      const session = await getSession(message.from.id);
      if (session) {
        const handled = await handlePlanWizard(token, message, session);
        if (handled) {
          return res.status(200).json({ ok: true });
        }
      }
    }

    if (text === "/start" || text === "/menu" || text === "") {
      if (isDatabaseConfigured()) {
        await ensureCreator(message.from);
      }

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
