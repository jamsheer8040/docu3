const {DataTypes}=require('sequelize');
module.exports=async sequelize=>{
  const qi=sequelize.getQueryInterface(),columns=await qi.describeTable('salary_payments');
  const fields={reversed_at:DataTypes.DATE,reversed_by_user_id:DataTypes.INTEGER,reversal_reason:DataTypes.TEXT,reversal_transaction_id:DataTypes.INTEGER};
  for(const [field,type]of Object.entries(fields))if(!columns[field])await qi.addColumn('salary_payments',field,{type,allowNull:true});
};
