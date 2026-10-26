// Anonimowe statystyki wyborów produktów (tylko po zgodzie użytkownika w aplikacji).
// Zapisujemy wyłącznie: miesiąc, sieć sklepu, identyfikatory składników i ceny opakowań.
// Nie zapisujemy adresu IP, identyfikatora urządzenia, nazw wpisanych przez użytkownika ani dokładnych dat.
import {put, list, get} from '@vercel/blob';
import {randomUUID} from 'node:crypto';

const ING = new Set(['platki','mleko','jogurt','jablko','banan','owoce_mroz','jaja','chleb','tortilla','maslo','twarog','ser_zolty','feta','smietana','miod','pomidor','ogorek','papryka','salata','cebula','czosnek','marchew','seler','buraki','ziemniaki','kapusta','brokul','cukinia','pieczarki','szpinak','cytryna','ryz','kasza_gryczana','kasza_jaglana','makaron','maka','soczewica','ciecierzyca','fasola','pomidory_puszka','tofu','kurczak','indyk','dorsz','olej','orzechy','pestki','musztarda']);
const CHAINS = new Set(['biedronka','lidl','kaufland','auchan','carrefour','dino','netto','aldi','zabka','polomarket','lewiatan','stokrotka','intermarche','spolem','delikatesy centrum','inne']);
const SOURCES = new Set(['paragon','lista','plan']);

function clean(body) {
  if (!body || body.v !== 1) return null;
  const month = typeof body.month === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month) ? body.month : null;
  const source = SOURCES.has(body.source) ? body.source : null;
  const chain = CHAINS.has(String(body.chain || '').toLowerCase()) ? String(body.chain).toLowerCase() : 'inne';
  if (!month || !source || !Array.isArray(body.items)) return null;
  const items = body.items
    .slice(0, 80)
    .filter(x => x && ING.has(x.i))
    .map(x => ({i: x.i, ...(typeof x.p === 'number' && x.p > 0 && x.p < 1000 ? {p: Math.round(x.p * 100) / 100} : {}), ...(x.bio === true ? {bio: true} : {})}));
  if (items.length === 0) return null;
  return {v: 1, month, source, chain, items};
}

async function summary(month) {
  const counts = {};
  const prices = {};
  const chains = {};
  let events = 0;
  let cursor;
  do {
    const r = await list({prefix: `stats/${month}/`, cursor, limit: 1000});
    for (const b of r.blobs) {
      const g = await get(b.pathname, {access: 'private'});
      if (!g || g.statusCode !== 200) continue;
      const e = JSON.parse(await new Response(g.stream).text());
      events++;
      chains[e.chain] = (chains[e.chain] || 0) + 1;
      for (const it of e.items) {
        counts[it.i] = (counts[it.i] || 0) + 1;
        if (it.p) (prices[it.i] ||= []).push(it.p);
      }
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([i, n]) => {
      const p = (prices[i] || []).sort((a, b) => a - b);
      return {skladnik: i, wybory: n, mediana_ceny: p.length ? p[Math.floor(p.length / 2)] : null};
    });
  return {miesiac: month, zgloszenia: events, sieci: chains, produkty: top};
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    const e = clean(body);
    if (!e) return res.status(400).json({ok: false});
    await put(`stats/${e.month}/${randomUUID()}.json`, JSON.stringify(e), {access: 'private', contentType: 'application/json', addRandomSuffix: false});
    return res.status(200).json({ok: true});
  }
  if (req.method === 'GET') {
    const key = process.env.STATS_KEY;
    if (!key || req.query.key !== key) return res.status(404).json({ok: false});
    const month = /^20\d{2}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
    return res.status(200).json(await summary(month));
  }
  return res.status(405).json({ok: false});
}
