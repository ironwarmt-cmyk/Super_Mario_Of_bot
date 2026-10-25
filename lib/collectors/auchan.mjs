// Zbieracz promocji Auchan – autor: MT
// www.auchan.pl to aplikacja SPA (HTML ~2 KB); gazetki są tam tylko jako przeglądarka obrazków
// (Flipsnack), a dane pochodzą z API wymagającego kluczy – tego nie używamy.
// Źródło danych: publiczny sklep internetowy zakupy.auchan.pl, strony "Promocje" (/promotions/...).
// Serwer zwraca w HTML stan strony (window.__INITIAL_STATE__) z produktami w promocji:
// nazwa, cena bieżąca, cena przed obniżką, cena jednostkowa, opis promocji.
// robots.txt zakupy.auchan.pl: zabronione m.in. /search, /offers, /api/ oraz parametry ?sortBy=, ?source=
// – pobieramy wyłącznie /promotions/<kategoria>/<id> bez parametrów.
// Używamy wyłącznie jawnego UA bota JB. Jeśli sklep go odrzuca (403), nie obchodzimy blokady – zwracamy [].
// Ograniczenia: strona zwraca ~50 pierwszych produktów na kategorię (dalsze strony ładowane są przez /api/,
// którego nie używamy); dat ważności promocji brak w danych -> validFrom/validTo = null.
// Ceny ze sklepu internetowego mogą różnić się od cen w sklepach stacjonarnych.

export const chain = 'Auchan';
const BASE = 'https://zakupy.auchan.pl';
// kolejność: najpierw kategorie główne, potem podkategorie spożywcze (dopóki starcza czasu)
const PAGES = [
  '/promotions/artykuły-spożywcze/2091',
  '/promotions/kawa-herbata-i-kakao/4324',
  '/promotions/zdrowa-żywność/3177',
  '/promotions/alkohole/3639',
  '/promotions/artykuły-spożywcze/mleko-nabiał-i-jaja/2365',
  '/promotions/artykuły-spożywcze/słodycze/4462',
  '/promotions/artykuły-spożywcze/napoje/3588',
  '/promotions/artykuły-spożywcze/wędliny/2578',
  '/promotions/artykuły-spożywcze/mięso-i-drób/2446',
  '/promotions/artykuły-spożywcze/konserwy-przetwory-i-dodatki-kulinarne/4563',
];
export const sourceUrls = PAGES.map((p) => BASE + encodeURI(p));

const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';
const FOOD_TOP = new Set(['Artykuły spożywcze', 'Kawa, herbata i kakao', 'Kawa, Herbata i kakao', 'Zdrowa żywność', 'Alkohole']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => n.toFixed(2).replace('.', ',');
const num = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pl-PL,pl;q=0.9' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function parseState(html) {
  const k = 'window.__INITIAL_STATE__=';
  const i = html.indexOf(k);
  if (i < 0) throw new Error('brak __INITIAL_STATE__');
  const j = html.indexOf('</script>', i);
  return JSON.parse(html.slice(i + k.length, j).trim().replace(/;$/, ''));
}

const UNIT = { 'fop.price.per.kg': 'kg', 'fop.price.per.litre': 'l', 'fop.price.per.each': 'szt.' };

