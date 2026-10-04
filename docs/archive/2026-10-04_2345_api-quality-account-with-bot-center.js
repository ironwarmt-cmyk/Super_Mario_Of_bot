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
    path = "/auth/v1/signup" + (redirect ? "?redirect_to=" + encodeURIComponent(redirect) : "");
    body = { email:String(req.body?.email || ""), password:String(req.body?.password || "") };
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

const BOT_CENTER_ENDPOINTS = {
  marioHealth: "https://mario-t-market-control-production.up.railway.app/health",
  marioReview: "https://mario-t-market-control-production.up.railway.app/management-review",
  andyHealth: "https://andy-b-quality-control-production.up.railway.app/health",
  andyCapa: "https://andy-b-quality-control-production.up.railway.app/coverage-capa",
  andyProfessor: "https://andy-b-quality-control-production.up.railway.app/professor-quality",
  andySignals: "https://andy-b-quality-control-production.up.railway.app/worker-signals/status",
  andyProgram: "https://andy-b-quality-control-production.up.railway.app/research-program/1m-14d",
  professorHealth: "https://crypto-360-paper-lab-production.up.railway.app/professor/health",
  professorSoak: "https://crypto-360-paper-lab-production.up.railway.app/professor/soak",
  professorSources: "https://crypto-360-paper-lab-production.up.railway.app/professor/source-coverage",
  swarmHealth: "https://swarm-paper-runner-production.up.railway.app/health"
};

async function botCenterReadJson(url) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent":"quality-bot-center/1.0" },
      signal: AbortSignal.timeout(7000)
    });
    const body = await response.json().catch(() => null);
    return { ok:response.ok, http:response.status, body };
  } catch (error) {
    return { ok:false, http:0, error:String(error), body:null };
  }
}

function botCenterServiceState(value) {
  if (!value?.ok) return "DOWN";
  if (value.body?.ok === false) return "DEGRADED";
  return "OK";
}

function botCenterPct(n, d) {
  return d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 1000) / 10)) : 0;
}

async function getBotCenterStatus() {
  const names = Object.keys(BOT_CENTER_ENDPOINTS);
  const values = await Promise.all(names.map((key) => botCenterReadJson(BOT_CENTER_ENDPOINTS[key])));
  const data = Object.fromEntries(names.map((key, index) => [key, values[index]]));

  const soak = data.professorSoak.body || {};
  const source = data.professorSources.body || {};
  const capa = data.andyCapa.body || {};
  const professorQuality = data.andyProfessor.body || {};
  const signals = data.andySignals.body || {};
  const review = data.marioReview.body || {};
  const program = data.andyProgram.body || {};

  const services = {
    mario: botCenterServiceState(data.marioHealth),
    andy: botCenterServiceState(data.andyHealth),
    professor: botCenterServiceState(data.professorHealth),
    workers: botCenterServiceState(data.swarmHealth)
  };

  const down = Object.entries(services).filter(([, state]) => state === "DOWN").map(([name]) => name);
  const soakPct = botCenterPct(Number(soak.elapsedMs || 0), Number(soak.targetMs || 0));
  const soakComplete = String(soak.status || "").toUpperCase() === "COMPLETED" || soakPct >= 100;
  const sourceGate = String(professorQuality.sourceCoverageGate || source.sourceCoverageGate || "UNKNOWN");
  const strategic = String(review.strategicStatus || "UNKNOWN");

  let decision = "GO_PAPER";
  let decisionReason = "Warunki badawcze spełnione.";
  if (down.length) {
    decision = "STOP";
    decisionReason = "Niedostępne usługi: " + down.join(", ");
  } else if (
    !soakComplete ||
    sourceGate !== "CLOSED" ||
    strategic === "OFF_COURSE" ||
    String(capa.status || "").toUpperCase() === "OPEN"
  ) {
    decision = "HOLD";
    const reasons = [];
    if (!soakComplete) reasons.push("soak 24 h w toku");
    if (sourceGate !== "CLOSED") reasons.push("coverage gate " + sourceGate);
    if (strategic === "OFF_COURSE") reasons.push("management review OFF_COURSE");
    if (String(capa.status || "").toUpperCase() === "OPEN") reasons.push("CAPA otwarta");
    decisionReason = reasons.join(" • ") || "Warunki jakościowe niezamknięte.";
  }

  return {
    generatedAt:new Date().toISOString(),
    mode:"research-paper-only",
    decision,
    decisionReason,
    services,
    soak:{
      status:soak.status || "UNKNOWN",
      progressPct:soakPct,
      elapsedMs:Number(soak.elapsedMs || 0),
      targetMs:Number(soak.targetMs || 0),
      persistentRestarts:Number(soak.persistentRestarts || 0),
      reconnects:Number(soak.reconnects || 0),
      events:Number(soak.events || 0),
      cycles:Number(soak.cycles || 0),
      passNow:Boolean(soak.passNow)
    },
    sourceCoverage:{
      gate:sourceGate,
      qualified:Number(source.qualified || source.counts?.QUALIFIED || 0),
      partial:Number(source.partial || source.counts?.PARTIAL || 0),
      unqualified:Number(source.unqualified || source.counts?.UNQUALIFIED || 0)
    },
    capa:{
      status:capa.status || "UNKNOWN",
      id:capa.id || null,
      rootCause:capa.rootCause || null,
      correctiveAction:capa.correctiveAction || null,
      effectiveness:capa.effectiveness || null
    },
    signals:{
      queued:Number(signals.queued || 0),
      received:Number(signals.audit?.received || 0),
      rejected:Number(signals.audit?.rejected || 0),
      duplicates:Number(signals.audit?.duplicates || 0),
      forwarded:Number(signals.audit?.forwarded || 0),
      lastAggregationAt:signals.audit?.lastAggregationAt || null
    },
    researchProgram:{
      id:program.program?.id || null,
      title:program.program?.title || "1 000 000 w 14 dni ze 100 zł",
      status:program.program?.status || "UNKNOWN",
      deliveryStatus:program.delivery?.status || "UNKNOWN",
      paperOnly:true
    },
    managementReview:{
      status:review.status || "UNKNOWN",
      strategicStatus:strategic,
      blockers:Array.isArray(review.blockers) ? review.blockers : [],
      actions:Array.isArray(review.actions) ? review.actions : []
    }
  };
}

export default async function handler(req, res) {
  if (!["GET","POST"].includes(req.method)) {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  const mode = String(req.query?.mode || "");
  if (mode === "web-auth") return webAuthProxy(req, res);

  const identity = await resolveQualityIdentity(req);
  if (!identity?.telegramUserId) {
    return res.status(401).json({ ok:false, error:"Sign in to Quality Hub or open it from Telegram." });
  }
  const user = identity.user || { id: identity.telegramUserId };

  try {
    if (mode === "bot-center") {
      if (req.method !== "GET") {
        return res.status(405).json({ ok:false, error:"Method not allowed" });
      }
      return res.status(200).json({ ok:true, ...(await getBotCenterStatus()) });
    }

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
