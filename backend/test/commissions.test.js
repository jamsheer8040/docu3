const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
require('dotenv').config();
if(process.env.DB_NAME!=='docclear_regression_test'||process.env.TEST_DATABASE_RESET!=='yes'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw Error('Disposable local DB required');
Object.assign(process.env,{NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',DISABLE_CRON:'true'});
const db=require('../models'),engine=require('../utils/commissionEngine'),jwt=require('jsonwebtoken'),app=require('../app');
db.sequelize.options.logging=false;
let server,base,admin,staff,foreign,portal,customer,wallet,sequence=0;
const day=engine.businessDay(new Date());
async function req(path,user=admin,method='GET',body,key){const r=await fetch(base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+jwt.sign({id:user.id},process.env.JWT_SECRET),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,...await r.json()};}
const criteria=(extra={})=>({enabled:true,min_service_charge:70,percentage:10,...extra});
async function invoice(extra={}){const i=await db.Invoice.create({tenant_id:1,customer_id:customer.id,invoice_number:'SIMPLE-'+(++sequence),subtotal:500,total:470,cost_total:300,discount:30,tax:0,status:'Issued',...extra});await db.InvoiceItem.create({tenant_id:i.tenant_id,invoice_id:i.id,description:'Work',quantity:2,service_charge:50,cost:150,unit_price:250,total:500});await sync(i);return i;}
async function sync(i){await db.sequelize.transaction({isolationLevel:'READ COMMITTED'},async transaction=>{await i.reload({transaction,lock:transaction.LOCK.UPDATE});await engine.syncInvoice(i,transaction);});}
const entry=i=>db.CommissionEntry.findOne({where:{tenant_id:1,invoice_id:i.id,voided_at:null}});
const approve=e=>req(`/commissions/entries/${e.id}/review`,admin,'POST',{decision:'Approved'});
const reject=e=>req(`/commissions/entries/${e.id}/review`,admin,'POST',{decision:'Rejected',reason:'Not approved for this sale'});
const panel=i=>req(`/commissions/invoices/${i.id}`);
const profit=()=>require('../utils/profitTotals')({tenant_id:1},{tenant_id:1});
before(async()=>{
  await db.sequelize.sync({force:true});
  await db.Tenant.bulkCreate([{id:1,name:'A',slug:'simple-a',status:'active'},{id:2,name:'B',slug:'simple-b',status:'active'}]);
  const ar=await db.Role.create({name:'Admin',tenant_id:1}),br=await db.Role.create({name:'Admin',tenant_id:2});
  const sr=await db.Role.create({name:'Sales',tenant_id:1,permissions:{commissions:{read:true,rules:{list:'own'}},invoices:{read:true}}});
  const pr=await db.Role.create({name:'Portal',tenant_id:1,type:'CustomerPortal',permissions:{commissions:{read:true}}});
  admin=await db.User.create({tenant_id:1,name:'Admin',email:'simple-admin@test.example',role_id:ar.id});
  staff=await db.User.create({tenant_id:1,name:'Sales',email:'simple-sales@test.example',role_id:sr.id});
  foreign=await db.User.create({tenant_id:2,name:'Foreign',email:'simple-foreign@test.example',role_id:br.id});
  portal=await db.User.create({tenant_id:1,name:'Portal',email:'simple-portal@test.example',role_id:pr.id});
  customer=await db.Customer.create({tenant_id:1,name:'Commission customer',phone_whatsapp:'0000',assigned_user_id:staff.id});
  wallet=await db.WalletAccount.create({tenant_id:1,name:'Commission wallet',balance:1000});
  server=await app.start();if(!server.listening)await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.sequelize.close();});

test('criteria are simple, validated and tenant isolated; old formula writes fail clearly',async()=>{
  assert.equal((await req('/commissions/criteria',staff,'PUT',criteria())).status,403);
  assert.equal((await req('/commissions/options',portal)).status,403);
  for(const extra of [{percentage:101},{percentage:0},{min_service_charge:-1},{enabled:'yes'}])assert.equal((await req('/commissions/criteria',admin,'PUT',criteria(extra))).status,400);
  assert.equal((await req('/commissions/criteria',admin,'PUT',criteria())).status,200);
  assert.equal((await req('/commissions/criteria')).data.min_service_charge,70);
  assert.equal((await req('/commissions/criteria',foreign)).data.configured,false);
  assert.equal((await req('/commissions/rules',admin,'POST',{})).status,409);
});
test('discount is deducted before threshold and percentage; exact threshold qualifies',async()=>{
  const i=await invoice(),e=await entry(i);
  assert.equal(Number(e.service_charge),70);assert.equal(Number(e.amount),7);assert.equal(e.approval_status,'Pending');
  assert.equal(await db.Expense.count(),0);
  assert.equal(await entry(await invoice({discount:31,total:469})),null);
  assert.equal(await entry(await invoice({discount:120,total:380})),null);
  const p=await panel(i);assert.equal(p.data.profit.commission,0);assert.equal(p.data.profit.net_profit,170);assert.equal(p.data.profit.projected_net_profit,163);
});
test('draft issues automatically and the recipient is only the active customer owner',async()=>{
  const i=await invoice({status:'Draft'});assert.equal(await entry(i),null);
  assert.equal((await req(`/invoices/${i.id}/status`,admin,'PUT',{status:'Issued'})).status,200);assert.equal((await entry(i)).staff_id,staff.id);
  for(const owner of [null,foreign.id,portal.id]){await customer.update({assigned_user_id:owner});assert.equal(await entry(await invoice()),null);}
  await customer.update({assigned_user_id:staff.id});await staff.update({is_active:false});assert.equal(await entry(await invoice()),null);await staff.update({is_active:true});
});
test('approval is admin only and cannot be used across tenants; pending commission cannot be paid',async()=>{
  const i=await invoice(),e=await entry(i);
  assert.equal((await req(`/commissions/entries/${e.id}/review`,staff,'POST',{decision:'Approved'})).status,403);
  assert.equal((await req(`/commissions/entries/${e.id}/review`,foreign,'POST',{decision:'Approved'})).status,404);
  assert.equal((await req(`/commissions/entries/${e.id}/pay`,admin,'POST',{amount:7,payment_date:day,account_id:wallet.id},'pending-payment')).status,409);
  const s=await req('/commissions/statement?staff_id='+admin.id,staff);assert.ok(s.data.entries.every(row=>row.staff_id===staff.id));
});
test('approval recognises exactly one expense, payable balance and profit deduction before customer payment',async()=>{
  const i=await invoice(),e=await entry(i),before=await profit(),expenses=await db.Expense.count();
  const responses=await Promise.all([approve(e),approve(e)]);assert.deepEqual(responses.map(r=>r.status),[200,200]);
  assert.equal(await db.Expense.count(),expenses+1);await e.reload();
  assert.equal(e.approval_status,'Approved');const expense=await db.Expense.findByPk(e.approval_expense_id);assert.equal(Number(expense.amount),7);assert.equal(expense.status,'Unpaid');
  assert.equal((await profit()).net_profit,before.net_profit-7);
  const totals=(await req('/reports/profit-details?limit=1')).data.totals;
  assert.equal(totals.commission_expenses,before.commission_expenses+7);
  assert.equal(totals.net_service_charges,totals.service_charges-totals.discounts);
  assert.equal(Math.round((totals.net_service_charges-totals.operational_expenses-totals.commission_expenses-totals.salary_expenses)*100)/100,totals.net_profit);
  assert.equal((await panel(i)).data.profit.net_profit,163);
  const row=(await req('/commissions/statement')).data.entries.find(row=>row.id===e.id);assert.equal(row.balance,7);assert.equal(row.payable,0);
  assert.equal((await req(`/commissions/entries/${e.id}/pay`,admin,'POST',{amount:7,payment_date:day,account_id:wallet.id},'unpaid-release')).status,400);
  await assert.rejects(()=>expense.update({amount:1}),/Commissions/);
});
test('rejection removes an approved unpaid expense and restores recorded invoice profit',async()=>{
  const i=await invoice(),e=await entry(i);await approve(e);const before=await profit();assert.equal((await reject(e)).status,200);
  assert.equal((await panel(i)).data.profit.net_profit,170);assert.equal((await profit()).net_profit,before.net_profit+7);
  assert.equal((await approve(e)).status,409,'Rejected entries require a new draft');
  await sync(i);await e.reload();assert.equal(e.approval_status,'Rejected','Payment/status refresh does not undo rejection');
  const resubmit=await req(`/commissions/invoices/${i.id}`,admin,'PUT',{});assert.equal(resubmit.status,200,JSON.stringify(resubmit));
  assert.notEqual((await entry(i)).id,e.id);assert.equal((await entry(i)).approval_status,'Pending');
});
test('payout requires full payment amount, settles the same expense and prevents duplicate payments',async()=>{
  const i=await invoice(),e=await entry(i);await approve(e);await i.update({status:'Paid',paid_amount:100});
  const body={amount:7,account_id:wallet.id,payment_date:day};
  assert.equal((await req(`/commissions/entries/${e.id}/pay`,admin,'POST',body,'not-fully-paid')).status,400);
  await i.update({paid_amount:470});await sync(i);const count=await db.Expense.count(),before=await profit();await wallet.reload();const balance=Number(wallet.balance);
  const results=await Promise.all([req(`/commissions/entries/${e.id}/pay`,admin,'POST',body,'same-payment-key'),req(`/commissions/entries/${e.id}/pay`,admin,'POST',body,'same-payment-key')]);
  assert.deepEqual(results.map(r=>r.status),[200,200],JSON.stringify(results));assert.equal(results[0].data.id,results[1].data.id);
  assert.equal(await db.Expense.count(),count);assert.equal((await profit()).net_profit,before.net_profit);await wallet.reload();assert.equal(Number(wallet.balance),balance-7);
  assert.equal((await reject(e)).status,409);
  assert.equal((await req(`/commissions/payments/${results[0].data.id}/reverse`,admin,'POST',{reason:'Payment returned'})).status,200);
  assert.equal((await profit()).net_profit,before.net_profit);const row=(await req('/commissions/statement')).data.entries.find(row=>row.id===e.id);assert.equal(row.balance,7);assert.equal(row.paid,0);
  await wallet.reload();assert.equal(Number(wallet.balance),balance);
});
test('partial commission settlement and reversal keep expense amount and outstanding balance consistent',async()=>{
  const i=await invoice({status:'Paid',paid_amount:470}),e=await entry(i);await approve(e);
  const result=await req(`/commissions/entries/${e.id}/pay`,admin,'POST',{amount:3,payment_date:day,account_id:wallet.id},'partial-settlement');assert.equal(result.status,200);
  let row=(await req('/commissions/statement')).data.entries.find(row=>row.id===e.id);assert.equal(row.balance,4);assert.equal(row.paid,3);
  const tooMuch=await req(`/commissions/entries/${e.id}/pay`,admin,'POST',{amount:5,payment_date:day,account_id:wallet.id},'over-settlement');assert.equal(tooMuch.status,400);
  await e.reload();const expense=await db.Expense.findByPk(e.approval_expense_id);assert.equal(Number(expense.amount),7);assert.equal(Number(expense.paid_amount),3);
  await req(`/commissions/payments/${result.data.id}/reverse`,admin,'POST',{reason:'Partial returned'});await expense.reload();assert.equal(Number(expense.amount),7);assert.equal(Number(expense.paid_amount),0);
});
test('failed payout rolls back payment, expense settlement and wallet atomically',async()=>{
  const i=await invoice({status:'Paid',paid_amount:470}),e=await entry(i);await approve(e);await wallet.reload();const balance=wallet.balance,count=await db.CommissionPayment.count();
  db.WalletTransaction.addHook('beforeCreate','failPayout',()=>{throw Error('Injected failure');});
  try{assert.equal((await req(`/commissions/entries/${e.id}/pay`,admin,'POST',{amount:7,account_id:wallet.id,payment_date:day},'rollback-settlement')).status,500);}finally{db.WalletTransaction.removeHook('beforeCreate','failPayout');}
  assert.equal(await db.CommissionPayment.count(),count);await wallet.reload();assert.equal(wallet.balance,balance);await e.reload();assert.equal(Number((await db.Expense.findByPk(e.approval_expense_id)).paid_amount),0);
});
test('invoice changes invalidate old approval and expense and require a fresh review',async()=>{
  const i=await invoice(),e=await entry(i);await approve(e);await e.reload();const expenseId=e.approval_expense_id;
  await i.update({discount:20,total:480});await sync(i);await e.reload();assert.ok(e.voided_at);assert.equal(Number((await db.Expense.findByPk(expenseId)).amount),0);
  const replacement=await entry(i);assert.equal(replacement.approval_status,'Pending');assert.equal(Number(replacement.amount),8);
  await approve(replacement);await i.update({status:'Cancelled'});await sync(i);assert.equal(await entry(i),null);assert.equal((await panel(i)).data.profit.commission,0);
});
test('criteria changes preserve existing snapshots and profit report includes discounts and approvals only',async()=>{
  const i=await invoice(),e=await entry(i);assert.equal(Number(e.amount),7);
  await req('/commissions/criteria',admin,'PUT',criteria({percentage:20}));await sync(i);assert.equal(Number((await entry(i)).amount),7);
  const next=await invoice();assert.equal(Number((await entry(next)).amount),14);
  const report=await req('/reports/profit-details');assert.equal(report.status,200,JSON.stringify(report));
  assert.equal(typeof report.data.totals.discounts,'number');assert.ok(report.data.totals.discounts>0);
  await req('/commissions/criteria',admin,'PUT',criteria());
});
test('schema upgrade is additive and repeatable, retaining historical entries',async()=>{
  const count=await db.CommissionEntry.count();await require('../utils/commissionApprovalSchema')(db.sequelize);await require('../utils/commissionApprovalSchema')(db.sequelize);assert.equal(await db.CommissionEntry.count(),count);
});
test('invoice creation API automatically saves a calculated draft commission',async()=>{
  const result=await req('/invoices',admin,'POST',{customer_id:customer.id,status:'Issued',discount:30,tax:0,items:[{description:'API work',quantity:1,cost:0,service_charge:100,unit_price:100,total:100}]});
  assert.equal(result.status,201,JSON.stringify(result));
  const saved=await db.Invoice.findByPk(result.data.id),draft=await entry(saved);
  assert.ok(draft);assert.equal(draft.approval_status,'Pending');assert.equal(Number(draft.amount),7);
});
test('approval failure rolls back its expense and review decision',async()=>{
  const i=await invoice(),e=await entry(i),count=await db.Expense.count();
  db.CommissionEntry.addHook('beforeUpdate','failApproval',(row)=>{if(row.approval_status==='Approved')throw Error('Injected approval failure');});
  try{assert.equal((await approve(e)).status,500);}finally{db.CommissionEntry.removeHook('beforeUpdate','failApproval');}
  await e.reload();assert.equal(e.approval_status,'Pending');assert.equal(e.approval_expense_id,null);assert.equal(await db.Expense.count(),count);
});
test('historical calculation replaces unpaid legacy formulas without changing paid history',async()=>{
  const i=await invoice();await db.CommissionEntry.update({rule_snapshot:{recipient_source:'customer_owner',name:'Legacy',percentage:10}},{where:{tenant_id:1,invoice_id:i.id}});
  await db.CommissionBatch.update({fingerprint:'legacy'},{where:{tenant_id:1,invoice_id:i.id}});
  const result=await req('/commissions/calculate-existing',admin,'POST',{from:day,to:day});assert.equal(result.status,200,JSON.stringify(result));
  assert.ok((await entry(i)).rule_snapshot.simple_criteria);
});
test('profit rows include only approved commission and rejection clears the invoice deduction',async()=>{
  const i=await invoice(),e=await entry(i);await approve(e);
  let report=await req('/reports/profit-details?limit=1000');let row=report.data.invoices.find(row=>Number(row.id)===Number(i.id));
  assert.equal(Number(row.commission),7);assert.equal(Number(row.gross_profit),63);
  await reject(e);report=await req('/reports/profit-details?limit=1000');row=report.data.invoices.find(row=>Number(row.id)===Number(i.id));assert.equal(Number(row.commission),0);assert.equal(Number(row.gross_profit),70);
});
test('master switch requires confirmation and settings access; closed history does not block OFF',async()=>{
  const active=await db.CommissionEntry.findAll({where:{tenant_id:1,voided_at:null}});
  for(const row of active)if(row.approval_status!=='Rejected')assert.equal((await reject(row)).status,200);
  const off={enabled:false,expected_enabled:true,confirmed:true};
  assert.equal((await req('/config/commission',staff,'PUT',off)).status,403);
  assert.equal((await req('/config/commission',admin,'PUT',{enabled:false})).status,400);
  assert.equal((await req('/config',admin,'PUT',{commission_enabled:false})).status,400);
  assert.equal((await req('/config/commission',admin,'PUT',off)).status,200);
  assert.equal((await req('/config')).data.commission_enabled,false);
  assert.equal((await req('/config',foreign)).data.commission_enabled,true);
  assert.equal((await req('/commissions/options')).status,403);
  assert.equal((await req('/commissions/criteria',admin,'PUT',criteria())).status,403);
});
let settledEntry,settledInvoice,ordinaryExpense,expenseBeforeOff,walletBeforeOff,profitBeforeOff,invoiceProfitBeforeOff;
test('pending approvals, unpaid balances and partially paid commission all block OFF',async()=>{
  assert.equal((await req('/config/commission',admin,'PUT',{enabled:true,expected_enabled:false,confirmed:true})).status,200);
  settledInvoice=await invoice({status:'Paid',paid_amount:470});settledEntry=await entry(settledInvoice);
  const off=()=>req('/config/commission',admin,'PUT',{enabled:false,expected_enabled:true,confirmed:true});
  assert.equal((await off()).status,409);
  await approve(settledEntry);assert.equal((await off()).status,409);
  assert.equal((await req(`/commissions/entries/${settledEntry.id}/pay`,admin,'POST',{amount:3,account_id:wallet.id,payment_date:day},'master-partial')).status,200);
  assert.equal((await off()).status,409);
  assert.equal((await req(`/commissions/entries/${settledEntry.id}/pay`,admin,'POST',{amount:4,account_id:wallet.id,payment_date:day},'master-settled')).status,200);
  ordinaryExpense=await db.Expense.create({tenant_id:1,description:'Unrelated office expense',amount:25,paid_amount:25,status:'Paid'});
  expenseBeforeOff=Number(await db.Expense.sum('amount',{where:{tenant_id:1}}));await wallet.reload();walletBeforeOff=wallet.balance;
  profitBeforeOff=await profit();invoiceProfitBeforeOff=(await req(`/invoices/${settledInvoice.id}`)).data.recorded_net_profit;
  assert.equal((await off()).status,200);await wallet.reload();assert.equal(wallet.balance,walletBeforeOff);
});
test('OFF hides commission controls and rows but preserves accounting totals and historical invoice profit',async()=>{
  await settledEntry.reload();assert.equal(settledEntry.approval_status,'Approved');
  const hidden=await req(`/expenses/${settledEntry.approval_expense_id}`);assert.equal(hidden.status,404);
  assert.equal((await req(`/expenses/${ordinaryExpense.id}`)).status,200);
  assert.equal(Number(await db.Expense.sum('amount',{where:{tenant_id:1}})),expenseBeforeOff);
  assert.equal(await db.Expense.count({where:{tenant_id:1,id:settledEntry.approval_expense_id}}),0);
  assert.equal(await db.Expense.findOne({where:{tenant_id:1,id:settledEntry.approval_expense_id}}),null);
  const list=await req('/expenses?limit=100');assert.ok(list.data.every(row=>String(row.id)!==String(settledEntry.approval_expense_id)));
  const report=await req('/reports/profit-details?limit=1000');assert.equal(report.status,200,JSON.stringify(report));assert.equal(report.data.commission_enabled,false);
  const row=report.data.invoices.find(row=>Number(row.id)===Number(settledInvoice.id));assert.equal(row.commission,undefined);assert.equal(Number(row.gross_profit),63);
  assert.deepEqual(report.data.totals,profitBeforeOff,'Hidden columns cannot change historical accounting');
  assert.equal((await req(`/invoices/${settledInvoice.id}`)).data.recorded_net_profit,invoiceProfitBeforeOff);
  assert.equal(invoiceProfitBeforeOff,163);
  assert.equal(Number(list.meta.total_sum),expenseBeforeOff,'Expense total includes hidden historical rows');
  assert.equal((await req('/commissions/statement')).status,403);assert.equal((await req(`/commissions/invoices/${settledInvoice.id}`)).status,403);
  assert.equal((await req(`/commissions/entries/${settledEntry.id}/review`,admin,'POST',{decision:'Rejected',reason:'No change while disabled'})).status,403);
  const created=await req('/invoices',admin,'POST',{customer_id:customer.id,status:'Issued',discount:30,tax:0,items:[{description:'No commission while off',quantity:1,cost:0,service_charge:100,unit_price:100,total:100}]});assert.equal(created.status,201,JSON.stringify(created));
  assert.equal(await entry({id:created.data.id}),null);
});
test('ON restores visibility without changing settled expenses, profit or payouts',async()=>{
  const count=await db.CommissionPayment.count();
  const before=await profit();
  assert.equal((await req('/config/commission',admin,'PUT',{enabled:true,expected_enabled:false,confirmed:true})).status,200);
  assert.equal(Number(await db.Expense.sum('amount',{where:{tenant_id:1}})),expenseBeforeOff);
  assert.equal((await req(`/expenses/${settledEntry.approval_expense_id}`)).status,200);
  const row=(await req('/commissions/statement')).data.entries.find(row=>row.id===settledEntry.id);assert.equal(row.status,'Paid');assert.equal(row.balance,0);
  const report=await req('/reports/profit-details?limit=1000');assert.equal(report.data.commission_enabled,true);assert.equal(Number(report.data.invoices.find(row=>Number(row.id)===Number(settledInvoice.id)).commission),7);
  assert.deepEqual(report.data.totals,before);
  assert.equal((await req(`/invoices/${settledInvoice.id}`)).data.recorded_net_profit,invoiceProfitBeforeOff);
  assert.equal(await db.CommissionPayment.count(),count);await wallet.reload();assert.equal(wallet.balance,walletBeforeOff);
});
test('concurrent invoice creation and OFF cannot leave a new pending commission hidden',async()=>{
  const [off,created]=await Promise.all([
    req('/config/commission',admin,'PUT',{enabled:false,expected_enabled:true,confirmed:true}),
    req('/invoices',admin,'POST',{customer_id:customer.id,status:'Issued',discount:30,tax:0,items:[{description:'Master switch race',quantity:1,cost:0,service_charge:100,unit_price:100,total:100}]})
  ]);
  assert.equal(created.status,201,JSON.stringify(created));const current=(await req('/config')).data.commission_enabled;const calculated=await entry({id:created.data.id});
  if(!current){assert.equal(off.status,200);assert.equal(calculated,null);}else{assert.equal(off.status,409);assert.equal(calculated.approval_status,'Pending');await reject(calculated);}
  assert.equal((await req('/config/commission',admin,'PUT',{enabled:true,expected_enabled:current,confirmed:true})).status,200);
});

test('reactivation excludes prior invoices and older drafts, including explicit recalculation',async()=>{
  const before=settledEntry.toJSON();
  assert.equal((await req('/config/commission',admin,'PUT',{enabled:false,expected_enabled:true,confirmed:true})).status,200);
  const old=await invoice(),draft=await invoice({status:'Draft'});
  assert.equal(await entry(old),null);
  assert.equal((await req('/config/commission',admin,'PUT',{enabled:true,expected_enabled:false,confirmed:true})).status,200);
  const marker=await db.SystemConfig.findOne({where:{tenant_id:1,key:'commission_activation'}});
  const activationValue=marker.value;
  assert.equal(JSON.parse(marker.value).last_invoice_id,String(draft.id));
  await draft.update({status:'Issued'});await sync(draft);await sync(old);
  assert.equal(await entry(old),null);assert.equal(await entry(draft),null);
  const view=await panel(old);assert.equal(view.data.eligible,false);assert.match(view.data.reason,/predates commission activation/);
  assert.equal((await req(`/commissions/invoices/${old.id}`,admin,'PUT',{})).status,409);
  assert.equal((await req('/commissions/calculate-existing',admin,'POST',{from:day,to:day})).status,200);
  assert.equal(await entry(old),null);assert.equal(await entry(draft),null);
  await settledEntry.reload();assert.deepEqual(settledEntry.toJSON(),before);
  assert.equal((await req(`/invoices/${settledInvoice.id}`)).data.recorded_net_profit,invoiceProfitBeforeOff);
  const fresh=await invoice();assert.ok(await entry(fresh));
  assert.equal((await req('/config/commission',admin,'PUT',{enabled:true,expected_enabled:true,confirmed:true})).status,200);
  await require('../utils/commissionFeature').initializeActivations();
  assert.equal((await marker.reload()).value,activationValue);
  assert.equal((await req('/config',admin,'PUT',{commission_activation:{last_invoice_id:0}})).status,400);
});

test('first criteria setup excludes existing tenant invoices without affecting another tenant',async()=>{
  const c=await db.Customer.create({tenant_id:2,name:'Other company customer',phone_whatsapp:'222',assigned_user_id:foreign.id});
  const old=await invoice({tenant_id:2,customer_id:c.id});
  assert.equal((await req('/commissions/criteria',foreign,'PUT',criteria())).status,200);
  await sync(old);
  assert.equal(await db.CommissionEntry.count({where:{tenant_id:2,invoice_id:old.id}}),0);
  const fresh=await invoice({tenant_id:2,customer_id:c.id});
  assert.equal(await db.CommissionEntry.count({where:{tenant_id:2,invoice_id:fresh.id,voided_at:null}}),1);
});
