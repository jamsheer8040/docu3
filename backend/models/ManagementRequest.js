const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A durable receipt for retried financial requests. Saved in the same transaction
// as the financial records; an unsuccessful request never consumes its key.
module.exports = sequelize.define('ManagementRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  request_key: { type: DataTypes.STRING(80), allowNull: false },
  fingerprint: { type: DataTypes.STRING(64), allowNull: false },
  response: { type: DataTypes.JSON, allowNull: false }
}, {
  tableName: 'management_requests',
  indexes: [{ unique: true, fields: ['tenant_id', 'user_id', 'request_key'] }]
});
