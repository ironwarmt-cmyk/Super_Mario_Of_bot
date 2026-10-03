function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pricePln(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")} zł`;
}

function productPriceLabel(product, locale = "pl") {
  const pl = locale !== "en";
  const stars = Number(product.standalone_price_stars || 0);
  const pln = Number(product.standalone_price_pln || 0);
  if (!stars || !pln) return null;
  return pl ? `${pricePln(pln)} / ${stars} Stars` : `PLN ${pln.toFixed(2)} / ${stars} Stars`;
}

export function languageMenu() {
  return {
    text: "<b>Quality Assurance Support</b>\n\nWybierz język / Choose your language:",
    reply_markup: {
      inline_keyboard: [[
        { text: "🇵🇱 Polski", callback_data: "lang:pl" },
        { text: "🇬🇧 English", callback_data: "lang:en" }
      ]]
    }
  };
}

export function qualityHome(locale = "pl", isAdmin = false, plans = []) {
  const pl = locale !== "en";
  const bySlug = new Map((plans || []).map((p) => [p.slug, p]));
  const fmt = (slug, fallback) => pricePln(bySlug.get(slug)?.display_price_pln ?? fallback);

  const text = pl
    ? "<b>QUALITY ASSURANCE SUPPORT</b>\n\n" +
      "<b>Centrum zarządzania jakością i bezpieczeństwem żywności.</b>\n\n" +
      "Dostajesz dokumenty nadzorowane, e-booki, szkolenia z prezentacjami, analizę zagrożeń, bibliotekę wdrożeniową, tokeny, produkty pojedyncze oraz Quality Copilot.\n\n" +
      "<b>PLANY:</b>\n" +
      `🔹 BASIC — <b>${fmt("basic", 49.99)}/mies.</b> — fundament systemu, dokumenty, e-book BASIC i 1 szkolenie.\n` +
      `🔷 PRO — <b>${fmt("pro", 149.99)}/mies.</b> — BASIC + rozbudowana biblioteka, e-book PRO i 5 dokumentów dedykowanych.\n` +
      `💠 VIP — <b>${fmt("vip", 399.99)}/mies.</b> — PRO + playbook VIP, 30 dokumentów i 30 h Quality Copilot.\n\n` +
      "<b>POJEDYNCZO:</b> dokument 50 zł / 175 Stars, szkolenie 500 zł / 1750 Stars.\n\n<b>SUPPORT:</b> problem, płatność, treść lub pomysł możesz zgłosić bezpośrednio w bocie albo napisać na qasupportmt@gmail.com."
    : "<b>QUALITY ASSURANCE SUPPORT</b>\n\n" +
      "<b>Food quality and safety management hub.</b>\n\n" +
      "You get controlled documents, e-books, training with slide decks, hazard analysis, an implementation library, tokens, single products and Quality Copilot.\n\n" +
      "<b>PLANS:</b>\n" +
      `🔹 BASIC — <b>${fmt("basic", 49.99)}/month</b> — system foundation, documents, BASIC e-book and 1 training.\n` +
      `🔷 PRO — <b>${fmt("pro", 149.99)}/month</b> — BASIC + expanded library, PRO e-book and 5 tailored documents.\n` +
      `💠 VIP — <b>${fmt("vip", 399.99)}/month</b> — PRO + VIP playbook, 30 documents and 30 h Quality Copilot.\n\n` +
      "<b>SINGLE PRODUCTS:</b> document PLN 50 / 175 Stars, training PLN 500 / 1750 Stars.\n\n<b>SUPPORT:</b> report an issue, payment/access problem, content issue or improvement idea directly in the bot, or email qasupportmt@gmail.com.";

  const rows = [
    [{ text: pl ? "💎 Plany i ceny" : "💎 Plans & pricing", callback_data: "qa:plans" }, { text: pl ? "📚 Biblioteka" : "📚 Library", callback_data: "qa:products" }],
    [{ text: pl ? "🎓 Szkolenia" : "🎓 Training", callback_data: "qa:training" }, { text: pl ? "🪙 Kup tokeny" : "🪙 Buy tokens", callback_data: "qa:tokens" }],
    [{ text: pl ? "🤖 Quality Copilot" : "🤖 Quality Copilot", callback_data: "qa:assistant" }, { text: pl ? "🧾 Mój dostęp" : "🧾 My access", callback_data: "qa:membership" }],
    [{ text: pl ? "🧪 Usługi eksperckie 1 500 zł" : "🧪 Expert services PLN 1,500", callback_data: "qa:services" }],
    [{ text: pl ? "📦 Segregator fizyczny" : "📦 Printed binder", callback_data: "qa:physical" }, { text: "🌐 PL / EN", callback_data: "qa:language" }],
    [{ text: pl ? "🛟 Pomoc / zgłoś problem / pomysł" : "🛟 Help / report issue / idea", web_app: { url: "https://supermarioofbot-iron-war.vercel.app/quality/support/" } }],
    [{ text: pl ? "🖥 Otwórz Quality Hub" : "🖥 Open Quality Hub", web_app: { url: "https://supermarioofbot-iron-war.vercel.app/quality/" } }]
  ];
  if (isAdmin) rows.push([{ text: pl ? "⚙️ Panel właściciela" : "⚙️ Owner panel", callback_data: "home" }]);
  return { text, reply_markup: { inline_keyboard: rows } };
}

