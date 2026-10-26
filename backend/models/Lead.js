const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  company_name: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  lead_type: {
    type: DataTypes.STRING(10),
    allowNull: true,
    validate: { isIn: [['Person', 'Company']] }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('New', 'Contacted', 'Qualified', 'Lost', 'Won', 'Follow-up', 'Archived'),
    allowNull: false,
    defaultValue: 'New'
  },
  source: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  archive_reason: { type: DataTypes.TEXT, allowNull: true },
  next_follow_up_date: { type: DataTypes.DATEONLY, allowNull: true },
  follow_up_scheduled_at: { type: DataTypes.DATE, allowNull: true },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  service_id: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  converted_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  converted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  whatsapp_clicks: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'leads',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Lead;
