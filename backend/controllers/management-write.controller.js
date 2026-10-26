const { Op } = require('sequelize');
const db = require('../models');
const { internalRead } = require('../utils/recordAccess');
const f = require('../utils/managementFinance');
const where = req => ({ tenant_id: req.user.tenant_id });
const run = (message, handler) => async (req, res) => { try { const data = await handler(req); res.status(req.method === 'POST' ? 201 : 200).json({ success: true, data }); } catch (err) { f.error(res, err, message); } };
const percentage = value => { const p = f.units(value, 'Ownership percentage', true); if (p > 10000) f.fail('Ownership cannot exceed 100%.'); return p; };
async function active(req, transaction) { return internalRead(() => db.Shareholder.findAll({ where: { ...where(req), status: 'Active' }, order: [['id', 'ASC']], transaction })); }
function shareholderData(body, creating) {
  const data = {};
  for (const key of ['name', 'shareholder_id', 'email', 'mobile', 'nationality', 'identity_number', 'address', 'bank_details', 'joining_date', 'status', 'ownership_percentage']) if (body[key] !== undefined) data[key] = body[key];
  if (creating || data.name !== undefined) { if (typeof data.name !== 'string' || !data.name.trim()) f.fail('Shareholder name is required.'); data.name = data.name.trim(); }
  if (creating && data.status === undefined) data.status = 'Active';
  if (data.status !== undefined && !['Active', 'Inactive'].includes(data.status)) f.fail('Invalid shareholder status.');
  if (creating || data.ownership_percentage !== undefined) data.ownership_percentage = percentage(data.ownership_percentage ?? 0) / 100;
  if (data.joining_date) f.date(data.joining_date);
  return data;
}
async function validateOwnership(req, data, current, transaction) {
  const rows = await active(req, transaction);
  const total = rows.filter(row => row.id !== current?.id).reduce((sum, row) => sum + percentage(row.ownership_percentage), 0);
  if ((data.status ?? current?.status) === 'Active' && total + percentage(data.ownership_percentage ?? current?.ownership_percentage) > 10000) f.fail('Total active ownership cannot exceed 100%.');
}
exports.createShareholder = run('Failed to create shareholder', req => {
  const data = shareholderData(req.body, true);
  return f.write(req, async transaction => {
    await validateOwnership(req, data, null, transaction);
    const row = await db.Shareholder.create({ ...data, ...where(req) }, { transaction });
    return { id: row.id };
  });
});
exports.updateShareholder = run('Failed to update shareholder', req => {
  const data = shareholderData(req.body, false);
  return f.write(req, async transaction => {
    const row = await internalRead(() => db.Shareholder.findOne({ where: { id: f.id(req.params.id, 'shareholder'), ...where(req) }, transaction, lock: transaction.LOCK.UPDATE }));
    if (!row) f.fail('Shareholder not found.', 404);
    f.authorize(req.user, 'management', 'edit', row);
    await validateOwnership(req, data, row, transaction);
    if (data.ownership_percentage !== undefined && Number(row.ownership_percentage) !== data.ownership_percentage) {
      const config = await db.SystemConfig.findOne({ where: { ...where(req), key: 'proposed_company_capital' }, transaction });
      const proposed = config ? f.units(config.value, 'Company capital', true) : 0;
      // Audit creation is an internal consequence of the authorized edit, not a
      // separate user-created management record requiring create permission.
      await internalRead(() => db.OwnershipChange.create({ shareholder_id: row.id, previous_percentage: row.ownership_percentage, new_percentage: data.ownership_percentage, previous_capital_requirement: f.prorate(proposed, percentage(row.ownership_percentage)) / 100, new_capital_requirement: f.prorate(proposed, percentage(data.ownership_percentage)) / 100, user_id: req.user.id, reason: req.body.ownership_change_reason || 'Manual Update', ...where(req) }, { transaction }));
    }
    await row.update(data, { transaction });
    return { id: row.id };
  });
});
exports.createCapitalTransaction = run('Failed to record capital transaction', req => {
  const { type, method, reference_number, remarks } = req.body;
  if (!['Contribution', 'Advance', 'Refund'].includes(type)) f.fail('Choose Contribution, Advance or Refund. Adjustments are not supported.');
  const cents = f.units(req.body.amount), date = f.date(req.body.date), shareholder_id = f.id(req.body.shareholder_id, 'shareholder');
  return f.write(req, async transaction => {
    const shareholder = await db.Shareholder.findOne({ where: { id: shareholder_id, ...where(req) }, transaction });
    if (!shareholder) f.fail('Shareholder not found or not accessible.', 404);
    const wallet = await f.wallet(req, req.body.wallet_id, transaction);
    const row = await db.CapitalTransaction.create({ shareholder_id, type, method, reference_number, remarks, amount: cents / 100, date, wallet_id: wallet?.id ?? null, ...where(req) }, { transaction });
    await f.postWallet(req, wallet, cents, type !== 'Refund', type === 'Refund' ? 'Capital Refund' : 'Capital Contribution', row.id, transaction);
    return { id: row.id };
  });
});
exports.declareDividend = run('Failed to declare dividend', req => {
  const total = f.units(req.body.dividend_amount, 'Dividend'), profit = f.units(req.body.total_profit, 'Total profit');
  if (total > profit) f.fail('Dividend cannot exceed total profit.');
  const declaration_date = f.date(req.body.declaration_date), financial_year = String(req.body.financial_year ?? '').trim();
  if (!financial_year || financial_year.length > 20) f.fail('Enter a financial year.');
  return f.write(req, async transaction => {
    const rows = await active(req, transaction);
    if (rows.reduce((sum, row) => sum + percentage(row.ownership_percentage), 0) !== 10000) f.fail('Active ownership must total exactly 100% before declaring dividends.');
    const allocations = rows.filter(row => Number(row.ownership_percentage) > 0).map(row => {
      const product = BigInt(total) * BigInt(percentage(row.ownership_percentage));
      return { row, cents: Number(product / 10000n), remainder: Number(product % 10000n) };
    });
    allocations.sort((a, b) => b.remainder - a.remainder || a.row.id - b.row.id);
    const remainder = total - allocations.reduce((sum, item) => sum + item.cents, 0);
    for (let i = 0; i < remainder; i++) allocations[i].cents++;
    const declaration = await db.DividendDeclaration.create({ financial_year, total_profit: profit / 100, dividend_amount: total / 100, declaration_date, remarks: req.body.remarks, status: 'Declared', ...where(req) }, { transaction });
    for (const item of allocations) await db.DividendDistribution.create({ declaration_id: declaration.id, shareholder_id: item.row.id, ownership_percentage: item.row.ownership_percentage, allocated_amount: item.cents / 100, paid_amount: 0, ...where(req) }, { transaction });
    return { id: declaration.id };
  });
});
exports.payDividend = run('Failed to record dividend payment', req => {
  const cents = f.units(req.body.amount), date = f.date(req.body.date), distribution_id = f.id(req.body.distribution_id, 'distribution');
  return f.write(req, async transaction => {
    const distribution = await internalRead(() => db.DividendDistribution.findOne({ where: { id: distribution_id, ...where(req) }, transaction, lock: transaction.LOCK.UPDATE }));
    if (!distribution) f.fail('Distribution not found.', 404);
    const declaration = await internalRead(() => db.DividendDeclaration.findOne({ where: { id: distribution.declaration_id, ...where(req) }, transaction, lock: transaction.LOCK.UPDATE }));
    if (!declaration) f.fail('Declaration not found.', 404);
    f.authorize(req.user, 'management', 'edit', declaration);
    if (!['Declared', 'Partially Paid'].includes(declaration.status)) f.fail('This declaration cannot accept payments.');
    const all = await internalRead(() => db.DividendDistribution.findAll({ where: { declaration_id: declaration.id, ...where(req) }, transaction }));
    const allocated = all.reduce((sum, row) => sum + f.units(row.allocated_amount, 'Allocation', true), 0);
    if (allocated !== f.units(declaration.dividend_amount)) f.fail('Allocations do not match the declaration. Reconcile it before payment.', 409);
    const payments = await internalRead(() => db.DividendPayment.findAll({ where: { distribution_id: { [Op.in]: all.map(row => row.id) }, ...where(req) }, transaction }));
    const paidFor = id => payments.filter(row => row.distribution_id === id).reduce((sum, row) => sum + f.units(row.amount, 'Historical payment'), 0);
    for (const row of all) if (paidFor(row.id) !== f.units(row.paid_amount, 'Paid amount', true) || paidFor(row.id) > f.units(row.allocated_amount, 'Allocation', true)) f.fail('Payment history is inconsistent. Reconcile it before payment.', 409);
    const paid = paidFor(distribution.id);
    if (cents > f.units(distribution.allocated_amount, 'Allocation', true) - paid) f.fail('Amount exceeds remaining allocated dividend.');
    const wallet = await f.wallet(req, req.body.wallet_id, transaction);
    const payment = await db.DividendPayment.create({ distribution_id, amount: cents / 100, date, method: req.body.method, wallet_id: wallet?.id ?? null, reference_number: req.body.reference_number, remarks: req.body.remarks, ...where(req) }, { transaction });
    await distribution.update({ paid_amount: (paid + cents) / 100 }, { transaction });
    const totalPaid = payments.reduce((sum, row) => sum + f.units(row.amount), 0) + cents;
    await declaration.update({ status: totalPaid === allocated ? 'Fully Paid' : 'Partially Paid' }, { transaction });
    await f.postWallet(req, wallet, cents, false, 'Dividend Payout', payment.id, transaction);
    return { id: payment.id };
  });
});
