import { resolveQualityIdentity } from "../lib/quality-auth.js";
import {
  createQualitySupportTicket,
  listQualitySupportTickets,
  getUserProfile
} from "../lib/db.js";

const SUPPORT_EMAIL = "qasupportmt@gmail.com";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const identity = await resolveQualityIdentity(req);
  if (!identity?.telegramUserId) {
    return res.status(401).json({
      ok: false,
      error: "Sign in to Quality Assurance Support to use Support."
    });
  }
  const user = identity.user || { id: identity.telegramUserId };

  try {
    if (req.method === "GET") {
      const [profile, tickets] = await Promise.all([
        getUserProfile(user.id),
        listQualitySupportTickets(user.id, 8)
      ]);

      return res.status(200).json({
        ok: true,
        supportEmail: SUPPORT_EMAIL,
        locale: profile?.locale || "pl",
        tickets
      });
    }

    const category = String(req.body?.category || "other");
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();
    const contactEmail = String(req.body?.contact_email || "").trim();

    if (message.length < 5 || message.length > 5000) {
      return res.status(400).json({
        ok: false,
        error: "Message must contain 5-5000 characters."
      });
    }

    if (
      contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid email address."
      });
    }

    const ticket = await createQualitySupportTicket(user, {
      category,
      subject,
      message,
      contact_email: contactEmail
    });

    return res.status(201).json({
      ok: true,
      supportEmail: SUPPORT_EMAIL,
      ticket
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Support request failed"
    });
  }
}
