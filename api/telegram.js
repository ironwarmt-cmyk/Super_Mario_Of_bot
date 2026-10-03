import crypto from "node:crypto";
import {
  answerCallbackQuery,
  answerPreCheckoutQuery,
  editMessage,
  sendMessage,
  sendQualityPlanInvoice,
  sendQualityProductInvoice,
  sendStarsTokenInvoice
} from "../lib/telegram.js";
import {
  languageMenu,
  qualityHome,
  renderQualityPlans,
  renderProducts,
  renderProductDetail,
  renderTraining,
  renderTokens,
  renderPhysicalProduct,
  renderExpertServices,
  renderAssistant,
  renderMembership
} from "../lib/quality-ui.js";
import {
  upsertTelegramUser,
  getUserProfile,
  setUserLocale,
  listQualityPlans,
  getQualityPlan,
  listQualityProducts,
  getQualityProduct,
  getQualityProductAccess,
  listQualityTokenPacks,
  getQualityTokenPack,
  getQualityWallet,
  listQualityServices,
  getQualityMembership,
  recordQualityTokenPayment,
  recordQualityPlanPayment,
  recordQualityProductPayment,
  isDatabaseConfigured
} from "../lib/db.js";

function webhookSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function qualityDownloadUrl(token, telegramUserId, slug, locale = "pl") {
  const expires = Math.floor(Date.now() / 1000) + 900;
  const payload = `${telegramUserId}:${slug}:${locale}:${expires}`;
  const sig = crypto.createHmac("sha256", webhookSecret(token)).update(payload).digest("hex");
  const params = new URLSearchParams({ u: String(telegramUserId), slug, lang: locale === "en" ? "en" : "pl", exp: String(expires), sig });
  return `https://supermarioofbot-iron-war.vercel.app/api/quality-download?${params.toString()}`;
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function sendHome(token, chatId, user, edit = null) {
  await upsertTelegramUser(user);
  const [profile, plans] = await Promise.all([getUserProfile(user.id), listQualityPlans()]);
  const locale = profile?.locale || "pl";
  const view = profile?.locale ? qualityHome(locale, Boolean(profile?.is_admin), plans) : languageMenu();
  if (edit) return editMessage(token, chatId, edit, view.text, view.reply_markup);
  return sendMessage(token, chatId, view.text, view.reply_markup);
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "Super_Mario_Official_bot", tokenConfigured: Boolean(token), databaseConfigured: isDatabaseConfigured(), mode: "quality-assurance-support" });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!token) return res.status(503).json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" });
  if (req.headers["x-telegram-bot-api-secret-token"] !== webhookSecret(token)) return res.status(401).json({ ok: false, error: "Invalid webhook secret" });

  const update = req.body || {};

  try {
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      const payload = String(q.invoice_payload || "");
      let valid = false;
      let error = "Produkt jest niedostępny albo cena się zmieniła.";

      const tokenMatch = /^qa_token:(\d+)$/.exec(payload);
      const planMatch = /^qa_plan:([a-z0-9-]+)$/i.exec(payload);
      const productMatch = /^qa_product:([a-z0-9-]+)$/i.exec(payload);

      if (tokenMatch) {
        const pack = await getQualityTokenPack(Number(tokenMatch[1]));
        valid = Boolean(pack && q.currency === "XTR" && Number(q.total_amount) === Number(pack.price_stars));
      } else if (planMatch) {
        const plan = await getQualityPlan(planMatch[1]);
        valid = Boolean(plan && plan.active && plan.checkout_enabled && q.currency === "XTR" && Number(q.total_amount) === Number(plan.price_stars));
      } else if (productMatch) {
        const product = await getQualityProduct(productMatch[1]);
        valid = Boolean(product && product.standalone_purchase_enabled && q.currency === "XTR" && Number(q.total_amount) === Number(product.standalone_price_stars));
      } else {
        error = "Nieprawidłowy produkt.";
      }
      await answerPreCheckoutQuery(token, q.id, valid, valid ? undefined : error);
      return res.status(200).json({ ok: true });
    }

    if (update.message?.successful_payment) {
      const message = update.message;
      const chatId = message.chat.id;
      const payment = message.successful_payment;
      const payload = String(payment.invoice_payload || "");
      const profile = await getUserProfile(message.from.id);
      const locale = profile?.locale || "pl";
      const pl = locale !== "en";

      if (/^qa_token:(\d+)$/.test(payload)) {
        const result = await recordQualityTokenPayment(message.from, payment);
        await sendMessage(token, chatId, pl ? `✅ Tokeny dodane. Saldo: <b>${result.token_balance}</b>.` : `✅ Tokens added. Balance: <b>${result.token_balance}</b>.`, { inline_keyboard: [[{ text: pl ? "🪙 Portfel" : "🪙 Wallet", callback_data: "qa:tokens" }], [{ text: "🏠 Quality menu", callback_data: "qa:home" }]] });
        return res.status(200).json({ ok: true });
      }

      if (/^qa_plan:([a-z0-9-]+)$/i.test(payload)) {
        const result = await recordQualityPlanPayment(message.from, payment);
        const planName = pl ? result.plan.name_pl : result.plan.name_en;
        await sendMessage(token, chatId, pl ? `✅ Pakiet <b>${escapeHtml(planName)}</b> został aktywowany.\n\nDostęp aktywny do: <b>${new Date(result.membership.period_end).toLocaleDateString("pl-PL")}</b>.` : `✅ <b>${escapeHtml(planName)}</b> has been activated.\n\nAccess active until: <b>${new Date(result.membership.period_end).toLocaleDateString("en-GB")}</b>.`, { inline_keyboard: [[{ text: "🏠 Quality menu", callback_data: "qa:home" }], [{ text: pl ? "📚 Biblioteka" : "📚 Library", callback_data: "qa:products" }], ...(Number(result.plan.included_chat_minutes || 0) > 0 ? [[{ text: "🤖 Quality Copilot", callback_data: "qa:assistant" }]] : [])] });
        return res.status(200).json({ ok: true });
      }

      if (/^qa_product:([a-z0-9-]+)$/i.test(payload)) {
        const result = await recordQualityProductPayment(message.from, payment);
        const product = result.product;
        const name = pl ? product.name_pl : product.name_en;
        const url = qualityDownloadUrl(token, message.from.id, product.slug, locale);
        await sendMessage(token, chatId, pl ? `✅ Kupiono: <b>${escapeHtml(name)}</b>.\n\nPoniżej masz link do pobrania. Link techniczny jest czasowy, dostęp do produktu zostaje na koncie.` : `✅ Purchased: <b>${escapeHtml(name)}</b>.\n\nDownload link below. The technical link is temporary; product access remains on your account.`, { inline_keyboard: [[{ text: product.product_type === "training" ? (pl ? "⬇️ Pobierz szkolenie" : "⬇️ Download training") : (pl ? "⬇️ Pobierz produkt" : "⬇️ Download product"), url }], [{ text: "🏠 Quality menu", callback_data: "qa:home" }]] });
        return res.status(200).json({ ok: true });
      }
    }

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const action = cb.data || "qa:home";
      await answerCallbackQuery(token, cb.id);
      if (!chatId || !messageId) return res.status(200).json({ ok: true, ignored: true });
      await upsertTelegramUser(cb.from);

      if (action.startsWith("lang:")) {
        const locale = action.split(":")[1] === "en" ? "en" : "pl";
        await setUserLocale(cb.from.id, locale);
        const plans = await listQualityPlans();
        const profile = await getUserProfile(cb.from.id);
        const view = qualityHome(locale, Boolean(profile?.is_admin), plans);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:language") {
        const view = languageMenu();
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      const profile = await getUserProfile(cb.from.id);
      const locale = profile?.locale || "pl";
      const pl = locale !== "en";

      if (action === "qa:home" || action === "home") {
        await sendHome(token, chatId, cb.from, messageId);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:plans") {
        const view = renderQualityPlans(await listQualityPlans(), locale);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("qa:buyplan:")) {
        const plan = await getQualityPlan(action.split(":")[2]);
        if (!plan || !plan.checkout_enabled || !plan.price_stars) await sendMessage(token, chatId, pl ? "Ten pakiet jest chwilowo niedostępny." : "This plan is temporarily unavailable.");
        else await sendQualityPlanInvoice(token, chatId, plan, locale);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:products" || action.startsWith("qa:products:tier:")) {
        const tier = action.startsWith("qa:products:tier:") ? Number(action.split(":")[3]) : 3;
        const view = renderProducts(await listQualityProducts(tier), locale, action.startsWith("qa:products:tier:") ? tier : null);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("qa:product:")) {
        const slug = action.slice("qa:product:".length);
        const access = await getQualityProductAccess(cb.from.id, slug);
        const downloadUrl = access.unlocked || profile?.is_admin ? qualityDownloadUrl(token, cb.from.id, slug, locale) : null;
        const view = renderProductDetail(access.product, locale, { ...access, isAdmin: Boolean(profile?.is_admin), downloadUrl });
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:training") {
        const [products, membership] = await Promise.all([listQualityProducts(3), getQualityMembership(cb.from.id)]);
        const view = renderTraining(products, locale, membership);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("qa:buyproduct:")) {
        const product = await getQualityProduct(action.slice("qa:buyproduct:".length));
        if (!product || !product.standalone_purchase_enabled) await sendMessage(token, chatId, pl ? "Ten produkt nie jest dostępny pojedynczo." : "This product is not available standalone.");
        else await sendQualityProductInvoice(token, chatId, product, locale);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:tokens") {
        const [packs, wallet] = await Promise.all([listQualityTokenPacks(), getQualityWallet(cb.from.id)]);
        const view = renderTokens(packs, locale, wallet);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("qa:token:")) {
        const pack = await getQualityTokenPack(Number(action.split(":")[2]));
        if (pack) await sendStarsTokenInvoice(token, chatId, pack);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:physical") {
        const view = renderPhysicalProduct(locale, cb.from.id);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:services") {
        const view = renderExpertServices(await listQualityServices(), locale, cb.from.id);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:assistant") {
        const view = renderAssistant(locale);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:membership") {
        const [membership, wallet] = await Promise.all([getQualityMembership(cb.from.id), getQualityWallet(cb.from.id)]);
        const view = renderMembership(membership, locale, wallet);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }
    }

    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text?.trim() || "";
      await upsertTelegramUser(message.from);

      const planLink = /^\/start\s+qa_plan_([a-z0-9-]+)$/i.exec(text);
      const productLink = /^\/start\s+qa_product_([a-z0-9-]+)$/i.exec(text);
      if (planLink) {
        const profile = await getUserProfile(message.from.id);
        const plan = await getQualityPlan(planLink[1]);
        if (plan) await sendQualityPlanInvoice(token, chatId, plan, profile?.locale || "pl");
        return res.status(200).json({ ok: true });
      }
      if (productLink) {
        const profile = await getUserProfile(message.from.id);
        const product = await getQualityProduct(productLink[1]);
        if (product) await sendQualityProductInvoice(token, chatId, product, profile?.locale || "pl");
        return res.status(200).json({ ok: true });
      }
      if (/^\/start\s+tokens$/i.test(text)) {
        const profile = await getUserProfile(message.from.id);
        const view = renderTokens(await listQualityTokenPacks(), profile?.locale || "pl", await getQualityWallet(message.from.id));
        await sendMessage(token, chatId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }
      if (/^\/start\s+physical$/i.test(text)) {
        const profile = await getUserProfile(message.from.id);
        const view = renderPhysicalProduct(profile?.locale || "pl", message.from.id);
        await sendMessage(token, chatId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }
      if (text === "/language") {
        const view = languageMenu();
        await sendMessage(token, chatId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }
      if (text === "/paysupport") {
        await sendMessage(token, chatId, "<b>Pomoc dotycząca płatności</b>\n\nNapisz, czego dotyczy problem i zachowaj potwierdzenie zakupu z Telegrama.");
        return res.status(200).json({ ok: true });
      }
      if (text === "/start" || text === "/menu" || text === "") {
        await sendHome(token, chatId, message.from);
        return res.status(200).json({ ok: true });
      }
      await sendHome(token, chatId, message.from);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("telegram_webhook_error", error);
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Webhook failed" });
  }
}
