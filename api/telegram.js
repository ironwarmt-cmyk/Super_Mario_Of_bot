import crypto from "node:crypto";
import {
  answerCallbackQuery,
  answerPreCheckoutQuery,
  createChatInviteLink,
  editMessage,
  editUserStarSubscription,
  getChatMember,
  getMe,
  getMainMenu,
  getSectionMessage,
  sendMessage,
  sendStarsInvoice,
  sendStarsTokenInvoice,
  unbanChatMember
} from "../lib/telegram.js";
import {
  languageMenu,
  qualityHome,
  renderQualityPlans,
  renderPlanDetails,
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
  clearSession,
  createCommunity,
  createPlan,
  ensureCreator,
  getCreatorStats,
  getPlan,
  getPlanCommunities,
  getSession,
  getSubscription,
  getUserSubscriptions,
  getUserProfile,
  setUserLocale,
  listQualityPlans,
  getQualityPlan,
  getQualityProduct,
  listQualityProducts,
  listQualityTokenPacks,
  listQualityServices,
  getQualityTokenPack,
  getQualityWallet,
  recordQualityTokenPayment,
  getQualityMembership,
  isDatabaseConfigured,
  listCommunities,
  listCreatorCustomers,
  listPlans,
  setPlanCommunity,
  recordSuccessfulPayment,
  setSession,
  setSubscriptionAutoRenew,
  upsertTelegramUser
} from "../lib/db.js";

const BOT_USERNAME = "Super_Mario_Official_bot";

function webhookSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}


function qualityDownloadUrl(token, telegramUserId, slug, locale = "pl") {
  const expires = Math.floor(Date.now() / 1000) + 900;
  const payload = `${telegramUserId}:${slug}:${locale}:${expires}`;
  const sig = crypto
    .createHmac("sha256", webhookSecret(token))
    .update(payload)
    .digest("hex");

  const params = new URLSearchParams({
    u: String(telegramUserId),
    slug,
    lang: locale === "en" ? "en" : "pl",
    exp: String(expires),
    sig
  });

  return `https://supermarioofbot-iron-war.vercel.app/api/quality-download?${params.toString()}`;
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

function planLabel(plan) {
  return plan.billing_mode === "monthly"
    ? `${plan.price_stars} ⭐ / 30 dni (subskrypcja)`
    : `${plan.price_stars} ⭐ / ${plan.duration_days} dni`;
}

function renderPlans(plans = []) {
  const lines = plans.length
    ? plans.map(
        (plan, index) =>
          `${index + 1}. <b>${escapeHtml(plan.name)}</b> — ${planLabel(plan)}`
      )
    : ["Nie masz jeszcze żadnego planu."];

  const planButtons = plans.flatMap((plan) => [
    [
      {
        text: `🧪 Kup: ${plan.name}`,
        callback_data: `buy_plan:${plan.id}`
      },
      {
        text: "🔗 Link",
        url: `https://t.me/${BOT_USERNAME}?start=plan_${plan.id}`
      }
    ],
    [
      {
        text: `🔐 Dostęp: ${plan.name}`,
        callback_data: `plan_access:${plan.id}`
      }
    ]
  ]);

  return {
    text:
      "<b>💳 Plany subskrypcji</b>\n\n" +
      lines.join("\n") +
      "\n\nKażdy plan ma własny link sprzedażowy.",
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Dodaj plan", callback_data: "plan_create" }],
        ...planButtons,
        [{ text: "⬅️ Menu", callback_data: "home" }]
      ]
    }
  };
}

function renderPlanCheckout(plan) {
  return {
    text:
      `<b>${escapeHtml(plan.name)}</b>\n\n` +
      `Cena: <b>${plan.price_stars} ⭐</b>\n` +
      (plan.billing_mode === "monthly"
        ? "Okres: <b>30 dni, automatyczne odnowienie</b>"
        : `Dostęp: <b>${plan.duration_days} dni</b>`),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `⭐ Kup za ${plan.price_stars} Stars`,
            callback_data: `buy_plan:${plan.id}`
          }
        ],
        [{ text: "⬅️ Menu", callback_data: "home" }]
      ]
    }
  };
}

