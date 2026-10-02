import crypto from "node:crypto";
import { markQualityPhysicalOrderPaid } from "../lib/db.js";

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parts = String(signatureHeader)
    .split(",")
    .map((part) => part.split("="));

  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);

  if (!timestamp || !signatures.length) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");

  return signatures.some((candidate) => {
    try {
      const a = Buffer.from(candidate, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await readRawBody(req);

  if (!verifyStripeSignature(rawBody, req.headers["stripe-signature"], secret)) {
    return res.status(400).json({ ok: false, error: "Invalid Stripe signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid JSON" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object || {};
      const shipping =
        session.collected_information?.shipping_details ||
        session.shipping_details ||
        null;

      await markQualityPhysicalOrderPaid({
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
        customer_email:
          session.customer_details?.email || session.customer_email || null,
        customer_name: session.customer_details?.name || shipping?.name || null,
        customer_phone: session.customer_details?.phone || null,
        shipping_details: shipping
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("stripe_webhook_handler_error", error);
    return res.status(500).json({ ok: false });
  }
}
