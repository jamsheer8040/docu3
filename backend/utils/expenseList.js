const { Op, fn, col } = require('sequelize');
const salaryAccess = require('./salaryAccess');

// Staff rows are a read-only projection of the posted monthly expense, not
// additional Expense records. Merge the two ordered sources before paging.
module.exports = async function expenseList(user, query) {
  const { Expense, ExpenseSubType, ExpenseType, WalletAccount, SalaryItem, SalaryPayroll, User, Role } = require('../models');
  const kind = query.expense_kind || 'operational';
  if (!['all', 'operational', 'salary'].includes(kind)) {
    const error = new Error('Invalid expense type.'); error.status = 400; throw error;
  }
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(query.limit, 10) || 10, 100));
  const offset = (page - 1) * limit, take = offset + limit;
  const datedWhere = { tenant_id: user.tenant_id };
  if (query.date_from || query.date_to) {
    datedWhere.created_at = {};
    if (query.date_from) datedWhere.created_at[Op.gte] = new Date(query.date_from);
    if (query.date_to) {
      const end = new Date(query.date_to); end.setHours(23, 59, 59, 999);
      datedWhere.created_at[Op.lte] = end;
    }
  }
  if (query.expense_sub_type_id) datedWhere.expense_sub_type_id = query.expense_sub_type_id;
  let rows = [], count = 0, totalCents = 0, paidCents = 0;
  const cents = value => Math.round(Number(value || 0) * 100);
  if (kind !== 'salary') {
    const where = { ...datedWhere, salary_payroll_id: null };
    if (query.status) where.status = query.status;
    if (query.search) where.description = { [Op.like]: `%${query.search}%` };
    const result = await Expense.findAndCountAll({ where,
      include: [
        { model: WalletAccount, attributes: ['id', 'name'], where: { tenant_id: user.tenant_id }, required: false },
        { model: ExpenseSubType, as: 'SubType', attributes: ['id', 'sub_type_name'], include: [{ model: ExpenseType, as: 'ParentType', attributes: ['id', 'type_name'] }] }
      ], limit: take, order: [['created_at', 'DESC'], ['id', 'DESC']] });
    count += result.count;
    totalCents += cents(await Expense.sum('amount', { where }));
    paidCents += cents(await Expense.sum('paid_amount', { where }));
    rows.push(...result.rows.map(row => ({ ...row.toJSON(), expense_kind: 'operational', payroll_month: null })));
  }
  // A posted payroll is a company-wide amount. Preserve the established
  // Internal role and full Staff list/detail boundary for its expense view.
  if (kind !== 'operational' && user.tenant_id && user.Role?.type === 'Internal' && salaryAccess.fullView(user)) {
    const role = await Role.findOne({ where: { id: user.role_id, type: 'Internal', tenant_id: { [Op.or]: [{ [Op.eq]: user.tenant_id }, { [Op.is]: null }] } }, attributes: ['id'] });
    if (role) {
      const payrolls = await SalaryPayroll.findAll({ where: salaryAccess.visibleWhere('SalaryPayroll', { tenant_id: user.tenant_id, expense_id: { [Op.ne]: null } }), attributes: ['id', 'expense_id', 'month'] });
      if (payrolls.length) {
        const expenses = await Expense.findAll({ where: { ...datedWhere, [Op.or]: payrolls.map(p => ({ id: p.expense_id, salary_payroll_id: p.id })) }, attributes: ['id', 'salary_payroll_id', 'description', 'created_at'] });
        const active = payrolls.filter(p => expenses.some(e => String(e.id) === String(p.expense_id) && String(e.salary_payroll_id) === String(p.id)));
        if (active.length) {
          const where = salaryAccess.visibleWhere('SalaryItem', { tenant_id: user.tenant_id, payroll_id: { [Op.in]: active.map(p => p.id) }, ...(query.status ? { status: query.status } : {}) });
          if (query.search) {
            const text = String(query.search).toLowerCase();
            const matches = active.filter(p => `${p.month} ${expenses.find(e => String(e.id) === String(p.expense_id))?.description || ''}`.toLowerCase().includes(text));
            where[Op.or] = [{ '$Staff.name$': { [Op.like]: `%${query.search}%` } }, { payroll_id: { [Op.in]: matches.map(p => p.id) } }];
          }
          const include = attributes => [
            { model: User, as: 'Staff', attributes: attributes ? ['id', 'name'] : [], where: { tenant_id: user.tenant_id }, required: false },
            { model: SalaryPayroll, as: 'Payroll', attributes: attributes ? ['id', 'month', 'expense_id', 'booking_date'] : [], required: true, where: salaryAccess.visibleWhere('SalaryPayroll', { tenant_id: user.tenant_id, id: { [Op.in]: active.map(p => p.id) } }) }
          ];
          const result = await SalaryItem.findAndCountAll({ where, attributes: ['id', 'user_id', 'payroll_id', 'net_salary', 'paid_amount', 'status'], include: include(true), limit: take, subQuery: false, order: [[{ model: SalaryPayroll, as: 'Payroll' }, 'booking_date', 'DESC'], ['id', 'DESC']] });
          const sums = await SalaryItem.findOne({ where, include: include(false), attributes: [[fn('SUM', col('SalaryItem.net_salary')), 'total'], [fn('SUM', col('SalaryItem.paid_amount')), 'paid']], raw: true });
          count += result.count; totalCents += cents(sums?.total); paidCents += cents(sums?.paid);
          rows.push(...result.rows.map(item => {
            const parent = expenses.find(e => String(e.id) === String(item.Payroll.expense_id));
            const name = item.Staff?.name || `Staff #${item.user_id}`;
            return { id: `salary-item-${item.id}`, tenant_id: user.tenant_id, expense_kind: 'salary', salary_item_id: item.id,
              salary_payroll_id: item.payroll_id, expense_id: parent.id, payroll_month: item.Payroll.month,
              staff_name: name, description: `Salary: ${item.Payroll.month} — ${name}`, created_at: parent.created_at,
              amount: item.net_salary, paid_amount: item.paid_amount, status: item.status };
          }));
        }
      }
    }
  }
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) ||
    String(b.expense_kind).localeCompare(String(a.expense_kind)) ||
    (BigInt(b.salary_item_id || b.id) > BigInt(a.salary_item_id || a.id) ? 1 : BigInt(b.salary_item_id || b.id) < BigInt(a.salary_item_id || a.id) ? -1 : 0));
  return { success: true, data: rows.slice(offset, offset + limit), meta: { total: count, total_sum: totalCents / 100, total_paid_sum: paidCents / 100, page, last_page: Math.ceil(count / limit) } };
};
