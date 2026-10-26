// Run from backend: node scripts/create-demo-package.js
// Plans are global catalog records, intentionally shared by all registering tenants.
const sequelize = require('../config/database');
const Plan = require('../models/Plan');

async function main() {
  sequelize.options.logging = false;
  try {
    await sequelize.authenticate();
    const [plan, created] = await Plan.findOrCreate({
      where: { name: 'demo package' },
      defaults: {
        price_monthly: 0,
        price_yearly: 0,
        max_users: 5,
        max_customers: 100,
        max_documents: 200,
        max_wallet_accounts: 3,
        features: [],
        is_active: true
      }
    });
    if (!plan.is_active) await plan.update({ is_active: true });
    console.log(JSON.stringify({ created, plan: plan.toJSON() }, null, 2));
  } finally {
    await sequelize.close();
  }
}

main().catch(error => {
  console.error('Could not create demo package:', error.message);
  process.exitCode = 1;
});
