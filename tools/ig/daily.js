// Dzienny generator Instagram: 5 rolek + grafiki nowych ostrzeżeń GIS.
// Użycie: node tools/ig/daily.js [RRRR-MM-DD] [katalog_wyjściowy]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, TGB, APP, FACT, ALERT_FALLBACK, TAGS } from './content.js';
import { recentWarnings } from './gis.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STORE = 'https://ixivedtgqgryawxsxnqd.supabase.co/storage/v1/object/public/ig';
const warsawDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
const DATE = process.argv[2] || warsawDate();
const OUT = path.resolve(process.argv[3] || `ig-out/${DATE}`);
const BAD = /\b(bot\w*|agent\w*|AI)\b|automat|sztuczn/i;
fs.mkdirSync(OUT, { recursive: true });

const n = Math.round((Date.parse(DATE) - Date.parse('2026-11-08')) / 864e5);
const mod = (a, m) => ((a % m) + m) % m;
const short = (s, k) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > k ? s.slice(0, k - 1).replace(/[\s,;:.-]+\S*$/, '') + '…' : s; };
const cap1 = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const plDate = (iso) => iso.split('-').reverse().join('.');

async function exists(url) { try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch { return false; } }

// ---------- ostrzeżenia GIS ----------
function hazardOf(w) { const t = w.title.split(':').slice(1).join(':').trim(); return cap1(t || w.title); }
function recallCaption(w) {
  const lines = [`🚨 OSTRZEŻENIE GIS · ${plDate(w.date)}`, '', hazardOf(w) + '.', ''];
  for (const p of (w.products || []).slice(0, 6)) {
    lines.push(`▪️ ${p.name || 'Produkt'}` + (p.batch ? ` · partia: ${p.batch}` : '') + (p.date ? ` · data: ${p.date.replace(/\s*r\.$/, '')}` : ''));
  }
  if ((w.products || []).length > 6) lines.push(`…oraz ${(w.products.length - 6)} kolejne produkty – pełna lista w komunikacie.`);
  if (w.products?.[0]?.producer) lines.push('', `Producent: ${short(w.products[0].producer, 160)}`);
  lines.push('', w.advice ? `Co zrobić: ${short(w.advice, 400)}` : 'Co zrobić: sprawdź numer partii i datę na opakowaniu i postępuj zgodnie z komunikatem.');
  lines.push('', `Źródło: Główny Inspektorat Sanitarny, gov.pl/web/gis/ostrzezenia`, '', 'Alerty na bieżąco: jembezpiecznie.com i bezpłatna grupa FREE na Telegramie.', '', '#wycofanie #ostrzeżenieGIS #GIS #bezpieczeństwożywności #jembezpiecznie #alert');
  return lines.join('\n').slice(0, 2150);
}
function recallPost(w, i) {
  const p = (w.products || [])[0] || {};
  const items = [{ k: 'Produkt', v: short(p.name || w.title, 70) }];
  if (p.batch) items.push({ k: 'Numer partii', v: short(p.batch, 40) });
  if (p.date) items.push({ k: 'Data', v: p.date.replace(/\s*r\.$/, '') });
  if (p.producer) items.push({ k: 'Producent', v: short(p.producer.split(',')[0], 50) }); else if (p.country) items.push({ k: 'Pochodzenie', v: short(p.country, 40) });
  if ((w.products || []).length > 1) items.push({ k: 'Więcej', v: `+${w.products.length - 1} prod. w komunikacie` });
  return { layout: 'recall', accent: '#ff8a8a', seed: 50 + i, eyebrow: `Ostrzeżenie GIS · ${plDate(w.date)}`, title: 'Sprawdź *partię*', ts: 96, sev: 'WYCOFANIE', rh: short(hazardOf(w), 60), items: items.slice(0, 5), cta: 'Szczegóły w opisie', url: 'jembezpiecznie.com' };
}
function recallReel(w) {
  const p = (w.products || [])[0] || {};
  const rows = [{ k: 'Produkt', v: short(p.name || '', 60) }];
  if (p.batch) rows.push({ k: 'Partia', v: short(p.batch, 34) });
  if (p.date) rows.push({ k: 'Data', v: p.date.replace(/\s*r\.$/, '') });
  return { accent: '#ff8a8a', scenes: [
    { kind: 'hook', eyebrow: `Ostrzeżenie GIS · ${plDate(w.date)}`, title: 'Sprawdź *swoją* lodówkę', small: 1, sub: short(hazardOf(w), 110) },
    { kind: 'recall', d: 4.4, sev: 'WYCOFANIE', rh: short(hazardOf(w), 55), items: rows.filter((r) => r.v) },
    { kind: 'hook', d: 3.6, eyebrow: 'Co zrobić', title: 'Porównaj *partię*', small: 1, sub: short(w.advice || 'Sprawdź numer partii i datę na opakowaniu. Postępuj zgodnie z komunikatem GIS.', 150), src: 'Źródło: gov.pl/web/gis/ostrzezenia' },
    { kind: 'end', d: 3, title: 'Alerty *na bieżąco*', cta: 'Zobacz alerty', url: 'jembezpiecznie.com' }],
    caption: recallCaption(w) };
}

