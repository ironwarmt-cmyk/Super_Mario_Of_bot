// Zbieracz promocji Żabka – autor: MT
// Źródło: publiczne strony gazetek www.zabka.pl (gazetka-promocyjna, -spozywcza, -weekendowa).
// Każda strona osadza gazetkę Publitas z gazetka.zabka.pl; jej publiczny plik spreads.json
// zawiera warstwę tekstową stron (tekst z PDF). Parsujemy wyłącznie ten tekst – bez obrazków.
// robots.txt www.zabka.pl: Disallow tylko /app/; gazetka.zabka.pl nie ma robots.txt (404).
//
// Cena: w warstwie tekstowej duże cyfry ceny są porozbijane, więc cenę wyliczamy
// z gramatury i ceny jednostkowej podanej w ofercie (np. "270 g; 44,41 zł/kg" -> 11,99 zł).
// Dla zakresów ("150-175 g; 39,94-46,60 zł/kg") cena jest przyjmowana tylko, gdy oba końce
// dają tę samą kwotę. Dodatkowo parsujemy zdania typu "..., cena promocyjna 1 szt.: 7,99 zł".

export const chain = 'Żabka';
export const sourceUrls = [
  'https://www.zabka.pl/gazetka-promocyjna/',
  'https://www.zabka.pl/gazetka-spozywcza/',
  'https://www.zabka.pl/gazetka-weekendowa/',
];

const UA = 'JemBezpiecznieBot/0.1 (+https://jem-bezpiecznie-test-iron-war.vercel.app)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, type = 'text') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pl-PL,pl;q=0.9' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return type === 'json' ? await r.json() : await r.text();
  } finally {
    clearTimeout(t);
  }
}

const num = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
const fmt = (n) => n.toFixed(2).replace('.', ',');

function todayWarsaw() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
}

// Wybór gazetki aktualnej (dziś w zakresie dat); jeśli brak – najbliższa przyszła.
function pickLeaflets(html) {
  const re = /data-date-from="(\d{4}-\d{2}-\d{2})[^"]*"\s+data-date-to="(\d{4}-\d{2}-\d{2})[^"]*"[\s\S]*?src="(https:\/\/gazetka\.zabka\.pl\/[^"?]+)/g;
  const all = [];
  let m;
  while ((m = re.exec(html))) all.push({ from: m[1], to: m[2], url: m[3].endsWith('/') ? m[3] : m[3] + '/' });
  const today = todayWarsaw();
  const cur = all.filter((l) => l.from <= today && today <= l.to);
  if (cur.length) return cur;
  const next = all.filter((l) => l.from > today).sort((a, b) => a.from.localeCompare(b.from));
  return next.slice(0, 1);
}

const SIZE_RE = /^(\d+(?:[,.]\d+)?)(?:\s*-\s*(\d+(?:[,.]\d+)?))?\s*(g|kg|ml|l)\s*;\s*(\d+(?:,\d+)?)(?:\s*-\s*(\d+(?:,\d+)?))?\s*zł\/(kg|l)\b/i;
const STOP_RE = /^(cena|najniższa|wartość|przy zakupie|w zestawie|oferta|informacja|lub do|więcej|szczegóły|wielosztuka|drugie|dostępne|od$|do$|szt\.?$|kliknij|łap|butelka zwrotna|puszka|organizator|akcja|promocja|\*|-?\s*\d+\s*%|\d+\s*\+\s*\d+)/i;
const NONFOOD_RE = /starter|doładowan|karta podarunkowa|papieros|tytoń|wkład|zapalnicz|bilet|lotto|szampon|mydło|pasta do zębów|chusteczk|płyn do|proszek|bateri|prezerwatyw|żwirek|karma|spray|dezodorant|antyperspirant|prysznic/i;
// nazwa musi zaczynać się wielką literą (inaczej to zwykle sam opis wariantu, np. "różne rodzaje")
const goodName = (n) => /^[A-ZĄĆĘŁŃÓŚŹŻ0-9]/.test(n) && !/[!:]$/.test(n) && n.length >= 4;

function isNameLine(l) {
  if (!/[a-ząćęłńóśźż]{2}/i.test(l)) return false;
  if (l.length > 60) return false;
  if (STOP_RE.test(l)) return false;
  if (SIZE_RE.test(l)) return false;
  if (/zł/.test(l)) return false;
  if (/[!:]$/.test(l)) return false; // hasła reklamowe
  if (/^(różne rodzaje|butelka|puszka|za puszkę|po odcieku|op\.)/i.test(l)) return false;
  if (l === l.toUpperCase() && /[A-ZĄĆĘŁŃÓŚŹŻ]{3}/.test(l)) return false; // nagłówki działów
  return true;
}

