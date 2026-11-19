import crypto from "node:crypto";
import { PUBLIC_URL } from "../lib/brand.js";
import { resolveQualityIdentity, publicSupabaseConfig } from "../lib/quality-auth.js";
import {
  getQualityCustomerProfile,
  upsertQualityCustomerProfile,
  getUserProfile,
  getQualityLegalBundle,
  createQualityCheckoutConsent,
  getQualityMembership,
  getQualityWallet,
  getQualityAssistantStatus,
  getQualityAccountingSummary,
  getQualityOwnerUsers,
  claimQualityAccountantOwner,
  recordQualityAccountingCost,
  reconcileQualityAccountingReceipt,
  completeQualityChannelLink,
  getQualityEmergencyAudit,
  saveQualityEmergencyAudit,
  getQualityEmergencyAccess,
  listQualityProducts,
  getQualityProductAccess
} from "../lib/db.js";

async function webAuthProxy(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  const action = String(req.body?.action || "");
  const base = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!base || !key) return res.status(503).json({ ok:false, error:"Web auth is not configured" });

  // Rejestracja, ponowne wysłanie i reset hasła: własny polski e-mail; przy awarii poczty – wysyłka Supabase.
  if (["sign_up", "resend", "recover"].includes(action)) {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const strong = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
    const redirect = String(req.body?.redirect_to || "");
    const app = /app\.jembezpiecznie\.com/.test(redirect) ? "jb" : /^https:\/\/(www\.)?jembezpiecznie\.com/.test(redirect) ? "portal" : "qa";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (action !== "sign_up" || strong)) {
      try {
        const { sendAuthMail } = await import("../lib/auth-mail.js");
        const kind = action === "sign_up" ? "signup" : action === "recover" ? "recovery" : "magiclink";
        const out = await sendAuthMail({ kind, email, password, app });
        if (out.status === "rate") return res.status(429).json({ ok:false, error:"Link był wysłany przed chwilą. Odczekaj minutę i spróbuj ponownie.", code:"over_email_send_rate_limit" });
        if (action === "sign_up" && out.status === "exists") return res.status(422).json({ ok:false, error:"User already registered", code:"user_already_exists" });
        return res.status(200).json({ ok:true, data:{ user:null, session:null } });
      } catch (e) {
        console.error("quality_auth_mail_fallback", e?.message);
      }
    }
  }

  let path = "";
  let body = {};
  let method = "POST";
  let extraHeaders = {};
  if (action === "sign_in") {
    path = "/auth/v1/token?grant_type=password";
    body = { email:String(req.body?.email || ""), password:String(req.body?.password || "") };
  } else if (action === "sign_up") {
    const redirect = String(req.body?.redirect_to || "");
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok:false, error:"Podaj prawidłowy adres e-mail." });
    }
    if (
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        ok:false,
        error:"Hasło musi mieć co najmniej 12 znaków oraz zawierać małą literę, wielką literę, cyfrę i znak specjalny."
      });
    }
    path = "/auth/v1/signup" + (redirect ? "?redirect_to=" + encodeURIComponent(redirect) : "");
    body = { email, password };
  } else if (action === "resend") {
    const redirect = String(req.body?.redirect_to || "");
    path = "/auth/v1/resend" + (redirect ? "?redirect_to=" + encodeURIComponent(redirect) : "");
    body = { type:"signup", email:String(req.body?.email || "") };
  } else if (action === "refresh") {
    path = "/auth/v1/token?grant_type=refresh_token";
    body = { refresh_token:String(req.body?.refresh_token || "") };
  } else if (action === "recover") {
    const redirect = String(req.body?.redirect_to || "");
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok:false, error:"Podaj prawidłowy adres e-mail." });
    }
    path = "/auth/v1/recover" + (redirect ? "?redirect_to=" + encodeURIComponent(redirect) : "");
    body = { email };
  } else if (action === "update_password") {
    const accessToken = String(req.body?.access_token || "");
    const password = String(req.body?.password || "");
    if (!accessToken) {
      return res.status(401).json({ ok:false, error:"Link do ustawienia hasła wygasł. Poproś o nowy." });
    }
    if (
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        ok:false,
        error:"Hasło musi mieć co najmniej 12 znaków oraz zawierać małą literę, wielką literę, cyfrę i znak specjalny."
      });
    }
    method = "PUT";
    path = "/auth/v1/user";
    body = { password };
    extraHeaders = { authorization: "Bearer " + accessToken };
  } else {
    return res.status(400).json({ ok:false, error:"Unknown web auth action" });
  }

  try {
    const upstream = await fetch(base + path, {
      method,
      headers:{ apikey:key, "content-type":"application/json", ...extraHeaders },
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(10000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok:false,
        error:data?.msg || data?.message || data?.error_description || data?.error || "Authentication failed",
        code:data?.error_code || null
      });
    }
    return res.status(200).json({ ok:true, data });
  } catch {
    return res.status(502).json({ ok:false, error:"Authentication service unavailable" });
  }
}

