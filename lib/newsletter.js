// ============================================================
//  Newsletter Jem Bezpiecznie – wtorek i piątek
//  1) zbiera fakty z oficjalnych źródeł (GIS, Dziennik Ustaw przez API Sejmu ELI,
//     opublikowane raporty Jem Bezpiecznie),
//  2) redakcja AI składa z nich wydanie (tylko z podanych materiałów + oficjalne linki),
//  3) wysyła z JemBezpiecznie@yahoo.com do zapisanych, kopia na tę samą skrzynkę.
// ============================================================
import nodemailer from "nodemailer";
import { aiText } from "./ai-call.js";

export const FROM = process.env.NEWSLETTER_SMTP_USER || "JemBezpiecznie@yahoo.com";
const SITE = "https://jembezpiecznie.com";
const QA = (process.env.QUALITY_PUBLIC_URL || "https://qasupport.jembezpiecznie.com").replace(/\/$/, "");
const DAY = 86400000;
const UA = { "User-Agent": "JemBezpiecznie-Newsletter/1.0 (+https://jembezpiecznie.com)" };

const LAW_WORDS = new RegExp("(?<![a-ząćęłńóśźż])(" + [
  "żywnoś", "środk\\w* spożywcz", "przemysł\\w* spożywcz", "rolno-spożywcz", "bezpieczeństw\\w* żywnoś", "inspekcj\\w* sanitarn", "inspekcj\\w* weterynaryjn",
  "inspekcj\\w* jakości handlowej", "suplement\\w* diety", "dodatk\\w* do żywnoś", "alergen", "pasz(?!port)", "mięs", "mlek", "mleczn", "produkt\\w* pochodzenia zwierzęcego",
  "ryb(?:y|ołów|ack|n)", "jaj(?:a|ach|ek)", "znakowani\\w* żywnoś", "etykiet", "higien\\w* (?:pasz|żywnoś|produkcji)", "materiał\\w* i wyrob\\w* przeznaczon\\w* do kontaktu",
  "środk\\w* ochrony roślin", "pestycyd", "genetycznie zmodyfikowan", "zdrowi\\w* zwierząt", "chorób zakaźnych zwierząt", "nawoz", "wod\\w* przeznaczon\\w* do spożycia",
  "napoj\\w* spirytusow", "wyrob\\w* winiarsk", "uboj", "rolnictw\\w* ekologiczn"
].join("|") + ")", "iu");

const decode = (s) => String(s || "").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const pl = (d) => d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

// --- GIS: ostrzeżenia publiczne (strona gov.pl) ---
export function parseGis(html, sinceMs) {
  const out = []; const seen = new Set();
  const A = /<a[^>]+href="(\/web\/gis\/(?:ostrzezenie|komunikat)[^"#?]*)"[^>]*>([\s\S]*?)<\/a>/i;
  // każdy wpis listy to osobny <li> albo <article>: data jest w tym samym bloku co link
  const blocks = String(html).split(/<(?:li|article)[\s>]/i).slice(1);
  for (const block of blocks) {
    const m = block.match(A);
    if (!m) continue;
    const href = "https://www.gov.pl" + m[1];
    if (seen.has(href)) continue;
    const title = decode(m[2].replace(/<[^>]+>/g, " "));
    if (title.length < 20) continue;
    const dm = block.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const date = dm ? new Date(`${dm[3]}-${dm[2]}-${dm[1]}T12:00:00Z`) : null;
    if (!date || date.getTime() < sinceMs) continue;      // bez pewnej daty nie bierzemy
    seen.add(href); out.push({ title, url: href, date: pl(date) });
    if (out.length >= 12) break;
  }
  return out;
}
async function gisWarnings(sinceMs) {
  try {
    const r = await fetch("https://www.gov.pl/web/gis/ostrzezenia", { headers: UA, signal: AbortSignal.timeout(10000) });
    return r.ok ? parseGis(await r.text(), sinceMs) : [];
  } catch { return []; }
}

