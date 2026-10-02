import {
  createQualityPhysicalOrder,
  getQualityPhysicalProduct
} from "../lib/db.js";

const BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  "https://supermarioofbot-iron-war.vercel.app";

function html(res, status, title, message) {
  res.status(status).setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(`<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;background:#07111c;color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:620px;margin:10vh auto;padding:28px}
.card{background:#0d1b2a;border:1px solid #203b54;border-radius:22px;padding:28px}
h1{margin-top:0}.muted{color:#a8b6c6;line-height:1.6}a{color:#54a7ff}
</style>
</head>
<body><main><div class="card"><h1>${title}</h1><p class="muted">${message}</p><p><a href="https://t.me/Super_Mario_Official_bot">Wróć do bota</a></p></div></main></body>
</html>`);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return html(res, 405, "Niedozwolona metoda", "Użyj przycisku zakupu w bocie.");
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return html(
      res,
      503,
      "BLIK jeszcze nieaktywny",
      "Checkout produktu fizycznego jest przygotowany, ale konto operatora płatności nie zostało jeszcze podłączone. Po aktywacji konta płatniczego pojawią się dostępne metody, w tym BLIK, jeśli jest włączony dla konta."
    );
  }

  const slug = String(req.query?.product || "");
  const telegramUserId = Number(req.query?.u || 0);

  try {
    const product = await getQualityPhysicalProduct(slug);

    if (!product || !product.active || (product.stock != null && Number(product.stock) <= 0)) {
      return html(res, 404, "Produkt niedostępny", "Ten produkt fizyczny jest obecnie niedostępny.");
    }

    const unitAmount = Math.round(Number(product.price_pln) * 100);
    const form = new URLSearchParams();

    form.set("mode", "payment");
    form.set(
      "success_url",
      `${BASE_URL}/physical-success.html?session_id={CHECKOUT_SESSION_ID}`
    );
    form.set("cancel_url", `${BASE_URL}/quality/`);
    form.set("locale", "pl");
    form.set("billing_address_collection", "required");
    form.set("phone_number_collection[enabled]", "true");
    form.set("shipping_address_collection[allowed_countries][0]", "PL");
    form.set("automatic_payment_methods[enabled]", "true");
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "pln");
    form.set("line_items[0][price_data][unit_amount]", String(unitAmount));
    form.set("line_items[0][price_data][product_data][name]", product.name_pl);
    form.set(
      "line_items[0][price_data][product_data][description]",
      "Fizyczny, drukowany pakiet dokumentacji Quality Assurance Support"
    );
    form.set("metadata[quality_physical_product_id]", product.id);
    form.set("metadata[quality_physical_product_slug]", product.slug);

    if (telegramUserId > 0) {
      form.set("client_reference_id", String(telegramUserId));
      form.set("metadata[telegram_user_id]", String(telegramUserId));
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok || !session?.id || !session?.url) {
      console.error("stripe_checkout_error", session);
      return html(
        res,
        502,
        "Nie udało się uruchomić płatności",
        "Operator płatności nie utworzył sesji. Sprawdź konfigurację konta i włączone metody płatności."
      );
    }

    await createQualityPhysicalOrder({
      telegramUserId: telegramUserId > 0 ? telegramUserId : null,
      product,
      stripeCheckoutSessionId: session.id
    });

    res.statusCode = 303;
    res.setHeader("Location", session.url);
    return res.end();
  } catch (error) {
    console.error("physical_checkout_error", error);
    return html(
      res,
      500,
      "Błąd checkoutu",
      "Nie udało się rozpocząć zamówienia. Spróbuj ponownie za chwilę."
    );
  }
}
