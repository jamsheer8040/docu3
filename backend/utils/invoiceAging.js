// Age is measured in calendar days from the invoice date, using UAE business time.
function invoiceAgingCutoff(age, now = new Date()) {
  if (!['30', '60', '90', '120'].includes(age)) throw new Error('Aging must be 30, 60, 90 or 120 days');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const nextDay = new Date(Date.UTC(Number(date.year), Number(date.month) - 1, Number(date.day) - Number(age) + 1));
  // Exclusive next-midnight boundary includes the entire threshold invoice date.
  return new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00+04:00`);
}
module.exports = { invoiceAgingCutoff };
