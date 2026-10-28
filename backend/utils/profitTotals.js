const { Op, fn, col, literal } = require('sequelize');
const { Invoice, InvoiceItem, Expense, sequelize } = require('../models');

module.exports = async function profitTotals(invoiceWhere, expenseWhere) {
  const tenant_id = invoiceWhere.tenant_id;
  const commissionIds = literal(`(SELECT approval_expense_id FROM commission_entries WHERE tenant_id=${sequelize.escape(tenant_id)} AND approval_expense_id IS NOT NULL UNION SELECT expense_id FROM commission_payments WHERE tenant_id=${sequelize.escape(tenant_id)} AND expense_id IS NOT NULL)`);
  const [charges, expenses, discounts, salaries, commissions] = await Promise.all([
    InvoiceItem.findOne({
      where: { tenant_id },
      attributes: [[fn('COALESCE', fn('SUM', literal('InvoiceItem.service_charge * InvoiceItem.quantity')), 0), 'charges']],
      include: [{ model: Invoice, attributes: [], required: true, where: { ...invoiceWhere, status: { [Op.ne]: 'Cancelled' } } }],
      raw: true
    }),
    Expense.sum('amount', { where: { ...expenseWhere, tenant_id } }),
    Invoice.sum('discount', {where:{...invoiceWhere,status:{[Op.ne]:'Cancelled'}}}),
    Expense.sum('amount', { where: { [Op.and]: [{ ...expenseWhere, tenant_id }, { salary_payroll_id: { [Op.ne]: null } }] } }),
    Expense.sum('amount', { where: { [Op.and]: [{ ...expenseWhere, tenant_id }, { salary_payroll_id: null, id: { [Op.in]: commissionIds } }] } })
  ]);
  const serviceCharges = Number(charges?.charges || 0);
  const expenseTotal = Number(expenses || 0);
  const round = value => Math.round(value * 100) / 100;
  const salaryTotal = Number(salaries || 0), commissionTotal = Number(commissions || 0);
  return { service_charges: serviceCharges, discounts:Number(discounts || 0), expenses: expenseTotal,
    net_service_charges: round(serviceCharges - Number(discounts || 0)),
    salary_expenses: salaryTotal, commission_expenses: commissionTotal,
    operational_expenses: round(expenseTotal - salaryTotal - commissionTotal),
    net_profit: round(serviceCharges - Number(discounts || 0) - expenseTotal) };
};
