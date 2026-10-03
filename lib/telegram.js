const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

async function telegramCall(token, method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description || "unknown error"}`);
  }

  return data.result;
}

export async function getMe(token) {
  return telegramCall(token, "getMe");
}

export async function getChatMember(token, chatId, userId) {
  return telegramCall(token, "getChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

export async function createChatInviteLink(token, chatId, name) {
  return telegramCall(token, "createChatInviteLink", {
    chat_id: chatId,
    name: String(name || "Access").slice(0, 32),
    expire_date: Math.floor(Date.now() / 1000) + 3600,
    member_limit: 1
  });
}

export async function banChatMember(token, chatId, userId) {
  return telegramCall(token, "banChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

export async function unbanChatMember(token, chatId, userId) {
  return telegramCall(token, "unbanChatMember", {
    chat_id: chatId,
    user_id: userId,
    only_if_banned: true
  });
}

export async function sendMessage(token, chatId, text, replyMarkup) {
  return telegramCall(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export async function editMessage(token, chatId, messageId, text, replyMarkup) {
  return telegramCall(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export async function answerCallbackQuery(token, callbackQueryId) {
  return telegramCall(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId
  });
}

export async function editUserStarSubscription(
  token,
  userId,
  telegramPaymentChargeId,
  isCanceled
) {
  return telegramCall(token, "editUserStarSubscription", {
    user_id: userId,
    telegram_payment_charge_id: telegramPaymentChargeId,
    is_canceled: isCanceled
  });
}

export async function answerPreCheckoutQuery(
  token,
  preCheckoutQueryId,
  ok,
  errorMessage
) {
  return telegramCall(token, "answerPreCheckoutQuery", {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
    ...(ok ? {} : { error_message: errorMessage || "Płatność nie może zostać zrealizowana." })
  });
}

export async function sendStarsInvoice(token, chatId, plan) {
  const isMonthly = plan.billing_mode === "monthly";
  const safeTitle = String(plan.name || "Plan").slice(0, 32);

  return telegramCall(token, "sendInvoice", {
    chat_id: chatId,
    title: safeTitle,
    description: isMonthly
      ? `Miesięczny dostęp do planu ${plan.name}. Automatyczne odnowienie co 30 dni.`
      : `Dostęp do planu ${plan.name} na ${plan.duration_days} dni.`,
    payload: `plan:${plan.id}`,
    currency: "XTR",
    prices: [
      {
        label: safeTitle,
        amount: plan.price_stars
      }
    ],
    ...(isMonthly ? { subscription_period: 2592000 } : {})
  });
}


export async function sendQualityPlanInvoice(token, chatId, plan, locale = "pl") {
  const pl = locale !== "en";
  const safeTitle = String(plan.name_pl || plan.name_en || "Quality Plan").slice(0, 32);
  const stars = Number(plan.price_stars || 0);

  if (!stars) {
    throw new Error("Quality plan price_stars is not configured");
  }

  return telegramCall(token, "sendInvoice", {
    chat_id: chatId,
    title: safeTitle,
    description: pl
      ? `Miesięczny dostęp do Quality Assurance Support — ${safeTitle}. Cena referencyjna: ${Number(plan.display_price_pln).toFixed(2).replace(".", ",")} zł.`
      : `Monthly access to Quality Assurance Support — ${safeTitle}. Reference price: PLN ${Number(plan.display_price_pln).toFixed(2)}.`,
    payload: `qa_plan:${plan.slug}`,
    currency: "XTR",
    prices: [
      {
        label: safeTitle,
        amount: stars
      }
    ],
    subscription_period: 2592000
  });
}

export async function sendStarsTokenInvoice(token, chatId, pack) {
  const tokens = Number(pack.tokens);
  const stars = Number(pack.price_stars);

  return telegramCall(token, "sendInvoice", {
    chat_id: chatId,
    title: `${tokens} Quality Tokens`.slice(0, 32),
    description:
      `${tokens} tokenów do wykorzystania w Quality Assurance Support. ` +
      "Tokeny są cyfrowym saldem w bocie.",
    payload: `qa_token:${tokens}`,
    currency: "XTR",
    prices: [
      {
        label: `${tokens} tokenów`,
        amount: stars
      }
    ]
  });
}


const backButton = [{ text: "⬅️ Menu", callback_data: "home" }];

export function getMainMenu() {
  return {
    text:
      "<b>SUPER MARIO — Creator Platform</b>\n\n" +
      "Panel do sprzedaży dostępu, subskrypcji i produktów przez Telegram.\n\n" +
      "Wersja MVP: plany → płatność → dostęp → odnowienie → automatyczne odebranie dostępu.",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💳 Plany", callback_data: "plans" },
          { text: "📣 Kanały i grupy", callback_data: "communities" }
        ],
        [
          { text: "📦 Produkty", callback_data: "products" },
          { text: "👥 Klienci", callback_data: "customers" }
        ],
        [
          { text: "📊 Statystyki", callback_data: "stats" },
          { text: "📢 Wiadomości", callback_data: "broadcasts" }
        ],
        [
          { text: "🧩 Polecenia", callback_data: "affiliates" },
          { text: "🛟 Pomoc", callback_data: "support" }
        ],
        [
          { text: "🧾 Moje subskrypcje", callback_data: "my_subscriptions" }
        ]
      ]
    }
  };
}

export function getSectionMessage(action) {
  switch (action) {
    case "communities":
      return {
        text:
          "<b>📣 Kanały i grupy</b>\n\n" +
          "Tutaj podepniemy prywatne kanały i grupy. Po opłaceniu planu bot będzie nadawał dostęp, a po wygaśnięciu subskrypcji będzie go odbierał.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Dodaj kanał / grupę", callback_data: "community_add" }],
            backButton
          ]
        }
      };

    case "products":
      return {
        text:
          "<b>📦 Produkty</b>\n\n" +
          "Sprzedaż pojedynczych produktów cyfrowych lub usług przez Telegram Stars.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Dodaj produkt", callback_data: "product_add" }],
            backButton
          ]
        }
      };

    case "customers":
      return {
        text:
          "<b>👥 Klienci</b>\n\n" +
          "Baza użytkowników, status subskrypcji, historia płatności, termin wygaśnięcia i dostępne zasoby.",
        reply_markup: { inline_keyboard: [backButton] }
      };

    case "stats":
      return {
        text:
          "<b>📊 Statystyki</b>\n\n" +
          "Tu pokażemy przychód, aktywne subskrypcje, odnowienia, anulowania i konwersję z wejścia do zakupu.",
        reply_markup: { inline_keyboard: [backButton] }
      };

    case "broadcasts":
      return {
        text:
          "<b>📢 Wiadomości do użytkowników</b>\n\n" +
          "Segmentowane komunikaty: wszyscy, aktywni klienci, wygasłe subskrypcje, nowi użytkownicy i wybrany plan.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✍️ Nowa wiadomość", callback_data: "broadcast_create" }],
            backButton
          ]
        }
      };

    case "affiliates":
      return {
        text:
          "<b>🧩 Program poleceń</b>\n\n" +
          "Każdy twórca lub partner będzie mógł dostać własny link. System przypisze sprzedaż do polecającego i policzy prowizję.",
        reply_markup: { inline_keyboard: [backButton] }
      };

    case "support":
      return {
        text:
          "<b>🛟 Pomoc</b>\n\n" +
          "W sprawach dotyczących płatności użyj komendy /paysupport.",
        reply_markup: { inline_keyboard: [backButton] }
      };

    case "community_add":
    case "product_add":
    case "broadcast_create":
      return {
        text:
          "<b>🚧 Moduł w budowie</b>\n\n" +
          "Interfejs jest już podłączony. Ten moduł będzie następny.",
        reply_markup: { inline_keyboard: [backButton] }
      };

    case "home":
    default:
      return getMainMenu();
  }
}
