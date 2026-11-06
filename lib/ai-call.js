// Wspólne wywołanie modelu dla agentów społeczności (raporty, codzienne posty).
// Próbuje kolejnych modeli: przydatne na darmowym planie Vercel AI Gateway,
// gdzie część modeli zwraca 403 (RestrictedModelsError). Zapamiętuje działający model.
import { getVercelOidcToken } from "@vercel/oidc";

const GATEWAY_MODELS = [
  process.env.COMMUNITY_AI_MODEL,
  "google/gemini-2.5-flash",
  "openai/gpt-oss-120b",
  "deepseek/deepseek-v3.2",
  "minimax/minimax-m3",
  "openai/gpt-5.6-luna",
  "google/gemini-3-flash"
].filter(Boolean);
let workingModel = null;

async function auth() {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (key) return { url: "https://api.openai.com/v1/responses", token: key, models: [process.env.COMMUNITY_AI_MODEL_OPENAI || "gpt-5.6-luna"] };
  const gw = String(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "").trim() || String(await getVercelOidcToken().catch(() => "") || "").trim();
  if (!gw) throw new Error("AI_UNAVAILABLE");
  const models = workingModel ? [workingModel, ...GATEWAY_MODELS.filter((m) => m !== workingModel)] : GATEWAY_MODELS;
  return { url: "https://ai-gateway.vercel.sh/v1/responses", token: gw, models };
}

export function extractText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text) return payload.output_text;
  const out = [];
  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item.content || []) if (part?.type === "output_text" && part.text) out.push(part.text);
  }
  return out.join("\n").trim();
}

// tools: opcjonalne (np. web_search); przy błędzie 400 ponawiamy bez narzędzi.
export async function aiText({ instructions, input, tools, timeoutMs = 45000 }) {
  const a = await auth();
  const deadline = Date.now() + timeoutMs;
  let lastErr = "AI error";
  for (const model of a.models) {
    const left = deadline - Date.now();
    if (left < 6000) break;
    const variants = tools ? [{ tools, tool_choice: "auto" }, {}] : [{}];
    for (const extra of variants) {
      let r, d;
      try {
        r = await fetch(a.url, { method: "POST", headers: { Authorization: `Bearer ${a.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, instructions, input, ...extra }), signal: AbortSignal.timeout(Math.max(5000, deadline - Date.now())) });
        d = await r.json().catch(() => ({}));
      } catch (e) { lastErr = e.message; break; }
      if (r.ok) { const text = extractText(d); if (text) { workingModel = model; return { text, model }; } lastErr = "empty"; break; }
      lastErr = d?.error?.message || `HTTP ${r.status}`;
      if (r.status === 400 && extra.tools) continue;   // spróbuj bez narzędzi
      break;                                            // 401/403/404/429/5xx: następny model
    }
  }
  throw new Error(lastErr);
}