function renderSubscriptions(items = []) {
  if (!items.length) {
    return {
      text: "Nie masz jeszcze aktywnych ani historycznych subskrypcji.",
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Menu", callback_data: "home" }]]
      }
    };
  }

  const text = items
    .map((item, index) => {
      const plan = item.plans;
      const end = item.ends_at
        ? new Date(item.ends_at).toLocaleDateString("pl-PL")
        : "—";

      const renewal = item.is_recurring
        ? item.auto_renew
          ? "włączone"
          : "wyłączone"
        : "nie dotyczy";

      return (
        `${index + 1}. <b>${escapeHtml(plan?.name || "Plan")}</b>\n` +
        `Status: ${escapeHtml(item.status)}\n` +
        `Ważne do: ${end}\n` +
        `Odnowienie: ${renewal}`
      );
    })
    .join("\n\n");

  const buttons = items
    .filter(
      (item) =>
        item.is_recurring &&
        item.status === "active" &&
        item.telegram_subscription_charge_id
    )
    .map((item) => [
      {
        text: item.auto_renew
          ? `⏹ Wyłącz: ${item.plans?.name || "subskrypcję"}`
          : `▶️ Włącz: ${item.plans?.name || "subskrypcję"}`,
        callback_data: `${item.auto_renew ? "cancel_sub" : "resume_sub"}:${item.id}`
      }
    ]);

  return {
    text,
    reply_markup: {
      inline_keyboard: [
        ...buttons,
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

function renderCommunities(items = []) {
  const lines = items.length
    ? items.map(
        (item, index) =>
          `${index + 1}. <b>${escapeHtml(item.title)}</b> — ${escapeHtml(item.chat_type)}`
      )
    : ["Nie masz jeszcze podpiętego kanału ani grupy."];

  return {
    text:
      "<b>📣 Kanały i grupy</b>\n\n" +
      lines.join("\n") +
      "\n\nAby dodać miejsce sprzedażowe, bot musi być jego administratorem.",
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Dodaj kanał / grupę", callback_data: "community_add" }],
        [{ text: "⬅️ Menu", callback_data: "home" }]
      ]
    }
  };
}

async function renderCreatorCommunities(user) {
  const creator = await ensureCreator(user);
  const items = await listCommunities(creator.id);
  return renderCommunities(items);
}

async function renderCreatorCustomers(user) {
  const creator = await ensureCreator(user);
  const items = await listCreatorCustomers(creator.id);

  const rows = items.slice(0, 20).map((item, index) => {
    const customer = item.telegram_users || {};
    const plan = item.plans || {};
    const name =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      (customer.username ? `@${customer.username}` : `ID ${item.telegram_user_id}`);

    const end = item.ends_at
      ? new Date(item.ends_at).toLocaleDateString("pl-PL")
      : "—";

    return (
      `${index + 1}. <b>${escapeHtml(name)}</b>\n` +
      `Plan: ${escapeHtml(plan.name || "—")}\n` +
      `Status: ${escapeHtml(item.status)} · do ${end}`
    );
  });

  return {
    text:
      "<b>👥 Klienci</b>\n\n" +
      (rows.length ? rows.join("\n\n") : "Nie ma jeszcze klientów.") +
      (items.length > 20 ? `\n\nPokazano 20 z ${items.length} rekordów.` : ""),
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Menu", callback_data: "home" }]]
    }
  };
}

async function renderCreatorStats(user) {
  const creator = await ensureCreator(user);
  const stats = await getCreatorStats(creator.id);

  return {
    text:
      "<b>📊 Statystyki</b>\n\n" +
      `Przychód brutto: <b>${stats.gross_stars || 0} ⭐</b>\n` +
      `Ostatnie 30 dni: <b>${stats.gross_stars_30d || 0} ⭐</b>\n` +
      `Płatności łącznie: <b>${stats.payment_count || 0}</b>\n` +
      `Płatności 30 dni: <b>${stats.payment_count_30d || 0}</b>\n` +
      `Unikalni kupujący: <b>${stats.unique_buyers || 0}</b>\n` +
      `Aktywne dostępy: <b>${stats.active_subscriptions || 0}</b>`,
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Menu", callback_data: "home" }]]
    }
  };
}

