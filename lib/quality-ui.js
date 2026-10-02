function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function languageMenu() {
  return {
    text:
      "<b>Quality Assurance Support</b>\n\n" +
      "Wybierz język / Choose your language:",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇵🇱 Polski", callback_data: "lang:pl" },
          { text: "🇬🇧 English", callback_data: "lang:en" }
        ]
      ]
    }
  };
}

export function qualityHome(locale = "pl", isAdmin = false, plans = []) {
  const pl = locale !== "en";
  const bySlug = new Map((plans || []).map((p) => [p.slug, p]));
  const fmt = (slug, fallback) => {
    const value = bySlug.get(slug)?.display_price_pln;
    const amount = value == null ? fallback : Number(value);
    return Number(amount).toFixed(2).replace(".", ",") + " zł";
  };

  const text = pl
    ? "<b>QUALITY ASSURANCE SUPPORT</b>\n\n" +
      "<b>Twoje centrum zarządzania jakością i bezpieczeństwem żywności.</b>\n\n" +
      "W jednym miejscu dostajesz gotowe do edycji procedury i instrukcje, analizę zagrożeń, bibliotekę wdrożeniową, szkolenia, narzędzia do przygotowania dokumentacji firmowej oraz asystenta Quality. Materiały są dostępne po polsku i angielsku.\n\n" +
      "<b>PLANY:</b>\n" +
      `🔹 BASIC — <b>${fmt("basic", 49.99)}/mies.</b> — fundament dokumentacji, analiza zagrożeń, procedury i 1 szkolenie.\n` +
      `🔷 PRO — <b>${fmt("pro", 149.99)}/mies.</b> — wszystko z BASIC + rozbudowana biblioteka i 5 dokumentów dedykowanych/mies.\n` +
      `💠 VIP — <b>${fmt("vip", 399.99)}/mies.</b> — wszystko z PRO + pełny szkielet systemu, 30 dokumentów i 30 h asystenta/mies.\n\n` +
      "<b>DODATKOWO:</b>\n" +
      "🪙 kupujesz tokeny bezpośrednio na swoje saldo; 35 tokenów = 1 dodatkowy dokument po wykorzystaniu limitu.\n" +
      "📦 możesz zamówić fizyczny, drukowany segregator dokumentacji z dostawą — płatność BLIK lub kartą.\n\n" +
      "Wybierz poniżej dokładnie to, czego potrzebujesz."
    : "<b>QUALITY ASSURANCE SUPPORT</b>\n\n" +
      "<b>Your food quality and safety management hub.</b>\n\n" +
      "One place for editable procedures and work instructions, hazard analysis, implementation libraries, training, company-document tools and the Quality Assistant. Content is available in Polish and English.\n\n" +
      "<b>PLANS:</b>\n" +
      `🔹 BASIC — <b>${fmt("basic", 49.99)}/month</b> — documentation foundation, hazard analysis, procedures and 1 training choice.\n` +
      `🔷 PRO — <b>${fmt("pro", 149.99)}/month</b> — everything in BASIC + expanded library and 5 tailored documents/month.\n` +
      `💠 VIP — <b>${fmt("vip", 399.99)}/month</b> — everything in PRO + complete framework, 30 documents and 30 assistant hours/month.\n\n` +
      "<b>EXTRAS:</b>\n" +
      "🪙 buy tokens directly into your account balance; 35 tokens = 1 extra document after your allowance is used.\n" +
      "📦 order a physical printed documentation binder delivered to you — BLIK or card checkout.\n\n" +
      "Choose what you need below.";

  const rows = [
    [
      { text: pl ? "💎 Plany i ceny" : "💎 Plans & pricing", callback_data: "qa:plans" },
      { text: pl ? "📚 Biblioteka" : "📚 Library", callback_data: "qa:products" }
    ],
    [
      { text: pl ? "🪙 Kup tokeny" : "🪙 Buy tokens", callback_data: "qa:tokens" },
      { text: pl ? "📦 Segregator fizyczny" : "📦 Printed binder", callback_data: "qa:physical" }
    ],
    [
      { text: pl ? "🤖 Asystent Quality" : "🤖 Quality Assistant", callback_data: "qa:assistant" },
      { text: pl ? "🎓 Szkolenia" : "🎓 Training", callback_data: "qa:training" }
    ],
    [
      { text: pl ? "🧾 Mój dostęp i saldo" : "🧾 My access & balance", callback_data: "qa:membership" },
      { text: pl ? "🌐 PL / EN" : "🌐 PL / EN", callback_data: "qa:language" }
    ],
    [
      {
        text: pl ? "🖥 Otwórz Quality Hub" : "🖥 Open Quality Hub",
        web_app: { url: "https://supermarioofbot-iron-war.vercel.app/quality/" }
      }
    ]
  ];

  if (isAdmin) {
    rows.push([
      { text: pl ? "⚙️ Panel właściciela" : "⚙️ Owner panel", callback_data: "home" }
    ]);
  }

  return {
    text,
    reply_markup: { inline_keyboard: rows }
  };
}

