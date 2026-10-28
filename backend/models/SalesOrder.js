const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalesOrder = sequelize.define('SalesOrder', {
  source_quotation_id:{type:DataTypes.INTEGER,allowNull:true},lead_id:{type:DataTypes.INTEGER,allowNull:true},recipient_snapshot:{type:DataTypes.JSON,allowNull:true},
  confirmation_status:{type:DataTypes.ENUM('Unconfirmed','Confirmed','Cancelled'),allowNull:false,defaultValue:'Confirmed'},
  notes:{type:DataTypes.TEXT,allowNull:true},template_style:{type:DataTypes.STRING(20),allowNull:true},document_footer:{type:DataTypes.TEXT,allowNull:true},
  discount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  tax_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: null },
  bank_details: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
  payment_terms: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
  terms: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  order_number: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  order_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  contact_person: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  sales_executive_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  branch: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  customer_reference: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  internal_remarks: {
    type: DataTypes.TEXT,
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
  tableName: 'sales_orders',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['customer_id'] },
    { unique: true, fields: ['order_number', 'tenant_id'] }
  ]
});

module.exports = SalesOrder;
