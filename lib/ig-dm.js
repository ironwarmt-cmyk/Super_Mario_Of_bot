// Wiadomości prywatne (DM) na Instagramie @jem_bezpiecznie: automatyczne odpowiedzi + raport w bocie MT Social.
// Wymaga własnej aplikacji Meta (Instagram API z logowaniem przez Instagram) i zmiennych:
//   IG_APP_SECRET   – sekret aplikacji (podpis webhooka)
//   IG_ACCESS_TOKEN – token konta @jem_bezpiecznie (uprawnienie instagram_business_manage_messages)
//   IG_VERIFY_TOKEN – dowolny tekst wpisany też w ustawieniach webhooka w panelu Meta
// Webhook: https://qasupport.jembezpiecznie.com/api/jb-igdm  (pola: messages, comments). Autor: MT
import crypto from "node:crypto";
import { aiText } from "./ai-call.js";

const GRAPH_IG = "https://graph.instagram.com/v23.0";
const GRAPH_FB = "https://graph.facebook.com/v23.0";
const IG_ACCOUNT = process.env.IG_ACCOUNT_ID || "17841452533483595"; // @jem_bezpiecznie
// Token systemowy z Facebook Login for Business zaczyna się od "EAA" i działa na graph.facebook.com.
let GRAPH = GRAPH_IG;
async function graphBase() { const t = await igAccessToken(); GRAPH = t.startsWith("EAA") ? GRAPH_FB : GRAPH_IG; return GRAPH; }
const IG_FN = "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/ig-replies";
const botSecret = () => (process.env.TELEGRAM_BOT_TOKEN ? crypto.createHash("sha256").update(process.env.TELEGRAM_BOT_TOKEN).digest("hex") : "");
async function igLog(action, payload) {
  const r = await fetch(IG_FN, { method: "POST", headers: { "content-type": "application/json", "x-bot-secret": botSecret() }, body: JSON.stringify({ action, ...payload }), signal: AbortSignal.timeout(15000) });
  return r.json().catch(() => ({}));
}

