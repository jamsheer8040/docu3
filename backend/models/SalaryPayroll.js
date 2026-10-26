const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalaryPayroll = sequelize.define('SalaryPayroll', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  month: {
    type: DataTypes.STRING(7), // Format: 'YYYY-MM' e.g. '2026-09'
    allowNull: false
  },
  booking_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  total_amount: {
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
    type: DataTypes.ENUM('Booked', 'Partially Paid', 'Paid'),
    defaultValue: 'Booked',
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'salary_payrolls',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['tenant_id', 'month']
    }
  ]
});

module.exports = SalaryPayroll;
