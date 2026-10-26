const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { defineStore, createPinia, setActivePinia } = require('pinia');
const storeSource = fs.readFileSync(path.join(__dirname, '../stores/management.js'), 'utf8').replace(/^import[^\r\n]*$/gm, '').replace('export const useManagementStore =', 'globalThis.factory =');
function store(api) {
  const context = { defineStore, crypto: webcrypto, useNuxtApp: () => ({ $api: api }) };
  vm.createContext(context); vm.runInContext(storeSource, context); setActivePinia(createPinia());
  return context.factory();
}
test('successful financial save survives failed refresh and warns against submitting again', async () => {
  let posts = 0;
  const state = store({ post: async () => { posts++; return { data: { data: { id: 12 } } }; }, get: async () => { throw new Error('Unavailable'); } });
  assert.equal((await state.createCapitalTransaction({ amount: 100 })).id, 12);
  assert.equal(posts, 1); assert.match(state.refreshWarning, /Saved successfully/); assert.equal(state.loading, false);
});
test('retry keeps request key and fresh form receives a different key', async () => {
  const keys = [], bodies = []; let fail = true;
  const state = store({ post: async (url, data, config) => { keys.push(config.headers['Idempotency-Key']); bodies.push(JSON.stringify(data)); if (fail) { fail = false; throw new Error('Lost response'); } return { data: { data: { id: 1 } } }; }, get: async () => ({ data: { data: [] } }) });
  const form = { amount: 100 }; await assert.rejects(state.createCapitalTransaction(form)); await state.createCapitalTransaction(form); await state.createCapitalTransaction({ amount: 100 });
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2]); assert.ok(bodies.every(body => !body.includes('_requestKey')));
});
test('a failed save is still rejected and no refresh is attempted', async () => {
  let gets = 0;
  const state = store({ post: async () => { throw new Error('Save rejected'); }, get: async () => { gets++; } });
  await assert.rejects(state.declareDividend({ amount: 100 }), /Save rejected/); assert.equal(gets, 0);
});
test('business date uses UAE midnight and year boundary', () => {
  const source = fs.readFileSync(path.join(__dirname, '../utils/businessDate.js'), 'utf8').replace('export function', 'function') + '\nglobalThis.businessDate = businessDate;';
  const context = {}; vm.createContext(context); vm.runInContext(source, context);
  assert.equal(context.businessDate(new Date('2026-10-20T21:00:00Z')), '2026-10-21');
  assert.equal(context.businessDate(new Date('2026-12-31T20:00:00Z')), '2027-01-01');
  assert.equal(context.businessDate(new Date('2026-10-20T19:59:59Z')), '2026-10-20');
});
