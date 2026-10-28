module.exports = {
  up: async queryInterface => require('../utils/salaryAccountingSchema')(queryInterface.sequelize),
  down: async () => {} // Preserve historical links and accounting records.
};
