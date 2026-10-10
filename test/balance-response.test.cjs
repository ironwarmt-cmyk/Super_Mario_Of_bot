'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAvailableUSDC, readBothBalances } = require('../lib/finance/balance-response.cjs');
const success = data => ({ code: '00000', msg: 'success', data });
const funding = () => success([{coin:'USDC',available:'0',balance:'0',frozen:'0'}]);
const uta = () => success({assets:[{coin:'USDC',available:'78.2362',balance:'78.2362'}]});

test('Funding data array with zero USDC is valid', () => assert.equal(
  parseAvailableUSDC(funding(), 'funding').available, '0'));
test('UTA data.assets array supports decimal USDC', () => assert.equal(
  parseAvailableUSDC(uta(), 'uta').available, '78.2362'));
test('Successful empty Funding array is zero', () => assert.equal(
  parseAvailableUSDC(success([]), 'funding').available, '0'));
test('Successful empty UTA assets array is zero', () => assert.equal(
  parseAvailableUSDC(success({assets:[]}), 'uta').available, '0'));
test('Missing account data is NOT silently converted into zero', () => assert.throws(
  () => parseAvailableUSDC({code:'00000'}, 'uta'), {code:'BITGET_INVALID_RESPONSE'}));
test('Wrong Funding envelope shape fails with endpoint context', () => assert.throws(
  () => parseAvailableUSDC(success({assets:[]}), 'funding'), {code:'BITGET_INVALID_RESPONSE',endpoint:'/api/v3/account/funding-assets'}));
test('Wrong UTA envelope shape fails', () => assert.throws(
  () => parseAvailableUSDC(success([]), 'uta'), {code:'BITGET_INVALID_RESPONSE'}));
test('Exchange error preserves the Bitget error code without credentials', () => assert.throws(
  () => parseAvailableUSDC({code:'40009',msg:'sign error',data:null}, 'uta'), {code:'BITGET_API_ERROR',bitgetCode:'40009'}));
test('USDC with malformed available amount is rejected', () => assert.throws(
  () => parseAvailableUSDC(success({assets:[{coin:'USDC',available:'NaN'}]}), 'uta'), {code:'BITGET_INVALID_RESPONSE'}));
test('Both accounts are independently confirmed', async () => {
  const data = await readBothBalances(async () => funding(), async () => uta());
  assert.equal(data.connected, true);
  assert.equal(data.funding.available, '0');
  assert.equal(data.uta.available, '78.2362');
});
test('Partial Bitget failure stays explicit, while valid account is retained', async () => {
  const data = await readBothBalances(async () => funding(), async () => ({code:'40009',data:null}));
  assert.equal(data.connected, false);
  assert.equal(data.funding.ok, true);
  assert.equal(data.uta.ok, false);
  assert.equal(data.uta.bitgetCode, '40009');
});
test('Parser rejects duplicate USDC records', () => assert.throws(
  () => parseAvailableUSDC(success({assets:[{coin:'USDC',available:'1'}, {coin:'USDC',available:'2'}]}),'uta'), {code:'BITGET_INVALID_RESPONSE'}));
