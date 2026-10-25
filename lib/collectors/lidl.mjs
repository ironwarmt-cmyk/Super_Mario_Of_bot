// Zbieracz ofert promocyjnych żywności – Lidl (lidl.pl). Autor: MT
// Źródło: publiczne strony ofert; produkty są osadzone w HTML w atrybutach data-grid-data (JSON).
// robots.txt: nie używamy /user-api/*, wyszukiwarki (*search?q=*), parametrów offset/id/pageId/sort.
// Strona /c/promocje/s10076831 przekierowuje na /q/query/wyprzedaz (wyprzedaż non-food) – pomijamy ją.
// Nie pobieramy obrazków ani gazetek.

export const chain = 'Lidl';
export const sourceUrls = [
  'https://www.lidl.pl/c/najlepsze-okazje/a10009219',
  'https://www.lidl.pl/c/zywnosc-i-napoje/s10068374',
];
// Podstrony kategorii /h/owoce-i-warzywa/h10071012, /h/napoje/h10071022, /h/mrozonki/h10071049
// zawierały w testach (25.10.2026) wyłącznie produkty już obecne na powyższych stronach – pominięte dla czasu.

const BASE = 'https://www.lidl.pl';
const BOT_UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';
const DELAY_MS = 1100;
const TOTAL_BUDGET_MS = 14000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = { 'User-Agent': BOT_UA, 'Accept': 'text/html', 'Accept-Language': 'pl-PL,pl;q=0.9' };

// Lidl wysyła bardzo duże nagłówki odpowiedzi (> 16 KB, domyślny limit fetch/undici).
// Gdy fetch zgłosi UND_ERR_HEADERS_OVERFLOW, ponawiamy to samo żądanie (ten sam UA)
// wbudowanym modułem node:https z większym limitem nagłówków. To ograniczenie techniczne, nie blokada.
async function httpsGetLargeHeaders(url, timeoutMs, redirects = 3) {
  const https = await import('node:https');
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS, maxHeaderSize: 128 * 1024, timeout: timeoutMs }, (res) => {
      const code = res.statusCode || 0;
      if (code >= 300 && code < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(httpsGetLargeHeaders(new URL(res.headers.location, url).href, timeoutMs, redirects - 1));
        return;
      }
      if (code !== 200) { res.resume(); reject(new Error(`HTTP ${code}${code === 403 ? ' (blokada – nie obchodzimy)' : ''}`)); return; }
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// Przy 403/captcha nie ponawiamy innym UA – zgłaszamy błąd i zwracamy to, co mamy.
async function getHtml(url, deadline) {
  const left = deadline - Date.now();
  if (left < 1500) throw new Error('brak czasu');
  const timeoutMs = Math.min(10000, left);
  let res;
  try {
    res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e?.cause?.code === 'UND_ERR_HEADERS_OVERFLOW') return httpsGetLargeHeaders(url, timeoutMs);
    throw new Error(`${e.message}${e?.cause?.code ? ' ' + e.cause.code : ''}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 403 ? ' (blokada – nie obchodzimy)' : ''}`);
  return await res.text();
}

const decodeEntities = (s) => s
  .replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');

function extractItems(html) {
  const out = [];
  const re = /data-grid-data="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const j = JSON.parse(decodeEntities(m[1]));
      if (j && typeof j === 'object') out.push(j);
    } catch { /* pomiń uszkodzony wpis */ }
  }
  return out;
}

const warsawDate = (d) => {
  if (d == null || d === '') return null;
  const dt = typeof d === 'number' ? new Date(d * 1000) : new Date(d);
  if (isNaN(dt)) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
};

const plNum = (n) => n.toFixed(2).replace('.', ',');
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

function isFood(j) {
  const won = j.keyfacts?.wonCategoryPrimary || '';
  const cat = j.category || '';
  if (/Rośliny i kwiaty/i.test(won)) return false;
  if (/ozdobn/i.test(j.fullTitle || '')) return false; // np. dynia ozdobna
  return /Żywność/i.test(won) || cat === 'Food' || cat === 'F+V';
}

