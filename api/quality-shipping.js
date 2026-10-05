import { resolveQualityIdentity } from "../lib/quality-auth.js";
import {
  getQualityPhysicalFulfillment,
  upsertQualityPhysicalFulfillment,
  getUserProfile
} from "../lib/db.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const identity = await resolveQualityIdentity(req);
  if (!identity?.telegramUserId) {
    return res.status(401).json({ ok:false, error:"Sign in to Quality Assurance Support to manage shipping." });
  }
  const user = identity.user || { id: identity.telegramUserId };

  try {
    if (req.method === "GET") {
      const [profile, data] = await Promise.all([
        getUserProfile(user.id),
        getQualityPhysicalFulfillment(user.id)
      ]);

      return res.status(200).json({
        ok: true,
        locale: profile?.locale || "pl",
        membership: data?.membership || null,
        fulfillment: data?.fulfillment || null
      });
    }

    const shipping = {
      recipient_name: req.body?.recipient_name,
      company_name: req.body?.company_name,
      street_line_1: req.body?.street_line_1,
      street_line_2: req.body?.street_line_2,
      postal_code: req.body?.postal_code,
      city: req.body?.city,
      country_code: req.body?.country_code || "PL",
      phone: req.body?.phone
    };

    const result = await upsertQualityPhysicalFulfillment(user, shipping);

    return res.status(200).json({
      ok: true,
      fulfillment: result?.fulfillment || null,
      membership: result?.membership || null
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shipping request failed";

    const status =
      /active quality plan|required/i.test(message) ? 403 : 500;

    return res.status(status).json({ ok: false, error: message });
  }
}
