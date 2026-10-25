// Zbieracz promocji POLOmarket (polomarket.pl) dla Jem Bezpiecznie. Autor: MT.
// Źródło: strona główna (sekcje „HITY TYGODNIA” i „Oferty z Aplikacją/POLOkartą” + lista gazetek
// z datami) oraz strony /oferta-lojalnosciowa?group=<id>&category=wszystkie-produkty.
// Dane produktów są czytane ze stanu strony (window.__NUXT__) własnym parserem literałów –
// bez wykonywania kodu ze strony. robots.txt: zabronione tylko /_nuxt/ (nie pobieramy).
// Daty ważności: z zakresu bieżącej gazetki („Gazetka POLOmarket”, np. 21.10 - 27.10) –
// taki sam zakres widnieje na stronach produktów (np. „21.10-27.10.2026 r. lub do wyczerpania zapasów”).

export const chain = 'POLOmarket';
const BASE = 'https://polomarket.pl';
export const sourceUrls = [
  `${BASE}/`,
  `${BASE}/oferta-lojalnosciowa?group=1310&category=wszystkie-produkty`,
  `${BASE}/oferta-lojalnosciowa?group=1313&category=wszystkie-produkty`,
];

const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';
const MAX_GROUPS = 4;
const NON_FOOD = new Set([
  'artykuły przemysłowe', 'kosmetyki, higiena, pieluchy', 'chemia i środki czystości', 'kwiaty i krzewy',
  'dla zwierząt', 'odzież i obuwie', 'odzież damska, męska, dziecięca', 'garnki i patelnie',
  'ręczniki, pościele, kołdry, koce', 'naczynia, kubki i sztućce', 'pozostałe artykuły kuchenne i łazienkowe',
  'gry i zabawki dla dzieci', 'artykuły ogrodnicze', 'turystyka i rekreacja', 'akcesoria samochodowe',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastFetch = 0;
async function get(url) {
  const wait = lastFetch + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'pl-PL,pl;q=0.9' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`);
  return res.text();
}

// Bezpieczny parser: window.__NUXT__=(function(params){stmts;return {...}}(args)); – bez eval.
function parseNuxt(html) {
  const start = html.indexOf('window.__NUXT__=');
  if (start < 0) return null;
  const end = html.indexOf('</script>', start);
  const src = html.slice(start + 'window.__NUXT__='.length, end);
  let i = 0;
  const env = Object.create(null);
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const peek = () => { ws(); return src[i]; };
  const expect = (c) => { ws(); if (src[i] !== c) throw new Error(`NUXT: oczekiwano ${c} w ${i}`); i++; };
  const ident = () => {
    ws(); const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 64));
    if (!m) throw new Error(`NUXT: identyfikator w ${i}`); i += m[0].length; return m[0];
  };
  const num = () => {
    ws(); const m = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i, i + 40));
    if (!m) throw new Error(`NUXT: liczba w ${i}`); i += m[0].length; return Number(m[0]);
  };
  const str = () => {
    const q = src[i++]; let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') {
        const n = src[i + 1];
        if (n === 'u') { out += String.fromCharCode(parseInt(src.substr(i + 2, 4), 16)); i += 6; continue; }
        if (n === 'x') { out += String.fromCharCode(parseInt(src.substr(i + 2, 2), 16)); i += 4; continue; }
        out += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' })[n] ?? n; i += 2; continue;
      }
      out += src[i++];
    }
    i++; return out;
  };
  const value = () => {
    const c = peek();
    if (c === '"' || c === "'") return str();
    if (c === '{') {
      i++; const o = {};
      if (peek() === '}') { i++; return o; }
      for (;;) {
        const p = peek();
        const k = (p === '"' || p === "'") ? str() : (/[0-9]/.test(p) ? String(num()) : ident());
        expect(':'); o[k] = value();
        if (peek() === ',') { i++; continue; }
        expect('}'); return o;
      }
    }
    if (c === '[') {
      i++; const a = [];
      if (peek() === ']') { i++; return a; }
      for (;;) { a.push(value()); if (peek() === ',') { i++; continue; } expect(']'); return a; }
    }
    if (c === '-' || c === '.' || /[0-9]/.test(c)) return num();
    const id = ident();
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'null') return null;
    if (id === 'void') { value(); return null; }
    if (id === 'new' || peek() === '(') throw new Error(`NUXT: nieobsługiwane wyrażenie w ${i}`);
    return id in env ? env[id] : null;
  };
  expect('('); if (ident() !== 'function') throw new Error('NUXT: brak funkcji'); expect('(');
  const params = [];
  if (peek() !== ')') for (;;) { params.push(ident()); if (peek() === ',') { i++; continue; } break; }
  expect(')'); expect('{');
  const bodyStart = i;
  let depth = 1;
  while (depth > 0 && i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { str(); continue; }
    if (ch === '{') depth++; else if (ch === '}') depth--;
    i++;
  }
  const bodyEnd = i - 1;
  expect('(');
  const args = [];
  if (peek() !== ')') for (;;) { args.push(value()); if (peek() === ',') { i++; continue; } break; }
  params.forEach((p, k) => { env[p] = k < args.length ? args[k] : null; });
  i = bodyStart;
  for (;;) {
    ws();
    if (src.startsWith('return', i)) { i += 6; return value(); }
    if (i >= bodyEnd) return null;
    const path = [ident()];
    while (peek() === '.' || peek() === '[') {
      if (src[i] === '.') { i++; path.push(ident()); } else { i++; path.push(peek() === '"' ? str() : String(num())); expect(']'); }
    }
    expect('=');
    const v = value();
    let tgt = env[path[0]];
    for (let k = 1; k < path.length - 1 && tgt; k++) tgt = tgt[path[k]];
    if (path.length === 1) env[path[0]] = v;
    else if (tgt && typeof tgt === 'object') tgt[path[path.length - 1]] = v;
    if (peek() === ';' || peek() === ',') i++;
  }
}

const clean = (s) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
const toNum = (s) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
const fmtPLN = (n) => n.toFixed(2).replace('.', ',');

// "21.10 - 27.10" -> {from:'2026-10-21', to:'2026-10-27'} (rok wg daty bieżącej, z obsługą przełomu roku)
function parseRange(txt, now = new Date()) {
  const m = /(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*[-–]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/.exec(txt || '');
  if (!m) return { from: null, to: null };
  const y = now.getFullYear(); const curM = now.getMonth() + 1;
  const yearFor = (mon, explicit) => {
    if (explicit) return +explicit;
    if (curM === 12 && mon === 1) return y + 1;
    if (curM === 1 && mon === 12) return y - 1;
    return y;
  };
  const iso = (d, mo, yy) => `${yy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { from: iso(+m[1], +m[2], yearFor(+m[2], m[3])), to: iso(+m[4], +m[5], yearFor(+m[5], m[6])) };
}

function packFrom(p) {
  const norm = (s) => s.replace(/(\d)\s*(kg|g|ml|l|L)\b/, '$1 $2');
  const w = clean(p.weight);
  if (w) return norm(w);
  const m = /(\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|ml|l|szt\.?))(?![a-ząćęłńóśźż])/i.exec(p.name || '');
  return m ? norm(m[1]) : null;
}

function mapProduct(p, group, range) {
  const cats = (p.categories || []).map((c) => clean(c.name)).filter((n) => n && n.toLowerCase() !== 'wszystkie produkty');
  if (!cats.length || cats.some((c) => NON_FOOD.has(c.toLowerCase()))) return null;
  const promo = toNum(p.pricePromotional);
  const loyalty = toNum(p.priceLoyalty);
  const app = toNum(p.priceWithApp);
  const price = promo ?? loyalty ?? app;
  if (!price) return null;
  const regular = toNum(p.price);
  const cond = [];
  if (!promo && (loyalty || app)) cond.push('z aplikacją POLOappka / POLOkartą');
  if (/^\s*\d+\s*\+\s*\d+/.test(p.promotionalText || '')) cond.push(clean(p.promotionalText));
  if (clean(p.priceLogic)) cond.push(clean(p.priceLogic));
  if (clean(p.limitText)) cond.push(clean(p.limitText));
  const unit = clean(p.priceLogicUnit);
  return {
    chain,
    productName: clean(p.name),
    price,
    regularPrice: regular && regular > price ? regular : null,
    packSize: unit === 'kg' ? (clean(p.weight) || '1 kg') : packFrom(p),
    unitPrice: unit === 'kg' ? `${fmtPLN(price)} zł/kg` : null,
    validFrom: range.from,
    validTo: range.to,
    conditions: cond.length ? cond.join('; ') : null,
    url: p.slug ? `${BASE}/produkty/${p.slug}` : `${BASE}/oferta-lojalnosciowa?group=${group.id}&category=wszystkie-produkty`,
    category: cats[0] || null,
  };
}

export async function collect() {
  try {
    const t0 = Date.now();
    const home = parseNuxt(await get(`${BASE}/`));
    const sections = home?.data?.[0]?.sections || [];
    let range = { from: null, to: null };
    const groups = [];
    for (const s of sections) {
      if (s?.widget === 'catalogs-list') {
        const cats = s.content?.catalogs || [];
        const leaflet = cats.find((c) => c.catalogType === 'leaflet' && /gazetka/i.test(c.name || '')) || cats.find((c) => c.catalogType === 'leaflet');
        if (leaflet) range = parseRange(leaflet.availabilityDateRange);
      }
      const g = s?.content?.group ?? s?.group;
      if (s?.widget === 'product-carousel' && g && !groups.some((x) => x.id === g)) groups.push({ id: g, title: clean(s.content?.title || s.title) });
    }
    if (!groups.length) groups.push({ id: 1310, title: 'HITY TYGODNIA' }, { id: 1313, title: 'Oferty z Aplikacją/POLOkartą' });

    const out = []; const seen = new Set();
    for (const g of groups.slice(0, MAX_GROUPS)) {
      if (Date.now() - t0 > 11000) { console.error('[POLOmarket] przerwano – limit czasu'); break; }
      try {
        const url = `${BASE}/oferta-lojalnosciowa?group=${encodeURIComponent(g.id)}&category=wszystkie-produkty`;
        const st = parseNuxt(await get(url));
        const products = (st?.data || []).flatMap((d) => d?.products || []);
        for (const p of products) {
          const o = mapProduct(p, g, range);
          if (!o) continue;
          const key = `${o.productName}|${o.price}|${o.conditions}`;
          if (seen.has(key)) continue;
          seen.add(key); out.push(o);
        }
      } catch (e) {
        console.error(`[POLOmarket] grupa ${g.id}: ${e.message}`);
      }
    }
    return out;
  } catch (e) {
    console.error(`[POLOmarket] błąd: ${e.message}`);
    return [];
  }
}
