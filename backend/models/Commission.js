const { DataTypes: D } = require('sequelize');
const sequelize = require('../config/database');
const id = () => ({ type: D.INTEGER, primaryKey: true, autoIncrement: true });
const tenant = () => ({ type: D.INTEGER, allowNull: false });
const money = () => ({ type: D.DECIMAL(12, 2), allowNull: false, defaultValue: 0 });
const CommissionRule = sequelize.define('CommissionRule', {
  id: id(), tenant_id: tenant(), name: { type: D.STRING(120), allowNull: false },
  active: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
  priority: { type: D.INTEGER, allowNull: false, defaultValue: 100 },
  version: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
  percentage: { type: D.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  min_service_charge: money(), min_invoice_total: money(),
  condition_mode: { type: D.STRING(3), allowNull: false, defaultValue: 'all' },
  participation: { type: D.STRING(30), allowNull: false, defaultValue: 'customer_owner' },
  staff_ids: { type: D.JSON, allowNull: true }, role_ids: { type: D.JSON, allowNull: true }, service_type_ids: { type: D.JSON, allowNull: true },
  min_employment_days: { type: D.INTEGER, allowNull: false, defaultValue: 0 },
  require_completed: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  effective_from: { type: D.DATEONLY, allowNull: false }, effective_to: { type: D.DATEONLY, allowNull: true },
  created_by: { type: D.INTEGER, allowNull: true }
}, { tableName: 'commission_rules', underscored: true, indexes: [{ fields: ['tenant_id', 'active'] }] });
const CommissionBatch = sequelize.define('CommissionBatch', {
  id: id(), tenant_id: tenant(), invoice_id: { type: D.BIGINT, allowNull: false },
  revision: { type: D.INTEGER, allowNull: false, defaultValue: 0 }, fingerprint: { type: D.STRING(64), allowNull: true }
}, { tableName: 'commission_batches', underscored: true, indexes: [{ unique: true, fields: ['tenant_id', 'invoice_id'] }] });
const CommissionEntry = sequelize.define('CommissionEntry', {
  id: id(), tenant_id: tenant(), invoice_id: { type: D.BIGINT, allowNull: false }, staff_id: { type: D.INTEGER, allowNull: false },
  invoice_number: { type: D.STRING(50), allowNull: false }, invoice_date: { type: D.DATEONLY, allowNull: false },
  staff_name: { type: D.STRING(100), allowNull: false }, rule_id: { type: D.INTEGER, allowNull: false }, rule_snapshot: { type: D.JSON, allowNull: false },
  revision: { type: D.INTEGER, allowNull: false }, service_charge: money(), invoice_total: money(), amount: money(),
  approval_status: { type: D.STRING(20), allowNull: false, defaultValue: 'Pending' },
  reviewed_by: { type: D.INTEGER, allowNull: true }, reviewed_at: { type: D.DATE, allowNull: true },
  rejection_reason: { type: D.STRING(500), allowNull: true },
  approval_expense_id: { type: D.BIGINT, allowNull: true },
  voided_at: { type: D.DATE, allowNull: true }, void_reason: { type: D.STRING(255), allowNull: true }
}, { tableName: 'commission_entries', underscored: true, indexes: [{ unique: true, fields: ['tenant_id', 'invoice_id', 'staff_id', 'revision'] }, { fields: ['tenant_id', 'staff_id', 'invoice_date'] }] });
const CommissionPayment = sequelize.define('CommissionPayment', {
  id: id(), tenant_id: tenant(), entry_id: { type: D.INTEGER, allowNull: false }, staff_id: { type: D.INTEGER, allowNull: false },
  amount: money(), payment_date: { type: D.DATEONLY, allowNull: false }, account_id: { type: D.INTEGER, allowNull: false },
  transaction_id: { type: D.INTEGER, allowNull: true }, expense_id: { type: D.BIGINT, allowNull: true },
  request_key: { type: D.STRING(80), allowNull: false }, created_by: { type: D.INTEGER, allowNull: false },
  notes: { type: D.STRING(255), allowNull: true }, reversed_at: { type: D.DATE, allowNull: true },
  reversed_by: { type: D.INTEGER, allowNull: true }, reversal_reason: { type: D.STRING(255), allowNull: true }, reversal_transaction_id: { type: D.INTEGER, allowNull: true }
}, { tableName: 'commission_payments', underscored: true, indexes: [{ unique: true, fields: ['tenant_id', 'request_key'] }, { fields: ['tenant_id', 'entry_id'] }] });
const CommissionInvoiceSetting = sequelize.define('CommissionInvoiceSetting', {
  id: id(), tenant_id: tenant(), invoice_id: { type: D.BIGINT, allowNull: false },
  version: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
  enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
  rule_id: { type: D.INTEGER, allowNull: true },
  amount: money(), calculated_amount: money(), service_charge: money(),
  staff_id: { type: D.INTEGER, allowNull: true },
  updated_by: { type: D.INTEGER, allowNull: false }
}, { tableName: 'commission_invoice_settings', underscored: true, indexes: [{ unique: true, fields: ['tenant_id', 'invoice_id'] }] });
module.exports = { CommissionRule, CommissionBatch, CommissionEntry, CommissionPayment, CommissionInvoiceSetting };
