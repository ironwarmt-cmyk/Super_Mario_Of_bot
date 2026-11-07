const crypto = require('crypto');
module.exports = function auth(req, res){
  const pass = process.env.DASH_PASSWORD;
  if(!pass){ res.statusCode = 503; res.setHeader('content-type','text/plain; charset=utf-8'); res.end('Brak hasla DASH_PASSWORD w ustawieniach projektu.'); return false; }
  const h = req.headers.authorization || '';
  let given = '';
  if(h.startsWith('Basic ')){ const dec = Buffer.from(h.slice(6), 'base64').toString('utf8'); given = dec.slice(dec.indexOf(':') + 1); }
  const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(pass).digest();
  if(crypto.timingSafeEqual(a, b)) return true;
  res.statusCode = 401; res.setHeader('WWW-Authenticate', 'Basic realm="Centrum Dowodzenia", charset="UTF-8"'); res.setHeader('content-type','text/plain; charset=utf-8'); res.end('Podaj haslo.');
  return false;
};
