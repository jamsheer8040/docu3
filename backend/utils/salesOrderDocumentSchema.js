const { DataTypes } = require('sequelize');
module.exports = async sequelize => {
  const qi = sequelize.getQueryInterface(), columns = await qi.describeTable('sales_orders');
  for (const [field, type] of [['bank_details', DataTypes.JSON], ['payment_terms', DataTypes.TEXT], ['terms', DataTypes.TEXT]]) {
    if (!columns[field]) await qi.addColumn('sales_orders', field, { type, allowNull: true });
  }
};
