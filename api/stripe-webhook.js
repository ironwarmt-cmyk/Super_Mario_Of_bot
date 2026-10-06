import crypto from "node:crypto";
import {
  markQualityPhysicalOrderPaid,
  recordQualityStripePlanPayment,
  recordQualityStripeProductPayment,
  resolveQualityStripeCheckoutIntent,
  syncQualityStripeSubscription
} from "../lib/db.js";

export const config = { api:{ bodyParser:false } };

async function readRawBody(req) {
  const chunks=[];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts=String(signatureHeader).split(",").map(part=>part.split("="));
  const timestamp=parts.find(([key])=>key==="t")?.[1];
  const signatures=parts.filter(([key])=>key==="v1").map(([,value])=>value);
  if (!timestamp || !signatures.length) return false;
  const age=Math.abs(Math.floor(Date.now()/1000)-Number(timestamp));
  if (!Number.isFinite(age) || age>300) return false;
  const expected=crypto.createHmac("sha256",secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  return signatures.some(candidate=>{
    try{
      const a=Buffer.from(candidate,"hex"),b=Buffer.from(expected,"hex");
      return a.length===b.length && crypto.timingSafeEqual(a,b);
    }catch{return false}
  });
}

function objectId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.id === "string") return value.id;
  return "";
}

function isoFromUnix(value) {
  const n=Number(value);
  return Number.isFinite(n) && n>0 ? new Date(n*1000).toISOString() : null;
}

function checkoutToken(value) {
  const m=/^qa_([a-f0-9]{48})$/.exec(String(value||""));
  return m ? m[1] : "";
}

function invoiceSubscriptionId(invoice) {
  return objectId(invoice?.subscription)
    || objectId(invoice?.parent?.subscription_details?.subscription)
    || objectId(invoice?.subscription_details?.subscription);
}

function invoicePeriod(invoice) {
  const line=invoice?.lines?.data?.[0];
  return {
    start:isoFromUnix(line?.period?.start || invoice?.period_start),
    end:isoFromUnix(line?.period?.end || invoice?.period_end)
  };
}

function subscriptionPeriod(subscription) {
  const item=subscription?.items?.data?.[0];
  return {
    start:isoFromUnix(subscription?.current_period_start || item?.current_period_start),
    end:isoFromUnix(subscription?.current_period_end || item?.current_period_end)
  };
}

async function handleCheckoutSession(session) {
  const meta=session?.metadata || {};
  const token=checkoutToken(session?.client_reference_id);

  if (
    meta.quality_app === "quality_assurance_support" &&
    (meta.quality_kind === "plan" || meta.quality_kind === "product_type")
  ) {
    if (!token || !session?.id) throw new Error("Missing Quality checkout intent reference");
    const intent=await resolveQualityStripeCheckoutIntent(token,String(session.id));

    if (meta.quality_kind === "plan") {
      if (intent.purchase_kind !== "plan" || intent.purchase_reference !== String(meta.quality_ref||"").toLowerCase()) {
        throw new Error("Quality plan checkout intent mismatch");
      }
      await recordQualityStripePlanPayment(Number(intent.telegram_user_id),{
        plan_slug:intent.purchase_reference,
        checkout_session_id:String(session.id),
        subscription_id:objectId(session.subscription),
        customer_id:objectId(session.customer),
        amount_total:Number(session.amount_total||0),
        currency:String(session.currency||"").toLowerCase()
      });
      return;
    }

    if (intent.purchase_kind !== "product") {
      throw new Error("Quality product checkout intent mismatch");
    }
    await recordQualityStripeProductPayment(Number(intent.telegram_user_id),{
      product_slug:intent.purchase_reference,
      checkout_session_id:String(session.id),
      payment_intent_id:objectId(session.payment_intent),
      customer_id:objectId(session.customer),
      amount_total:Number(session.amount_total||0),
      currency:String(session.currency||"").toLowerCase()
    });
    return;
  }

  const shipping=session.collected_information?.shipping_details || session.shipping_details || null;
  await markQualityPhysicalOrderPaid({
    stripe_checkout_session_id:session.id,
    stripe_payment_intent_id:objectId(session.payment_intent) || null,
    customer_email:session.customer_details?.email || session.customer_email || null,
    customer_name:session.customer_details?.name || shipping?.name || null,
    customer_phone:session.customer_details?.phone || null,
    shipping_details:shipping
  });
}

export default async function handler(req,res) {
  if (req.method !== "POST") return res.status(405).json({ok:false});
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody=await readRawBody(req);
  if (!verifyStripeSignature(rawBody,req.headers["stripe-signature"],secret)) {
    return res.status(400).json({ok:false,error:"Invalid Stripe signature"});
  }

  let event;
  try{event=JSON.parse(rawBody.toString("utf8"))}
  catch{return res.status(400).json({ok:false,error:"Invalid JSON"})}

  try{
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await handleCheckoutSession(event.data?.object || {});
    } else if (event.type === "invoice.paid") {
      const invoice=event.data?.object || {};
      const subscriptionId=invoiceSubscriptionId(invoice);
      if (subscriptionId) {
        const period=invoicePeriod(invoice);
        await syncQualityStripeSubscription({
          subscription_id:subscriptionId,
          invoice_id:String(invoice.id||""),
          customer_id:objectId(invoice.customer),
          amount_paid:Number(invoice.amount_paid||0),
          currency:String(invoice.currency||"").toLowerCase(),
          status:"active",
          event_kind:"invoice_paid",
          period_start:period.start,
          period_end:period.end
        });
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription=event.data?.object || {};
      const period=subscriptionPeriod(subscription);
      await syncQualityStripeSubscription({
        subscription_id:String(subscription.id||""),
        customer_id:objectId(subscription.customer),
        status:String(subscription.status||""),
        event_kind:event.type.endsWith(".deleted") ? "deleted" : "subscription_updated",
        period_start:period.start,
        period_end:period.end
      });
    }

    return res.status(200).json({received:true});
  }catch(error){
    console.error("stripe_webhook_handler_error",error);
    return res.status(500).json({ok:false});
  }
}
