module.exports = {
  up: async queryInterface => require('../utils/salesOrderPricingSchema')(queryInterface.sequelize),
  down: async () => { throw new Error('Retain saved sales order discounts and VAT rates; no destructive rollback.'); }
};
