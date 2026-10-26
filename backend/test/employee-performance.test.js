const test = require('node:test');
const assert = require('node:assert/strict');
const { trackingFilters, summarizePerformance } = require('../utils/employeePerformance');
test('performance uses UAE completion dates and recorded completing employee', () => {
  const orders = [
    { assigned_user_id: 9, completed_by_user_id: 4, status: 'CompletedInvoiceCreated', started_at: '2026-09-30T18:00:00Z', completed_at: '2026-09-30T20:00:00Z' },
    { completed_by_user_id: 4, status: 'Completed', started_at: '2026-10-02T04:00:00Z', completed_at: '2026-10-02T03:00:00Z' },
    { status: 'Completed', completed_at: '2026-10-01T12:00:00Z' },
    { completed_by_user_id: 4, status: 'Cancelled', completed_at: '2026-10-01T12:00:00Z' }
  ];
  const filters = trackingFilters({ from: '2026-10-01', to: '2026-10-01' });
  assert.deepEqual(summarizePerformance(orders, 4, filters), { completed_in_period: 1, average_hours: 2, trend: [{ month: '2026-10', count: 1 }] });
  assert.equal(summarizePerformance(orders, 9, filters).completed_in_period, 0);
  assert.equal(summarizePerformance(orders, 'unassigned', filters).completed_in_period, 1);
  assert.equal(summarizePerformance(orders, 4, {}).average_hours, 2);
});
test('tracking filters reject invalid dates and service ids', () => {
  for (const query of [{ from: '2026-02-30' }, { from: '2026-10-02', to: '2026-10-01' }, { from: ['2026-10-01'] }, { service_type_id: '1 OR 1' }]) assert.throws(() => trackingFilters(query));
});
