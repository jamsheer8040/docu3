// Calendar periods use UAE time regardless of the machine hosting the API.
module.exports = function dashboardPeriod(value = 'monthly', now = new Date()) {
  const requested = typeof value === 'string' ? value.toLowerCase() : 'monthly';
  const period = requested === 'daily' ? 'today' : ['yearly','monthly','today'].includes(requested) ? requested : 'monthly';
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const [year,month] = day.split('-').map(Number);
  const from = period === 'today' ? day : period === 'yearly' ? `${year}-01-01` : `${year}-${String(month).padStart(2,'0')}-01`;
  const start = new Date(from+'T00:00:00+04:00');
  const end = period === 'today' ? new Date(start.getTime()+86400000) : period === 'yearly' ? new Date(`${year+1}-01-01T00:00:00+04:00`) : new Date(Date.UTC(year,month,1)-14400000);
  return {period,day,from,to:new Date(end.getTime()-1+14400000).toISOString().slice(0,10),start,end};
};