// Zwraca { price, regularPrice, conditions } – price = cena za 1 szt. przy spełnieniu warunku promocji.
function pricing(e) {
  const cur = e.price?.current?.amount;
  const orig = e.price?.original?.amount;
  const desc = (e.offer?.description || '').replace(/\s+/g, ' ').trim();
  if (typeof cur !== 'number') return null;
  if (typeof orig === 'number' && orig > cur) return { price: cur, regularPrice: orig, conditions: null };
  let m;
  if ((m = desc.match(/^(\d+)\s*za\s*(\d+,\d{2})\s*zł/i))) {
    const n = +m[1], tot = num(m[2]);
    return { price: r2(tot / n), regularPrice: cur, conditions: `${desc} (cena za 1 szt. przy zakupie ${n} szt.)` };
  }
  if ((m = desc.match(/^(\d+)\s*\+\s*(\d+)\s*za grosz/i))) {
    const a = +m[1], b = +m[2];
    return { price: r2((a * cur + b * 0.01) / (a + b)), regularPrice: cur, conditions: `${desc} (średnia cena za 1 szt. przy zakupie ${a + b} szt.)` };
  }
  if ((m = desc.match(/^(\d+)\s*\+\s*(\d+)\s*gratis/i))) {
    const a = +m[1], b = +m[2];
    return { price: r2((a * cur) / (a + b)), regularPrice: cur, conditions: `${desc} (średnia cena za 1 szt. przy zakupie ${a + b} szt.)` };
  }
  if ((m = desc.match(/^drugi\s*(\d+)\s*%\s*taniej/i))) {
    const p = +m[1] / 100;
    return { price: r2((cur + cur * (1 - p)) / 2), regularPrice: cur, conditions: `${desc} (średnia cena za 1 szt. przy zakupie 2 szt.)` };
  }
  if ((m = desc.match(/^drugi\s*za\s*(\d+(?:,\d{1,2})?)\s*(gr|zł)/i))) {
    const second = num(m[1]) / (m[2].toLowerCase() === 'gr' ? 100 : 1);
    return { price: r2((cur + second) / 2), regularPrice: cur, conditions: `${desc} (średnia cena za 1 szt. przy zakupie 2 szt.)` };
  }
  return { price: cur, regularPrice: null, conditions: desc || null };
}

function packFromName(name, size) {
  const m = name.match(/(\d+\s*x\s*)?\d+(?:[,.]\d+)?\s*(?:g|kg|ml|l|sztuk[ai]?|szt\.?)\s*$/i);
  if (m) return m[0].trim();
  return size?.value ? String(size.value) : null;
}

export async function collect() {
  const started = Date.now();
  const out = [];
  const seen = new Set();
  try {
    for (const [idx, path] of PAGES.entries()) {
      if (Date.now() - started > 11000) {
        console.error('[auchan] limit czasu – pominięto', PAGES.length - idx, 'stron');
        break;
      }
      if (idx) await sleep(1000);
      const pageUrl = BASE + encodeURI(path);
      let html, st;
      try {
        html = await get(pageUrl);
        st = parseState(html);
      } catch (e) {
        console.error('[auchan]', pageUrl, e.message);
        continue;
      }
      const links = {};
      for (const m of html.matchAll(/href="(\/products\/[^"]+\/(\d{5,}))"/g)) links[m[2]] = BASE + m[1];
      const ents = st?.data?.products?.productEntities || {};
      const ids = st?.data?.products?.catalogue?.data?.productGroups?.flatMap((g) => g.products) || Object.keys(ents);
      for (const id of ids) {
        const e = ents[id];
        if (!e || seen.has(id)) continue;
        if (!FOOD_TOP.has(e.categoryPath?.[0])) continue;
        const pr = pricing(e);
        if (!pr) continue;
        seen.add(id);
        const name = e.name.replace(/\s+/g, ' ').trim();
        const unitLbl = UNIT[e.price?.unit?.label];
        const unitAmt = e.price?.unit?.current?.amount;
        let unitPrice = null;
        if (unitLbl && typeof unitAmt === 'number') {
          const cur = e.price.current.amount;
          const adj = e.price.original ? unitAmt : unitAmt * (pr.price / cur); // przelicz przy promocji ilościowej
          unitPrice = `${fmt(adj)} zł/${unitLbl}`;
        }
        out.push({
          chain,
          productName: name,
          price: pr.price,
          regularPrice: pr.regularPrice,
          packSize: packFromName(name, e.size),
          unitPrice,
          validFrom: null,
          validTo: null,
          conditions: [pr.conditions, e.alcohol ? 'produkt alkoholowy (18+)' : null, 'cena w sklepie internetowym zakupy.auchan.pl']
            .filter(Boolean).join('; '),
          url: links[e.retailerProductId] || pageUrl,
          category: e.categoryPath?.[1] || e.categoryPath?.[0] || null,
        });
      }
    }
    return out;
  } catch (e) {
    console.error('[auchan] błąd:', e.message);
    return out;
  }
}
