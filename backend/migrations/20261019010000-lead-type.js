module.exports = {
  up: async query => require('../utils/leadTypeSchema')(query.sequelize),
  down: async query => query.removeColumn('leads', 'lead_type')
};
