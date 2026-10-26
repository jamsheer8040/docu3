const { DataTypes: D } = require('sequelize');
module.exports = async sequelize => {
  const qi = sequelize.getQueryInterface();
  const columns = await qi.describeTable('commission_entries');
  const additions = {
    approval_status: { type:D.STRING(20),allowNull:false,defaultValue:'Pending' },
    reviewed_by: { type:D.INTEGER,allowNull:true }, reviewed_at: { type:D.DATE,allowNull:true },
    rejection_reason: { type:D.STRING(500),allowNull:true }, approval_expense_id: { type:D.BIGINT,allowNull:true }
  };
  for (const [name, definition] of Object.entries(additions)) if (!columns[name]) await qi.addColumn('commission_entries',name,definition);
};
