const { DataTypes } = require('sequelize');

// Idempotent, additive upgrade. Retain legacy outcome values and all old records.
module.exports = async function ensureLeadFollowUpSchema(sequelize) {
  const query = sequelize.getQueryInterface();
  const followUpColumns = await query.describeTable('lead_follow_ups');
  for (const [name, type] of Object.entries({ attachment_name: DataTypes.STRING(255), attachment_type: DataTypes.STRING(100), attachment_data: DataTypes.BLOB('medium') })) {
    if (!followUpColumns[name]) await query.addColumn('lead_follow_ups', name, { type, allowNull: true });
  }
  const columns = await query.describeTable('leads');
  if (!columns.follow_up_scheduled_at) await query.addColumn('leads', 'follow_up_scheduled_at', { type: DataTypes.DATE, allowNull: true });
  if (!columns.next_follow_up_date) {
    await query.addColumn('leads', 'next_follow_up_date', { type: DataTypes.DATEONLY, allowNull: true });
  }
  if (!columns.status.type.includes('Follow-up')) {
    await query.changeColumn('leads', 'status', {
      type: DataTypes.ENUM('New', 'Contacted', 'Qualified', 'Lost', 'Won', 'Follow-up'),
      allowNull: false, defaultValue: 'New'
    });
  }
};
