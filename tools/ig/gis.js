// Ostrzeżenia publiczne GIS: lista + szczegóły (tylko dane z komunikatu, nic nie dopisujemy)
const UA = { "User-Agent": "Mozilla/5.0 (JemBezpiecznie newsletter; +https://jembezpiecznie.com)" };
const ENT = { oacute: "ó", Oacute: "Ó", uuml: "ü", ouml: "ö", auml: "ä", Uuml: "Ü", Ouml: "Ö", Auml: "Ä", szlig: "ß", eacute: "é", ndash: "–", mdash: "—", bdquo: "„", rdquo: "”", ldquo: "“", rsquo: "’", lsquo: "‘", hellip: "…", deg: "°", reg: "®", trade: "™", copy: "©", laquo: "«", raquo: "»", micro: "µ", plusmn: "±", frac12: "½", times: "×" };
const dec = (s) => String(s || "").replace(/&([a-zA-Z]+\d*);/g, (m, n) => ENT[n] ?? m)
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

export function parseList(html, sinceMs) {
  const out = []; const seen = new Set();
  const A = /<a[^>]+href="(\/web\/gis\/(?:ostrzezenie|komunikat)[^"#?]*)"[^>]*>([\s\S]*?)<\/a>/i;
  for (const block of String(html).split(/<(?:li|article)[\s>]/i).slice(1)) {
    const m = block.match(A); if (!m) continue;
    const url = "https://www.gov.pl" + m[1]; if (seen.has(url)) continue;
    const title = dec(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); if (title.length < 20) continue;
    const dm = block.match(/(\d{2})\.(\d{2})\.(\d{4})/); if (!dm) continue;
    const iso = `${dm[3]}-${dm[2]}-${dm[1]}`; if (Date.parse(iso + "T23:59:59Z") < sinceMs) continue;
    seen.add(url); out.push({ title, url, date: iso, slug: m[1].split("/").pop().slice(0, 90) });
  }
  return out;
}

const LABELS = ["Nazwa produktu", "Numer partii", "Data minimalnej trwałości", "Termin przydatności do spożycia", "Producent", "Kraj pochodzenia", "Dystrybutor", "Wielkość opakowania", "Kod EAN"];
export function parseDetail(html) {
  let s = String(html); const i = s.indexOf('class="editor-content"'); if (i > 0) s = s.slice(i, i + 40000);
  const end = s.search(/Zdjęcia \(|class="gallery|stopka/i); if (end > 0) s = s.slice(0, end);
  const text = dec(s.replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const sec = (name) => {
    const k = text.findIndex((l) => l.toLowerCase().startsWith(name.toLowerCase()));
    if (k < 0) return [];
    const res = []; const rest = text[k].slice(name.length).replace(/^[:\s]+/, ""); if (rest) res.push(rest);
    for (let j = k + 1; j < text.length; j++) { if (/^[A-ZŻŹĆĄŚĘŁÓŃ][^:]{3,70}:\s*$/.test(text[j])) break; res.push(text[j]); }
    return res;
  };
  const hazard = sec("Zagrożenie").join(" ");
  const advice = sec("Zalecenia dla konsumentów").join(" ");
  const products = []; let cur = null;
  for (const l of text) {
    const lab = LABELS.find((x) => l.toLowerCase().startsWith(x.toLowerCase() + ":"));
    if (!lab) continue;
    const v = l.slice(lab.length + 1).trim();
    if (lab === "Nazwa produktu") { cur = { name: v }; products.push(cur); continue; }
    if (!cur) { cur = {}; products.push(cur); }
    const key = { "Numer partii": "batch", "Data minimalnej trwałości": "date", "Termin przydatności do spożycia": "date", "Producent": "producer", "Kraj pochodzenia": "country", "Dystrybutor": "distributor", "Wielkość opakowania": "size", "Kod EAN": "ean" }[lab];
    if (key && !cur[key]) cur[key] = v;
  }
  return { hazard, advice, products };
}

export async function recentWarnings(days = 2, { withDetails = true } = {}) {
  const r = await fetch("https://www.gov.pl/web/gis/ostrzezenia", { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("GIS " + r.status);
  const list = parseList(await r.text(), Date.now() - days * 864e5).filter((x) => /ostrzezenie/.test(x.url));
  if (!withDetails) return list;
  for (const w of list) {
    try {
      const d = await fetch(w.url, { headers: UA, signal: AbortSignal.timeout(20000) });
      Object.assign(w, d.ok ? parseDetail(await d.text()) : {});
    } catch { /* bez szczegółów */ }
  }
  return list;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  recentWarnings(+(process.argv[2] || 30)).then((x) => console.log(JSON.stringify(x, null, 1)));
}
