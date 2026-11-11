// Serwer dla Railway: zastępuje Vercela (pliki z public/, funkcje z api/, rewrites, redirects, crony).
// Uruchomienie: node server.js   (port z $PORT, domyślnie 3000)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

// "/instagram/:date/manifest.json" -> regex + nazwy parametrów
const compile = (src) => { const keys = []; const re = new RegExp('^' + src.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '$'); return { re, keys }; };
const fill = (dst, keys, m) => keys.reduce((s, k, i) => s.replace(':' + k, m[i + 1]), dst);
const RULES = (list) => (list || []).map((r) => ({ ...r, ...compile(r.source) }));
const rewrites = RULES(cfg.rewrites), redirects = RULES(cfg.redirects);

const handlers = new Map();
async function loadApi(name) {
  if (handlers.has(name)) return handlers.get(name);
  const file = path.join(ROOT, 'api', name + '.js');
  if (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  const h = { fn: mod.default, raw: mod.config?.api?.bodyParser === false };
  handlers.set(name, h); return h;
}

// Pomocniki w stylu Vercela: req.query, req.body, res.status/json/send/redirect
function decorate(req, res, url) {
  req.query = Object.fromEntries(url.searchParams);
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { if (typeof b === 'object' && !Buffer.isBuffer(b)) return res.json(b); res.end(b); return res; };
  res.redirect = (a, b) => { const [code, loc] = typeof a === 'number' ? [a, b] : [307, a]; res.statusCode = code; res.setHeader('location', loc); res.end(); return res; };
}
async function parseBody(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks); if (!buf.length) return undefined;
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('application/json')) { try { return JSON.parse(buf.toString('utf8')); } catch { return buf.toString('utf8'); } }
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
  return buf.toString('utf8');
}

function serveStatic(res, pathname) {
  let p = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let f = path.join(PUB, p);
  if (!f.startsWith(PUB)) return false;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return false;
  res.setHeader('content-type', MIME[path.extname(f).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res); return true;
}

async function proxy(res, target, req) {
  const r = await fetch(target, { method: req.method === 'HEAD' ? 'HEAD' : 'GET' });
  res.statusCode = r.status;
  for (const h of ['content-type', 'cache-control', 'etag', 'last-modified']) { const v = r.headers.get(h); if (v) res.setHeader(h, v); }
  res.end(Buffer.from(await r.arrayBuffer()));
}

async function route(req, res) {
  let url = new URL(req.url, 'http://local');
  if (url.pathname === '/healthz') return res.end('ok');
  for (const r of redirects) { const m = url.pathname.match(r.re); if (m) { res.statusCode = r.permanent ? 308 : 307; res.setHeader('location', fill(r.destination, r.keys, m)); return res.end(); } }
  for (const r of rewrites) {
    const m = url.pathname.match(r.re); if (!m) continue;
    const dst = fill(r.destination, r.keys, m);
    if (/^https?:\/\//.test(dst)) return proxy(res, dst, req);
    const nu = new URL(dst, 'http://local'); for (const [k, v] of url.searchParams) if (!nu.searchParams.has(k)) nu.searchParams.set(k, v);
    url = nu; break;
  }
  const api = url.pathname.match(/^\/api\/([a-z0-9-]+)\/?$/);
  if (api) {
    const h = await loadApi(api[1]);
    if (!h) { res.statusCode = 404; return res.end('Not found'); }
    decorate(req, res, url);
    if (!h.raw && !['GET', 'HEAD'].includes(req.method)) req.body = await parseBody(req);
    return h.fn(req, res);
  }
  if (['GET', 'HEAD'].includes(req.method) && serveStatic(res, url.pathname)) return;
  res.statusCode = 404; res.setHeader('content-type', 'text/plain; charset=utf-8'); res.end('404');
}

const server = http.createServer((req, res) => route(req, res).catch((e) => {
  console.error('ERR', req.method, req.url, e);
  if (!res.headersSent) { res.statusCode = 500; res.end('Internal error'); } else res.end();
}));
server.listen(+process.env.PORT || 3000, () => console.log('listening', +process.env.PORT || 3000));

// Crony z vercel.json (czas UTC, jak na Vercelu). Wysyłają nagłówek jak Vercel Cron.
const field = (spec, v) => spec === '*' || spec.split(',').some((p) => { const [r, st] = p.split('/'); const [a, b] = r === '*' ? [0, 99] : r.split('-').map(Number); return v >= a && v <= (b ?? a) && (v - a) % (+st || 1) === 0; });
const due = (expr, d) => { const [mi, h, dom, mo, dow] = expr.split(/\s+/); return field(mi, d.getUTCMinutes()) && field(h, d.getUTCHours()) && field(dom, d.getUTCDate()) && field(mo, d.getUTCMonth() + 1) && field(dow, d.getUTCDay()); };
let lastMin = -1;
setInterval(() => {
  const d = new Date(); const m = Math.floor(d.getTime() / 60000); if (m === lastMin) return; lastMin = m;
  for (const c of cfg.crons || []) if (due(c.schedule, d)) {
    fetch(`http://127.0.0.1:${+process.env.PORT || 3000}${c.path}`, { headers: { 'user-agent': 'vercel-cron/1.0', ...(process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {}) } })
      .then((r) => console.log('cron', c.path, r.status)).catch((e) => console.error('cron', c.path, e.message));
  }
}, 5000);
