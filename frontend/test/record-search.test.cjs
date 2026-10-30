const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function searchHarness() {
  const pending = [], timers = new Map();
  let changed, mounted, dispose, timerId = 0;
  const auth = { user: { id: 1, tenant_id: 3 } }, query = { value: '' };
  const source = fs.readFileSync(path.join(__dirname, '../composables/useRecordSearch.js'), 'utf8').replace(/^import .*$/gm, '').replace('export function', 'function');
  const context = {
    ref: value => ({ value }), unref: value => value.value, AbortController,
    useAuthStore: () => auth,
    useNuxtApp: () => ({ $api: { get(url, options) { return new Promise((resolve, reject) => pending.push({ url, options, resolve, reject })); } } }),
    watch: (_, callback) => { changed = callback; }, onMounted: callback => { mounted = callback; }, onBeforeUnmount: callback => { dispose = callback; },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id)
  };
  vm.createContext(context);
  const state = vm.runInContext(source + '\nuseRecordSearch', context)(query);
  const flush = async () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); await Promise.resolve(); };
  return { state, pending, auth, query, changed: () => changed(), mount: () => mounted(), dispose: () => dispose(), flush };
}
const response = data => ({ data: { success: true, data } });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('search waits for two characters, debounces edits and ignores stale responses', async () => {
  const h = searchHarness(); h.mount(); await h.flush(); assert.equal(h.pending.length, 0);
  h.query.value = 'm'; h.changed(); await h.flush(); assert.equal(h.pending.length, 0);
  h.query.value = 'ma'; h.changed(); h.query.value = 'mana'; h.changed(); await h.flush();
  assert.equal(h.pending.length, 1); assert.equal(h.pending[0].options.params.q, 'mana');
  h.query.value = 'alfaj'; h.changed(); assert.equal(h.pending[0].options.signal.aborted, true); await h.flush();
  h.pending[1].resolve(response([{ key: 'customers', items: [{ title: 'Alfaj' }] }])); await tick();
  h.pending[0].resolve(response([{ key: 'customers', items: [{ title: 'Mana' }] }])); await tick();
  assert.equal(h.state.groups.value[0].items[0].title, 'Alfaj'); assert.equal(h.state.loading.value, false);
});

test('identity changes and unmount discard pending data and cancel requests', async () => {
  const h = searchHarness(); h.query.value = 'mana'; h.mount(); await h.flush();
  h.auth.user = { id: 2, tenant_id: 4 }; h.changed();
  h.pending[0].resolve(response([{ key: 'invoices', items: [{ title: 'Private' }] }])); await tick();
  assert.equal(h.state.groups.value.length, 0);
  await h.flush(); h.dispose(); assert.equal(h.pending[1].options.signal.aborted, true);
  h.pending[1].resolve(response([{ key: 'invoices' }])); await tick(); assert.equal(h.state.groups.value.length, 0);
});

test('category pagination preserves other groups and failures show a retryable error', async () => {
  const h = searchHarness(); h.query.value = 'mana'; h.mount(); await h.flush();
  h.pending[0].resolve(response([{ key: 'customers', page: 1 }, { key: 'invoices', page: 1 }])); await tick();
  const paging = h.state.fetchResults('invoices', 2);
  assert.equal(h.pending[1].options.params.group, 'invoices'); assert.equal(h.pending[1].options.params.page, 2);
  h.pending[1].resolve(response([{ key: 'invoices', page: 2 }])); await paging;
  assert.equal(h.state.groups.value[0].page, 1); assert.equal(h.state.groups.value[1].page, 2);
  const failure = h.state.fetchResults(); h.pending[2].reject({ response: { data: { message: 'Search unavailable' } } }); await failure;
  assert.equal(h.state.error.value, 'Search unavailable'); assert.equal(h.state.loading.value, false);
});
