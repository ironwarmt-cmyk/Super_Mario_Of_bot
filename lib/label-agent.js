// ============================================================
//  Analiza etykiety ze zdjęcia – Jem Bezpiecznie / QASUPPORT
//  Wejście: zdjęcie etykiety lub składu (data URL). Wyjście: ustrukturyzowana
//  ocena wg rozporządzeń 1169/2011 i 1333/2008. Używana na stronie
//  (/api/community?mode=label) i w Telegramie (/etykieta albo samo zdjęcie).
// ============================================================
import { aiText } from "./ai-call.js";
import { parseJson } from "./market-agent.js";

const INSTRUCTIONS = `Jesteś specjalistą ds. jakości i bezpieczeństwa żywności w redakcji Jem Bezpiecznie (Polska).
Dostajesz zdjęcie etykiety produktu spożywczego (albo samego składu). Oceniasz ją dla konsumenta, po polsku, prostym językiem.

Zasady bezwzględne:
- Opisuj tylko to, co naprawdę widać na zdjęciu. Niczego nie dopisuj ani nie zgaduj. Fragment nieczytelny oznacz jako nieczytelny.
- Jeśli na zdjęciu nie ma etykiety żywności ani składu, ustaw "readable": false i w "summary" napisz krótko, co zrobić (np. zrobić ostrzejsze zdjęcie składu).
- Przepisy podawaj tylko wtedy, gdy jesteś ich pewien. Podstawy: rozporządzenie (UE) nr 1169/2011 (informacje na etykiecie: art. 9 elementy obowiązkowe, art. 21 i załącznik II alergeny, art. 22 QUID, art. 24 daty, art. 30 wartość odżywcza), rozporządzenie (WE) nr 1333/2008 (dodatki; załącznik V – ostrzeżenie przy barwnikach E102, E104, E110, E122, E124, E129), rozporządzenie (UE) 2022/63 (E171 niedopuszczony od 2022), rozporządzenie (WE) nr 1924/2006 (oświadczenia żywieniowe i zdrowotne).
- 14 alergenów z załącznika II 1169/2011: zboża z glutenem, skorupiaki, jaja, ryby, orzeszki ziemne, soja, mleko, orzechy, seler, gorczyca, sezam, dwutlenek siarki i siarczyny, łubin, mięczaki. W składzie mają być wyróżnione (np. pogrubieniem, wielkimi literami). W "allergens" wpisz grupę z tej listy (np. „mleko” raz, nawet gdy w składzie jest mleko i śmietanka), w "name" możesz dopisać składnik w nawiasie. "emphasized": true/false, a null gdy nie da się ocenić ze zdjęcia.
- Elementy obowiązkowe (art. 9): nazwa, wykaz składników, alergeny, ilość składnika (QUID, gdy składnik jest w nazwie lub wyróżniony), ilość netto, data minimalnej trwałości lub termin przydatności, warunki przechowywania, nazwa i adres podmiotu, wartość odżywcza. Status: "ok" (widać), "missing" (powinno być na tej części i brak), "unclear" (nie ma tej części na zdjęciu albo nie da się ocenić). Gdy zdjęcie pokazuje tylko fragment opakowania, brakujące elementy oznacz "unclear", nie "missing".
- Dodatki: tylko substancje dodatkowe w rozumieniu 1333/2008 (numer E albo nazwa dodatku, np. skrobia modyfikowana) z nazwą i funkcją technologiczną. Numer E dopisz tylko, gdy jest na etykiecie albo gdy nazwa jednoznacznie mu odpowiada. Nie wpisuj zwykłych składników (żelatyna, skrobia, cukier) ani aromatów (osobne rozporządzenie 1334/2008). "note" tylko gdy jest coś ważnego dla konsumenta (np. wymagane ostrzeżenie, niedopuszczony dodatek). Nie strasz i nie oceniaj zdrowotnie bez podstawy w przepisach.
- "issues": konkretne uwagi do zgodności etykiety z przepisami, każda z przepisem w "law" (pusty, gdy nie jesteś pewien). Bez uwag – pusta lista.
- Nie udzielasz porad medycznych. Nie oskarżasz producenta – piszesz rzeczowo („na zdjęciu nie widać…”).
- Nie używaj słów „bot”, „agent” ani „AI”. Bez Markdown.
- Krótko: summary do 3 zdań, tips do 2 zdań.

Odpowiedz WYŁĄCZNIE obiektem JSON:
{"readable":true,"product":"","category":"","ingredients":"","allergens":[{"name":"","emphasized":true}],"additives":[{"code":"","name":"","function":"","note":""}],"mandatory":[{"item":"","status":"ok","note":""}],"issues":[{"text":"","law":""}],"summary":"","tips":""}`;

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);

