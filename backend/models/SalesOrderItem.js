const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalesOrderItem = sequelize.define('SalesOrderItem', {
  expected_date:{type:DataTypes.DATEONLY,allowNull:true},
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  sales_order_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  service_type_id: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  service_name: {
    type: DataTypes.STRING(250),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  estimated_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  cost: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  service_charge: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  expected_processing_time: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  priority: {
    type: DataTypes.ENUM('Normal', 'Moderate', 'Critical'),
    defaultValue: 'Normal',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Not Started', 'Pending', 'In Progress', 'CompletedInvoicePending', 'CompletedInvoiceCreated', 'Cancelled'),
    defaultValue: 'Not Started',
    allowNull: false
  },
  confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  confirm_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  confirm_attachment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cancelled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  cancel_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  service_order_id: {
    type: DataTypes.BIGINT,
    allowNull: true
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
  tableName: 'sales_order_items',
  timestamps: true,
  underscored: true
});

module.exports = SalesOrderItem;
