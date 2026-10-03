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

export async function getMe(token) { return telegramCall(token, "getMe"); }
export async function getChatMember(token, chatId, userId) { return telegramCall(token, "getChatMember", { chat_id: chatId, user_id: userId }); }
export async function createChatInviteLink(token, chatId, name) { return telegramCall(token, "createChatInviteLink", { chat_id: chatId, name: String(name || "Access").slice(0, 32), expire_date: Math.floor(Date.now() / 1000) + 3600, member_limit: 1 }); }
export async function banChatMember(token, chatId, userId) { return telegramCall(token, "banChatMember", { chat_id: chatId, user_id: userId }); }
export async function unbanChatMember(token, chatId, userId) { return telegramCall(token, "unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true }); }

export async function sendMessage(token, chatId, text, replyMarkup) {
  return telegramCall(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

export async function editMessage(token, chatId, messageId, text, replyMarkup) {
  return telegramCall(token, "editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

export async function answerCallbackQuery(token, callbackQueryId) { return telegramCall(token, "answerCallbackQuery", { callback_query_id: callbackQueryId }); }
export async function editUserStarSubscription(token, userId, telegramPaymentChargeId, isCanceled) { return telegramCall(token, "editUserStarSubscription", { user_id: userId, telegram_payment_charge_id: telegramPaymentChargeId, is_canceled: isCanceled }); }
export async function answerPreCheckoutQuery(token, preCheckoutQueryId, ok, errorMessage) { return telegramCall(token, "answerPreCheckoutQuery", { pre_checkout_query_id: preCheckoutQueryId, ok, ...(ok ? {} : { error_message: errorMessage || "Płatność nie może zostać zrealizowana." }) }); }

export async function sendStarsInvoice(token, chatId, plan) {
  const isMonthly = plan.billing_mode === "monthly";
  const safeTitle = String(plan.name || "Plan").slice(0, 32);
  return telegramCall(token, "sendInvoice", {
    chat_id: chatId,
    title: safeTitle,
    description: isMonthly ? `Miesięczny dostęp do planu ${plan.name}. Automatyczne odnowienie co 30 dni.` : `Dostęp do planu ${plan.name} na ${plan.duration_days} dni.`,
    payload: `plan:${plan.id}`,
    currency: "XTR",
    prices: [{ label: safeTitle, amount: plan.price_stars }],
    ...(isMonthly ? { subscription_period: 2592000 } : {})
  });
}

export async function sendQualityPlanInvoice(token, chatId, plan, locale = "pl") {
  const pl = locale !== "en";
  const safeTitle = String(plan.name_pl || plan.name_en || "Quality Plan").slice(0, 32);
  const stars = Number(plan.price_stars || 0);
  if (!stars) throw new Error("Quality plan price_stars is not configured");
  return telegramCall(token, "sendInvoice", {
    chat_id: chatId,
    title: safeTitle,
    description: pl ? `Miesięczny dostęp do Quality Assurance Support — ${safeTitle}. Cena referencyjna: ${Number(plan.display_price_pln).toFixed(2).replace(".", ",")} zł.` : `Monthly access to Quality Assurance Support — ${safeTitle}. Reference price: PLN ${Number(plan.display_price_pln).toFixed(2)}.`,
    payload: `qa_plan:${plan.slug}`,
    currency: "XTR",
    prices: [{ label: safeTitle, amount: stars }],
    subscription_period: 2592000
  });
}

export async function sendStarsTokenInvoice(token, chatId, pack) {
  const tokens = Number(pack.tokens);
  const stars = Number(pack.price_stars);
  return telegramCall(token, "sendInvoice", {
    chat_id: chatId,
    title: `${tokens} Quality Tokens`.slice(0, 32),
    description: `${tokens} tokenów do wykorzystania w Quality Assurance Support. Tokeny są cyfrowym saldem w bocie.`,
    payload: `qa_token:${tokens}`,
    currency: "XTR",
    prices: [{ label: `${tokens} tokenów`, amount: stars }]
  });
}

export async function sendQualityProductInvoice(token, chatId, product, locale = "pl") {
  const pl = locale !== "en";
  const title = String(pl ? product.name_pl : product.name_en || product.name_pl || "Quality product").slice(0, 32);
  const stars = Number(product.standalone_price_stars || 0);
  if (!stars) throw new Error("Standalone product price is not configured");
  const price = Number(product.standalone_price_pln || 0);
  const isTraining = product.product_type === "training";
  const description = pl
    ? `${isTraining ? "Szkolenie z prezentacją i e-bookiem" : "Pojedynczy dokument / e-book"}. Cena referencyjna: ${price.toFixed(2).replace(".", ",")} zł.`
    : `${isTraining ? "Training with presentation and e-book" : "Single document / e-book"}. Reference price: PLN ${price.toFixed(2)}.`;
  return telegramCall(token, "sendInvoice", {
    chat_id: chatId,
    title,
    description: description.slice(0, 255),
    payload: `qa_product:${product.slug}`,
    currency: "XTR",
    prices: [{ label: title, amount: stars }]
  });
}

const backButton = [{ text: "⬅️ Menu", callback_data: "home" }];
export function getMainMenu() { return { text: "<b>SUPER MARIO — Creator Platform</b>\n\nPanel do sprzedaży dostępu, subskrypcji i produktów przez Telegram.", reply_markup: { inline_keyboard: [[{ text: "💳 Plany", callback_data: "plans" }, { text: "📣 Kanały i grupy", callback_data: "communities" }], [{ text: "📦 Produkty", callback_data: "products" }, { text: "👥 Klienci", callback_data: "customers" }], [{ text: "📊 Statystyki", callback_data: "stats" }, { text: "📢 Wiadomości", callback_data: "broadcasts" }], [{ text: "🧩 Polecenia", callback_data: "affiliates" }, { text: "🛟 Pomoc", callback_data: "support" }], [{ text: "🧾 Moje subskrypcje", callback_data: "my_subscriptions" }]] } }; }
export function getSectionMessage(action) { return { text: "<b>🚧 Moduł administracyjny</b>\n\nTa sekcja jest w trybie roboczym. Główna sprzedaż Quality działa przez menu Quality Assurance Support.", reply_markup: { inline_keyboard: [backButton] } }; }
