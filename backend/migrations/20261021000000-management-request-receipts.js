module.exports = {
  up: async query => require('../models/ManagementRequest').sync({ transaction: undefined }),
  // Financial replay receipts are retained to avoid making old requests payable again.
  down: async () => {}
};
