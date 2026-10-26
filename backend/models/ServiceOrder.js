const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServiceOrder = sequelize.define('ServiceOrder', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  service_type_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Assigned', 'In Progress', 'Waiting for Customer', 'On Hold', 'Completed', 'Cancelled', 'CompletedInvoicePending', 'CompletedInvoiceCreated'),
    defaultValue: 'Pending',
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assigned_user_id: { type: DataTypes.INTEGER, allowNull: true },
  assigned_at: { type: DataTypes.DATE, allowNull: true },
  completed_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  criticality: {
    type: DataTypes.ENUM('Normal', 'Moderate', 'Critical'),
    defaultValue: 'Normal',
    allowNull: false
  },
  initial_criticality: {
    type: DataTypes.ENUM('Normal', 'Moderate', 'Critical'),
    defaultValue: 'Normal',
    allowNull: false
  },
  reminder_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  is_cost_deducted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  cost_type: {
    type: DataTypes.ENUM('Wallet', 'Supplier'),
    allowNull: true
  },
  cost_supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'suppliers',
      key: 'id'
    }
  },
  invoice_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'invoices',
      key: 'id'
    }
  },
  requires_follow_up: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  is_follow_up_done: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  }
}, {
  tableName: 'service_orders',
  timestamps: true,
  underscored: true
});

module.exports = ServiceOrder;
