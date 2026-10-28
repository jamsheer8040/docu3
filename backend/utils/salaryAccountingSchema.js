const { DataTypes } = require('sequelize');
module.exports = async sequelize => {
  const qi = sequelize.getQueryInterface();
  for (const [table, field] of [['salary_payrolls', 'expense_id'], ['expenses', 'salary_payroll_id']]) {
    const columns = await qi.describeTable(table);
    if (!columns[field]) await qi.addColumn(table, field, { type: DataTypes.BIGINT, allowNull: true });
  }
  const indexes = await qi.showIndex('expenses');
  if (!indexes.some(index => index.name === 'salary_expense_per_payroll')) {
    await qi.addIndex('expenses', ['tenant_id', 'salary_payroll_id'], { name: 'salary_expense_per_payroll', unique: true });
  }
};
