const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { styles, validateSettings, renderDocument } = require('../utils/documentTemplates');
test('settings reject unsupported layouts, types and oversized footers', () => {
  assert.throws(() => validateSettings({ defaults: { invoice: '<script>' }, footer: '' }));
  assert.throws(() => validateSettings({ defaults: { quotation: 'classic' }, footer: '' }));
  assert.throws(() => validateSettings({ defaults: {}, footer: 'x'.repeat(1201) }));
  assert.deepEqual(validateSettings({ tenant_id: 99, defaults: { invoice: 'modern', receipt: 'compact' }, footer: 'Thanks' }), { defaults: { invoice: 'modern', receipt: 'compact' }, footer: 'Thanks' });
});
for (const style of styles) test(`${style} exports long documents with bounded pages and a complete PDF`, async () => {
  const output = new PassThrough(); const chunks = []; output.on('data', c => chunks.push(c));
  const finished = new Promise((resolve, reject) => { output.on('end', resolve); output.on('error', reject); });
  const doc = renderDocument({ company: 'Workspace', companyDetails: 'Address', title: 'Invoice', number: 'TEST-1', items: Array.from({ length: 100 }, (_, i) => ({ description: `Service ${i} ` + 'long text '.repeat(20), quantity: 2, rate: 10, total: 20 })), totals: [['Total', 2000]], footer: 'Thank you. '.repeat(100) }, style, output);
  await finished;
  const bytes = Buffer.concat(chunks).toString('latin1');
  const pages = (bytes.match(/\/Type \/Page\b/g) || []).length;
  assert.ok(bytes.startsWith('%PDF-')); assert.ok(bytes.trimEnd().endsWith('%%EOF'));
  assert.ok(pages > 2 && pages < 30, `Unexpected page count: ${pages}`);
});
