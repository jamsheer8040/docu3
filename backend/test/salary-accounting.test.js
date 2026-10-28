const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),{once}=require('node:events');
require('dotenv').config();
if(process.env.DB_NAME!=='docclear_regression_test'||process.env.TEST_DATABASE_RESET!=='yes'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw Error('Disposable local database required');
Object.assign(process.env,{NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',DISABLE_CRON:'true'});
const db=require('../models'),app=require('../app'),jwt=require('jsonwebtoken');
db.sequelize.options.logging=false;
let server,base,admin,outsider,staff,staff2,wallet,first;
async function request(path,method='GET',body,user=admin,key=require('node:crypto').randomUUID()){const r=await fetch(base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+jwt.sign({id:user.id},process.env.JWT_SECRET),'Content-Type':'application/json',...(/\/salaries\/pay-(single|batch)$/.test(path) && key ? {'Idempotency-Key':key}: {})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,...await r.json()};}
const profit=()=>require('../utils/profitTotals')({tenant_id:1},{tenant_id:1});
const expense=payroll=>db.Expense.findOne({where:{tenant_id:1,id:payroll.expense_id,salary_payroll_id:payroll.id}});
const payload=(month,total=500)=>({month,booking_date:`${month}-15`,items:[{user_id:staff.id,basic_salary:total,base_salary:total,leave_days:0,override_reason:'Approved test salary adjustment'}]});
const book=async(month,total)=>{const r=await request('/salaries/book','POST',payload(month,total));assert.equal(r.status,201,JSON.stringify(r));return r.payroll;};
before(async()=>{
  await db.sequelize.sync({force:true});
  await db.Tenant.bulkCreate([{id:1,name:'Payroll A',slug:'payroll-a',status:'active'},{id:2,name:'Payroll B',slug:'payroll-b',status:'active'}]);
  const role=await db.Role.create({name:'Admin',tenant_id:1}),foreignRole=await db.Role.create({name:'Admin',tenant_id:2});
  admin=await db.User.create({name:'Payroll admin',email:'payroll-admin@test.example',tenant_id:1,role_id:role.id});
  outsider=await db.User.create({name:'Other admin',email:'payroll-other@test.example',tenant_id:2,role_id:foreignRole.id});
  staff=await db.User.create({name:'Payroll staff',tenant_id:1,basic_salary:600,total_salary:600});
  staff2=await db.User.create({name:'Payroll staff 2',tenant_id:1,basic_salary:400,total_salary:400});
  wallet=await db.WalletAccount.create({tenant_id:1,name:'Payroll wallet',balance:5000});
  server=await app.start();if(!server.listening)await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.sequelize.close();});

test('salary accounting schema is additive and repeatable; existing links default to null',async()=>{
  await require('../utils/salaryAccountingSchema')(db.sequelize);await require('../utils/salaryAccountingSchema')(db.sequelize);
  const legacy=await db.SalaryPayroll.create({tenant_id:2,month:'2029-01',booking_date:'2029-01-31'});
  assert.equal(legacy.expense_id,null);
  const e=await db.Expense.create({tenant_id:2,description:'Historical manual expense',amount:15});assert.equal(e.salary_payroll_id,null);
});
test('booking accrues one salary expense and profit deduction without moving a wallet or double counting summaries',async()=>{
  const data=payload('2030-01',600);data.items.push({user_id:staff2.id,basic_salary:400,base_salary:400,leave_days:0});
  const r=await request('/salaries/book','POST',data);assert.equal(r.status,201,JSON.stringify(r));first=r.payroll;
  assert.ok(first.expense_id);const e=await expense(first);assert.equal(Number(e.amount),1000);assert.equal(Number(e.paid_amount),0);assert.equal(e.status,'Unpaid');
  await wallet.reload();assert.equal(Number(wallet.balance),5000);assert.equal(await db.SalaryPayment.count({where:{tenant_id:1}}),0);
  assert.equal((await profit()).net_profit,-1000);
  const summary=(await request('/salaries/summary?month=2030-01')).data;
  assert.equal(summary.operational.total,0);assert.equal(summary.salary.total,1000);assert.equal(summary.combined.total,1000);
  const list=await request('/expenses');assert.ok(list.data.every(row=>String(row.id)!==String(e.id)));assert.equal(Number(list.meta.total_sum),0);
  const combined=await request('/expenses?expense_kind=all');
  assert.equal(combined.status,200);assert.equal(combined.data.length,2);assert.equal(combined.meta.total,2);
  assert.ok(combined.data.every(row=>String(row.expense_id)===String(e.id)));assert.equal(combined.data[0].expense_kind,'salary');
  assert.equal(combined.data[0].payroll_month,'2030-01');assert.equal(Number(combined.meta.total_sum),1000);
  assert.deepEqual(combined.data.map(row=>row.staff_name).sort(),['Payroll staff','Payroll staff 2']);
  assert.equal(Number(combined.data.find(row=>row.staff_name==='Payroll staff').amount),600);
  const paged=await request('/expenses?expense_kind=all&limit=1&page=2');
  assert.equal(paged.data.length,1);assert.equal(paged.meta.total,2);assert.equal(paged.meta.last_page,2);assert.equal(Number(paged.meta.total_sum),1000);
  assert.notEqual(paged.data[0].id,combined.data[0].id);
  const searched=await request('/expenses?expense_kind=salary&search=Payroll%20staff%202');
  assert.equal(searched.data.length,1);assert.equal(searched.data[0].staff_name,'Payroll staff 2');assert.equal(Number(searched.meta.total_sum),400);
  assert.equal((await request('/expenses?expense_kind=salary&status=Paid')).data.length,0);
  assert.equal((await request('/expenses?expense_kind=invalid')).status,400);
  assert.equal((await request(`/expenses/${e.id}`)).status,404);
  const report=await request('/reports/profit-details?from=2030-01-01&to=2030-01-31');assert.equal(report.data.totals.net_profit,-1000);
  assert.equal(report.data.totals.salary_expenses,1000);assert.equal(report.data.totals.operational_expenses,0);assert.equal(report.data.totals.commission_expenses,0);
  assert.equal(report.data.totals.net_service_charges-report.data.totals.operational_expenses-report.data.totals.commission_expenses-report.data.totals.salary_expenses,report.data.totals.net_profit);
  const prior=await request('/reports/profit-details?from=2029-12-01&to=2029-12-31');assert.equal(prior.data.totals.expenses,0);
});

test('linked salary expense lists respect staff visibility and company boundaries',async()=>{
  const role=await db.Role.create({name:'Expenses list only',tenant_id:1,type:'Internal',permissions:{expenses:{read:true}}});
  const actor=await db.User.create({name:'Expenses viewer',tenant_id:1,role_id:role.id});
  const before=await db.Expense.count({where:{tenant_id:1}});
  assert.equal((await request('/expenses?expense_kind=salary','GET',undefined,actor)).data.length,0);
  const limited=await request('/expenses?expense_kind=all','GET',undefined,actor);
  assert.equal(limited.data.length,0);assert.equal(Number(limited.meta.total_sum),0);
  await role.update({permissions:{expenses:{read:true},staff:{rules:{list:'assigned',detail:'assigned'}}}});
  assert.equal((await request('/expenses?expense_kind=salary','GET',undefined,actor)).data.length,0);
  assert.equal((await request('/expenses?expense_kind=salary','GET',undefined,outsider)).data.length,0);
  assert.equal(await db.Expense.count({where:{tenant_id:1}}),before);
});
test('mixed expense pages contain staff rows once, with consistent totals and filters',async()=>{
  const operational=await db.Expense.create({tenant_id:1,description:'Payroll period office supplies',amount:10,created_at:new Date('2030-01-15T12:00:00+04:00')});
  try {
    const all=await request('/expenses?expense_kind=all&limit=100');
    assert.equal(all.meta.total,3);assert.equal(Number(all.meta.total_sum),1010);
    assert.equal(all.data.filter(row=>row.expense_kind==='salary').length,2);
    assert.equal(all.data.filter(row=>row.expense_kind==='operational').length,1);
    const seen=[];
    for(let page=1;page<=3;page++){
      const result=await request(`/expenses?expense_kind=all&limit=1&page=${page}`);
      assert.equal(result.data.length,1);assert.equal(result.meta.total,3);assert.equal(Number(result.meta.total_sum),1010);
      seen.push(result.data[0].id);
    }
    assert.deepEqual(seen,all.data.map(row=>row.id));assert.equal(new Set(seen).size,3);
    const onlyOperational=await request('/expenses?expense_kind=operational');
    assert.equal(onlyOperational.data.length,1);assert.equal(Number(onlyOperational.meta.total_sum),10);
    const totals=(await request('/reports/profit-details?from=2030-01-01&to=2030-01-31&limit=1')).data.totals;
    assert.equal(totals.salary_expenses,1000);assert.equal(totals.operational_expenses,10);assert.equal(totals.expenses,1010);assert.equal(totals.net_profit,-1010);
  } finally { await operational.destroy(); }
});

test('the same month cannot be booked again or create a second expense',async()=>{
  const r=await request('/salaries/book','POST',payload('2030-01',600));assert.equal(r.status,400);
  assert.equal(await db.Expense.count({where:{tenant_id:1,salary_payroll_id:first.id}}),1);
});
test('the same employee cannot be booked twice within one monthly payload',async()=>{
  const body=payload('2030-09',100);body.items.push({...body.items[0]});
  assert.equal((await request('/salaries/book','POST',body)).status,400);
  assert.equal(await db.SalaryPayroll.count({where:{tenant_id:1,month:'2030-09'}}),0);
});
test('multiple individual instalments settle the same expense and reject overpayment',async()=>{
  const item=first.Items.find(i=>i.user_id===staff.id);
  for(const amount of [100,250])assert.equal((await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount,payment_date:'2030-01-20'})).status,200);
  const e=await expense(first);assert.equal(Number(e.amount),1000);assert.equal(Number(e.paid_amount),350);assert.equal(e.status,'Partially Paid');
  const listed=await request('/expenses?expense_kind=salary&status=Partially%20Paid');
  assert.equal(listed.data.length,1);assert.equal(String(listed.data[0].expense_id),String(e.id));
  assert.equal(listed.data[0].staff_name,'Payroll staff');
  assert.equal(Number(listed.data[0].paid_amount),350);assert.equal(Number(listed.data[0].amount)-Number(listed.data[0].paid_amount),250);
  const unpaid=await request('/expenses?expense_kind=salary&status=Unpaid');
  assert.equal(unpaid.data.length,1);assert.equal(unpaid.data[0].staff_name,'Payroll staff 2');assert.equal(Number(unpaid.meta.total_sum),400);
  await wallet.reload();assert.equal(Number(wallet.balance),4650);assert.equal((await profit()).net_profit,-1000);
  assert.equal((await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:251})).status,400);
  const summary=(await request('/salaries/summary?month=2030-01')).data;
  assert.equal(summary.combined.total,1000);assert.equal(summary.combined.paid,350);assert.equal(summary.combined.pending,650);
});
test('batch settlement completes the existing expense without another profit deduction',async()=>{
  const r=await request('/salaries/pay-batch','POST',{salary_item_ids:first.Items.map(i=>i.id),account_id:wallet.id,payment_date:'2030-01-31'});assert.equal(r.status,200,JSON.stringify(r));
  const e=await expense(first);assert.equal(Number(e.amount),1000);assert.equal(Number(e.paid_amount),1000);assert.equal(e.status,'Paid');
  await wallet.reload();assert.equal(Number(wallet.balance),4000);assert.equal((await profit()).net_profit,-1000);
  assert.equal(await db.Expense.count({where:{tenant_id:1,salary_payroll_id:first.id}}),1);
  assert.equal((await request(`/salaries/month/2030-01?payroll_id=${first.id}`,'DELETE')).status,400);
});
test('ordinary expense actions cannot alter or pay a linked salary expense',async()=>{
  const p=await book('2030-02',500),e=await expense(p);await wallet.reload();const balance=wallet.balance;
  assert.ok((await request(`/expenses/${e.id}`,'PUT',{amount:1,salary_payroll_id:null})).status>=400);
  assert.ok((await request(`/expenses/${e.id}/pay`,'PUT',{amount:10,account_id:wallet.id})).status>=400);
  assert.ok((await request(`/expenses/${e.id}`,'DELETE')).status>=400);
  await e.reload();await wallet.reload();assert.equal(Number(e.amount),500);assert.equal(Number(e.paid_amount),0);assert.equal(wallet.balance,balance);
  assert.equal((await request(`/salaries/month/2030-02?payroll_id=${p.id}`,'DELETE')).status,200);
  await e.reload();assert.equal(Number(e.amount),0);assert.match(e.notes,/Original booked amount AED 500.00/);assert.equal((await profit()).net_profit,-1000);
  assert.ok((await request('/expenses?expense_kind=salary&limit=100')).data.every(row=>String(row.expense_id)!==String(e.id)));
  assert.ok((await request(`/expenses/${e.id}`,'PUT',{amount:99})).status>=400,'Reversal history stays protected after payroll removal');
  const rebook=await book('2030-02',750);assert.notEqual(rebook.expense_id,p.expense_id);assert.equal((await profit()).net_profit,-1750);
});
test('expense posting failure rolls back payroll and all its items',async()=>{
  db.Expense.addHook('beforeCreate','salary-accounting-failure',row=>{if(row.salary_payroll_id)throw Error('Simulated accounting failure');});
  try{assert.equal((await request('/salaries/book','POST',payload('2030-03',200))).status,500);}finally{db.Expense.removeHook('beforeCreate','salary-accounting-failure');}
  assert.equal(await db.SalaryPayroll.count({where:{tenant_id:1,month:'2030-03'}}),0);
  assert.equal(await db.SalaryItem.count({where:{tenant_id:1}}),3);
});
test('expense settlement failure rolls back salary payment, ledger and wallet',async()=>{
  const p=await book('2030-04',200),item=p.Items[0];await wallet.reload();const before=wallet.balance;
  const transactions=await db.WalletTransaction.count({where:{tenant_id:1}});
  db.Expense.addHook('beforeUpdate','salary-settlement-failure',row=>{if(row.salary_payroll_id)throw Error('Simulated settlement failure');});
  try{assert.equal((await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:50})).status,500);}finally{db.Expense.removeHook('beforeUpdate','salary-settlement-failure');}
  await wallet.reload();assert.equal(wallet.balance,before);
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),0);assert.equal(await db.WalletTransaction.count({where:{tenant_id:1}}),transactions);
  assert.equal(Number((await expense(p)).paid_amount),0);
  assert.equal(Number((await db.SalaryItem.findOne({where:{tenant_id:1,id:item.id}})).paid_amount),0);
});
test('legacy payroll payments never auto-post or duplicate historical manual expenses',async()=>{
  const p=await db.SalaryPayroll.create({tenant_id:1,month:'2028-01',booking_date:'2028-01-31',total_amount:100});
  const item=await db.SalaryItem.create({tenant_id:1,payroll_id:p.id,user_id:staff.id,net_salary:100});
  const manual=await db.Expense.create({tenant_id:1,description:'Historical manual salary',amount:100,paid_amount:0});
  const before=await profit(),expenses=await db.Expense.count({where:{tenant_id:1}});
  assert.equal((await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:25})).status,200);
  assert.equal((await p.reload()).expense_id,null);assert.equal(await db.Expense.count({where:{tenant_id:1}}),expenses);
  assert.deepEqual(await profit(),before);await manual.reload();assert.equal(Number(manual.paid_amount),0);
});
test('another tenant cannot settle or remove this tenant payroll',async()=>{
  const item=first.Items[0],before=await profit();
  assert.equal((await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:1},outsider)).status,404);
  assert.equal((await request('/salaries/month/2030-02?payroll_id=1','DELETE',undefined,outsider)).status,404);
  assert.deepEqual(await profit(),before);
});
test('a staff payroll creator does not need ordinary Expense creation permission to accrue salary',async()=>{
  const role=await db.Role.create({name:'Payroll clerk',tenant_id:1,permissions:{staff:{rules:{list:'all',detail:'all',create:true,edit:'none',delete:'none'}}}});
  const clerk=await db.User.create({name:'Payroll clerk',email:'payroll-clerk@test.example',tenant_id:1,role_id:role.id});
  const r=await request('/salaries/book','POST',payload('2030-08',100),clerk);assert.equal(r.status,201,JSON.stringify(r));
  assert.ok(r.payroll.expense_id);assert.equal(Number((await expense(r.payroll)).amount),100);
});

