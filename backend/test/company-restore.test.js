const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),fs=require('node:fs/promises');
require('dotenv').config();
if(process.env.DB_NAME!=='docclear_regression_test'||process.env.TEST_DATABASE_RESET!=='yes'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw Error('Disposable local database required');
Object.assign(process.env,{NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',DISABLE_CRON:'true'});
const db=require('../models'),app=require('../app'),jwt=require('jsonwebtoken'),mysql=require('mysql2/promise');
const exporter=require('../utils/companyBackup'),restore=require('../utils/companyRestore');
db.sequelize.options.logging=false;
let server,base,admin,otherAdmin,worker,developer,own,foreign,wallet,otherWallet,original,raw;
const recoveries=new Set();
async function backup(){const file=await exporter.createCompanyBackup(1);try{return await fs.readFile(file.filePath);}finally{await file.cleanup();}}
async function call(action,file=original,mode='merge',fields={},actor=admin){
 const body=new FormData();if(file)body.append('backup',new Blob([file],{type:'application/sql'}),'company.sql');body.append('mode',mode);for(const [key,value]of Object.entries(fields))body.append(key,value);
 const response=await fetch(base+'/api/v1/config/backups/company/'+action,{method:'POST',headers:actor?{Authorization:'Bearer '+jwt.sign({id:actor.id},process.env.JWT_SECRET)}:{},body});
 const json=await response.json();if(json.data?.recovery)recoveries.add(json.data.recovery);if(json.recovery)recoveries.add(json.recovery);return {status:response.status,...json};
}
async function validate(file=original,mode='replace'){const result=await call('validate',file,mode);assert.equal(result.status,200,JSON.stringify(result));return result.data;}
async function apply(file=original,mode='replace',preview){preview=preview||await validate(file,mode);return call('import',file,mode,{file_hash:preview.file_hash,state_hash:preview.state_hash,confirmation:mode.toUpperCase()});}
function alter(change){const parsed=restore.parseBackup(original,1);change(parsed.tables);let sql=original.toString().split('\n-- Table:')[0];for(const [name,table]of parsed.tables){sql+=`\n-- Table: ${name}\n${table.ddl}\n`;if(table.rows.length)sql+=`INSERT INTO \`${name}\` (${table.columns.map(field=>'`'+field+'`').join(', ')}) VALUES\n${table.rows.map(row=>'('+table.columns.map(field=>exporter.sqlValue(row[field])).join(', ')+')').join(',\n')};\n`;}return Buffer.from(sql+original.toString().slice(original.toString().lastIndexOf('SET FOREIGN_KEY_CHECKS = @COMPANY_BACKUP_FK;')));}
before(async()=>{
 await db.sequelize.sync({force:true});await db.Tenant.bulkCreate([{id:1,name:'Restore one',slug:'restore-one',status:'active'},{id:2,name:'Restore two',slug:'restore-two',status:'active'}]);
 const roles=await db.Role.bulkCreate([{name:'Admin',tenant_id:1},{name:'Admin',tenant_id:2},{name:'Settings staff',tenant_id:1,permissions:{settings:{read:true,write:true}}},{name:'Developer',tenant_id:null,type:'Internal'}]);
 [admin,otherAdmin,worker,developer]=await db.User.bulkCreate(roles.map((role,i)=>({tenant_id:i===1?2:1,name:'Restore user '+i,role_id:role.id,email:`restore-${i}@example.test`,password_hash:'restore-test-password',is_active:true,can_login:true})));
 own=await db.Customer.create({tenant_id:1,name:'Original customer',phone_whatsapp:'0501111111'});foreign=await db.Customer.create({tenant_id:2,name:'Private foreign customer',phone_whatsapp:'0502222222'});
 wallet=await db.WalletAccount.create({tenant_id:1,name:'Own wallet',balance:'100.10'});otherWallet=await db.WalletAccount.create({tenant_id:2,name:'Other wallet',balance:'80.00'});
 server=await app.start();if(!server.listening)await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
 raw=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
 await raw.query('CREATE TABLE company_restore_probe (id BIGINT PRIMARY KEY,tenant_id INT NOT NULL,payload JSON,note TEXT,binary_data BLOB) ENGINE=InnoDB');
 await raw.execute('INSERT INTO company_restore_probe VALUES (?,?,?,?,?)',['9007199254740993',1,JSON.stringify({name:'مرحبا',nested:['line\n',"quote'",'\\']}),"Testing\nquotes'\\😀",Buffer.from([0,255,1])]);
 original=await backup();
});
after(async()=>{
 if(server)await new Promise(resolve=>server.close(resolve));
 if(raw){await raw.query('DROP TABLE IF EXISTS company_restore_probe');await raw.end();}
 for(const id of recoveries)await fs.unlink(restore.recoveryPath(1,id)).catch(()=>{});
 await db.sequelize.close();
});
test('import validates authentication, company ownership, complete files and exact schema without executing SQL',async()=>{
 assert.equal((await call('validate',original,'replace',{},null)).status,401);
 assert.equal((await call('validate',original,'replace',{},worker)).status,403);
 assert.equal((await call('validate',original,'replace',{},otherAdmin)).status,400);
 assert.equal((await call('validate',Buffer.from('DROP DATABASE docclear_regression_test;'))).status,400);
 assert.equal((await call('validate',original.subarray(0,original.length-30))).status,400);
 assert.equal((await call('validate',Buffer.from(original.toString().replace(exporter.sqlValue('Original customer'),'SLEEP(10)')))).status,400);
 assert.equal((await call('validate',Buffer.from(original.toString().replace('CREATE TABLE `customers`','CREATE TABLE `other_table`')))).status,400);
 assert.equal((await db.Customer.findByPk(own.id)).name,'Original customer');
});
test('merge of an identical backup is idempotent and saves a downloadable company-only recovery snapshot',async()=>{
 const result=await apply(original,'merge');assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.inserted,0);
 const recovery=await fs.readFile(restore.recoveryPath(1,result.data.recovery));assert.equal(restore.parseBackup(recovery,1).tables.get('customers').rows.length,1);
 const get=async user=>fetch(base+'/api/v1/config/backups/company/recovery/'+result.data.recovery,{headers:{Authorization:'Bearer '+jwt.sign({id:user.id},process.env.JWT_SECRET)}});
 assert.equal((await get(admin)).status,200);assert.equal((await get(otherAdmin)).status,404);assert.equal((await get(worker)).status,403);
});
test('validation detects cross-company IDs and forged platform roles or grants',async()=>{
 assert.equal((await call('validate',alter(t=>{t.get('customers').rows[0].tenant_id='2';}))).status,400);
 assert.equal((await call('validate',alter(t=>{t.get('customers').rows[0].id=String(foreign.id);}),'replace')).status,409);
 assert.equal((await call('validate',alter(t=>{t.get('customers').rows[0].assigned_user_id=String(otherAdmin.id);}),'replace')).status,400);
 assert.equal((await call('validate',alter(t=>{t.get('roles').rows.find(row=>String(row.id)===String(worker.role_id)).name='Developer';}),'replace')).status,400);
 assert.equal((await call('validate',alter(t=>{t.get('users').rows.find(row=>String(row.id)===String(worker.id)).role_id=String(developer.role_id);}),'replace')).status,400);
});
test('changed preview data, missing confirmation and changed file hashes cannot apply an import',async()=>{
 const preview=await validate();
 assert.equal((await call('import',original,'replace',{file_hash:preview.file_hash,state_hash:preview.state_hash,confirmation:'WRONG'})).status,400);
 assert.equal((await call('import',original,'replace',{file_hash:'wrong',state_hash:preview.state_hash,confirmation:'REPLACE'})).status,409);
 await own.update({name:'Changed after preview'});
 assert.equal((await apply(original,'replace',preview)).status,409);assert.equal((await db.Customer.findByPk(own.id)).name,'Changed after preview');
 assert.equal((await call('validate',original,'merge')).status,409);
 await own.update({name:'Original customer'});
});
test('replace restores business records and balances, removes newer records and preserves admin, platform access and other companies',async()=>{
 await own.update({name:'Changed customer'});await wallet.update({balance:'666.00'});
 const extra=await db.Customer.create({tenant_id:1,name:'Newer customer',phone_whatsapp:'0503333333'});
 await admin.update({name:'Keep current administrator',password_hash:'keep-admin-password'});await developer.update({name:'Keep platform developer'});await worker.update({name:'Changed staff'});
 await db.Tenant.update({name:'Keep subscription owner',subscription_ends_at:'2030-01-01'},{where:{id:1}});
 const [probeBefore]=await raw.query('SELECT * FROM company_restore_probe');
 const result=await apply();assert.equal(result.status,200,JSON.stringify(result));
 assert.equal((await db.Customer.findByPk(own.id)).name,'Original customer');assert.equal(await db.Customer.findByPk(extra.id),null);
 assert.equal(Number((await db.WalletAccount.findByPk(wallet.id)).balance),100.1);assert.equal(Number((await db.WalletAccount.findByPk(otherWallet.id)).balance),80);
 assert.equal((await db.Customer.findByPk(foreign.id)).name,'Private foreign customer');
 assert.equal((await db.User.findByPk(admin.id)).password_hash,admin.password_hash);assert.equal((await db.User.findByPk(admin.id)).name,'Keep current administrator');
 assert.equal((await db.User.findByPk(developer.id)).name,'Keep platform developer');assert.equal((await db.User.findByPk(worker.id)).name,'Restore user 2');
 assert.equal((await db.Tenant.findByPk(1)).name,'Keep subscription owner');
 const [probeAfter]=await raw.query('SELECT * FROM company_restore_probe');assert.deepEqual(probeAfter,probeBefore);
 const safety=restore.parseBackup(await fs.readFile(restore.recoveryPath(1,result.data.recovery)),1);assert.equal(safety.tables.get('wallet_accounts').rows[0].balance,'666.00');
});
test('merge adds a missing nonconflicting record and preserves existing records',async()=>{
 const extra=await db.Customer.create({tenant_id:1,name:'Merge missing customer',phone_whatsapp:'0504444444'});const source=await backup();await extra.destroy();
 const result=await apply(source,'merge');assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.inserted,1);assert.equal((await db.Customer.findByPk(extra.id)).name,'Merge missing customer');assert.equal((await db.Customer.findByPk(own.id)).name,'Original customer');
});
test('merge refuses to graft payment history onto an existing wallet',async()=>{
 const payment=await db.WalletTransaction.create({tenant_id:1,account_id:wallet.id,type:'Income',direction:'In',amount:1,reference_type:'Manual',description:'Financial merge guard'});
 const source=await backup();await payment.destroy();const result=await call('validate',source,'merge');assert.equal(result.status,409);assert.match(result.message,/financial history/);
});
test('a database failure after deletion rolls back every change and retains a recovery backup',async()=>{
 await own.update({name:'Before failed restore'});await wallet.update({balance:333});const preview=await validate();
 const originalConnect=mysql.createConnection;
 mysql.createConnection=async function(...args){const connection=await originalConnect.apply(this,args),execute=connection.execute.bind(connection);connection.execute=async function(query,...parameters){if(query.startsWith('INSERT INTO `wallet_accounts`'))throw Error('Injected restore failure');return execute(query,...parameters);};return connection;};
 try{
  const result=await apply(original,'replace',preview);assert.equal(result.status,400);assert.ok(result.recovery);
  assert.equal((await db.Customer.findByPk(own.id)).name,'Before failed restore');assert.equal(Number((await db.WalletAccount.findByPk(wallet.id)).balance),333);assert.equal(Number((await db.WalletAccount.findByPk(otherWallet.id)).balance),80);
 }finally{mysql.createConnection=originalConnect;}
});
