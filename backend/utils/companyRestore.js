const mysql = require('mysql2/promise');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { tableScope, sqlValue } = require('./companyBackup');
const { BACKUP_DIR } = require('./backup.util');
const quote = name => '`' + String(name).replace(/`/g,'``') + '`';
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const footer = "SET FOREIGN_KEY_CHECKS = @COMPANY_BACKUP_FK;\nSET SQL_MODE = @COMPANY_BACKUP_MODE;\nSET time_zone = @COMPANY_BACKUP_TIMEZONE;\n-- End of company backup";
const recoveryPattern = /^restore-safety-[a-f0-9-]{36}\.sql$/;
const financialParents = new Set(['wallet_accounts','invoices','expenses','salary_payrolls','salary_items','commission_entries','supplier_purchases','dividend_declarations','dividend_distributions']);
const connectionConfig = () => ({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASS||'',database:process.env.DB_NAME||'docclear_db',charset:'utf8mb4',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});

// This is a data parser for our export format, never a SQL execution facility.
function parseValues(text,count) {
  let position=0;const rows=[];
  const space=()=>{while(/\s/.test(text[position]||'')&&position<text.length)position++;};
  const take=character=>{space();if(text[position++]!==character)fail('Invalid backup value syntax.');};
  while(position<text.length){
    take('(');const row=[];
    for(let index=0;index<count;index++){
      space();const match=/^(NULL|CONVERT\(X'([a-f0-9]*)' USING utf8mb4\)|X'([a-f0-9]*)'|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i.exec(text.slice(position));
      if(!match)fail('Backup contains unsupported SQL expressions.');
      position+=match[0].length;
      if((match[2]?.length||match[3]?.length||0)%2)fail('Invalid backup hexadecimal data.');
      row.push(match[1].toUpperCase()==='NULL'?null:match[2]!==undefined?new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(match[2],'hex')):match[3]!==undefined?Buffer.from(match[3],'hex'):match[1]);
      if(index<count-1)take(',');
    }
    take(')');rows.push(row);space();if(position===text.length)break;take(',');
  }
  return rows;
}
function parseBackup(buffer,tenantId){
  if(!buffer?.length||buffer.length>25*1024*1024)fail('Choose a company SQL backup up to 25 MB.');
  let sql;try{sql=new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/\r\n/g,'\n').trim();}catch{fail('The backup must be valid UTF-8 SQL.');}
  if(!sql.startsWith('-- DocClear company database backup\n')||!sql.endsWith(footer))fail('Choose a complete SQL file downloaded from Company Database Backup.');
  if(sql.match(/^-- Company ID: (\d+)$/m)?.[1]!==String(tenantId))fail('This backup belongs to a different company.');
  const sections=sql.slice(0,-footer.length).trim().split(/\n-- Table: ([A-Za-z0-9_]+)\n/);const tables=new Map();
  for(let index=1;index<sections.length;index+=2){
    const name=sections[index],body=sections[index+1].trim();if(tables.has(name))fail('Duplicate backup table.');
    const start=body.indexOf('\nINSERT INTO '),ddl=start<0?body:body.slice(0,start).trim();
    let data=start<0?'':body.slice(start).trim();const columns=[],rows=[];
    while(data){
      const match=/^INSERT INTO `([A-Za-z0-9_]+)` \(([^\n]+)\) VALUES\n([\s\S]*?);(?:\s|$)/.exec(data);
      if(!match||match[1]!==name)fail('Invalid backup table data.');
      const fields=match[2].split(', ').map(field=>{const found=/^`([A-Za-z0-9_]+)`$/.exec(field);if(!found)fail('Invalid backup column.');return found[1];});
      if(columns.length&&columns.join()!==fields.join())fail('Inconsistent backup columns.');
      if(!columns.length)columns.push(...fields);
      rows.push(...parseValues(match[3],fields.length).map(values=>Object.fromEntries(fields.map((field,i)=>[field,values[i]]))));
      data=data.slice(match[0].length).trim();
    }
    tables.set(name,{ddl,columns,rows});
  }
  if(!tables.size)fail('The backup contains no company tables.');
  return {tables,hash:crypto.createHash('sha256').update(buffer).digest('hex')};
}
async function schema(connection){
  const [tables]=await connection.query("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  const [columns]=await connection.query('SELECT TABLE_NAME AS name,COLUMN_NAME AS field,DATA_TYPE AS type,COLUMN_KEY AS columnKey,EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION');
  const [references]=await connection.query('SELECT TABLE_NAME AS child,COLUMN_NAME AS field,REFERENCED_TABLE_NAME AS parent,REFERENCED_COLUMN_NAME AS parentField FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
  for(const table of tables){
    if(table.engine!=='InnoDB')fail('Import requires transactional InnoDB tables.');
    table.columns=columns.filter(column=>column.name===table.name);table.fields=table.columns.filter(column=>!/VIRTUAL GENERATED|STORED GENERATED/.test(column.extra)).map(column=>column.field);
    table.primary=table.columns.filter(column=>column.columnKey==='PRI').map(column=>column.field);
    if(!table.primary.length)fail('Import requires tables with primary keys.');
    const [create]=await connection.query('SHOW CREATE TABLE '+quote(table.name));
    table.ddl=`DROP TABLE IF EXISTS ${quote(table.name)};\n${create[0]['Create Table'].replace(/\sAUTO_INCREMENT=\d+/g,'')};`;
  }
  return {tables,references};
}
const identity=(table,row)=>JSON.stringify(table.primary.map(field=>String(row[field])));
const same=(table,a,b)=>table.fields.filter(field=>!['createdAt','updatedAt','created_at','updated_at'].includes(field)).every(field=>{
  const left=a[field],right=b[field];if(left==null||right==null)return left==null&&right==null;
  if(Buffer.isBuffer(left)||Buffer.isBuffer(right))return Buffer.isBuffer(left)&&Buffer.isBuffer(right)&&left.equals(right);
  if(table.columns.find(column=>column.field===field)?.type==='json'){
    const normalize=value=>{if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));return value;};
    try{return JSON.stringify(normalize(typeof left==='string'?JSON.parse(left):left))===JSON.stringify(normalize(typeof right==='string'?JSON.parse(right):right));}catch{return false;}
  }
  return String(left)===String(right);
});
const retainedTables=new Set(['tenants','plans','promo_codes','SequelizeMeta','sequelizemeta']);
const isRetainedTable=table=>retainedTables.has(table);
function protectedRecords(current,operator){
  const roleIds=new Set((current.get('roles')||[]).filter(row=>row.tenant_id==null||row.name?.toLowerCase()==='developer'||String(row.id)===String(operator.role_id)).map(row=>String(row.id)));
  const developerRoles=new Set((current.get('roles')||[]).filter(row=>row.name?.toLowerCase()==='developer').map(row=>String(row.id)));
  const userIds=new Set((current.get('users')||[]).filter(row=>developerRoles.has(String(row.role_id))||String(row.id)===String(operator.id)).map(row=>String(row.id)));
  return {roleIds,userIds,developerRoles,has:(name,row)=>isRetainedTable(name)||(name==='roles'&&roleIds.has(String(row.id)))||(name==='users'&&userIds.has(String(row.id)))};
}
async function prepare(connection,backup,tenantId,operator,mode,lock=false){
  if(!['replace','merge'].includes(mode))fail('Choose Replace or Merge.');
  const info=await schema(connection),current=new Map(),incoming=new Map();
  if(info.tables.length!==backup.tables.size)fail('The backup schema differs from this application version.');
  for(const table of info.tables){
    const source=backup.tables.get(table.name);if(!source||source.ddl.trim()!==table.ddl.trim()||(source.rows.length&&source.columns.join()!==table.fields.join()))fail('The backup schema differs from this application version: '+table.name+'.');
    const scope=tableScope(table.name,table.fields,tenantId);
    const [rows]=await connection.execute(`SELECT t.* FROM ${quote(table.name)} t WHERE ${scope.where} ORDER BY ${table.primary.map(field=>'t.'+quote(field)).join(', ')}${lock?' FOR UPDATE':''}`,scope.params);
    current.set(table.name,rows);incoming.set(table.name,source.rows);
  }
  const preserve=protectedRecords(current,operator),final=new Map(),inserts=new Map(),summary={inserted:0,replaced:0,unchanged:0,removed:0};
  const sourceIndex=(name,field,value)=>incoming.get(name)?.some(row=>String(row[field])===String(value));
  for(const table of info.tables){
    const existing=current.get(table.name),rows=incoming.get(table.name),old=new Map(existing.map(row=>[identity(table,row),row]));
    const result=new Map((mode==='merge'||isRetainedTable(table.name)?existing:existing.filter(row=>preserve.has(table.name,row))).map(row=>[identity(table,row),row]));
    const addition=[];const seen=new Set();
    for(const row of rows){
      const key=identity(table,row);if(seen.has(key))fail('Duplicate backup record in '+table.name+'.');seen.add(key);
      if(table.fields.includes('tenant_id')&&!(table.name==='roles'&&row.tenant_id==null)&&String(row.tenant_id)!==String(tenantId))fail('Backup records must belong to this company.');
      if(table.name==='tenants'&&String(row.id)!==String(tenantId))fail('The backup contains another company.');
      if(table.name==='user_customers'&&(!sourceIndex('users','id',row.user_id)||!sourceIndex('customers','id',row.customer_id)))fail('A customer link crosses the company boundary.');
      if(table.name==='lead_status_histories'&&!sourceIndex('leads','id',row.lead_id))fail('A lead history crosses the company boundary.');
      if(table.name==='service_type_pricings'&&!sourceIndex('service_types','id',row.service_type_id))fail('A service price crosses the company boundary.');
      if(table.name==='roles'&&row.name?.toLowerCase()==='developer'&&!preserve.developerRoles.has(String(row.id)))fail('Platform roles cannot be imported.');
      if(table.name==='users'&&preserve.developerRoles.has(String(row.role_id))&&!preserve.userIds.has(String(row.id)))fail('Platform access cannot be granted through import.');
      if(isRetainedTable(table.name)||preserve.has(table.name,row)){summary.unchanged++;continue;}
      if(table.name==='roles'&&row.tenant_id==null)fail('Shared platform roles cannot be created by company import.');
      if(mode==='merge'&&old.has(key)){
        if(!same(table,old.get(key),row))fail('Merge conflict in '+table.name+'. Existing records differ; use Replace to restore this snapshot.',409);
        summary.unchanged++;continue;
      }
      result.set(key,row);addition.push(row);if(old.has(key))summary.replaced++;else summary.inserted++;
    }
    // Check global primary-key ownership without exposing other companies' rows.
    for(let offset=0;offset<addition.length;offset+=100){
      const group=addition.slice(offset,offset+100),parameters=group.flatMap(row=>table.primary.map(field=>row[field]));
      const where=group.map(()=> '('+table.primary.map(field=>quote(field)+' = ?').join(' AND ')+')').join(' OR ');
      const [matches]=await connection.execute(`SELECT ${table.primary.map(quote).join(', ')} FROM ${quote(table.name)} WHERE ${where}`,parameters);
      if(matches.some(row=>!old.has(identity(table,row))))fail('Backup record IDs conflict with records outside this company. No changes were applied.',409);
    }
    final.set(table.name,[...result.values()]);inserts.set(table.name,addition);
    if(mode==='replace'&&!isRetainedTable(table.name))summary.removed+=existing.filter(row=>!preserve.has(table.name,row)&&!result.has(identity(table,row))).length;
  }
  // Validate the entire resulting company graph while foreign-key checks remain ON.
  for(const reference of info.references){
    if(isRetainedTable(reference.child))continue;
    const parentKeys=new Set((final.get(reference.parent)||[]).map(row=>String(row[reference.parentField])));
    for(const row of final.get(reference.child)||[]){
      if(row[reference.field]!=null&&!parentKeys.has(String(row[reference.field])))fail('The backup has a missing or inaccessible reference in '+reference.child+'.');
    }
    if(mode==='merge'&&financialParents.has(reference.parent)){
      const existingKeys=new Set((current.get(reference.parent)||[]).map(row=>String(row[reference.parentField])));
      if((inserts.get(reference.child)||[]).some(row=>row[reference.field]!=null&&existingKeys.has(String(row[reference.field]))))fail('Merge cannot attach new financial history to existing financial records. Use Replace for a complete financial snapshot.',409);
    }
    if(mode==='replace'){
      const removed=(current.get(reference.parent)||[]).filter(row=>!parentKeys.has(String(row[reference.parentField]))).map(row=>row[reference.parentField]);
      if(removed.length){
        const childTable=info.tables.find(table=>table.name===reference.child),scope=tableScope(reference.child,childTable.fields,tenantId);
        for(let offset=0;offset<removed.length;offset+=100){
          const group=removed.slice(offset,offset+100);
          const [outside]=await connection.execute(`SELECT 1 FROM ${quote(reference.child)} t WHERE t.${quote(reference.field)} IN (${group.map(()=>'?').join(',')}) AND NOT COALESCE((${scope.where}), FALSE) LIMIT 1`,[...group,...scope.params]);
          if(outside.length)fail('Other company records depend on records this restore would remove. No changes were applied.',409);
        }
      }
    }
  }
  // Ownership/assignment columns added by older releases may lack SQL FKs.
  const companyUsers=new Set((final.get('users')||[]).map(row=>String(row.id)));
  for(const table of info.tables){
    if(isRetainedTable(table.name))continue;
    const actorFields=['created_by','assigned_user_id','sales_executive_id','completed_by_user_id'].filter(field=>table.fields.includes(field));
    for(const row of final.get(table.name)||[])for(const field of actorFields)if(row[field]!=null&&!companyUsers.has(String(row[field])))fail('The backup contains a missing or inaccessible staff assignment in '+table.name+'.');
  }
  const stateHash=crypto.createHash('sha256').update(JSON.stringify([...current])).digest('hex');
  return {info,current,inserts,final,preserve,summary,stateHash};
}
async function open(tenantId){
  const connection=await mysql.createConnection(connectionConfig());
  await connection.query("SET time_zone = '+00:00'");await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await connection.beginTransaction();
  const [tenant]=await connection.execute('SELECT id FROM tenants WHERE id = ? FOR UPDATE',[tenantId]);
  if(!tenant.length){await connection.end();fail('Company not found.',404);}return connection;
}
function recoveryPath(tenantId,id){
  if(!Number.isSafeInteger(Number(tenantId))||Number(tenantId)<=0||!recoveryPattern.test(id))fail('Recovery backup not found.',404);
  return path.join(BACKUP_DIR,'companies',String(tenantId),id);
}
async function saveRecovery(tenantId,state){
  const id=`restore-safety-${crypto.randomUUID()}.sql`,filePath=recoveryPath(tenantId,id);await fs.mkdir(path.dirname(filePath),{recursive:true,mode:0o700});
  const temporary=filePath+'.partial',file=await fs.open(temporary,'wx',0o600);
  try{
    await file.writeFile(`-- DocClear company database backup\n-- Company ID: ${tenantId}\n-- Generated: ${new Date().toISOString()}\n-- Automatic pre-import recovery backup\nSET @COMPANY_BACKUP_FK = @@FOREIGN_KEY_CHECKS;\nSET @COMPANY_BACKUP_MODE = @@SQL_MODE;\nSET @COMPANY_BACKUP_TIMEZONE = @@TIME_ZONE;\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\nSET time_zone = '+00:00';\nSET NAMES utf8mb4;\n`);
    for(const table of state.info.tables){
      await file.writeFile(`\n-- Table: ${table.name}\n${table.ddl}\n`);
      const rows=state.current.get(table.name);
      for(let offset=0;offset<rows.length;offset+=100)await file.writeFile(`INSERT INTO ${quote(table.name)} (${table.fields.map(quote).join(', ')}) VALUES\n${rows.slice(offset,offset+100).map(row=>'('+table.fields.map(field=>sqlValue(row[field])).join(', ')+')').join(',\n')};\n`);
    }
    await file.writeFile(footer+'\n');
    await file.close();await fs.rename(temporary,filePath);
  }catch(error){await file.close().catch(()=>{});await fs.unlink(temporary).catch(()=>{});throw error;}
  return id;
}
async function preview(buffer,tenantId,operator,mode){
  const backup=parseBackup(buffer,tenantId),connection=await open(tenantId);
  try{const state=await prepare(connection,backup,tenantId,operator,mode);return {...state.summary,file_hash:backup.hash,state_hash:state.stateHash,mode};}
  finally{await connection.rollback();await connection.end();}
}
async function restore(buffer,tenantId,operator,{mode,file_hash,state_hash,confirmation}){
  if(confirmation!==mode?.toUpperCase())fail('Confirm the selected import mode.');
  const backup=parseBackup(buffer,tenantId);if(backup.hash!==file_hash)fail('The backup file changed. Validate it again.',409);
  const connection=await open(tenantId);let recovery;
  try{
    const state=await prepare(connection,backup,tenantId,operator,mode,true);
    if(state.stateHash!==state_hash)fail('Company data changed after validation. Validate the backup again.',409);
    recovery=await saveRecovery(tenantId,state);
    await connection.query("SET SESSION sql_mode = CONCAT_WS(',', @@sql_mode, 'NO_AUTO_VALUE_ON_ZERO')");
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    if(mode==='replace')for(const table of state.info.tables){
      if(isRetainedTable(table.name))continue;
      const scope=tableScope(table.name,table.fields,tenantId),protectedRows=state.current.get(table.name).filter(row=>state.preserve.has(table.name,row));
      const exclusions=protectedRows.map(()=> '('+table.primary.map(field=>'t.'+quote(field)+' = ?').join(' AND ')+')').join(' OR ');
      await connection.execute(`DELETE t FROM ${quote(table.name)} t WHERE ${scope.where}${exclusions?' AND NOT ('+exclusions+')':''}`,[...scope.params,...protectedRows.flatMap(row=>table.primary.map(field=>row[field]))]);
    }
    for(const table of state.info.tables){
      const rows=state.inserts.get(table.name)||[];
      for(let offset=0;offset<rows.length;offset+=100){
        const group=rows.slice(offset,offset+100);
        await connection.execute(`INSERT INTO ${quote(table.name)} (${table.fields.map(quote).join(', ')}) VALUES ${group.map(()=> '('+table.fields.map(()=>'?').join(', ')+')').join(', ')}`,group.flatMap(row=>table.fields.map(field=>row[field])));
      }
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');await connection.commit();
    return {...state.summary,recovery,mode};
  }catch(error){
    await connection.rollback();
    if(['ER_DUP_ENTRY','ER_NO_REFERENCED_ROW_2','ER_ROW_IS_REFERENCED_2'].includes(error.code)){error=Object.assign(new Error('Conflicting database values. No changes were applied.'),{status:409});}
    if(recovery)error.recovery=recovery;throw error;
  }finally{await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(()=>{});await connection.end();}
}
module.exports={preview,restore,parseBackup,recoveryPath,recoveryPattern};
