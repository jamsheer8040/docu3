const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  expense_sub_type_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'expense_sub_types',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  paid_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('Paid', 'Unpaid', 'Partially Paid'),
    defaultValue: 'Unpaid',
    allowNull: false
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  account_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'wallet_accounts',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Retained even if an unpaid payroll is unbooked, to protect its reversal history.
  salary_payroll_id: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  }
}, {
  tableName: 'expenses',
  timestamps: true,
  underscored: true
});

module.exports = Expense;
