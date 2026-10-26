module.exports = { up: async query => require('../utils/leadFollowUpSchema')(query.sequelize), down: async () => {} };
