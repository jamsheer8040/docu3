function fail(message) { throw Object.assign(new Error(message), { status: 400 }); }
function amount(value, label, max = 9999999999.99) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value)) || !Number.isFinite(Number(value)) || Number(value) > max) fail(`${label} must be a non-negative amount with at most two decimal places.`);
  return Math.round(Number(value) * 100);
}
function calculate(items, discount = 0, taxRate = 0) {
  const discountCents = amount(discount, 'Discount'), rate = amount(taxRate, 'VAT rate', 100);
  const subtotalCents = (items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1) fail('Service quantity must be a positive whole number.');
    const total = sum + amount(item.estimated_price ?? 0, 'Service price') * quantity;
    if (!Number.isSafeInteger(total) || total > 999999999999) fail('Sales order total is too large.');
    return total;
  }, 0);
  if (discountCents > subtotalCents) fail('Discount cannot exceed the subtotal.');
  const taxable = subtotalCents - discountCents;
  const tax = Number((BigInt(taxable) * BigInt(rate) + 5000n) / 10000n);
  return { subtotal: subtotalCents / 100, discount: discountCents / 100, tax_rate: rate / 100, tax_amount: tax / 100, total: (taxable + tax) / 100 };
}
async function defaultRate(tenant_id, transaction) {
  const tax = await require('../models').Tax.findOne({ where: { tenant_id, is_active: true }, order: [['id', 'ASC']], transaction });
  return Number(tax?.rate || 0);
}
async function settings(input, tenant_id, existing, transaction) {
  const discount = Object.hasOwn(input, 'discount') ? input.discount : existing?.discount ?? 0;
  const tax_rate = Object.hasOwn(input, 'tax_rate') ? input.tax_rate : existing?.tax_rate ?? await defaultRate(tenant_id, transaction);
  amount(discount, 'Discount'); amount(tax_rate, 'VAT rate', 100);
  return { discount, tax_rate };
}
async function totals(order, tenant_id, transaction) {
  const taxRate = order.tax_rate ?? await defaultRate(tenant_id, transaction);
  return calculate(order.SalesOrderItems || [], order.discount ?? 0, taxRate);
}
async function serialize(order, tenant_id, transaction) {
  const value = order.toJSON ? order.toJSON() : order;
  return { ...value, Customer: value.Customer || (value.recipient_snapshot ? { ...value.recipient_snapshot, phone_whatsapp: value.recipient_snapshot.phone } : null), ...await totals(order, tenant_id, transaction) };
}
module.exports = { calculate, settings, totals, serialize, defaultRate };
