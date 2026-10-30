const mysql = require('mysql2/promise');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const identifier = value => '`' + String(value).replace(/`/g, '``') + '`';
function sqlValue(value) {
  if (value == null) return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw Error('Cannot export a non-finite database value.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `CONVERT(X'${Buffer.from(text, 'utf8').toString('hex')}' USING utf8mb4)`;
}

// Tables without tenant_id require explicit ownership through a company parent.
// New unscoped tables fail closed until their ownership is defined here.
function tableScope(table, columns, tenantId) {
  if (table === 'tenants') return { where: 't.id = ?', params: [tenantId] };
  if (table === 'roles') return { where: '(t.tenant_id = ? OR (t.tenant_id IS NULL AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = ? AND u.role_id = t.id)))', params: [tenantId, tenantId] };
  if (columns.includes('tenant_id')) return { where: 't.tenant_id = ?', params: [tenantId] };
  if (table === 'plans') return { where: 'EXISTS (SELECT 1 FROM tenants p WHERE p.id = ? AND p.plan_id = t.id)', params: [tenantId] };
  if (table === 'lead_status_histories') return { where: 'EXISTS (SELECT 1 FROM leads p WHERE p.id = t.lead_id AND p.tenant_id = ?)', params: [tenantId] };
  if (table === 'service_type_pricings') return { where: 'EXISTS (SELECT 1 FROM service_types p WHERE p.id = t.service_type_id AND p.tenant_id = ?)', params: [tenantId] };
  if (table === 'user_customers') return { where: 'EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id AND u.tenant_id = ?) AND EXISTS (SELECT 1 FROM customers c WHERE c.id = t.customer_id AND c.tenant_id = ?)', params: [tenantId, tenantId] };
  if (table.toLowerCase() === 'sequelizemeta') return { where: '1 = 1', params: [] };
  if (table === 'promo_codes') return { where: '1 = 0', params: [] }; // Platform catalogue; not company-owned.
  throw Error(`Backup ownership is not configured for table ${table}.`);
}

async function createCompanyBackup(tenantId, { signal } = {}) {
  if (!Number.isSafeInteger(Number(tenantId)) || Number(tenantId) <= 0) throw Error('A valid company is required.');
  tenantId = Number(tenantId);
  const tempRoot = path.resolve(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(tempRoot, 'docclear-company-backup-'));
  const filename = `company-${tenantId}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  const filePath = path.join(directory, filename);
  const cleanup = () => {
    if (path.dirname(path.resolve(directory)) !== tempRoot || !path.basename(directory).startsWith('docclear-company-backup-')) throw Error('Invalid backup cleanup directory.');
    return fs.rm(directory, { recursive: true, force: true });
  };
  let connection, file;
  const check = () => { if (signal?.aborted) throw Error('Backup download cancelled.'); };
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: process.env.DB_NAME || 'docclear_db',
      charset: 'utf8mb4', supportBigNumbers: true, bigNumberStrings: true, dateStrings: true
    });
    await connection.query("SET time_zone = '+00:00'");
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [tenant] = await connection.execute('SELECT id FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant.length) throw Error('Company not found.');
    const [tables] = await connection.query("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
    const [metadata] = await connection.query('SELECT TABLE_NAME AS name, COLUMN_NAME AS columnName, COLUMN_KEY AS columnKey, EXTRA AS extra, ORDINAL_POSITION AS position FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION');
    file = await fs.open(filePath, 'wx', 0o600);
    const write = async text => { check(); await file.writeFile(text + '\n'); };
    await write(`-- DocClear company database backup\n-- Company ID: ${tenantId}\n-- Generated: ${new Date().toISOString()}\n-- Restore into a separate, empty MySQL database. Uploaded files are not included.\n-- Company-owned records only; no other company's records are exported.\nSET @COMPANY_BACKUP_FK = @@FOREIGN_KEY_CHECKS;\nSET @COMPANY_BACKUP_MODE = @@SQL_MODE;\nSET @COMPANY_BACKUP_TIMEZONE = @@TIME_ZONE;\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\nSET time_zone = '+00:00';\nSET NAMES utf8mb4;`);
    for (const table of tables) {
      check();
      if (table.engine !== 'InnoDB') throw Error(`A consistent company backup requires InnoDB: ${table.name}.`);
      const columns = metadata.filter(row => row.name === table.name);
      const insertColumns = columns.filter(row => !/VIRTUAL GENERATED|STORED GENERATED/i.test(row.extra)).map(row => row.columnName);
      const scope = tableScope(table.name, columns.map(row => row.columnName), tenantId);
      const [create] = await connection.query(`SHOW CREATE TABLE ${identifier(table.name)}`);
      await write(`\n-- Table: ${table.name.replace(/[\r\n]/g, '')}\nDROP TABLE IF EXISTS ${identifier(table.name)};\n${create[0]['Create Table'].replace(/\sAUTO_INCREMENT=\d+/g, '')};`);
      // Bounded batches from one snapshot, ordered by the complete primary key.
      const select = insertColumns.map(column => 't.' + identifier(column)).join(', ');
      const primary = columns.filter(column => column.columnKey === 'PRI').map(column => 't.' + identifier(column.columnName)).join(', ');
      if (!primary) throw Error(`A stable backup requires a primary key: ${table.name}.`);
      for (let offset = 0; ; offset += 100) {
        check();
        const [rows] = await connection.execute(`SELECT ${select} FROM ${identifier(table.name)} t WHERE ${scope.where} ORDER BY ${primary} LIMIT 100 OFFSET ${offset}`, scope.params);
        if (!rows.length) break;
        const values = rows.map(row => '(' + insertColumns.map(column => sqlValue(row[column])).join(', ') + ')');
        await write(`INSERT INTO ${identifier(table.name)} (${insertColumns.map(identifier).join(', ')}) VALUES\n${values.join(',\n')};`);
        if (rows.length < 100) break;
      }
    }
    await write('SET FOREIGN_KEY_CHECKS = @COMPANY_BACKUP_FK;\nSET SQL_MODE = @COMPANY_BACKUP_MODE;\nSET time_zone = @COMPANY_BACKUP_TIMEZONE;\n-- End of company backup');
    await connection.commit();
    await file.close(); file = null;
    await connection.end(); connection = null;
    return { filename, filePath, cleanup };
  } catch (error) {
    if (connection) { await connection.rollback().catch(() => {}); await connection.end().catch(() => {}); }
    if (file) await file.close().catch(() => {});
    await cleanup(); throw error;
  }
}
module.exports = { createCompanyBackup, tableScope, sqlValue };
