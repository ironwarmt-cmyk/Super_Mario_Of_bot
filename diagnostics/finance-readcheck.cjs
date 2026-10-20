'use strict';

// Read-only, owner-authenticated Bitget API diagnostics.
// This module must NOT be used to initiate transfers, withdrawals, or trading.
const { createHmac } = require('node:crypto');

const TARGETS = Object.freeze([
  ['funding', '/api/v3/account/funding-assets'],
  ['uta', '/api/v3/account/assets'],
]);

function inspect(account, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { shape: 'invalid_json_envelope', ok: false };
  }
  const bitgetCode = typeof payload.code === 'string' ? payload.code : null;
  if (bitgetCode !== '00000') return { bitgetCode, shape: 'bitget_api_error', ok: false };
  const items = account === 'funding' ? payload.data : payload.data?.assets;
  if (!Array.isArray(items)) {
    return {
      bitgetCode, shape: 'unexpected_asset_envelope',
      observedDataType: Array.isArray(payload.data) ? 'array' : typeof payload.data,
      observedAssetsType: Array.isArray(payload.data?.assets) ? 'array' : typeof payload.data?.assets,
      ok: false,
    };
  }
  const usdc = items.find(row => row && String(row.coin).toUpperCase() === 'USDC');
  return {
    bitgetCode,
    shape: account === 'funding' ? 'data_array' : 'data_assets_array',
    assetCount: items.length,
    hasUSDC: Boolean(usdc),
    hasAvailableField: usdc ? typeof usdc.available === 'string' : null,
    hasBalanceField: usdc ? typeof usdc.balance === 'string' : null,
    ok: true,
  };
}

async function probe(account, path, credentials, timeoutMs = 8000) {
  const [key, secret, passphrase] = credentials;
  if (![key, secret, passphrase].every(v => typeof v === 'string' && v.length > 0)) {
    return { account, path, ok: false, issue: 'NOT_CONFIGURED' };
  }
  const timestamp = String(Date.now());
  const sign = createHmac('sha256', secret)
    .update(timestamp + 'GET' + path)
    .digest('base64');
  try {
    const response = await fetch('https://api.bitget.com' + path, {
      method: 'GET',
      headers: {
        'ACCESS-KEY': key,
        'ACCESS-SIGN': sign,
        'ACCESS-PASSPHRASE': passphrase,
        'ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
        'locale': 'en-US',
      },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    let data;
    try { data = await response.json(); } catch (_) {
      return { account, path, httpStatus: response.status, ok: false, issue: 'NON_JSON_RESPONSE' };
    }
    return { account, path, httpStatus: response.status, ...inspect(account, data) };
  } catch (error) {
    return {
      account, path, ok: false,
      issue: error?.name === 'TimeoutError' ? 'TIMEOUT' : 'REQUEST_FAILED',
    };
  }
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  // Load the production owner-auth module only when handling requests.
  // The pure inspect() function remains testable offline in this Git repo.
  const { authenticate } = require('../lib/finance/auth');
  if (!authenticate(req, process.env)) return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
  const env = process.env;
  const configs = [
    ['finance', env.BITGET_FINANCE_KEY, env.BITGET_FINANCE_SECRET, env.BITGET_FINANCE_PASSPHRASE],
    ['read', env.BITGET_READ_KEY, env.BITGET_READ_SECRET, env.BITGET_READ_PASSPHRASE],
  ];
  // Only GET calls. Never expose credentials or the contents of balances.
  const checks = await Promise.all(configs.flatMap(([name, k, s, p]) =>
    TARGETS.map(async ([account, path]) => ({
      source: name,
      ...await probe(account, path, [k, s, p]),
    }))));
  return res.status(200).json({ ok: true, mode: 'READ_ONLY', checks });
}

module.exports = handler;
module.exports.inspect = inspect;
module.exports.probe = probe;
