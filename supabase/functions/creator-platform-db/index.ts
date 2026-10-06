import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const EXPECTED_BOT_USERNAME = "Super_Mario_Official_bot";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let key = legacy || "";
  if (secretKeysRaw) {
    try { key = JSON.parse(secretKeysRaw).default || key; } catch {}
  }
  if (!url || !key) throw new Error("Supabase admin credentials unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readAuthHash(supabase: any) {
  const { data, error } = await supabase.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
  if (error) throw error;
  return data?.value?.secret_hash || null;
}

async function requireAuth(req: Request, supabase: any) {
  const supplied = req.headers.get("x-bot-secret") || "";
  if (!supplied) return false;
  const expected = await readAuthHash(supabase);
  return Boolean(expected && supplied === expected);
}

async function bootstrap(body: any, supabase: any) {
  const token = String(body?.telegram_token || "");
  if (!token) return json({ ok: false, error: "telegram_token is required" }, 400);
  const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const tg = await r.json();
  if (!r.ok || !tg?.ok) return json({ ok: false, error: "Telegram token validation failed" }, 401);
  if (tg?.result?.username !== EXPECTED_BOT_USERNAME) return json({ ok: false, error: "Token belongs to a different Telegram bot" }, 403);
  const secretHash = await sha256Hex(token);
  const existing = await readAuthHash(supabase);
  if (existing && existing !== secretHash) return json({ ok: false, error: "Bot database authentication is already initialized with another token" }, 409);
  const { error } = await supabase.from("platform_config").upsert({ key: "bot_auth", value: { secret_hash: secretHash, bot_username: EXPECTED_BOT_USERNAME }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  return json({ ok: true, initialized: true, bot_username: EXPECTED_BOT_USERNAME });
}

async function upsertTelegramUser(supabase: any, user: any) {
  const payload = { telegram_user_id: user.id, username: user.username || null, first_name: user.first_name || null, last_name: user.last_name || null, language_code: user.language_code || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("telegram_users").upsert(payload, { onConflict: "telegram_user_id" }).select().single();
  if (error) throw error;
  return data;
}

async function readQualityCompanyId(supabase: any, telegramUserId: number) {
  const { data, error } = await supabase
    .from("quality_customer_profiles")
    .select("company_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.company_id || null;
}

function renderLegalTemplate(body: string, profile: any) {
  const values: Record<string, string> = {
    SELLER_LEGAL_NAME: profile?.seller_legal_name || "",
    SELLER_LEGAL_FORM: profile?.seller_legal_form || "",
    SELLER_ADDRESS: profile?.seller_address || "",
    SELLER_TAX_ID: profile?.seller_tax_id || "",
    SELLER_EMAIL: profile?.seller_email || profile?.support_email || "",
    PRIVACY_EMAIL: profile?.privacy_email || profile?.seller_email || ""
  };
  return String(body || "").replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => values[key] ?? "");
}

async function legalDocumentHash(value: string) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const QUALITY_SPECIALISTS = new Set(["brc","ifs","haccp","complaints","capa","audit","documents","suppliers","traceability","labelling","change","management","legal","other"]);

function membershipIsActive(membership: any) {
  if (!membership || membership.status !== "active") return false;
  if (!membership.period_end) return true;
  return new Date(membership.period_end).getTime() > Date.now();
}

async function readQualityMembership(supabase: any, telegramUserId: number) {
  const { data, error } = await supabase.from("quality_memberships").select("*,quality_plans(*),quality_companies(*)").eq("telegram_user_id", telegramUserId).maybeSingle();
  if (error) throw error;

  let membership = data || null;
  if (
    membership?.status === "active" &&
    membership?.period_end &&
    new Date(membership.period_end).getTime() <= Date.now()
  ) {
    const { data: expired, error: expireError } = await supabase
      .from("quality_memberships")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("telegram_user_id", telegramUserId)
      .select("*,quality_plans(*),quality_companies(*)")
      .single();
    if (expireError) throw expireError;
    membership = expired;
  }

  return membership;
}

async function getQualityProductBySlug(supabase: any, slug: string) {
  const { data, error } = await supabase.from("quality_products").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function readQualityProductAccess(supabase: any, telegramUserId: number, slug: string) {
  const product = await getQualityProductBySlug(supabase, slug);
  if (!product) return { product: null, membership: null, purchased: false, unlocked: false, source: null };
  const [membership, purchase, stripePurchase] = await Promise.all([
    readQualityMembership(supabase, telegramUserId),
    supabase.from("quality_product_purchases").select("id,created_at").eq("telegram_user_id", telegramUserId).eq("product_id", product.id).maybeSingle(),
    supabase.from("quality_stripe_product_purchases").select("id,created_at,status").eq("telegram_user_id", telegramUserId).eq("product_id", product.id).eq("status","paid").maybeSingle()
  ]);
  if (purchase.error) throw purchase.error;
  if (stripePurchase.error) throw stripePurchase.error;
  const tierRank = Number(membership?.quality_plans?.tier_rank || 0);
  const planUnlocked = membershipIsActive(membership) && tierRank >= Number(product.minimum_tier_rank || 1);
  const purchased = Boolean(purchase.data || stripePurchase.data);
  const purchaseSource = stripePurchase.data ? "stripe_purchase" : purchase.data ? "purchase" : null;
  return { product, membership, purchased, unlocked: planUnlocked || purchased, source: purchaseSource || (planUnlocked ? "plan" : null) };
}

async function settleQualityAssistantTime(supabase: any, telegramUserId: number) {
  const membership = await readQualityMembership(supabase, telegramUserId);
  const includedSeconds = Number(membership?.quality_plans?.included_chat_minutes || 0) * 60;
  const { data: session, error: sessionError } = await supabase.from("quality_assistant_sessions").select("*").eq("telegram_user_id", telegramUserId).maybeSingle();
  if (sessionError) throw sessionError;
  let usedSeconds = Number(membership?.assistant_seconds_used || 0);
  let currentSession = session || null;
  const activeMembership = membershipIsActive(membership);

  if (!activeMembership && currentSession?.status === "active") {
    const { data: stoppedSession, error: stopError } = await supabase
      .from("quality_assistant_sessions")
      .update({
        status: "stopped",
        last_heartbeat_at: null,
        updated_at: new Date().toISOString()
      })
      .eq("telegram_user_id", telegramUserId)
      .select()
      .single();
    if (stopError) throw stopError;
    currentSession = stoppedSession;
  }

  if (activeMembership && currentSession?.status === "active" && currentSession.last_heartbeat_at && includedSeconds > usedSeconds) {
    const now = Date.now();
    const last = new Date(currentSession.last_heartbeat_at).getTime();
    const delta = Math.min(Math.max(0, Math.floor((now - last) / 1000)), 60, includedSeconds - usedSeconds);
    if (delta > 0) {
      usedSeconds += delta;
      const { error: membershipError } = await supabase.from("quality_memberships").update({ assistant_seconds_used: usedSeconds, chat_minutes_used: Math.floor(usedSeconds / 60), updated_at: new Date(now).toISOString() }).eq("telegram_user_id", telegramUserId);
      if (membershipError) throw membershipError;
      const remaining = Math.max(0, includedSeconds - usedSeconds);
      const { data: updatedSession, error: updateError } = await supabase.from("quality_assistant_sessions").update({ session_seconds: Number(currentSession.session_seconds || 0) + delta, last_heartbeat_at: new Date(now).toISOString(), status: remaining > 0 ? "active" : "stopped", updated_at: new Date(now).toISOString() }).eq("telegram_user_id", telegramUserId).select().single();
      if (updateError) throw updateError;
      currentSession = updatedSession;
    }
  }
  return { membership, session: currentSession, included_seconds: includedSeconds, used_seconds: usedSeconds, remaining_seconds: Math.max(0, includedSeconds - usedSeconds) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const supabase = adminClient();
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "bootstrap") return await bootstrap(body, supabase);
    if (!(await requireAuth(req, supabase))) return json({ ok: false, error: "Unauthorized" }, 401);

    if (action === "upsert_user") return json({ ok: true, data: await upsertTelegramUser(supabase, body?.user) });

    if (action === "get_user_profile") {
      const uid = body?.telegram_user_id;
      const { data: user, error: userError } = await supabase.from("telegram_users").select("telegram_user_id,username,first_name,last_name,language_code,locale").eq("telegram_user_id", uid).maybeSingle();
      if (userError) throw userError;
      const { data: admin, error: adminError } = await supabase.from("platform_admins").select("telegram_user_id").eq("telegram_user_id", uid).maybeSingle();
      if (adminError) throw adminError;
      return json({ ok: true, data: { ...(user || { telegram_user_id: uid, locale: null }), is_admin: Boolean(admin) } });
    }

    if (action === "set_user_locale") {
      const { data, error } = await supabase.from("telegram_users").update({ locale: body?.locale === "en" ? "en" : "pl", updated_at: new Date().toISOString() }).eq("telegram_user_id", body?.telegram_user_id).select("telegram_user_id,locale").maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "get_quality_sales_snapshot") {
      const telegramUserId = Number(body?.telegram_user_id);
      if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
        return json({ ok: false, error: "Invalid user" }, 400);
      }

      const { data: profile, error: profileError } = await supabase
        .from("telegram_users")
        .select("is_admin")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.is_admin) {
        return json({ ok: false, error: "Admin access required" }, 403);
      }

      const { data, error } = await supabase.rpc("quality_sales_snapshot");
      if (error) throw error;
      return json({ ok: true, data: data || {} });
    }

    if (action === "record_quality_external_sale") {
      const sale = body?.sale || {};
      const sourceType = String(sale.source_type || "");
      const allowed = new Set(["stripe_service","manual"]);
      if (!allowed.has(sourceType)) {
        return json({ ok: false, error: "Invalid external sale type" }, 400);
      }
      const sourceReference = String(sale.source_reference || "");
      const amountPln = Number(sale.amount_pln_gross);
      if (!sourceReference || !Number.isFinite(amountPln) || amountPln < 0) {
        return json({ ok: false, error: "Invalid external sale" }, 400);
      }

      const { data, error } = await supabase
        .from("quality_sales_ledger")
        .upsert({
          source_type: sourceType,
          source_reference: sourceReference,
          telegram_user_id: Number(sale.telegram_user_id || 0) > 0 ? Number(sale.telegram_user_id) : null,
          status: sale.status === "refunded" ? "refunded" : "paid",
          amount_original: Number.isFinite(Number(sale.amount_original)) ? Number(sale.amount_original) : amountPln,
          currency: String(sale.currency || "PLN").toUpperCase(),
          amount_pln_gross: amountPln,
          sold_at: sale.sold_at || new Date().toISOString(),
          refunded_at: sale.status === "refunded" ? (sale.refunded_at || new Date().toISOString()) : null,
          customer_country_code: sale.customer_country_code ? String(sale.customer_country_code).toUpperCase().slice(0,2) : null,
          metadata: sale.metadata && typeof sale.metadata === "object" ? sale.metadata : {},
          updated_at: new Date().toISOString()
        }, { onConflict: "source_reference" })
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "mark_quality_sale_compliance") {
      const sourceReference = String(body?.source_reference || "");
      if (!sourceReference) return json({ ok: false, error: "Sale reference required" }, 400);

      const patch: any = { updated_at: new Date().toISOString() };
      if ("invoice_issued_outside_ksef" in body) patch.invoice_issued_outside_ksef = Boolean(body.invoice_issued_outside_ksef);
      if ("invoice_number" in body) patch.invoice_number = body.invoice_number ? String(body.invoice_number).slice(0,120) : null;
      if ("customer_country_code" in body) patch.customer_country_code = body.customer_country_code ? String(body.customer_country_code).toUpperCase().slice(0,2) : null;
      if ("oss_eligible" in body) patch.oss_eligible = Boolean(body.oss_eligible);
      if ("amount_eur_net" in body) {
        const eur = Number(body.amount_eur_net);
        patch.amount_eur_net = Number.isFinite(eur) && eur >= 0 ? eur : null;
      }

      const { data, error } = await supabase
        .from("quality_sales_ledger")
        .update(patch)
        .eq("source_reference", sourceReference)
        .select()
        .maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "get_quality_legal_bundle") {
      const locale = body?.locale === "en" ? "en" : "pl";

      const [{ data: profile, error: profileError }, { data: docs, error: docsError }] = await Promise.all([
        supabase.from("quality_legal_profile").select("*").eq("id", "primary").maybeSingle(),
        supabase
          .from("quality_legal_documents")
          .select("id,document_key,locale,version,title,body_md,status,required_for_checkout,acceptance_mode,effective_at")
          .eq("locale", locale)
          .eq("status", "active")
          .order("document_key", { ascending: true })
      ]);

      if (profileError) throw profileError;
      if (docsError) throw docsError;

      const rendered = await Promise.all((docs || []).map(async (doc: any) => {
        const bodyMd = renderLegalTemplate(doc.body_md, profile || {});
        return {
          ...doc,
          body_md: bodyMd,
          content_hash: await legalDocumentHash(bodyMd)
        };
      }));

      const requiredKeys = [
        "terms",
        "privacy",
        "educational_disclaimer",
        "content_license",
        "digital_content_withdrawal",
        "service_early_performance"
      ];
      const available = new Set(rendered.map((d: any) => d.document_key));
      const profileReady = Boolean(
        profile?.seller_legal_name &&
        profile?.seller_address &&
        profile?.seller_tax_id &&
        profile?.seller_email &&
        profile?.privacy_email
      );

      return json({
        ok: true,
        data: {
          legal_ready: profileReady && requiredKeys.every((key) => available.has(key)),
          profile_ready: profileReady,
          missing_documents: requiredKeys.filter((key) => !available.has(key)),
          documents: rendered
        }
      });
    }

    if (action === "get_quality_account_legal_status") {
      const telegramUserId = Number(body?.telegram_user_id);
      const locale = body?.locale === "en" ? "en" : "pl";
      const keys = ["terms","privacy","educational_disclaimer","content_license"];

      const { data: docs, error: docsError } = await supabase
        .from("quality_legal_documents")
        .select("id,document_key,version")
        .eq("locale", locale)
        .eq("status", "active")
        .in("document_key", keys);
      if (docsError) throw docsError;

      const docIds = (docs || []).map((d: any) => d.id);
      let accepts: any[] = [];
      if (docIds.length) {
        const { data, error } = await supabase
          .from("quality_legal_acceptances")
          .select("document_id,document_version,accepted_at")
          .eq("telegram_user_id", telegramUserId)
          .eq("acceptance_scope", "account")
          .in("document_id", docIds);
        if (error) throw error;
        accepts = data || [];
      }

      const accepted = new Map(accepts.map((a: any) => [String(a.document_id), a]));
      const missing = (docs || []).filter((d: any) => {
        const a = accepted.get(String(d.id));
        return !a || a.document_version !== d.version;
      });

      return json({
        ok: true,
        data: {
          complete: (docs || []).length === keys.length && missing.length === 0,
          missing: missing.map((d: any) => ({ document_key: d.document_key, version: d.version })),
          active_versions: (docs || []).map((d: any) => ({ document_key: d.document_key, version: d.version }))
        }
      });
    }

    if (action === "accept_quality_account_legal_bundle") {
      const user = body?.user;
      const locale = body?.locale === "en" ? "en" : "pl";
      const acknowledgement = body?.acknowledgement || {};
      if (!user?.id) return json({ ok: false, error: "User is required" }, 400);
      if (
        !acknowledgement.accepted_terms ||
        !acknowledgement.acknowledged_privacy ||
        !acknowledgement.accepted_license ||
        !acknowledgement.acknowledged_disclaimer
      ) {
        return json({ ok: false, error: "All required legal acknowledgements are required" }, 400);
      }

      const customerCapacity = String(acknowledgement.customer_capacity || "");
      if (!new Set(["consumer","entrepreneur_professional","entrepreneur_consumer_rights"]).has(customerCapacity)) {
        return json({ ok: false, error: "Customer legal capacity is required" }, 400);
      }

      await upsertTelegramUser(supabase, user);
      const [{ data: profile, error: profileError }, { data: docs, error: docsError }] = await Promise.all([
        supabase.from("quality_legal_profile").select("*").eq("id","primary").maybeSingle(),
        supabase
          .from("quality_legal_documents")
          .select("id,document_key,version,body_md")
          .eq("locale", locale)
          .eq("status","active")
          .in("document_key", ["terms","privacy","educational_disclaimer","content_license"])
      ]);
      if (profileError) throw profileError;
      if (docsError) throw docsError;
      if ((docs || []).length !== 4) return json({ ok: false, error: "Legal bundle is incomplete" }, 503);

      for (const doc of docs || []) {
        const rendered = renderLegalTemplate(doc.body_md, profile || {});
        const hash = await legalDocumentHash(rendered);
        const { error } = await supabase
          .from("quality_legal_acceptances")
          .insert({
            telegram_user_id: user.id,
            document_id: doc.id,
            document_version: doc.version,
            document_hash: hash,
            acceptance_scope: "account",
            source: body?.source || "telegram_webapp",
            metadata: { customer_capacity: customerCapacity, locale }
          });
        if (error) throw error;
      }

      return json({ ok: true, data: { complete: true } });
    }

    if (action === "create_quality_checkout_consent") {
      const user = body?.user;
      const purchaseKind = String(body?.purchase_kind || "");
      const purchaseReference = String(body?.purchase_reference || "");
      const consent = body?.consent || {};

      if (!user?.id || !purchaseKind || !purchaseReference) {
        return json({ ok: false, error: "Invalid legal consent request" }, 400);
      }

      const [{ data: legalProfile, error: legalProfileError }, legalBundle] = await Promise.all([
        supabase.from("quality_legal_profile").select("*").eq("id", "primary").maybeSingle(),
        supabase
          .from("quality_legal_documents")
          .select("id,document_key,version,body_md")
          .eq("locale", body?.locale === "en" ? "en" : "pl")
          .eq("status", "active")
          .eq("required_for_checkout", true)
      ]);

      if (legalProfileError) throw legalProfileError;
      if (legalBundle.error) throw legalBundle.error;

      const required = new Map((legalBundle.data || []).map((d: any) => [d.document_key, d]));
      for (const key of ["terms","privacy","educational_disclaimer","content_license"]) {
        if (!required.has(key)) {
          return json({ ok: false, error: "Legal bundle is not ready" }, 503);
        }
      }

      if (!consent.accepted_terms || !consent.acknowledged_privacy || !consent.accepted_license) {
        return json({ ok: false, error: "Required legal acknowledgements are missing" }, 400);
      }

      const customerCapacity = String(consent.customer_capacity || "");
      const allowedCapacities = new Set([
        "consumer",
        "entrepreneur_professional",
        "entrepreneur_consumer_rights"
      ]);
      if (!allowedCapacities.has(customerCapacity)) {
        return json({ ok: false, error: "Customer legal capacity is required" }, 400);
      }

      const digitalKinds = new Set(["plan","digital_product","ebook","training"]);
      const serviceKinds = new Set(["service","expert_service"]);

      if (digitalKinds.has(purchaseKind)) {
        if (!required.has("digital_content_withdrawal")) {
          return json({ ok: false, error: "Digital withdrawal notice is missing" }, 503);
        }
        if (!consent.requested_immediate_delivery || !consent.acknowledged_loss_of_withdrawal) {
          return json({ ok: false, error: "Explicit digital-content consent is required" }, 400);
        }
      }

      if (serviceKinds.has(purchaseKind) && consent.requested_immediate_delivery) {
        if (!required.has("service_early_performance")) {
          return json({ ok: false, error: "Service early-performance notice is missing" }, 503);
        }
        if (!consent.acknowledged_loss_of_withdrawal) {
          return json({ ok: false, error: "Service early-performance acknowledgement is required" }, 400);
        }
      }

      await upsertTelegramUser(supabase, user);

      const versions = Array.from(required.values())
        .map((d: any) => `${d.document_key}@${d.version}`)
        .sort()
        .join("|");

      const { data: row, error: consentError } = await supabase
        .from("quality_checkout_consents")
        .insert({
          telegram_user_id: user.id,
          purchase_kind: purchaseKind,
          purchase_reference: purchaseReference,
          accepted_terms: true,
          acknowledged_privacy: true,
          accepted_license: true,
          requested_immediate_delivery: Boolean(consent.requested_immediate_delivery),
          acknowledged_loss_of_withdrawal: Boolean(consent.acknowledged_loss_of_withdrawal),
          marketing_consent: Boolean(consent.marketing_consent),
          legal_bundle_version: versions,
          customer_capacity: customerCapacity,
          metadata: {
            locale: body?.locale === "en" ? "en" : "pl",
            source: body?.source || "telegram_webapp"
          }
        })
        .select()
        .single();

      if (consentError) throw consentError;

      for (const doc of required.values()) {
        const renderedBody = renderLegalTemplate(doc.body_md, legalProfile || {});
        const hash = await legalDocumentHash(renderedBody);
        const { error: acceptanceError } = await supabase
          .from("quality_legal_acceptances")
          .insert({
            telegram_user_id: user.id,
            document_id: doc.id,
            document_version: doc.version,
            document_hash: hash,
            acceptance_scope: "purchase",
            purchase_kind: purchaseKind,
            purchase_reference: purchaseReference,
            source: body?.source || "telegram_webapp",
            metadata: { consent_token: row.consent_token }
          });
        if (acceptanceError) throw acceptanceError;
      }

      return json({ ok: true, data: row });
    }

    if (action === "validate_quality_checkout_consent") {
      const telegramUserId = Number(body?.telegram_user_id);
      const consentToken = String(body?.consent_token || "");
      const purchaseKind = String(body?.purchase_kind || "");
      const purchaseReference = String(body?.purchase_reference || "");

      const { data: row, error } = await supabase
        .from("quality_checkout_consents")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .eq("consent_token", consentToken)
        .eq("purchase_kind", purchaseKind)
        .eq("purchase_reference", purchaseReference)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: row || null });
    }

    if (action === "consume_quality_checkout_consent") {
      const telegramUserId = Number(body?.telegram_user_id);
      const consentToken = String(body?.consent_token || "");

      const { data: row, error } = await supabase
        .from("quality_checkout_consents")
        .update({ consumed_at: new Date().toISOString() })
        .eq("telegram_user_id", telegramUserId)
        .eq("consent_token", consentToken)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .select()
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: row || null });
    }

    if (action === "list_quality_plans") {
      const { data, error } = await supabase.from("quality_plans").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_quality_plan") {
      const q = supabase.from("quality_plans").select("*").eq("active", true);
      const { data, error } = body?.slug ? await q.eq("slug", body.slug).maybeSingle() : await q.eq("id", body?.plan_id).maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "list_quality_products") {
      let maxTier = Number(body?.max_tier_rank || 3); if (!Number.isFinite(maxTier)) maxTier = 3;
      const { data, error } = await supabase.from("quality_products").select("*").eq("active", true).lte("minimum_tier_rank", maxTier).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_quality_product") return json({ ok: true, data: await getQualityProductBySlug(supabase, String(body?.slug || "")) });

    if (action === "get_quality_product_access") return json({ ok: true, data: await readQualityProductAccess(supabase, Number(body?.telegram_user_id), String(body?.slug || "")) });

    if (action === "list_quality_services") {
      const { data, error } = await supabase.from("quality_services").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "list_quality_token_packs") {
      const { data, error } = await supabase.from("quality_token_packs").select("*").eq("active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "get_quality_wallet") {
      const uid = body?.telegram_user_id;
      const { data, error } = await supabase.from("quality_wallets").select("telegram_user_id,token_balance,updated_at").eq("telegram_user_id", uid).maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || { telegram_user_id: uid, token_balance: 0 } });
    }

    if (action === "get_quality_token_pack") {
      const { data, error } = await supabase.from("quality_token_packs").select("*").eq("tokens", Number(body?.tokens || 0)).eq("active", true).maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "record_quality_token_payment") {
      const user = body?.user; const payment = body?.payment || {};
      const match = /^qa_token:(\\d+)(?::([0-9a-f-]{36}))?$/i.exec(String(payment.invoice_payload || ""));
      if (!user?.id || !payment?.telegram_payment_charge_id || !match) return json({ ok: false, error: "Invalid token payment" }, 400);
      const tokens = Number(match[1]);
      const { data: pack, error: packError } = await supabase.from("quality_token_packs").select("*").eq("tokens", tokens).eq("active", true).maybeSingle();
      if (packError) throw packError;
      if (!pack || payment.currency !== "XTR" || Number(payment.total_amount) !== Number(pack.price_stars)) return json({ ok: false, error: "Token payment amount mismatch" }, 400);
      await upsertTelegramUser(supabase, user);
      const companyId = await readQualityCompanyId(supabase, user.id);
      const { data: existing, error: existingError } = await supabase.from("quality_token_purchases").select("id").eq("telegram_payment_charge_id", payment.telegram_payment_charge_id).maybeSingle();
      if (existingError) throw existingError;
      if (!existing) {
        const { error: purchaseError } = await supabase.from("quality_token_purchases").insert({ telegram_user_id: user.id, company_id: companyId, tokens, stars_paid: payment.total_amount, telegram_payment_charge_id: payment.telegram_payment_charge_id });
        if (purchaseError) throw purchaseError;
        const { data: balance, error: creditError } = await supabase.rpc("credit_quality_tokens", { p_user: user.id, p_tokens: tokens });
        if (creditError) throw creditError;
        return json({ ok: true, data: { tokens_added: tokens, token_balance: Number(balance || 0), duplicate: false } });
      }
      const wallet = await supabase.from("quality_wallets").select("token_balance").eq("telegram_user_id", user.id).maybeSingle();
      if (wallet.error) throw wallet.error;
      return json({ ok: true, data: { tokens_added: 0, token_balance: Number(wallet.data?.token_balance || 0), duplicate: true } });
    }

    if (action === "get_quality_membership") return json({ ok: true, data: await readQualityMembership(supabase, body?.telegram_user_id) });

    if (action === "create_quality_stripe_checkout_intent") {
      const telegramUserId = Number(body?.telegram_user_id);
      const token = String(body?.token || "").trim();
      const purchaseKind = String(body?.purchase_kind || "").toLowerCase();
      const purchaseReference = String(body?.purchase_reference || "").toLowerCase();

      if (
        !Number.isSafeInteger(telegramUserId) ||
        telegramUserId === 0 ||
        !/^[a-f0-9]{48}$/.test(token) ||
        !["plan","product"].includes(purchaseKind) ||
        !/^[a-z0-9-]+$/.test(purchaseReference)
      ) {
        return json({ ok:false, error:"Invalid Stripe checkout intent" }, 400);
      }

      const { data:userRow, error:userError } = await supabase
        .from("telegram_users")
        .select("telegram_user_id")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();
      if (userError) throw userError;
      if (!userRow) return json({ ok:false, error:"Shared user not found" }, 404);

      if (purchaseKind === "plan") {
        const { data:plan, error:planError } = await supabase
          .from("quality_plans")
          .select("slug,active,checkout_enabled")
          .eq("slug", purchaseReference)
          .maybeSingle();
        if (planError) throw planError;
        if (!plan?.active || !plan?.checkout_enabled) {
          return json({ ok:false, error:"Plan unavailable" }, 404);
        }
      } else {
        const product = await getQualityProductBySlug(supabase, purchaseReference);
        if (!product?.active || !product?.standalone_purchase_enabled) {
          return json({ ok:false, error:"Product unavailable" }, 404);
        }
      }

      const { data:intent, error:intentError } = await supabase
        .from("quality_stripe_checkout_intents")
        .insert({
          token,
          telegram_user_id:telegramUserId,
          purchase_kind:purchaseKind,
          purchase_reference:purchaseReference,
          expires_at:new Date(Date.now()+2*60*60*1000).toISOString()
        })
        .select("token,expires_at")
        .single();
      if (intentError) throw intentError;
      return json({ ok:true, data:intent });
    }

    if (action === "resolve_quality_stripe_checkout_intent") {
      const token = String(body?.token || "").trim();
      const sessionId = String(body?.stripe_checkout_session_id || "").trim();
      if (!/^[a-f0-9]{48}$/.test(token) || !/^cs_/.test(sessionId)) {
        return json({ ok:false, error:"Invalid Stripe checkout reference" }, 400);
      }

      const { data:intent, error:readError } = await supabase
        .from("quality_stripe_checkout_intents")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (readError) throw readError;
      if (!intent) return json({ ok:false, error:"Checkout intent not found" }, 404);

      if (intent.consumed_at) {
        if (String(intent.stripe_checkout_session_id || "") !== sessionId) {
          return json({ ok:false, error:"Checkout intent already consumed" }, 409);
        }
        return json({
          ok:true,
          data:{
            telegram_user_id:Number(intent.telegram_user_id),
            purchase_kind:intent.purchase_kind,
            purchase_reference:intent.purchase_reference,
            duplicate:true
          }
        });
      }

      if (!intent.expires_at || new Date(intent.expires_at).getTime() <= Date.now()) {
        return json({ ok:false, error:"Checkout intent expired" }, 410);
      }

      const { data:consumed, error:updateError } = await supabase
        .from("quality_stripe_checkout_intents")
        .update({
          stripe_checkout_session_id:sessionId,
          consumed_at:new Date().toISOString()
        })
        .eq("id", intent.id)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("*")
        .maybeSingle();
      if (updateError) throw updateError;

      if (!consumed) {
        const { data:race, error:raceError } = await supabase
          .from("quality_stripe_checkout_intents")
          .select("*")
          .eq("id", intent.id)
          .maybeSingle();
        if (raceError) throw raceError;
        if (race?.consumed_at && String(race.stripe_checkout_session_id || "") === sessionId) {
          return json({
            ok:true,
            data:{
              telegram_user_id:Number(race.telegram_user_id),
              purchase_kind:race.purchase_kind,
              purchase_reference:race.purchase_reference,
              duplicate:true
            }
          });
        }
        return json({ ok:false, error:"Checkout intent could not be consumed" }, 409);
      }

      return json({
        ok:true,
        data:{
          telegram_user_id:Number(consumed.telegram_user_id),
          purchase_kind:consumed.purchase_kind,
          purchase_reference:consumed.purchase_reference,
          duplicate:false
        }
      });
    }

    if (action === "record_quality_stripe_plan_payment") {
      const telegramUserId = Number(body?.telegram_user_id);
      const payment = body?.payment || {};
      const planSlug = String(payment.plan_slug || "").toLowerCase();
      const checkoutSessionId = String(payment.checkout_session_id || "");
      const subscriptionId = String(payment.subscription_id || "");
      const customerId = String(payment.customer_id || "");
      const amountTotal = Number(payment.amount_total);
      const currency = String(payment.currency || "").toLowerCase();

      if (!Number.isSafeInteger(telegramUserId) || telegramUserId === 0 || !checkoutSessionId || !planSlug) {
        return json({ ok:false, error:"Invalid Stripe plan payment" }, 400);
      }

      const { data: sharedUser, error: userError } = await supabase
        .from("telegram_users")
        .select("telegram_user_id")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();
      if (userError) throw userError;
      if (!sharedUser) return json({ ok:false, error:"Shared user not found" }, 404);

      const { data: plan, error: planError } = await supabase
        .from("quality_plans")
        .select("*")
        .eq("slug", planSlug)
        .eq("active", true)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan || !plan.checkout_enabled) return json({ ok:false, error:"Plan unavailable" }, 404);

      const expected = Math.round(Number(plan.display_price_pln || 0) * 100);
      if (!Number.isFinite(amountTotal) || amountTotal !== expected || currency !== "pln") {
        return json({ ok:false, error:"Stripe plan payment amount mismatch" }, 400);
      }

      const { data: existing, error: existingError } = await supabase
        .from("quality_stripe_plan_payments")
        .select("id")
        .eq("stripe_checkout_session_id", checkoutSessionId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        return json({ ok:true, data:{ duplicate:true, plan, membership:await readQualityMembership(supabase, telegramUserId) } });
      }

      const companyId = await readQualityCompanyId(supabase, telegramUserId);
      const now = new Date();
      let periodStart = payment.period_start ? new Date(payment.period_start) : now;
      let periodEnd = payment.period_end ? new Date(payment.period_end) : new Date(now.getTime() + 31 * 86400000);
      if (!Number.isFinite(periodStart.getTime())) periodStart = now;
      if (!Number.isFinite(periodEnd.getTime()) || periodEnd <= periodStart) periodEnd = new Date(periodStart.getTime() + 31 * 86400000);

      const { error: payError } = await supabase
        .from("quality_stripe_plan_payments")
        .insert({
          telegram_user_id: telegramUserId,
          plan_id: plan.id,
          stripe_checkout_session_id: checkoutSessionId,
          stripe_subscription_id: subscriptionId || null,
          stripe_customer_id: customerId || null,
          amount_paid_grosz: amountTotal,
          currency,
          status: "paid",
          event_kind: "checkout",
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString()
        });
      if (payError) throw payError;

      const { data: membership, error: membershipError } = await supabase
        .from("quality_memberships")
        .upsert({
          telegram_user_id: telegramUserId,
          company_id: companyId,
          plan_id: plan.id,
          status: "active",
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          custom_docs_used: 0,
          chat_minutes_used: 0,
          assistant_seconds_used: 0,
          selected_training_product_id: null,
          telegram_subscription_charge_id: null,
          auto_renew: true,
          payment_provider: "stripe",
          provider_subscription_id: subscriptionId || null,
          provider_customer_id: customerId || null,
          updated_at: new Date().toISOString()
        }, { onConflict:"telegram_user_id" })
        .select("*,quality_plans(*),quality_companies(*)")
        .single();
      if (membershipError) throw membershipError;

      return json({ ok:true, data:{ duplicate:false, plan, membership } });
    }

    if (action === "record_quality_stripe_product_payment") {
      const telegramUserId = Number(body?.telegram_user_id);
      const payment = body?.payment || {};
      const productSlug = String(payment.product_slug || "").toLowerCase();
      const checkoutSessionId = String(payment.checkout_session_id || "");
      const amountTotal = Number(payment.amount_total);
      const currency = String(payment.currency || "").toLowerCase();

      if (!Number.isSafeInteger(telegramUserId) || telegramUserId === 0 || !checkoutSessionId || !productSlug) {
        return json({ ok:false, error:"Invalid Stripe product payment" }, 400);
      }

      const product = await getQualityProductBySlug(supabase, productSlug);
      if (!product || !product.standalone_purchase_enabled) return json({ ok:false, error:"Product unavailable" }, 404);
      const expected = Math.round(Number(product.standalone_price_pln || 0) * 100);
      if (!Number.isFinite(amountTotal) || amountTotal !== expected || currency !== "pln") {
        return json({ ok:false, error:"Stripe product payment amount mismatch" }, 400);
      }

      const { data: existing, error: existingError } = await supabase
        .from("quality_stripe_product_purchases")
        .select("id")
        .eq("telegram_user_id", telegramUserId)
        .eq("product_id", product.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ ok:true, data:{ duplicate:true, product } });

      const { error: insertError } = await supabase
        .from("quality_stripe_product_purchases")
        .insert({
          telegram_user_id: telegramUserId,
          product_id: product.id,
          stripe_checkout_session_id: checkoutSessionId,
          stripe_payment_intent_id: payment.payment_intent_id ? String(payment.payment_intent_id) : null,
          stripe_customer_id: payment.customer_id ? String(payment.customer_id) : null,
          amount_paid_grosz: amountTotal,
          currency,
          status:"paid"
        });
      if (insertError) throw insertError;
      return json({ ok:true, data:{ duplicate:false, product } });
    }

    if (action === "sync_quality_stripe_subscription") {
      const subscriptionId = String(body?.subscription_id || "");
      const invoiceId = String(body?.invoice_id || "");
      const customerId = String(body?.customer_id || "");
      const providerStatus = String(body?.status || "").toLowerCase();
      const eventKind = String(body?.event_kind || "subscription");
      if (!subscriptionId) return json({ ok:false, error:"Stripe subscription id required" }, 400);

      const { data: membership, error: membershipReadError } = await supabase
        .from("quality_memberships")
        .select("*")
        .eq("provider_subscription_id", subscriptionId)
        .maybeSingle();
      if (membershipReadError) throw membershipReadError;
      if (!membership) return json({ ok:true, data:{ matched:false } });

      let periodStart = body?.period_start ? new Date(body.period_start) : null;
      let periodEnd = body?.period_end ? new Date(body.period_end) : null;
      if (periodStart && !Number.isFinite(periodStart.getTime())) periodStart = null;
      if (periodEnd && !Number.isFinite(periodEnd.getTime())) periodEnd = null;

      if (invoiceId) {
        const { data: existingInvoice, error: invoiceReadError } = await supabase
          .from("quality_stripe_plan_payments")
          .select("id")
          .eq("stripe_invoice_id", invoiceId)
          .maybeSingle();
        if (invoiceReadError) throw invoiceReadError;
        if (!existingInvoice) {
          const amountPaid = Number(body?.amount_paid);
          const currency = String(body?.currency || "pln").toLowerCase();
          const { data: initialRow, error: initialReadError } = await supabase
            .from("quality_stripe_plan_payments")
            .select("id")
            .eq("stripe_subscription_id", subscriptionId)
            .is("stripe_invoice_id", null)
            .order("created_at",{ascending:false})
            .limit(1)
            .maybeSingle();
          if (initialReadError) throw initialReadError;

          if (initialRow) {
            const { error:updatePaymentError } = await supabase
              .from("quality_stripe_plan_payments")
              .update({
                stripe_invoice_id: invoiceId,
                amount_paid_grosz: Number.isFinite(amountPaid) ? amountPaid : 0,
                currency,
                period_start: periodStart ? periodStart.toISOString() : null,
                period_end: periodEnd ? periodEnd.toISOString() : null,
                event_kind: eventKind,
                updated_at:new Date().toISOString()
              })
              .eq("id", initialRow.id);
            if (updatePaymentError) throw updatePaymentError;
          } else {
            const { error:insertInvoiceError } = await supabase
              .from("quality_stripe_plan_payments")
              .insert({
                telegram_user_id: membership.telegram_user_id,
                plan_id: membership.plan_id,
                stripe_checkout_session_id:null,
                stripe_invoice_id:invoiceId,
                stripe_subscription_id:subscriptionId,
                stripe_customer_id:customerId || membership.provider_customer_id || null,
                amount_paid_grosz:Number.isFinite(amountPaid) ? amountPaid : 0,
                currency,
                status:"paid",
                event_kind:eventKind,
                period_start:periodStart ? periodStart.toISOString() : null,
                period_end:periodEnd ? periodEnd.toISOString() : null
              });
            if (insertInvoiceError) throw insertInvoiceError;
          }
        }
      }

      const cancel = eventKind === "deleted" || ["canceled","cancelled","unpaid","incomplete_expired"].includes(providerStatus);
      const activate = eventKind === "invoice_paid" || ["active","trialing"].includes(providerStatus);
      const patch:any = {
        provider_customer_id: customerId || membership.provider_customer_id || null,
        updated_at:new Date().toISOString()
      };
      if (periodStart) patch.period_start = periodStart.toISOString();
      if (periodEnd) patch.period_end = periodEnd.toISOString();
      if (cancel) {
        patch.status = "cancelled";
        patch.auto_renew = false;
        if (!periodEnd) patch.period_end = new Date().toISOString();
      } else if (activate) {
        patch.status = "active";
        patch.auto_renew = true;
      }

      const { data: updated, error:updateMembershipError } = await supabase
        .from("quality_memberships")
        .update(patch)
        .eq("telegram_user_id", membership.telegram_user_id)
        .select("*,quality_plans(*)")
        .single();
      if (updateMembershipError) throw updateMembershipError;
      return json({ ok:true, data:{ matched:true, membership:updated } });
    }

    if (action === "record_quality_plan_payment") {
      const user = body?.user;
      const payment = body?.payment || {};
      const match = /^qa_plan:([a-z0-9-]+)(?::([0-9a-f-]{36}))?$/i.exec(String(payment.invoice_payload || ""));

      if (!user?.id || !payment?.telegram_payment_charge_id || !match) {
        return json({ ok: false, error: "Invalid quality plan payment" }, 400);
      }

      const { data: plan, error: planError } = await supabase
        .from("quality_plans")
        .select("*")
        .eq("slug", match[1])
        .eq("active", true)
        .maybeSingle();

      if (planError) throw planError;
      if (
        !plan ||
        !plan.checkout_enabled ||
        payment.currency !== "XTR" ||
        Number(payment.total_amount) !== Number(plan.price_stars)
      ) {
        return json({ ok: false, error: "Quality plan payment amount mismatch" }, 400);
      }

      await upsertTelegramUser(supabase, user);
      const companyId = await readQualityCompanyId(supabase, user.id);

      const { data: existing, error: existingError } = await supabase
        .from("quality_plan_payments")
        .select("id")
        .eq("telegram_payment_charge_id", payment.telegram_payment_charge_id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        return json({
          ok: true,
          data: {
            plan,
            membership: await readQualityMembership(supabase, user.id),
            duplicate: true
          }
        });
      }

      const previousMembership = await readQualityMembership(supabase, user.id);
      const isRecurring = Boolean(payment.is_recurring);
      const isFirstRecurring = Boolean(payment.is_first_recurring);

      let periodEnd = payment.subscription_expiration_date
        ? new Date(Number(payment.subscription_expiration_date) * 1000)
        : new Date(Date.now() + 30 * 86400000);

      if (!Number.isFinite(periodEnd.getTime()) || periodEnd.getTime() <= Date.now()) {
        periodEnd = new Date(Date.now() + 30 * 86400000);
      }

      const periodStart = new Date(periodEnd.getTime() - 30 * 86400000);
      const subscriptionRootChargeId =
        isFirstRecurring || !previousMembership?.telegram_subscription_charge_id
          ? String(payment.telegram_payment_charge_id)
          : String(previousMembership.telegram_subscription_charge_id);

      const { error: payError } = await supabase
        .from("quality_plan_payments")
        .insert({
          telegram_user_id: user.id,
          company_id: companyId,
          plan_id: plan.id,
          stars_paid: Number(payment.total_amount),
          telegram_payment_charge_id: String(payment.telegram_payment_charge_id),
          provider_payment_charge_id: payment.provider_payment_charge_id
            ? String(payment.provider_payment_charge_id)
            : null,
          telegram_subscription_charge_id: subscriptionRootChargeId,
          is_recurring: isRecurring,
          is_first_recurring: isFirstRecurring,
          subscription_expiration_date: periodEnd.toISOString(),
          status: "paid"
        });

      if (payError) throw payError;

      const { data: membership, error: memError } = await supabase
        .from("quality_memberships")
        .upsert(
          {
            telegram_user_id: user.id,
            company_id: companyId,
            plan_id: plan.id,
            status: "active",
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            custom_docs_used: 0,
            chat_minutes_used: 0,
            assistant_seconds_used: 0,
            selected_training_product_id: null,
            telegram_subscription_charge_id: subscriptionRootChargeId,
            auto_renew: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: "telegram_user_id" }
        )
        .select("*,quality_plans(*),quality_companies(*)")
        .single();

      if (memError) throw memError;

      await supabase
        .from("quality_assistant_sessions")
        .update({
          status: "stopped",
          last_heartbeat_at: null,
          started_at: null,
          session_seconds: 0,
          updated_at: new Date().toISOString()
        })
        .eq("telegram_user_id", user.id);

      return json({
        ok: true,
        data: {
          plan,
          membership,
          duplicate: false,
          is_recurring: isRecurring,
          is_first_recurring: isFirstRecurring
        }
      });
    }

    if (action === "record_quality_product_payment") {
      const user = body?.user; const payment = body?.payment || {};
      const match = /^qa_product:([a-z0-9-]+)(?::([0-9a-f-]{36}))?$/i.exec(String(payment.invoice_payload || ""));
      if (!user?.id || !payment?.telegram_payment_charge_id || !match) return json({ ok: false, error: "Invalid quality product payment" }, 400);
      const product = await getQualityProductBySlug(supabase, match[1]);
      if (!product || !product.standalone_purchase_enabled || !product.standalone_price_stars) return json({ ok: false, error: "Product not available" }, 404);
      if (payment.currency !== "XTR" || Number(payment.total_amount) !== Number(product.standalone_price_stars)) return json({ ok: false, error: "Product payment amount mismatch" }, 400);
      await upsertTelegramUser(supabase, user);
      const companyId = await readQualityCompanyId(supabase, user.id);
      const { data: existing, error: existingError } = await supabase.from("quality_product_purchases").select("*").eq("telegram_payment_charge_id", payment.telegram_payment_charge_id).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ ok: true, data: { product, purchase: existing, duplicate: true } });
      const { data: purchase, error: purchaseError } = await supabase.from("quality_product_purchases").upsert({ telegram_user_id: user.id, company_id: companyId, product_id: product.id, stars_paid: payment.total_amount, telegram_payment_charge_id: payment.telegram_payment_charge_id }, { onConflict: "telegram_user_id,product_id" }).select().single();
      if (purchaseError) throw purchaseError;
      return json({ ok: true, data: { product, purchase, duplicate: false } });
    }

    if (action === "set_quality_subscription_auto_renew") {
      const telegramUserId = Number(body?.telegram_user_id);
      const autoRenew = Boolean(body?.auto_renew);

      const { data: membership, error } = await supabase
        .from("quality_memberships")
        .update({
          auto_renew: autoRenew,
          updated_at: new Date().toISOString()
        })
        .eq("telegram_user_id", telegramUserId)
        .select("*,quality_plans(*),quality_companies(*)")
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: membership || null });
    }

    if (action === "record_quality_plan_refund") {
      const user = body?.user;
      const refund = body?.refund || {};
      const chargeId = String(refund.telegram_payment_charge_id || "");
      const payload = String(refund.invoice_payload || "");
      const match = /^qa_plan:([a-z0-9-]+)(?::([0-9a-f-]{36}))?$/i.exec(payload);

      if (!user?.id || !chargeId || !match) {
        return json({ ok: false, error: "Invalid quality plan refund" }, 400);
      }

      const { data: paymentRow, error: paymentError } = await supabase
        .from("quality_plan_payments")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString()
        })
        .eq("telegram_payment_charge_id", chargeId)
        .eq("telegram_user_id", user.id)
        .select("*")
        .maybeSingle();

      if (paymentError) throw paymentError;
      if (!paymentRow) {
        return json({ ok: true, data: { refunded: false, reason: "payment_not_found" } });
      }

      const membership = await readQualityMembership(supabase, user.id);
      let membershipRevoked = false;

      if (
        membership &&
        String(membership.plan_id) === String(paymentRow.plan_id) &&
        paymentRow.subscription_expiration_date &&
        new Date(membership.period_end).getTime() <=
          new Date(paymentRow.subscription_expiration_date).getTime() + 60000
      ) {
        const { error: membershipError } = await supabase
          .from("quality_memberships")
          .update({
            status: "cancelled",
            period_end: new Date().toISOString(),
            auto_renew: false,
            updated_at: new Date().toISOString()
          })
          .eq("telegram_user_id", user.id);
        if (membershipError) throw membershipError;

        await supabase
          .from("quality_assistant_sessions")
          .update({
            status: "stopped",
            last_heartbeat_at: null,
            updated_at: new Date().toISOString()
          })
          .eq("telegram_user_id", user.id);

        membershipRevoked = true;
      }

      return json({
        ok: true,
        data: {
          refunded: true,
          membership_revoked: membershipRevoked
        }
      });
    }

    if (action === "get_quality_assistant_status") return json({ ok: true, data: await settleQualityAssistantTime(supabase, Number(body?.telegram_user_id)) });

    if (action === "start_quality_assistant_session") {
      const telegramUserId = Number(body?.telegram_user_id); const specialist = String(body?.specialist || "").toLowerCase();
      if (!QUALITY_SPECIALISTS.has(specialist)) return json({ ok: false, error: "Invalid specialist" }, 400);
      const state = await settleQualityAssistantTime(supabase, telegramUserId);
      if (!membershipIsActive(state.membership)) return json({ ok: false, error: "Active membership required" }, 403);
      if (state.included_seconds <= 0) return json({ ok: false, error: "Assistant not included in this plan" }, 403);
      if (state.remaining_seconds <= 0) return json({ ok: false, error: "Assistant allowance exhausted" }, 402);
      const now = new Date().toISOString();
      const { data: session, error } = await supabase.from("quality_assistant_sessions").upsert({ telegram_user_id: telegramUserId, specialist, status: "active", started_at: now, last_heartbeat_at: now, session_seconds: 0, updated_at: now }, { onConflict: "telegram_user_id" }).select().single();
      if (error) throw error;
      return json({ ok: true, data: { ...state, session } });
    }

    if (action === "heartbeat_quality_assistant_session") {
      const state = await settleQualityAssistantTime(supabase, Number(body?.telegram_user_id));
      if (state.session?.status === "active") {
        const { data: session, error } = await supabase.from("quality_assistant_sessions").update({ last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("telegram_user_id", Number(body?.telegram_user_id)).select().single();
        if (error) throw error; state.session = session;
      }
      return json({ ok: true, data: state });
    }

    if (action === "stop_quality_assistant_session") {
      const state = await settleQualityAssistantTime(supabase, Number(body?.telegram_user_id));
      if (state.session) {
        const { data: session, error } = await supabase.from("quality_assistant_sessions").update({ status: "stopped", last_heartbeat_at: null, updated_at: new Date().toISOString() }).eq("telegram_user_id", Number(body?.telegram_user_id)).select().single();
        if (error) throw error; state.session = session;
      }
      return json({ ok: true, data: state });
    }

    if (action === "list_quality_assistant_messages") {
      const telegramUserId = Number(body?.telegram_user_id);
      const specialist = String(body?.specialist || "").toLowerCase();
      if (!QUALITY_SPECIALISTS.has(specialist)) {
        return json({ ok: false, error: "Invalid specialist" }, 400);
      }

      const { data, error } = await supabase
        .from("quality_assistant_messages")
        .select("role,content,source_meta,created_at")
        .eq("telegram_user_id", telegramUserId)
        .eq("specialist", specialist)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      return json({ ok: true, data: (data || []).reverse() });
    }

    if (action === "get_quality_customer_profile") {
      const telegramUserId = Number(body?.telegram_user_id);

      const { data, error } = await supabase
        .from("quality_customer_profiles")
        .select("*,quality_companies(*)")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "upsert_quality_customer_profile") {
      const user = body?.user;
      const profile = body?.profile || {};

      if (!user?.id) {
        return json({ ok: false, error: "User is required" }, 400);
      }

      const accountType =
        profile.account_type === "company" ? "company" : "individual";

      const clean = (value, max = 180) =>
        String(value || "").trim().slice(0, max);

      const email = clean(profile.email, 254);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, error: "Invalid email address" }, 400);
      }

      const firstName = clean(profile.first_name, 100);
      const lastName = clean(profile.last_name, 100);
      const companyName = clean(profile.company_name, 180);
      const taxId = clean(profile.tax_id, 40);
      const normalizedTaxId = taxId
        ? taxId.toUpperCase().replace(/[^A-Z0-9]/g, "")
        : null;

      if (!firstName || !lastName) {
        return json({ ok: false, error: "First and last name are required" }, 400);
      }

      if (accountType === "company" && !companyName) {
        return json({ ok: false, error: "Company name is required" }, 400);
      }

      await upsertTelegramUser(supabase, user);

      const now = new Date().toISOString();
      let companyId: string | null = null;

      const { data: currentProfile, error: currentProfileError } = await supabase
        .from("quality_customer_profiles")
        .select("company_id")
        .eq("telegram_user_id", user.id)
        .maybeSingle();
      if (currentProfileError) throw currentProfileError;

      if (accountType === "company") {
        let existingCompany: any = null;

        if (normalizedTaxId) {
          const lookup = await supabase
            .from("quality_companies")
            .select("*")
            .eq("normalized_tax_id", normalizedTaxId)
            .maybeSingle();
          if (lookup.error) throw lookup.error;
          existingCompany = lookup.data || null;
        } else if (currentProfile?.company_id) {
          const lookup = await supabase
            .from("quality_companies")
            .select("*")
            .eq("id", currentProfile.company_id)
            .maybeSingle();
          if (lookup.error) throw lookup.error;
          existingCompany = lookup.data || null;
        }

        if (existingCompany && Number(existingCompany.created_by_telegram_user_id || 0) !== Number(user.id)) {
          const membership = await supabase
            .from("quality_company_members")
            .select("company_id")
            .eq("company_id", existingCompany.id)
            .eq("telegram_user_id", user.id)
            .eq("status", "active")
            .maybeSingle();
          if (membership.error) throw membership.error;
          if (!membership.data) {
            return json({ ok: false, error: "Company is already registered" }, 409);
          }
        }

        const companyPayload = {
          legal_name: companyName,
          tax_id: taxId || null,
          normalized_tax_id: normalizedTaxId,
          country_code: clean(profile.company_country_code || "PL", 2).toUpperCase(),
          city: clean(profile.company_city, 120) || null,
          contact_email: email || null,
          phone: clean(profile.phone, 40) || null,
          created_by_telegram_user_id: existingCompany?.created_by_telegram_user_id || user.id,
          updated_at: now
        };

        let companyResult: any;
        if (existingCompany?.id) {
          companyResult = await supabase
            .from("quality_companies")
            .update(companyPayload)
            .eq("id", existingCompany.id)
            .select()
            .single();
        } else {
          companyResult = await supabase
            .from("quality_companies")
            .insert({ ...companyPayload, created_at: now })
            .select()
            .single();
        }
        if (companyResult.error) throw companyResult.error;
        companyId = companyResult.data.id;

        const memberResult = await supabase
          .from("quality_company_members")
          .upsert(
            {
              company_id: companyId,
              telegram_user_id: user.id,
              role: "owner",
              status: "active",
              updated_at: now
            },
            { onConflict: "company_id,telegram_user_id" }
          );
        if (memberResult.error) throw memberResult.error;
      }

      const { data, error } = await supabase
        .from("quality_customer_profiles")
        .upsert(
          {
            telegram_user_id: user.id,
            account_type: accountType,
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: clean(profile.phone, 40) || null,
            job_title: clean(profile.job_title, 140) || null,
            company_name: accountType === "company" ? companyName || null : null,
            tax_id: accountType === "company" ? taxId || null : null,
            company_city: accountType === "company" ? clean(profile.company_city, 120) || null : null,
            company_country_code:
              accountType === "company"
                ? clean(profile.company_country_code || "PL", 2).toUpperCase()
                : "PL",
            company_id: companyId,
            terms_accepted_at: profile.accept_terms ? now : null,
            privacy_accepted_at: profile.accept_privacy ? now : null,
            marketing_consent: Boolean(profile.marketing_consent),
            certification_schemes: Array.isArray(profile.certification_schemes)
              ? profile.certification_schemes.slice(0, 20).map((v: unknown) => clean(v, 80)).filter(Boolean)
              : [],
            product_categories: clean(profile.product_categories, 500) || null,
            onboarding_completed_at: now,
            updated_at: now
          },
          { onConflict: "telegram_user_id" }
        )
        .select("*,quality_companies(*)")
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "get_quality_physical_product") {
      const slug = String(body?.slug || "");
      const { data, error } = await supabase
        .from("quality_physical_products")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "create_quality_physical_order") {
      const order = body?.order || {};
      const productId = String(order.product_id || "");
      const sessionId = String(order.stripe_checkout_session_id || "");
      if (!productId || !sessionId) {
        return json({ ok: false, error: "Invalid physical order" }, 400);
      }

      const { data: product, error: productError } = await supabase
        .from("quality_physical_products")
        .select("*")
        .eq("id", productId)
        .eq("active", true)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return json({ ok: false, error: "Physical product unavailable" }, 404);

      const telegramUserId = Number(order.telegram_user_id || 0) > 0
        ? Number(order.telegram_user_id)
        : null;

      const { data, error } = await supabase
        .from("quality_physical_orders")
        .upsert({
          telegram_user_id: telegramUserId,
          product_id: product.id,
          quantity: 1,
          amount_pln: Number(product.price_pln),
          shipping_pln: Number(product.shipping_pln || 0),
          status: "pending",
          stripe_checkout_session_id: sessionId,
          updated_at: new Date().toISOString()
        }, { onConflict: "stripe_checkout_session_id" })
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "mark_quality_physical_order_paid") {
      const payment = body?.payment || {};
      const sessionId = String(payment.stripe_checkout_session_id || "");
      if (!sessionId) return json({ ok: false, error: "Stripe session is required" }, 400);

      const { data, error } = await supabase
        .from("quality_physical_orders")
        .update({
          status: "paid",
          stripe_payment_intent_id: payment.stripe_payment_intent_id || null,
          customer_email: payment.customer_email || null,
          customer_name: payment.customer_name || null,
          customer_phone: payment.customer_phone || null,
          shipping_details: payment.shipping_details || null,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("stripe_checkout_session_id", sessionId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return json({ ok: true, data: data || null });
    }

    if (action === "get_quality_physical_fulfillment") {
      const telegramUserId = Number(body?.telegram_user_id);

      const { data: membership, error: membershipError } = await supabase
        .from("quality_memberships")
        .select("*,quality_plans(*),quality_companies(*)")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership || membership.status !== "active") {
        return json({ ok: true, data: { membership: null, fulfillment: null } });
      }

      const { data: fulfillment, error } = await supabase
        .from("quality_physical_fulfillments")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .eq("plan_id", membership.plan_id)
        .eq("membership_period_end", membership.period_end)
        .maybeSingle();

      if (error) throw error;

      return json({
        ok: true,
        data: {
          membership,
          fulfillment: fulfillment || null
        }
      });
    }

    if (action === "upsert_quality_physical_fulfillment") {
      const user = body?.user;
      const shipping = body?.shipping || {};

      if (!user?.id) {
        return json({ ok: false, error: "User is required" }, 400);
      }

      const membership = await readQualityMembership(supabase, user.id);

      if (!membershipIsActive(membership)) {
        return json({ ok: false, error: "Active Quality plan required" }, 403);
      }

      const plan = membership.quality_plans || {};
      const planSlug = plan.slug;
      const ebookMap = {
        basic: "ebook-basic-quality-foundations",
        pro: "ebook-pro-food-safety-hazard-analysis",
        vip: "ebook-vip-quality-manager-playbook"
      };
      const ebookSlug = ebookMap[planSlug];

      if (!ebookSlug) {
        return json({ ok: false, error: "E-book not configured for this plan" }, 400);
      }

      const clean = (value, max = 180) =>
        String(value || "").trim().slice(0, max);

      const recipientName = clean(shipping.recipient_name, 180);
      const street1 = clean(shipping.street_line_1, 180);
      const postalCode = clean(shipping.postal_code, 32);
      const city = clean(shipping.city, 120);
      const countryCode = clean(shipping.country_code || "PL", 2).toUpperCase();

      if (!recipientName || !street1 || !postalCode || !city) {
        return json({ ok: false, error: "Incomplete shipping address" }, 400);
      }

      await upsertTelegramUser(supabase, user);

      let shippingPaymentStatus = plan.physical_shipping_included
        ? "included"
        : "pending";
      let shippingPaidAt = plan.physical_shipping_included
        ? new Date().toISOString()
        : null;
      let stripeCheckoutSessionId = null;

      if (!plan.physical_shipping_included) {
        const { data: paidShipping, error: paidShippingError } = await supabase
          .from("quality_shipping_payments")
          .select("stripe_checkout_session_id,paid_at")
          .eq("telegram_user_id", user.id)
          .eq("plan_id", membership.plan_id)
          .eq("membership_period_end", membership.period_end)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paidShippingError) throw paidShippingError;

        if (paidShipping) {
          shippingPaymentStatus = "paid";
          shippingPaidAt = paidShipping.paid_at;
          stripeCheckoutSessionId = paidShipping.stripe_checkout_session_id;
        }
      }

      const { data, error } = await supabase
        .from("quality_physical_fulfillments")
        .upsert(
          {
            telegram_user_id: user.id,
            plan_id: membership.plan_id,
            membership_period_end: membership.period_end,
            ebook_slug: ebookSlug,
            recipient_name: recipientName,
            company_name: clean(shipping.company_name, 180) || null,
            street_line_1: street1,
            street_line_2: clean(shipping.street_line_2, 180) || null,
            postal_code: postalCode,
            city,
            country_code: countryCode,
            phone: clean(shipping.phone, 40) || null,
            status: "new",
            shipping_payment_status: shippingPaymentStatus,
            stripe_checkout_session_id: stripeCheckoutSessionId,
            shipping_paid_at: shippingPaidAt,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "telegram_user_id,plan_id,membership_period_end"
          }
        )
        .select()
        .single();

      if (error) throw error;

      return json({
        ok: true,
        data: {
          fulfillment: data,
          membership
        }
      });
    }

    if (action === "record_quality_shipping_payment") {
      const telegramUserId = Number(body?.telegram_user_id);
      const payment = body?.payment || {};
      const sessionId = String(payment.stripe_checkout_session_id || "");
      const paymentIntentId = payment.stripe_payment_intent_id
        ? String(payment.stripe_payment_intent_id)
        : null;
      const currency = String(payment.currency || "").toUpperCase();
      const amountPln = Number(payment.amount_pln);

      if (!Number.isFinite(telegramUserId) || telegramUserId <= 0 || !sessionId) {
        return json({ ok: false, error: "Invalid shipping payment" }, 400);
      }

      const membership = await readQualityMembership(supabase, telegramUserId);
      if (!membershipIsActive(membership)) {
        return json({ ok: false, error: "Active Quality plan required" }, 403);
      }

      const plan = membership.quality_plans || {};
      if (plan.physical_shipping_included) {
        return json({ ok: false, error: "Shipping is already included in this plan" }, 400);
      }

      const expected = Number(plan.physical_shipping_price_pln || 0);
      if (currency !== "PLN" || !Number.isFinite(amountPln) || Math.abs(amountPln - expected) > 0.001) {
        return json({ ok: false, error: "Shipping payment amount mismatch" }, 400);
      }

      const companyId = await readQualityCompanyId(supabase, telegramUserId);
      const now = new Date().toISOString();

      const { data: paymentRow, error: paymentError } = await supabase
        .from("quality_shipping_payments")
        .upsert(
          {
            telegram_user_id: telegramUserId,
            company_id: companyId,
            plan_id: membership.plan_id,
            membership_period_end: membership.period_end,
            amount_pln: amountPln,
            currency: "PLN",
            stripe_checkout_session_id: sessionId,
            stripe_payment_intent_id: paymentIntentId,
            status: "paid",
            paid_at: now,
            refunded_at: null
          },
          { onConflict: "stripe_checkout_session_id" }
        )
        .select()
        .single();

      if (paymentError) throw paymentError;

      const { data: fulfillment, error: fulfillmentError } = await supabase
        .from("quality_physical_fulfillments")
        .update({
          shipping_payment_status: "paid",
          stripe_checkout_session_id: sessionId,
          shipping_paid_at: now,
          updated_at: now
        })
        .eq("telegram_user_id", telegramUserId)
        .eq("plan_id", membership.plan_id)
        .eq("membership_period_end", membership.period_end)
        .select()
        .maybeSingle();

      if (fulfillmentError) throw fulfillmentError;

      return json({
        ok: true,
        data: {
          payment: paymentRow,
          fulfillment: fulfillment || null
        }
      });
    }

    if (action === "record_quality_shipping_refund") {
      const sessionId = String(body?.stripe_checkout_session_id || "");
      if (!sessionId) {
        return json({ ok: false, error: "Stripe session is required" }, 400);
      }

      const now = new Date().toISOString();
      const { data: paymentRow, error: paymentError } = await supabase
        .from("quality_shipping_payments")
        .update({
          status: "refunded",
          refunded_at: now
        })
        .eq("stripe_checkout_session_id", sessionId)
        .select()
        .maybeSingle();

      if (paymentError) throw paymentError;
      if (!paymentRow) {
        return json({ ok: true, data: { refunded: false } });
      }

      const { error: fulfillmentError } = await supabase
        .from("quality_physical_fulfillments")
        .update({
          shipping_payment_status: "refunded",
          status: "cancelled",
          updated_at: now
        })
        .eq("telegram_user_id", paymentRow.telegram_user_id)
        .eq("plan_id", paymentRow.plan_id)
        .eq("membership_period_end", paymentRow.membership_period_end)
        .neq("status", "shipped");

      if (fulfillmentError) throw fulfillmentError;

      return json({ ok: true, data: { refunded: true } });
    }

    if (action === "create_quality_support_ticket") {
      const user = body?.user;
      const ticket = body?.ticket || {};
      const category = String(ticket.category || "other");
      const allowedCategories = new Set(["technical","payment","content","idea","other"]);
      const message = String(ticket.message || "").trim();
      const subject = String(ticket.subject || "").trim().slice(0, 180);
      const contactEmail = String(ticket.contact_email || "").trim().slice(0, 254);

      if (!user?.id) {
        return json({ ok: false, error: "User is required" }, 400);
      }
      if (!allowedCategories.has(category)) {
        return json({ ok: false, error: "Invalid support category" }, 400);
      }
      if (message.length < 5 || message.length > 5000) {
        return json({ ok: false, error: "Support message must contain 5-5000 characters" }, 400);
      }

      await upsertTelegramUser(supabase, user);

      const { data, error } = await supabase
        .from("quality_support_tickets")
        .insert({
          telegram_user_id: user.id,
          category,
          subject: subject || null,
          message,
          contact_email: contactEmail || null,
          status: "new",
          source: "telegram_webapp",
          updated_at: new Date().toISOString()
        })
        .select("id,category,subject,status,created_at")
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "list_quality_support_tickets") {
      const telegramUserId = Number(body?.telegram_user_id);
      const limit = Math.min(20, Math.max(1, Number(body?.limit || 10)));

      const { data, error } = await supabase
        .from("quality_support_tickets")
        .select("id,category,subject,message,status,created_at,updated_at")
        .eq("telegram_user_id", telegramUserId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return json({ ok: true, data: data || [] });
    }

    if (action === "save_quality_assistant_message") {
      const telegramUserId = Number(body?.telegram_user_id);
      const specialist = String(body?.specialist || "").toLowerCase();
      const role = body?.role === "assistant" ? "assistant" : body?.role === "user" ? "user" : "";
      const content = String(body?.content || "").trim();

      if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
        return json({ ok: false, error: "Invalid user" }, 400);
      }
      if (!QUALITY_SPECIALISTS.has(specialist)) {
        return json({ ok: false, error: "Invalid specialist" }, 400);
      }
      if (!role) {
        return json({ ok: false, error: "Invalid message role" }, 400);
      }
      if (!content) {
        return json({ ok: false, error: "Message content is required" }, 400);
      }
      if (content.length > 20000) {
        return json({ ok: false, error: "Message is too long" }, 413);
      }

      const sourceMeta =
        body?.source_meta && typeof body.source_meta === "object"
          ? body.source_meta
          : {};

      const { data, error } = await supabase
        .from("quality_assistant_messages")
        .insert({
          telegram_user_id: telegramUserId,
          specialist,
          role,
          content,
          source_meta: sourceMeta
        })
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, data });
    }

    const emptyList = new Set(["list_plans","list_public_plans","get_user_subscriptions","list_communities","get_plan_communities","expire_due_subscriptions","list_creator_customers"]);
    if (emptyList.has(action)) return json({ ok: true, data: [] });
    const nullActions = new Set(["get_creator","ensure_creator","get_plan","create_plan","record_successful_payment","create_community","set_plan_community","get_subscription","set_subscription_auto_renew","get_creator_stats","get_session","set_session","clear_session"]);
    if (nullActions.has(action)) return json({ ok: true, data: null });

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("creator_platform_db_error", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Unhandled database error" }, 500);
  }
});
