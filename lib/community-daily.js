// ============================================================
//  Codzienne posty w wątkach grup QASUPPORT (@MT_Social_Control_bot)
//  Jeden post dziennie w każdym wątku każdej grupy.
//  Format zależy od dnia tygodnia, temat rotuje z listy przypisanej do wątku,
//  więc w ciągu miesiąca nic się nie powtarza.
// ============================================================
import { aiText } from "./ai-call.js";

export const FORMATS = {
  1: { tag: "📌 Wymóg w praktyce", how: "Wyjaśnij jeden konkretny wymóg (prawo UE/PL albo standard) i jak go spełnić w zakładzie lub sklepie. 3–5 krótkich zdań, na końcu jedna praktyczna wskazówka." },
  2: { tag: "🔎 Mit czy fakt?", how: "Podaj popularne twierdzenie, potem werdykt MIT albo FAKT i rzetelne wyjaśnienie w 3–4 zdaniach." },
  3: { tag: "❓ Pytanie dnia", how: "Krótko wprowadź temat (2 zdania) i zadaj członkom jedno otwarte pytanie do dyskusji. Zachęć do odpowiedzi w wątku." },
  4: { tag: "✅ Mini-checklista", how: "Daj checklistę 4–6 punktów (każdy zaczyna się od ▫️), krótkich i do odhaczenia od razu." },
  5: { tag: "⚠️ Typowy błąd", how: "Opisz częsty błąd lub niezgodność, dlaczego jest problemem i jak go uniknąć. 3–5 zdań." },
  6: { tag: "💡 Ciekawostka", how: "Podaj jedną ciekawą, sprawdzalną informację na temat i krótko wyjaśnij, co z niej wynika w praktyce." },
  0: { tag: "🧠 Quiz", how: "Zadaj jedno pytanie z 3 odpowiedziami A/B/C. Poprawną odpowiedź z jednym zdaniem wyjaśnienia umieść w znaczniku <tg-spoiler>…</tg-spoiler>." }
};

