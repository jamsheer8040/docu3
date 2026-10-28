const { DataTypes } = require('sequelize');
module.exports = async sequelize => {
  const qi = sequelize.getQueryInterface(), columns = await qi.describeTable('sales_orders');
  if (!columns.discount) await qi.addColumn('sales_orders', 'discount', { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 });
  // Null keeps historical orders on the existing active-tax fallback until edited.
  if (!columns.tax_rate) await qi.addColumn('sales_orders', 'tax_rate', { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: null });
};
