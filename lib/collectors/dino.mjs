// Zbieracz cen promocyjnych: Dino (marketdino.pl)
// Autor: MT
//
// Źródła (publiczne strony Nuxt, dane w <script id="__NUXT_DATA__"> w formacie devalue):
// 1) /gazetki/lista/standard – aktualna gazetka; hotspoty stron zawierają produkt
//    {name, price, slug} oraz daty ważności gazetki (activeFrom / activeTo).
// 2) /kategoria/teraz-taniej – lista promocji z pełną ceną: price, oldPrice,
//    specialPriceConditions (np. „PRZY ZAKUPIE 3 SZTUK”), xyPromo (np. „1+1”),
//    pricePerUnit, gramaturą i kategorią.
// 3) /produkt/<slug> – tylko dla kilku pozycji z gazetki bez gramatury w nazwie
//    (np. wędliny na wagę), żeby ustalić jednostkę (kg) i cenę przed obniżką.
// robots.txt marketdino.pl: Disallow /wyszukiwarka/, /listy-zakupowe, /trigger-error – nieużywane.
// Nie pobieramy obrazków ani PDF gazetki; gazetka alkoholowa (bramka wieku) jest pomijana.

export const chain = 'Dino';
const BASE = 'https://marketdino.pl';
export const sourceUrls = [
  `${BASE}/gazetki/lista/standard`,
  `${BASE}/kategoria/teraz-taniej`,
];

const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';
const TIME_BUDGET_MS = 13000;
const MAX_PRODUCT_PAGES = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastFetch = 0;
async function getHtml(url) {
  const wait = 1100 - (Date.now() - lastFetch);
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'pl-PL,pl' },
    signal: AbortSignal.timeout(8000),
  });
  // Przy 403/blokadzie nie ponawiamy innym UA – zgodnie z kontraktem nie obchodzimy blokad.
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// --- Dekoder payloadu Nuxt (devalue) ---
export function decodeNuxt(arr) {
  const memo = new Map();
  const WRAP = new Set(['Reactive', 'ShallowReactive', 'Ref', 'ShallowRef']);
  const h = (i) => {
    if (typeof i !== 'number') return i;
    if (i < 0) return i === -3 ? NaN : i === -4 ? Infinity : i === -5 ? -Infinity : i === -6 ? -0 : undefined;
    if (memo.has(i)) return memo.get(i);
    const v = arr[i];
    if (v === null || typeof v !== 'object') { memo.set(i, v); return v; }
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string') {
        const t = v[0];
        let r;
        if (WRAP.has(t)) r = h(v[1]);
        else if (t === 'EmptyRef' || t === 'EmptyShallowRef') { try { r = v[1] ? JSON.parse(v[1]) : undefined; } catch { r = undefined; } }
        else if (t === 'Date' || t === 'BigInt' || t === 'RegExp') r = v[1];
        else if (t === 'Set') { r = []; memo.set(i, r); for (let k = 1; k < v.length; k++) r.push(h(v[k])); return r; }
        else if (t === 'Map' || t === 'null') {
          r = {}; memo.set(i, r);
          for (let k = 1; k < v.length; k += 2) r[t === 'Map' ? String(h(v[k])) : v[k]] = h(v[k + 1]);
          return r;
        } else r = v.length > 1 ? h(v[1]) : undefined;
        memo.set(i, r); return r;
      }
      const r = []; memo.set(i, r); for (const x of v) r.push(h(x)); return r;
    }
    const r = {}; memo.set(i, r);
    for (const k of Object.keys(v)) r[k] = h(v[k]);
    return r;
  };
  return h(0);
}

function nuxtData(html) {
  const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('brak __NUXT_DATA__');
  return decodeNuxt(JSON.parse(m[1]));
}

// Znajdź obiekty produktów z pełną ceną ({slug, details, price:{...}})
function findProducts(root) {
  const out = new Map(); const seen = new Set();
  (function walk(o) {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (typeof o.slug === 'string' && o.details && o.price && typeof o.price === 'object') {
      if (!out.has(o.slug)) out.set(o.slug, o);
      return;
    }
    for (const k in o) walk(o[k]);
  })(root);
  return [...out.values()];
}

// --- Filtr: tylko żywność i napoje ---
const NON_FOOD = /\b(znicz|wkład|świecz|świec[aą] |lampion|latarenk|zapalark|zapałk|kwiat|chryzantem|wrzos|sukulent|gałązk|dynia ozdobna|karma dla|przekąska dla (psa|kota)|żwirek|zabawk|strój|mask[ai] |długopis|torba|worki|folia|papier|ręcznik|czyściwo|chusteczk|pieluch|podpask|szampon|żel |mydło|pasta do zębów|lakier|masz\. do golenia|maszynk|patyczki|gąbk|emulsja|płyn do|płyn nabłyszcz|kapsułki|proszek do prania|odplamiacz|odświeżacz|zmywak|ściereczk|ścierki|szufelk|miotł|rękawic|rajstop|podkolan|poszewk|bieżnik|obrus|kalendarz|bateri|przedłużacz|szklanka|bulionówk|podkładka|kula do kąpieli|skrobak|marker|tatuaż|brelok)/i;
const NON_FOOD_CAT = /(znicz|chemi|kosmet|karm|zwierz|kwiat|zabaw|tekstyl|art\. ?przem|przemysł|higien|sprzątan|pranie)/i;
function isFood(name, category) {
  if (category && NON_FOOD_CAT.test(category)) return false;
  return !NON_FOOD.test(` ${name} `);
}