export function renderQualityPlans(plans = [], locale = "pl") {
  const pl = locale !== "en";

  const blocks = plans.map((plan) => {
    const name = pl ? plan.name_pl : plan.name_en;
    const tagline = pl ? plan.tagline_pl : plan.tagline_en;
    const desc = pl ? plan.description_pl : plan.description_en;
    const price =
      plan.display_price_pln == null
        ? (pl ? "cena do ustalenia" : "price to be confirmed")
        : `${Number(plan.display_price_pln).toFixed(2).replace(".", ",")} zł / ${pl ? "mies." : "month"}`;

    const extras = [];
    if (plan.included_custom_docs > 0) {
      extras.push(
        pl
          ? `${plan.included_custom_docs} dedykowanych dokumentów / miesiąc`
          : `${plan.included_custom_docs} tailored documents / month`
      );
    }
    if (plan.included_chat_minutes > 0) {
      extras.push(
        pl
          ? `${Math.round(plan.included_chat_minutes / 60)} h asystenta / miesiąc`
          : `${Math.round(plan.included_chat_minutes / 60)} assistant hours / month`
      );
    }

    return (
      `<b>${esc(name)}</b> — <b>${price}</b>\n` +
      `<i>${esc(tagline)}</i>\n` +
      `${esc(desc)}` +
      (extras.length ? `\n• ${extras.map(esc).join("\n• ")}` : "")
    );
  });

  const buttons = plans.map((plan) => [
    {
      text: `${plan.name_pl === "BASIC" ? "🔹" : plan.name_pl === "PRO" ? "🔷" : "💠"} ${pl ? plan.name_pl : plan.name_en}`,
      callback_data: `qa:plan:${plan.slug}`
    }
  ]);

  return {
    text:
      (pl ? "<b>PLANY</b>\n\n" : "<b>PLANS</b>\n\n") +
      blocks.join("\n\n"),
    reply_markup: {
      inline_keyboard: [
        ...buttons,
        [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]
      ]
    }
  };
}

export function renderPlanDetails(plan, products = [], locale = "pl") {
  const pl = locale !== "en";
  const name = pl ? plan.name_pl : plan.name_en;
  const desc = pl ? plan.description_pl : plan.description_en;
  const price =
    plan.display_price_pln == null
      ? (pl ? "Cena zostanie ustalona przed aktywacją płatności." : "Price will be confirmed before checkout is activated.")
      : `${Number(plan.display_price_pln).toFixed(2).replace(".", ",")} zł / ${pl ? "miesiąc" : "month"}`;

  const items = products
    .filter((p) => Number(p.minimum_tier_rank) <= Number(plan.tier_rank))
    .slice(0, 18)
    .map((p) => `• ${esc(pl ? p.name_pl : p.name_en)}`);

  const note = pl
    ? "Płatność nie jest jeszcze aktywowana. Dla cyfrowych produktów sprzedawanych wewnątrz Telegrama checkout musi być zgodny z zasadami platformy."
    : "Checkout is not active yet. Digital products sold inside Telegram must use a payment flow compliant with Telegram platform rules.";

  return {
    text:
      `<b>${esc(name)}</b>\n\n` +
      `${esc(desc)}\n\n` +
      `<b>${esc(price)}</b>\n\n` +
      (items.length ? `${pl ? "<b>W pakiecie:</b>" : "<b>Included:</b>"}\n${items.join("\n")}\n\n` : "") +
      `<i>${esc(note)}</i>`,
    reply_markup: {
      inline_keyboard: [
        [{ text: pl ? "📚 Zobacz bibliotekę" : "📚 View library", callback_data: `qa:products:tier:${plan.tier_rank}` }],
        [{ text: pl ? "⬅️ Plany" : "⬅️ Plans", callback_data: "qa:plans" }]
      ]
    }
  };
}

