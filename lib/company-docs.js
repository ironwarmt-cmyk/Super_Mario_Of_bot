// Dokumenty dedykowane pod firmę (tylko VIP): dane firmy + rodzaj dokumentu -> gotowy plik Word. Autor: MT
// Treść pisze Bielik na telefonie (kolejka, lib/quality-jobs.js); AI w chmurze jest zapasem.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, PageNumber, BorderStyle } from "docx";
import { aiText } from "./ai-call.js";

export const DOC_TYPES = {
  procedure: "Procedura",
  instruction: "Instrukcja stanowiskowa",
  haccp_plan: "Plan HACCP (analiza zagrożeń, CCP, limity krytyczne, monitorowanie, działania korygujące)",
  form: "Formularz / zapis",
  register: "Rejestr",
  policy: "Polityka",
  plan: "Plan (np. szkoleń, audytów wewnętrznych, utrzymania czystości)",
  risk: "Ocena ryzyka (np. dostawców, food defence, food fraud, alergenów)",
};
export const clip = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

export const ROLE = `Jesteś doświadczonym kierownikiem ds. jakości i bezpieczeństwa żywności w Polsce.
Piszesz po polsku dokumenty systemu jakości gotowe do wdrożenia w konkretnej firmie.
Uwzględnij wymagania wskazanego standardu (BRCGS Food Safety, IFS Food, HACCP/Codex, ISO 22000/FSSC 22000) oraz prawa UE i PL, jeśli dotyczą.
Dopasuj treść do produktów, procesów, wielkości zakładu i podanych szczegółów; nie pisz ogólników.
Nie wymyślaj danych, których nie podano: tam, gdzie potrzebna jest wartość firmy (np. nazwisko, numer urządzenia), wstaw pole do uzupełnienia w nawiasach kwadratowych, np. [imię i nazwisko].`;

const FULL_SCHEMA = `{"title": "...", "code": "np. PR-07", "purpose": "...", "scope": "...", "responsibilities": [{"role": "...", "duty": "..."}],
 "definitions": [{"term": "...", "meaning": "..."}],
 "sections": [{"heading": "...", "paragraphs": ["..."], "steps": ["..."], "table": {"columns": ["..."], "rows": [["..."]]}}],
 "records": ["nazwy zapisów/formularzy"], "references": ["normy, przepisy, dokumenty powiązane"]}`;

export const INSTRUCTIONS = `${ROLE}
Przygotuj kompletny dokument. Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown) o strukturze:
${FULL_SCHEMA}
Pola steps i table są opcjonalne w sekcji. Formularze i rejestry przedstaw jako tabele z kolumnami i kilkoma pustymi wierszami.`;

// Etapy dla Bielika: najpierw szkielet, potem każda sekcja osobno (krótsze odpowiedzi = mniej błędów i krótszy czas jednego kroku).
export const OUTLINE_PROMPT = (brief) => `${ROLE}

Zadanie: przygotuj SZKIELET dokumentu (bez treści sekcji).
${brief}

Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown, bez komentarzy):
{"title": "...", "code": "np. PR-07", "purpose": "...", "scope": "...", "responsibilities": [{"role": "...", "duty": "..."}], "definitions": [{"term": "...", "meaning": "..."}], "sections": [{"heading": "..."}], "records": ["..."], "references": ["..."]}
Podaj od 4 do 10 sekcji merytorycznych.`;

export const SECTION_PROMPT = (brief, outline, heading) => `${ROLE}

Dokument: ${outline.code || ""} ${outline.title || ""}
Cel: ${outline.purpose || ""}
Wszystkie sekcje: ${(outline.sections || []).map((s) => s.heading).join(" | ")}
${brief}

Napisz TYLKO sekcję: "${heading}". Konkretnie dla tej firmy, z krokami i odpowiedzialnościami, gdy to pasuje.
Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown):
{"paragraphs": ["..."], "steps": ["..."], "table": {"columns": ["..."], "rows": [["..."]]}}
Pola steps i table są opcjonalne. Formularze i rejestry przedstaw jako tabelę z kilkoma pustymi wierszami.`;

export function parseJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no json");
  return JSON.parse(t.slice(a, b + 1));
}

export function briefFor(input) {
  const company = companyOf(input);
  const typeLabel = DOC_TYPES[String(input.doc_type || "")];
  return [`Rodzaj dokumentu: ${typeLabel}`, `Temat: ${clip(input.topic, 300)}`, `Standard: ${clip(input.standard, 80) || "HACCP / prawo żywnościowe UE"}`,
    `Firma: ${company.name}`, company.address && `Adres: ${company.address}`, company.size && `Wielkość: ${company.size}`,
    company.profile && `Profil działalności: ${company.profile}`, company.products && `Produkty: ${company.products}`,
    company.processes && `Procesy i linie: ${company.processes}`, input.details && `Dodatkowe wymagania: ${clip(input.details, 2500)}`].filter(Boolean).join("\n");
}