// --- Pomocnicze ---
const num = (s) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const isoDate = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
function packFromName(name) {
  const m = name.match(/(\d+\s*x\s*)?\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?\s?(kg|g|ml|l|szt\.?)(?![a-ząćęłńóśźż])/i);
  if (m) return m[0].replace(/\s+/g, ' ').trim();
  if (/\bkg\b/i.test(name)) return '1 kg';
  return null;
}
const lc = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : null);

function fromFullProduct(p) {
  const pr = p.price || {};
  const price = num(pr.price);
  const old = num(pr.oldPrice);
  const cond = [];
  if (pr.isXyPromo || pr.xyPromo) cond.push(String(pr.xyPromo || 'promocja X+Y'));
  if (pr.specialPriceConditions) cond.push(String(pr.specialPriceConditions).toLowerCase() + (pr.multibuyText ? ` (cena ${pr.multibuyText})` : ''));
  if (pr.isSuperprice) cond.push('super cena');
  const cat = (p.categoryPath || []).filter(Boolean).pop() || p.category?.name || null;
  const desc = String(p.details?.descriptionList || '').split(/[\r\n]/)[0].replace(/[,;\s]+$/, '').trim() || null;
  return {
    name: p.details?.name || p.details?.nameList || p.slug,
    price,
    regularPrice: old != null && price != null && old > price ? old : null,
    packSize: desc || packFromName(p.details?.name || ''),
    unitPrice: pr.pricePerUnit || pr.pricePerUnitDefault || null,
    conditions: cond.length ? cond.join('; ') : null,
    category: lc(cat),
    isPromo: (old != null && price != null && old > price) || cond.length > 0,
  };
}

export async function collect() {
  const t0 = Date.now();
  try {
    const offers = new Map(); // slug -> oferta

    // 1) Gazetka standardowa
    let leafletItems = [];
    try {
      const d = nuxtData(await getHtml(`${BASE}/gazetki/lista/standard`));
      const leaflets = d?.pinia?.leaflet?.leaflets || [];
      const today = new Date().toISOString().slice(0, 10);
      for (const l of leaflets) {
        const from = isoDate(l.activeFrom), to = isoDate(l.activeTo);
        if (to && to < today) continue;
        for (const pg of l.pages || []) for (const hs of pg.hotspots || []) {
          const pr = hs?.product;
          if (!pr?.slug || hs.isActive === false || hs.isOverlay) continue;
          leafletItems.push({ slug: pr.slug, name: pr.name, price: num(pr.price), from, to, alcohol: !!(hs.isAlcohol || pg.isAlcohol) });
        }
      }
    } catch (e) { console.error('[Dino] gazetka:', e.message); }

    // 2) Teraz taniej (pełne dane cenowe)
    const full = new Map();
    try {
      const d = nuxtData(await getHtml(`${BASE}/kategoria/teraz-taniej`));
      for (const p of findProducts(d)) full.set(p.slug, p);
    } catch (e) { console.error('[Dino] teraz-taniej:', e.message); }

    // 3) Kilka stron produktów z gazetki bez gramatury w nazwie (np. wędliny na wagę)
    const needDetail = [...new Map(leafletItems.map((x) => [x.slug, x])).values()]
      .filter((x) => !full.has(x.slug) && !packFromName(x.name) && isFood(x.name, null))
      .slice(0, MAX_PRODUCT_PAGES);
    for (const x of needDetail) {
      if (Date.now() - t0 > TIME_BUDGET_MS) break;
      try {
        const d = nuxtData(await getHtml(`${BASE}/produkt/${encodeURIComponent(x.slug)}`));
        const p = findProducts(d).find((q) => q.slug === x.slug);
        if (p) full.set(p.slug, p);
      } catch (e) { console.error('[Dino] produkt', x.slug, e.message); }
    }

    // Pozycje z gazetki (wzbogacone, jeśli są pełne dane)
    for (const x of leafletItems) {
      if (offers.has(x.slug) || x.price == null) continue;
      const f = full.has(x.slug) ? fromFullProduct(full.get(x.slug)) : null;
      const name = x.name;
      if (!isFood(name, f?.category)) continue;
      offers.set(x.slug, {
        chain,
        productName: name,
        price: x.price,
        regularPrice: f && f.price === x.price ? f.regularPrice : null,
        packSize: f?.packSize || packFromName(name),
        unitPrice: f && f.price === x.price ? f.unitPrice : null,
        validFrom: x.from,
        validTo: x.to,
        conditions: f && f.price === x.price ? f.conditions : null,
        url: `${BASE}/produkt/${x.slug}`,
        category: f?.category || null,
      });
    }

    // Pozostałe promocje z „Teraz taniej” (daty nie są podawane na stronie)
    for (const [slug, p] of full) {
      if (offers.has(slug)) continue;
      const f = fromFullProduct(p);
      if (!f.isPromo || f.price == null || !isFood(f.name, f.category)) continue;
      offers.set(slug, {
        chain,
        productName: f.name,
        price: f.price,
        regularPrice: f.regularPrice,
        packSize: f.packSize,
        unitPrice: f.unitPrice,
        validFrom: null,
        validTo: null,
        conditions: f.conditions,
        url: `${BASE}/produkt/${slug}`,
        category: f.category,
      });
    }

    const result = [...offers.values()];
    if (!result.length) console.error('[Dino] brak ofert (zmiana struktury strony?)');
    return result;
  } catch (e) {
    console.error('[Dino] błąd:', e?.message || e);
    return [];
  }
}
