// Polskie maile z linkiem potwierdzenia konta i resetu hasła (Jem Bezpiecznie, QA Support, portal). Autor: MT
import nodemailer from "nodemailer";
import { jbEntitlement } from "./jb.js";

const FROM = process.env.NEWSLETTER_SMTP_USER || "JemBezpiecznie@yahoo.com";
const CONFIRM_URL = "https://qasupport.jembezpiecznie.com/quality/potwierdz/";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  signup: {
    subject: "Potwierdź adres e-mail – JemBezpiecznie",
    title: "Witaj w JemBezpiecznie",
    body: "Kliknij przycisk, aby potwierdzić adres e-mail i aktywować konto. Jedno konto działa w aplikacji Jem Bezpiecznie, w QA Support i na portalu jembezpiecznie.com.",
    button: "Potwierdź e-mail",
    foot: "Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość."
  },
  magiclink: {
    subject: "Potwierdź adres e-mail – JemBezpiecznie",
    title: "Dokończ zakładanie konta",
    body: "Kliknij przycisk, aby potwierdzić adres e-mail. Po potwierdzeniu zalogujesz się hasłem podanym przy rejestracji.",
    button: "Potwierdź e-mail",
    foot: "Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość."
  },
  recovery: {
    subject: "Ustaw nowe hasło – JemBezpiecznie",
    title: "Reset hasła",
    body: "Otrzymaliśmy prośbę o zmianę hasła do Twojego konta. Kliknij przycisk i ustaw nowe hasło. Link działa jednorazowo i przez ograniczony czas.",
    button: "Ustaw nowe hasło",
    foot: "Jeśli nie prosiłeś o zmianę hasła, zignoruj tę wiadomość – hasło pozostanie bez zmian."
  }
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function render(kind, url) {
  const c = COPY[kind];
  const html = `<div style="background:#05071a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#f2f4ff">
<div style="max-width:520px;margin:0 auto;background:#0d1130;border:1px solid #1d2456;border-radius:16px;padding:28px">
<h2 style="margin:0 0 12px;color:#4ff0e0">${c.title}</h2>
<p style="line-height:1.55;margin:0 0 20px;color:#f2f4ff">${c.body}</p>
<p style="margin:0 0 24px"><a href="${esc(url)}" style="display:inline-block;background:#4ff0e0;color:#05071a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${c.button}</a></p>
<p style="font-size:13px;color:#9aa3d6;line-height:1.5;margin:0 0 10px">Jeśli przycisk nie działa, skopiuj ten adres do przeglądarki:<br><span style="word-break:break-all;color:#cfd5ff">${esc(url)}</span></p>
<p style="font-size:13px;color:#9aa3d6;line-height:1.5;margin:0">${c.foot}</p>
<p style="font-size:12px;color:#6d76a8;margin:20px 0 0">JemBezpiecznie.com · Jem Bezpiecznie i QA Support</p>
</div></div>`;
  const text = `${c.title}\n\n${c.body}\n\n${c.button}: ${url}\n\n${c.foot}\n\nJemBezpiecznie.com`;
  return { subject: c.subject, html, text };
}

let transport;
function mailer() {
  if (!process.env.NEWSLETTER_SMTP_PASS) return null;
  transport ||= nodemailer.createTransport({
    host: process.env.NEWSLETTER_SMTP_HOST || "smtp.mail.yahoo.com", port: Number(process.env.NEWSLETTER_SMTP_PORT || 465), secure: true,
    auth: { user: FROM, pass: process.env.NEWSLETTER_SMTP_PASS }
  });
  return transport;
}

/**
 * kind: "signup" | "recovery" | "magiclink"; app: "jb" | "qa" | "portal".
 * Zwraca { status: "sent" | "exists" | "none" | "rate", wait? } albo rzuca błąd (wtedy wołający może użyć wysyłki Supabase).
 */
export async function sendAuthMail({ kind, email, password = "", app = "qa" }) {
  email = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { const e = new Error("Podaj prawidłowy adres e-mail."); e.status = 400; throw e; }
  const t = mailer();
  if (!t) throw new Error("smtp_not_configured");
  const r = await jbEntitlement("auth_link", { kind, email, password });
  if (r?.status !== "ok") return r || { status: "none" };
  if (!r.hashed_token) throw new Error("no_token");
  const dest = ["jb", "qa", "portal"].includes(app) ? app : "qa";
  const url = `${CONFIRM_URL}?t=${encodeURIComponent(r.hashed_token)}&type=${r.kind}&app=${dest}`;
  const m = render(r.kind, url);
  await t.sendMail({ from: `"Jem Bezpiecznie" <${FROM}>`, to: email, replyTo: FROM, subject: m.subject, html: m.html, text: m.text });
  return { status: "sent", kind: r.kind };
}