async function renderPlanAccess(user, planId) {
  const creator = await ensureCreator(user);
  const plan = await getPlan(planId);

  if (!plan || plan.creator_id !== creator.id) {
    return {
      text: "<b>Nie znaleziono planu.</b>",
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Plany", callback_data: "plans" }]]
      }
    };
  }

  const [communities, links] = await Promise.all([
    listCommunities(creator.id),
    getPlanCommunities(plan.id)
  ]);

  const assigned = new Set((links || []).map((item) => item.community_id));

  await setSession(user.id, "plan_access", { planId: plan.id });

  const buttons = communities.map((community) => [
    {
      text: `${assigned.has(community.id) ? "✅" : "⬜️"} ${community.title}`.slice(0, 60),
      callback_data: `pc:${community.id}`
    }
  ]);

  return {
    text:
      `<b>🔐 Dostęp dla planu: ${escapeHtml(plan.name)}</b>\n\n` +
      (communities.length
        ? "Kliknij kanał lub grupę, aby włączyć/wyłączyć dostęp po zakupie."
        : "Najpierw dodaj kanał lub grupę w sekcji „Kanały i grupy”."),
    reply_markup: {
      inline_keyboard: [
        ...buttons,
        [{ text: "⬅️ Plany", callback_data: "plans" }]
      ]
    }
  };
}

async function grantPlanAccess(token, telegramUserId, planId) {
  const links = await getPlanCommunities(planId);
  const buttons = [];

  for (const row of links || []) {
    const community = row.communities;
    if (!community?.active || !community.telegram_chat_id) continue;

    try {
      const membership = await getChatMember(
        token,
        community.telegram_chat_id,
        telegramUserId
      );

      if (membership?.status === "kicked") {
        await unbanChatMember(token, community.telegram_chat_id, telegramUserId);
      }
    } catch {
      // Continue with invite creation; Telegram will validate permissions.
    }

    const invite = await createChatInviteLink(
      token,
      community.telegram_chat_id,
      `Paid access ${telegramUserId}`
    );

    buttons.push([
      {
        text: `➡️ ${community.title}`.slice(0, 60),
        url: invite.invite_link
      }
    ]);
  }

  return buttons;
}

function getForwardedChat(message) {
  const origin = message?.forward_origin;
  if (origin?.type === "channel" && origin.chat) return origin.chat;
  if (origin?.type === "chat" && origin.sender_chat) return origin.sender_chat;
  if (message?.forward_from_chat) return message.forward_from_chat;
  return null;
}

