const { createHash } = require('node:crypto');
const { Transaction } = require('sequelize');
const db = require('../models');
const { internalRead } = require('./recordAccess');
const { canRecord } = require('./permissionRules');

function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function units(value, label = 'Amount', allowZero = false) {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) fail(`${label} must be a valid number with at most two decimal places.`);
  const number = Number(text), cents = Math.round(number * 100);
  if (!Number.isSafeInteger(cents) || cents > 99999999999999 || (allowZero ? cents < 0 : cents <= 0)) fail(`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'} and within the supported range.`);
  return cents;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Enter a valid date.');
  return value;
}
function id(value, label) { const number = Number(value); if (!Number.isSafeInteger(number) || number <= 0) fail(`Invalid ${label}.`); return number; }
function prorate(cents, basisPoints) { return Number((BigInt(cents) * BigInt(basisPoints) + 5000n) / 10000n); }
function authorize(user, module, action, row) { if (!canRecord(user, module, action, row)) fail(`You do not have ${action} permission for this ${module} record.`, 403); }
function response(row, user) {
  const value = row.toJSON ? row.toJSON() : { ...row };
  value.record_access = Object.fromEntries(['detail', 'edit', 'delete'].map(action => [action, canRecord(user, 'management', action, value)]));
  return value;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
async function write(req, operation) {
  const key = req.get('Idempotency-Key');
  if (key && !/^[a-zA-Z0-9_-]{8,80}$/.test(key)) fail('Invalid request key.');
  const fingerprint = createHash('sha256').update(JSON.stringify(stable({ path: req.originalUrl, body: req.body }))).digest('hex');
  return db.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async transaction => {
    // One stable row serializes tenant financial invariants, even for empty lists.
    const tenant = await db.Tenant.findOne({ where: { id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!tenant) fail('Workspace not found.', 404);
    if (key) {
      const prior = await db.ManagementRequest.findOne({ where: { tenant_id: req.user.tenant_id, user_id: req.user.id, request_key: key }, transaction });
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail('This request key was already used for different data.', 409);
        // Receipts contain only identifiers, never a cached privileged response.
        return prior.response;
      }
    }
    const result = await operation(transaction);
    if (key) await db.ManagementRequest.create({ tenant_id: req.user.tenant_id, user_id: req.user.id, request_key: key, fingerprint, response: result }, { transaction });
    return result;
  });
}
async function wallet(req, walletId, transaction) {
  if (walletId == null || walletId === '') return null;
  const row = await internalRead(() => db.WalletAccount.findOne({ where: { id: id(walletId, 'wallet'), tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE }));
  if (!row) fail('Selected wallet was not found in this workspace.', 404);
  authorize(req.user, 'wallet', 'edit', row);
  return row;
}
async function postWallet(req, row, cents, incoming, reference, referenceId, transaction) {
  if (!row) return;
  // Wallet DECIMAL(10,2) has a smaller range than capital/dividend amounts.
  const balance = Math.round(Number(row.balance) * 100) + (incoming ? cents : -cents);
  if (!Number.isSafeInteger(balance) || Math.abs(balance) > 9999999999 || cents > 9999999999) fail('Amount exceeds the wallet supported range.');
  await db.WalletTransaction.create({ account_id: row.id, type: incoming ? 'Income' : 'Expense', direction: incoming ? 'In' : 'Out', amount: cents / 100, balance_after: balance / 100, reference_type: reference, reference_id: referenceId, description: reference, tenant_id: req.user.tenant_id }, { transaction });
  await row.update({ balance: balance / 100 }, { transaction });
}
function error(res, err, message) {
  const status = err.status || err.statusCode || (err.name?.startsWith('SequelizeValidation') ? 400 : 500);
  if (status >= 500) console.error(message, err);
  return res.status(status).json({ success: false, message: status >= 500 ? message : err.message });
}
module.exports = { fail, units, date, id, prorate, authorize, response, write, wallet, postWallet, error };