// Tematy rotujące dla każdego wątku (klucz wątku = klucz w quality_community_groups.topics).
export const SUBJECTS = {
  regular: {
    welcome: ["jak czytać datę minimalnej trwałości i termin przydatności", "co oznacza znak EKO/BIO na opakowaniu", "czym jest identyfikowalność żywności", "jak przechowywać żywność w lodówce", "czym różni się wycofanie od ostrzeżenia publicznego GIS", "jak sprawdzić numer partii produktu", "co to jest alergen i gdzie go szukać na etykiecie", "jak zgłosić problem z produktem w sklepie", "czym zajmuje się Państwowa Inspekcja Sanitarna", "jak działa łańcuch chłodniczy"],
    news: ["Portal członka i jedno konto do strony, aplikacji i grup", "agent AI na stronie jembezpiecznie.com i pytania o etykiety", "raporty agenta o wycofaniach z rynku", "zgłaszanie problemów z produktami przez /zgloszenie", "zweryfikowani polscy dostawcy i audyt", "aplikacja QASUPPORT dla działów jakości", "pakiety FREE, BASIC, PRO i VIP", "gra Myszka Audytorka w aplikacji QASUPPORT", "Akademia Jakości w aplikacji QASUPPORT", "tagi pakietów i nicki w grupach"],
    alerts: [],
    general: ["dodatki do żywności oznaczone literą E", "oświadczenia żywieniowe i zdrowotne na opakowaniach", "żywność dla osób z alergiami i nietolerancjami", "bezpieczne rozmrażanie żywności", "pleśń na żywności: kiedy wyrzucić", "wody butelkowane i ich oznakowanie", "suplementy diety a żywność", "żywność ekologiczna w UE", "etykieta produktu sprzedawanego luzem", "reklamacja żywności w sklepie"],
    game: ["higiena rąk w zakładzie spożywczym", "kontrola temperatur w chłodni", "ciała obce w produkcji", "oznakowanie alergenów na linii", "czystość i dezynfekcja powierzchni", "szkodniki w magazynie", "odzież ochronna personelu", "segregacja surowców surowych i gotowych", "przechowywanie chemii w zakładzie", "dokumentacja temperatury dostaw"]
  },
  basic: {
    welcome: ["jak zacząć budowę systemu HACCP", "rola zespołu ds. bezpieczeństwa żywności", "dokumentacja GHP/GMP w małym zakładzie", "jak prowadzić rejestry temperatur", "szkolenie wstępne pracownika produkcji", "plan mycia i dezynfekcji", "ocena dostawców w małej firmie", "procedura wycofania produktu", "kontrola szkodników", "zarządzanie alergenami w małym zakładzie"],
    docs: ["procedura identyfikowalności", "instrukcja mycia i dezynfekcji", "rejestr szkoleń pracowników", "procedura postępowania z reklamacją", "instrukcja higieny personelu", "karta kontroli temperatur", "procedura zatwierdzania dostawców", "plan kontroli szkodników", "procedura wycofania i odwołania produktu", "rejestr działań korygujących"],
    haccp: ["7 zasad HACCP", "analiza zagrożeń biologicznych", "zagrożenia chemiczne i fizyczne", "wyznaczanie CCP drzewkiem decyzyjnym", "limity krytyczne", "monitorowanie CCP", "działania korygujące przy przekroczeniu CCP", "weryfikacja systemu HACCP", "walidacja a weryfikacja", "programy warunków wstępnych PRP"],
    training: ["jak skutecznie szkolić z higieny", "sprawdzanie skuteczności szkoleń", "szkolenie z alergenów", "szkolenie z mycia rąk", "szkolenie nowych pracowników sezonowych", "kultura bezpieczeństwa żywności", "szkolenia dla kierowników zmian", "instruktaż stanowiskowy", "dokumentowanie szkoleń", "szkolenie z postępowania przy wycofaniu"],
    qa: ["częste pytania sanepidu podczas kontroli", "zatwierdzenie zakładu przez inspekcję", "badania wody w zakładzie", "badania mikrobiologiczne produktu", "oznakowanie wartości odżywczej", "przechowywanie próbek", "termometry i ich wzorcowanie", "odpady w zakładzie spożywczym", "transport żywności", "sprzedaż bezpośrednia i RHD"]
  },
  pro: {
    welcome: ["przejście z HACCP na standard uznany przez GFSI", "wybór między BRCGS, IFS a FSSC 22000", "przygotowanie zespołu do pierwszego audytu certyfikującego", "kultura bezpieczeństwa żywności w standardach", "audyty niezapowiedziane", "zarządzanie zmianą w systemie jakości", "przegląd zarządzania", "KPI działu jakości", "audyty wewnętrzne", "zarządzanie dokumentacją"],
    brcgs: ["kultura bezpieczeństwa żywności w BRCGS", "zobowiązanie najwyższego kierownictwa", "food defence i ocena podatności", "zarządzanie alergenami w BRCGS", "kontrola ciał obcych", "zarządzanie produktem niezgodnym", "audyt niezapowiedziany BRCGS", "wymagania dotyczące etykietowania", "ocena dostawców surowców", "wycofanie i test wycofania"],
    ifs: ["wymagania KO w IFS Food", "system punktacji IFS", "plan działań korygujących po audycie IFS", "IFS a kultura bezpieczeństwa żywności", "food fraud w IFS", "zarządzanie zasobami w IFS", "monitorowanie produktu w IFS", "IFS Food a ocena zagrożeń", "audyty niezapowiedziane IFS", "identyfikowalność w IFS"],
    audits: ["przygotowanie dokumentów przed audytem", "zachowanie zespołu podczas audytu", "klasyfikacja niezgodności", "najczęstsze niezgodności w zakładach", "odwołanie od oceny audytora", "audyt dostawcy na miejscu", "audyt zdalny", "dowody zamknięcia niezgodności", "audyty wewnętrzne krzyżowe", "plan audytów na rok"],
    capa: ["analiza 5 Why", "diagram Ishikawy", "różnica między korektą a działaniem korygującym", "ocena skuteczności CAPA", "trendy niezgodności", "priorytetyzacja działań", "CAPA po reklamacji klienta", "CAPA po incydencie mikrobiologicznym", "zamykanie CAPA w terminie", "działania zapobiegawcze"],
    suppliers: ["ocena ryzyka dostawcy", "specyfikacje surowców", "audyty dostawców", "monitoring dostawców w czasie", "dostawcy usług (pest control, laboratoria)", "zatwierdzanie nowego dostawcy", "dostawcy opakowań", "reklamacje do dostawcy", "podatność na zafałszowania surowców", "agenci i brokerzy"],
    labels: ["rozporządzenie 1169/2011 w pigułce", "wyróżnianie alergenów w wykazie składników", "oświadczenia żywieniowe wg rozporządzenia 1924/2006", "kraj pochodzenia składnika podstawowego", "QUID, czyli ilościowe oznaczenie składników", "data minimalnej trwałości a termin przydatności", "nazwa żywności i nazwy zastrzeżone", "etykietowanie dodatków do żywności", "informacja o żywności nieopakowanej", "wartość odżywcza i porcje"]
  },
  vip: {
    welcome: ["rola Quality Managera w zarządzie", "budowanie zespołu jakości", "budżet działu jakości", "komunikacja jakości z produkcją", "strategia certyfikacji na kilka lat", "zarządzanie kryzysowe", "raportowanie jakości do zarządu", "rozwój kompetencji zespołu", "współpraca z sieciami handlowymi", "digitalizacja systemu jakości"],
    expert: ["ocena ryzyka Listeria monocytogenes", "walidacja procesów termicznych", "ocena podatności na zafałszowania", "środowiskowy program monitoringu", "zarządzanie alergenami na liniach współdzielonych", "trwałość produktu i badania przechowalnicze", "migracja z opakowań", "kontrola zanieczyszczeń chemicznych", "ocena ryzyka nowych technologii", "wyznaczanie limitów mikrobiologicznych"],
    playbook: ["pierwsze 90 dni Quality Managera", "mapa procesów działu jakości", "KPI i tablica wyników jakości", "przegląd zarządzania krok po kroku", "plan szkoleń rocznych", "plan audytów i inspekcji", "zarządzanie reklamacjami strategicznymi", "rozmowa z audytorem sieci", "przygotowanie do audytu niezapowiedzianego", "budowanie kultury bezpieczeństwa żywności"],
    cases: ["incydent z ciałem obcym", "nieoznakowany alergen na rynku", "pozytywny wynik Listeria w środowisku", "reklamacja kluczowego klienta", "wycofanie produktu w weekend", "niezgodność krytyczna na audycie", "błąd etykiety po zmianie receptury", "problem z dostawcą surowca", "awaria chłodni", "kontrola urzędowa z decyzją"],
    emergency: ["co sprawdzić 7 dni przed audytem", "szybki audyt wewnętrzny", "przegląd zamkniętych niezgodności", "test identyfikowalności przed audytem", "przegląd dokumentacji HACCP", "obchód zakładu oczami audytora", "przygotowanie zespołu do rozmów", "evidence pack dla audytora", "test wycofania", "przegląd szkoleń i kompetencji"],
    briefs: ["kierunki zmian w standardach GFSI", "kultura bezpieczeństwa żywności w przepisach UE", "rozwój systemu RASFF", "zrównoważony rozwój w łańcuchu dostaw", "digitalizacja w kontroli jakości", "nowe metody wykrywania zafałszowań", "trendy w reklamacjach konsumenckich", "żywność roślinna a wymagania", "opakowania i recykling a bezpieczeństwo żywności", "sztuczna inteligencja w zapewnieniu jakości"]
  }
};

