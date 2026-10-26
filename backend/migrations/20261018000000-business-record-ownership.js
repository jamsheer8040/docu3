'use strict';
module.exports = {
  async up(queryInterface) {
    require('../models');
    await require('../utils/businessOwnership').ensureSchema(queryInterface.sequelize);
  },
  // Keep recorded ownership on rollback; dropping it would erase audit data.
  async down() {}
};
