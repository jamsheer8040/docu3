const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A reusable checklist, not a priced product. Prices are read from the catalog on use.
module.exports = sequelize.define('ServiceBundle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'tenants', key: 'id' } },
  name: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.STRING(1000), allowNull: true },
  items: { type: DataTypes.JSON, allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'service_bundles', underscored: true, timestamps: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'name'] }]
});
