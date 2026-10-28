const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function page(get, can = () => true, canRecord = () => true) {
  const source = fs.readFileSync(path.join(__dirname, '../pages/sales-orders/index.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '');
  const context = {
    ref: value => ({ value }), computed: fn => ({ get value() { return fn(); } }),
    onMounted() {}, useCreateAction() {}, useUIStore: () => ({}),
    useAuthStore: () => ({ can, canRecord }), useNuxtApp: () => ({ $api: { get } }), console
  };
  vm.createContext(context);
  return vm.runInContext(`${source}\n;({openCreateDialog,openEditDialog,loadAvailableQuotations,continueCreateOrder,createSource,createSourceVisible,createSourceOptions,selectedQuotationId,availableQuotations,quotationLoading,quotationError,quotationSeed,conversionCustomers,conversionServices,dialogVisible,orderToEdit})`, context);
}

test('picker excludes converted, declined, expired and inaccessible quotations', async () => {
  const rows = [
    { id: 1, status: 'Draft', quotation_number: 'QT-1', recipient_name: 'Alice' },
    { id: 2, status: 'Sent' }, { id: 3, status: 'Accepted' },
    { id: 4, status: 'Draft', sales_order_id: 7 }, { id: 5, status: 'SO' },
    { id: 6, status: 'Declined' }, { id: 7, status: 'Expired' }, { id: 8, status: 'Draft' }
  ];
  const ui = page(async url => { assert.equal(url, '/quotations'); return { data: { data: rows } }; }, undefined, (_, action, row) => row.id !== 8);
  ui.openCreateDialog(); ui.createSource.value = 'quotation'; await ui.loadAvailableQuotations();
  assert.equal(JSON.stringify(ui.availableQuotations.value.map(row => row.id)), '[1,2,3]');
  assert.equal(ui.availableQuotations.value[0].selection_label, 'QT-1 · Alice');
  assert.equal(ui.dialogVisible.value, false);
});

test('quotation selection uses existing conversion seed without changing copied values', async () => {
  const seed = { source_quotation_id: 12, discount: 8, tax_rate: 5, recipient_snapshot: { name: 'Alice' }, items: [{ rate: 100, cost: 60 }] };
  const data = { seed, customers: [{ id: 4 }], services: [{ id: 9 }] };
  const ui = page(async url => { assert.equal(url, '/quotations/12/sales-order-draft'); return { data: { data } }; });
  ui.openCreateDialog(); ui.createSource.value = 'quotation'; ui.selectedQuotationId.value = 12;
  await ui.continueCreateOrder();
  assert.equal(ui.quotationSeed.value, seed);
  assert.equal(ui.conversionCustomers.value, data.customers);
  assert.equal(ui.conversionServices.value, data.services);
  assert.equal(ui.dialogVisible.value, true);
  assert.equal(ui.createSourceVisible.value, false);
});

test('failed or concurrently converted quotation leaves picker open and form closed', async () => {
  const ui = page(async () => { throw { response: { data: { message: 'This quotation already has a sales order.' } } }; });
  ui.openCreateDialog(); ui.createSource.value = 'quotation'; ui.selectedQuotationId.value = 12;
  await ui.continueCreateOrder();
  assert.equal(ui.createSourceVisible.value, true);
  assert.equal(ui.dialogVisible.value, false);
  assert.match(ui.quotationError.value, /already has/);
  assert.equal(ui.quotationLoading.value, false);
});

test('manual creation and editing clear previous quotation seed', async () => {
  const ui = page(async () => { throw new Error('Manual creation should not load quotations'); });
  ui.quotationSeed.value = { source_quotation_id: 12 };
  ui.openCreateDialog(); await ui.continueCreateOrder();
  assert.equal(ui.quotationSeed.value, null);
  assert.equal(ui.dialogVisible.value, true);
  ui.quotationSeed.value = { source_quotation_id: 12 };
  const order = { id: 4 }; ui.openEditDialog(order);
  assert.equal(ui.quotationSeed.value, null);
  assert.equal(ui.orderToEdit.value, order);
});

test('quotation option requires quotation list and edit permission', () => {
  const ui = page(async () => {}, (_, action) => action !== 'edit');
  assert.equal(ui.createSourceOptions.value.length, 1);
  assert.equal(ui.createSourceOptions.value[0].value, 'manual');
});