export function renderQualityPlans(plans = [], locale = "pl") {
  const pl = locale !== "en";
  const blocks = plans.map((plan) => {
    const name = pl ? plan.name_pl : plan.name_en;
    const tagline = pl ? plan.tagline_pl : plan.tagline_en;
    const desc = pl ? plan.description_pl : plan.description_en;
    const extra = [];
    if (plan.included_training_choices) extra.push(pl ? `${plan.included_training_choices} szkolenie w pakiecie` : `${plan.included_training_choices} training choice included`);
    if (plan.included_custom_docs) extra.push(pl ? `${plan.included_custom_docs} dokumentów dedykowanych / miesiąc` : `${plan.included_custom_docs} tailored documents / month`);
    if (plan.included_chat_minutes) extra.push(pl ? `${Math.round(plan.included_chat_minutes / 60)} h Quality Copilot / miesiąc` : `${Math.round(plan.included_chat_minutes / 60)} h Quality Copilot / month`);
    extra.push(pl ? "e-book cyfrowy w cenie" : "digital e-book included");
    if (plan.physical_copy_optional) {
      extra.push(
        plan.physical_shipping_included
          ? (pl ? "wersja drukowana opcjonalna — przesyłka w Polsce w cenie" : "optional printed edition — Poland shipping included")
          : (pl
              ? `wersja drukowana opcjonalna — przesyłka ${Number(plan.physical_shipping_price_pln || 0).toFixed(2).replace(".", ",")} zł`
              : `optional printed edition — shipping PLN ${Number(plan.physical_shipping_price_pln || 0).toFixed(2)}`)
      );
    }
    return `<b>${esc(name)}</b> — <b>${pricePln(plan.display_price_pln)} / ${pl ? "mies." : "month"}</b>\n<i>${esc(tagline)}</i>\n${esc(desc)}${extra.length ? "\n• " + extra.map(esc).join("\n• ") : ""}`;
  });
  const buttons = plans.map((plan) => [{
    text: `${plan.name_pl === "BASIC" ? "🔹" : plan.name_pl === "PRO" ? "🔷" : "💠"} ${pl ? "KUP TERAZ" : "BUY NOW"} ${pl ? plan.name_pl : plan.name_en} — ${pricePln(plan.display_price_pln)}`,
    callback_data: `qa:buyplan:${plan.slug}`
  }]);
  return { text: (pl ? "<b>PLANY — KUP TERAZ</b>\n\n" : "<b>PLANS — BUY NOW</b>\n\n") + blocks.join("\n\n"), reply_markup: { inline_keyboard: [...buttons, [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}

export function renderPlanDetails(plan, products = [], locale = "pl") {
  const pl = locale !== "en";
  const name = pl ? plan.name_pl : plan.name_en;
  const items = products.filter((p) => Number(p.minimum_tier_rank) <= Number(plan.tier_rank)).slice(0, 25).map((p) => `• ${esc(pl ? p.name_pl : p.name_en)}`);
  return {
    text: `<b>${esc(name)}</b>\n\n${esc(pl ? plan.description_pl : plan.description_en)}\n\n<b>${pricePln(plan.display_price_pln)} / ${pl ? "miesiąc" : "month"}</b>\n\n${items.length ? (pl ? "<b>W pakiecie:</b>" : "<b>Included:</b>") + "\n" + items.join("\n") + "\n\n" : ""}${pl ? "Cyfrowy pakiet kupujesz przez Telegram Stars. E-book cyfrowy jest zawsze w pakiecie. Wersja drukowana jest opcjonalna." : "Digital plan is purchased via Telegram Stars. The digital e-book is always included. The printed edition is optional."}`,
    reply_markup: { inline_keyboard: [[{ text: pl ? `✅ KUP TERAZ ${name}` : `✅ BUY NOW ${name}`, callback_data: `qa:buyplan:${plan.slug}` }], [{ text: pl ? "📚 Biblioteka pakietu" : "📚 Plan library", callback_data: `qa:products:tier:${plan.tier_rank}` }], [{ text: pl ? "⬅️ Plany" : "⬅️ Plans", callback_data: "qa:plans" }]] }
  };
}

export function renderProducts(products = [], locale = "pl", tier = null) {
  const pl = locale !== "en";
  const filtered = tier ? products.filter((p) => Number(p.minimum_tier_rank) <= Number(tier)) : products;
  const shown = filtered.slice(0, 30);
  const rows = shown.map((p) => {
    const tierName = Number(p.minimum_tier_rank) === 1 ? "BASIC" : Number(p.minimum_tier_rank) === 2 ? "PRO" : "VIP";
    const single = p.standalone_purchase_enabled && productPriceLabel(p, locale) ? `\n${pl ? "Pojedynczo" : "Standalone"}: ${productPriceLabel(p, locale)}` : "";
    return `<b>${esc(pl ? p.name_pl : p.name_en)}</b> [${tierName}]\n${esc(pl ? p.short_description_pl : p.short_description_en)}${single}`;
  });
  const buttons = shown.map((p) => [{ text: `📄 ${(pl ? p.name_pl : p.name_en).slice(0, 48)}`, callback_data: `qa:product:${p.slug}` }]);
  return { text: (pl ? "<b>BIBLIOTEKA PRODUKTÓW</b>\n\n" : "<b>PRODUCT LIBRARY</b>\n\n") + (rows.length ? rows.join("\n\n") : (pl ? "Brak produktów." : "No products.")), reply_markup: { inline_keyboard: [...buttons, [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}

export function renderProductDetail(product, locale = "pl", access = {}) {
  const pl = locale !== "en";
  const name = pl ? product.name_pl : product.name_en;
  const tierName = Number(product.minimum_tier_rank) === 1 ? "BASIC" : Number(product.minimum_tier_rank) === 2 ? "PRO" : "VIP";
  const unlocked = Boolean(access.unlocked);
  const purchased = Boolean(access.purchased);
  const status = unlocked ? (purchased ? (pl ? "✅ Kupione pojedynczo" : "✅ Purchased standalone") : (pl ? "✅ Dostęp aktywny z pakietu" : "✅ Access active via plan")) : (pl ? `🔒 Wymagany pakiet: ${tierName}` : `🔒 Required plan: ${tierName}`);
  const buttons = [];
  if (unlocked && access.downloadUrl && (product.asset_path_pl || product.asset_path_en)) {
    buttons.push([{ text: product.product_type === "training" ? (pl ? "⬇️ Pobierz szkolenie: e-book + prezentacja" : "⬇️ Download training: e-book + deck") : (pl ? "⬇️ Pobierz DOCX / e-book" : "⬇️ Download DOCX / e-book"), url: access.downloadUrl }]);
  }
  if (!unlocked && product.standalone_purchase_enabled && productPriceLabel(product, locale)) {
    buttons.push([{ text: product.product_type === "training" ? (pl ? `🎓 Kup szkolenie — ${productPriceLabel(product, locale)}` : `🎓 Buy training — ${productPriceLabel(product, locale)}`) : (pl ? `📄 Kup sam dokument — ${productPriceLabel(product, locale)}` : `📄 Buy single document — ${productPriceLabel(product, locale)}`), callback_data: `qa:buyproduct:${product.slug}` }]);
  }
  if (!unlocked) buttons.push([{ text: pl ? "💎 Zobacz pakiety" : "💎 View plans", callback_data: "qa:plans" }]);
  buttons.push([{ text: pl ? "⬅️ Biblioteka" : "⬅️ Library", callback_data: "qa:products" }]);
  return { text: `<b>${esc(name)}</b>\n\n${esc(pl ? product.short_description_pl : product.short_description_en)}\n\n${status}\n${product.delivery_note_pl ? "\n" + esc(pl ? product.delivery_note_pl : product.delivery_note_en || product.delivery_note_pl) : ""}`, reply_markup: { inline_keyboard: buttons } };
}

export function renderTraining(products = [], locale = "pl", membership = null) {
  const pl = locale !== "en";
  const training = products.filter((p) => p.product_type === "training");
  const hasProVip = Number(membership?.quality_plans?.tier_rank || 0) >= 2 && membership?.status === "active";
  const intro = pl
    ? (hasProVip ? "Masz aktywny dostęp PRO/VIP. Szkolenia możesz pobierać z pakietu." : "Nie masz aktywnego PRO/VIP. Możesz kupić pojedyncze szkolenie za 500 zł / 1750 Stars. Szkolenie zawiera e-book, prezentację i ćwiczenia wdrożeniowe.")
    : (hasProVip ? "You have active PRO/VIP access. Training can be downloaded through your plan." : "No active PRO/VIP access. You can buy one training for PLN 500 / 1750 Stars. Training includes an e-book, slide deck and implementation exercises.");
  const lines = training.map((p) => `<b>${esc(pl ? p.name_pl : p.name_en)}</b>\n${esc(pl ? p.short_description_pl : p.short_description_en)}\n${pl ? "Cena pojedyncza" : "Standalone price"}: ${productPriceLabel(p, locale) || "—"}`).join("\n\n");
  const buttons = training.map((p) => [{ text: hasProVip ? `⬇️ ${pl ? "Otwórz" : "Open"}: ${(pl ? p.name_pl : p.name_en).slice(0, 32)}` : `🎓 ${pl ? "Kup szkolenie" : "Buy training"} — ${(pl ? p.name_pl : p.name_en).slice(0, 28)}`, callback_data: hasProVip ? `qa:product:${p.slug}` : `qa:buyproduct:${p.slug}` }]);
  return { text: (pl ? "<b>SZKOLENIA</b>\n\n" : "<b>TRAINING</b>\n\n") + intro + "\n\n" + lines, reply_markup: { inline_keyboard: [...buttons, [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}

export function renderTokens(packs = [], locale = "pl", wallet = null) {
  const pl = locale !== "en";
  const lines = packs.map((p) => pl ? `• <b>${p.tokens} tokenów</b> — ${p.price_stars} Stars` : `• <b>${p.tokens} tokens</b> — ${p.price_stars} Stars`);
  const buttons = packs.map((p) => [{ text: pl ? `⭐ Kup ${p.tokens} tokenów` : `⭐ Buy ${p.tokens} tokens`, callback_data: `qa:token:${p.tokens}` }]);
  return { text: (pl ? "<b>PORTFEL TOKENÓW</b>\n\n" : "<b>TOKEN WALLET</b>\n\n") + (pl ? `Saldo: <b>${Number(wallet?.token_balance || 0)}</b> tokenów\n\n35 tokenów = jeden dodatkowy dokument po limicie pakietu.\n\n` : `Balance: <b>${Number(wallet?.token_balance || 0)}</b> tokens\n\n35 tokens = one extra document after plan allowance.\n\n`) + lines.join("\n"), reply_markup: { inline_keyboard: [...buttons, [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}

export function renderPhysicalProduct(locale = "pl", telegramUserId = null) {
  const pl = locale !== "en";
  const ref = telegramUserId ? `tg_${telegramUserId}` : "telegram";
  const checkout = `https://buy.stripe.com/cNi6oG4Kd97Q7Qy5ymdby06?client_reference_id=${encodeURIComponent(ref)}&utm_source=telegram&utm_medium=bot&utm_campaign=physical_binder`;
  return { text: pl ? "<b>📦 FIZYCZNY SEGREGATOR DOKUMENTACJI</b>\n\nCena: <b>1 499,00 zł</b>. Płatność: BLIK lub karta. Produkt materialny, niezależny od subskrypcji." : "<b>📦 PRINTED DOCUMENTATION BINDER</b>\n\nPrice: <b>PLN 1,499.00</b>. Payment: BLIK or card. Physical product independent of subscription.", reply_markup: { inline_keyboard: [[{ text: pl ? "💳 Kup — BLIK / karta" : "💳 Buy — BLIK / card", url: checkout }], [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}

export function renderExpertServices(services = [], locale = "pl", telegramUserId = null) {
  const pl = locale !== "en";
  const rows = services.map((s) => `<b>${esc(pl ? s.name_pl : s.name_en)}</b> — <b>1 500 zł</b>\n${esc(pl ? s.description_pl : s.description_en)}`).join("\n\n");
  const buttons = services.map((s) => { const sep = s.checkout_url.includes("?") ? "&" : "?"; const ref = telegramUserId ? `tg_${telegramUserId}` : "telegram"; return [{ text: `💳 ${(pl ? s.name_pl : s.name_en).slice(0, 36)} — 1 500 zł`, url: `${s.checkout_url}${sep}client_reference_id=${encodeURIComponent(ref)}` }]; });
  return { text: (pl ? "<b>🧪 USŁUGI EKSPERCKIE</b>\n\n" : "<b>🧪 EXPERT SERVICES</b>\n\n") + rows, reply_markup: { inline_keyboard: [...buttons, [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}

export function renderAssistant(locale = "pl") {
  const pl = locale !== "en";
  const base = "https://supermarioofbot-iron-war.vercel.app/quality/assistant/";
  const specialists = [["brc","BRCGS Food Safety"],["ifs","IFS Food"],["haccp","HACCP / Codex"],["audit",pl?"Audyt i Gap Analysis":"Audit & Gap Analysis"],["documents",pl?"Dokumentacja i procedury":"Documents & procedures"],["complaints",pl?"Reklamacje i trendy":"Complaints & trends"],["capa","CAPA / RCA"],["suppliers",pl?"Dostawcy i surowce":"Suppliers & raw materials"],["traceability",pl?"Identyfikowalność i wycofanie":"Traceability & recall"],["labelling",pl?"Etykiety i alergeny":"Labelling & allergens"],["change",pl?"Zmiana / nowa technologia":"Change / new technology"],["management",pl?"KPI i przegląd zarządzania":"KPI & management review"],["legal",pl?"Prawo i wymagania — Live":"Law & requirements — Live"],["other","Quality Manager 360°"]];
  return { text: pl ? "<b>🤖 QUALITY COPILOT</b>\n\nWybierz specjalistę. Czas VIP nalicza się tylko między START i STOP." : "<b>🤖 QUALITY COPILOT</b>\n\nChoose a specialist. VIP time runs only between START and STOP.", reply_markup: { inline_keyboard: [...specialists.map(([key,name]) => [{ text: `🧠 ${name}`, web_app: { url: `${base}?specialist=${key}` } }]), [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}

export function renderMembership(membership, locale = "pl", wallet = null) {
  const pl = locale !== "en";
  if (!membership) return { text: pl ? "<b>MÓJ DOSTĘP</b>\n\nNie masz aktywnego pakietu." : "<b>MY ACCESS</b>\n\nYou do not have an active plan.", reply_markup: { inline_keyboard: [[{ text: pl ? "💎 Kup pakiet" : "💎 Buy plan", callback_data: "qa:plans" }], [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
  const plan = membership.quality_plans || {};
  const docsLeft = Math.max(0, Number(plan.included_custom_docs || 0) - Number(membership.custom_docs_used || 0));
  const secondsLeft = Math.max(0, Number(plan.included_chat_minutes || 0) * 60 - Number(membership.assistant_seconds_used || 0));
  const h = Math.floor(secondsLeft / 3600); const m = Math.floor((secondsLeft % 3600) / 60);
  return { text: (pl ? "<b>MÓJ DOSTĘP</b>\n\n" : "<b>MY ACCESS</b>\n\n") + `Plan: <b>${esc(pl ? plan.name_pl : plan.name_en)}</b>\n${pl ? "Dokumenty pozostałe" : "Documents left"}: <b>${docsLeft}</b>\nQuality Copilot: <b>${h}h ${String(m).padStart(2,"0")}m</b>\nTokeny: <b>${Number(wallet?.token_balance || 0)}</b>`, reply_markup: { inline_keyboard: [[{ text: pl ? "📚 Biblioteka" : "📚 Library", callback_data: "qa:products" }, { text: "🤖 Copilot", callback_data: "qa:assistant" }], [{ text: pl ? "⬅️ Wróć" : "⬅️ Back", callback_data: "qa:home" }]] } };
}
