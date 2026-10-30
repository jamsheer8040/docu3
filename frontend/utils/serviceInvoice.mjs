export function isServiceInvoicePaid(invoice) {
  if (!invoice?.id || !['Paid', 'Partially Paid', 'Issued', 'Overdue'].includes(invoice.status)) return false;
  if (invoice.status !== 'Paid' && invoice.payment_status !== 'Paid') return false;
  const total = Number(invoice.total), paid = Number(invoice.paid_amount);
  if (invoice.total == null || invoice.paid_amount == null || !Number.isFinite(total) || !Number.isFinite(paid) || total < 0 || paid < 0) return false;
  return Math.round(paid * 100) >= Math.round(total * 100);
}

// One authoritative invoice state updates every visible service sharing it.
export function refreshServiceInvoiceBadges(orders, freshOrders) {
  const invoices = new Map(freshOrders.filter(row => row.Invoice?.id).map(row => [String(row.Invoice.id), row.Invoice]));
  return orders.map(order => {
    const invoice = invoices.get(String(order.Invoice?.id));
    return invoice ? { ...order, Invoice: { ...order.Invoice, ...invoice } } : order;
  });
}