export function normalizeLabel(j = {}) {
  const st = (s) => (["ok", "missing", "unclear"].includes(s) ? s : "unclear");
  return {
    readable: j.readable !== false,
    product: clip(j.product, 120),
    category: clip(j.category, 80),
    ingredients: clip(j.ingredients, 1800),
    allergens: arr(j.allergens, 14).map((a) => ({ name: clip(a?.name, 60), emphasized: a?.emphasized === true ? true : a?.emphasized === false ? false : null })).filter((a) => a.name),
    additives: arr(j.additives, 40).map((a) => ({ code: clip(a?.code, 12), name: clip(a?.name, 80), function: clip(a?.function, 80), note: clip(a?.note, 240) })).filter((a) => a.code || a.name),
    mandatory: arr(j.mandatory, 12).map((m) => ({ item: clip(m?.item, 60), status: st(m?.status), note: clip(m?.note, 200) })).filter((m) => m.item),
    issues: arr(j.issues, 10).map((i) => ({ text: clip(i?.text, 300), law: clip(i?.law, 120) })).filter((i) => i.text),
    summary: clip(j.summary, 500),
    tips: clip(j.tips, 300)
  };
}

export async function analyzeLabel({ image, note = "" }) {
  const input = "Przeanalizuj etykietę z załączonego zdjęcia." + (note ? `\nPytanie lub uwaga użytkownika: ${String(note).slice(0, 500)}` : "");
  const { text, model } = await aiText({ instructions: INSTRUCTIONS, input, images: [image], timeoutMs: 45000 });
  return { ...normalizeLabel(parseJson(text)), model };
}

// Wersja tekstowa (Telegram HTML i historia czatu na stronie).
export function labelText(a, esc = (s) => s) {
  if (!a.readable) return `🔍 <b>Nie udało się odczytać etykiety</b>\n${esc(a.summary || "Zrób ostrzejsze zdjęcie składu, z bliska i przy dobrym świetle.")}`;
  const icon = { ok: "✅", missing: "❌", unclear: "❔" };
  const out = [`🏷 <b>${esc(a.product || "Analiza etykiety")}</b>${a.category ? ` · ${esc(a.category)}` : ""}`];
  if (a.summary) out.push(esc(a.summary));
  if (a.allergens.length) out.push(`\n<b>Alergeny:</b> ${a.allergens.map((x) => esc(x.name) + (x.emphasized === false ? " (niewyróżniony!)" : "")).join(", ")}`);
  if (a.additives.length) out.push(`\n<b>Dodatki:</b>\n` + a.additives.map((x) => `• ${esc([x.code, x.name].filter(Boolean).join(" "))}${x.function ? ` – ${esc(x.function)}` : ""}${x.note ? `\n  ⚠️ ${esc(x.note)}` : ""}`).join("\n"));
  if (a.mandatory.length) out.push(`\n<b>Elementy obowiązkowe:</b>\n` + a.mandatory.map((m) => `${icon[m.status]} ${esc(m.item)}${m.note ? ` – ${esc(m.note)}` : ""}`).join("\n"));
  if (a.issues.length) out.push(`\n<b>Uwagi:</b>\n` + a.issues.map((i) => `• ${esc(i.text)}${i.law ? ` <i>(${esc(i.law)})</i>` : ""}`).join("\n"));
  if (a.tips) out.push(`\n💡 ${esc(a.tips)}`);
  out.push("\n<i>Ocena dotyczy tylko tego, co widać na zdjęciu. Przy objawach zdrowotnych skontaktuj się z lekarzem.</i>");
  return out.join("\n");
}
