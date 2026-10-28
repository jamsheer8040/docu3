const { internalRead } = require('./recordAccess');
const { units, date, fail } = require('./managementFinance');

// All calls participate in the salary operation's transaction and tenant lock.
async function book(payroll, transaction) {
  if (!transaction) throw new Error('Salary accounting requires a transaction.');
  if (payroll.expense_id) fail('Payroll already has a booked expense.', 409);
  const { Expense } = require('../models');
  const amount = units(Number(payroll.total_amount).toFixed(2), 'Payroll amount', true) / 100;
  const bookingDate = date(payroll.booking_date);
  return internalRead(async () => {
    const expense = await Expense.create({
      tenant_id: payroll.tenant_id, salary_payroll_id: payroll.id,
      description: `Salary payroll: ${payroll.month}`, amount, paid_amount: 0,
      status: amount > 0 ? 'Unpaid' : 'Paid', created_by: payroll.created_by,
      notes: `Salary expense for payroll #${payroll.id}. Payments are managed in Salary.`,
      // Expense reports use created_at as their accounting date. The payroll's
      // own created_at retains the actual booking/audit timestamp. UAE midday
      // keeps the selected calendar date consistent in existing date reports.
      created_at: new Date(`${bookingDate}T12:00:00+04:00`)
    }, { transaction });
    await payroll.update({ expense_id: expense.id }, { transaction });
    return expense;
  });
}
async function linkedExpense(payroll, transaction) {
  if (!transaction) throw new Error('Salary accounting requires a transaction.');
  // Existing payroll may already have a manually entered expense. Do not repost it.
  if (!payroll.expense_id) return null;
  const { Expense } = require('../models');
  return internalRead(async () => {
    const expense = await Expense.findOne({ where: { tenant_id: payroll.tenant_id, id: payroll.expense_id, salary_payroll_id: payroll.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!expense) fail('The linked salary expense is missing. Ask the administrator to reconcile this payroll.', 409);
    if (units(expense.amount, 'Salary expense', true) !== units(Number(payroll.total_amount).toFixed(2), 'Payroll total', true)) fail('The salary expense and payroll total do not match. Reconcile before continuing.', 409);
    return expense;
  });
}
async function settle(payroll, transaction, { account_id, payment_date }) {
  const expense = await linkedExpense(payroll, transaction);
  if (!expense) return;
  const paid = units(Number(payroll.paid_amount).toFixed(2), 'Paid salary', true);
  const amount = units(expense.amount, 'Salary expense', true);
  if (paid > amount) fail('Paid salary exceeds the booked expense.', 409);
  await internalRead(() => expense.update({
    paid_amount: paid / 100, status: paid >= amount ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
    account_id, payment_date
  }, { transaction, salaryAccounting: true }));
}
async function unbook(payroll, transaction) {
  const expense = await linkedExpense(payroll, transaction);
  if (!expense) return;
  if (units(expense.paid_amount, 'Paid salary expense', true) > 0) fail('Cannot unbook a salary expense with recorded payments.', 409);
  await internalRead(() => expense.update({ amount: 0, paid_amount: 0, status: 'Unpaid', account_id: null, payment_date: null,
    notes: `Reversed: unpaid payroll #${payroll.id} (${payroll.month}) was unbooked. Original booked amount AED ${Number(payroll.total_amount).toFixed(2)}.`
  }, { transaction, salaryAccounting: true }));
}
module.exports = { book, settle, unbook };
