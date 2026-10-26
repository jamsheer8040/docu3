const {DataTypes}=require('sequelize');
module.exports=require('../config/database').define('Quotation',{
  id:{type:DataTypes.INTEGER,primaryKey:true,autoIncrement:true},tenant_id:{type:DataTypes.INTEGER,allowNull:false},
  quotation_number:{type:DataTypes.STRING(40),allowNull:false},quotation_date:{type:DataTypes.DATEONLY,allowNull:false},valid_until:{type:DataTypes.DATEONLY,allowNull:true},
  customer_id:{type:DataTypes.INTEGER,allowNull:true},lead_id:{type:DataTypes.INTEGER,allowNull:true},
  recipient_name:{type:DataTypes.STRING(150),allowNull:false},contact_person:{type:DataTypes.STRING(150),allowNull:true},
  email:{type:DataTypes.STRING(100),allowNull:true},phone:{type:DataTypes.STRING(30),allowNull:true},address:{type:DataTypes.TEXT,allowNull:true},
  customer_reference:{type:DataTypes.STRING(150),allowNull:true},branch:{type:DataTypes.STRING(150),allowNull:true},
  status:{type:DataTypes.ENUM('Draft','Sent','Accepted','Declined','Expired'),allowNull:false,defaultValue:'Draft'},sent_at:{type:DataTypes.DATE,allowNull:true},
  items:{type:DataTypes.JSON,allowNull:false,defaultValue:[]},subtotal:{type:DataTypes.DECIMAL(12,2),allowNull:false,defaultValue:0},
  discount:{type:DataTypes.DECIMAL(12,2),allowNull:false,defaultValue:0},tax_rate:{type:DataTypes.DECIMAL(5,2),allowNull:false,defaultValue:0},
  tax_amount:{type:DataTypes.DECIMAL(12,2),allowNull:false,defaultValue:0},total:{type:DataTypes.DECIMAL(12,2),allowNull:false,defaultValue:0},
  bank_details:{type:DataTypes.JSON,allowNull:false,defaultValue:{}},payment_terms:{type:DataTypes.TEXT,allowNull:true},terms:{type:DataTypes.TEXT,allowNull:true},
  notes:{type:DataTypes.TEXT,allowNull:true},internal_remarks:{type:DataTypes.TEXT,allowNull:true},
  template_style:{type:DataTypes.STRING(20),allowNull:false,defaultValue:'classic'},document_footer:{type:DataTypes.TEXT,allowNull:true},
  created_by:{type:DataTypes.INTEGER,allowNull:true},assigned_user_id:{type:DataTypes.INTEGER,allowNull:true}
},{tableName:'quotations',timestamps:true,underscored:true,indexes:[{unique:true,fields:['tenant_id','quotation_number']},{fields:['tenant_id','lead_id']}]});
