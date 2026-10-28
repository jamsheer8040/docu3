module.exports = {
  up: async queryInterface => require('../utils/salesOrderDocumentSchema')(queryInterface.sequelize),
  down: async () => { throw new Error('Retain historical sales order bank details and terms; no destructive rollback.'); }
};
