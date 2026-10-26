module.exports = { up: async queryInterface => require('../utils/commissionApprovalSchema')(queryInterface.sequelize), down: async () => {} };
