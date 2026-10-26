module.exports = {
  up: async queryInterface => require('../utils/leadFollowUpSchema')(queryInterface.sequelize),
  down: async () => {}
};
