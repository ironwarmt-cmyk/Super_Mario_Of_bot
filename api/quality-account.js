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
  claimQualityAccountantOwner,
  recordQualityAccountingCost,
  reconcileQualityAccountingReceipt
} from "../lib/db.js";

export default async function handler(req, res) {
  if (!["GET","POST"].includes(req.method)) {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  const identity = await resolveQualityIdentity(req);
  if (!identity?.telegramUserId) {
    return res.status(401).json({ ok:false, error:"Sign in to Quality Hub or open it from Telegram." });
  }
  const user = identity.user || { id: identity.telegramUserId };

  const mode = String(req.query?.mode || "");

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

    if (mode === "accountant") {
      if (req.method === "GET") {
        const year = Number(req.query?.year || new Date().getFullYear());
        const quarter = Number(req.query?.quarter || Math.floor(new Date().getMonth()/3)+1);
        return res.status(200).json({ ok:true, data:await getQualityAccountingSummary(user.id, year, quarter) });
      }
      if (req.method !== "POST") {
        return res.status(405).json({ ok:false, error:"Method not allowed" });
      }
      const action = String(req.body?.action || "");
      if (action === "claim") {
        return res.status(200).json({ ok:true, data:await claimQualityAccountantOwner(user.id) });
      }
      if (action === "cost") {
        return res.status(200).json({ ok:true, data:await recordQualityAccountingCost(user.id, Number(req.body?.amount_grosz), req.body?.description, req.body?.document_ref) });
      }
      if (action === "reconcile") {
        return res.status(200).json({ ok:true, data:await reconcileQualityAccountingReceipt(user.id, req.body?.ledger_id, Number(req.body?.pit_received_grosz)) });
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
        telegram: {
          id:user.id,
          first_name:user.first_name || "",
          last_name:user.last_name || "",
          username:user.username || ""
        },
        profile,
        legal,
        auth: { source: identity.source, linkedTelegram: identity.telegramUserId > 0, email: identity.email || profile?.email || null, publicConfig: publicSupabaseConfig() }
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
        "telegram_webapp"
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
    return res.status(500).json({
      ok:false,
      error:error instanceof Error ? error.message : "Account setup failed"
    });
  }
}