test('partial-payment retries reuse one transfer while new references allow new instalments',async()=>{
  const p=await book('2031-01',500),item=p.Items[0],body={salary_item_id:item.id,account_id:wallet.id,amount:100,payment_date:'2031-01-15'};
  await wallet.reload();const balance=Number(wallet.balance);
  const a=await request('/salaries/pay-single','POST',body,admin,'partial-original');
  const b=await request('/salaries/pay-single','POST',body,admin,'partial-original');
  assert.equal(a.status,200,JSON.stringify(a));assert.equal(b.status,200,JSON.stringify(b));assert.equal(b.replayed,true);assert.equal(a.data.payment.id,b.data.payment.id);
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),1);
  await wallet.reload();assert.equal(Number(wallet.balance),balance-100);assert.equal(Number((await expense(p)).paid_amount),100);
  assert.equal((await request('/salaries/pay-single','POST',{...body,amount:101},admin,'partial-original')).status,409);
  assert.equal((await request('/salaries/pay-single','POST',body,admin,'partial-next')).status,200);
  const again=await request('/salaries/pay-single','POST',body,admin,'partial-original');assert.equal(again.status,200);assert.equal(again.data.paid_amount,200);
  await wallet.reload();assert.equal(Number(wallet.balance),balance-200);assert.equal(Number((await expense(p)).paid_amount),200);
  const receipt=await db.ManagementRequest.findOne({where:{tenant_id:1,user_id:admin.id,request_key:'partial-original'}});
  assert.deepEqual(Object.keys(receipt.response).sort(),['payment_ids','salary_operation']);
});
test('concurrent copies of a partial transfer commit one payment and one wallet debit',async()=>{
  const p=await book('2031-02',500),item=p.Items[0],body={salary_item_id:item.id,account_id:wallet.id,amount:25};
  await wallet.reload();const balance=Number(wallet.balance);
  const results=await Promise.all([request('/salaries/pay-single','POST',body,admin,'concurrent-partial'),request('/salaries/pay-single','POST',body,admin,'concurrent-partial')]);
  assert.deepEqual(results.map(r=>r.status),[200,200]);assert.ok(results.some(r=>r.replayed));
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),1);await wallet.reload();assert.equal(Number(wallet.balance),balance-25);
});
test('batch retries return the original transfer after the salaries are fully paid',async()=>{
  const body=payload('2031-03',100);body.items.push({user_id:staff2.id,base_salary:200,leave_days:0,override_reason:'Approved test salary adjustment'});
  const booked=await request('/salaries/book','POST',body),p=booked.payroll;
  const payment={salary_item_ids:p.Items.map(i=>i.id),account_id:wallet.id,payment_date:'2031-03-15'};
  await wallet.reload();const balance=Number(wallet.balance);
  const a=await request('/salaries/pay-batch','POST',payment,admin,'original-batch');
  const b=await request('/salaries/pay-batch','POST',payment,admin,'original-batch');
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(b.replayed,true);assert.equal(b.count,2);assert.equal(b.total_amount,300);
  await wallet.reload();assert.equal(Number(wallet.balance),balance-300);assert.equal(Number((await expense(p)).paid_amount),300);
  assert.equal((await request('/salaries/pay-single','POST',{salary_item_id:p.Items[0].id,account_id:wallet.id,amount:10},admin,'original-batch')).status,409);
});
test('missing or malformed references fail without moving money; rejected payments do not consume a reference',async()=>{
  const p=await book('2031-04',100),item=p.Items[0],body={salary_item_id:item.id,account_id:wallet.id,amount:25};
  for(const key of [null,'bad','a'.repeat(81)])assert.equal((await request('/salaries/pay-single','POST',body,admin,key)).status,400);
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),0);
  assert.equal((await request('/salaries/pay-single','POST',{...body,amount:101},admin,'rejected-reference')).status,400);
  assert.equal((await request('/salaries/pay-single','POST',body,admin,'rejected-reference')).status,200);
});
test('receipt failure rolls back the payment, linked expense and wallet, and the same reference can retry',async()=>{
  const p=await book('2031-05',100),item=p.Items[0],body={salary_item_id:item.id,account_id:wallet.id,amount:25};
  await wallet.reload();const balance=Number(wallet.balance);
  db.ManagementRequest.addHook('beforeCreate','receipt-failure',row=>{if(row.request_key==='rollback-receipt')throw Error('Simulated receipt failure');});
  try{assert.equal((await request('/salaries/pay-single','POST',body,admin,'rollback-receipt')).status,500);}finally{db.ManagementRequest.removeHook('beforeCreate','receipt-failure');}
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),0);assert.equal(Number((await expense(p)).paid_amount),0);
  await wallet.reload();assert.equal(Number(wallet.balance),balance);
  assert.equal((await request('/salaries/pay-single','POST',body,admin,'rollback-receipt')).status,200);
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),1);
});
test('batch receipt failure rolls back every employee payment',async()=>{
  const body=payload('2031-06',100);body.items.push({user_id:staff2.id,base_salary:100,leave_days:0,override_reason:'Approved test salary adjustment'});
  const p=(await request('/salaries/book','POST',body)).payroll;
  const payment={salary_item_ids:p.Items.map(i=>i.id),account_id:wallet.id};await wallet.reload();const balance=wallet.balance;
  db.ManagementRequest.addHook('beforeCreate','batch-receipt-failure',row=>{if(row.request_key==='rollback-batch')throw Error('Simulated receipt failure');});
  try{assert.equal((await request('/salaries/pay-batch','POST',payment,admin,'rollback-batch')).status,500);}finally{db.ManagementRequest.removeHook('beforeCreate','batch-receipt-failure');}
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:p.Items.map(i=>i.id)}}),0);await wallet.reload();assert.equal(wallet.balance,balance);
  assert.equal(Number((await expense(p)).paid_amount),0);
  assert.equal((await request('/salaries/pay-batch','POST',payment,admin,'rollback-batch')).status,200);
});
test('a replay checks current staff and wallet permissions and never returns another tenant receipt',async()=>{
  const permissions={staff:{rules:{list:'all',detail:'all',create:false,edit:'all',delete:'none'}},wallet:{rules:{list:'all',detail:'all',create:false,edit:'all',delete:'none'}}};
  const role=await db.Role.create({name:'Salary payer',tenant_id:1,permissions}),payer=await db.User.create({name:'Salary payer',email:'salary-payer@test.example',tenant_id:1,role_id:role.id});
  const p=await book('2031-07',100),item=p.Items[0],body={salary_item_id:item.id,account_id:wallet.id,amount:25};
  assert.equal((await request('/salaries/pay-single','POST',body,payer,'restricted-replay')).status,200);
  await role.update({permissions:{...permissions,staff:{rules:{...permissions.staff.rules,edit:'assigned'}}}});
  assert.equal((await request('/salaries/pay-single','POST',body,payer,'restricted-replay')).status,403);
  assert.equal((await request('/salaries/pay-single','POST',body,outsider,'restricted-replay')).status,404);
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),1);
});
test('an error after commit can be retried without recording a second salary payment',async()=>{
  const p=await book('2031-08',100),item=p.Items[0],body={salary_item_id:item.id,account_id:wallet.id,amount:25};
  const original=db.sequelize.transaction;
  db.sequelize.transaction=async function(...args){
    const transaction=await original.apply(this,args),commit=transaction.commit.bind(transaction);
    transaction.commit=async()=>{await commit();throw Error('Simulated lost commit acknowledgement');};return transaction;
  };
  try{assert.equal((await request('/salaries/pay-single','POST',body,admin,'lost-acknowledgement')).status,500);}finally{db.sequelize.transaction=original;}
  const response=await request('/salaries/pay-single','POST',body,admin,'lost-acknowledgement');assert.equal(response.status,200);assert.equal(response.replayed,true);
  assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),1);assert.equal(Number((await expense(p)).paid_amount),25);
});

