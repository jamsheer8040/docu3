const completedStatuses = ['Completed', 'CompletedInvoicePending', 'CompletedInvoiceCreated'];
const day = value => value ? new Date(new Date(value).getTime() + 14400000).toISOString().slice(0, 10) : '';
function trackingFilters(query) {
  const { from = '', to = '', service_type_id } = query;
  for (const date of [from, to]) {
    if (typeof date !== 'string' || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))) throw Object.assign(new Error('Choose valid dates.'), { status: 400 });
  }
  if (from && to && from > to) throw Object.assign(new Error('End date must be on or after start date.'), { status: 400 });
  if (service_type_id && !/^\d+$/.test(String(service_type_id))) throw Object.assign(new Error('Invalid service type.'), { status: 400 });
  return { from, to, service_type_id };
}
function summarizePerformance(orders, staffId, filters) {
  const matches = date => date && (!filters.from || day(date) >= filters.from) && (!filters.to || day(date) <= filters.to);
  const completed = orders.filter(order => completedStatuses.includes(order.status) && matches(order.completed_at) && String(order.completed_by_user_id || 'unassigned') === String(staffId));
  const durations = completed.filter(order => order.started_at && new Date(order.completed_at) >= new Date(order.started_at)).map(order => (new Date(order.completed_at) - new Date(order.started_at)) / 3600000);
  const buckets = new Map();
  for (const order of completed) {
    const month = day(order.completed_at).slice(0, 7);
    buckets.set(month, (buckets.get(month) || 0) + 1);
  }
  return { completed_in_period: completed.length, average_hours: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null, trend: [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })) };
}
module.exports = { trackingFilters, summarizePerformance, completedStatuses };
