const bankFields = [['bank_name','Bank'],['account_name','Account name'],['account_number','Account number'],['iban','IBAN'],['swift','SWIFT / BIC'],['branch','Branch']];
function text(value, max) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw Object.assign(new Error(`Document text must be no more than ${max} characters.`), { status: 400 });
  return value.trim();
}
async function defaults(tenant_id, transaction) {
  // Reuse the company's existing quotation bank/terms defaults.
  const row = await require('../models').SystemConfig.findOne({ where: { tenant_id, key: 'quotation_defaults' }, transaction });
  try { return JSON.parse(row?.value || '{}'); } catch { return {}; }
}
async function prepare(input, tenant_id, existing, transaction) {
  const fallback = existing || await defaults(tenant_id, transaction);
  const result = {};
  if (Object.hasOwn(input, 'bank_details') || !existing) {
    const value = Object.hasOwn(input, 'bank_details') ? input.bank_details : fallback.bank_details || {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('Bank details must be an object.'), { status: 400 });
    result.bank_details = Object.fromEntries(bankFields.map(([key]) => [key, text(Object.hasOwn(value, key) ? value[key] : existing?.bank_details?.[key], 150)]));
  }
  for (const key of ['payment_terms','terms']) {
    if (Object.hasOwn(input, key) || !existing) result[key] = text(Object.hasOwn(input, key) ? input[key] : fallback[key], 5000);
  }
  return result;
}
function sections(order, legacy = {}) {
  const bank = order.bank_details == null ? String(legacy.bankDetails || '').replace(/\\n/g, '\n') : bankFields.filter(([key]) => order.bank_details[key]).map(([key,label]) => `${label}: ${order.bank_details[key]}`).join('\n');
  return [
    { title: 'Bank details', text: bank },
    { title: 'Payment terms', text: order.payment_terms ?? '' },
    { title: 'Terms and conditions', text: order.terms ?? String(legacy.termsConditions || '').replace(/\\n/g, '\n') },
    { title: 'Notes', text: order.notes || '' }
  ].filter(section => section.text);
}
module.exports = { defaults, prepare, sections };
