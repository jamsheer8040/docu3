const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalaryItem = sequelize.define('SalaryItem', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  payroll_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'salary_payrolls',
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
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  basic_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  // Nullable for historical payroll: never infer the basis used by old calculations.
  base_salary: {type:DataTypes.DECIMAL(10,2),allowNull:true},
  master_base_salary: {type:DataTypes.DECIMAL(10,2),allowNull:true},
  days_in_month: {type:DataTypes.INTEGER,allowNull:true},
  calculation_version: {type:DataTypes.INTEGER,allowNull:true},
  override_reason: {type:DataTypes.TEXT,allowNull:true},
  hr_allowance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  other_allowances: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  deductions: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  leave_days: {
    type: DataTypes.DECIMAL(4, 1),
    allowNull: false,
    defaultValue: 0.0
  },
  daily_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  leave_deduction: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  bonus: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  net_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  paid_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('Unpaid', 'Partially Paid', 'Paid'),
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
  }
}, {
  tableName: 'salary_items',
  timestamps: true,
  underscored: true
});

module.exports = SalaryItem;
