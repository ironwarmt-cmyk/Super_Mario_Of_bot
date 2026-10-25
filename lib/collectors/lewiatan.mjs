// Zbieracz promocji Lewiatan (lewiatan.pl) dla Jem Bezpiecznie. Autor: MT.
//
// Stan na 2026-10-25:
// - /promocje i /aktualna-gazetka nie zawierają cen w HTML. Gazetka ogólnopolska
//   (/gazetka/gazetka-mamy-w-lewiatanie -> /publikacje/gazetki/egazetka/) to przeglądarka FlowPaper
//   z samymi obrazkami stron – plik PDF i warstwa tekstu (.bin) zwracają 404. Gazetki regionalne
//   wymagają wyboru sklepu. Tych źródeł nie przetwarzamy (obrazy).
// - Ceny w formie tekstu publikowane są w artykułach /aktualnosci/ typu „Sprawdź najnowsze oferty!”
//   (nazwa produktu w <strong>, ceny i warunki w punktach listy). Z nich korzystamy.
// robots.txt: nie używamy /search/ ani /szukaj; tylko /aktualnosci.
// Zwracamy wyłącznie oferty, których data końca ważności nie minęła.

export const chain = 'Lewiatan';
const BASE = 'https://www.lewiatan.pl';
export const sourceUrls = [`${BASE}/aktualnosci`, `${BASE}/aktualnosci/sprawdz-najnowsze-oferty`];

const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';
const MAX_ARTICLES = 4;
const OFFER_SLUG = /(ofert|promocj|okazj|supercen|taniej|hity)/i;
const MONTHS = {
  stycz: 1, lut: 2, marz: 3, kwie: 4, maj: 5, czerw: 6, lip: 7, sierp: 8, wrze: 9, 'paźdz': 10, pazdz: 10, listop: 11, grud: 12,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastFetch = 0;
async function get(url) {
  const wait = lastFetch + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'pl-PL,pl;q=0.9' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`);
  return res.text();
}

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&ndash;/g, '–').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const text = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([.,:;)])/g, '$1').replace(/\(\s+/g, '(').trim();
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const monthOf = (w) => { const k = Object.keys(MONTHS).find((p) => w.toLowerCase().startsWith(p)); return k ? MONTHS[k] : null; };
const plPrice = (s) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

// Zakresy: "22–24 października", "22-31 października", "22–31.10", "22.10–31.10", "do 31.10"
function parseRange(s, year) {
  let m = /(\d{1,2})\.(\d{1,2})\s*[–-]\s*(\d{1,2})\.(\d{1,2})/.exec(s);
  if (m) return { from: iso(year, +m[2], +m[1]), to: iso(year, +m[4], +m[3]) };
  m = /(\d{1,2})\s*[–-]\s*(\d{1,2})\.(\d{1,2})/.exec(s);
  if (m) return { from: iso(year, +m[3], +m[1]), to: iso(year, +m[3], +m[2]) };
  m = /(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([a-ząćęłńóśźż]+)/i.exec(s);
  if (m && monthOf(m[3])) return { from: iso(year, monthOf(m[3]), +m[1]), to: iso(year, monthOf(m[3]), +m[2]) };
  m = /do\s+(\d{1,2})\.(\d{1,2})/.exec(s);
  if (m) return { from: null, to: iso(year, +m[2], +m[1]) };
  return null;
}

function packFrom(name) {
  const m = /(\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|ml|l))(?![a-ząćęłńóśźż])/i.exec(name);
  return m ? m[1].replace(/(\d)\s*(kg|g|ml|l)$/i, '$1 $2') : null;
}

export function parseArticle(html, url) {
  const dateTxt = text((/class="news-info-date">([\s\S]*?)<\/div>/.exec(html) || [])[1]);
  const year = +((/(20\d\d)/.exec(dateTxt) || [])[1] || new Date().getFullYear());
  const body = (/<div class="typo">([\s\S]*?)<div class="news-info-footer"/.exec(html) || [])[1] || '';
  const blocks = body.split(/(?=<p>\s*<strong>)/).filter((x) => /^<p>\s*<strong>/.test(x));
  const out = [];
  for (const b of blocks) {
    const headP = (/<p>([\s\S]*?)<\/p>/.exec(b) || [])[1] || '';
    const name = text((/<strong>([\s\S]*?)<\/strong>/.exec(headP) || [])[1]).replace(/\s*\($/, '');
    if (!name) continue;
    const headRange = parseRange(text(headP.replace(/<strong>[\s\S]*?<\/strong>/, '')), year);
    const lis = [...b.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    let promo = null; let regular = null; const extra = [];
    for (const li of lis) {
      const pm = /(\d+[.,]\d{2})\s*zł/.exec(li);
      if (!pm) { extra.push(li); continue; }
      if (/bez kuponu|regularn|przed obni|standardow/i.test(li)) { if (regular == null) regular = { price: plPrice(pm[1]), li }; continue; }
      if (!promo) promo = { price: plPrice(pm[1]), li };
      else extra.push(li);
    }
    if (!promo) continue;
    const range = parseRange(promo.li, year) || headRange || { from: null, to: null };
    const DATE_PAREN = /\s*\((?:[^)]*\d{1,2}\s*[–-]\s*\d{1,2}[^)]*|[^)]*\d{1,2}\.\d{1,2}[^)]*)\)\s*/g;
    const cond = [promo.li.replace(DATE_PAREN, ' ').replace(/\s+([:.,])/g, '$1').replace(/\s+/g, ' ').trim(), ...extra];
    if (regular) cond.push(regular.li);
    out.push({
      chain,
      productName: name,
      price: promo.price,
      regularPrice: regular && regular.price > promo.price ? regular.price : null,
      packSize: packFrom(name),
      unitPrice: null,
      validFrom: range.from,
      validTo: range.to,
      conditions: cond.filter(Boolean).join(' | ') || null,
      url,
      category: null,
    });
  }
  return out;
}

export async function collect() {
  try {
    const t0 = Date.now();
    const list = await get(`${BASE}/aktualnosci`);
    const links = [...new Set([...list.matchAll(/href="(\/aktualnosci\/[a-z0-9-]+)"/gi)].map((m) => m[1]))]
      .filter((p) => OFFER_SLUG.test(p));
    if (!links.length) links.push('/aktualnosci/sprawdz-najnowsze-oferty');
    const today = new Date().toISOString().slice(0, 10);
    const out = []; let expired = 0;
    for (const p of links.slice(0, MAX_ARTICLES)) {
      if (Date.now() - t0 > 10000) break;
      const url = BASE + p;
      try {
        for (const o of parseArticle(await get(url), url)) {
          if (o.validTo && o.validTo < today) { expired++; continue; }
          if (!o.validTo) continue; // bez dat nie wiemy, czy oferta jest aktualna
          out.push(o);
        }
      } catch (e) {
        console.error(`[Lewiatan] ${url}: ${e.message}`);
      }
    }
    if (expired) console.error(`[Lewiatan] pominięto ${expired} ofert po terminie ważności`);
    if (!out.length) console.error('[Lewiatan] brak aktualnych ofert tekstowych; gazetki są tylko obrazkami (FlowPaper bez PDF/tekstu)');
    return out;
  } catch (e) {
    console.error(`[Lewiatan] błąd: ${e.message}`);
    return [];
  }
}
