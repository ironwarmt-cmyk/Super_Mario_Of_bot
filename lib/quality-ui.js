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
    ? "<b>QUALITY ASSURANCE SUPPORT</b>\n\n" +
      "Profesjonalne centrum pracy dla osób odpowiedzialnych za jakość i bezpieczeństwo żywności. Po wejściu masz od razu dostęp do opisu planów, biblioteki dokumentów, szkoleń, asystenta, salda tokenów i swojego pakietu.\n\n" +
      "<b>Co możesz tu zrobić:</b>\n" +
      "• korzystać z edytowalnych procedur, instrukcji i analiz zagrożeń\n" +
      "• rozwijać pełną dokumentację zakładu\n" +
      "• generować dedykowane dokumenty dla firmy\n" +
      "• korzystać ze szkoleń i asystenta Quality\n" +
      "• dokupować tokeny do funkcji cyfrowych\n" +
      "• zamówić fizyczny, drukowany pakiet dokumentacji\n\n" +
      "<b>Plany:</b> BASIC 49,99 zł/mies. · PRO 149,99 zł/mies. · VIP 399,99 zł/mies."
    : "<b>QUALITY ASSURANCE SUPPORT</b>\n\n" +
      "A professional working hub for food quality and safety professionals. From the first screen you can see plans, the document library, training, assistant access, token balance and your current package.\n\n" +
      "<b>What you can do here:</b>\n" +
      "• use editable procedures, instructions and hazard-analysis templates\n" +
      "• build a complete site documentation system\n" +
      "• generate company-specific documents\n" +
      "• use training and the Quality assistant\n" +
      "• buy extra tokens for digital features\n" +
      "• order a physical printed documentation pack\n\n" +
      "<b>Plans:</b> BASIC PLN 49.99/mo · PRO PLN 149.99/mo · VIP PLN 399.99/mo";

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
      { text: pl ? "📦 Dokument drukowany" : "📦 Printed documentation", callback_data: "qa:physical" }
    ],
    [
      { text: pl ? "🌐 Zmień język" : "🌐 Change language", callback_data: "qa:language" }
    ],
    [
      {
        text: pl ? "🖥 Zobacz prezentację" : "🖥 View presentation",
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

  const lines = packs.map(
    (p) =>
      `• <b>${p.tokens} ${pl ? "tokenów" : "tokens"}</b> — ` +
      `${Number(p.reference_price_pln).toFixed(2).replace(".", ",")} zł ` +
      `(${p.price_stars} ⭐)`
  );

  const buttons = packs.map((p) => [
    {
      text: `⭐ ${pl ? "Kup" : "Buy"} ${p.tokens} ${pl ? "tokenów" : "tokens"} — ${p.price_stars} ⭐`,
      callback_data: `qa:buy_tokens:${p.id}`
    }
  ]);

  return {
    text:
      (pl ? "<b>TOKENY DODATKOWE</b>\n\n" : "<b>EXTRA TOKENS</b>\n\n") +
      `${pl ? "Twoje saldo" : "Your balance"}: <b>${balance} 🪙</b>\n\n` +
      (pl
        ? "Przelicznik wartości wewnętrznej: 35 tokenów = 10,00 zł. Jeden dedykowany dokument po wyczerpaniu limitu pakietu kosztuje 35 tokenów. Zakup cyfrowych tokenów w Telegramie jest rozliczany w Telegram Stars.\n\n"
        : "Internal reference value: 35 tokens = PLN 10.00. One tailored document after the monthly allowance is exhausted costs 35 tokens. Digital token purchases inside Telegram are settled in Telegram Stars.\n\n") +
      lines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        ...buttons,
        [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]
      ]
    }
  };
}

export function renderPhysicalProduct(product, locale = "pl", checkoutUrl = null) {
  const pl = locale !== "en";
  if (!product) {
    return {
      text: pl ? "Produkt fizyczny jest obecnie niedostępny." : "The physical product is currently unavailable.",
      reply_markup: {
        inline_keyboard: [[{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]]
      }
    };
  }

  const name = pl ? product.name_pl : product.name_en;
  const description = pl ? product.description_pl : product.description_en;
  const price = Number(product.price_pln).toFixed(2).replace(".", ",");
  const stockText = product.stock == null
    ? ""
    : (pl ? `\nDostępność: <b>${product.stock} szt.</b>` : `\nAvailability: <b>${product.stock}</b>`);

  const buttons = [];
  if (checkoutUrl) {
    buttons.push([
      {
        text: pl ? "💳 Kup — BLIK / karta / przelew" : "💳 Buy — BLIK / card / bank payment",
        url: checkoutUrl
      }
    ]);
  }

  buttons.push([{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]);

  return {
    text:
      `<b>📦 ${esc(name)}</b>\n\n` +
      `${esc(description)}\n\n` +
      `<b>${price} zł</b>${stockText}\n\n` +
      (pl
        ? "To jest realny produkt fizyczny wysyłany na podany adres. Zakup nie stanowi obejścia płatności za treści cyfrowe i sam w sobie nie odblokowuje cyfrowej subskrypcji."
        : "This is a real physical product shipped to the delivery address. It is not a workaround for digital payments and does not by itself unlock a digital subscription."),
    reply_markup: { inline_keyboard: buttons }
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
      `${pl ? "Saldo tokenów" : "Token balance"}: <b>${walletBalance} 🪙</b>`,
    reply_markup: {
      inline_keyboard: [[{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]]
    }
  };
}
