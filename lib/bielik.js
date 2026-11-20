// Agent na telefonie (Android, czat.jembezpiecznie.com) + AI. Autor: MT
// Agent na telefonie to wyszukiwarka bazy Jem Bezpiecznie (ostrzeżenia GIS, przepisy) – dostarcza FAKTY.
// Odpowiedź piszemy AI na podstawie tych faktów, krótko i tematycznie, zawsze z zachętą do jembezpiecznie.com.
import { aiText } from "./ai-call.js";

const PHONE_URL = process.env.BIELIK_URL || "https://czat.jembezpiecznie.com";

// Zawsze najpierw pytamy agenta na telefonie; gdy telefon/tunel jest wyłączony, wracamy pustym kontekstem.
export async function phoneFacts(query, timeoutMs = 8000) {
  const q = String(query || "").trim().slice(0, 600);
  if (q.length < 3) return { facts: "", online: false };
  const ask = async (model) => {
    try {
      const r = await fetch(`${PHONE_URL}/chat`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: q, history: [], ...(model ? { model } : {}) }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      return String(j?.reply || "").trim() || null;
    } catch { return null; }
  };
  const food = /przepis|zastąp|zamiennik|ugotow|upiec|danie|obiad|śniadan|kolacj|dieta|cukier|mąk|kalor|makro|budżet/i.test(q);
  const out = await ask(food ? "Baza przepisów" : process.env.BIELIK_MODEL || undefined);
  return { facts: out ? out.slice(0, 1800) : "", online: Boolean(out) };
}

/** Zwraca { text, source }. source: "telefon+AI" gdy były fakty z telefonu, inaczej "AI". */
export async function smartReply({ instructions, text, query, serverTimeoutMs = 25000 }) {
  const { facts, online } = await phoneFacts(query || text);
  const ctx = facts
    ? `\n\nFakty z bazy Jem Bezpiecznie (agent na telefonie). Wykorzystaj je TYLKO jeśli dotyczą pytania; nie wklejaj list, nie podawaj danych, których tu nie ma:\n${facts}`
    : "";
  const out = await aiText({ instructions, input: [{ role: "user", content: text + ctx }], timeoutMs: serverTimeoutMs });
  return { text: String(out.text || ""), source: online ? "telefon+AI" : "AI" };
}