function toDate(dm, year) {
  const [d, m, y] = dm.split('.');
  return `${y || year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function pageValidity(text, year) {
  const re = /od\s+(?:[a-ząćęłńóśźż]+\s+)?(\d{1,2}\.\d{2}(?:\.\d{4})?)\s*(?:r\.)?\s*(?:do|-|–)\s*(?:[a-ząćęłńóśźż]+\s+)?(\d{1,2}\.\d{2}\.?(?:\d{4})?)/gi;
  const set = new Set();
  let m;
  while ((m = re.exec(text))) set.add(toDate(m[1], year) + '|' + toDate(m[2].replace(/\.$/, ''), year));
  if (set.size === 1) return [...set][0].split('|');
  return null;
}

function pageConditions(text) {
  const out = [];
  const m = text.match(/wyłącznie\s+(w czwartki|od poniedziałku do piątku(?: w godzinach [\d:\-–]+)?|od piątku do niedzieli)/i);
  if (m) out.push(m[1]);
  return out;
}

function parsePage(text, ctx) {
  const offers = [];
  const lines = text.split('\n').map((l) => l.trim());
  // akapity: ciągi niepustych linii
  const paras = [];
  let cur = [];
  for (const l of lines) {
    if (!l) { if (cur.length) paras.push(cur); cur = []; } else cur.push(l);
  }
  if (cur.length) paras.push(cur);

  // spłaszczona lista tokenów z indeksem akapitu
  const toks = [];
  paras.forEach((p, pi) => p.forEach((l) => toks.push({ l, pi })));

  const multi = []; // pozycje "PRZY ZAKUPIE N SZT."
  toks.forEach((t, i) => {
    if (/^przy zakupie$/i.test(t.l) && toks[i + 1]) {
      const m = toks[i + 1].l.match(/^(\d+)\s*szt/i);
      if (m) multi.push({ i, n: m[1] });
    }
  });

  const queue = []; // grupy nazw oczekujące na gramaturę
  let group = null;
  const pageCond = pageConditions(text);
  const validity = pageValidity(text, ctx.year) || [ctx.from, ctx.to];

  for (let i = 0; i < toks.length; i++) {
    const { l, pi } = toks[i];
    const sm = l.match(SIZE_RE);
    if (sm) {
      // przypisanie nazwy: grupa z tego samego akapitu bezpośrednio wyżej, inaczej FIFO
      let nameGroup = null;
      if (group && group.pi === pi && group.end === i - 1) {
        nameGroup = group;
        const qi = queue.indexOf(group);
        if (qi >= 0) queue.splice(qi, 1);
      } else if (queue.length) nameGroup = queue.shift();
      group = null;
      if (!nameGroup) continue;

      // atrybuty bloku: do następnej gramatury lub 10 linii
      let regular = null, app = false, setPrice = false;
      for (let k = i + 1; k < Math.min(toks.length, i + 11); k++) {
        const a = toks[k].l;
        if (SIZE_RE.test(a)) break;
        if (/^cena poza zestawem/i.test(a)) {
          setPrice = true;
          const v = (a + ' ' + (toks[k + 1]?.l || '')).match(/zestawem:?\s*(\d+,\d{2})\s*zł/i);
          if (v) regular = num(v[1]);
        } else if (/^cena przed obniżką/i.test(a) && regular == null) {
          const inl = a.match(/(\d+,\d{2})(?:\s*-\s*\d+,\d{2})?\s*zł/);
          if (inl && !/\d+,\d{2}\s*-\s*\d/.test(a)) regular = num(inl[1]);
          else if (!inl) {
            for (let q = k + 1; q < Math.min(toks.length, k + 7); q++) {
              const v = toks[q].l.match(/^(\d+,\d{2})\s*zł$/);
              if (v) { regular = num(v[1]); break; }
            }
          }
        } else if (/^cena z aplikacją/i.test(a)) app = true;
      }

      const q1 = num(sm[1]), q2 = sm[2] ? num(sm[2]) : null;
      const unit = sm[3].toLowerCase();
      const u1 = num(sm[4]), u2 = sm[5] ? num(sm[5]) : null;
      const factor = unit === 'g' || unit === 'ml' ? 1 / 1000 : 1;
      let price;
      if (q2 == null && u2 == null) price = q1 * factor * u1;
      else if (q2 != null && u2 != null) {
        const a = q1 * factor * u2, b = q2 * factor * u1;
        if (Math.abs(a - b) > 0.021) continue;
        price = (a + b) / 2;
      } else continue;
      price = Math.round(price * 100) / 100;
      if (!(price > 0 && price < 1000)) continue;

      const name = nameGroup.lines.join(' ').replace(/\s+/g, ' ').replace(/^\d+\s+/, '').trim();
      if (NONFOOD_RE.test(name) || !goodName(name)) continue;
      const conds = [];
      if (setPrice) {
        let best = null;
        for (const mm of multi) if (!best || Math.abs(mm.i - i) < Math.abs(best.i - i)) best = mm;
        conds.push(best ? `cena przy zakupie ${best.n} szt. (wielosztuka)` : 'cena w zestawie (wielosztuka)');
      }
      if (app) conds.push('z aplikacją Żappka');
      if (pageCond.length) conds.push(`na tej stronie część ofert obowiązuje ${pageCond.join(', ')} – sprawdź w gazetce`);
      offers.push({
        chain,
        productName: name,
        price,
        regularPrice: regular != null && regular > price ? regular : null,
        packSize: `${sm[1]}${sm[2] ? '-' + sm[2] : ''} ${sm[3]}`,
        unitPrice: `${sm[4]}${sm[5] ? '-' + sm[5] : ''} zł/${sm[6]}`,
        validFrom: validity[0],
        validTo: validity[1],
        conditions: conds.length ? conds.join('; ') : null,
        url: ctx.url,
        category: null,
      });
      continue;
    }
    if (isNameLine(l)) {
      const clean = l.replace(/^[\d.\-–\s]+(?=[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])/, '');
      if (group && group.pi === pi && group.end === i - 1) {
        group.lines.push(clean);
        group.end = i;
      } else {
        group = { pi, end: i, lines: [clean] };
        queue.push(group);
      }
    } else if (!(group && group.pi === pi)) {
      group = null;
    }
  }

  // Zdania opisowe: "Nazwa, różne rodzaje, 185-217 g, cena promocyjna 1 szt.: 7,99 zł, ..."
  const flat = text.replace(/\s+/g, ' ');
  const sre = /([A-ZĄĆĘŁŃÓŚŹŻ][^.;:*]{2,80}?)[,;]?\s+(?:\([^)]*\)\s*)?(?:różne rodzaje[,;]?\s*)?(\d+(?:-\d+)?\s*(?:g|ml|kg|l))[,;]\s*cena promocyjna 1 szt(?:\.|uki)?:?\s*(\d+,\d{2})\s*zł([^]*?)(?=(?:[A-ZĄĆĘŁŃÓŚŹŻ][^.;:*]{2,80}?[,;]?\s+(?:\([^)]*\)\s*)?(?:różne rodzaje[,;]?\s*)?\d+(?:-\d+)?\s*(?:g|ml|kg|l)[,;]\s*cena promocyjna)|Oferta|$)/g;
  let m;
  while ((m = sre.exec(flat))) {
    const name = m[1].replace(/,\s*różne rodzaje$/i, '').replace(/^[^A-ZĄĆĘŁŃÓŚŹŻ]+/, '')
      .replace(/^(?:[A-ZĄĆĘŁŃÓŚŹŻ&]+\s+)+(?=[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż])/, '').trim();
    if (NONFOOD_RE.test(name) || !goodName(name)) continue;
    const price = num(m[3]);
    const rp = m[4].match(/Cena przed obniżką:\s*(\d+,\d{2})\s*zł/i);
    const up = m[4].match(/(\d+,\d{2}(?:-\d+,\d{2})?)\s*zł\/(kg|l)/);
    offers.push({
      chain,
      productName: name + (/różne rodzaje/i.test(m[0]) ? ', różne rodzaje' : ''),
      price,
      regularPrice: rp && num(rp[1]) > price ? num(rp[1]) : null,
      packSize: m[2].replace(/\s+/g, ' '),
      unitPrice: up ? `${up[1]} zł/${up[2]}` : null,
      validFrom: validity[0],
      validTo: validity[1],
      conditions: pageCond.length ? pageCond.join('; ') : null,
      url: ctx.url,
      category: null,
    });
  }
  return offers;
}

export async function collect() {
  const started = Date.now();
  try {
    const leaflets = [];
    for (const [i, src] of sourceUrls.entries()) {
      if (i) await sleep(1000);
      try {
        const html = await get(src);
        for (const l of pickLeaflets(html)) if (!leaflets.some((x) => x.url === l.url)) leaflets.push(l);
      } catch (e) {
        console.error('[zabka]', src, e.message);
      }
    }
    const out = [];
    const seen = new Set();
    for (const [i, lf] of leaflets.entries()) {
      if (Date.now() - started > 13000) { console.error('[zabka] limit czasu – pomijam', lf.url); break; }
      if (i) await sleep(1000);
      let spreads;
      try {
        spreads = await get(lf.url + 'spreads.json', 'json');
      } catch (e) {
        console.error('[zabka]', lf.url, e.message);
        continue;
      }
      const ctx = { from: lf.from, to: lf.to, year: lf.from.slice(0, 4), url: lf.url };
      for (const sp of spreads) {
        for (const p of sp.pages || []) {
          if (!p.text) continue;
          for (const o of parsePage(p.text, { ...ctx, url: `${lf.url}page/${p.number}` })) {
            const key = `${o.productName.toLowerCase()}|${o.price}|${o.packSize}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(o);
          }
        }
      }
    }
    return out;
  } catch (e) {
    console.error('[zabka] błąd:', e.message);
    return [];
  }
}
