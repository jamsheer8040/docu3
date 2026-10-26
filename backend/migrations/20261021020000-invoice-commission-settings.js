module.exports = {
  up: async () => require('../models/Commission').CommissionInvoiceSetting.sync(),
  down: async () => {} // Retain invoice commission decisions and audit history.
};
