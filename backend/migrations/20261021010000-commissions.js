module.exports = {
  up: async () => { for (const model of Object.values(require('../models/Commission'))) await model.sync(); },
  down: async () => {} // Preserve financial history on application rollback.
};
