// Zbiera oferty ze stron sieci (publiczne gazetki i promocje). Wynik w pamięci CDN Vercel na 6 godzin.
// Sklepy nie współpracują z JB – aplikacja pokazuje ostrzeżenie przy każdej takiej cenie.
import * as c0 from '../lib/collectors/aldi.mjs';
import * as c1 from '../lib/collectors/auchan.mjs';
import * as c2 from '../lib/collectors/biedronka.mjs';
import * as c3 from '../lib/collectors/carrefour.mjs';
import * as c4 from '../lib/collectors/dino.mjs';
import * as c5 from '../lib/collectors/intermarche.mjs';
import * as c6 from '../lib/collectors/kaufland.mjs';
import * as c7 from '../lib/collectors/lewiatan.mjs';
import * as c8 from '../lib/collectors/lidl.mjs';
import * as c9 from '../lib/collectors/netto.mjs';
import * as c10 from '../lib/collectors/polomarket.mjs';
import * as c11 from '../lib/collectors/stokrotka.mjs';
import * as c12 from '../lib/collectors/zabka.mjs';

const COLLECTORS = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12];
const PER_CHAIN_MS = 25000;
// Powód braku danych pokazywany w aplikacji.
const NOTES = {
  Biedronka: 'ceny tylko w obrazkach gazetek',
  Netto: 'gazetka tylko jako obrazki',
  Kaufland: 'strona blokuje roboty',
  Carrefour: 'strona blokuje roboty',
  'Intermarché': 'gazetka tylko jako PDF/obrazki',
  Stokrotka: 'gazetka tylko jako PDF/obrazki',
  Lewiatan: 'brak bieżących ofert w tekście strony',
};

function withTimeout(p, ms) {
  return Promise.race([p, new Promise(res => setTimeout(() => res({timeout: true}), ms))]);
}

export default async function handler(req, res) {
  const started = Date.now();
  const results = await Promise.all(
    COLLECTORS.map(async c => {
      try {
        const r = await withTimeout(Promise.resolve().then(() => c.collect()), PER_CHAIN_MS);
        if (r && r.timeout) return {chain: c.chain, offers: [], ok: false, note: 'przekroczony czas'};
        const offers = Array.isArray(r) ? r.filter(o => o && o.productName && o.price > 0) : [];
        return {chain: c.chain, offers, ok: true, note: offers.length ? undefined : (NOTES[c.chain] || 'brak ofert w tekście strony')};
      } catch (e) {
        return {chain: c.chain, offers: [], ok: false, note: 'błąd pobierania'};
      }
    }),
  );
  const body = {
    generatedAt: new Date().toISOString(),
    tookMs: Date.now() - started,
    notice: 'Ceny z publicznych stron sieci, które nie współpracują z JB. Mogą się różnić od cen w sklepie.',
    chains: results.map(r => ({chain: r.chain, count: r.offers.length, ok: r.ok, note: r.note})),
    offers: results.flatMap(r => r.offers),
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify(body));
}

export const config = {maxDuration: 60};
