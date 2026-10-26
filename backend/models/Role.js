const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  dashboard_template_id:{type:DataTypes.INTEGER,allowNull:true},
  permissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      dashboard: { read: true, write: true, delete: true },
      customers: { read: false, write: false, delete: false },
      suppliers: { read: false, write: false, delete: false },
      documents: { read: false, write: false, delete: false },
      services: { read: false, write: false, delete: false },
      invoices: { read: false, write: false, delete: false },
      expenses: { read: false, write: false, delete: false },
      wallet: { read: false, write: false, delete: false },
      reports: { read: false, write: false, delete: false },
      settings: { read: false, write: false, delete: false },
      financials: { read: false, write: false, delete: false },
      management: { read: false, write: false, delete: false },
      tools: { read: false, write: false, delete: false },
      staff: { read: false, write: false, delete: false }
    }
  },
  type: {
    type: DataTypes.ENUM('Internal', 'CustomerPortal'),
    allowNull: false,
    defaultValue: 'Internal'
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'tenants',
      key: 'id'
    }
  }
}, {
  tableName: 'roles',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['name', 'tenant_id']
    }
  ]
});

module.exports = Role;
