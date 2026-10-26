const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LeadStatusHistory = sequelize.define('LeadStatusHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lead_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  previous_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  new_status: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  changed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  archive_reason: { type: DataTypes.TEXT, allowNull: true },
  update_source: {
    type: DataTypes.ENUM('Kanban', 'List', 'Details', 'System'),
    allowNull: false,
    defaultValue: 'System'
  }
}, {
  tableName: 'lead_status_histories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = LeadStatusHistory;
