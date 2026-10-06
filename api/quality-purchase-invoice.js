import crypto from "node:crypto";
import { resolveQualityIdentity } from "../lib/quality-auth.js";
import {
  consumeQualityCheckoutConsent,
  createQualityStripeCheckoutIntent,
  getQualityPlan,
  getQualityProduct,
  validateQualityCheckoutConsent
} from "../lib/db.js";

const PLAN_LINKS = Object.freeze({
  basic: "https://buy.stripe.com/28E8wO6SlgAi1sae4Sdby0d",
  pro: "https://buy.stripe.com/00wfZgekNesa0o67Gudby0e",
  vip: "https://buy.stripe.com/28E14mfoRdo6b2K6Cqdby0f"
});

const PRODUCT_LINKS = Object.freeze({
  document: "https://buy.stripe.com/7sY7sKb8B4RA8UCd0Odby0g",
  training: "https://buy.stripe.com/9B6bJ05Oh0Bk9YG9OCdby0h"
});

const EMERGENCY_LINK = "https://buy.stripe.com/4gM14m4Kd83M8UC5ymdby0i";

function newCheckoutToken() {
  return crypto.randomBytes(24).toString("hex");
}

function checkoutUrl(base, token) {
  const url = new URL(base);
  url.searchParams.set("client_reference_id", "qa_" + token);
  url.searchParams.set("locale", "pl");
  return url.toString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  const identity = await resolveQualityIdentity(req);
  if (!identity?.telegramUserId) {
    return res.status(401).json({ ok:false, error:"Sign in to Quality Assurance Support to continue checkout." });
  }

  const userId = Number(identity.telegramUserId);
  if (!Number.isSafeInteger(userId) || userId === 0) {
    return res.status(401).json({ ok:false, error:"Invalid Quality account." });
  }

  const kind = String(req.body?.kind || "");
  const reference = String(req.body?.reference || "").toLowerCase();
  const consentToken = String(req.body?.consent_token || "");

  try {
    if (kind === "plan") {
      const plan = await getQualityPlan(reference);
      const link = PLAN_LINKS[reference];
      if (!plan?.active || !plan?.checkout_enabled || !link) {
        return res.status(404).json({ ok:false, error:"Plan unavailable" });
      }

      const consent = await validateQualityCheckoutConsent(userId, consentToken, "plan", plan.slug);
      if (!consent) {
        return res.status(403).json({ ok:false, error:"Required legal consents are missing" });
      }

      const token = newCheckoutToken();
      await createQualityStripeCheckoutIntent(userId, token, "plan", plan.slug);
      await consumeQualityCheckoutConsent(userId, consentToken);

      const url = checkoutUrl(link, token);
      return res.status(200).json({
        ok:true,
        purchase_kind:"plan",
        payment_provider:"stripe",
        checkout_url:url,
        invoice_link:url
      });
    }

    if (kind === "product") {
      const product = await getQualityProduct(reference);
      if (!product?.active || !product?.standalone_purchase_enabled) {
        return res.status(404).json({ ok:false, error:"Product unavailable" });
      }

      const purchaseKind = product.product_type === "training" ? "training" : "digital_product";
      const consent = await validateQualityCheckoutConsent(userId, consentToken, purchaseKind, product.slug);
      if (!consent) {
        return res.status(403).json({ ok:false, error:"Required legal consents are missing" });
      }

      const link = product.product_type === "training" ? PRODUCT_LINKS.training : PRODUCT_LINKS.document;
      if (!link) {
        return res.status(503).json({ ok:false, error:"Web checkout is temporarily unavailable for this product." });
      }

      const token = newCheckoutToken();
      await createQualityStripeCheckoutIntent(userId, token, "product", product.slug);
      await consumeQualityCheckoutConsent(userId, consentToken);

      const url = checkoutUrl(link, token);
      return res.status(200).json({
        ok:true,
        purchase_kind:purchaseKind,
        payment_provider:"stripe",
        checkout_url:url,
        invoice_link:url
      });
    }

    if (kind === "emergency") {
      if (reference !== "emergency_audit_7d") {
        return res.status(404).json({ ok:false, error:"Emergency package unavailable" });
      }

      const consent = await validateQualityCheckoutConsent(
        userId,
        consentToken,
        "service",
        reference
      );
      if (!consent) {
        return res.status(403).json({ ok:false, error:"Required legal consents are missing" });
      }

      const token = newCheckoutToken();
      await createQualityStripeCheckoutIntent(
        userId,
        token,
        "emergency",
        reference
      );
      await consumeQualityCheckoutConsent(userId, consentToken);

      const url = checkoutUrl(EMERGENCY_LINK, token);
      return res.status(200).json({
        ok:true,
        purchase_kind:"emergency",
        payment_provider:"stripe",
        duration_days:7,
        price_pln:199,
        checkout_url:url,
        invoice_link:url
      });
    }

    if (kind === "token") {
      return res.status(409).json({
        ok:false,
        error:"Token packs are temporarily unavailable in web checkout while the payment migration is being completed."
      });
    }

    return res.status(400).json({ ok:false, error:"Invalid purchase kind" });
  } catch (error) {
    console.error("quality_stripe_checkout_error", error);
    return res.status(500).json({ ok:false, error:"Could not start secure checkout." });
  }
}