async function handlePlanWizard(token, message, session) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text?.trim() || "";

  if (text === "/cancel") {
    await clearSession(userId);
    const menu = getMainMenu();
    await sendMessage(
      token,
      chatId,
      "Anulowano tworzenie planu.",
      menu.reply_markup
    );
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

    await setSession(userId, "plan_billing", {
      ...session.data,
      priceStars
    });

    await sendMessage(
      token,
      chatId,
      `Cena: <b>${priceStars} ⭐</b>\n\nWybierz sposób sprzedaży:`,
      {
        inline_keyboard: [
          [
            { text: "1️⃣ Jednorazowo", callback_data: "billing:one_time" },
            { text: "🔁 Co 30 dni", callback_data: "billing:monthly" }
          ],
          [{ text: "✖️ Anuluj", callback_data: "home" }]
        ]
      }
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
      durationDays,
      billingMode: "one_time"
    });

    await clearSession(userId);

    const plans = await listPlans(creator.id);
    const view = renderPlans(plans);

    await sendMessage(
      token,
      chatId,
      `✅ Utworzono plan <b>${escapeHtml(plan.name)}</b>: ${planLabel(plan)}.`
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
      mode: "creator-platform-stars"
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
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      const payload = String(query.invoice_payload || "");

      const tokenMatch = /^qa_token:(\d+)$/.exec(payload);
      if (tokenMatch) {
        const pack = await getQualityTokenPack(Number(tokenMatch[1]));
        const valid =
          pack &&
          query.currency === "XTR" &&
          Number(query.total_amount) === Number(pack.price_stars);

        await answerPreCheckoutQuery(
          token,
          query.id,
          Boolean(valid),
          valid
            ? undefined
            : "Pakiet tokenów jest niedostępny albo jego cena się zmieniła."
        );

        return res.status(200).json({ ok: true });
      }

      const planMatch = /^plan:([0-9a-f-]{36})$/i.exec(payload);

      if (!planMatch) {
        await answerPreCheckoutQuery(
          token,
          query.id,
          false,
          "Nieprawidłowy produkt."
        );
        return res.status(200).json({ ok: true });
      }

      const plan = await getPlan(planMatch[1]);
      const valid =
        plan &&
        plan.active &&
        query.currency === "XTR" &&
        Number(query.total_amount) === Number(plan.price_stars);

      await answerPreCheckoutQuery(
        token,
        query.id,
        Boolean(valid),
        valid ? undefined : "Plan jest niedostępny albo cena się zmieniła."
      );

      return res.status(200).json({ ok: true });
    }

    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const messageId = callback.message?.message_id;
      const action = callback.data || "home";

      await answerCallbackQuery(token, callback.id);

      if (!chatId || !messageId) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      if (action.startsWith("lang:")) {
        const locale = action.split(":")[1] === "en" ? "en" : "pl";
        await upsertTelegramUser(callback.from);
        await setUserLocale(callback.from.id, locale);
        const [profile, plans] = await Promise.all([
          getUserProfile(callback.from.id),
          listQualityPlans()
        ]);
        const view = qualityHome(locale, Boolean(profile?.is_admin), plans);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:language") {
        const view = languageMenu();
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:home") {
        const [profile, plans] = await Promise.all([
          getUserProfile(callback.from.id),
          listQualityPlans()
        ]);
        const locale = profile?.locale || "pl";
        const view = qualityHome(locale, Boolean(profile?.is_admin), plans);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:plans") {
        const profile = await getUserProfile(callback.from.id);
        const plans = await listQualityPlans();
        const view = renderQualityPlans(plans, profile?.locale || "pl");
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("qa:plan:")) {
        const profile = await getUserProfile(callback.from.id);
        const slug = action.split(":")[2];
        const [plan, products] = await Promise.all([
          getQualityPlan(slug),
          listQualityProducts(3)
        ]);
        if (!plan) {
          const view = qualityHome(profile?.locale || "pl", Boolean(profile?.is_admin));
          await editMessage(token, chatId, messageId, profile?.locale === "en" ? "Plan not found." : "Nie znaleziono planu.", view.reply_markup);
          return res.status(200).json({ ok: true });
        }
        const view = renderPlanDetails(plan, products, profile?.locale || "pl");
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:products" || action.startsWith("qa:products:tier:")) {
        const profile = await getUserProfile(callback.from.id);
        const tier = action.startsWith("qa:products:tier:")
          ? Number(action.split(":")[3])
          : null;
        const products = await listQualityProducts(tier || 3);
        const view = renderProducts(products, profile?.locale || "pl", tier);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("qa:product:")) {
        const profile = await getUserProfile(callback.from.id);
        const locale = profile?.locale || "pl";
        const slug = action.slice("qa:product:".length);
        const [product, membership] = await Promise.all([
          getQualityProduct(slug),
          getQualityMembership(callback.from.id)
        ]);

        if (!product) {
          const view = qualityHome(locale, Boolean(profile?.is_admin));
          await editMessage(
            token,
            chatId,
            messageId,
            locale === "en" ? "Product not found." : "Nie znaleziono produktu.",
            view.reply_markup
          );
          return res.status(200).json({ ok: true });
        }

        const tierRank = Number(membership?.quality_plans?.tier_rank || 0);
        const membershipActive =
          membership?.status === "active" &&
          (!membership?.period_end || new Date(membership.period_end) > new Date());

        const unlocked =
          membershipActive &&
          tierRank >= Number(product.minimum_tier_rank || 1);

        const downloadUrl =
          (unlocked || profile?.is_admin) &&
          (product.asset_path_pl || product.asset_path_en)
            ? qualityDownloadUrl(
                token,
                callback.from.id,
                product.slug,
                locale
              )
            : null;

        const view = renderProductDetail(product, locale, {
          unlocked,
          isAdmin: Boolean(profile?.is_admin),
          downloadUrl
        });

        await editMessage(
          token,
          chatId,
          messageId,
          view.text,
          view.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:training") {
        const profile = await getUserProfile(callback.from.id);
        const products = await listQualityProducts(3);
        const view = renderTraining(products, profile?.locale || "pl");
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:tokens") {
        const [profile, packs, wallet] = await Promise.all([
          getUserProfile(callback.from.id),
          listQualityTokenPacks(),
          getQualityWallet(callback.from.id)
        ]);
        const view = renderTokens(packs, profile?.locale || "pl", wallet);
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("qa:token:")) {
        const tokensToBuy = Number(action.split(":")[2]);
        const pack = await getQualityTokenPack(tokensToBuy);

        if (!pack) {
          const profile = await getUserProfile(callback.from.id);
          await editMessage(
            token,
            chatId,
            messageId,
            profile?.locale === "en"
              ? "This token pack is no longer available."
              : "Ten pakiet tokenów nie jest już dostępny.",
            {
              inline_keyboard: [[
                { text: profile?.locale === "en" ? "⬅️ Back" : "⬅️ Wróć", callback_data: "qa:tokens" }
              ]]
            }
          );
          return res.status(200).json({ ok: true });
        }

        await sendStarsTokenInvoice(token, chatId, pack);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:physical") {
        const profile = await getUserProfile(callback.from.id);
        const view = renderPhysicalProduct(
          profile?.locale || "pl",
          callback.from.id
        );
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:services") {
        const [profile, services] = await Promise.all([
          getUserProfile(callback.from.id),
          listQualityServices()
        ]);
        const view = renderExpertServices(
          services,
          profile?.locale || "pl",
          callback.from.id
        );
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:assistant") {
        const profile = await getUserProfile(callback.from.id);
        const view = renderAssistant(profile?.locale || "pl");
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "qa:membership") {
        const [profile, membership, wallet] = await Promise.all([
          getUserProfile(callback.from.id),
          getQualityMembership(callback.from.id),
          getQualityWallet(callback.from.id)
        ]);
        const view = renderMembership(
          membership,
          profile?.locale || "pl",
          wallet
        );
        await editMessage(token, chatId, messageId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      if (action === "home") {
        if (isDatabaseConfigured()) {
          await clearSession(callback.from.id);
          await upsertTelegramUser(callback.from);
        }

        const menu = getMainMenu();
        await editMessage(
          token,
          chatId,
          messageId,
          menu.text,
          menu.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      if (action === "plans") {
        const view = await renderCreatorPlans(callback.from);
        await editMessage(
          token,
          chatId,
          messageId,
          view.text,
          view.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      if (action === "communities") {
        const view = await renderCreatorCommunities(callback.from);
        await editMessage(
          token,
          chatId,
          messageId,
          view.text,
          view.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      if (action === "my_subscriptions") {
        const items = await getUserSubscriptions(callback.from.id);
        const view = renderSubscriptions(items);
        await editMessage(
          token,
          chatId,
          messageId,
          "<b>🧾 Moje subskrypcje</b>\n\n" + view.text,
          view.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("cancel_sub:") || action.startsWith("resume_sub:")) {
        const subscriptionId = action.split(":")[1];
        const subscription = await getSubscription(
          subscriptionId,
          callback.from.id
        );

        if (
          !subscription ||
          !subscription.is_recurring ||
          !subscription.telegram_subscription_charge_id
        ) {
          const items = await getUserSubscriptions(callback.from.id);
          const view = renderSubscriptions(items);
          await editMessage(
            token,
            chatId,
            messageId,
            "<b>🧾 Moje subskrypcje</b>\n\nNie znaleziono aktywnej subskrypcji.\n\n" + view.text,
            view.reply_markup
          );
          return res.status(200).json({ ok: true });
        }

        const isCancel = action.startsWith("cancel_sub:");

        await editUserStarSubscription(
          token,
          callback.from.id,
          subscription.telegram_subscription_charge_id,
          isCancel
        );

        await setSubscriptionAutoRenew(
          subscription.id,
          callback.from.id,
          !isCancel
        );

        const items = await getUserSubscriptions(callback.from.id);
        const view = renderSubscriptions(items);

        await editMessage(
          token,
          chatId,
          messageId,
          `<b>🧾 Moje subskrypcje</b>\n\n${isCancel ? "✅ Automatyczne odnowienie zostało wyłączone. Dostęp pozostaje aktywny do końca opłaconego okresu." : "✅ Automatyczne odnowienie zostało ponownie włączone."}\n\n${view.text}`,
          view.reply_markup
        );

        return res.status(200).json({ ok: true });
      }

      if (action === "customers") {
        const view = await renderCreatorCustomers(callback.from);
        await editMessage(
          token,
          chatId,
          messageId,
          view.text,
          view.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      if (action === "stats") {
        const view = await renderCreatorStats(callback.from);
        await editMessage(
          token,
          chatId,
          messageId,
          view.text,
          view.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      if (action === "community_add") {
        const creator = await ensureCreator(callback.from);
        await setSession(callback.from.id, "community_wait_forward", {
          creatorId: creator.id
        });

        await editMessage(
          token,
          chatId,
          messageId,
          "<b>➕ Dodaj kanał lub grupę</b>\n\n1. Dodaj tego bota jako administratora kanału/grupy.\n2. Daj mu prawo zapraszania użytkowników i blokowania/usuwania członków.\n3. Przekaż tutaj dowolną wiadomość z tego kanału lub grupy.\n\nWpisz /cancel, aby anulować.",
          {
            inline_keyboard: [
              [{ text: "✖️ Anuluj", callback_data: "home" }]
            ]
          }
        );

        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("plan_access:")) {
        const planId = action.split(":")[1];
        const view = await renderPlanAccess(callback.from, planId);

        await editMessage(
          token,
          chatId,
          messageId,
          view.text,
          view.reply_markup
        );

        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("pc:")) {
        const session = await getSession(callback.from.id);

        if (!session || session.state !== "plan_access" || !session.data?.planId) {
          const view = await renderCreatorPlans(callback.from);
          await editMessage(
            token,
            chatId,
            messageId,
            "Sesja przypisywania dostępu wygasła. Otwórz plan ponownie.\n\n" + view.text,
            view.reply_markup
          );
          return res.status(200).json({ ok: true });
        }

        const communityId = action.split(":")[1];
        const links = await getPlanCommunities(session.data.planId);
        const enabled = !(links || []).some(
          (item) => item.community_id === communityId
        );

        await setPlanCommunity(
          session.data.planId,
          communityId,
          enabled
        );

        const view = await renderPlanAccess(
          callback.from,
          session.data.planId
        );

        await editMessage(
          token,
          chatId,
          messageId,
          view.text,
          view.reply_markup
        );

        return res.status(200).json({ ok: true });
      }

      if (action === "plan_create") {
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

      if (action.startsWith("billing:")) {
        const session = await getSession(callback.from.id);

        if (!session || session.state !== "plan_billing") {
          const menu = getMainMenu();
          await editMessage(
            token,
            chatId,
            messageId,
            "Sesja tworzenia planu wygasła. Zacznij ponownie.",
            menu.reply_markup
          );
          return res.status(200).json({ ok: true });
        }

        const billingMode = action.split(":")[1];

        if (billingMode === "monthly") {
          const creator = await ensureCreator(callback.from);
          const plan = await createPlan(creator.id, {
            name: session.data.name,
            priceStars: session.data.priceStars,
            durationDays: 30,
            billingMode: "monthly"
          });

          await clearSession(callback.from.id);
          const plans = await listPlans(creator.id);
          const view = renderPlans(plans);

          await editMessage(
            token,
            chatId,
            messageId,
            `✅ Utworzono plan <b>${escapeHtml(plan.name)}</b>: ${planLabel(plan)}.\n\n${view.text}`,
            view.reply_markup
          );
          return res.status(200).json({ ok: true });
        }

        await setSession(callback.from.id, "plan_duration", {
          ...session.data,
          billingMode: "one_time"
        });

        await editMessage(
          token,
          chatId,
          messageId,
          "<b>Dostęp jednorazowy</b>\n\nWyślij teraz liczbę dni dostępu, np. <b>30</b>.\n\nWpisz /cancel, aby anulować.",
          {
            inline_keyboard: [
              [{ text: "✖️ Anuluj", callback_data: "home" }]
            ]
          }
        );

        return res.status(200).json({ ok: true });
      }

      if (action.startsWith("buy_plan:")) {
        const planId = action.split(":")[1];
        const plan = await getPlan(planId);

        if (!plan || !plan.active) {
          await editMessage(
            token,
            chatId,
            messageId,
            "Ten plan nie jest już dostępny.",
            {
              inline_keyboard: [
                [{ text: "⬅️ Menu", callback_data: "home" }]
              ]
            }
          );
          return res.status(200).json({ ok: true });
        }

        await sendStarsInvoice(token, chatId, plan);
        return res.status(200).json({ ok: true });
      }

      const section = getSectionMessage(action);
      await editMessage(
        token,
        chatId,
        messageId,
        section.text,
        section.reply_markup
      );
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || "";

    if (!chatId || !message?.from?.id) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    await upsertTelegramUser(message.from);

    if (message.successful_payment) {
      const payment = message.successful_payment;
      const payload = String(payment.invoice_payload || "");

      if (/^qa_token:\d+$/.test(payload)) {
        const result = await recordQualityTokenPayment(
          message.from,
          payment
        );

        const profile = await getUserProfile(message.from.id);
        const pl = (profile?.locale || "pl") !== "en";

        await sendMessage(
          token,
          chatId,
          pl
            ? `✅ Tokeny zostały dodane.\n\nDodano: <b>${result.tokens_added}</b>\nTwoje saldo: <b>${result.token_balance} tokenów</b>\n\nMożesz je wykorzystać na dodatkowe generowanie dokumentów po wykorzystaniu limitu pakietu.`
            : `✅ Tokens added.\n\nAdded: <b>${result.tokens_added}</b>\nYour balance: <b>${result.token_balance} tokens</b>\n\nYou can use them for extra document generation after your plan allowance is used.`,
          {
            inline_keyboard: [[
              { text: pl ? "🪙 Portfel tokenów" : "🪙 Token wallet", callback_data: "qa:tokens" }
            ]]
          }
        );

        return res.status(200).json({ ok: true });
      }

      const result = await recordSuccessfulPayment(
        message.from,
        payment
      );

      const accessButtons = await grantPlanAccess(
        token,
        message.from.id,
        result.plan.id
      );

      await sendMessage(
        token,
        chatId,
        `✅ Płatność przyjęta.\n\nPlan: <b>${escapeHtml(result.plan.name)}</b>\nDostęp aktywny do: <b>${new Date(result.subscription.ends_at).toLocaleDateString("pl-PL")}</b>` +
          (accessButtons.length
            ? "\n\nPoniżej masz prywatne linki dostępu. Każdy link wygasa po godzinie i jest przeznaczony dla jednej osoby."
            : "\n\nDo tego planu nie przypisano jeszcze kanału ani grupy."),
        accessButtons.length
          ? { inline_keyboard: accessButtons }
          : undefined
      );

      return res.status(200).json({ ok: true });
    }

    if (/^\/start\s+tokens$/i.test(text)) {
      const [profile, packs, wallet] = await Promise.all([
        getUserProfile(message.from.id),
        listQualityTokenPacks(),
        getQualityWallet(message.from.id)
      ]);
      const view = renderTokens(packs, profile?.locale || "pl", wallet);
      await sendMessage(token, chatId, view.text, view.reply_markup);
      return res.status(200).json({ ok: true });
    }

    if (/^\/start\s+physical$/i.test(text)) {
      const profile = await getUserProfile(message.from.id);
      const view = renderPhysicalProduct(
        profile?.locale || "pl",
        message.from.id
      );
      await sendMessage(token, chatId, view.text, view.reply_markup);
      return res.status(200).json({ ok: true });
    }

    const startMatch = /^\/start(?:\s+plan_([0-9a-f-]{36}))?$/i.exec(text);

    if (startMatch?.[1]) {
      const plan = await getPlan(startMatch[1]);

      if (!plan || !plan.active) {
        await sendMessage(token, chatId, "Ten plan nie jest już dostępny.");
        return res.status(200).json({ ok: true });
      }

      const checkout = renderPlanCheckout(plan);
      await sendMessage(
        token,
        chatId,
        checkout.text,
        checkout.reply_markup
      );
      return res.status(200).json({ ok: true });
    }

    const session = await getSession(message.from.id);

    if (session?.state === "community_wait_forward") {
      if (text === "/cancel") {
        await clearSession(message.from.id);
        const menu = getMainMenu();
        await sendMessage(
          token,
          chatId,
          "Anulowano dodawanie kanału lub grupy.",
          menu.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      const forwardedChat = getForwardedChat(message);

      if (!forwardedChat?.id || !["channel", "group", "supergroup"].includes(forwardedChat.type)) {
        await sendMessage(
          token,
          chatId,
          "Przekaż tutaj wiadomość bezpośrednio z kanału albo grupy, którą chcesz podpiąć. Wpisz /cancel, aby anulować."
        );
        return res.status(200).json({ ok: true });
      }

      const me = await getMe(token);
      const botMembership = await getChatMember(
        token,
        forwardedChat.id,
        me.id
      );

      const isCreator = botMembership?.status === "creator";
      const isAdmin = botMembership?.status === "administrator";
      const canInvite = isCreator || Boolean(botMembership?.can_invite_users);
      const canRestrict =
        isCreator || Boolean(botMembership?.can_restrict_members);

      if (!(isCreator || isAdmin) || !canInvite || !canRestrict) {
        await sendMessage(
          token,
          chatId,
          "Bot jest w tym miejscu, ale nie ma wszystkich wymaganych uprawnień administratora. Włącz mu zapraszanie użytkowników oraz blokowanie/usuwanie członków i przekaż wiadomość ponownie."
        );
        return res.status(200).json({ ok: true });
      }

      const creator = await ensureCreator(message.from);

      await createCommunity(creator.id, {
        telegramChatId: forwardedChat.id,
        title: forwardedChat.title || "Kanał / grupa",
        chatType: forwardedChat.type
      });

      await clearSession(message.from.id);

      const view = await renderCreatorCommunities(message.from);
      await sendMessage(
        token,
        chatId,
        "✅ Kanał/grupa została podpięta."
      );
      await sendMessage(token, chatId, view.text, view.reply_markup);

      return res.status(200).json({ ok: true });
    }

    if (session) {
      const handled = await handlePlanWizard(token, message, session);
      if (handled) {
        return res.status(200).json({ ok: true });
      }
    }

    if (text === "/mysubscriptions") {
      const items = await getUserSubscriptions(message.from.id);
      const view = renderSubscriptions(items);
      await sendMessage(
        token,
        chatId,
        "<b>🧾 Moje subskrypcje</b>\n\n" + view.text,
        view.reply_markup
      );
      return res.status(200).json({ ok: true });
    }

    if (text === "/paysupport") {
      await sendMessage(
        token,
        chatId,
        "<b>Pomoc dotycząca płatności</b>\n\nOpisz problem z płatnością i zachowaj wiadomość potwierdzającą zakup z Telegrama. W kolejnej wersji dodamy automatyczne zgłoszenia i refundy."
      );
      return res.status(200).json({ ok: true });
    }

    if (text === "/admin") {
      const profile = await getUserProfile(message.from.id);
      if (!profile?.is_admin) {
        const locale = profile?.locale || "pl";
        const view = qualityHome(locale, false);
        await sendMessage(
          token,
          chatId,
          locale === "en" ? "This area is available to the owner only." : "Ten obszar jest dostępny tylko dla właściciela.",
          view.reply_markup
        );
        return res.status(200).json({ ok: true });
      }

      const menu = getMainMenu();
      await sendMessage(token, chatId, menu.text, menu.reply_markup);
      return res.status(200).json({ ok: true });
    }

    if (text === "/language") {
      const view = languageMenu();
      await sendMessage(token, chatId, view.text, view.reply_markup);
      return res.status(200).json({ ok: true });
    }

    if (text === "/start" || text === "/menu" || text === "") {
      const profile = await getUserProfile(message.from.id);

      if (!profile?.locale) {
        const view = languageMenu();
        await sendMessage(token, chatId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }

      const plans = await listQualityPlans();
      const view = qualityHome(
        profile.locale,
        Boolean(profile.is_admin),
        plans
      );
      await sendMessage(token, chatId, view.text, view.reply_markup);
      return res.status(200).json({ ok: true });
    }

    const profile = await getUserProfile(message.from.id);
    const locale = profile?.locale || "pl";
    const view = qualityHome(locale, Boolean(profile?.is_admin));

    await sendMessage(
      token,
      chatId,
      locale === "en"
        ? "Use the buttons below. Type /menu to return to Quality Assurance Support."
        : "Użyj przycisków poniżej. Wpisz /menu, aby wrócić do Quality Assurance Support.",
      view.reply_markup
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("telegram_webhook_error", error);
    return res.status(200).json({ ok: true, handledWithError: true });
  }
}
