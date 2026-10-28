const {DataTypes}=require('sequelize');
module.exports=async sequelize=>{
  const qi=sequelize.getQueryInterface(),columns=await qi.describeTable('salary_items');
  const fields={base_salary:DataTypes.DECIMAL(10,2),master_base_salary:DataTypes.DECIMAL(10,2),days_in_month:DataTypes.INTEGER,calculation_version:DataTypes.INTEGER,override_reason:DataTypes.TEXT};
  for(const [name,type]of Object.entries(fields))if(!columns[name])await qi.addColumn('salary_items',name,{type,allowNull:true});
};
