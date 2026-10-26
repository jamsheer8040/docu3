const { Op, fn, col, literal } = require('sequelize');
const { Invoice, InvoiceItem, Expense } = require('../models');

module.exports = async function profitTotals(invoiceWhere, expenseWhere) {
  const tenant_id = invoiceWhere.tenant_id;
  const [charges, expenses, discounts] = await Promise.all([
    InvoiceItem.findOne({
      where: { tenant_id },
      attributes: [[fn('COALESCE', fn('SUM', literal('InvoiceItem.service_charge * InvoiceItem.quantity')), 0), 'charges']],
      include: [{ model: Invoice, attributes: [], required: true, where: { ...invoiceWhere, status: { [Op.ne]: 'Cancelled' } } }],
      raw: true
    }),
    Expense.sum('amount', { where: { ...expenseWhere, tenant_id } }),
    Invoice.sum('discount', {where:{...invoiceWhere,status:{[Op.ne]:'Cancelled'}}})
  ]);
  const serviceCharges = Number(charges?.charges || 0);
  const expenseTotal = Number(expenses || 0);
  return { service_charges: serviceCharges, discounts:Number(discounts || 0), expenses: expenseTotal, net_profit: Math.round((serviceCharges - Number(discounts || 0) - expenseTotal)*100)/100 };
};
