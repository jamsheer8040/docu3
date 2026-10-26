const expectations={
  "ownership update exceeds 100%": {
    "http": 400,
    "total": 100
  },
  "negative ownership accepted": {
    "http": 400
  },
  "inactive shareholder rejected by active cap": {
    "http": 201
  },
  "concurrent shareholder creation exceeds cap": {
    "total": 60
  },
  "ownership history survives failed edit": {
    "http": 400,
    "saved_percentage": "40.00",
    "audit_rows": 0
  },
  "scoped ownership validation ignores hidden holders": {
    "http": 400,
    "total": 100
  },
  "foreign shareholder capital accepted": {
    "http": 404,
    "rows": 0
  },
  "foreign wallet capital saved without posting": {
    "http": 404,
    "capital_rows": 0,
    "wallet_rows": 0
  },
  "negative contribution leaves invalid capital after wallet rejection": {
    "http": 400,
    "balance": "1000.00",
    "capital_amount": 0
  },
  "adjustment ignored in totals and wallet": {
    "http": 400,
    "total_received": 0,
    "wallet_rows": 0
  },
  "capital remains after wallet permission failure": {
    "http": 403,
    "capital_rows": 0,
    "wallet_rows": 0
  },
  "concurrent contributions lose balance update": {
    "http": [
      201,
      201
    ],
    "balance": "1300.00",
    "ledger_amount": 300
  },
  "dividend exceeds declared profit": {
    "http": 400
  },
  "negative dividend payment leaves invalid paid amount after rejection": {
    "http": 400,
    "balance": "1000.00",
    "paid_amount": "0.00",
    "payment_rows": 0
  },
  "cancelled declaration can be paid": {
    "http": 400,
    "declaration_status": "Cancelled"
  },
  "concurrent dividend payments exceed allocation": {
    "payment_sum": 75,
    "cached_paid": "75.00",
    "wallet_balance": "925.00"
  },
  "dividend rounding loses cents": {
    "http": 201,
    "declared": 1,
    "allocated": 1
  },
  "dividend without owners accepted": {
    "http": 400,
    "distribution_rows": 0
  },
  "payment remains after wallet permission failure": {
    "http": 403,
    "payment_rows": 0,
    "paid_amount": "0.00",
    "declaration_status": "Declared",
    "wallet_rows": 0
  },
  "invalid capital setup silently becomes zero": {
    "http": 400,
    "proposed_capital": 60000
  },
  "underallocated declaration incorrectly becomes fully paid": {
    "http": 409,
    "status": "Declared",
    "payments": 0
  },
  "list-only shareholder view exposes private details": {
    "http": 200,
    "identity_exposed": false,
    "bank_exposed": false,
    "ownership_visible": false,
    "capital_visible": false
  },
  "edit response exposes fields denied by detail permission": {
    "http": 200,
    "identity_exposed": false,
    "bank_exposed": false
  }
};
const fs=require('node:fs'),path=require('node:path');
const req=require('node:module').createRequire(path.resolve(__dirname,'../package.json'));
req('dotenv').config();
if(process.env.DB_NAME!=='docclear_regression_test' || process.env.TEST_DATABASE_RESET!=='yes' || !['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw new Error('Disposable local regression database required');
process.env.NODE_ENV='test';process.env.HOST='127.0.0.1';process.env.PORT='0';process.env.DISABLE_CRON='true';
const db=req('./models'),app=req('./app'),jwt=req('jsonwebtoken');db.sequelize.options.logging=false;
const assert=require('node:assert/strict');
const {test}=require('node:test');
let base,server,sequence=0,suite;
async function call(user,url,method='GET',body,extraHeaders={}){const response=await fetch(base+'/api/v1'+url,{method,headers:{...extraHeaders,Authorization:'Bearer '+jwt.sign({id:user.id},process.env.JWT_SECRET,{expiresIn:'15m'}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
async function group(percentages=[100]){const id=++sequence;const tenant=await db.Tenant.create({name:'Audit '+id,slug:'audit-'+id,status:'active'});const role=await db.Role.create({tenant_id:tenant.id,name:'Admin'});const user=await db.User.create({name:'Audit admin '+id,email:`management-audit-${id}@example.test`,tenant_id:tenant.id,role_id:role.id});const wallet=await db.WalletAccount.create({tenant_id:tenant.id,name:'Audit wallet',balance:1000});await db.SystemConfig.create({tenant_id:tenant.id,key:'proposed_company_capital',value:'60000'});const owners=[];for(const [index,ownership_percentage]of percentages.entries())owners.push(await db.Shareholder.create({tenant_id:tenant.id,name:'Owner '+index,ownership_percentage,status:'Active',created_by:user.id}));return {tenant,user,wallet,owners};}
async function scoped(g){const rules={list:'all',detail:'all',edit:'all',delete:'none',create:true};const role=await db.Role.create({tenant_id:g.tenant.id,name:'Audit limited',permissions:req('./utils/permissionRules').normalizePermissions({management:{rules},wallet:{rules:{...rules,edit:'none',create:false}}})});return db.User.create({tenant_id:g.tenant.id,name:'Limited '+sequence,email:`management-limited-${sequence}@example.test`,role_id:role.id});}
async function dividend(g,amount=100,status='Declared'){const declaration=await db.DividendDeclaration.create({tenant_id:g.tenant.id,financial_year:'2026',total_profit:1000,dividend_amount:amount,declaration_date:'2026-10-21',status,created_by:g.user.id});const distribution=await db.DividendDistribution.create({tenant_id:g.tenant.id,declaration_id:declaration.id,shareholder_id:g.owners[0].id,ownership_percentage:100,allocated_amount:amount,paid_amount:0});return {declaration,distribution};}
async function scenario(name,run){await suite.test(name,async()=>{const result=await run();const expected=expectations[name];assert.ok(expected,'Missing expected result: '+name);for(const [key,value]of Object.entries(expected))assert.deepEqual(result[key],value,name+': '+key);});}
test('Management financial invariants (disposable database)', async t=>{suite=t;try{
await db.sequelize.sync({force:true});await db.Tenant.create({id:1,name:'Audit bootstrap',slug:'audit-bootstrap',status:'active'});server=await app.start();if(!server.listening)await require('node:events').once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
await scenario('ownership update exceeds 100%',async()=>{const g=await group([50,50]);const response=await call(g.user,`/management/shareholders/${g.owners[0].id}`,'PUT',{ownership_percentage:90});return {http:response.status,total:Number(await db.Shareholder.sum('ownership_percentage',{where:{tenant_id:g.tenant.id,status:'Active'}}))};});
await scenario('negative ownership accepted',async()=>{const g=await group([50]);const response=await call(g.user,'/management/shareholders','POST',{name:'Negative owner',ownership_percentage:-10,status:'Active'});return {http:response.status,percentage:response.body.data?.ownership_percentage};});
await scenario('inactive shareholder rejected by active cap',async()=>{const g=await group([100]);const response=await call(g.user,'/management/shareholders','POST',{name:'Inactive owner',ownership_percentage:20,status:'Inactive'});return {http:response.status,message:response.body.message};});
await scenario('concurrent shareholder creation exceeds cap',async()=>{const g=await group([]);const responses=await Promise.all([1,2].map(index=>call(g.user,'/management/shareholders','POST',{name:'Parallel '+index,ownership_percentage:60,status:'Active'})));return {http:responses.map(row=>row.status),total:Number(await db.Shareholder.sum('ownership_percentage',{where:{tenant_id:g.tenant.id}}))};});
await scenario('ownership history survives failed edit',async()=>{const g=await group([40,40]);const response=await call(g.user,`/management/shareholders/${g.owners[0].id}`,'PUT',{name:null,ownership_percentage:50});await g.owners[0].reload();return {http:response.status,saved_percentage:g.owners[0].ownership_percentage,audit_rows:await db.OwnershipChange.count({where:{tenant_id:g.tenant.id}})};});
await scenario('scoped ownership validation ignores hidden holders',async()=>{const g=await group([100]);const role=await db.Role.create({tenant_id:g.tenant.id,name:'Own creator',permissions:req('./utils/permissionRules').normalizePermissions({management:{rules:{list:'created',detail:'created',edit:'created',delete:'none',create:true}}})});const user=await db.User.create({tenant_id:g.tenant.id,name:'Own creator',role_id:role.id});const response=await call(user,'/management/shareholders','POST',{name:'Extra owner',ownership_percentage:40,status:'Active'});return {http:response.status,total:Number(await db.Shareholder.sum('ownership_percentage',{where:{tenant_id:g.tenant.id}}))};});
await scenario('foreign shareholder capital accepted',async()=>{const g=await group(),foreign=await group();const response=await call(g.user,'/management/capital-transactions','POST',{shareholder_id:foreign.owners[0].id,type:'Contribution',amount:100,date:'2026-10-21'});return {http:response.status,rows:await db.CapitalTransaction.count({where:{tenant_id:g.tenant.id,shareholder_id:foreign.owners[0].id}})};});
await scenario('foreign wallet capital saved without posting',async()=>{const g=await group(),foreign=await group();const response=await call(g.user,'/management/capital-transactions','POST',{shareholder_id:g.owners[0].id,type:'Contribution',amount:100,date:'2026-10-21',wallet_id:foreign.wallet.id});return {http:response.status,capital_rows:await db.CapitalTransaction.count({where:{tenant_id:g.tenant.id}}),wallet_rows:await db.WalletTransaction.count({where:{tenant_id:g.tenant.id}})};});
await scenario('negative contribution leaves invalid capital after wallet rejection',async()=>{const g=await group();const response=await call(g.user,'/management/capital-transactions','POST',{shareholder_id:g.owners[0].id,type:'Contribution',amount:-100,date:'2026-10-21',wallet_id:g.wallet.id});await g.wallet.reload();return {http:response.status,balance:g.wallet.balance,capital_amount:Number(await db.CapitalTransaction.sum('amount',{where:{tenant_id:g.tenant.id}}))};});
await scenario('adjustment ignored in totals and wallet',async()=>{const g=await group();const response=await call(g.user,'/management/capital-transactions','POST',{shareholder_id:g.owners[0].id,type:'Adjustment',amount:100,date:'2026-10-21',wallet_id:g.wallet.id});const overview=await call(g.user,'/management/dashboard');return {http:response.status,total_received:overview.body.data?.total_received,wallet_rows:await db.WalletTransaction.count({where:{tenant_id:g.tenant.id}})};});
await scenario('capital remains after wallet permission failure',async()=>{const g=await group(),user=await scoped(g);const response=await call(user,'/management/capital-transactions','POST',{shareholder_id:g.owners[0].id,type:'Contribution',amount:100,date:'2026-10-21',wallet_id:g.wallet.id});return {http:response.status,capital_rows:await db.CapitalTransaction.count({where:{tenant_id:g.tenant.id}}),wallet_rows:await db.WalletTransaction.count({where:{tenant_id:g.tenant.id}})};});
await scenario('concurrent contributions lose balance update',async()=>{const g=await group();const responses=await Promise.all([100,200].map(amount=>call(g.user,'/management/capital-transactions','POST',{shareholder_id:g.owners[0].id,type:'Contribution',amount,date:'2026-10-21',wallet_id:g.wallet.id})));await g.wallet.reload();return {http:responses.map(row=>row.status),balance:g.wallet.balance,expected_balance:1300,ledger_amount:Number(await db.WalletTransaction.sum('amount',{where:{tenant_id:g.tenant.id}}))};});
await scenario('dividend exceeds declared profit',async()=>{const g=await group();const response=await call(g.user,'/management/dividends','POST',{financial_year:'2026',total_profit:10,dividend_amount:100,declaration_date:'2026-10-21'});return {http:response.status,declared:response.body.data?.dividend_amount};});
await scenario('negative dividend payment leaves invalid paid amount after rejection',async()=>{const g=await group(),d=await dividend(g);const response=await call(g.user,'/management/dividends/pay','POST',{distribution_id:d.distribution.id,amount:-10,date:'2026-10-21',wallet_id:g.wallet.id});await g.wallet.reload();await d.distribution.reload();return {http:response.status,balance:g.wallet.balance,paid_amount:d.distribution.paid_amount,payment_rows:await db.DividendPayment.count({where:{distribution_id:d.distribution.id}})};});
await scenario('cancelled declaration can be paid',async()=>{const g=await group(),d=await dividend(g,100,'Cancelled');const response=await call(g.user,'/management/dividends/pay','POST',{distribution_id:d.distribution.id,amount:10,date:'2026-10-21'});await d.declaration.reload();return {http:response.status,declaration_status:d.declaration.status};});
await scenario('concurrent dividend payments exceed allocation',async()=>{const g=await group(),d=await dividend(g);const responses=await Promise.all([1,2].map(()=>call(g.user,'/management/dividends/pay','POST',{distribution_id:d.distribution.id,amount:75,date:'2026-10-21',wallet_id:g.wallet.id})));await d.distribution.reload();await g.wallet.reload();return {http:responses.map(row=>row.status),payment_sum:Number(await db.DividendPayment.sum('amount',{where:{distribution_id:d.distribution.id}})),allocated:100,cached_paid:d.distribution.paid_amount,wallet_balance:g.wallet.balance};});
await scenario('dividend rounding loses cents',async()=>{const g=await group([33.33,33.33,33.34]);const response=await call(g.user,'/management/dividends','POST',{financial_year:'2026',total_profit:10,dividend_amount:1,declaration_date:'2026-10-21'});return {http:response.status,declared:1,allocated:Number(await db.DividendDistribution.sum('allocated_amount',{where:{tenant_id:g.tenant.id}}))};});
await scenario('dividend without owners accepted',async()=>{const g=await group([]);const response=await call(g.user,'/management/dividends','POST',{financial_year:'2026',total_profit:100,dividend_amount:100,declaration_date:'2026-10-21'});return {http:response.status,distribution_rows:await db.DividendDistribution.count({where:{tenant_id:g.tenant.id}})};});
await scenario('payment remains after wallet permission failure',async()=>{const g=await group(),user=await scoped(g),d=await dividend(g);const response=await call(user,'/management/dividends/pay','POST',{distribution_id:d.distribution.id,amount:100,date:'2026-10-21',wallet_id:g.wallet.id});await d.distribution.reload();await d.declaration.reload();return {http:response.status,payment_rows:await db.DividendPayment.count({where:{distribution_id:d.distribution.id}}),paid_amount:d.distribution.paid_amount,declaration_status:d.declaration.status,wallet_rows:await db.WalletTransaction.count({where:{tenant_id:g.tenant.id}})};});
await scenario('invalid capital setup silently becomes zero',async()=>{const g=await group();const response=await call(g.user,'/config','PUT',{proposed_company_capital:'not-a-number'});const overview=await call(g.user,'/management/dashboard');return {http:response.status,proposed_capital:overview.body.data?.proposed_capital};});
await scenario('underallocated declaration incorrectly becomes fully paid',async()=>{const g=await group([90]),d=await dividend(g);await d.distribution.update({allocated_amount:90});const response=await call(g.user,'/management/dividends/pay','POST',{distribution_id:d.distribution.id,amount:90,date:'2026-10-21'});await d.declaration.reload();return {http:response.status,status:d.declaration.status,payments:await db.DividendPayment.count({where:{tenant_id:g.tenant.id}})};});
await scenario('list-only shareholder view exposes private details',async()=>{const g=await group();await g.owners[0].update({identity_number:'AUDIT-LIST-PRIVATE',bank_details:{account:'AUDIT-LIST-ACCOUNT'}});const role=await db.Role.create({tenant_id:g.tenant.id,name:'List only',permissions:req('./utils/permissionRules').normalizePermissions({management:{rules:{list:'all',detail:'none',edit:'none',delete:'none',create:false}}})});const user=await db.User.create({tenant_id:g.tenant.id,name:'Reader',role_id:role.id});const response=await call(user,'/management/shareholders');return {http:response.status,keys:Object.keys(response.body.data[0]),ownership_visible:response.body.data[0].ownership_percentage!==undefined,capital_visible:response.body.data[0].required_capital!==undefined,identity_exposed:response.body.data[0].identity_number==='AUDIT-LIST-PRIVATE',bank_exposed:response.body.data[0].bank_details?.account==='AUDIT-LIST-ACCOUNT'};});
await scenario('edit response exposes fields denied by detail permission',async()=>{const g=await group();await g.owners[0].update({identity_number:'AUDIT-PRIVATE',bank_details:{account:'AUDIT-ACCOUNT'}});const role=await db.Role.create({tenant_id:g.tenant.id,name:'Editor no details',permissions:req('./utils/permissionRules').normalizePermissions({management:{rules:{list:'all',detail:'none',edit:'all',delete:'none',create:false}}})});const user=await db.User.create({tenant_id:g.tenant.id,name:'Editor',role_id:role.id});const response=await call(user,`/management/shareholders/${g.owners[0].id}`,'PUT',{name:'Changed name'});return {http:response.status,identity_exposed:response.body.data?.identity_number==='AUDIT-PRIVATE',bank_exposed:!!response.body.data?.bank_details};});

await suite.test('request receipts prevent concurrent replay and reject changed payloads',async()=>{
 const g=await group();const payload={shareholder_id:g.owners[0].id,type:'Contribution',amount:100,date:'2026-10-21',wallet_id:g.wallet.id};const headers={'Idempotency-Key':'replay-capital-0001'};
 const responses=await Promise.all([call(g.user,'/management/capital-transactions','POST',payload,headers),call(g.user,'/management/capital-transactions','POST',payload,headers)]);
 assert.deepEqual(responses.map(r=>r.status),[201,201]);assert.equal(responses[0].body.data.id,responses[1].body.data.id);
 assert.equal(await db.CapitalTransaction.count({where:{tenant_id:g.tenant.id}}),1);await g.wallet.reload();assert.equal(Number(g.wallet.balance),1100);
 assert.equal((await call(g.user,'/management/capital-transactions','POST',{...payload,amount:200},headers)).status,409);
});
await suite.test('ledger failure rolls back capital, payout, cached totals and request receipt',async()=>{
 const g=await group(),d=await dividend(g);db.WalletTransaction.addHook('beforeCreate','managementFailure',()=>{throw new Error('Injected ledger failure');});
 try {
  const capital={shareholder_id:g.owners[0].id,type:'Contribution',amount:100,date:'2026-10-21',wallet_id:g.wallet.id};
  assert.equal((await call(g.user,'/management/capital-transactions','POST',capital,{'Idempotency-Key':'rollback-capital-01'})).status,500);
  const payout={distribution_id:d.distribution.id,amount:100,date:'2026-10-21',wallet_id:g.wallet.id};
  assert.equal((await call(g.user,'/management/dividends/pay','POST',payout,{'Idempotency-Key':'rollback-payment-01'})).status,500);
  assert.equal(await db.CapitalTransaction.count({where:{tenant_id:g.tenant.id}}),0);assert.equal(await db.DividendPayment.count({where:{tenant_id:g.tenant.id}}),0);assert.equal(await db.ManagementRequest.count({where:{tenant_id:g.tenant.id}}),0);
  await d.distribution.reload();await d.declaration.reload();await g.wallet.reload();assert.equal(Number(d.distribution.paid_amount),0);assert.equal(d.declaration.status,'Declared');assert.equal(Number(g.wallet.balance),1000);
 }finally{db.WalletTransaction.removeHook('beforeCreate','managementFailure');}
});
await suite.test('declaration failure rolls back all distributions',async()=>{
 const g=await group([50,50]);let created=0;db.DividendDistribution.addHook('beforeCreate','managementFailure',()=>{if(++created===2)throw new Error('Injected allocation failure');});
 try{assert.equal((await call(g.user,'/management/dividends','POST',{financial_year:'2026',total_profit:100,dividend_amount:100,declaration_date:'2026-10-21'})).status,500);assert.equal(await db.DividendDeclaration.count({where:{tenant_id:g.tenant.id}}),0);assert.equal(await db.DividendDistribution.count({where:{tenant_id:g.tenant.id}}),0);}finally{db.DividendDistribution.removeHook('beforeCreate','managementFailure');}
});
await suite.test('edit-only ownership changes save their audit together',async()=>{
 const g=await group([50]);const role=await db.Role.create({tenant_id:g.tenant.id,name:'Edit only',permissions:req('./utils/permissionRules').normalizePermissions({management:{rules:{list:'all',detail:'all',edit:'all',delete:'none',create:false}}})});const user=await db.User.create({tenant_id:g.tenant.id,name:'Editor',role_id:role.id});
 assert.equal((await call(user,'/management/shareholders/'+g.owners[0].id,'PUT',{ownership_percentage:60})).status,200);assert.equal(await db.OwnershipChange.count({where:{tenant_id:g.tenant.id}}),1);
});
await suite.test('valid partial then full payout posts exact balances and rejects another payment',async()=>{
 const g=await group(),d=await dividend(g);const payload={distribution_id:d.distribution.id,date:'2026-10-21',wallet_id:g.wallet.id};
 assert.equal((await call(g.user,'/management/dividends/pay','POST',{...payload,amount:40})).status,201);await d.declaration.reload();assert.equal(d.declaration.status,'Partially Paid');
 assert.equal((await call(g.user,'/management/dividends/pay','POST',{...payload,amount:60})).status,201);await d.declaration.reload();await g.wallet.reload();assert.equal(d.declaration.status,'Fully Paid');assert.equal(Number(g.wallet.balance),900);
 assert.equal((await call(g.user,'/management/dividends/pay','POST',{...payload,amount:1})).status,400);
});
}finally{if(server)await new Promise(resolve=>server.close(resolve));await db.sequelize.close();}});
