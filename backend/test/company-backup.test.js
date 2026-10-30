const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mysql = require('mysql2/promise');
require('dotenv').config();
if (process.env.DB_NAME !== 'docclear_regression_test' || process.env.TEST_DATABASE_RESET !== 'yes' || !['localhost','127.0.0.1'].includes(process.env.DB_HOST)) throw Error('Disposable local database required');
Object.assign(process.env, { NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '0', DISABLE_CRON: 'true' });
const db = require('../models'), app = require('../app'), jwt = require('jsonwebtoken');
const { createCompanyBackup, tableScope, sqlValue } = require('../utils/companyBackup');
db.sequelize.options.logging = false;
const restoreDatabase = 'docclear_regression_test';
let server, base, admin, otherAdmin, worker, portal, raw, tenantOneLead, ownType;
const sqlConfig = () => ({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', multipleStatements: true, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, charset: 'utf8mb4' });
async function request(user, url = '/config/backups/company', method = 'POST', body = {}) {
  return fetch(base + '/api/v1' + url, { method, headers: { ...(user ? { Authorization: 'Bearer ' + jwt.sign({ id: user.id }, process.env.JWT_SECRET) } : {}), 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) });
}
before(async () => {
  await db.sequelize.sync({ force: true });
  await db.Plan.bulkCreate([{ id: 1, name: 'Own plan' }, { id: 2, name: 'Foreign plan' }]);
  await db.Tenant.bulkCreate([{ id: 1, name: 'Backup company', slug: 'backup-one', status: 'active', plan_id: 1 }, { id: 2, name: 'Foreign company', slug: 'backup-two', status: 'active', plan_id: 2 }]);
  const roles = await db.Role.bulkCreate([{ name: 'Admin', tenant_id: 1 }, { name: 'Admin', tenant_id: 2 }, { name: 'Backup settings staff', tenant_id: 1, permissions: { settings: { read: true, write: true } } }, { name: 'Admin', type: 'CustomerPortal', tenant_id: null }, { name: 'Own shared role', tenant_id: null }, { name: 'Foreign shared role', tenant_id: null }]);
  [admin, otherAdmin, worker, portal] = await db.User.bulkCreate(roles.slice(0,4).map((role,index) => ({ name: 'Backup actor ' + index, tenant_id: index === 1 ? 2 : 1, role_id: role.id, email: `backup-${index}@example.test`, password_hash: 'disposable-backup-password' })));
  await db.User.bulkCreate([{ name: 'Own shared user', tenant_id: 1, role_id: roles[4].id }, { name: 'Foreign shared user', tenant_id: 2, role_id: roles[5].id }]);
  const customers = await db.Customer.bulkCreate(Array.from({ length: 205 }, (_,index) => ({ tenant_id: 1, name: 'Own customer ' + index, phone_whatsapp: String(index) })));
  const foreign = await db.Customer.create({ tenant_id: 2, name: 'OTHER_COMPANY_PRIVATE_CUSTOMER', phone_whatsapp: '0509999999' });
  await db.UserCustomer.bulkCreate([{ user_id: admin.id, customer_id: customers[0].id }, { user_id: otherAdmin.id, customer_id: foreign.id }, { user_id: admin.id, customer_id: foreign.id }, { user_id: otherAdmin.id, customer_id: customers[0].id }]);
  tenantOneLead = await db.Lead.create({ tenant_id: 1, name: 'Own lead', company_name: 'Own lead company', phone: '0501111111' });
  const foreignLead = await db.Lead.create({ tenant_id: 2, name: 'Foreign lead', company_name: 'Foreign lead company', phone: '0502222222' });
  await db.LeadStatusHistory.bulkCreate([{ lead_id: tenantOneLead.id, new_status: 'New' }, { lead_id: foreignLead.id, new_status: 'New' }]);
  ownType = await db.ServiceType.create({ tenant_id: 1, name: 'Own service' });
  const foreignType = await db.ServiceType.create({ tenant_id: 2, name: 'Foreign service' });
  await db.ServiceTypePricing.bulkCreate([{ service_type_id: ownType.id, selling_price: 25 }, { service_type_id: foreignType.id, selling_price: 75 }]);
  await db.WalletAccount.bulkCreate([{ tenant_id: 1, name: 'Own balance', balance: '1234.56' }, { tenant_id: 2, name: 'OTHER_COMPANY_PRIVATE_WALLET', balance: '9876.54' }]);
  raw = await mysql.createConnection({ ...sqlConfig(), database: process.env.DB_NAME });
  await raw.query('CREATE TABLE company_backup_fixtures (id BIGINT PRIMARY KEY, tenant_id INT NOT NULL, amount DECIMAL(20,2), payload JSON, note TEXT, binary_data BLOB, precise_date DATETIME(6), doubled DECIMAL(21,2) GENERATED ALWAYS AS (amount * 2) STORED) ENGINE=InnoDB');
  await raw.execute('INSERT INTO company_backup_fixtures (id,tenant_id,amount,payload,note,binary_data,precise_date) VALUES (?,?,?,?,?,?,?)', ['9007199254740993',1,'1234567890123.45',JSON.stringify({ name: 'مرحبا', nested: ['quote\'', '\\path', '\n'] }), "Owner's note\n\\path\0😀",Buffer.from([0,1,255]),'2026-10-29 01:02:03.123456']);
  await raw.execute('INSERT INTO company_backup_fixtures (id,tenant_id,note) VALUES (?,?,?)', ['9007199254740994',2,'OTHER_COMPANY_PRIVATE_FIXTURE']);
  server = await app.start(); if (!server.listening) await once(server,'listening');
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (raw) {
    await raw.query('DROP TABLE IF EXISTS company_backup_fixtures');
    await raw.end();
  }
  await db.sequelize.close();
});

test('company download requires an internal company Admin and legacy global backups are platform-only', async () => {
  assert.equal((await request(null)).status,401);
  for (const actor of [worker, portal]) assert.equal((await request(actor)).status,403);
  for (const [url,method] of [['/config/backups','GET'],['/config/backups/create','POST'],['/config/backups/download/anything.sql','GET'],['/config/backups/anything.sql','DELETE']]) assert.equal((await request(admin,url,method)).status,403);
});

async function restoreCompanyBackup() {
  const before = await db.WalletAccount.sum('balance',{ where:{tenant_id:1} });
  const response = await request(admin, undefined, 'POST', { tenant_id: 2 });
  assert.equal(response.status,200,await response.clone().text());
  assert.match(response.headers.get('content-disposition'), /attachment; filename="company-1-backup-.*\.sql"/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const dump = await response.text();
  assert.match(dump,/-- End of company backup/);
  assert.ok(!dump.includes(sqlValue('OTHER_COMPANY_PRIVATE_CUSTOMER')));
  assert.ok(!dump.includes(sqlValue('OTHER_COMPANY_PRIVATE_FIXTURE')));
  const [source] = await raw.query('SELECT * FROM company_backup_fixtures WHERE tenant_id = 1');
  assert.equal(await db.WalletAccount.sum('balance',{where:{tenant_id:1}}),before,'Export must not change balances');
  const restored = await mysql.createConnection({ ...sqlConfig(), database: restoreDatabase });
  try {
    await restored.query(dump);
    const [customers] = await restored.query('SELECT COUNT(*) AS total FROM customers');assert.equal(Number(customers[0].total),205);
    const [tenants] = await restored.query('SELECT id FROM tenants');assert.deepEqual(tenants.map(row=>Number(row.id)),[1]);
    const [plans] = await restored.query('SELECT id FROM plans');assert.deepEqual(plans.map(row=>Number(row.id)),[1]);
    const [links] = await restored.query('SELECT * FROM user_customers');assert.equal(links.length,1);assert.equal(Number(links[0].user_id),Number(admin.id));
    const [history] = await restored.query('SELECT * FROM lead_status_histories');assert.equal(history.length,1);assert.equal(Number(history[0].lead_id),Number(tenantOneLead.id));
    const [pricing] = await restored.query('SELECT * FROM service_type_pricings');assert.equal(pricing.length,1);assert.equal(String(pricing[0].service_type_id),String(ownType.id));
    const [roles] = await restored.query('SELECT name FROM roles');assert.ok(roles.some(row=>row.name==='Own shared role'));assert.ok(!roles.some(row=>row.name==='Foreign shared role'));
    const [wallets] = await restored.query('SELECT balance FROM wallet_accounts');assert.equal(wallets.length,1);assert.equal(wallets[0].balance,'1234.56');
    const [roundtrip] = await restored.query('SELECT * FROM company_backup_fixtures');
    assert.deepEqual(roundtrip,source,'BIGINT, decimals, JSON, Unicode, binary and microseconds must round-trip');
  } finally { await restored.end(); }
  assert.equal(await db.WalletAccount.sum('balance',{where:{tenant_id:1}}),before,'Export must not change the live balances');
}

test('a second company receives only its own records and temporary backup files are removed', async () => {
  const response = await request(otherAdmin);assert.equal(response.status,200);
  const dump = await response.text();assert.ok(dump.includes(sqlValue('OTHER_COMPANY_PRIVATE_CUSTOMER')));assert.ok(!dump.includes(sqlValue('Own customer 0')));
  const backup = await createCompanyBackup(1);
  const fs = require('node:fs/promises');
  assert.ok((await fs.stat(backup.filePath)).size > 0);
  await backup.cleanup();await assert.rejects(()=>fs.stat(backup.filePath),{code:'ENOENT'});
});

test('unknown unscoped tables fail closed instead of leaking data or silently omitting company records', () => {
  assert.throws(()=>tableScope('unknown_history',['id','owner_id'],1),/ownership is not configured/);
  assert.deepEqual(tableScope('future_company_table',['id','tenant_id'],7),{where:'t.tenant_id = ?',params:[7]});
});

// Last: restore only the guarded disposable DB after all multi-company checks.
test('download restores exact company data and indirect ownership while excluding other companies', restoreCompanyBackup);