export function companyOf(input) {
  return { name: clip(input.company_name, 160), address: clip(input.company_address, 240), profile: clip(input.company_profile, 600), products: clip(input.products, 800), processes: clip(input.processes, 1200), size: clip(input.size, 80) };
}

// Minimalna kontrola jakości: dokument musi mieć tytuł i co najmniej 2 sekcje z treścią.
export function isUsable(doc) {
  const filled = (doc?.sections || []).filter((s) => (s.paragraphs || []).join("").length > 40 || (s.steps || []).length || s.table?.columns?.length);
  return Boolean(doc?.title) && filled.length >= 2;
}

// Zapas: cały dokument jednym wywołaniem AI w chmurze.
export async function cloudDocument(brief, timeoutMs = 50000) {
  const ai = await aiText({ instructions: INSTRUCTIONS, input: brief, timeoutMs });
  return parseJson(typeof ai === "string" ? ai : ai?.text);
}

const cell = (text, bold = false, shade) => new TableCell({
  children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ""), bold, size: 18 })] })],
  ...(shade ? { shading: { fill: shade } } : {}),
});
function table(columns, rows) {
  const cols = (columns || []).map(String).slice(0, 8);
  if (!cols.length) return null;
  const body = (rows && rows.length ? rows : [cols.map(() => ""), cols.map(() => ""), cols.map(() => "")]).slice(0, 40);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: cols.map((c) => cell(c, true, "DCE6F2")) }),
      ...body.map((r) => new TableRow({ children: cols.map((_, i) => cell((r || [])[i] ?? "")) }))],
  });
}

export async function buildDocx(doc, company, meta) {
  const P = (text, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts, children: [new TextRun({ text: String(text || ""), size: 22, ...(opts.run || {}) })] });
  const H = (text, level = HeadingLevel.HEADING_2) => new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: String(text || "") })] });
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: company.name, bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${doc.code || ""} ${doc.title || meta.typeLabel}`.trim(), bold: true, size: 32 })] }),
    table(["Wersja", "Data wydania", "Opracował", "Zatwierdził"], [["1.0", meta.date, "[imię i nazwisko]", "[imię i nazwisko]"]]),
  ];
  if (doc.purpose) children.push(H("1. Cel"), P(doc.purpose));
  if (doc.scope) children.push(H("2. Zakres"), P(doc.scope));
  if (doc.responsibilities?.length) children.push(H("3. Odpowiedzialność"), table(["Rola", "Zadania"], doc.responsibilities.map((r) => [r.role, r.duty])));
  if (doc.definitions?.length) children.push(H("4. Definicje"), table(["Pojęcie", "Znaczenie"], doc.definitions.map((d) => [d.term, d.meaning])));
  let n = 5;
  for (const s of doc.sections || []) {
    children.push(H(`${n++}. ${s.heading || ""}`));
    for (const p of s.paragraphs || []) children.push(P(p));
    (s.steps || []).forEach((st, i) => children.push(P(`${i + 1}. ${st}`, { indent: { left: 360 } })));
    if (s.table?.columns?.length) { const t = table(s.table.columns, s.table.rows); if (t) children.push(t, P("")); }
  }
  if (doc.records?.length) { children.push(H(`${n++}. Zapisy`)); doc.records.forEach((r) => children.push(P(`• ${r}`))); }
  if (doc.references?.length) { children.push(H(`${n++}. Dokumenty związane`)); doc.references.forEach((r) => children.push(P(`• ${r}`))); }
  children.push(H("Historia zmian"), table(["Wersja", "Data", "Opis zmiany", "Zatwierdził"], [["1.0", meta.date, "Pierwsze wydanie", "[imię i nazwisko]"]]));
  const d = new Document({
    creator: "QA Support – JemBezpiecznie.com", title: doc.title || meta.typeLabel,
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{
      headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" } }, children: [new TextRun({ text: `${company.name} · ${doc.code || ""} ${doc.title || ""}`.trim(), size: 16, color: "666666" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Dokument nadzorowany · strona ", size: 16, color: "666666" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "666666" })] })] }) },
      children: children.filter(Boolean),
    }],
  });
  return Packer.toBuffer(d);
}

export function fileNameFor(doc, topic) {
  return `${`${doc.code || "DOK"}_${(doc.title || topic || "dokument").replace(/[^\p{L}\p{N}]+/gu, "_")}`.slice(0, 80)}.docx`;
}
