import crypto from "node:crypto";
import {
  answerCallbackQuery,
  answerPreCheckoutQuery,
  editMessage,
  sendMessage,
  editUserStarSubscription,
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
  recordQualityPlanRefund,
  setQualitySubscriptionAutoRenew,
  claimQualityAccountantOwner,
  getQualityAccountingSummary,
  getMarketAuditSummary,
  listMarketAuditCases,
  getMarketAuditCase,
  createMarketAuditCase,
  addMarketAuditObservation,
  closeMarketAuditCase,
  updateMarketAuditQuality,
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


function marketWebhookSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function marketTelegramApi(token, method, payload) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.description || ("Telegram HTTP " + response.status));
  return data;
}

function renderMarketCase(c) {
  const h=c || {};
  const cmp=h.comparison || {};
  const q=h.quality || {};
  const target=h.paper_target_price || null;
  const lines=[
    "<b>📊 PRZYPADEK BADAWCZY</b>",
    "<b>"+escapeHtml(h.asset || "—")+"</b> • "+escapeHtml(h.direction || "—")+" • "+escapeHtml(h.status || "—"),
    "",
    "<b>Analiza wstępna</b>",
    "Cena odniesienia: <b>"+escapeHtml(h.reference_price ?? "—")+"</b>",
    "Symulowany cel paper: <b>"+escapeHtml(target ?? "—")+"</b>",
    "Próg: <b>"+escapeHtml(h.predicted_move_pct ?? "—")+"%</b>",
    "Horyzont: <b>"+escapeHtml(h.horizon_minutes ?? "—")+" min</b>",
    "Confidence: <b>"+escapeHtml(h.confidence ?? "—")+"</b>",
    "",
    "<b>Przebieg vs przewidywanie</b>",
    "Zgodne: <b>"+escapeHtml(cmp.behavedAsPredicted===true?"TAK":cmp.behavedAsPredicted===false?"NIE":"PENDING")+"</b>",
    "Max ruch: <b>"+escapeHtml(cmp.maxObservedMovePct==null?"—":Number(cmp.maxObservedMovePct).toFixed(3)+"%")+"</b>",
    "Potwierdzające wartości: "+escapeHtml((cmp.supportingVariables||[]).join(", ") || "—"),
    "Wartości przeciwne: "+escapeHtml((cmp.contradictingVariables||[]).join(", ") || "—"),
    "",
    "<b>Jakość</b>",
    "NCR: "+escapeHtml(q.nonconformity?.type || "brak"),
    "RCA: "+escapeHtml(q.rootCause || "—"),
    "CAPA: <b>"+escapeHtml((q.capa||[]).length)+"</b>",
    "CIP: <b>"+escapeHtml((q.cip||[]).length)+"</b>",
    "Effectiveness: "+escapeHtml(q.effectivenessCheck || "—"),
    "Management review: "+escapeHtml(q.managementReview || "—"),
    "",
    "<i>Wyłącznie research/paper. Brak realnego zlecenia kupna lub sprzedaży.</i>"
  ];
  return lines.join("\n");
}

async function syncMarketCasesFromAndy() {
  try {
    const r=await fetch("https://andy-b-quality-control-production.up.railway.app/worker-signals/status",{
      headers:{"user-agent":"market-audit-sync/1.0"},
      signal:AbortSignal.timeout(6000)
    });
    if(!r.ok)return {ok:false,http:r.status,created:0};
    const j=await r.json();
    const signals=Array.isArray(j?.audit?.lastBatch?.signals)?j.audit.lastBatch.signals:[];
    let created=0;
    for(const s of signals.slice(0,100)){
      try{
        const result=await createMarketAuditCase({
          ...s,
          initialAnalysis:{
            source:"ANDY_WORKER_BATCH",
            evidence:s.evidence||null,
            detectedAt:s.detectedAt||null
          },
          expectedVariables:Array.isArray(s.expectedVariables)?s.expectedVariables:[],
          riskFactors:Array.isArray(s.riskFactors)?s.riskFactors:[]
        },"ANDY");
        if(result)created++;
      }catch{}
    }
    return {ok:true,total:signals.length,created};
  }catch(error){
    return {ok:false,error:String(error),created:0};
  }
}

