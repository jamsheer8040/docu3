module.exports = {
  up: async queryInterface => require('../utils/leadFollowUpSchema')(queryInterface.sequelize),
  // Keep additive fields and legacy values on rollback to preserve user data.
  down: async () => {}
};
