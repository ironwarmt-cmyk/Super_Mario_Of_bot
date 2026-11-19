// Wiadomości prywatne (DM) na Instagramie @jem_bezpiecznie: automatyczne odpowiedzi + raport w bocie MT Social.
// Wymaga własnej aplikacji Meta (Instagram API z logowaniem przez Instagram) i zmiennych:
//   IG_APP_SECRET   – sekret aplikacji (podpis webhooka)
//   IG_ACCESS_TOKEN – token konta @jem_bezpiecznie (uprawnienie instagram_business_manage_messages)
//   IG_VERIFY_TOKEN – dowolny tekst wpisany też w ustawieniach webhooka w panelu Meta
// Webhook: https://qasupport.jembezpiecznie.com/api/jb-igdm  (pole: messages). Autor: MT
import crypto from "node:crypto";
import { aiText } from "./ai-call.js";

const GRAPH = "https://graph.instagram.com/v23.0";

export const igDmConfigured = () => Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_APP_SECRET);

const DM_INSTRUCTIONS = `Prowadzisz profil @jem_bezpiecznie na Instagramie (bezpieczeństwo żywności, wycofania produktów z rynku, planowanie posiłków w budżecie, darmowa aplikacja Jem Bezpiecznie). Odpowiadasz na wiadomość prywatną.
Zasady:
- Po polsku (albo w języku wiadomości), ciepło, konkretnie, 1–4 krótkie zdania, najwyżej 1 emoji.
- Odpowiedz na pytanie rzeczowo. Nie zgaduj faktów (np. czy dana partia jest wycofana) – odeślij do jembezpiecznie.com i komunikatów GIS.
- Zawsze zaproś na jembezpiecznie.com: aktualne wycofania, darmowa aplikacja do planowania posiłków w budżecie (app.jembezpiecznie.com), lodówka i skan paragonów, QA Support dla firm.
- Bez porad medycznych; przy objawach po zjedzeniu produktu poradź kontakt z lekarzem.
- Sprawy firmowe, współpraca, reklamacje: poproś o maila na JemBezpiecznie@yahoo.com.
- Nie pisz, że jesteś botem ani programem. Nie obiecuj rzeczy, których nie ma.
- Jeśli wiadomość to spam, oszustwo, reklama albo obraźliwa treść, odpowiedz dokładnie: POMIŃ
Zwróć tylko treść odpowiedzi.`;

async function readRaw(req) {
  // Najpierw surowy strumień (podpis Meta liczy się z oryginalnych bajtów); nie dotykamy req.body wcześniej.
  const chunks = [];
  try { for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); } catch {}
  if (chunks.length) return Buffer.concat(chunks).toString("utf8");
  const b = req.body;
  return typeof b === "string" ? b : Buffer.isBuffer(b) ? b.toString("utf8") : JSON.stringify(b || {});
}

function validSignature(raw, header) {
  const secret = process.env.IG_APP_SECRET || "";
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(header || "")) return false;
  const exp = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(header));
}

export async function sendIgDm(recipientId, text) {
  const r = await fetch(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` },
    body: JSON.stringify({ recipient: { id: String(recipientId) }, message: { text: String(text).slice(0, 1000) } }),
    signal: AbortSignal.timeout(15000)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
  return d;
}

async function username(id) {
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(id)}?fields=username,name`, { headers: { authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    return d.username || d.name || "";
  } catch { return ""; }
}

// Ochrona przed zapętleniem i zalewem: najwyżej 1 automatyczna odpowiedź na 2 minuty i 10 dziennie na rozmówcę (pamięć instancji).
const RECENT = new Map();
function allowed(sender) {
  const now = Date.now(), list = (RECENT.get(sender) || []).filter((t) => now - t < 864e5);
  if (list.length >= 10 || (list.length && now - list[list.length - 1] < 120e3)) return false;
  list.push(now); RECENT.set(sender, list); return true;
}

/**
 * Webhook Meta. GET – weryfikacja; POST – wiadomości.
 * notify(item) – funkcja z lib/community.js wysyłająca raport do administratorów bota MT Social.
 */
export async function igDmWebhook(req, res, notify) {
  if (req.method === "GET") {
    const q = req.query || {};
    if (q["hub.mode"] === "subscribe" && process.env.IG_VERIFY_TOKEN && q["hub.verify_token"] === process.env.IG_VERIFY_TOKEN) return res.status(200).send(String(q["hub.challenge"] || ""));
    return res.status(403).send("forbidden");
  }
  if (req.method !== "POST") return res.status(405).end();
  if (!igDmConfigured()) return res.status(503).json({ ok: false, error: "IG DM not configured" });
  const raw = await readRaw(req);
  if (!validSignature(raw, String(req.headers["x-hub-signature-256"] || ""))) return res.status(401).json({ ok: false });
  let body; try { body = JSON.parse(raw); } catch { return res.status(400).end(); }
  const events = [];
  for (const entry of body.entry || []) for (const m of entry.messaging || []) events.push({ own: String(entry.id || ""), ...m });
  for (const ev of events) {
    const sender = String(ev.sender?.id || "");
    const text = String(ev.message?.text || "").trim();
    if (!sender || sender === ev.own || ev.message?.is_echo || ev.message?.is_deleted) continue;
    const who = await username(sender);
    if (!text) { await notify({ kind: "dm", sender, username: who, comment: ev.message?.attachments ? "[załącznik / zdjęcie / udostępniony post]" : "[wiadomość bez tekstu]", skipped: true }); continue; }
    let reply = null, error = null;
    try {
      if (allowed(sender)) {
        const out = await aiText({ instructions: DM_INSTRUCTIONS, input: [{ role: "user", content: `Wiadomość od @${who || "użytkownik"}: ${text.slice(0, 1500)}` }], timeoutMs: 20000 });
        reply = String(out.text || "").replace(/\*\*/g, "").trim();
        if (!reply || /^POMIŃ\.?$/i.test(reply)) reply = null;
        else await sendIgDm(sender, reply);
      }
    } catch (e) { error = e.message; }
    await notify({ kind: "dm", sender, username: who, comment: text, reply, replied: Boolean(reply && !error), skipped: !reply && !error, error });
  }
  return res.status(200).json({ ok: true });
}