test('reversal restores only its original wallet and salary liability without changing profit or deleting history',async()=>{
 const p=await book('2032-01',100),item=p.Items[0];
 const second=await db.WalletAccount.create({tenant_id:1,name:'Reversal second wallet',balance:100});
 const start=Number((await wallet.reload()).balance),beforeProfit=(await profit()).net_profit;
 const first=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:40,payment_date:'2032-01-20'},admin,'reversible-first');
 const later=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:second.id,amount:60,payment_date:'2032-01-21'});assert.equal(later.status,200);
 const id=first.data.payment.id;
 const r=await request(`/salaries/payments/${id}/reverse`,'POST',{reason:'  Wrong original wallet  '});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.pending_amount,40);
 assert.equal(Number((await wallet.reload()).balance),start);assert.equal(Number((await second.reload()).balance),40);
 const row=await db.SalaryItem.findOne({where:{tenant_id:1,id:item.id}});assert.equal(Number(row.paid_amount),60);assert.equal(row.status,'Partially Paid');assert.equal(row.account_id,second.id);assert.equal(row.payment_date,'2032-01-21');
 await db.SalaryPayroll.findOne({where:{tenant_id:1,id:p.id}}).then(row=>{assert.equal(Number(row.paid_amount),60);assert.equal(row.status,'Partially Paid');});
 const e=await expense(p);assert.equal(Number(e.amount),100);assert.equal(Number(e.paid_amount),60);assert.equal((await profit()).net_profit,beforeProfit);
 const history=await request(`/salaries/items/${item.id}/payments`);assert.equal(history.data.length,2);const reversed=history.data.find(row=>row.id===id);assert.equal(reversed.reversal_reason,'Wrong original wallet');assert.equal(reversed.reversed_by_user_id,admin.id);assert.ok(reversed.reversed_at);assert.ok(reversed.reversal_transaction_id);
 const credit=await db.WalletTransaction.findOne({where:{tenant_id:1,id:reversed.reversal_transaction_id}});assert.equal(credit.direction,'In');assert.equal(credit.reference_type,'SalaryPaymentReversal');assert.equal(credit.reference_id,id);assert.equal(Number(credit.amount),40);
 const original=await db.WalletTransaction.findOne({where:{tenant_id:1,id:first.data.payment.transaction_id}});assert.equal(original.direction,'Out');assert.equal(Number(original.amount),40);
 const replay=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:40,payment_date:'2032-01-20'},admin,'reversible-first');assert.equal(replay.status,200);assert.equal(replay.reversed,true);assert.equal(Number((await wallet.reload()).balance),start);
 const repayment=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:40});assert.equal(repayment.status,200);assert.equal(repayment.data.status,'Paid');
});

