import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getQualityMembership,
  getQualityProduct,
  getUserProfile
} from "../lib/db.js";

function webhookSecret(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function expectedSignature(token, userId, slug, lang, exp) {
  const payload = `${userId}:${slug}:${lang}:${exp}`;
  return crypto
    .createHmac("sha256", webhookSecret(token))
    .update(payload)
    .digest("hex");
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function filenameFor(product, lang) {
  const raw = lang === "en" ? product.name_en : product.name_pl;
  return String(raw || product.slug || "document")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9 _.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) + ".md";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(503).json({ ok: false, error: "Bot is not configured" });
  }

  const userId = Number(req.query.u);
  const slug = String(req.query.slug || "");
  const lang = req.query.lang === "en" ? "en" : "pl";
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig || "");

  if (!Number.isSafeInteger(userId) || !slug || !Number.isFinite(exp) || !sig) {
    return res.status(400).json({ ok: false, error: "Invalid link" });
  }

  if (Math.floor(Date.now() / 1000) > exp) {
    return res.status(410).json({ ok: false, error: "Link expired" });
  }

  const expected = expectedSignature(token, userId, slug, lang, exp);
  if (!safeEqual(sig, expected)) {
    return res.status(401).json({ ok: false, error: "Invalid signature" });
  }

  try {
    const [product, membership, profile] = await Promise.all([
      getQualityProduct(slug),
      getQualityMembership(userId),
      getUserProfile(userId)
    ]);

    if (!product) {
      return res.status(404).json({ ok: false, error: "Product not found" });
    }

    const tierRank = Number(membership?.quality_plans?.tier_rank || 0);
    const membershipActive =
      membership?.status === "active" &&
      (!membership?.period_end || new Date(membership.period_end) > new Date());

    const allowed =
      Boolean(profile?.is_admin) ||
      (membershipActive && tierRank >= Number(product.minimum_tier_rank || 1));

    if (!allowed) {
      return res.status(403).json({ ok: false, error: "Access not active" });
    }

    const relativePath =
      lang === "en"
        ? product.asset_path_en || product.asset_path_pl
        : product.asset_path_pl || product.asset_path_en;

    if (!relativePath) {
      return res.status(404).json({ ok: false, error: "No downloadable asset" });
    }

    const contentRoot = path.resolve(process.cwd(), "content", "quality");
    const absolutePath = path.resolve(process.cwd(), relativePath);

    if (!absolutePath.startsWith(contentRoot + path.sep)) {
      return res.status(400).json({ ok: false, error: "Invalid asset path" });
    }

    const data = await fs.readFile(absolutePath, "utf8");
    const filename = filenameFor(product, lang);

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(data);
  } catch (error) {
    console.error("quality_download_error", error);
    return res.status(500).json({
      ok: false,
      error: "Download failed"
    });
  }
}
