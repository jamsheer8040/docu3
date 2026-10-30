import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isServiceInvoicePaid, refreshServiceInvoiceBadges } from '../utils/serviceInvoice.mjs';

test('paid indicator requires full settlement to the final fils and an active payment state', () => {
  const invoice = { id: 3, invoice_number: 'INV-2026-0003', status: 'Paid', payment_status: 'Paid', total: '100.01', paid_amount: '100.01' };
  assert.equal(isServiceInvoicePaid(invoice), true);
  assert.equal(isServiceInvoicePaid({ ...invoice, paid_amount: '100.00' }), false);
  assert.equal(isServiceInvoicePaid({ ...invoice, status: 'Partially Paid', payment_status: 'Partial', paid_amount: '50' }), false);
  for (const status of ['Draft', 'Pending Approval', 'Approved', 'Cancelled']) assert.equal(isServiceInvoicePaid({ ...invoice, status }), false);
  assert.equal(isServiceInvoicePaid({ ...invoice, status: 'Issued', payment_status: 'Unpaid', paid_amount: '0' }), false);
  assert.equal(isServiceInvoicePaid({ ...invoice, total: '0.00', paid_amount: '0.00' }), true);
  assert.equal(isServiceInvoicePaid({ ...invoice, total: 'not money' }), false);
  assert.equal(isServiceInvoicePaid({ ...invoice, paid_amount: null }), false);
  assert.equal(isServiceInvoicePaid(null), false);
});

test('all services on a shared invoice update together; unrelated invoices and workflow data remain unchanged', () => {
  const shared = { id: 3, status: 'Issued', total: '150', paid_amount: '0', payment_status: 'Unpaid' };
  const unrelated = { id: 4, status: 'Issued', total: '50', paid_amount: '0', payment_status: 'Unpaid' };
  const orders = [{ id: 10, status: 'Pending', Invoice: shared }, { id: 11, status: 'CompletedInvoiceCreated', Invoice: { ...shared } }, { id: 12, Invoice: unrelated }, { id: 13 }];
  const partial = { ...shared, status: 'Partially Paid', payment_status: 'Partial', paid_amount: '149.99' };
  const halfway = refreshServiceInvoiceBadges(orders, [{ id: 10, Invoice: partial }]);
  assert.deepEqual(halfway.slice(0, 2).map(row => isServiceInvoicePaid(row.Invoice)), [false, false]);
  const paid = { ...shared, status: 'Paid', payment_status: 'Paid', paid_amount: '150.00' };
  const result = refreshServiceInvoiceBadges(halfway, [{ id: 10, Invoice: paid }]);
  assert.deepEqual(result.slice(0, 2).map(row => isServiceInvoicePaid(row.Invoice)), [true, true]);
  assert.equal(result[0].status, 'Pending'); assert.equal(result[1].status, 'CompletedInvoiceCreated');
  assert.equal(result[2], orders[2]); assert.equal(result[3], orders[3]);
  assert.equal(orders[0].Invoice.status, 'Issued');
  const reversed = refreshServiceInvoiceBadges(result, [{ id: 11, Invoice: shared }]);
  assert.deepEqual(reversed.slice(0, 2).map(row => isServiceInvoicePaid(row.Invoice)), [false, false]);
});