test('concurrent duplicate reversals credit once, keep audit reason, and block unbooking after all reversals',async()=>{
 const p=await book('2032-02',50),item=p.Items[0];
 const paid=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:50});
 const path=`/salaries/payments/${paid.data.payment.id}/reverse`,before=Number((await wallet.reload()).balance);
 const results=await Promise.all([request(path,'POST',{reason:'Duplicate transfer'}),request(path,'POST',{reason:'Duplicate transfer'})]);assert.ok(results.every(row=>row.status===200),JSON.stringify(results));assert.equal(results.filter(row=>row.replayed).length,1);
 assert.equal(Number((await wallet.reload()).balance),before+50);
 assert.equal(await db.WalletTransaction.count({where:{tenant_id:1,reference_type:'SalaryPaymentReversal',reference_id:paid.data.payment.id}}),1);
 assert.equal((await request(path,'POST',{reason:'Different correction'})).status,409);
 const row=await db.SalaryItem.findOne({where:{tenant_id:1,id:item.id}});assert.equal(row.status,'Unpaid');assert.equal(row.account_id,null);assert.equal(row.payment_date,null);
 assert.equal(Number((await expense(p)).paid_amount),0);assert.equal((await expense(p)).status,'Unpaid');
 assert.equal((await request(`/salaries/month/2032-02?payroll_id=${p.id}`,'DELETE')).status,409);assert.ok(await db.SalaryPayment.findOne({where:{tenant_id:1,id:paid.data.payment.id}}));
});