// Publiczny endpoint /api/jb-auth: { action: "signup" | "recover" | "resend", email, password?, app }
export async function authMailHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  const action = String(b.action || "");
  if (action === "feedback") return feedbackHandler(b, res);
  const kind = action === "signup" ? "signup" : action === "recover" ? "recovery" : action === "resend" ? "magiclink" : "";
  if (!kind) return res.status(400).json({ ok: false, error: "Nieznana operacja." });
  if (kind === "signup" && String(b.password || "").length < 8) return res.status(400).json({ ok: false, error: "Hasło jest za krótkie." });
  try {
    const out = await sendAuthMail({ kind, email: b.email, password: b.password, app: String(b.app || "qa") });
    if (out.status === "rate") return res.status(429).json({ ok: false, code: "rate", error: out.wait > 60 ? "Wysłaliśmy już kilka linków. Spróbuj ponownie za godzinę." : "Link był wysłany przed chwilą. Odczekaj minutę i spróbuj ponownie." });
    if (kind === "signup" && out.status === "exists") return res.status(409).json({ ok: false, code: "exists", error: "To konto już istnieje. Zaloguj się albo użyj „Nie pamiętam hasła”." });
    return res.status(200).json({ ok: true, status: out.status === "sent" ? "sent" : "ok" });
  } catch (e) {
    if (e?.status === 400) return res.status(400).json({ ok: false, error: e.message });
    console.error("jb_auth_mail_error", e?.message);
    return res.status(502).json({ ok: false, code: "mail_failed", error: "Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę." });
  }
}

