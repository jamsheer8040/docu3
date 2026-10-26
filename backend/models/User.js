const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    validate: {
      isEmailOrNull(val) {
        if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          throw new Error('Must be a valid email address');
        }
      }
    }
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  can_login: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id'
    }
  },

  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  home_country_address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  home_country_contact: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  home_country_alternate_contact: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  designation: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  joining_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  basic_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
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
  total_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
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
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash && !user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash') && user.password_hash && !user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
      }
    }
  }
});

// Instance method to check password
User.prototype.validatePassword = async function(password) {
  if (!this.can_login || !this.password_hash) return false;
  return await bcrypt.compare(password, this.password_hash);
};

module.exports = User;
