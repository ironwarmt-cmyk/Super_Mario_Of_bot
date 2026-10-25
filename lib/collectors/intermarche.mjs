// Zbieracz promocji Intermarché (intermarche.pl) dla Jem Bezpiecznie. Autor: MT.
//
// Stan na 2026-10-25: aktualna gazetka (np. /g/gazetka-promocyjna-od-22-28-10/) jest publikowana
// wyłącznie jako przeglądarka stron + plik PDF (~21 MB, grafika gazetki) – bez listy produktów w HTML.
// Strony HTML z listą produktów (/gazetka/<slug>/, klasy "price", "offer-expiry") istnieją, ale są
// archiwalne: zawierają oferty z 2019 r. (np. „oferta 22-28.10.2019”), mimo że adres pasuje do
// bieżącego tygodnia. Takich danych NIE zwracamy.
//
// Dlatego collect() sprawdza listę gazetek, otwiera strony /gazetka/<slug>/ i zwraca tylko pozycje,
// których daty ważności („oferta DD-DD.MM.RRRR”) obejmują dzień bieżący lub najbliższe dni.
// Gdy wszystkie pozycje są nieaktualne – zwraca [] i wypisuje przyczynę (console.error).
// PDF-ów ani obrazków gazetek nie pobieramy. robots.txt: zabronione /wp-admin/, /wp-content/themes/intermarche/.

export const chain = 'Intermarché';
const BASE = 'https://intermarche.pl';
export const sourceUrls = [`${BASE}/gazetki-promocyjne/`, `${BASE}/gazetka/gazetka-promocyjna-od-22-28-10/`];

const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';
const MAX_PAGES = 6;
const NON_FOOD = /^(drogeria|chemia|artyku[łl]y[_ ]przemys[łl]owe|dom|ogr[óo]d|zabawki|tekstylia|odzie[żz]|elektronika|zwierz)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastFetch = 0;
async function get(url) {
  const wait = lastFetch + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'pl-PL,pl;q=0.9' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`);
  return res.text();
}

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const text = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// "oferta 22-28.10.2019" / "oferta 30.10-02.11.2026" -> {from,to}
function parseExpiry(s) {
  let m = /(\d{1,2})\.(\d{1,2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (m) {
    const y2 = +m[5]; const y1 = +m[2] > +m[4] ? y2 - 1 : y2;
    return { from: iso(y1, +m[2], +m[1]), to: iso(y2, +m[4], +m[3]) };
  }
  m = /(\d{1,2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (m) return { from: iso(+m[4], +m[3], +m[1]), to: iso(+m[4], +m[3], +m[2]) };
  m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (m) { const d = iso(+m[3], +m[2], +m[1]); return { from: null, to: d }; }
  return { from: null, to: null };
}

export function parseListing(html, pageUrl) {
  const items = [];
  const parts = html.split(/<li\s+data-price=/).slice(1);
  for (const raw of parts) {
    const chunk = raw.slice(0, raw.indexOf('</li>') > 0 ? raw.indexOf('</li>') : 6000);
    const cls = (/class="teasers-list__item[^"]*?change\s+([^"]*)"/.exec(chunk) || [])[1] || '';
    const catRaw = cls.split(/\s+/)[0] || '';
    if (NON_FOOD.test(catRaw)) continue;
    const title = text((/product-teaser__content__head__title">([\s\S]*?)<\/p>/.exec(chunk) || [])[1]);
    const brand = text((/class="product-add[^"]*">([\s\S]*?)<\/span>/.exec(chunk) || [])[1]);
    const int = (/price-int">\s*(\d+)\s*</.exec(chunk) || [])[1];
    const dec = (/price-dec">\s*(\d+)\s*</.exec(chunk) || [])[1];
    const per = text((/price-per">([\s\S]*?)<\/span>/.exec(chunk) || [])[1]);
    const expiry = text((/class="offer-expiry">([\s\S]*?)<\/span>/.exec(chunk) || [])[1]);
    const extra = text((/class="offer-expiry highlighted">([\s\S]*?)<\/span>/.exec(chunk) || [])[1]);
    const omni = text((/class="cena-z-30dni">([\s\S]*?)<\/div>/.exec(chunk) || [])[1]);
    const href = (/<a href="([^"]+)"\s+class="product-teaser__content"/.exec(chunk) || [])[1];
    const price = int != null ? parseFloat(`${int}.${(dec || '0').padEnd(2, '0')}`) : null;
    if (!title || !price) continue;
    const { from, to } = parseExpiry(expiry);
    const omniPrice = (/(\d+[.,]\d{2})/.exec(omni) || [])[1];
    const regular = omniPrice ? parseFloat(omniPrice.replace(',', '.')) : null;
    const name = brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `${title} ${brand}` : title;
    const perKg = /^1\s*(kg|l)$/i.test(per);
    items.push({
      chain,
      productName: name,
      price,
      regularPrice: regular && regular > price ? regular : null,
      packSize: per || null,
      unitPrice: perKg ? `${price.toFixed(2).replace('.', ',')} zł/${per.replace(/^1\s*/, '').toLowerCase()}` : null,
      validFrom: from,
      validTo: to,
      conditions: extra || null,
      url: href ? new URL(href, BASE).href : pageUrl,
      category: catRaw ? catRaw.replace(/_/g, ' ') : null,
    });
  }
  return items;
}

export async function collect() {
  try {
    const t0 = Date.now();
    const index = await get(`${BASE}/gazetki-promocyjne/`);
    const pages = new Set();
    for (const m of index.matchAll(/href="(?:https:\/\/intermarche\.pl)?\/g\/([a-z0-9-]+)\/?"/gi)) pages.add(`${BASE}/gazetka/${m[1]}/`);
    for (const m of index.matchAll(/href="(?:https:\/\/intermarche\.pl)?\/gazetka\/([a-z0-9-]+)\/{0,2}"/gi)) pages.add(`${BASE}/gazetka/${m[1]}/`);

    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const out = []; let total = 0; let stale = 0; const years = new Set();
    for (const url of [...pages].slice(0, MAX_PAGES)) {
      if (Date.now() - t0 > 9000) break;
      try {
        const items = parseListing(await get(url), url);
        total += items.length;
        for (const it of items) {
          if (it.validTo) years.add(it.validTo.slice(0, 4));
          const current = it.validTo && it.validTo >= today && (!it.validFrom || it.validFrom <= horizon);
          if (!current) { stale++; continue; }
          if (!out.some((o) => o.productName === it.productName && o.price === it.price)) out.push(it);
        }
      } catch (e) {
        console.error(`[Intermarché] ${url}: ${e.message}`);
      }
    }
    if (!out.length) {
      console.error(`[Intermarché] brak aktualnych ofert w HTML: ${total} pozycji na stronach /gazetka/, ` +
        `${stale} nieaktualnych (lata w datach: ${[...years].join(', ') || 'brak'}). ` +
        'Bieżąca gazetka jest dostępna tylko jako przeglądarka stron/PDF (grafika) – nie przetwarzamy.');
    }
    return out;
  } catch (e) {
    console.error(`[Intermarché] błąd: ${e.message}`);
    return [];
  }
}
