'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { inspect }=require('../diagnostics/finance-readcheck.cjs');

test('Funding V3 successful data array is accepted',()=>{
 const x=inspect('funding',{code:'00000',data:[]});
 assert.equal(x.ok,true);assert.equal(x.shape,'data_array');assert.equal(x.hasUSDC,false);
});
test('UTA V3 successful data.assets is accepted',()=>{
 const x=inspect('uta',{code:'00000',data:{assets:[{coin:'USDC',available:'78.2362',balance:'78.2362'}]}});
 assert.equal(x.ok,true);assert.equal(x.hasAvailableField,true);assert.equal(x.hasBalanceField,true);
});
test('Unexpected UTA shape is not presented as success',()=>{
 const x=inspect('uta',{code:'00000',data:[]});
 assert.equal(x.ok,false);assert.equal(x.shape,'unexpected_asset_envelope');
});
test('Bitget error code is preserved without credentials or balances',()=>{
 const x=inspect('uta',{code:'40009',msg:'sign error',data:null});
 assert.equal(x.ok,false);assert.equal(x.bitgetCode,'40009');
 assert.equal(JSON.stringify(x).includes('sign error'),false);
});
test('Invalid envelopes are rejected',()=>{
 assert.equal(inspect('funding',null).ok,false);
 assert.equal(inspect('uta',[]).ok,false);
});