// ===== Jednorazowa wiadomość z prośbą o opinię (wysyłka jako "Jem Bezpiecznie") =====
// POST /api/jb-auth { action: "feedback", key, recipients: [{ email, variant: "user" | "unconfirmed" | "newsletter" }] }
// Chronione kluczem (hash SHA-256 poniżej); maks. 25 odbiorców na wywołanie.
const FB_SUBJECT = "Masz 2 minuty? Twoje zdanie zmieni Jem Bezpiecznie";
function feedbackMail(variant) {
  const intro = variant === "newsletter"
    ? "Zapisałaś/zapisałeś się na newsletter Jem Bezpiecznie jako jedna z pierwszych osób. Dziękujemy! Zanim ruszymy pełną parą, chcemy zapytać Cię wprost o zdanie."
    : "Masz konto w Jem Bezpiecznie i należysz do pierwszych osób, które z nami są. Dziękujemy! Zanim ruszymy pełną parą, chcemy zapytać Cię wprost o zdanie.";
  const extra = variant === "unconfirmed"
    ? `<p style="line-height:1.55;margin:0 0 18px;padding:12px 14px;border-radius:10px;background:#1a1f4a;color:#f2f4ff">Twoje konto czeka jeszcze na potwierdzenie. W osobnym mailu wysłaliśmy nowy link – sprawdź też folder Spam. Przepraszamy, jeśli pierwszy link nie dotarł: w tych dniach domena była chwilowo niedostępna.</p>`
    : variant === "newsletter"
      ? `<p style="line-height:1.55;margin:0 0 18px">Jeśli chcesz korzystać też z aplikacji, załóż bezpłatne konto: <a href="https://app.jembezpiecznie.com/?utm_source=feedback_mail" style="color:#4ff0e0">app.jembezpiecznie.com</a></p>`
      : "";
  const html = `<div style="background:#05071a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#f2f4ff">
<div style="max-width:560px;margin:0 auto;background:#0d1130;border:1px solid #1d2456;border-radius:16px;padding:28px">
<h2 style="margin:0 0 14px;color:#4ff0e0">Cześć! Potrzebujemy Twojej opinii</h2>
<p style="line-height:1.55;margin:0 0 18px">${intro}</p>
${extra}
<p style="line-height:1.55;margin:0 0 8px"><b>Trzy krótkie pytania:</b></p>
<ol style="line-height:1.6;margin:0 0 18px;padding-left:20px">
<li>Czy strona <a href="https://jembezpiecznie.com/?utm_source=feedback_mail" style="color:#4ff0e0">jembezpiecznie.com</a> spełnia Twoje oczekiwania? Czego na niej brakuje?</li>
<li>Czy <a href="https://app.jembezpiecznie.com/?utm_source=feedback_mail" style="color:#4ff0e0">aplikacja</a> działa u Ciebie bez problemów (logowanie, sprawdzanie etykiet, ceny w sklepach)? Na jakim telefonie z niej korzystasz?</li>
<li>Jaka jedna funkcja sprawiłaby, że zaglądał(a)byś do nas co tydzień?</li>
</ol>
<p style="line-height:1.55;margin:0 0 22px">Wystarczy <b>odpisać na tego maila</b> – nawet jednym zdaniem.</p>
<div style="border:1px solid #4ff0e0;border-radius:14px;padding:18px 18px 6px;margin:0 0 22px;background:rgba(79,240,224,.06)">
<p style="margin:0 0 10px;color:#4ff0e0;font-weight:bold">W podziękowaniu za odpowiedź:</p>
<p style="line-height:1.55;margin:0 0 12px">🔍 <b>Darmowa ekspertyza etykiety.</b> Dołącz do odpowiedzi zdjęcie etykiety dowolnego produktu z Twojej kuchni. Specjalista ds. bezpieczeństwa żywności sprawdzi ją z przepisami (alergeny, dodatki, hasła typu „fit”, „bio”, „bez cukru”) i odpisze w ciągu 48 godzin.</p>
<p style="line-height:1.55;margin:0 0 12px">🏅 <b>Status Członka Założyciela.</b> Każda osoba, która odpowie do 3 grudnia, dostanie miesiąc Premium za darmo i jako pierwsza zobaczy nowe funkcje.</p>
</div>
<p style="line-height:1.55;margin:0 0 6px">Dziękujemy, że pomagasz nam budować miejsce, w którym łatwiej wiedzieć, co się je.</p>
<p style="line-height:1.55;margin:0 0 0"><b>Zespół Jem Bezpiecznie</b></p>
<p style="font-size:12px;color:#6d76a8;line-height:1.5;margin:22px 0 0">Dostajesz tę wiadomość, bo ${variant === "newsletter" ? "zapisałaś/zapisałeś się na newsletter" : "założyłaś/założyłeś konto w"} Jem Bezpiecznie. Nie chcesz takich wiadomości? Odpisz „STOP”.<br>JemBezpiecznie.com</p>
</div></div>`;
  const text = `Cześć! Potrzebujemy Twojej opinii\n\n${intro}\n\n${variant === "unconfirmed" ? "Twoje konto czeka na potwierdzenie – w osobnym mailu wysłaliśmy nowy link (sprawdź też Spam).\n\n" : ""}Trzy krótkie pytania:\n1. Czy strona jembezpiecznie.com spełnia Twoje oczekiwania? Czego brakuje?\n2. Czy aplikacja (app.jembezpiecznie.com) działa u Ciebie bez problemów? Na jakim telefonie?\n3. Jaka jedna funkcja sprawiłaby, że zaglądał(a)byś do nas co tydzień?\n\nWystarczy odpisać na tego maila.\n\nW podziękowaniu:\n- Darmowa ekspertyza etykiety: dołącz zdjęcie etykiety, specjalista sprawdzi ją z przepisami i odpisze w 48 h.\n- Status Członka Założyciela: odpowiedź do 3 grudnia = miesiąc Premium za darmo.\n\nZespół Jem Bezpiecznie\n\nNie chcesz takich wiadomości? Odpisz „STOP”.`;
  return { html, text };
}

export async function feedbackHandler(b, res) {
  // Klucz porównywany jako SHA-256 (sam klucz nie jest zapisany w repozytorium).
  const { createHash } = await import("node:crypto");
  const h = createHash("sha256").update(String(b.key || "")).digest("hex");
  if (h !== (process.env.JB_CAMPAIGN_KEY_SHA256 || "f6335ed29aef17f7a844c675285cef829287acaf71ef3934b5d11aba870d32a6")) return res.status(403).json({ ok: false, error: "forbidden" });
  const list = Array.isArray(b.recipients) ? b.recipients.slice(0, 25) : [];
  const t = mailer();
  if (!t) return res.status(500).json({ ok: false, error: "smtp_not_configured" });
  const results = [];
  for (const r of list) {
    const email = String(r?.email || "").trim().toLowerCase();
    const variant = ["user", "unconfirmed", "newsletter"].includes(r?.variant) ? r.variant : "user";
    if (!EMAIL_RE.test(email)) { results.push({ email, ok: false, error: "bad_email" }); continue; }
    try {
      const m = feedbackMail(variant);
      await t.sendMail({ from: `"Jem Bezpiecznie" <${FROM}>`, to: email, replyTo: FROM, subject: FB_SUBJECT, html: m.html, text: m.text });
      results.push({ email, ok: true });
    } catch (e) { results.push({ email, ok: false, error: String(e?.message || e).slice(0, 120) }); }
  }
  return res.status(200).json({ ok: true, results });
}
