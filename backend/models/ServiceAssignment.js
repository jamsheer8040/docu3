const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('ServiceAssignment', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.INTEGER, allowNull: false },
  service_order_id: { type: DataTypes.BIGINT, allowNull: false },
  from_user_id: { type: DataTypes.INTEGER, allowNull: true },
  to_user_id: { type: DataTypes.INTEGER, allowNull: true },
  actor_id: { type: DataTypes.INTEGER, allowNull: true },
  from_name: { type: DataTypes.STRING(100), allowNull: true },
  to_name: { type: DataTypes.STRING(100), allowNull: true },
  actor_name: { type: DataTypes.STRING(100), allowNull: true },
  reason: { type: DataTypes.STRING(30), allowNull: false }
}, { tableName: 'service_assignments', underscored: true, indexes: [{ fields: ['tenant_id', 'service_order_id'] }] });
