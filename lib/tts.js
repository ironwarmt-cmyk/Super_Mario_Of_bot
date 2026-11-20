// Polski lektor Gemini TTS przez Vercel AI Gateway (/api/jb-tts). Autor: MT
// Dostęp: nagłówek x-bot-secret (bot / serwer) albo token OIDC z GitHub Actions tego repozytorium.
import crypto from "node:crypto";
import { getVercelOidcToken } from "@vercel/oidc";
import { createRemoteJWKSet, jwtVerify } from "jose";

const MODELS = ["google/gemini-3.8-flash-tts", "google/gemini-3.8-flash-lite-tts"];
const GH_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");

async function allowed(req) {
  const exp = process.env.TELEGRAM_BOT_TOKEN ? sha(process.env.TELEGRAM_BOT_TOKEN) : "";
  const sup = String(req.headers["x-bot-secret"] || "");
  if (exp && sup.length === exp.length && crypto.timingSafeEqual(Buffer.from(sup), Buffer.from(exp))) return true;
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  try {
    const { payload } = await jwtVerify(tok, GH_JWKS, { issuer: "https://token.actions.githubusercontent.com", audience: "jb-tiktok-vo" });
    return payload.repository === "ironwarmt-cmyk/Super_Mario_Of_bot" && payload.ref === "refs/heads/main";
  } catch { return false; }
}

export async function speak({ text, voice = "Charon", instructions = "" }) {
  const gw = String(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "").trim() || String(await getVercelOidcToken().catch(() => "") || "").trim();
  if (!gw) throw new Error("AI_UNAVAILABLE");
  let last = "";
  for (const model of MODELS) {
    const r = await fetch("https://ai-gateway.vercel.sh/v4/ai/speech-model", {
      method: "POST",
      headers: { Authorization: `Bearer ${gw}`, "ai-gateway-protocol-version": "0.0.1", "ai-speech-model-specification-version": "4", "ai-model-id": model, "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, instructions, outputFormat: "wav" }), signal: AbortSignal.timeout(50000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.audio) return { audio: d.audio, model, warnings: d.warnings || [] };
    last = `${model}: ${r.status} ${JSON.stringify(d).slice(0, 300)}`;
  }
  throw new Error(last);
}

export async function ttsHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!(await allowed(req))) return res.status(401).json({ ok: false });
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const text = String(b?.text || "").trim().slice(0, 3000);
  if (!text) return res.status(400).json({ ok: false, error: "text" });
  try {
    return res.status(200).json({ ok: true, ...(await speak({ text, voice: String(b.voice || "Charon"), instructions: String(b.instructions || "").slice(0, 500) })) });
  } catch (e) {
    console.error("jb_tts", e?.message);
    return res.status(502).json({ ok: false, error: String(e?.message || e).slice(0, 500) });
  }
}
