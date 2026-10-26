export function dashboardReportLink(report, period = 'monthly') {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [year, month] = today.split('-');
  const from = period === 'yearly' ? `${year}-01-01` : period === 'today' ? today : `${year}-${month}-01`;
  const to = period === 'yearly' ? `${year}-12-31` : period === 'today' ? today : new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().slice(0, 10);
  return `/reports?${new URLSearchParams({ report, from, to })}`;
}