test('only same-company internal Admin can reverse and a reason is mandatory',async()=>{
 const p=await book('2032-03',50),item=p.Items[0],paid=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:10}),path=`/salaries/payments/${paid.data.payment.id}/reverse`;
 const role=await db.Role.create({name:'Full HR',tenant_id:1,permissions:{staff:{read:true,write:true,delete:true},wallet:{read:true,write:true}}});const hr=await db.User.create({name:'Full HR',tenant_id:1,role_id:role.id});
 const portalRole=await db.Role.create({name:'Admin',type:'CustomerPortal',tenant_id:null}),portal=await db.User.create({name:'Portal Admin',tenant_id:1,role_id:portalRole.id});
 const before=Number((await wallet.reload()).balance);
 assert.equal((await request(path,'POST',{reason:'No permission'},hr)).status,403);assert.equal((await request(path,'POST',{reason:'Other company'},outsider)).status,404);assert.equal((await request(path,'POST',{reason:'Portal'},portal)).status,403);
 for(const reason of [undefined,null,'','  ',{},'x'.repeat(2001)])assert.equal((await request(path,'POST',{reason})).status,400);
 assert.equal(Number((await wallet.reload()).balance),before);assert.equal((await db.SalaryPayment.findOne({where:{tenant_id:1,id:paid.data.payment.id}})).reversed_at,null);
});