// ---------- render ----------
async function renderReel(page, reel, file, k) {
  const total = await page.evaluate((d) => setup(d), { ...reel, seed: n * 5 + k });
  const fps = 30, frames = Math.round(total * fps), tmp = file + '.v.mp4';
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(fps), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => render(t), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); if (await new Promise((r) => ff.on('close', r)) !== 0) throw new Error('ffmpeg video');
  const tracks = [['glass-horizon.mp3', 150], ['calm-alignment.mp3', 40]];
  const [track, len] = tracks[mod(n + k, 2)]; const ss = mod((n * 37 + k * 23), Math.max(1, Math.floor(len - total)));
  const fo = Math.max(0, total - 1.2).toFixed(2);
  await new Promise((res, rej) => { const p = spawn('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-ss', String(ss), '-i', path.join(HERE, 'audio', track), '-filter_complex', `[1:a]atrim=0:${total.toFixed(2)},afade=t=in:d=0.6,afade=t=out:st=${fo}:d=1.2,volume=0.8[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', file], { stdio: 'inherit' }); p.on('close', (c) => c === 0 ? res() : rej(new Error('ffmpeg audio'))); });
  fs.unlinkSync(tmp);
  return total;
}

(async () => {
  let warnings = [];
  try { warnings = await recentWarnings(+(process.env.IG_GIS_DAYS || 3)); } catch (e) { console.error('GIS:', e.message); }
  const fresh = [];
  for (const w of warnings) { if (!(await exists(`${STORE}/recall/${w.slug}.jpg`))) fresh.push(w); if (fresh.length >= 3) break; }

  const reels = [
    { cat: 'site', ...SITE[mod(n, SITE.length)] },
    { cat: 'tg', ...TGB[mod(n, TGB.length)] },
    { cat: 'app', ...APP[mod(n, APP.length)] },
    { cat: 'fact', ...FACT[mod(n, FACT.length)] },
    fresh[0] ? { cat: 'recall', ...recallReel(fresh[0]) } : (mod(n, 3) === 0 ? { cat: 'site', ...ALERT_FALLBACK[0] } : { cat: 'fact', ...FACT[mod(n + 14, FACT.length)] }),
  ];
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERR', e.message));
  await page.goto('file://' + path.join(HERE, 'reel.html'));
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 60000 });
  const manifest = { date: DATE, day: n, reels: [], recalls: [] };
  for (const [k, r] of reels.entries()) {
    const file = `r${k + 1}.mp4`;
    const caption = r.cat === 'recall' ? r.caption : `${r.caption}\n\n${TAGS[r.cat]}`;
    if (BAD.test(caption) || BAD.test(JSON.stringify(r.scenes))) throw new Error('niedozwolone słowo w rolce ' + (k + 1));
    const dur = await renderReel(page, r, path.join(OUT, file), k);
    await page.evaluate(() => render(2.2)); await page.screenshot({ path: path.join(OUT, `r${k + 1}.jpg`), type: 'jpeg', quality: 88 });
    manifest.reels.push({ file, cover: `r${k + 1}.jpg`, cat: r.cat, seconds: Math.round(dur), caption });
    console.log('reel', k + 1, r.cat, Math.round(dur) + 's');
  }
  const pp = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  for (const [i, w] of fresh.entries()) {
    const data = recallPost(w, i); const file = `recall-${w.slug}.jpg`;
    await pp.goto('file://' + path.join(HERE, 'post.html') + '?i=' + i + '#' + encodeURIComponent(JSON.stringify(data)));
    await pp.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 60000 }); await pp.waitForTimeout(300);
    await pp.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 90 });
    manifest.recalls.push({ file, slug: w.slug, source: w.url, caption: recallCaption(w) });
    console.log('recall', w.slug);
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('OK', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