async function handleMarketAuditBot(req, res) {
  const token=process.env.MARKET_AUDIT_BOT_TOKEN || "";
  if(!token)return res.status(503).json({ok:false,error:"MARKET_AUDIT_BOT_TOKEN is not configured"});
  if(req.headers["x-telegram-bot-api-secret-token"] !== marketWebhookSecret(token)) {
    return res.status(401).json({ok:false,error:"Invalid market-audit webhook secret"});
  }

  const update=req.body||{};
  const message=update.message;
  if(!message?.chat?.id)return res.status(200).json({ok:true,ignored:true});

  const profile=await getUserProfile(message.from.id).catch(()=>null);
  if(!profile?.is_admin){
    await marketTelegramApi(token,"sendMessage",{chat_id:message.chat.id,text:"⛔ Brak dostępu."});
    return res.status(200).json({ok:true});
  }

  const chatId=message.chat.id;
  const text=String(message.text||"").trim();
  if(text==="/start"||text==="/status"||text==="/refresh"){
    const sync=await syncMarketCasesFromAndy();
    const s=await getMarketAuditSummary();
    const out=[
      "<b>🧠 MARKET ANALYSIS AUDIT BOT</b>",
      "<i>research / paper only</i>",
      "",
      "Przypadki: <b>"+Number(s?.total||0)+"</b>",
      "Otwarte: <b>"+Number(s?.open||0)+"</b>",
      "MATCH: <b>"+Number(s?.match||0)+"</b> • MISS: <b>"+Number(s?.miss||0)+"</b>",
      "Otwarte NCR/CAPA: <b>"+Number(s?.open_quality||0)+"</b>",
      "",
      "Synchronizacja workerów: "+(sync.ok?"OK":"BŁĄD"),
      "",
      "<b>Komendy</b>",
      "/cases — ostatnie przypadki",
      "/case ID — pełna analiza",
      "/quality — NCR / RCA / CAPA / CIP",
      "/refresh — odśwież dane",
      "",
      "<i>Nie wykonuje realnych transakcji ani zleceń.</i>"
    ].join("\n");
    await marketTelegramApi(token,"sendMessage",{chat_id:chatId,text:out,parse_mode:"HTML"});
    return res.status(200).json({ok:true});
  }

  if(text==="/cases"){
    await syncMarketCasesFromAndy();
    const rows=await listMarketAuditCases(20);
    const out=(rows||[]).length
      ? rows.map((x)=>"<code>"+escapeHtml(x.case_id)+"</code> • "+escapeHtml(x.asset||"—")+" • "+escapeHtml(x.status||"—")).join("\n")
      : "Brak przypadków.";
    await marketTelegramApi(token,"sendMessage",{chat_id:chatId,text:"<b>Ostatnie analizy</b>\n\n"+out,parse_mode:"HTML"});
    return res.status(200).json({ok:true});
  }

  if(text.startsWith("/case ")){
    const id=text.slice(6).trim();
    const row=await getMarketAuditCase(id);
    await marketTelegramApi(token,"sendMessage",{chat_id:chatId,text:row?renderMarketCase(row):"Nie znaleziono przypadku.",parse_mode:"HTML"});
    return res.status(200).json({ok:true});
  }

  if(text==="/quality"){
    const rows=await listMarketAuditCases(50);
    const bad=(rows||[]).filter((x)=>x.quality?.nonconformity);
    const out=bad.length
      ? bad.slice(0,20).map((x)=>"<code>"+escapeHtml(x.case_id)+"</code> • "+escapeHtml(x.asset||"—")+" • RCA "+escapeHtml(x.quality?.rootCause||"PENDING")+" • CAPA "+Number((x.quality?.capa||[]).length)+" • CIP "+Number((x.quality?.cip||[]).length)).join("\n")
      : "Brak otwartych niezgodności.";
    await marketTelegramApi(token,"sendMessage",{chat_id:chatId,text:"<b>NCR / RCA / CAPA / CIP</b>\n\n"+out,parse_mode:"HTML"});
    return res.status(200).json({ok:true});
  }

  await marketTelegramApi(token,"sendMessage",{chat_id:chatId,text:"Dostępne: /status, /cases, /case ID, /quality, /refresh"});
  return res.status(200).json({ok:true});
}

