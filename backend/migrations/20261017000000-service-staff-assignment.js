module.exports = {
  up: async query => require('../utils/serviceAssignmentSchema')(query.sequelize),
  // Keep assignment records on rollback to preserve operational history.
  down: async () => {}
};