test('reversal failure rolls back wallet credit, salary balances and audit metadata together',async()=>{
 const p=await book('2032-04',50),item=p.Items[0],paid=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:10});
 const before=Number((await wallet.reload()).balance),count=await db.WalletTransaction.count({where:{tenant_id:1}});
 for(const model of [db.SalaryPayment,db.Expense]){
  model.addHook('beforeUpdate','failSalaryReversal',()=>{throw Error('Simulated reversal failure');});
  try{assert.equal((await request(`/salaries/payments/${paid.data.payment.id}/reverse`,'POST',{reason:'Test rollback'})).status,500);}finally{model.removeHook('beforeUpdate','failSalaryReversal');}
  assert.equal(Number((await wallet.reload()).balance),before);assert.equal(await db.WalletTransaction.count({where:{tenant_id:1}}),count);assert.equal((await db.SalaryPayment.findOne({where:{tenant_id:1,id:paid.data.payment.id}})).reversed_at,null);assert.equal(Number((await expense(p)).paid_amount),10);
 }
});

test('lost reversal acknowledgement retries without a second credit',async()=>{
 const p=await book('2032-05',50),item=p.Items[0],paid=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:10}),path=`/salaries/payments/${paid.data.payment.id}/reverse`;
 const before=Number((await wallet.reload()).balance),original=db.sequelize.transaction;
 db.sequelize.transaction=async function(...args){const t=await original.apply(this,args),commit=t.commit.bind(t);t.commit=async()=>{await commit();throw Error('Lost reversal acknowledgement');};return t;};
 try{assert.equal((await request(path,'POST',{reason:'Retry correction'})).status,500);}finally{db.sequelize.transaction=original;}
 const retried=await request(path,'POST',{reason:'Retry correction'});assert.equal(retried.status,200);assert.equal(retried.replayed,true);assert.equal(Number((await wallet.reload()).balance),before+10);
});

test('unverifiable historical debit is blocked, but valid legacy payroll can reverse into an inactive negative wallet',async()=>{
 const p=await book('2032-06',50),item=p.Items[0],paid=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:10}),payment=await db.SalaryPayment.findOne({where:{tenant_id:1,id:paid.data.payment.id}});
 const before=Number((await wallet.reload()).balance),original=payment.transaction_id;await payment.update({transaction_id:null});
 assert.equal((await request(`/salaries/payments/${payment.id}/reverse`,'POST',{reason:'Unverifiable payment'})).status,409);assert.equal(Number((await wallet.reload()).balance),before);await payment.update({transaction_id:original});
 const legacy=await db.SalaryPayroll.create({tenant_id:1,month:'2032-07',booking_date:'2032-07-31',total_amount:20,paid_amount:20,status:'Paid'});
 const oldWallet=await db.WalletAccount.create({tenant_id:1,name:'Old inactive credit wallet',balance:-30,is_active:false});
 const oldItem=await db.SalaryItem.create({tenant_id:1,payroll_id:legacy.id,user_id:staff.id,net_salary:20,paid_amount:20,status:'Paid',account_id:oldWallet.id});
 const debit=await db.WalletTransaction.create({tenant_id:1,account_id:oldWallet.id,type:'Expense',direction:'Out',amount:20,reference_type:'SalaryPayment',reference_id:oldItem.id});
 const oldPayment=await db.SalaryPayment.create({tenant_id:1,salary_item_id:oldItem.id,account_id:oldWallet.id,amount:20,transaction_id:debit.id,payment_date:'2032-07-15'});
 assert.equal((await request(`/salaries/payments/${oldPayment.id}/reverse`,'POST',{reason:'Legacy correction'})).status,200);assert.equal(Number((await oldWallet.reload()).balance),-10);assert.equal((await legacy.reload()).expense_id,null);
});

test('one reversed batch instalment leaves the other employee paid and its original batch receipt safe',async()=>{
 const body=payload('2032-08',40);body.items.push({user_id:staff2.id,base_salary:60,override_reason:'Test adjustment'});
 const p=(await request('/salaries/book','POST',body)).payroll,ids=p.Items.map(row=>row.id),batch={salary_item_ids:ids,account_id:wallet.id};
 assert.equal((await request('/salaries/pay-batch','POST',batch,admin,'reversible-batch')).status,200);
 const payment=await db.SalaryPayment.findOne({where:{tenant_id:1,salary_item_id:ids[0]}});
 assert.equal((await request(`/salaries/payments/${payment.id}/reverse`,'POST',{reason:'Batch correction'})).status,200);
 const rows=await db.SalaryItem.findAll({where:{tenant_id:1,payroll_id:p.id}});assert.equal(rows.find(row=>row.id===ids[0]).status,'Unpaid');assert.equal(rows.find(row=>row.id===ids[1]).status,'Paid');
 assert.equal(Number((await expense(p)).paid_amount),Number(rows.find(row=>row.id===ids[1]).net_salary));
 const before=Number((await wallet.reload()).balance),replay=await request('/salaries/pay-batch','POST',batch,admin,'reversible-batch');assert.equal(replay.status,200);assert.equal(replay.reversed_count,1);assert.equal(Number((await wallet.reload()).balance),before);
 await require('../utils/salaryReversalSchema')(db.sequelize);await require('../utils/salaryReversalSchema')(db.sequelize);assert.equal(payment.reversed_at,null,'Loaded pre-reversal instance is unchanged until reloaded');
});

