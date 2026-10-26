// Supplier payable ledger: purchases are credits, payments are debits.
// Work in cents so every running balance reconciles exactly to the totals.
export function supplierStatement(purchases = [], payments = []) {
  const cents = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;
  const transactions = [
    ...purchases.map(item => ({ key: `purchase-${item.id}`, id: item.id, kind: 'Purchase',
      date: item.created_at, reference: `PUR-${item.id}`, description: item.description || 'Supplier purchase',
      detail: `${item.reference_type || 'Purchase'}${item.reference_id ? ` #${item.reference_id}` : ''}`,
      debitCents: 0, creditCents: cents(item.amount), order: 0 })),
    ...payments.map(item => ({ key: `payment-${item.id}`, id: item.id, kind: 'Payment',
      date: item.payment_date || item.created_at, reference: `PAY-${item.id}`, description: item.reference || 'Payment to supplier',
      detail: [item.purchase_id ? `For PUR-${item.purchase_id}` : 'Unallocated payment', item.WalletAccount?.name].filter(Boolean).join(' · '),
      debitCents: cents(item.amount), creditCents: 0, order: 1 }))
  ].sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0) || a.order - b.order || Number(a.id) - Number(b.id));
  let balanceCents = 0;
  return transactions.map(item => {
    balanceCents += item.creditCents - item.debitCents;
    return { ...item, debit: item.debitCents / 100, credit: item.creditCents / 100, balance: balanceCents / 100 };
  });
}

// Include both selected dates in UAE time. Opening excludes the start day's transactions.
export function statementPeriod(rows, from = '', to = '') {
  for (const value of [from, to]) {
    if (typeof value !== 'string' || (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value))) {
      throw new RangeError('Choose valid start and end dates.');
    }
  }
  if (from && to && from > to) throw new RangeError('End date must be on or after start date.');
  const day = date => new Date(new Date(date).getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const before = from ? rows.filter(row => day(row.date) < from) : [];
  const opening = before.at(-1)?.balance || 0;
  const selected = rows.filter(row => (!from || day(row.date) >= from) && (!to || day(row.date) <= to));
  return { from, to, rows: selected, opening, closing: selected.at(-1)?.balance ?? opening,
    debit: selected.reduce((sum, row) => sum + row.debitCents, 0) / 100,
    credit: selected.reduce((sum, row) => sum + row.creditCents, 0) / 100 };
}
