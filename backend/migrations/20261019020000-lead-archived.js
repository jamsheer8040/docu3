module.exports = { up: async query => require('../utils/leadArchiveSchema')(query.sequelize), down: async () => {} };