export default async function handler(req, res) {
  const channel = String(req.query?.channel || "");

  if (channel === "market-audit" && req.method === "GET" && String(req.query?.setup || "") === "1") {
    const marketToken = process.env.MARKET_AUDIT_BOT_TOKEN || "";
    if (!marketToken) {
      return res.status(503).json({ ok:false, error:"MARKET_AUDIT_BOT_TOKEN is not configured" });
    }
    try {
      const webhookUrl = "https://supermarioofbot-iron-war.vercel.app/api/telegram?channel=market-audit";
      const result = await marketTelegramApi(marketToken, "setWebhook", {
        url: webhookUrl,
        secret_token: marketWebhookSecret(marketToken),
        allowed_updates: ["message"],
        drop_pending_updates: false
      });
      return res.status(200).json({ ok:true, webhook: webhookUrl, result: result?.result ?? true });
    } catch (error) {
      return res.status(500).json({ ok:false, error:error instanceof Error ? error.message : "Webhook setup failed" });
    }
  }

  if (channel === "market-audit") {
    try { return await handleMarketAuditBot(req,res); }
    catch (error) {
      console.error("market_audit_bot_error",error);
      return res.status(500).json({ok:false,error:error instanceof Error?error.message:"Market audit bot failed"});
    }
  }

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

    if (update.message?.refunded_payment) {
      const message = update.message;
      const refund = message.refunded_payment;
      const payload = String(refund.invoice_payload || "");
      if (/^qa_plan:([a-z0-9-]+)$/i.test(payload)) {
        await recordQualityPlanRefund(message.from, refund);
        await sendMessage(token, message.chat.id, "↩️ Zwrot płatności został zarejestrowany. Powiązany dostęp został zaktualizowany zgodnie ze statusem płatności.");
      }
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
        const ebookMap = {
          basic: "ebook-basic-quality-foundations",
          pro: "ebook-pro-food-safety-hazard-analysis",
          vip: "ebook-vip-quality-manager-playbook"
        };
        const ebookSlug = ebookMap[result.plan.slug];
        const ebookUrl = ebookSlug
          ? qualityDownloadUrl(token, message.from.id, ebookSlug, locale)
          : null;

        const buttons = [];

        if (ebookUrl) {
          buttons.push([{
            text: pl ? "⬇️ Pobierz e-book pakietu" : "⬇️ Download plan e-book",
            url: ebookUrl
          }]);
        }

        if (result.plan.physical_copy_optional) {
          if (result.plan.physical_shipping_included) {
            buttons.push([{
              text: pl
                ? "📦 Chcę wersję drukowaną — przesyłka w cenie"
                : "📦 I want the printed edition — shipping included",
              web_app: {
                url: "https://supermarioofbot-iron-war.vercel.app/quality/shipping/"
              }
            }]);
          } else if (result.plan.physical_shipping_checkout_url) {
            const sep = result.plan.physical_shipping_checkout_url.includes("?") ? "&" : "?";
            const shippingUrl =
              result.plan.physical_shipping_checkout_url +
              sep +
              "client_reference_id=" +
              encodeURIComponent("tg_" + message.from.id) +
              "&utm_source=telegram&utm_medium=bot&utm_campaign=" +
              encodeURIComponent(result.plan.slug + "_printed_ebook_shipping");

            buttons.push([{
              text: pl
                ? `📦 Wersja drukowana — przesyłka ${Number(result.plan.physical_shipping_price_pln || 0).toFixed(2).replace(".", ",")} zł (BLIK / karta)`
                : `📦 Printed edition — shipping PLN ${Number(result.plan.physical_shipping_price_pln || 0).toFixed(2)} (BLIK / card)`,
              url: shippingUrl
            }]);
          }
        }

        buttons.push([{ text: "🏠 Quality menu", callback_data: "qa:home" }]);
        buttons.push([{ text: pl ? "📚 Biblioteka" : "📚 Library", callback_data: "qa:products" }]);
        if (Number(result.plan.included_chat_minutes || 0) > 0) {
          buttons.push([{ text: "🤖 Quality Copilot", callback_data: "qa:assistant" }]);
        }

        const physicalLine = result.plan.physical_shipping_included
          ? (pl
              ? "Wersja drukowana jest opcjonalna; jeśli ją wybierzesz, przesyłka w Polsce jest wliczona w cenę."
              : "The printed edition is optional; if selected, Poland shipping is included in the plan price.")
          : (pl
              ? `Wersja drukowana jest opcjonalna. Jeśli ją wybierzesz, przesyłka kosztuje ${Number(result.plan.physical_shipping_price_pln || 0).toFixed(2).replace(".", ",")} zł i jest opłacana osobno BLIKiem lub kartą.`
              : `The printed edition is optional. If selected, shipping costs PLN ${Number(result.plan.physical_shipping_price_pln || 0).toFixed(2)} and is paid separately by BLIK or card.`);

        await sendMessage(
          token,
          chatId,
          pl
            ? `✅ Pakiet <b>${escapeHtml(planName)}</b> został aktywowany.\n\nDostęp aktywny do: <b>${new Date(result.membership.period_end).toLocaleDateString("pl-PL")}</b>.\n\n<b>E-book cyfrowy jest zawsze w pakiecie i możesz pobrać go od razu.</b>\n${physicalLine}`
            : `✅ <b>${escapeHtml(planName)}</b> has been activated.\n\nAccess active until: <b>${new Date(result.membership.period_end).toLocaleDateString("en-GB")}</b>.\n\n<b>The digital e-book is always included and can be downloaded immediately.</b>\n${physicalLine}`,
          { inline_keyboard: buttons }
        );
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
        const slug = action.split(":")[2];
        const plan = await getQualityPlan(slug);
        if (!plan || !plan.checkout_enabled || !plan.price_stars) {
          await sendMessage(token, chatId, pl ? "Ten pakiet jest chwilowo niedostępny." : "This plan is temporarily unavailable.");
        } else {
          const url = "https://supermarioofbot-iron-war.vercel.app/quality/?buy=" + encodeURIComponent(slug) + "&lang=" + encodeURIComponent(locale);
          await sendMessage(token, chatId,
            pl ? "Przed płatnością wymagane jest zapoznanie się z dokumentami i zapis wymaganych zgód." : "Before payment, you must review the legal documents and record the required consents.",
            { inline_keyboard: [[{ text: pl ? "📑 Przejdź do zakupu i zgód" : "📑 Continue to checkout & consents", web_app: { url } }]] }
          );
        }
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
        if (!product || !product.standalone_purchase_enabled) {
          await sendMessage(token, chatId, pl ? "Ten produkt nie jest dostępny pojedynczo." : "This product is not available standalone.");
        } else {
          const url = "https://supermarioofbot-iron-war.vercel.app/quality/checkout/?kind=product&ref=" + encodeURIComponent(product.slug) + "&type=" + encodeURIComponent(product.product_type || "document") + "&lang=" + encodeURIComponent(locale);
          await sendMessage(token, chatId, pl ? "Przed płatnością wymagane jest przejście przez informacje i zgody." : "Complete the required notices and consents before payment.", { inline_keyboard: [[{ text: pl ? "📑 Kontynuuj zakup" : "📑 Continue checkout", web_app: { url } }]] });
        }
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
        if (pack) {
          const url = "https://supermarioofbot-iron-war.vercel.app/quality/checkout/?kind=token&ref=" + encodeURIComponent(pack.tokens) + "&lang=" + encodeURIComponent(locale);
          await sendMessage(token, chatId, pl ? "Przed płatnością wymagane jest przejście przez informacje i zgody." : "Complete the required notices and consents before payment.", { inline_keyboard: [[{ text: pl ? "📑 Kontynuuj zakup" : "📑 Continue checkout", web_app: { url } }]] });
        }
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
        const locale = profile?.locale || "pl";
        const pl = locale !== "en";
        const plan = await getQualityPlan(planLink[1]);
        if (plan) {
          const url = "https://supermarioofbot-iron-war.vercel.app/quality/?buy=" + encodeURIComponent(plan.slug) + "&lang=" + encodeURIComponent(locale);
          await sendMessage(token, chatId,
            pl ? "Przed płatnością przejdź przez wymagane informacje i zgody." : "Complete the required legal notices and consents before payment.",
            { inline_keyboard: [[{ text: pl ? "📑 Kontynuuj zakup" : "📑 Continue checkout", web_app: { url } }]] }
          );
        }
        return res.status(200).json({ ok: true });
      }
      if (productLink) {
        const profile = await getUserProfile(message.from.id);
        const locale = profile?.locale || "pl";
        const pl = locale !== "en";
        const product = await getQualityProduct(productLink[1]);
        if (product) {
          const url = "https://supermarioofbot-iron-war.vercel.app/quality/checkout/?kind=product&ref=" + encodeURIComponent(product.slug) + "&type=" + encodeURIComponent(product.product_type || "document") + "&lang=" + encodeURIComponent(locale);
          await sendMessage(token, chatId, pl ? "Przed płatnością przejdź przez wymagane informacje i zgody." : "Complete the required legal notices and consents before payment.", { inline_keyboard: [[{ text: pl ? "📑 Kontynuuj zakup" : "📑 Continue checkout", web_app: { url } }]] });
        }
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
      if (text === "/ksiegowa" || text === "/accountant") {
        const profile = await getUserProfile(message.from.id);
        const pl = (profile?.locale || "pl") !== "en";
        try {
          const s = await getQualityAccountingSummary(message.from.id, 2026, Math.floor(new Date().getMonth()/3)+1);
          const money = (g) => (Number(g||0)/100).toFixed(2).replace(".",",")+" zł";
          await sendMessage(token, chatId,
            pl ? "<b>🧾 Księgowa</b>\n\nLimit działalności nierejestrowanej: <b>"+money(s.quarterly_limit_grosz)+" / kwartał</b>\nPrzychód należny w kwartale: <b>"+money(s.limit_revenue_grosz)+"</b>\nPozostało: <b>"+money(s.remaining_limit_grosz)+"</b>\nWykorzystanie: <b>"+s.limit_used_pct+"%</b>\n\nPIT-36 — przychód otrzymany: <b>"+money(s.pit_revenue_grosz)+"</b>\nKoszty: <b>"+money(s.pit_cost_grosz)+"</b>\nDochód roboczy: <b>"+money(s.pit_income_grosz)+"</b>\nPozycje wymagające dokumentu/uzgodnienia: <b>"+s.unresolved_entries+"</b>\n\nDokładność księgowania: <b>0 groszy różnicy</b>. Deklaracja jest przygotowywana automatycznie, ale jej wysłanie wymaga Twojej autoryzacji."
               : "<b>🧾 Accountant</b>\n\nQuarter limit: <b>"+money(s.quarterly_limit_grosz)+"</b>\nQuarter receivable revenue: <b>"+money(s.limit_revenue_grosz)+"</b>\nRemaining: <b>"+money(s.remaining_limit_grosz)+"</b>\nPIT-36 received revenue: <b>"+money(s.pit_revenue_grosz)+"</b>\nCosts: <b>"+money(s.pit_cost_grosz)+"</b>\nUnresolved evidence: <b>"+s.unresolved_entries+"</b>\n\nAccounting reconciliation requires <b>zero-grosz difference</b>. Filing requires owner authorization."
          );
        } catch {
          const claim = await claimQualityAccountantOwner(message.from.id);
          await sendMessage(token, chatId, pl
            ? "🧾 Moduł Księgowa jest zabezpieczony jako dane właściciela. Twoje konto Telegram zostało zgłoszone do jednorazowego powiązania z właścicielem. Status: <b>"+String(claim?.status||"pending")+"</b>."
            : "🧾 Accountant data is owner-only. Your Telegram account was submitted for one-time owner binding. Status: <b>"+String(claim?.status||"pending")+"</b>."
          );
        }
        return res.status(200).json({ ok: true });
      }

      if (text === "/terms" || text === "/privacy") {
        const profile = await getUserProfile(message.from.id);
        const pl = (profile?.locale || "pl") !== "en";
        const isTerms = text === "/terms";
        await sendMessage(
          token,
          chatId,
          isTerms
            ? (pl ? "<b>Regulamin</b>\n\nAktualny Regulamin jest dostępny w Moim koncie w Quality Hub. Przed zakupem system wymaga zapisania aktualnej wersji wymaganych oświadczeń." : "<b>Terms</b>\n\nThe current Terms are available in My Account in Quality Hub. Before purchase, the system records the current required acknowledgements.")
            : (pl ? "<b>Polityka prywatności / RODO</b>\n\nAdministratorem danych jest podmiot wskazany w aktualnej Polityce prywatności. Kontakt: <b>qasupportmt@gmail.com</b>. Pełna informacja jest dostępna w Moim koncie." : "<b>Privacy / GDPR</b>\n\nThe controller is identified in the current Privacy Notice. Contact: <b>qasupportmt@gmail.com</b>. The full notice is available in My Account."),
          { inline_keyboard: [[{ text: pl ? "👤 Moje konto i dokumenty" : "👤 My account & documents", web_app: { url: "https://supermarioofbot-iron-war.vercel.app/quality/account/" } }]] }
        );
        return res.status(200).json({ ok: true });
      }

      if (text === "/language") {
        const view = languageMenu();
        await sendMessage(token, chatId, view.text, view.reply_markup);
        return res.status(200).json({ ok: true });
      }
      if (text === "/support" || text === "/paysupport") {
        const profile = await getUserProfile(message.from.id);
        const pl = (profile?.locale || "pl") !== "en";
        const paymentOnly = text === "/paysupport";
        await sendMessage(
          token,
          chatId,
          pl
            ? (paymentOnly
                ? "<b>🛟 Pomoc dotycząca płatności</b>\n\nOtwórz formularz supportu i opisz problem. Zgłoszenie zostanie zapisane na Twoim koncie. Możesz też napisać bezpośrednio na <b>qasupportmt@gmail.com</b>.\n\nNie wysyłaj haseł ani pełnych danych karty."
                : "<b>🛟 POMOC / SUPPORT</b>\n\nMasz problem techniczny, pytanie o dostęp, uwagę do dokumentu albo pomysł na ulepszenie? Wyślij zgłoszenie w formularzu. Zostanie zapisane razem z Twoim kontem Telegram.\n\nE-mail: <b>qasupportmt@gmail.com</b>")
            : (paymentOnly
                ? "<b>🛟 Payment support</b>\n\nOpen the support form and describe the issue. The ticket will be linked to your Telegram account. You can also email <b>qasupportmt@gmail.com</b>.\n\nNever send passwords or full card details."
                : "<b>🛟 HELP / SUPPORT</b>\n\nTechnical problem, access question, document feedback or an improvement idea? Submit a support ticket. It will be linked to your Telegram account.\n\nEmail: <b>qasupportmt@gmail.com</b>"),
          {
            inline_keyboard: [[{
              text: pl ? "📝 Otwórz formularz supportu" : "📝 Open support form",
              web_app: {
                url: paymentOnly
                  ? "https://supermarioofbot-iron-war.vercel.app/quality/support/?category=payment"
                  : "https://supermarioofbot-iron-war.vercel.app/quality/support/"
              }
            }], [{
              text: pl ? "🏠 Quality menu" : "🏠 Quality menu",
              callback_data: "qa:home"
            }]]
          }
        );
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
