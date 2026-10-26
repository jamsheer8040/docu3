import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleLines, appendBundleLines } from '../utils/serviceBundleLines.mjs';

const service = { id: 11, name: 'Medical', cost_price: '200.10', service_charge: '50.20', pricing_mode: 'Multi', ServiceTypePricings: [{ pricing_type: 'Prime', service_charge: '30.20' }] };
test('bundle pricing uses current catalog cost and customer category for both documents', () => {
  const source = [{ service, quantity: 2 }];
  const quote = bundleLines(source, { kind: 'quotation', pricingCategory: 'Prime' });
  const order = bundleLines(source, { kind: 'sales-order', pricingCategory: 'Prime' });
  assert.equal(quote[0].rate, 230.3);
  assert.equal(order[0].estimated_price, 230.3);
  assert.equal(quote[0].quantity, 2);
  assert.equal(bundleLines(source, { kind: 'quotation' })[0].service_charge, 50.2);
  const single = bundleLines([{ service: { ...service, pricing_mode: 'Single', ServiceTypePricings: [{ pricing_type:'Single', service_charge:'0' }] }, quantity:1 }], { kind:'quotation' });
  assert.equal(single[0].service_charge, 0, 'Explicit zero does not fall back to master charge');
  quote[0].service_charge = 999;
  assert.equal(source[0].service.service_charge, '50.20', 'Editing the cart never changes its source');
});
test('adding a template replaces only an untouched placeholder and preserves all work', () => {
  const placeholder = { service_type_id:null,service_name:'',quantity:1,cost:0,service_charge:0,rate:0 };
  const incoming = bundleLines([{ service, quantity:1 }], { kind:'quotation' });
  assert.equal(appendBundleLines([placeholder],incoming).length,1);
  assert.equal(appendBundleLines([{ ...placeholder,description:'Keep this note' }],incoming).length,2);
  const locked = { id:9,is_locked:true,service_type_id:11,service_charge:99 };
  const combined = appendBundleLines([locked],incoming);
  assert.equal(combined[0],locked);
  combined[1].service_charge=20;
  assert.equal(incoming[0].service_charge,50.2);
  assert.throws(()=>appendBundleLines([locked],incoming,1),/at most 1/);
  assert.equal(locked.service_charge,99);
  assert.equal(appendBundleLines(incoming,incoming).length,2,'Intentional repeat adds separate rows');
});
