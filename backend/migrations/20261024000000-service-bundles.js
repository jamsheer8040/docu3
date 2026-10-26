// Additive only: existing documents and service prices are unaffected.
module.exports = { up: async () => require('../models/ServiceBundle').sync(), down: async () => {} };
