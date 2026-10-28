const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalaryPayment = sequelize.define('SalaryPayment', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  salary_item_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'salary_items',
      key: 'id'
    }
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  account_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'wallet_accounts',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Bank Transfer'
  },
  transaction_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'wallet_transactions',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reversed_at:{type:DataTypes.DATE,allowNull:true},
  reversed_by_user_id:{type:DataTypes.INTEGER,allowNull:true},
  reversal_reason:{type:DataTypes.TEXT,allowNull:true},
  reversal_transaction_id:{type:DataTypes.INTEGER,allowNull:true}
}, {
  tableName: 'salary_payments',
  timestamps: true,
  underscored: true
});

module.exports = SalaryPayment;
