// Backward compatible: existing workspaces keep commission enabled until explicitly disabled.
async function isEnabled(tenant_id, transaction) {
  if (!tenant_id) return true;
  const { SystemConfig } = require('../models');
  const row = await SystemConfig.findOne({ where: { tenant_id, key: 'commission_enabled' }, transaction });
  return !row || !['false', '0'].includes(String(row.value).toLowerCase());
}
async function requireEnabled(req, res, next) {
  try {
    if (!await isEnabled(req.user.tenant_id)) return res.status(403).json({ success:false, code:'COMMISSION_DISABLED', message:'Commission is disabled for this workspace.' });
    next();
  } catch (error) { next(error); }
}
async function scopeExpenses(options) {
  // Visibility is independent of accounting: historic costs remain in all sums/reports.
  const state=require('./recordAccessContext').getStore();
  if(options.commissionAccounting || ['reports','dashboard','financials'].includes(state?.module) || (Array.isArray(options.attributes) && options.attributes.some(Array.isArray)))return;
  if(options.commissionFeatureScoped)return;
  const tenant_id=require('./tenantContext').getStore() ?? options.where?.tenant_id;
  if(!Number.isSafeInteger(Number(tenant_id)) || Number(tenant_id)<=0 || await isEnabled(Number(tenant_id),options.transaction))return;
  const {Op,literal}=require('sequelize');
  const tenant=Number(tenant_id);
  const linked=literal(`(SELECT approval_expense_id FROM commission_entries WHERE tenant_id=${tenant} AND approval_expense_id IS NOT NULL UNION SELECT expense_id FROM commission_payments WHERE tenant_id=${tenant} AND expense_id IS NOT NULL)`);
  options.where={[Op.and]:[options.where || {},{tenant_id:tenant,id:{[Op.notIn]:linked}}]};
  options.commissionFeatureScoped=true;
}
async function lockTenant(tenant_id,transaction){
  const {Tenant}=require('../models');
  return Tenant.findOne({where:{id:tenant_id},transaction,lock:transaction.LOCK.UPDATE});
}
async function lockEnabled(tenant_id,transaction){
  await lockTenant(tenant_id,transaction);
  if(!await isEnabled(tenant_id,transaction))throw Object.assign(new Error('Commission is disabled for this workspace.'),{status:403});
}
// Caller holds the tenant lock. Invoice IDs avoid DATETIME second-precision races.
async function activate(tenant_id, transaction, { replace = false } = {}) {
  const { SystemConfig, Invoice } = require('../models');
  const where = { tenant_id, key: 'commission_activation' };
  const existing = await SystemConfig.findOne({ where, transaction });
  if (existing && !replace) return;
  const last = await require('./recordAccess').internalRead(() => Invoice.findOne({
    where: { tenant_id }, attributes: ['id'], order: [['id', 'DESC']], transaction
  }));
  const value = JSON.stringify({ activated_at: new Date().toISOString(), last_invoice_id: String(last?.id || 0) });
  if (existing) await existing.update({ value }, { transaction });
  else await SystemConfig.create({ ...where, value }, { transaction });
}
async function eligibleInvoice(invoice, transaction) {
  const { SystemConfig } = require('../models');
  const row = await SystemConfig.findOne({ where: { tenant_id: invoice.tenant_id, key: 'commission_activation' }, transaction });
  // No activation means the workspace has not set up prospective eligibility yet.
  if (!row) return false;
  try { return BigInt(invoice.id) > BigInt(JSON.parse(row.value).last_invoice_id); }
  catch { return false; }
}
async function initializeActivations() {
  const { Tenant, SystemConfig, sequelize } = require('../models');
  // System startup enumerates the non-tenant Tenant master; all business reads stay scoped.
  for (const tenant of await Tenant.findAll({ attributes: ['id'] })) {
    await sequelize.transaction(async transaction => {
      await lockTenant(tenant.id, transaction);
      if (await SystemConfig.findOne({ where: { tenant_id: tenant.id, key: 'simple_commission_criteria' }, transaction })) {
        await activate(tenant.id, transaction);
      }
    });
  }
}
module.exports = { isEnabled, requireEnabled, scopeExpenses, lockTenant, lockEnabled, activate, eligibleInvoice, initializeActivations };
