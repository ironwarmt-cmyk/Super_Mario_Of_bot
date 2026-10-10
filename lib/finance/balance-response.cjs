'use strict';

// Pure parser for Bitget UTA v3 asset responses. This module does not execute
// orders, transfers or withdrawals and does not access API credentials.
const ASSET_ENDPOINTS = Object.freeze({
  funding: '/api/v3/account/funding-assets',
  uta: '/api/v3/account/assets',
});

class BalanceResponseError extends Error {
  constructor(code, account, bitgetCode = null) {
    super(`${code} (${account})`);
    this.name = 'BalanceResponseError';
    this.code = code;
    this.account = account;
    this.endpoint = ASSET_ENDPOINTS[account] || null;
    this.bitgetCode = bitgetCode;
  }
}

function ensureEnvelope(payload, account) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new BalanceResponseError('BITGET_INVALID_RESPONSE', account);
  }
  if (String(payload.code) !== '00000') {
    throw new BalanceResponseError('BITGET_API_ERROR', account,
      payload.code == null ? null : String(payload.code));
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw new BalanceResponseError('BITGET_INVALID_RESPONSE', account);
  }
  return payload.data;
}

function parseAvailableUSDC(payload, account) {
  if (!Object.prototype.hasOwnProperty.call(ASSET_ENDPOINTS, account)) {
    throw new TypeError('Unsupported Bitget account type');
  }
  const data = ensureEnvelope(payload, account);
  // Bitget V3 Funding returns data: [...], UTA returns data: { assets: [...] }.
  const assets = account === 'funding' ? data : data && data.assets;
  if (!Array.isArray(assets)) {
    throw new BalanceResponseError('BITGET_INVALID_RESPONSE', account);
  }
  const matches = assets.filter(item => item && typeof item === 'object' &&
    String(item.coin).toUpperCase() === 'USDC');
  if (matches.length > 1) throw new BalanceResponseError('BITGET_INVALID_RESPONSE', account);
  if (matches.length === 0) {
    // A successful API response with no USDC entry means zero USDC;
    // a failed/malformed response must never be silently converted to zero.
    return { available: '0', confirmed: true, account, endpoint: ASSET_ENDPOINTS[account] };
  }
  const raw = matches[0].available;
  if (typeof raw !== 'string' || !/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new BalanceResponseError('BITGET_INVALID_RESPONSE', account);
  }
  return { available: raw, confirmed: true, account, endpoint: ASSET_ENDPOINTS[account] };
}

async function readBothBalances(fetchFunding, fetchUta) {
  if (typeof fetchFunding !== 'function' || typeof fetchUta !== 'function') {
    throw new TypeError('Two read-only account fetch functions required');
  }
  const [funding, uta] = await Promise.allSettled([
    Promise.resolve().then(fetchFunding).then(x => parseAvailableUSDC(x, 'funding')),
    Promise.resolve().then(fetchUta).then(x => parseAvailableUSDC(x, 'uta')),
  ]);
  const safe = (result, account) => result.status === 'fulfilled'
    ? { ok: true, ...result.value }
    : { ok: false, account, endpoint: ASSET_ENDPOINTS[account],
        code: result.reason instanceof BalanceResponseError ? result.reason.code : 'BITGET_REQUEST_FAILED',
        bitgetCode: result.reason instanceof BalanceResponseError ? result.reason.bitgetCode : null };
  return { funding: safe(funding, 'funding'), uta: safe(uta, 'uta'),
    connected: funding.status === 'fulfilled' && uta.status === 'fulfilled' };
}

module.exports = { ASSET_ENDPOINTS, BalanceResponseError, parseAvailableUSDC, readBothBalances };
