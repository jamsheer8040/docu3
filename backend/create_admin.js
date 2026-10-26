require('dotenv').config();
const { sequelize, User, Role, Tenant } = require('./models');

async function createAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const tenantId = Number(process.env.BOOTSTRAP_TENANT_ID);
  if (!email || !password || password.length < 16 || !Number.isSafeInteger(tenantId) || tenantId <= 0) {
    throw new Error('Supply BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (16+ characters), and BOOTSTRAP_TENANT_ID');
  }
  await sequelize.transaction(async transaction => {
    const tenant = await Tenant.findOne({ where: { id: tenantId }, transaction });
    if (!tenant) throw new Error('Bootstrap organization does not exist');
    const existing = await User.findOne({ where: { email }, transaction });
    if (existing) throw new Error('Account already exists; use account management to change it');
    const [role] = await Role.findOrCreate({ where: { name: 'Admin', tenant_id: tenantId }, transaction });
    await User.create({ name: 'System Administrator', email, password_hash: password,
      role_id: role.id, tenant_id: tenantId, is_active: true, can_login: true }, { transaction });
  });
  console.log('Administrator created. Credentials were not logged.');
}

if (require.main === module) {
  createAdmin().catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => sequelize.close());
}
module.exports = { createAdmin };