// Wybór obowiązującej ceny: cena regionalna (domyślny region) -> zwykła lub Lidl Plus -> przyszła.
function pickPrice(j) {
  const regions = j.regionsV2 || {};
  const def = Object.values(regions).find((r) => r.isDefault);
  const rp = j.regionsPrices || {};
  const reg = (def && rp[def.regionPriceId]) || Object.values(rp)[0] || {};
  const cands = [
    [reg.currentPrice, false],
    [reg.currentLidlPlusPrice?.price, true, reg.currentLidlPlusPrice],
    [reg.futurePrices?.[0]?.price, false],
    [reg.futureLidlPlusPrices?.[0]?.price?.price, true, reg.futureLidlPlusPrices?.[0]?.price],
    [j.price?.price != null ? j.price : null, false],
    [j.lidlPlus?.[0]?.price, true, j.lidlPlus?.[0]],
  ];
  for (const [p, lp, wrap] of cands) {
    if (p && num(p.price) != null) return { p, lidlPlus: lp, highlight: wrap?.highlightText || null };
  }
  return null;
}

function unitPriceFrom(text, price, pack) {
  const m = (text || '').match(/^\s*(\d+)\s*(g|kg|ml|l|L|szt\.?)\s*=\s*(\d+,\d{2})/);
  if (m) {
    const qty = m[1], unit = m[2].toLowerCase();
    const u = qty === '1' ? unit : `${qty} ${unit}`;
    return `${m[3]} zł/${u}`;
  }
  if (pack && /^1\s*kg$/i.test(pack.trim())) return `${plNum(price)} zł/kg`;
  return null;
}

function mapItem(j) {
  const sel = pickPrice(j);
  if (!sel) return null;
  const { p, lidlPlus } = sel;
  const price = num(p.price);
  const disc = p.discount || {};
  let regular = num(disc.deletedPrice) ?? num(p.oldPrice);
  if (regular != null && regular <= price) regular = null;
  const baseText = (p.basePrice?.text || '').replace(/\s+/g, ' ').trim();
  const packSize = p.packaging?.text?.trim() || null;

  const cond = [];
  const dText = disc.discountText || sel.highlight || '';
  if (dText && !/^-?\d+\s*%$/.test(dText.trim())) cond.push(dText.trim());
  if (lidlPlus) cond.push('z aplikacją Lidl Plus (aktywuj kupon)');
  const lim = baseText.match(/Limit:.*?(?:na (?:kupon|paragon|klienta|osobę)\.?|$)/i);
  if (lim) cond.push(lim[0]);
  const kaucja = baseText.match(/kaucja\s+\d+,\d{2}\s*zł/i);
  if (kaucja) cond.push(`+ ${kaucja[0]}`);
  const badge = j.stockAvailability?.badgeInfo?.badges?.find((b) => /^IN_STORE/.test(b.type));
  if (badge && /tylko w sklepach/i.test(badge.text)) cond.push('tylko w sklepach stacjonarnych');

  const validFrom = warsawDate(j.storeStartDate) || warsawDate(p.startDate);
  const validTo = warsawDate(p.endDate) || warsawDate(j.storeEndDate);
  const catParts = (j.keyfacts?.wonCategoryPrimary || '').split('/');
  const path = j.canonicalUrl || j.canonicalPath;

  return {
    chain,
    productName: (j.fullTitle || j.title || '').replace(/\s+/g, ' ').trim(),
    price,
    regularPrice: regular,
    packSize,
    unitPrice: unitPriceFrom(baseText, price, packSize),
    validFrom,
    validTo,
    conditions: cond.length ? cond.join('; ') : null,
    url: path ? BASE + path : sourceUrls[0],
    category: catParts[2] || null,
  };
}

export async function collect() {
  try {
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const seen = new Map();
    let ok = 0;
    for (let i = 0; i < sourceUrls.length; i++) {
      if (i > 0) await sleep(DELAY_MS);
      if (deadline - Date.now() < 2000) { console.error('[lidl] przekroczono budżet czasu, pomijam resztę stron'); break; }
      try {
        const html = await getHtml(sourceUrls[i], deadline);
        ok++;
        for (const j of extractItems(html)) {
          if (!isFood(j)) continue;
          const key = String(j.productId || j.erpNumber || j.fullTitle);
          if (seen.has(key)) continue;
          const o = mapItem(j);
          if (o && o.productName && o.price > 0) seen.set(key, o);
        }
      } catch (e) {
        console.error(`[lidl] ${sourceUrls[i]}: ${e.message}`);
      }
    }
    if (!ok) console.error('[lidl] nie udało się pobrać żadnej strony');
    return [...seen.values()];
  } catch (e) {
    console.error('[lidl] błąd:', e?.message || e);
    return [];
  }
}