// Komentarz z webhooka (na żywo): ta sama logika i ten sam dziennik co odpowiedzi co 10 minut, więc bez podwójnych odpowiedzi.
async function handleComment(v, own, notify) {
  const cid = String(v?.id || ""), text = String(v?.text || "").trim(), user = String(v?.from?.username || ""), from = String(v?.from?.id || "");
  if (!/^\d{5,30}$/.test(cid) || !text || from === own || user.toLowerCase() === "jem_bezpiecznie") return;
  const claim = await igLog("claim", { comment_id: cid, media_id: v?.media?.id || null, username: user, comment: text });
  if (!claim?.claimed) return;
  const { igCommentReply } = await import("./jb.js");
  let reply = null, error = null;
  try {
    reply = await igCommentReply({ comment: text, username: user });
    if (reply) {
      const r = await fetch(`${await graphBase()}/${cid}/replies`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await igAccessToken()}` }, body: JSON.stringify({ message: reply }), signal: AbortSignal.timeout(15000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
    }
  } catch (e) { error = e.message; }
  await igLog("done", { comment_id: cid, status: error ? "error" : reply ? "replied" : "skipped", reply });
  await notify({ comment_id: cid, username: user, comment: text, reply, replied: Boolean(reply && !error), skipped: !reply && !error, error });
}

let TOKEN_CACHE = { t: "", at: 0 };
export async function igAccessToken() {
  if (process.env.IG_ACCESS_TOKEN) return process.env.IG_ACCESS_TOKEN;
  if (TOKEN_CACHE.t && Date.now() - TOKEN_CACHE.at < 300e3) return TOKEN_CACHE.t;
  const d = await igLog("token_get", {}).catch(() => ({}));
  TOKEN_CACHE = { t: d?.token || "", at: Date.now() };
  return TOKEN_CACHE.t;
}
export const igDmConfigured = () => Boolean(process.env.IG_APP_SECRET);

const DM_INSTRUCTIONS = `Prowadzisz profil @jem_bezpiecznie na Instagramie: bezpieczeństwo żywności, ostrzeżenia i wycofania GIS, planowanie posiłków w budżecie (darmowa aplikacja Jem Bezpiecznie w przeglądarce) i QA Support dla firm spożywczych. Odpowiadasz na wiadomość prywatną.
Zasady:
- Po polsku (albo w języku wiadomości), 2–4 krótkie zdania, najwyżej 1 emoji.
- Najpierw konkretna odpowiedź na pytanie; jeśli są fakty z bazy, użyj ich (np. partia, data, zamiennik). Nie zgaduj faktów.
- Potem zawsze zachęta dopasowana do tematu, z adresem: wycofania → jembezpiecznie.com; jedzenie, przepisy, dieta, ceny → app.jembezpiecznie.com (planer w budżecie z kaloriami i makro, lista zakupów z cenami, lodówka, skan paragonu); firmy/jakość → QA Support na jembezpiecznie.com.
- Współpraca, reklamacje, sprawy firmowe: poproś o maila na JemBezpiecznie@yahoo.com.
- Zakazane: puste ogólniki, pisanie o pobieraniu ze sklepu, obietnice bez pokrycia, porady medyczne (przy objawach – lekarz).
- Nie pisz, że jesteś botem ani programem.
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
  const base = await graphBase();
  const r = await fetch(base === GRAPH_FB ? `${GRAPH_FB}/${IG_ACCOUNT}/messages` : `${GRAPH_IG}/me/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await igAccessToken()}` },
    body: JSON.stringify({ recipient: { id: String(recipientId) }, message: { text: String(text).slice(0, 1000) } }),
    signal: AbortSignal.timeout(15000)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
  return d;
}

async function username(id) {
  try {
    const r = await fetch(`${await graphBase()}/${encodeURIComponent(id)}?fields=username,name`, { headers: { authorization: `Bearer ${await igAccessToken()}` }, signal: AbortSignal.timeout(8000) });
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
  if (!igDmConfigured() || !(await igAccessToken())) return res.status(503).json({ ok: false, error: "IG not connected" });
  const raw = await readRaw(req);
  if (!validSignature(raw, String(req.headers["x-hub-signature-256"] || ""))) return res.status(401).json({ ok: false });
  let body; try { body = JSON.parse(raw); } catch { return res.status(400).end(); }
  const events = [];
  for (const entry of body.entry || []) {
    for (const m of entry.messaging || []) events.push({ own: String(entry.id || ""), ...m });
    for (const ch of entry.changes || []) {
      if (ch.field === "comments") await handleComment(ch.value, String(entry.id || ""), notify).catch((e) => console.error("igdm_comment", e.message));
      if (ch.field === "mentions") await handleMention(ch.value, String(entry.id || ""), notify).catch((e) => console.error("igdm_mention", e.message));
    }
  }
  for (const ev of events) {
    const sender = String(ev.sender?.id || "");
    const text = String(ev.message?.text || "").trim();
    if (!sender || sender === ev.own || ev.message?.is_echo || ev.message?.is_deleted) continue;
    const who = await username(sender);
    if (!text) { await notify({ kind: "dm", sender, username: who, comment: ev.message?.attachments ? "[załącznik / zdjęcie / udostępniony post]" : "[wiadomość bez tekstu]", skipped: true }); continue; }
    let reply = null, error = null;
    try {
      if (allowed(sender)) {
        const { smartReply } = await import("./bielik.js");
        const out = await smartReply({ instructions: DM_INSTRUCTIONS, text: `Wiadomość od @${who || "użytkownik"}: ${text.slice(0, 1500)}`, query: text, serverTimeoutMs: 20000 });
        reply = String(out.text || "").replace(/\*\*/g, "").trim();
        if (!reply || /^POMIŃ/i.test(reply)) reply = null;
        else if (!/jembezpiecznie\.com/i.test(reply)) reply += " Więcej na jembezpiecznie.com.";
        else await sendIgDm(sender, reply);
      }
    } catch (e) { error = e.message; }
    await notify({ kind: "dm", sender, username: who, comment: text, reply, replied: Boolean(reply && !error), skipped: !reply && !error, error });
  }
  return res.status(200).json({ ok: true });
}

// ---------------- Połączenie konta Instagram jednym kliknięciem (komenda /ig_polacz w bocie) ----------------
// Wymaga zmiennych IG_APP_ID i IG_APP_SECRET z aplikacji Meta oraz adresu przekierowania w panelu Meta:
//   https://qasupport.jembezpiecznie.com/api/jb-igauth
const REDIRECT = "https://qasupport.jembezpiecznie.com/api/jb-igauth";
const SCOPES = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments";
const sign = (v) => crypto.createHmac("sha256", process.env.IG_APP_SECRET || "x").update(v).digest("hex").slice(0, 32);

export function igConnectUrl() {
  if (!process.env.IG_APP_ID || !process.env.IG_APP_SECRET) return null;
  const ts = String(Date.now());
  const state = `${ts}.${sign(ts)}`;
  return `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(process.env.IG_APP_ID)}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&state=${encodeURIComponent(state)}`;
}

const page = (title, text) => `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#05071a;color:#f2f4ff;font:16px/1.5 system-ui,Arial;padding:24px"><main style="max-width:440px;background:#0d1130;border:1px solid #1d2456;border-radius:16px;padding:26px"><h1 style="color:#4ff0e0;font-size:22px;margin:0 0 10px">${title}</h1><p style="margin:0">${text}</p></main></body></html>`;

export async function igAuthCallback(req, res, notify) {
  const q = req.query || {};
  res.setHeader("content-type", "text/html; charset=utf-8");
  const [ts, sig] = String(q.state || "").split(".");
  if (!q.code || !ts || sig !== sign(ts) || Date.now() - Number(ts) > 15 * 60e3) return res.status(400).send(page("Link wygasł", "Wpisz ponownie /ig_polacz w bocie MT Social i zaloguj się jeszcze raz."));
  try {
    const form = new URLSearchParams({ client_id: process.env.IG_APP_ID, client_secret: process.env.IG_APP_SECRET, grant_type: "authorization_code", redirect_uri: REDIRECT, code: String(q.code).replace(/#_$/, "") });
    const a = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form, signal: AbortSignal.timeout(15000) }).then((r) => r.json());
    if (!a.access_token) throw new Error(a.error_message || "brak tokenu");
    const l = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(process.env.IG_APP_SECRET)}&access_token=${encodeURIComponent(a.access_token)}`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json());
    const token = l.access_token || a.access_token;
    const me = await fetch(`${GRAPH}/me?fields=user_id,username`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({}));
    await igLog("token_set", { token, user_id: me.user_id || a.user_id, username: me.username || "", expires_at: new Date(Date.now() + Number(l.expires_in || 3600) * 1000).toISOString() });
    TOKEN_CACHE = { t: token, at: Date.now() };
    // subskrypcja zdarzeń: komentarze, oznaczenia, wiadomości
    const sub = await fetch(`${GRAPH}/me/subscribed_apps?subscribed_fields=comments,messages,mentions`, { method: "POST", headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()).catch((e) => ({ error: { message: e.message } }));
    const subOk = Boolean(sub?.success);
    await notify({ kind: "info", text: `✅ Instagram @${me.username || "konto"} połączony z botem.${subOk ? "" : " Uwaga: subskrypcja zdarzeń nie przeszła (" + (sub?.error?.message || "?") + ") – sprawdź Webhooks w panelu Meta."} Teraz odpowiadam automatycznie na komentarze, oznaczenia i wiadomości.` });
    // od razu nadrabiamy zaległe komentarze
    igLog("run", { force: true, media: 50 }).catch(() => {});
    return res.status(200).send(page("Instagram połączony ✅", `Konto @${me.username || ""} jest połączone z botem MT Social. Bot odpowiada teraz automatycznie na komentarze, oznaczenia i wiadomości. Możesz zamknąć tę stronę.`));
  } catch (e) {
    return res.status(500).send(page("Nie udało się połączyć", `Instagram odpowiedział: ${String(e.message).replace(/[<>&]/g, "")}. Spróbuj ponownie przez /ig_polacz.`));
  }
}

// Oznaczenie (@jem_bezpiecznie w komentarzu albo podpisie cudzego posta): odpowiadamy pod tym komentarzem.
export async function handleMention(v, own, notify) {
  const cid = String(v?.comment_id || "");
  const tok = await igAccessToken();
  if (!/^\d{5,30}$/.test(cid) || !tok) { await notify({ kind: "info", text: `🏷 Oznaczenie @jem_bezpiecznie na Instagramie${v?.media_id ? ` (post ${v.media_id})` : ""}.` }); return; }
  const c = await fetch(`${await graphBase()}/${cid}?fields=id,text,username`, { headers: { authorization: `Bearer ${tok}` } }).then((r) => r.json()).catch(() => ({}));
  await handleComment({ id: cid, text: c.text || "", from: { username: c.username || "" }, media: { id: v?.media_id } }, own, notify);
}
