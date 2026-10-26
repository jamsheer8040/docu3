const { Op } = require('sequelize');
const { SystemConfig } = require('../models');
function invoiceDocumentPolicy(config = {}) {
  const enabled = config.is_tax_enabled ?? config.tax_global_config?.is_tax_enabled;
  const registration = config.tax_registration_number ?? config.tax_global_config?.tax_registration_number;
  const trn = typeof registration === 'string' || (typeof registration === 'number' && Number.isFinite(registration)) ? String(registration).trim() : '';
  const taxInvoice = (enabled === true || enabled === 'true') && !!trn;
  return { type: taxInvoice ? 'tax_invoice' : 'invoice', title: taxInvoice ? 'Tax Invoice' : 'Invoice', trn };
}
async function loadInvoiceDocumentPolicy(tenant_id) {
  // Global system defaults mirror /config; tenant settings always override them.
  const rows = await SystemConfig.findAll({ where: { key: { [Op.in]: ['is_tax_enabled', 'tax_registration_number', 'tax_global_config'] }, [Op.or]: [{ tenant_id: null }, { tenant_id }] } });
  const config = {};
  for (const row of [...rows.filter(row => row.tenant_id == null), ...rows.filter(row => row.tenant_id != null)]) {
    try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
  }
  return invoiceDocumentPolicy(config);
}
module.exports = { invoiceDocumentPolicy, loadInvoiceDocumentPolicy };
