import crypto from "node:crypto";
import {
  getQualityCustomerProfile,
  upsertQualityCustomerProfile,
  getUserProfile
} from "../lib/db.js";

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

  const check = entries.map(([k,v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(check).digest("hex");
  if (!safeEqualHex(hash, expected)) return null;

  try {
    const rawUser = params.get("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (!["GET","POST"].includes(req.method)) {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  const initData =
    req.headers["x-telegram-init-data"] ||
    req.query?.initData ||
    req.body?.initData ||
    "";

  const user = verifyTelegramInitData(String(initData), process.env.TELEGRAM_BOT_TOKEN);
  if (!user?.id) {
    return res.status(401).json({ ok:false, error:"Open account setup from Telegram." });
  }

  try {
    if (req.method === "GET") {
      const [profile, telegramProfile] = await Promise.all([
        getQualityCustomerProfile(user.id),
        getUserProfile(user.id)
      ]);

      return res.status(200).json({
        ok:true,
        locale: telegramProfile?.locale || "pl",
        telegram: {
          id:user.id,
          first_name:user.first_name || "",
          last_name:user.last_name || "",
          username:user.username || ""
        },
        profile
      });
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