// --- Dziennik Ustaw: akty dotyczące żywności (API Sejmu ELI) ---
async function eliJson(path) {
  const r = await fetch("https://api.sejm.gov.pl/eli" + path, { headers: { ...UA, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`ELI ${r.status}`);
  return r.json();
}
export async function lawChanges(now = new Date()) {
  const year = now.getUTCFullYear();
  let items = [];
  for (const y of [year, year - 1]) {
    try { const d = await eliJson(`/acts/DU/${y}`); items = items.concat(Array.isArray(d?.items) ? d.items : []); } catch { /* źródło niedostępne */ }
    if (items.length && y === year && now.getUTCMonth() > 1) break;
  }
  const relevant = items.filter((a) => LAW_WORDS.test(String(a.title || "")));
  const recent = relevant.filter((a) => {
    const d = new Date(a.promulgation || a.announcementDate || 0).getTime();   // data publikacji w Dz.U.
    return d && now.getTime() - d <= 8 * DAY;
  });
  // szczegóły (data wejścia w życie) dla świeżych i ostatnich 40 trafnych aktów
  const candidates = [...new Map([...recent, ...relevant.slice(-40)].map((a) => [a.ELI || `${a.year}/${a.pos}`, a])).values()].slice(-45);
  const detailed = [];
  for (const a of candidates) {
    let d = a;
    try { d = { ...a, ...(await eliJson(`/acts/DU/${a.year}/${a.pos}`)) }; } catch { /* bez szczegółów */ }
    detailed.push(d);
  }
  const toItem = (a) => ({
    title: decode(a.title), address: a.displayAddress || `Dz.U. ${a.year} poz. ${a.pos}`,
    published: a.promulgation || a.announcementDate || "", entry_into_force: a.entryIntoForce || "",
    url: `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU${a.year}${String(a.pos).padStart(7, "0")}`
  });
  const recentKeys = new Set(recent.map((a) => `${a.year}/${a.pos}`));
  const newActs = detailed.filter((a) => recentKeys.has(`${a.year}/${a.pos}`)).map(toItem);
  const upcoming = detailed.filter((a) => {
    const e = new Date(a.entryIntoForce || 0).getTime();
    return e && e > now.getTime() && e - now.getTime() <= 120 * DAY;
  }).map(toItem).sort((x, y) => String(x.entry_into_force).localeCompare(String(y.entry_into_force)));
  return { newActs: newActs.slice(0, 10), upcoming: upcoming.slice(0, 10), sourceOk: items.length > 0 };
}

export async function collectSources({ reports = [], now = new Date() } = {}) {
  const since = now.getTime() - 4.5 * DAY;    // od poprzedniego wydania (wt–pt / pt–wt)
  let [gis, law] = await Promise.all([gisWarnings(since), lawChanges(now)]);
  let gisRecent = false;
  if (!gis.length) { gis = (await gisWarnings(now.getTime() - 30 * DAY)).slice(0, 4); gisRecent = gis.length > 0; }
  const ours = reports.filter((r) => r.published_at && new Date(r.published_at).getTime() >= since)
    .map((r) => ({ title: r.data?.title, sev: r.data?.sev, what: r.data?.what, batch: r.data?.batch, todo: r.data?.todo, src: r.data?.src, kind: r.kind, official: r.data?.official }))
    .filter((r) => r.title).slice(0, 12);
  return { gis, gisRecent, law, ours, period: `${pl(new Date(since))} – ${pl(now)}` };
}

const INSTRUCTIONS = `Jesteś redakcją newslettera Jem Bezpiecznie (bezpieczeństwo żywności w Polsce). Piszesz wydanie dla konsumentów i firm spożywczych.
Zasady bezwzględne:
- Fakty bierz WYŁĄCZNIE z dostarczonych materiałów (GIS, Dziennik Ustaw, raporty Jem Bezpiecznie). Jeśli masz narzędzie wyszukiwania, możesz dodać 1–3 ważne informacje z oficjalnych źródeł (gov.pl, europa.eu, efsa.europa.eu, eur-lex.europa.eu, sejm.gov.pl) z linkiem – tylko gdy je naprawdę znalazłeś.
- Nie wymyślaj dat, numerów aktów, nazw firm ani partii. Przy każdej pozycji podaj link źródłowy z materiałów.
- Daty wejścia w życie podawaj tylko z pola entry_into_force.
- Nie używaj słów „bot”, „agent” ani „AI”. Piszemy jako redakcja („my”).
- Po polsku, rzeczowo, krótko. Bez porad prawnych – przy prawie zachęć do sprawdzenia pełnego tekstu.
Struktura (pomiń sekcję, jeśli brak materiałów; nie pisz „brak informacji”):
1. „Najważniejsze w skrócie” – 3–5 punktów.
2. „Ostrzeżenia i wycofania” – każda pozycja: tytuł, 1 zdanie co zrobić, link.
3. „Zmiany w prawie” – nowe akty: czego dotyczą (1–2 zdania), adres Dz.U., link.
4. „Nadchodzące zmiany” – akty z datą wejścia w życie w przyszłości: data, czego dotyczą, link.
5. „Z naszej społeczności” – raporty Jem Bezpiecznie.
Odpowiedz WYŁĄCZNIE JSON: {"subject":"temat maila do 80 znaków","preheader":"1 zdanie do 120 znaków","sections":[{"title":"...","items":[{"title":"...","text":"...","url":"https://..."}]}]}`;

export async function composeIssue(src) {
  const input = `Okres: ${src.period}\n\n${src.gisRecent ? "OSTRZEŻENIA GIS (w tym okresie nie było nowych – to ostatnie z 30 dni; zatytułuj sekcję „Przypominamy: ostatnie ostrzeżenia GIS”)" : "OSTRZEŻENIA GIS"}:\n${JSON.stringify(src.gis)}\n\nNOWE AKTY W DZIENNIKU USTAW:\n${JSON.stringify(src.law.newActs)}\n\nNADCHODZĄCE WEJŚCIA W ŻYCIE:\n${JSON.stringify(src.law.upcoming)}\n\nRAPORTY JEM BEZPIECZNIE:\n${JSON.stringify(src.ours)}`;
  const { text } = await aiText({ instructions: INSTRUCTIONS, input, tools: [{ type: "web_search" }], timeoutMs: 50000 });
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Brak JSON w treści wydania");
  return sanitizeIssue(JSON.parse(m[0]));
}

const OK_HOSTS = ["gov.pl", "europa.eu", "sejm.gov.pl", "jembezpiecznie.com", "who.int", "fao.org"];
const okUrl = (u) => { try { const h = new URL(u).hostname; return /^https:/.test(u) && OK_HOSTS.some((d) => h === d || h.endsWith("." + d)); } catch { return false; } };
const clip = (v, n) => String(v || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
export function sanitizeIssue(j) {
  const sections = (Array.isArray(j.sections) ? j.sections : []).slice(0, 6).map((s) => ({
    title: clip(s.title, 60),
    items: (Array.isArray(s.items) ? s.items : []).slice(0, 10).map((i) => ({ title: clip(i.title, 160), text: clip(i.text, 500), url: okUrl(i.url) ? i.url : "" })).filter((i) => i.title || i.text)
  })).filter((s) => s.title && s.items.length);
  return { subject: clip(j.subject, 90) || "Bezpieczeństwo żywności: przegląd Jem Bezpiecznie", preheader: clip(j.preheader, 140), sections };
}

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function renderEmail(issue, { unsubscribeUrl, dateLabel }) {
  const secs = issue.sections.map((s) => `
    <tr><td style="padding:26px 32px 4px"><h2 style="margin:0;font:600 22px/1.3 Georgia,'Times New Roman',serif;color:#0b1033">${esc(s.title)}</h2></td></tr>
    ${s.items.map((i) => `<tr><td style="padding:12px 32px 0">
      <p style="margin:0 0 4px;font:700 15px/1.45 Arial,Helvetica,sans-serif;color:#0b1033">${esc(i.title)}</p>
      ${i.text ? `<p style="margin:0;font:400 15px/1.55 Arial,Helvetica,sans-serif;color:#3b4166">${esc(i.text)}</p>` : ""}
      ${i.url ? `<p style="margin:6px 0 0;font:400 13px/1.4 Arial,Helvetica,sans-serif"><a href="${esc(i.url)}" style="color:#3c52c4">Źródło →</a></p>` : ""}
    </td></tr>`).join("")}`).join("");
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(issue.subject)}</title></head>
<body style="margin:0;background:#eef0f8"><span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(issue.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0a0e2c;background-image:linear-gradient(135deg,#0a0e2c,#2b1d6b 60%,#0f4c5c);padding:30px 32px">
<p style="margin:0;font:600 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#9fd8e6">Newsletter · ${esc(dateLabel)}</p>
<h1 style="margin:10px 0 0;font:600 30px/1.2 Georgia,'Times New Roman',serif;color:#ffffff">Jem Bezpiecznie</h1>
<p style="margin:8px 0 0;font:400 15px/1.5 Arial,Helvetica,sans-serif;color:#d8ddf7">${esc(issue.preheader || "Przegląd bezpieczeństwa żywności w Polsce")}</p></td></tr>
${secs}
<tr><td style="padding:30px 32px"><a href="${SITE}" style="display:inline-block;background:#0a0e2c;color:#ffffff;text-decoration:none;font:700 15px Arial,Helvetica,sans-serif;padding:14px 22px;border-radius:999px">Więcej na jembezpiecznie.com</a></td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid #e3e6f2;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6b7194">
Otrzymujesz tę wiadomość, bo zapisałeś(-aś) się na newsletter na jembezpiecznie.com. Informacje mają charakter ogólny i nie zastępują porady prawnej – zawsze sprawdź pełny tekst przepisu lub komunikatu.<br>
Administrator danych: Jem Bezpiecznie, kontakt: <a href="mailto:${FROM}" style="color:#3c52c4">${FROM}</a>.<br>
<a href="${esc(unsubscribeUrl)}" style="color:#3c52c4">Wypisz się z newslettera</a></td></tr>
</table></td></tr></table></body></html>`;
}
export function renderText(issue, unsubscribeUrl) {
  return [issue.subject, issue.preheader, "", ...issue.sections.flatMap((s) => [s.title.toUpperCase(), ...s.items.map((i) => `- ${i.title}${i.text ? ": " + i.text : ""}${i.url ? " (" + i.url + ")" : ""}`), ""]),
    `Więcej: ${SITE}`, `Wypisz się: ${unsubscribeUrl}`].join("\n");
}

export function smtpReady() { return Boolean(process.env.NEWSLETTER_SMTP_PASS); }
export function transport() {
  return nodemailer.createTransport({
    host: process.env.NEWSLETTER_SMTP_HOST || "smtp.mail.yahoo.com", port: Number(process.env.NEWSLETTER_SMTP_PORT || 465), secure: true,
    auth: { user: FROM, pass: process.env.NEWSLETTER_SMTP_PASS }, pool: true, maxConnections: 1, maxMessages: 50
  });
}

export async function sendIssue(issue, subscribers, { dateLabel }) {
  const t = transport();
  let sent = 0, failed = 0;
  // kopia wydania na skrzynkę Jem Bezpiecznie
  const copyUnsub = `${QA}/api/community?mode=unsubscribe&t=kopia`;
  await t.sendMail({ from: `"Jem Bezpiecznie" <${FROM}>`, to: FROM, subject: `[Kopia] ${issue.subject}`, html: renderEmail(issue, { unsubscribeUrl: copyUnsub, dateLabel }), text: renderText(issue, copyUnsub) });
  for (const s of subscribers) {
    const unsub = `${QA}/api/community?mode=unsubscribe&t=${s.token}`;
    try {
      await t.sendMail({
        from: `"Jem Bezpiecznie" <${FROM}>`, to: s.email, replyTo: FROM, subject: issue.subject,
        html: renderEmail(issue, { unsubscribeUrl: unsub, dateLabel }), text: renderText(issue, unsub),
        headers: { "List-Unsubscribe": `<${unsub}>, <mailto:${FROM}?subject=Wypisz>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      });
      sent++;
    } catch (e) { failed++; console.error("newsletter send", e.message); }
    await new Promise((ok) => setTimeout(ok, 400));
  }
  t.close();
  return { sent, failed };
}
