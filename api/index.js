const fs = require('fs');
const path = require('path');
const auth = require('./_auth');
let page = null;
module.exports = (req, res) => {
  if(!auth(req, res)) return;
  if(!page) page = fs.readFileSync(path.join(__dirname, '_page.html'), 'utf8');
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('x-robots-tag', 'noindex, nofollow');
  res.end(page);
};
