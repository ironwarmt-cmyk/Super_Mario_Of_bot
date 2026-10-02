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

export function qualityHome(locale = "pl", isAdmin = false) {
  const pl = locale !== "en";
  const text = pl
    ? "<b>QUALITY ASSURANCE SUPPORT</b>\n\nDwujęzyczna społeczność dla osób zarządzających jakością i bezpieczeństwem żywności. Dokumenty, procedury, analiza zagrożeń, szkolenia, biblioteka wdrożeniowa i asystent do pracy z systemem."
    : "<b>QUALITY ASSURANCE SUPPORT</b>\n\nA bilingual community for food quality and safety professionals. Procedures, hazard analysis, training, implementation library and an assistant for day-to-day system work.";

  const rows = [
    [
      { text: pl ? "💎 Plany" : "💎 Plans", callback_data: "qa:plans" },
      { text: pl ? "📚 Produkty" : "📚 Products", callback_data: "qa:products" }
    ],
    [
      { text: pl ? "🤖 Asystent" : "🤖 Assistant", callback_data: "qa:assistant" },
      { text: pl ? "🪙 Tokeny" : "🪙 Tokens", callback_data: "qa:tokens" }
    ],
    [
      { text: pl ? "🎓 Szkolenia" : "🎓 Training", callback_data: "qa:training" },
      { text: pl ? "🧾 Mój dostęp" : "🧾 My access", callback_data: "qa:membership" }
    ],
    [
      { text: pl ? "🌐 Zmień język" : "🌐 Change language", callback_data: "qa:language" }
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

  const rows = filtered.slice(0, 25).map((p) => {
    const name = pl ? p.name_pl : p.name_en;
    const d = pl ? p.short_description_pl : p.short_description_en;
    const tierName = Number(p.minimum_tier_rank) === 1 ? "BASIC" : Number(p.minimum_tier_rank) === 2 ? "PRO" : "VIP";
    return `<b>${esc(name)}</b> [${tierName}]\n${esc(d)}`;
  });

  return {
    text:
      (pl ? "<b>BIBLIOTEKA PRODUKTÓW</b>\n\n" : "<b>PRODUCT LIBRARY</b>\n\n") +
      (rows.length ? rows.join("\n\n") : (pl ? "Brak produktów." : "No products.")),
    reply_markup: {
      inline_keyboard: [
        [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]
      ]
    }
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

export function renderTokens(packs = [], locale = "pl") {
  const pl = locale !== "en";
  const lines = packs.map(
    (p) => `• <b>${p.tokens} tokenów</b> — ${Number(p.reference_price_pln).toFixed(2).replace(".", ",")} zł`
  );

  return {
    text:
      (pl ? "<b>TOKENY DODATKOWE</b>\n\n" : "<b>EXTRA TOKENS</b>\n\n") +
      (pl
        ? "Przelicznik referencyjny: 35 tokenów = 10,00 zł. Wygenerowanie jednego dedykowanego dokumentu po wyczerpaniu limitu pakietu kosztuje 35 tokenów. Pakiety mniejsze niż 35 tokenów można kumulować.\n\n"
        : "Reference conversion: 35 tokens = PLN 10.00. One tailored document after the monthly allowance is exhausted costs 35 tokens. Packs below 35 tokens can be accumulated.\n\n") +
      lines.join("\n"),
    reply_markup: {
      inline_keyboard: [[{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]]
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