export function renderProducts(products = [], locale = "pl", tier = null) {
  const pl = locale !== "en";
  const filtered = tier
    ? products.filter((p) => Number(p.minimum_tier_rank) <= Number(tier))
    : products;

  const rows = filtered.slice(0, 12).map((p) => {
    const name = pl ? p.name_pl : p.name_en;
    const d = pl ? p.short_description_pl : p.short_description_en;
    const tierName = Number(p.minimum_tier_rank) === 1 ? "BASIC" : Number(p.minimum_tier_rank) === 2 ? "PRO" : "VIP";
    return `<b>${esc(name)}</b> [${tierName}]\n${esc(d)}`;
  });

  const buttons = filtered.slice(0, 12).map((p) => [
    {
      text: `📄 ${(pl ? p.name_pl : p.name_en).slice(0, 48)}`,
      callback_data: `qa:product:${p.slug}`
    }
  ]);

  return {
    text:
      (pl ? "<b>BIBLIOTEKA PRODUKTÓW</b>\n\n" : "<b>PRODUCT LIBRARY</b>\n\n") +
      (rows.length ? rows.join("\n\n") : (pl ? "Brak produktów." : "No products.")),
    reply_markup: {
      inline_keyboard: [
        ...buttons,
        [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]
      ]
    }
  };
}

export function renderProductDetail(product, locale = "pl", access = {}) {
  const pl = locale !== "en";
  const name = pl ? product.name_pl : product.name_en;
  const desc = pl ? product.short_description_pl : product.short_description_en;
  const tierName = Number(product.minimum_tier_rank) === 1 ? "BASIC" : Number(product.minimum_tier_rank) === 2 ? "PRO" : "VIP";
  const unlocked = Boolean(access.unlocked);
  const isAdmin = Boolean(access.isAdmin);

  const status = unlocked || isAdmin
    ? (pl ? "✅ Dostęp aktywny" : "✅ Access active")
    : (pl ? `🔒 Wymagany pakiet: ${tierName}` : `🔒 Required plan: ${tierName}`);

  const buttons = [];

  if ((unlocked || isAdmin) && access.downloadUrl && (product.asset_path_pl || product.asset_path_en)) {
    buttons.push([
      {
        text: pl ? "⬇️ Pobierz edytowalny dokument" : "⬇️ Download editable document",
        url: access.downloadUrl
      }
    ]);
  }

  if (!unlocked && !isAdmin) {
    buttons.push([
      { text: pl ? "💎 Zobacz plany" : "💎 View plans", callback_data: "qa:plans" }
    ]);
  }

  buttons.push([
    { text: pl ? "⬅️ Biblioteka" : "⬅️ Library", callback_data: "qa:products" }
  ]);

  return {
    text:
      `<b>${esc(name)}</b>\n\n` +
      `${esc(desc)}\n\n` +
      `${status}\n` +
      (product.token_cost > 0
        ? `\n${pl ? "Koszt po wykorzystaniu limitu" : "Cost after allowance"}: <b>${product.token_cost} ${pl ? "tokenów" : "tokens"}</b>`
        : ""),
    reply_markup: { inline_keyboard: buttons }
  };
}

export function renderTraining(products = [], locale = "pl") {
  const pl = locale !== "en";
  const training = products.filter((p) => p.product_type === "training");
  return {
    text:
      (pl ? "<b>SZKOLENIA</b>\n\nW BASIC wybierasz jedno szkolenie. Wyższe pakiety zachowują dostęp do biblioteki szkoleniowej.\n\n" : "<b>TRAINING</b>\n\nBASIC includes one training choice. Higher plans retain access to the training library.\n\n") +
      training.map((p) => `• <b>${esc(pl ? p.name_pl : p.name_en)}</b>\n${esc(pl ? p.short_description_pl : p.short_description_en)}`).join("\n\n"),
    reply_markup: {
      inline_keyboard: [[{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]]
    }
  };
}

export function renderTokens(packs = [], locale = "pl", wallet = null) {
  const pl = locale !== "en";
  const balance = Number(wallet?.token_balance || 0);

  const lines = packs.map((p) => {
    const refPrice = Number(p.reference_price_pln).toFixed(2).replace(".", ",");
    return `• <b>${p.tokens} tokenów</b> — ${p.price_stars} ⭐ <i>(wartość referencyjna ${refPrice} zł)</i>`;
  });

  const buttons = packs.map((p) => [
    {
      text: pl
        ? `⭐ Kup ${p.tokens} tokenów za ${p.price_stars} Stars`
        : `⭐ Buy ${p.tokens} tokens for ${p.price_stars} Stars`,
      callback_data: `qa:token:${p.tokens}`
    }
  ]);

  return {
    text:
      (pl ? "<b>PORTFEL TOKENÓW</b>\n\n" : "<b>TOKEN WALLET</b>\n\n") +
      (pl
        ? `Twoje saldo: <b>${balance} tokenów</b>\n\n35 tokenów = 10,00 zł wartości referencyjnej i 35 tokenów kosztuje wygenerowanie jednego dodatkowego dokumentu po wykorzystaniu limitu pakietu. Tokeny cyfrowe kupujesz bezpośrednio w Telegramie przez Stars i są dopisywane automatycznie do konta.\n\n`
        : `Your balance: <b>${balance} tokens</b>\n\n35 tokens = PLN 10.00 reference value and one extra tailored document costs 35 tokens after the plan allowance is used. Digital tokens are purchased directly in Telegram with Stars and credited automatically.\n\n`) +
      lines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        ...buttons,
        [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]
      ]
    }
  };
}

