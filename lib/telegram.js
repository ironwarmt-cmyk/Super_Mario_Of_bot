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

const backButton = [{ text: "⬅️ Menu", callback_data: "home" }];

export function getMainMenu() {
  return {
    text:
      "<b>SUPER MARIO — Creator Platform</b>\n\n" +
      "Panel do sprzedaży dostępu, subskrypcji i produktów przez Telegram.\n\n" +
      "Wersja MVP jest budowana na sprawdzonym modelu płatnych społeczności: plany → płatność → dostęp → odnowienie → automatyczne odebranie dostępu.",
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
        ]
      ]
    }
  };
}

export function getSectionMessage(action) {
  switch (action) {
    case "plans":
      return {
        text:
          "<b>💳 Plany subskrypcji</b>\n\n" +
          "Tu będą tworzone pakiety: nazwa, cena, okres dostępu, trial, zasoby i zasady odnowienia.\n\n" +
          "Przykład:\n• BASIC — 29 zł / 30 dni\n• PRO — 59 zł / 30 dni\n• VIP — 99 zł / 30 dni",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Dodaj plan", callback_data: "plan_create" }],
            backButton
          ]
        }
      };

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
          "Sprzedaż pojedynczych produktów cyfrowych lub usług. Dla cyfrowych dóbr sprzedawanych wewnątrz Telegrama płatność musi działać przez Telegram Stars.",
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
          "Moduł obsługi klienta, FAQ oraz zgłoszeń związanych z płatnościami. Dla sprzedaży cyfrowej dodamy także obsługę /paysupport.",
        reply_markup: { inline_keyboard: [backButton] }
      };

    case "plan_create":
    case "community_add":
    case "product_add":
    case "broadcast_create":
      return {
        text:
          "<b>🚧 Moduł w budowie</b>\n\n" +
          "Interfejs jest już podłączony. Następny etap to baza danych i formularze tworzenia.",
        reply_markup: { inline_keyboard: [backButton] }
      };

    case "home":
    default:
      return getMainMenu();
  }
}
