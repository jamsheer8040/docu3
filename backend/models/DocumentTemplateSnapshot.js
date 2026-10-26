const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('DocumentTemplateSnapshot', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'tenants', key: 'id' } },
  document_group: { type: DataTypes.STRING(20), allowNull: false },
  record_id: { type: DataTypes.BIGINT, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  defaults: { type: DataTypes.JSON, allowNull: false },
  footer: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'document_template_snapshots', timestamps: true, underscored: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'document_group', 'record_id'] }]
});