test('the final one-fils instalment is payable, cannot be overpaid, and stays exact through retry and reversal',async()=>{
 const p=await book('2033-01',60),item=p.Items[0],start=Math.round(Number((await wallet.reload()).balance)*100);
 const first=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:59.99});assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.pending_amount,0.01);
 const excess=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount:0.02});assert.equal(excess.status,400);assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),1);
 const body={salary_item_id:item.id,account_id:wallet.id,amount:0.01};
 const last=await request('/salaries/pay-single','POST',body,admin,'last-fils-receipt');assert.equal(last.status,200,JSON.stringify(last));assert.equal(last.data.status,'Paid');assert.equal(last.data.paid_amount,60);assert.equal(last.data.pending_amount,0);
 assert.equal(Math.round(Number((await wallet.reload()).balance)*100),start-6000);assert.equal(Number((await expense(p)).paid_amount),60);
 const replay=await request('/salaries/pay-single','POST',body,admin,'last-fils-receipt');assert.equal(replay.replayed,true);assert.equal(replay.data.pending_amount,0);assert.equal(Math.round(Number((await wallet.reload()).balance)*100),start-6000);
 const reversed=await request(`/salaries/payments/${last.data.payment.id}/reverse`,'POST',{reason:'One-fils correction'});assert.equal(reversed.status,200);assert.equal(reversed.data.paid_amount,59.99);assert.equal(reversed.data.pending_amount,0.01);
 const reversedReplay=await request('/salaries/pay-single','POST',body,admin,'last-fils-receipt');assert.equal(reversedReplay.reversed,true);assert.equal(reversedReplay.data.pending_amount,0.01);
 const remaining=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id});assert.equal(remaining.status,200,JSON.stringify(remaining));assert.equal(Number(remaining.data.payment.amount),0.01);assert.equal(remaining.data.status,'Paid');assert.equal(Math.round(Number((await wallet.reload()).balance)*100),start-6000);
});

test('small instalments accumulate exact paid and pending totals in responses and summaries',async()=>{
 const p=await book('2033-02',0.60),item=p.Items[0],start=Math.round(Number((await wallet.reload()).balance)*100);
 for(const [amount,paid,pending]of [[0.10,0.10,0.50],[0.20,0.30,0.30],[0.30,0.60,0]]){
  const r=await request('/salaries/pay-single','POST',{salary_item_id:item.id,account_id:wallet.id,amount});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.paid_amount,paid);assert.equal(r.data.pending_amount,pending);
 }
 assert.equal(Math.round(Number((await wallet.reload()).balance)*100),start-60);
 const summary=await request('/salaries/summary?month=2033-02');assert.equal(summary.data.salary.total,0.6);assert.equal(summary.data.salary.paid,0.6);assert.equal(summary.data.salary.pending,0);assert.equal(summary.data.combined.paid,0.6);
 const month=await request('/salaries/month/2033-02');assert.equal(Number(month.payroll.paid_amount),0.6);assert.equal(month.payroll.status,'Paid');
});

test('batch settlement sums final fils exactly and counts only recorded transfers',async()=>{
 const zero=await db.User.create({name:'Zero salary employee',tenant_id:1,basic_salary:0,total_salary:0});
 const body=payload('2033-03',60);body.items.push({user_id:staff2.id,base_salary:10,override_reason:'Test fractional payment'},{user_id:zero.id,base_salary:0});
 const booked=await request('/salaries/book','POST',body);assert.equal(booked.status,201,JSON.stringify(booked));const p=booked.payroll,ids=p.Items.map(row=>row.id);
 for(const row of p.Items.filter(row=>Number(row.net_salary)>0))assert.equal((await request('/salaries/pay-single','POST',{salary_item_id:row.id,account_id:wallet.id,amount:Number(row.net_salary)===60?59.99:9.99})).status,200);
 const start=Math.round(Number((await wallet.reload()).balance)*100),batch={salary_item_ids:ids,account_id:wallet.id};
 const r=await request('/salaries/pay-batch','POST',batch,admin,'last-fils-batch');assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.total_amount,0.02);assert.equal(r.count,2);assert.equal(Math.round(Number((await wallet.reload()).balance)*100),start-2);
 assert.equal(Number((await expense(p)).paid_amount),70);assert.equal((await request('/salaries/month/2033-03')).payroll.status,'Paid');
 const repeated=await request('/salaries/pay-batch','POST',batch,admin,'last-fils-batch');assert.equal(repeated.replayed,true);assert.equal(repeated.total_amount,0.02);assert.equal(repeated.count,2);assert.equal(Math.round(Number((await wallet.reload()).balance)*100),start-2);
});

