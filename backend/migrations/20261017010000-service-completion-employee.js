module.exports = {
  up: async query => require('../utils/serviceAssignmentSchema')(query.sequelize),
  down: async () => {}
};
