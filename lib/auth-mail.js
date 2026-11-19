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
