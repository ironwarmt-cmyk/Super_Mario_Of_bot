// Zbieracz ofert promocyjnych żywności – Aldi (aldi.pl). Autor: MT
// Źródło: publiczna strona /oferty.html; oferty tygodnia są w <script id="__NEXT_DATA__">
// (props.pageProps.apiData -> OFFER_GET: categories = sekcje z datami, algoliaDataMap = produkty).
// Podstrony /gazetki/*.html to przeglądarka gazetek (obrazki na gazetki.aldi.pl) – bez warstwy tekstu z cenami, pomijamy.
// robots.txt nie zabrania /oferty.html. Nie pobieramy obrazków.

export const chain = 'Aldi';
export const sourceUrls = ['https://www.aldi.pl/oferty.html'];

const BASE = 'https://www.aldi.pl';
const BOT_UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';

// Przy 403/captcha nie ponawiamy innym UA – zgłaszamy błąd i zwracamy [].
async function getHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': BOT_UA, 'Accept': 'text/html', 'Accept-Language': 'pl-PL,pl;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 403 ? ' (blokada – nie obchodzimy)' : ''}`);
  return await res.text();
}

const plNum = (n) => Number(n).toFixed(2).replace('.', ',');
const parsePl = (s) => (s == null ? null : Number(String(s).replace(/\s/g, '').replace(',', '.')));
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

const NON_FOOD_CAT = /Artykuły|Chemia|Kosmetyk|Higien|Zabawk|Odzież|Moda|Dom|Ogród|Elektron|Zwierz|Narzędzi|Sport|Dekorac|Tekstyl|Kuchnia i/i;
const NON_FOOD_NAME = /znicz|wkład|pościel|kołdr|poduszk|patel|garn|noż|noże|czajnik|forma|skrzat|drzewk|domek|klock|zabawk|pralk|zmywark|bluz|bieliz|skarpet|kurtk|papier|ręcznik|proszek|płyn do|karma/i;
const FOOD_NAME = /ananas|banan|śliwk|jabł|grusz|winogr|pomidor|ziemniak|marchew|cebul|kapust|owoc|warzyw|mięs|kurcz|gęś|kacz|indyk|schab|boczek|szynk|kiełbas|ser|masło|margaryn|mleko|jogurt|jaja|ryb|śledź|makrel|łosoś|chleb|bułk|babka|ciast|kaw|herbat|piwo|wino|woda|sok|napój|pepsi|cola|miód|konfitur|dżem|czekolad|cukier|mąk|makaron|ryż/i;

function isFood(p) {
  const lvl0 = p.hierarchicalCategories?.lvl0?.[0];
  if (lvl0) return !NON_FOOD_CAT.test(lvl0);
  const name = `${p.brandName || ''} ${p.name || ''}`;
  if (NON_FOOD_NAME.test(name)) return false;
  if (FOOD_NAME.test(name)) return true;
  // bez kategorii: jednostka wagowa/objętościowa sugeruje żywność
  return /cena za|\d\s*(g|kg|ml|l)\b/i.test(p.salesUnit || '');
}

function packFrom(salesUnit) {
  const su = clean(salesUnit);
  if (/^cena za kg$/i.test(su)) return '1 kg';
  if (/^sztuka$/i.test(su)) return '1 szt.';
  const m100 = su.match(/^cena za (\d+\s*(?:g|kg|ml|l))$/i);
  if (m100) return m100[1];
  const m = su.match(/(\d+(?:,\d+)?\s*(?:x\s*\d+(?:,\d+)?\s*)?(?:g|kg|ml|l|szt\.?|rolki|rolek|para))\b/i);
  return m ? m[1] : (su || null);
}

function conditionsFrom(p, labels, regularPrice, price) {
  const c = [];
  const promo = clean(labels?.promoText1);
  if (promo && !/^\d+%\s*TANIEJ$/i.test(promo) && !/^AKCJA$/i.test(promo)) {
    let t = promo.toLowerCase();
    if (/co druga/i.test(promo)) t += ' (podana cena dotyczy co drugiej sztuki)';
    else if (/przy zakupie/i.test(promo)) t += ' (cena za sztukę przy tej liczbie sztuk)';
    c.push(t);
  }
  const desc = String(p.shortDescription || '');
  const lim = desc.match(/Limit:[^\n]*?(?:na (?:klienta|paragon|osobę)\.?|$)/im);
  if (lim) c.push(lim[0].trim());
  const sel = desc.match(/[^.\n]*dostępne w wybranych sklepach\.?/i);
  if (sel) c.push(sel[0].trim());
  return c.length ? c.join('; ') : null;
}

function mapProduct(p, section) {
  // cena i daty z promotionPrices pokrywających się z sekcją; inaczej currentPrice + daty sekcji
  const promos = Array.isArray(p.promotionPrices) ? p.promotionPrices : [];
  const pr = promos.find((x) => x.validFromLocalDate && x.validUntilLocalDate &&
    x.validFromLocalDate <= section.endDate && x.validUntilLocalDate >= section.startDate) || promos[0];
  const src = pr || p.currentPrice;
  const price = Number(src?.priceValue);
  if (!isFinite(price) || price <= 0) return null;

  const base = src.basePrice?.[0] || p.currentPrice?.basePrice?.[0];
  const info = base?.basePriceAdditionalInformation || '';
  const labels = src.priceTagLabels || p.currentPrice?.priceTagLabels || {};
  let regular = null;
  const mReg = info.match(/cena regularna:\s*(\d+,\d{2})/i);
  if (mReg) regular = parsePl(mReg[1]);
  else {
    const m30 = String(labels.bestPricesWithin30daysText || '').match(/^(\d+[.,]\d{2})\s*zł/);
    if (m30) regular = parsePl(m30[1]);
  }
  if (regular != null && regular <= price) regular = null;

  const packSize = packFrom(p.salesUnit);
  let unitPrice = null;
  if (base && isFinite(base.basePriceValue) && base.basePriceScale) unitPrice = `${plNum(base.basePriceValue)} zł/${base.basePriceScale}`;
  else if (packSize === '1 kg') unitPrice = `${plNum(price)} zł/kg`;

  const lvl1 = p.hierarchicalCategories?.lvl1?.[0];
  const lvl0 = p.hierarchicalCategories?.lvl0?.[0];
  return {
    chain,
    productName: clean(`${p.brandName || ''} ${p.name || ''}`),
    price,
    regularPrice: regular,
    packSize,
    unitPrice,
    validFrom: pr?.validFromLocalDate || section.startDate || null,
    validTo: pr?.validUntilLocalDate || section.endDate || null,
    conditions: conditionsFrom(p, labels, regular, price),
    url: p.productSlug ? `${BASE}/produkt-szczegoly/${p.productSlug}.html` : sourceUrls[0],
    category: lvl1 ? lvl1.split('>').pop().trim() : (lvl0 || null),
  };
}

export async function collect() {
  try {
    const html = await getHtml(sourceUrls[0]);
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) { console.error('[aldi] brak __NEXT_DATA__ na stronie ofert'); return []; }
    const next = JSON.parse(m[1]);
    const apiRaw = next?.props?.pageProps?.apiData;
    const api = typeof apiRaw === 'string' ? JSON.parse(apiRaw) : apiRaw;
    const entry = Array.isArray(api) ? api.find((e) => e?.[0] === 'OFFER_GET') : null;
    const res = entry?.[1]?.res;
    if (!res?.algoliaDataMap || !Array.isArray(res.categories)) { console.error('[aldi] nieoczekiwana struktura danych ofert'); return []; }

    const out = [];
    const seen = new Set();
    for (const cat of res.categories) {
      const section = { startDate: cat.startDate, endDate: cat.endDate };
      for (const block of cat.content || []) {
        if (block?.type !== 'category' || !Array.isArray(block.productIds)) continue;
        for (const id of block.productIds) {
          const p = res.algoliaDataMap[id];
          if (!p || !isFood(p)) continue;
          const o = mapProduct(p, section);
          if (!o || !o.productName) continue;
          const key = `${id}|${o.validFrom}|${o.validTo}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(o);
        }
      }
    }
    return out;
  } catch (e) {
    console.error('[aldi] błąd:', e?.message || e);
    return [];
  }
}
