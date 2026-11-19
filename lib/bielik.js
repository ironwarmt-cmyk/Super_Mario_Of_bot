// Bielik na telefonie (Android) jako główna, darmowa AI; serwer jako zapas. Autor: MT
// Telefon wystawia przez tunel Cloudflare: POST https://czat.jembezpiecznie.com/chat { message, history, model } -> { reply }
import { aiText } from "./ai-call.js";

const PHONE_URL = process.env.BIELIK_URL || "https://czat.jembezpiecznie.com";

async function askPhone(instructions, text, timeoutMs) {
  try {
    const r = await fetch(`${PHONE_URL}/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: `${instructions}\n\n${text}`, history: [], ...(process.env.BIELIK_MODEL ? { model: process.env.BIELIK_MODEL } : {}) }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const reply = String(j?.reply || "").trim();
    return reply && reply.length < 2500 ? reply : null;
  } catch { return null; }
}

/** Zwraca { text, source: "bielik" | "serwer" }. */
export async function smartReply({ instructions, text, phoneTimeoutMs = 12000, serverTimeoutMs = 22000 }) {
  const phone = await askPhone(instructions, text, phoneTimeoutMs);
  if (phone) return { text: phone, source: "bielik" };
  const out = await aiText({ instructions, input: [{ role: "user", content: text }], timeoutMs: serverTimeoutMs });
  return { text: String(out.text || ""), source: "serwer" };
}
