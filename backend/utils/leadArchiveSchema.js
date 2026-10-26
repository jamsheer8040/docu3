const { DataTypes } = require('sequelize');
module.exports = async function ensureLeadArchiveSchema(sequelize) {
  const query = sequelize.getQueryInterface();
  const columns = await query.describeTable('leads');
  if (!columns.archive_reason) await query.addColumn('leads', 'archive_reason', { type: DataTypes.TEXT, allowNull: true });
  if (!columns.status.type.includes('Archived')) {
    await query.changeColumn('leads', 'status', {
      type: DataTypes.ENUM('New', 'Contacted', 'Qualified', 'Lost', 'Won', 'Follow-up', 'Archived'),
      allowNull: false, defaultValue: 'New'
    });
  }
  const history = await query.describeTable('lead_status_histories');
  if (!history.archive_reason) await query.addColumn('lead_status_histories', 'archive_reason', { type: DataTypes.TEXT, allowNull: true });
};