export function renderPhysicalProduct(locale = "pl", telegramUserId = null) {
  const pl = locale !== "en";
  const baseUrl = "https://buy.stripe.com/cNi6oG4Kd97Q7Qy5ymdby06";
  const ref = telegramUserId ? `tg_${telegramUserId}` : "telegram";
  const checkout =
    baseUrl +
    "?client_reference_id=" +
    encodeURIComponent(ref) +
    "&utm_source=telegram&utm_medium=bot&utm_campaign=physical_binder";

  return {
    text: pl
      ? "<b>📦 FIZYCZNY SEGREGATOR DOKUMENTACJI</b>\n\n" +
        "Cena: <b>1 499,00 zł</b> jednorazowo.\n\n" +
        "Otrzymujesz fizyczny, drukowany segregator Quality Assurance Support przygotowany do wysyłki na wskazany adres w Polsce. Checkout zbiera dane odbiorcy i adres dostawy.\n\n" +
        "<b>Płatność:</b> BLIK lub karta.\n\n" +
        "To jest produkt materialny. Zakup segregatora nie uruchamia cyfrowej subskrypcji, nie dodaje tokenów i nie zastępuje pakietu BASIC/PRO/VIP."
      : "<b>📦 PRINTED DOCUMENTATION BINDER</b>\n\n" +
        "Price: <b>PLN 1,499.00</b> one-time.\n\n" +
        "You receive a physical printed Quality Assurance Support binder shipped to your address in Poland. Checkout collects recipient and shipping details.\n\n" +
        "<b>Payment:</b> BLIK or card.\n\n" +
        "This is a physical product. It does not activate a digital subscription, add tokens or replace BASIC/PRO/VIP access.",
    reply_markup: {
      inline_keyboard: [
        [{ text: pl ? "💳 Kup — BLIK / karta" : "💳 Buy — BLIK / card", url: checkout }],
        [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]
      ]
    }
  };
}

export function renderAssistant(locale = "pl") {
  const pl = locale !== "en";
  return {
    text: pl
      ? "<b>ASYSTENT QUALITY</b>\n\nVIP obejmuje 30 godzin rozmowy z asystentem w każdym miesięcznym okresie. Asystent ma pomagać w tworzeniu i przeglądzie dokumentów, analizie problemów jakościowych, CAPA, analizie zagrożeń i przygotowaniu do audytów. Po wyczerpaniu limitu system kieruje do dokupienia dodatkowego czasu lub tokenów."
      : "<b>QUALITY ASSISTANT</b>\n\nVIP includes 30 hours of assistant access per monthly period. The assistant supports document drafting and review, quality issue analysis, CAPA, hazard analysis and audit preparation. When the allowance is exhausted, the system redirects the user to additional time or token options.",
    reply_markup: {
      inline_keyboard: [[{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]]
    }
  };
}

export function renderMembership(membership, locale = "pl") {
  const pl = locale !== "en";
  if (!membership) {
    return {
      text: pl
        ? "<b>MÓJ DOSTĘP</b>\n\nNie masz jeszcze aktywnego pakietu."
        : "<b>MY ACCESS</b>\n\nYou do not have an active plan yet.",
      reply_markup: {
        inline_keyboard: [
          [{ text: pl ? "💎 Zobacz plany" : "💎 View plans", callback_data: "qa:plans" }],
          [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]
        ]
      }
    };
  }

  const plan = membership.quality_plans || {};
  const docsLeft = Math.max(0, Number(plan.included_custom_docs || 0) - Number(membership.custom_docs_used || 0));
  const minutesLeft = Math.max(0, Number(plan.included_chat_minutes || 0) - Number(membership.chat_minutes_used || 0));

  return {
    text:
      (pl ? "<b>MÓJ DOSTĘP</b>\n\n" : "<b>MY ACCESS</b>\n\n") +
      `Plan: <b>${esc(pl ? plan.name_pl : plan.name_en)}</b>\n` +
      `${pl ? "Dokumenty pozostałe" : "Documents remaining"}: <b>${docsLeft}</b>\n` +
      `${pl ? "Czas asystenta pozostały" : "Assistant time remaining"}: <b>${Math.floor(minutesLeft / 60)} h ${minutesLeft % 60} min</b>\n` +
      `${pl ? "Saldo tokenów" : "Token balance"}: <b>${membership.token_balance || 0}</b>`,
    reply_markup: {
      inline_keyboard: [[{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]]
    }
  };
}
