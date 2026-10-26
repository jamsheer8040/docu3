const { DataTypes } = require('sequelize');
module.exports = require('../config/database').define('DashboardTemplate', {
  id:{type:DataTypes.INTEGER,primaryKey:true,autoIncrement:true},
  tenant_id:{type:DataTypes.INTEGER,allowNull:false},
  name:{type:DataTypes.STRING(100),allowNull:false},
  description:{type:DataTypes.STRING(500),allowNull:true},
  widgets:{type:DataTypes.JSON,allowNull:false,defaultValue:[]},
  record_scope:{type:DataTypes.ENUM('accessible','assigned'),allowNull:false,defaultValue:'accessible'}
},{tableName:'dashboard_templates',timestamps:true,indexes:[{unique:true,fields:['tenant_id','name']}]});
