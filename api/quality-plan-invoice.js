import crypto from "node:crypto";
import { getQualityPlan, validateQualityCheckoutConsent } from "../lib/db.js";

function safeEqualHex(a, b) {
  const aa = Buffer.from(String(a || ""), "hex");
  const bb = Buffer.from(String(b || ""), "hex");
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400 || authDate > now + 60) return null;

  const entries = [];
  for (const [key, value] of params.entries()) {
    if (key !== "hash") entries.push([key, value]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = entries
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!safeEqualHex(hash, expected)) return null;

  try {
    const rawUser = params.get("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const initData =
    req.headers["x-telegram-init-data"] ||
    req.body?.initData ||
    "";

  const user = verifyTelegramInitData(String(initData), token);
  if (!user?.id) {
    return res.status(401).json({
      ok: false,
      error: "Open Quality Hub from Telegram to pay."
    });
  }

  const slug = String(req.body?.slug || "").toLowerCase();

  try {
    const plan = await getQualityPlan(slug);

    if (!plan || !plan.active || !plan.checkout_enabled || !plan.price_stars) {
      return res.status(404).json({
        ok: false,
        error: "Plan unavailable"
      });
    }

    const consentToken = String(req.body?.consent_token || "");
    const consent = await validateQualityCheckoutConsent(
      user.id,
      consentToken,
      "plan",
      plan.slug
    );
    if (!consent) {
      return res.status(403).json({
        ok: false,
        error: "Required legal consents must be completed before payment."
      });
    }

    const title = String(plan.name_pl || plan.name_en || "Quality Plan").slice(0, 32);
    const description =
      `Quality Assurance Support — ${title}. ` +
      `Cena referencyjna: ${Number(plan.display_price_pln).toFixed(2)} PLN / miesiąc.`;

    const response = await fetch(
      `https://api.telegram.org/bot${token}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          payload: `qa_plan:${plan.slug}`,
          currency: "XTR",
          prices: [
            {
              label: title,
              amount: Number(plan.price_stars)
            }
          ],
          subscription_period: 2592000
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data?.ok || !data?.result) {
      return res.status(502).json({
        ok: false,
        error: data?.description || "Could not create Telegram invoice"
      });
    }

    return res.status(200).json({
      ok: true,
      invoice_link: data.result,
      plan: {
        slug: plan.slug,
        name_pl: plan.name_pl,
        name_en: plan.name_en,
        display_price_pln: plan.display_price_pln,
        price_stars: plan.price_stars
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Invoice error"
    });
  }
}
