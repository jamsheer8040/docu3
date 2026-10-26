const { DataTypes } = require('sequelize');
module.exports = async function ensureServiceAssignmentSchema(sequelize) {
  const query = sequelize.getQueryInterface();
  const columns = await query.describeTable('service_orders');
  if (!columns.assigned_user_id) await query.addColumn('service_orders', 'assigned_user_id', {
    type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE'
  });
  if (!columns.assigned_at) await query.addColumn('service_orders', 'assigned_at', { type: DataTypes.DATE, allowNull: true });
  if (!columns.completed_by_user_id) await query.addColumn('service_orders', 'completed_by_user_id', { type: DataTypes.INTEGER, allowNull: true });
  await require('../models/ServiceAssignment').sync();
};