// Portal członka na jembezpiecznie.com korzysta z tego samego logowania co aplikacja.
const PORTAL_ORIGINS = ["https://jembezpiecznie.com", "https://www.jembezpiecznie.com", PUBLIC_URL];
function portalCors(req, res) {
  const origin = req.headers?.origin || "";
  if (!PORTAL_ORIGINS.includes(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Max-Age", "600");
}

const LIBRARY_TYPES = new Set(["document","instruction","framework","ebook","training"]);

function signedDownloadUrl(userId, slug, lang) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const secret = crypto.createHash("sha256").update(token).digest("hex");
  const sig = crypto.createHmac("sha256", secret).update(`${userId}:${slug}:${lang}:${exp}`).digest("hex");
  const q = new URLSearchParams({ u:String(userId), slug, lang, exp:String(exp), sig });
  return "/api/quality-download?" + q.toString();
}

async function qualityLibrary(userId, lang) {
  const products = (await listQualityProducts(3)).filter(p => p?.active !== false && LIBRARY_TYPES.has(p.product_type));
  const rows = await Promise.all(products.map(async p => {
    let access = null;
    try { access = await getQualityProductAccess(userId, p.slug); } catch (_) { access = null; }
    const unlocked = Boolean(access?.unlocked);
    const hasAsset = Boolean(p.asset_path_pl || p.asset_path_en);
    const dl = unlocked && hasAsset ? signedDownloadUrl(userId, p.slug, lang) : null;
    return {
      slug:p.slug,
      category:p.category,
      product_type:p.product_type,
      name:lang === "en" ? (p.name_en || p.name_pl) : (p.name_pl || p.name_en),
      description:lang === "en" ? (p.short_description_en || p.short_description_pl) : (p.short_description_pl || p.short_description_en),
      minimum_tier_rank:Number(p.minimum_tier_rank || 1),
      standalone:Boolean(p.standalone_purchase_enabled),
      unlocked,
      purchased:Boolean(access?.purchased),
      download_url:dl,
      slides_url:dl && p.product_type === "training" ? dl + "&format=pptx" : null,
      sort_order:Number(p.sort_order || 0)
    };
  }));
  return rows.sort((a,b) => a.minimum_tier_rank - b.minimum_tier_rank || a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pl"));
}

export default async function handler(req, res) {
  portalCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET","POST"].includes(req.method)) {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  const mode = String(req.query?.mode || "");
  if (mode === "web-auth") return webAuthProxy(req, res);

  const identity = await resolveQualityIdentity(req);
  if (!identity?.telegramUserId) {
    return res.status(401).json({ ok:false, error:"Sign in to Quality Assurance Support." });
  }
  const user = identity.user || { id: identity.telegramUserId };

  try {
    if (mode === "dashboard") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok:false, error:"Method not allowed" });
      }
      const [profile, membership, wallet, assistant] = await Promise.all([
        getUserProfile(user.id),
        getQualityMembership(user.id),
        getQualityWallet(user.id),
        getQualityAssistantStatus(user.id)
      ]);
      const plan = membership?.quality_plans || null;
      const docsLeft = membership && plan
        ? Math.max(0, Number(plan.included_custom_docs || 0) - Number(membership.custom_docs_used || 0))
        : 0;
      return res.status(200).json({
        ok:true,
        profile,
        membership: membership ? {
          status:membership.status,
          period_end:membership.period_end,
          plan,
          docs_left:docsLeft
        } : null,
        wallet:{ token_balance:Number(wallet?.token_balance || 0) },
        assistant:{
          status:assistant?.session?.status || "stopped",
          specialist:assistant?.session?.specialist || null,
          used_seconds:Number(assistant?.used_seconds || 0),
          remaining_seconds:Number(assistant?.remaining_seconds || 0),
          included_seconds:Number(assistant?.included_seconds || 0)
        }
      });
    }

    if (mode === "library") {
      const lang = String(req.query?.lang || req.body?.lang || "pl") === "en" ? "en" : "pl";
      return res.status(200).json({ ok:true, products:await qualityLibrary(user.id, lang) });
    }

    if (mode === "emergency") {
      if (req.method === "GET") {
        const access=await getQualityEmergencyAccess(user.id);
        const data=access?.active ? await getQualityEmergencyAudit(user.id) : null;
        return res.status(200).json({ ok:true, access, data });
      }
      if (req.method !== "POST") {
        return res.status(405).json({ ok:false, error:"Method not allowed" });
      }
      const action=String(req.body?.action || "");
      if (action === "save") {
        const access=await getQualityEmergencyAccess(user.id);
        if(!access?.active){
          return res.status(402).json({ ok:false, error:"Emergency package required", access });
        }
        return res.status(200).json({ ok:true, access, data:await saveQualityEmergencyAudit(user.id, req.body?.payload || {}) });
      }
      return res.status(400).json({ ok:false, error:"Unknown Emergency Support action" });
    }

    if (mode === "owner-users") {
      if (req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });
      return res.status(200).json({ ok:true, data:await getQualityOwnerUsers(user.id, identity.authUserId) });
    }

    if (mode === "accountant") {
      if (req.method === "POST" && req.body?.action === "complete_channel_link") {
      if (identity.source !== "web" || !identity.authUserId) {
        return res.status(403).json({ ok:false, error:"Authenticated web account required." });
      }
      const linkToken=String(req.body?.token || "").trim();
      if (!/^[a-f0-9]{48}$/.test(linkToken)) {
        return res.status(400).json({ ok:false, error:"Invalid or expired account link." });
      }
      const linked=await completeQualityChannelLink(user.id, identity.authUserId, linkToken);
      return res.status(200).json({ ok:true, linked });
    }

    if (req.method === "GET") {
        const year = Number(req.query?.year || new Date().getFullYear());
        const quarter = Number(req.query?.quarter || Math.floor(new Date().getMonth()/3)+1);
        return res.status(200).json({ ok:true, data:await getQualityAccountingSummary(user.id, year, quarter, identity.authUserId) });
      }
      if (req.method !== "POST") {
        return res.status(405).json({ ok:false, error:"Method not allowed" });
      }
      const action = String(req.body?.action || "");
      if (action === "claim") {
        return res.status(200).json({ ok:true, data:await claimQualityAccountantOwner(user.id) });
      }
      if (action === "cost") {
        return res.status(200).json({ ok:true, data:await recordQualityAccountingCost(user.id, Number(req.body?.amount_grosz), req.body?.description, req.body?.document_ref, identity.authUserId) });
      }
      if (action === "reconcile") {
        return res.status(200).json({ ok:true, data:await reconcileQualityAccountingReceipt(user.id, req.body?.ledger_id, Number(req.body?.pit_received_grosz), identity.authUserId) });
      }
      return res.status(400).json({ ok:false, error:"Unknown accountant action" });
    }

    if (req.method === "GET") {
      const [profile, telegramProfile] = await Promise.all([
        getQualityCustomerProfile(user.id),
        getUserProfile(user.id)
      ]);

      const locale = telegramProfile?.locale || "pl";
      const legal = await getQualityLegalBundle(locale);

      return res.status(200).json({
        ok:true,
        locale,
        account: {
          id:user.id,
          first_name:user.first_name || "",
          last_name:user.last_name || "",
          username:user.username || ""
        },
        profile,
        legal,
        auth: { source: identity.source === "web" ? "web" : "linked", email: identity.email || profile?.email || null, publicConfig: publicSupabaseConfig() }
      });
    }

    if (req.body?.action === "legal_consent") {
      const locale = req.body?.locale === "en" ? "en" : "pl";
      const purchaseKind = String(req.body?.purchase_kind || "");
      const purchaseReference = String(req.body?.purchase_reference || "");
      const consent = await createQualityCheckoutConsent(
        user,
        purchaseKind,
        purchaseReference,
        req.body?.consent || {},
        locale,
        identity.source === "web" ? "web_app" : "linked_app"
      );
      return res.status(200).json({ ok:true, consent });
    }

    const profile = await upsertQualityCustomerProfile(user, {
      account_type:req.body?.account_type,
      first_name:req.body?.first_name,
      last_name:req.body?.last_name,
      email:req.body?.email,
      phone:req.body?.phone,
      job_title:req.body?.job_title,
      company_name:req.body?.company_name,
      tax_id:req.body?.tax_id,
      company_city:req.body?.company_city,
      company_country_code:req.body?.company_country_code || "PL",
      accept_terms:Boolean(req.body?.accept_terms),
      accept_privacy:Boolean(req.body?.accept_privacy)
    });

    return res.status(200).json({ ok:true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account setup failed";
    const status = (mode === "accountant" || mode === "owner-users") && /owner|forbidden|unauthori|access|accountant/i.test(message) ? 403 : 500;
    return res.status(status).json({ ok:false, error:message });
  }
}