export const TIER_AUDIENCE = {
  regular: "konsumenci i początkujący członkowie społeczności (język prosty, bez żargonu)",
  basic: "pracownicy i właściciele małych zakładów spożywczych (praktycznie, podstawy HACCP)",
  pro: "specjaliści ds. jakości wdrażający BRCGS, IFS, FSSC 22000 (fachowo, konkretnie)",
  vip: "kierownicy jakości i eksperci (poziom ekspercki, strategicznie)"
};

const OFFICIAL = "gov.pl/web/gis, eur-lex.europa.eu, efsa.europa.eu, food.ec.europa.eu, codex.fao.org, who.int, mygfsi.com, brcgs.com, ifs-certification.com, fssc.com";

export function dayIndex(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

export function planFor(tier, topics, date = new Date()) {
  const fmt = FORMATS[date.getUTCDay()];
  const doy = dayIndex(date);
  return Object.entries(topics || {})
    .filter(([key]) => key !== "alerts" && SUBJECTS[tier]?.[key]?.length)
    .map(([key, thread]) => {
      const list = SUBJECTS[tier][key];
      const subject = list[doy % list.length];
      const f = key === "news" ? { tag: "📣 Funkcja dnia", how: "Przedstaw krótko jedną funkcję systemu Jem Bezpiecznie / QASUPPORT i jak z niej skorzystać. 3–4 zdania, zachęta na końcu." } : fmt;
      return { key, thread: Number(thread), subject, tag: f.tag, how: f.how };
    });
}

export async function writePosts(tier, plan) {
  if (!plan.length) return [];
  const instructions = `Jesteś redaktorem społeczności QASUPPORT i Jem Bezpiecznie (bezpieczeństwo i jakość żywności, Polska).
Piszesz codzienne posty do wątków grupy na Telegramie. Odbiorcy: ${TIER_AUDIENCE[tier]}.
Zasady:
- Po polsku, ciepło i rzeczowo. Każdy post 350–850 znaków.
- Tylko pewna, sprawdzalna wiedza. Nie podawaj liczb, limitów ani numerów przepisów, jeśli nie masz całkowitej pewności. Nie wymyślaj badań ani statystyk.
- Możesz dodać na końcu jeden link źródłowy, ale tylko do oficjalnej strony z tej listy: ${OFFICIAL}.
- Formatowanie Telegram HTML: wolno <b>, <i>, <tg-spoiler>. Bez Markdown, bez innych znaczników.
- Pierwsza linia: <b>{tag}</b> · {temat w kilku słowach}.
- Na końcu jedna linia z hashtagami: #QASUPPORT oraz jeden hashtag tematyczny.
- Bez reklam firm i bez porad medycznych.
Odpowiedz WYŁĄCZNIE tablicą JSON: [{"key":"...","text":"..."}] w tej samej kolejności co zadania.`;
  const input = plan.map((p, i) => `${i + 1}. key=${p.key}; tag="${p.tag}"; temat: ${p.subject}; jak napisać: ${p.how}`).join("\n");
  const { text } = await aiText({ instructions, input, timeoutMs: 45000 });
  const m = String(text).match(/\[[\s\S]*\]/);
  if (!m) throw new Error("Brak JSON w odpowiedzi agenta");
  const arr = JSON.parse(m[0]);
  return plan.map((p) => ({ ...p, text: sanitizeHtml((arr.find((x) => x.key === p.key) || {}).text || "") })).filter((p) => p.text.length > 80);
}

// Telegram HTML: zostawiamy tylko b, i, tg-spoiler i linki https do oficjalnych domen.
const ALLOWED_HOSTS = ["gov.pl", "europa.eu", "fao.org", "who.int", "mygfsi.com", "brcgs.com", "ifs-certification.com", "fssc.com"];
export function sanitizeHtml(s) {
  let out = String(s).slice(0, 1500).replace(/&(?!(amp|lt|gt|quot);)/g, "&amp;");
  out = out.replace(/<(\/?)(b|i|tg-spoiler)>/g, "\u0001$1$2\u0002");
  out = out.replace(/<a\s+href="(https:\/\/[^"]+)">([^<]{1,80})<\/a>/g, (all, href, label) => {
    try { const h = new URL(href).hostname; return ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d)) ? `\u0001a href="${href}"\u0002${label}\u0001/a\u0002` : label; } catch { return label; }
  });
  out = out.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u0001/g, "<").replace(/\u0002/g, ">");
  return out.trim();
}

export function alertsDigest(reports) {
  const day = 86400000;
  const fresh = (reports || []).filter((r) => r.published_at && Date.now() - new Date(r.published_at).getTime() < day);
  if (!fresh.length) {
    return "<b>🚨 Przegląd alertów</b> · ostatnie 24 godziny\n\nBrak nowych raportów w ciągu doby. Pamiętaj: aktualne komunikaty Głównego Inspektoratu Sanitarnego są na stronie gov.pl/web/gis/ostrzezenia, a raporty agenta na jembezpiecznie.com.\n\nZauważyłeś problem z produktem? Napisz do bota: /zgloszenie\n#QASUPPORT #alerty";
  }
  const esc = (x) => String(x || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<b>🚨 Przegląd alertów</b> · ostatnie 24 godziny\n\n${fresh.slice(0, 8).map((r) => `• <b>${esc(r.data?.title)}</b>${r.data?.batch ? ` (partia: ${esc(r.data.batch)})` : ""}`).join("\n")}\n\nSzczegóły: jembezpiecznie.com\n#QASUPPORT #alerty`;
}
