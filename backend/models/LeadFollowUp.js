const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('LeadFollowUp', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.INTEGER, allowNull: false },
  lead_id: { type: DataTypes.INTEGER, allowNull: false },
  channel: { type: DataTypes.ENUM('Call', 'WhatsApp', 'Meeting', 'Email'), allowNull: false },
  occurred_at: { type: DataTypes.DATE, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: false },
  attachment_name: { type: DataTypes.STRING(255), allowNull: true },
  attachment_type: { type: DataTypes.STRING(100), allowNull: true },
  attachment_data: { type: DataTypes.BLOB('medium'), allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: true }
}, { tableName: 'lead_follow_ups', timestamps: true, createdAt: 'created_at', updatedAt: false,
  defaultScope: { attributes: { exclude: ['attachment_data'] } },
  indexes: [{ fields: ['tenant_id', 'lead_id'] }] });
