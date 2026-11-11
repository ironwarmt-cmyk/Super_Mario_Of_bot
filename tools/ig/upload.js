// Wgrywa wynik daily.js do publicznego bucketu Supabase "ig" i dopisuje publiczne adresy do manifestu.
// Użycie: IG_SECRET=... node tools/ig/upload.js ig-out/RRRR-MM-DD
import fs from 'node:fs';
import path from 'node:path';

const FN = 'https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/ig-media';
const PUB = 'https://ixivedtgqgryawxsxnqd.supabase.co/storage/v1/object/public/ig/';
const dir = path.resolve(process.argv[2] || '.');
const secret = process.env.IG_SECRET;
if (!secret) { console.error('Brak IG_SECRET'); process.exit(1); }
const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.json': 'application/json' };
const call = async (b) => { const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ig-secret': secret }, body: JSON.stringify(b) }); const j = await r.json(); if (!j.ok) throw new Error(JSON.stringify(j)); return j; };

const jobs = [];
for (const r of m.reels) { jobs.push([r.file, `daily/${m.date}/${r.file}`, r, 'video_url']); jobs.push([r.cover, `daily/${m.date}/${r.cover}`, r, 'cover_url']); }
for (const r of m.recalls) jobs.push([r.file, `recall/${r.slug}.jpg`, r, 'image_url']);
const { uploads } = await call({ action: 'sign', paths: jobs.map((j) => j[1]).concat([`daily/${m.date}/manifest.json`, 'latest.json']) });
const put = async (local, key, buf) => {
  const u = uploads[key]; if (!u?.url) throw new Error('brak adresu dla ' + key + ' ' + JSON.stringify(u));
  const r = await fetch(u.url, { method: 'PUT', headers: { 'content-type': TYPES[path.extname(key)], 'x-upsert': 'true' }, body: buf });
  if (!r.ok) throw new Error(`upload ${key}: ${r.status} ${await r.text()}`);
};
for (const [local, key, obj, field] of jobs) { await put(local, key, fs.readFileSync(path.join(dir, local))); obj[field] = PUB + key; console.log('ok', key); }
const mbuf = Buffer.from(JSON.stringify(m, null, 1));
fs.writeFileSync(path.join(dir, 'manifest.json'), mbuf);
await put('manifest.json', `daily/${m.date}/manifest.json`, mbuf);
await put('latest.json', 'latest.json', mbuf); // stały adres dla my-social: jembezpiecznie.com/instagram/latest.json
for (const [, , obj, field] of jobs) { const h = await fetch(obj[field], { method: 'HEAD' }); if (!h.ok) throw new Error('niedostępny ' + obj[field]); }
try { await call({ action: 'cleanup', keep_days: 10 }); } catch (e) { console.error('cleanup:', e.message); }
console.log('MANIFEST', PUB + `daily/${m.date}/manifest.json`);