test('a lost cancellation reply cannot cause an old retry to unbook a replacement payroll',async()=>{
 const old=await book('2034-01',100),original=db.sequelize.transaction;
 db.sequelize.transaction=async function(...args){const t=await original.apply(this,args),commit=t.commit.bind(t);t.commit=async()=>{await commit();throw Error('Lost cancellation acknowledgement');};return t;};
 try{assert.equal((await request(`/salaries/month/2034-01?payroll_id=${old.id}`,'DELETE')).status,500);}finally{db.sequelize.transaction=original;}
 assert.equal(await db.SalaryPayroll.count({where:{tenant_id:1,id:old.id}}),0);assert.equal(Number((await expense(old)).amount),0);
 const replacement=await book('2034-01',150);assert.notEqual(replacement.id,old.id);
 const balance=(await wallet.reload()).balance;
 const stale=await Promise.all([request(`/salaries/month/2034-01?payroll_id=${old.id}`,'DELETE'),request(`/salaries/month/2034-01?payroll_id=${old.id}`,'DELETE')]);assert.ok(stale.every(row=>row.status===409),JSON.stringify(stale));
 assert.ok(await db.SalaryPayroll.findOne({where:{tenant_id:1,id:replacement.id}}));assert.equal(Number((await expense(replacement)).amount),150);assert.equal((await wallet.reload()).balance,balance);
 const current=await request(`/salaries/month/2034-01?payroll_id=${replacement.id}`,'DELETE');assert.equal(current.status,200);assert.equal(current.payroll_id,String(replacement.id));assert.equal(Number((await expense(replacement)).amount),0);
});

test('cancellation requires an exact reference and cannot use a different month or malformed ID',async()=>{
 const p=await book('2034-02',100),other=await book('2034-03',100);
 for(const suffix of ['', '?payroll_id=0','?payroll_id=-1','?payroll_id=abc','?payroll_id=1.0','?payroll_id=01','?payroll_id=','?payroll_id[]=1','?payroll_id=111111111111111111111'])assert.equal((await request('/salaries/month/2034-02'+suffix,'DELETE')).status,400,suffix);
 assert.equal((await request(`/salaries/month/2034-02?payroll_id=${other.id}`,'DELETE')).status,409);
 assert.equal(Number((await expense(p)).amount),100);assert.equal(Number((await expense(other)).amount),100);assert.equal(await db.SalaryPayroll.count({where:{tenant_id:1,id:[p.id,other.id]}}),2);
});

test('salary payment dates use UAE midnight across day, month, leap-year and year boundaries',()=>{
 const {paymentDate}=require('../utils/salaryValidation');
 for(const [instant,date] of [['2026-10-20T19:59:59Z','2026-10-20'],['2026-10-20T20:00:00Z','2026-10-21'],['2026-10-31T20:00:00Z','2026-11-01'],['2026-12-31T20:00:00Z','2027-01-01'],['2028-02-28T20:00:00Z','2028-02-29'],['2028-02-29T20:00:00Z','2028-03-01']])assert.equal(paymentDate(undefined,new Date(instant)),date);
 assert.equal(paymentDate('2000-02-29'),'2000-02-29');assert.throws(()=>paymentDate('1900-02-29'));
});

test('invalid explicit dates cannot create any individual or batch payment, debit or receipt',async()=>{
 const p=await book('2035-01',100),item=p.Items[0],balance=(await wallet.reload()).balance;
 const models=['SalaryPayment','WalletTransaction','ManagementRequest'];const counts=()=>Promise.all(models.map(name=>db[name].count({where:{tenant_id:1}})));const before=await counts();
 for(const date of ['',null,false,{},[],20260101,'2026-02-29','2024-02-30','2026-00-01','2026-13-01','2026-01-00','0000-01-01','2026-1-01','01/01/2026','2026-01-01T00:00:00Z','2026-01-01 ','junk']){
  for(const [path,body]of [['/salaries/pay-single',{salary_item_id:item.id,account_id:wallet.id,amount:10,payment_date:date}],['/salaries/pay-batch',{salary_item_ids:[item.id],account_id:wallet.id,payment_date:date}]]){
   const r=await request(path,'POST',body);assert.equal(r.status,400,JSON.stringify({date,r}));assert.match(r.message,/payment|date/i);
  }
 }
 assert.deepEqual(await counts(),before);assert.equal((await wallet.reload()).balance,balance);assert.equal(Number((await expense(p)).paid_amount),0);
});

test('default date is shared by payment and balances, retries keep the original date, and backdated dates stay unchanged',async()=>{
 const validation=require('../utils/salaryValidation'),original=validation.paymentDate;
 let now=new Date('2035-12-31T19:59:59Z');validation.paymentDate=value=>original(value,now);
 try{
  const p=await book('2035-02',100),item=p.Items[0],body={salary_item_id:item.id,account_id:wallet.id,amount:25};
  const first=await request('/salaries/pay-single','POST',body,admin,'uae-midnight-receipt');assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.payment.payment_date,'2035-12-31');assert.equal((await expense(p)).payment_date,'2035-12-31');
  now=new Date('2035-12-31T20:00:00Z');const retry=await request('/salaries/pay-single','POST',body,admin,'uae-midnight-receipt');assert.equal(retry.replayed,true);assert.equal(retry.data.payment.payment_date,'2035-12-31');
  const batch=await request('/salaries/pay-batch','POST',{salary_item_ids:[item.id],account_id:wallet.id});assert.equal(batch.status,200,JSON.stringify(batch));
  const payments=await db.SalaryPayment.findAll({where:{tenant_id:1,salary_item_id:item.id},order:[['id','ASC']]});assert.deepEqual(payments.map(row=>row.payment_date),['2035-12-31','2036-01-01']);assert.equal((await expense(p)).payment_date,'2036-01-01');
  const other=await book('2035-03',100),backdated=await request('/salaries/pay-single','POST',{salary_item_id:other.Items[0].id,account_id:wallet.id,amount:10,payment_date:'2024-02-29'});assert.equal(backdated.status,200);assert.equal(backdated.data.payment.payment_date,'2024-02-29');assert.equal((await expense(other)).payment_date,'2024-02-29');
 }finally{validation.paymentDate=original;}
});
