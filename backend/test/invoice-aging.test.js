const { test } = require('node:test');
const assert = require('node:assert/strict');
const { invoiceAgingCutoff } = require('../utils/invoiceAging');

test('invoice aging includes the entire threshold date in Dubai business time', () => {
  const now = new Date('2026-10-13T10:00:00+04:00');
  assert.equal(invoiceAgingCutoff('30', now).toISOString(), '2026-09-13T20:00:00.000Z');
  assert.equal(invoiceAgingCutoff('60', now).toISOString(), '2026-08-14T20:00:00.000Z');
  assert.equal(invoiceAgingCutoff('90', now).toISOString(), '2026-07-15T20:00:00.000Z');
  assert.equal(invoiceAgingCutoff('120', now).toISOString(), '2026-06-15T20:00:00.000Z');
});
test('calendar aging uses the Dubai date even before UTC midnight and crosses leap days', () => {
  assert.equal(invoiceAgingCutoff('30', new Date('2026-10-12T21:00:00Z')).toISOString(), '2026-09-13T20:00:00.000Z');
  assert.equal(invoiceAgingCutoff('30', new Date('2024-03-30T12:00:00Z')).toISOString(), '2024-02-29T20:00:00.000Z');
});
test('unknown or injected ages are rejected', () => {
  for (const value of ['31', '-30', '120+', '30 OR 1=1', ['30'], null]) assert.throws(() => invoiceAgingCutoff(value));
});
