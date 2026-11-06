// ============================================================
//  Agent-redaktor Jem Bezpiecznie / QASUPPORT
//  Zamienia surowe zgłoszenie (tekst, link, opis z Telegrama) w raport
//  w formacie strony: date, sev, title, what, batch, firm, why, todo, src.
//  Model: ta sama bramka AI co asystent QASUPPORT (OpenAI lub Vercel AI Gateway).
// ============================================================
import { aiText } from "./ai-call.js";

const INSTRUCTIONS = `Jesteś redaktorem serwisu Jem Bezpiecznie (bezpieczeństwo żywności, Polska).
Dostajesz zgłoszenie z Telegrama: komunikat o wycofaniu produktu, ostrzeżenie GIS/RASFF albo zgłoszenie członka społeczności z rynku (np. coś niepokojącego w sklepie).
Twoje zadanie: przygotować krótki, rzetelny raport po polsku dla konsumentów.

Zasady (bezwzględne):
- Nie wymyślaj faktów. Używaj tylko informacji ze zgłoszenia albo z oficjalnych źródeł, które sprawdzisz w sieci (gis.gov.pl, ec.europa.eu/food/safety/rasff, strony producenta).
- Jeśli zgłoszenie dotyczy oficjalnego komunikatu, spróbuj znaleźć go na gis.gov.pl i podaj link w "src". Ustaw "official": true tylko, gdy komunikat naprawdę istnieje.
- Zgłoszenie członka bez potwierdzenia w oficjalnym źródle: kind "report", official false, ton ostrożny ("członek społeczności zgłasza…"), bez oskarżania firmy. Nazwę firmy podaj tylko, jeśli jest w zgłoszeniu.
- Brakujące pola zostaw jako pusty tekst. Nie zgaduj numerów partii ani dat.
- "relevant": false, gdy tekst nie dotyczy bezpieczeństwa żywności, materiałów do kontaktu z żywnością ani suplementów (spam, reklama, rozmowa).
- "sev": "Wysokie ryzyko" (patogeny, substancje zakazane, alergeny nieoznakowane, ciała obce), "Średnie ryzyko" (przekroczenia, migracja z opakowań, błędy etykiet) albo "Informacja".
- "todo": jedno lub dwa zdania, co ma zrobić konsument.
- Krótko: title do 90 znaków, why do 220 znaków.

Odpowiedz WYŁĄCZNIE obiektem JSON:
{"relevant":true,"kind":"recall|report","official":false,"date":"DD.MM.RRRR","sev":"","title":"","what":"","batch":"","firm":"","why":"","todo":"","src":""}`;

export async function structureReport({ text, url, kind, submittedAt }) {
  const input = `Rodzaj zgłoszenia: ${kind === "report" ? "zgłoszenie członka z rynku" : "wycofanie / ostrzeżenie"}\n` +
    `Data zgłoszenia: ${new Date(submittedAt || Date.now()).toLocaleDateString("pl-PL")}\n` +
    (url ? `Link w zgłoszeniu: ${url}\n` : "") + `Treść:\n${String(text).slice(0, 4000)}`;
  const { text: out } = await aiText({ instructions: INSTRUCTIONS, input, tools: [{ type: "web_search" }], timeoutMs: 50000 });
  return normalize(parseJson(out), { url, kind });
}

export function parseJson(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Agent nie zwrócił JSON");
  return JSON.parse(m[0]);
}

const clip = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
export function normalize(j, { url, kind } = {}) {
  const src = clip(j.src || url, 500);
  const sev = ["Wysokie ryzyko", "Średnie ryzyko", "Informacja"].includes(j.sev) ? j.sev : "Informacja";
  return {
    relevant: j.relevant !== false,
    kind: j.kind === "report" || kind === "report" ? (j.official ? "recall" : "report") : "recall",
    official: Boolean(j.official),
    date: /^\d{2}\.\d{2}\.\d{4}$/.test(String(j.date || "")) ? j.date : new Date().toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }),
    sev, mid: sev !== "Wysokie ryzyko",
    title: clip(j.title, 90), what: clip(j.what, 200), batch: clip(j.batch, 160), firm: clip(j.firm, 120),
    why: clip(j.why, 260), todo: clip(j.todo, 220),
    src: /^https?:\/\//i.test(src) ? src : ""
  };
}
