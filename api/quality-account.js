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
  completeQualityChannelLink
} from "../lib/db.js";

async function webAuthProxy(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  const action = String(req.body?.action || "");
  const base = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!base || !key) return res.status(503).json({ ok:false, error:"Web auth is not configured" });

  let path = "";
  let body = {};
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
  } else {
    return res.status(400).json({ ok:false, error:"Unknown web auth action" });
  }

  try {
    const upstream = await fetch(base + path, {
      method:"POST",
      headers:{ apikey:key, "content-type":"application/json" },
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

export default async function handler(req, res) {
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
