const { test } = require('node:test');
const assert = require('node:assert/strict');
const ledger = () => import('../../frontend/utils/supplierStatement.mjs');

test('browser and server ledger helpers stay identical for separately deployed apps', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  assert.equal(fs.readFileSync(path.join(__dirname, '../utils/supplierStatement.mjs'), 'utf8'), fs.readFileSync(path.join(__dirname, '../../frontend/utils/supplierStatement.mjs'), 'utf8'));
});

test('supplier statement orders purchases and payments and reconciles all payments including advances', async () => {
  const { supplierStatement } = await ledger();
  const rows = supplierStatement([
    { id: 2, amount: '200.00', paid_amount: '50.00', created_at: '2026-10-04T12:00:00Z', description: 'Second purchase' },
    { id: 1, amount: '100.00', paid_amount: '40.00', created_at: '2026-10-02T12:00:00Z' }
  ], [
    { id: 3, amount: '50.00', payment_date: '2026-10-05T12:00:00Z', purchase_id: 2 },
    { id: 1, amount: '25.00', payment_date: '2026-10-01T12:00:00Z' },
    { id: 2, amount: '40.00', payment_date: '2026-10-03T12:00:00Z', purchase_id: 1 }
  ]);
  assert.deepEqual(rows.map(r => r.balance), [-25, 75, 35, 235, 185]);
  assert.equal(rows.reduce((sum, r) => sum + r.credit, 0), 300);
  assert.equal(rows.reduce((sum, r) => sum + r.debit, 0), 115);
  assert.equal(new Set(rows.map(r => r.key)).size, 5);
  assert.match(rows[0].detail, /Unallocated payment/);
});

test('statement uses cents and stable ordering for transactions with matching timestamps', async () => {
  const { supplierStatement } = await ledger();
  const date = '2026-10-01T12:00:00Z';
  const rows = supplierStatement([{ id: 2, amount: '0.20', created_at: date }, { id: 1, amount: '0.10', created_at: date }], [{ id: 1, amount: '0.30', payment_date: date }]);
  assert.deepEqual(rows.map(r => r.key), ['purchase-1', 'purchase-2', 'payment-1']);
  assert.deepEqual(rows.map(r => r.balance), [0.1, 0.3, 0]);
  assert.deepEqual(supplierStatement([], []), []);
});

test('running balances continue across table pages rather than starting again at zero', async () => {
  const { supplierStatement } = await ledger();
  const rows = supplierStatement(Array.from({ length: 20 }, (_, i) => ({ id: i + 1, amount: 10, created_at: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z` })), []);
  assert.equal(rows.slice(15)[0].balance, 160);
  assert.equal(rows.at(-1).balance, 200);
});

test('statement date range carries opening balance and includes full UAE start/end days', async () => {
 const {supplierStatement,statementPeriod}=await ledger();
 const rows=supplierStatement([
  {id:1,amount:100,created_at:'2026-10-14T19:59:59Z'},
  {id:2,amount:50,created_at:'2026-10-14T20:00:00Z'},
  {id:3,amount:70,created_at:'2026-10-15T19:59:59Z'},
  {id:4,amount:200,created_at:'2026-10-15T20:00:00Z'}
 ],[{id:1,amount:20,payment_date:'2026-10-15T10:00:00Z'}]);
 const period=statementPeriod(rows,'2026-10-15','2026-10-15');
 assert.equal(period.opening,100);assert.equal(period.debit,20);assert.equal(period.credit,120);assert.equal(period.closing,200);
 assert.deepEqual(period.rows.map(row=>row.balance),[150,130,200]);
 assert.equal(period.opening+period.credit-period.debit,period.closing);
 const later=statementPeriod(rows,'2026-10-20','2026-10-21');
 assert.equal(later.rows.length,0);assert.equal(later.opening,400);assert.equal(later.closing,400);
 assert.equal(statementPeriod(rows,'','2026-10-14').closing,100);
 assert.equal(statementPeriod(rows,'2026-10-16','').opening,200);
 assert.equal(statementPeriod(rows).closing,400);
 assert.equal(statementPeriod([], '2026-10-15','2026-10-16').closing,0);
 for(const [from,to] of [['2026-02-30',''],['bad',''],['2026-10-16','2026-10-15'],[[], '']]) assert.throws(()=>statementPeriod(rows,from,to),RangeError);
 const advance=supplierStatement([],[{id:1,amount:25.15,payment_date:'2026-10-01T12:00:00Z'}]);
 assert.equal(statementPeriod(advance,'2026-10-15','2026-10-16').closing,-25.15);
});
