module.exports = async sequelize => {
  const query=sequelize.getQueryInterface();
  const columns=await query.describeTable('roles');
  if(!columns.dashboard_template_id)await query.addColumn('roles','dashboard_template_id',{type:require('sequelize').DataTypes.INTEGER,allowNull:true});
  await require('../models/DashboardTemplate').sync();
};
