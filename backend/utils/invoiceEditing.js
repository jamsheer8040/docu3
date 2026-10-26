const db = require('../models');
const f = require('./managementFinance');
const { cents, formula, syncInvoice } = require('./commissionEngine');

// Issued invoices keep their cost postings and item IDs. Billing edits never
// repost costs or disconnect supplier purchases from their original lines.
async function updateUnpaidIssued(invoice, body, transaction) {
  const tenant_id = invoice.tenant_id;
  if (Number(invoice.paid_amount) !== 0) f.fail('Invoices with payments cannot be edited.');
  if (body.status && body.status !== invoice.status) f.fail('Editing cannot change an issued invoice’s status.');
  const customer_id = f.id(body.customer_id, 'customer');
  const customer = await db.Customer.findOne({ where: { tenant_id, id: customer_id }, transaction });
  if (!customer) f.fail('Customer not found in this workspace.', 404);
  const original = await db.InvoiceItem.findAll({ where: { tenant_id, invoice_id: invoice.id }, transaction, lock: transaction.LOCK.UPDATE });
  if (!Array.isArray(body.items) || !original.length || body.items.length !== original.length) f.fail('Issued invoices must keep their existing items.');
  const requestedIds = body.items.map(item => String(item.id));
  if (new Set(requestedIds).size !== original.length || original.some(item => !requestedIds.includes(String(item.id)))) f.fail('Issued invoices must keep their existing item IDs.');
  const linked = original.map(item => item.service_order_id).filter(Boolean).map(String);
  const selected = body.service_order_ids || (body.service_order_id ? [body.service_order_id] : linked);
  if (!Array.isArray(selected) || [...new Set(selected.map(String))].sort().join(',') !== [...new Set(linked)].sort().join(',')) f.fail('Linked services cannot be changed on an issued invoice.');
  if (linked.length && Number(invoice.customer_id) !== customer_id) f.fail('The customer cannot be changed while this invoice has linked services.');
  let subtotal = 0, costTotal = 0;
  for (const item of original) {
    const input = body.items.find(row => String(row.id) === String(item.id));
    const sameId = (a, b) => String(a || '') === String(b || '');
    if (cents(input.cost_price ?? 0) !== cents(item.cost_price) || Number(input.quantity) !== Number(item.quantity) ||
      !sameId(input.wallet_id, item.wallet_id) || !sameId(input.cost_supplier_id, item.cost_supplier_id) ||
      !sameId(input.service_order_id || input._service_order_id, item.service_order_id) ||
      (input.cost_type || 'Wallet') !== (item.cost_type || 'Wallet')) f.fail('Cost, quantity, funding source and service links are locked on issued invoices.');
    if (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 255) f.fail('Enter an item description (maximum 255 characters).');
    const charge = f.units(input.service_charge ?? 0, 'Service charge', true), cost = cents(item.cost_price), quantity = Number(item.quantity);
    const percentage = f.units(input.vat_percentage ?? 0, 'VAT percentage', true);
    if (percentage > 10000) f.fail('VAT percentage cannot exceed 100%.');
    const pricesChanged = charge !== cents(item.service_charge) || percentage !== f.units(item.vat_percentage, 'VAT percentage', true);
    const net = charge !== cents(item.service_charge) ? (cost + charge) * quantity : cents(item.total) - cents(item.vat_amount);
    const selling = charge !== cents(item.service_charge) ? cost + charge : Math.round(net / quantity);
    const vat = pricesChanged ? formula(net, percentage / 100) : cents(item.vat_amount), total = pricesChanged ? net + vat : cents(item.total);
    subtotal += total; costTotal += cost * quantity;
    await item.update({ description: input.description.trim(), ...(pricesChanged ? { service_charge: charge / 100, selling_price: selling / 100, unit_price: selling / 100, vat_percentage: percentage / 100, vat_amount: vat / 100, total: total / 100 } : {}) }, { transaction });
  }
  const discount = f.units(body.discount ?? invoice.discount, 'Discount', true), tax = f.units(body.tax ?? invoice.tax, 'Tax', true), total = subtotal - discount + tax;
  if (total < 0) f.fail('Discount cannot exceed the invoice amount.');
  await invoice.update({ customer_id, due_date: body.due_date === undefined ? invoice.due_date : body.due_date ? f.date(body.due_date) : null, notes: body.notes === undefined ? invoice.notes : body.notes || '', discount: discount / 100, tax: tax / 100, subtotal: subtotal / 100, total: total / 100, cost_total: costTotal / 100 }, { transaction });
  await syncInvoice(invoice, transaction, 'Unpaid issued invoice billing edited');
  return invoice;
}
module.exports = { updateUnpaidIssued };
