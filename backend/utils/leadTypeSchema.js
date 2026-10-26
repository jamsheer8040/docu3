const { DataTypes } = require('sequelize');

module.exports = async function ensureLeadTypeSchema(sequelize) {
  const query = sequelize.getQueryInterface();
  const columns = await query.describeTable('leads');
  // Existing leads retain an unknown type until explicitly classified.
  if (!columns.lead_type) {
    await query.addColumn('leads', 'lead_type', { type: DataTypes.STRING(10), allowNull: true });
  }
};
