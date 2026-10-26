export const trackingPeriods = [{ title: 'Yearly', value: 'yearly' }, { title: 'Monthly', value: 'monthly' }, { title: 'Today', value: 'today' }];
export function trackingPeriodDates(period, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  const year = value('year'); const month = value('month'); const today = `${year}-${month}-${value('day')}`;
  return { from: period === 'yearly' ? `${year}-01-01` : period === 'today' ? today : `${year}-${month}-01`, to: period === 'yearly' ? `${year}-12-31` : period === 'today' ? today : new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().slice(0, 10) };
}
export function trackingPeriodLabel(period) {
  const { from, to } = trackingPeriodDates(period);
  const format = date => new Date(`${date}T00:00:00+04:00`).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' });
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}
