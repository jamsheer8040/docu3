const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
require('dotenv').config();
if(process.env.DB_NAME!=='docclear_regression_test'||process.env.TEST_DATABASE_RESET!=='yes'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw Error('Disposable local database required');
Object.assign(process.env,{NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',DISABLE_CRON:'true'});
const db=require('../models'),app=require('../app'),jwt=require('jsonwebtoken');db.sequelize.options.logging=false;
let server,base,admin,staff,roleless,foreign,inactive,portal,portalAdmin,developer,foreignRoleUser,expenseReader,reader,listOnly,detailOnly,scopeUser,wallet,scopeRole;
const rules=(extra={})=>({list:'all',detail:'all',create:false,edit:'none',delete:'none',...extra});
const permissions=extra=>({staff:{rules:rules(extra)}});
async function user(name,perms,extra={}){const role=await db.Role.create({name,tenant_id:1,permissions:perms});return db.User.create({name,email:`${name.toLowerCase().replace(/\W/g,'')}@salary.test`,tenant_id:1,role_id:role.id,...extra});}
async function request(path,actor=admin,method='GET',body,key=require('node:crypto').randomUUID()){
 const response=await fetch(base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+jwt.sign({id:actor.id},process.env.JWT_SECRET),'Content-Type':'application/json','Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,...await response.json()};
}
const payload=(month,ids=[staff.id])=>({month,booking_date:`${month}-15`,items:ids.map(user_id=>({user_id,basic_salary:100,base_salary:100,leave_days:0,override_reason:'Approved test salary adjustment'}))});
before(async()=>{
 await db.sequelize.sync({force:true});await db.Tenant.bulkCreate([{id:1,name:'Salary company A',slug:'salary-access-a',status:'active'},{id:2,name:'Salary company B',slug:'salary-access-b',status:'active'}]);
 const ar=await db.Role.create({name:'Admin',tenant_id:1}),br=await db.Role.create({name:'Admin',tenant_id:2});
 admin=await db.User.create({name:'HR Admin',email:'hr-admin@salary.test',tenant_id:1,role_id:ar.id});
 staff=await db.User.create({name:'Employee',tenant_id:1,basic_salary:100,total_salary:100});
 roleless=await db.User.create({name:'Non-login employee',tenant_id:1,can_login:false,basic_salary:80,total_salary:80});
 foreign=await db.User.create({name:'Other company employee',tenant_id:2,basic_salary:777,total_salary:777});
 inactive=await db.User.create({name:'Former employee',tenant_id:1,is_active:false,basic_salary:90,total_salary:90});
 const pr=await db.Role.create({name:'Portal',type:'CustomerPortal',tenant_id:1,permissions:{staff:{read:true,write:true,delete:true},expenses:{read:true,write:true}}});
 portal=await db.User.create({name:'Customer',tenant_id:1,role_id:pr.id,basic_salary:900,total_salary:900});
 const spoof=await db.Role.create({name:'Admin',type:'CustomerPortal',tenant_id:null,permissions:{staff:{read:true,write:true,delete:true}}});
 portalAdmin=await db.User.create({name:'Portal admin name',tenant_id:1,role_id:spoof.id});
 const dev=await db.Role.create({name:'Developer',type:'Internal',tenant_id:null});developer=await db.User.create({name:'Global developer',role_id:dev.id,tenant_id:null});
 await db.User.create({name:'Company developer account',role_id:dev.id,tenant_id:1,basic_salary:999,total_salary:999});
 foreignRoleUser=await db.User.create({name:'Foreign role reference',tenant_id:1,role_id:br.id,basic_salary:888,total_salary:888});
 expenseReader=await user('Expenses reader',{expenses:{read:true,write:true,delete:true}});
 reader=await user('Legacy HR reader',{staff:{read:true}});
 listOnly=await user('Staff list only',permissions({detail:'none',create:true,edit:'all'}));
 detailOnly=await user('Staff detail only',permissions({list:'none',create:true,edit:'all'}));
 scopeUser=await user('Assigned HR',{staff:{rules:rules({list:'assigned',detail:'assigned',create:true,edit:'assigned',delete:'assigned'})},wallet:{rules:rules({edit:'all'})}});
 scopeRole=await db.Role.findOne({where:{id:scopeUser.role_id,tenant_id:1}});
 wallet=await db.WalletAccount.create({tenant_id:1,name:'Salary wallet',balance:10000});
 server=await app.start();if(!server.listening)await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.sequelize.close();});

test('Expenses-only, portal, portal named Admin, global developer and foreign-role sessions cannot reach any salary endpoint',async()=>{
 for(const actor of [expenseReader,portal,portalAdmin,developer,foreignRoleUser])for(const [path,method,body]of [
  ['/salaries/summary','GET'],['/salaries/month/2040-01','GET'],['/salaries/items/1/payments','GET'],
  ['/salaries/book','POST',payload('2040-01')],['/salaries/pay-single','POST',{salary_item_id:1,account_id:wallet.id,amount:1}],['/salaries/pay-batch','POST',{salary_item_ids:[1],account_id:wallet.id}],['/salaries/month/2040-01','DELETE']
 ])assert.equal((await request(path,actor,method,body)).status,403,`${actor.name}: ${method} ${path}`);
 assert.equal(await db.SalaryPayment.count({where:{tenant_id:1}}),0);
 assert.equal(await db.SalaryPayroll.count({where:{tenant_id:1}}),0);
});
test('staff list-only and detail-only grants do not disclose compensation or permit blind booking',async()=>{
 for(const actor of [listOnly,detailOnly]){
  assert.equal((await request('/salaries/month/2040-01',actor)).status,403);
  assert.equal((await request('/salaries/summary',actor)).status,403);
  assert.equal((await request('/salaries/book',actor,'POST',payload('2040-01'))).status,403);
 }
});
test('legacy Staff read remains valid but does not grant booking, payment or deletion',async()=>{
 assert.equal((await request('/salaries/month/2040-01',reader)).status,200);
 assert.equal((await request('/salaries/book',reader,'POST',payload('2040-01'))).status,403);
 assert.equal((await request('/salaries/pay-single',reader,'POST',{salary_item_id:1,account_id:wallet.id,amount:1})).status,403);
 assert.equal((await request('/salaries/month/2040-01',reader,'DELETE')).status,403);
});
test('the preview excludes portal, Developer, inactive and foreign-role users but retains non-login roleless employees',async()=>{
 const response=await request('/salaries/month/2040-01');assert.equal(response.status,200);
 const ids=response.staffPreview.map(row=>row.user_id);
 assert.ok(ids.includes(staff.id));assert.ok(ids.includes(roleless.id));assert.ok(ids.includes(admin.id));
 for(const id of [portal.id,portalAdmin.id,inactive.id,foreign.id,foreignRoleUser.id])assert.ok(!ids.includes(id));
 assert.ok(!response.staffPreview.some(row=>row.Staff.name==='Company developer account'));
});
test('explicit and mixed submitted IDs cannot book ineligible employees or encoded foreign IDs',async()=>{
 const dev=await db.User.findOne({where:{tenant_id:1,name:'Company developer account'}});
 for(const id of [foreign.id,portal.id,portalAdmin.id,inactive.id,foreignRoleUser.id,dev.id,`0x${foreign.id.toString(16)}`]){
  const r=await request('/salaries/book',admin,'POST',payload('2040-01',[staff.id,id]));assert.equal(r.status,400,JSON.stringify(r));
 }
 assert.equal(await db.SalaryPayroll.count({where:{tenant_id:1,month:'2040-01'}}),0);
});
test('automatic booking uses exactly the same eligible set as the preview',async()=>{
 const preview=await request('/salaries/month/2040-02');
 const response=await request('/salaries/book',admin,'POST',{month:'2040-02'});assert.equal(response.status,201,JSON.stringify(response));
 assert.deepEqual(response.payroll.Items.map(row=>row.user_id).sort((a,b)=>a-b),preview.staffPreview.map(row=>row.user_id).sort((a,b)=>a-b));
});
test('inactive former employees retain existing salary payment and history access',async()=>{
 const booked=await request('/salaries/book',admin,'POST',payload('2040-03'));const item=booked.payroll.Items[0];
 await staff.update({is_active:false});
 try{
  const r=await request('/salaries/pay-single',admin,'POST',{salary_item_id:item.id,account_id:wallet.id,amount:25});assert.equal(r.status,200,JSON.stringify(r));
  assert.equal((await request(`/salaries/items/${item.id}/payments`)).data.length,1);
 }finally{await staff.update({is_active:true});}
});
test('legacy foreign employee references do not disclose identities or receive new payments',async()=>{
 const p=await db.SalaryPayroll.create({tenant_id:1,month:'2040-04',booking_date:'2040-04-30',total_amount:120});
 const bad=await db.SalaryItem.create({tenant_id:1,payroll_id:p.id,user_id:foreign.id,net_salary:100});
 const good=await db.SalaryItem.create({tenant_id:1,payroll_id:p.id,user_id:staff.id,net_salary:20});
 const view=await request('/salaries/month/2040-04');assert.equal(view.status,200);assert.equal(view.payroll.Items.find(row=>row.id===bad.id).Staff,null);assert.ok(!JSON.stringify(view).includes(foreign.name));
 assert.equal((await request('/salaries/pay-single',admin,'POST',{salary_item_id:bad.id,account_id:wallet.id,amount:1})).status,400);
 assert.equal((await request('/salaries/pay-batch',admin,'POST',{salary_item_ids:[good.id,bad.id],account_id:wallet.id})).status,400);
 assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:[bad.id,good.id]}}),0);
});
test('scoped month views and summary totals include only visible salary items',async()=>{
 await staff.update({assigned_user_id:scopeUser.id});
 const p=await db.SalaryPayroll.create({tenant_id:1,month:'2040-06',booking_date:'2040-06-30',total_amount:600,paid_amount:50,assigned_user_id:scopeUser.id,created_by:admin.id});
 const shown=await db.SalaryItem.create({tenant_id:1,payroll_id:p.id,user_id:staff.id,net_salary:100,assigned_user_id:scopeUser.id,created_by:admin.id});
 const hidden=await db.SalaryItem.create({tenant_id:1,payroll_id:p.id,user_id:roleless.id,net_salary:500,paid_amount:50,created_by:admin.id});
 const e=await db.Expense.create({tenant_id:1,salary_payroll_id:p.id,description:'Scoped payroll expense',amount:600,paid_amount:50,status:'Partially Paid'});await p.update({expense_id:e.id});
 const view=await request('/salaries/month/2040-06',scopeUser);assert.equal(view.status,200,JSON.stringify(view));assert.equal(view.payroll.Items.length,1);assert.equal(Number(view.payroll.total_amount),100);assert.equal(Number(view.payroll.paid_amount),0);
 const totals=await request('/salaries/summary?month=2040-06',scopeUser);assert.equal(totals.data.salary.total,100);assert.equal(totals.data.salary.paid,0);
 assert.equal((await request(`/salaries/items/${hidden.id}/payments`,scopeUser)).status,404);
 const mixed=await request('/salaries/pay-batch',scopeUser,'POST',{salary_item_ids:[shown.id,hidden.id],account_id:wallet.id});assert.equal(mixed.status,404);
 assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:shown.id}}),0);
 const paid=await request('/salaries/pay-single',scopeUser,'POST',{salary_item_id:shown.id,account_id:wallet.id,amount:25});assert.equal(paid.status,200,JSON.stringify(paid));
 await p.reload();await e.reload();assert.equal(Number(p.paid_amount),75);assert.equal(Number(e.paid_amount),75);
 assert.equal((await request('/salaries/summary?month=2040-06',scopeUser)).data.salary.paid,25);
});
test('scoped booking cannot use hidden employees, and assigned HR can open its legitimate new booking',async()=>{
 const preview=await request('/salaries/month/2040-07',scopeUser);assert.deepEqual(preview.staffPreview.map(row=>row.user_id),[staff.id]);
 assert.equal((await request('/salaries/book',scopeUser,'POST',payload('2040-07',[staff.id,roleless.id]))).status,400);
 const r=await request('/salaries/book',scopeUser,'POST',payload('2040-07'));assert.equal(r.status,201,JSON.stringify(r));assert.ok(r.payroll);assert.equal(r.payroll.Items.length,1);assert.equal(r.payroll.assigned_user_id,scopeUser.id);
 assert.equal((await request('/salaries/month/2040-07',scopeUser)).payroll.Items.length,1);
});
test('legacy delete permission is independent of create/edit permission',async()=>{
 const deleter=await user('HR cancellation',{staff:{read:true,delete:true}});
 const p=await request('/salaries/book',admin,'POST',payload('2040-08'));assert.equal(p.status,201);
 assert.equal((await request(`/salaries/month/2040-08?payroll_id=${p.payroll.id}`,deleter,'DELETE')).status,200);
});
test('operational-only users still receive operational totals without salary details',async()=>{
 await db.Expense.create({tenant_id:1,description:'Office supplies',amount:20,paid_amount:5});
 const r=await request('/expenses',expenseReader);assert.equal(r.status,200);assert.ok(Number(r.meta.total_sum)>=20);assert.ok(Number(r.meta.total_paid_sum)>=5);assert.ok(r.data.every(row=>!row.salary_payroll_id));
});

test('broad delete permission cannot cancel payroll outside list/detail visibility',async()=>{
 const actor=await user('Scoped cancellation',permissions({list:'assigned',detail:'assigned',delete:'all'}));
 const booked=await request('/salaries/book',admin,'POST',payload('2040-09'));assert.equal(booked.status,201);
 assert.ok(!(await request('/salaries/month/2040-09',actor)).payroll);
 assert.equal((await request(`/salaries/month/2040-09?payroll_id=${booked.payroll.id}`,actor,'DELETE')).status,404);
 assert.ok(await db.SalaryPayroll.findOne({where:{tenant_id:1,id:booked.payroll.id}}));
});

test('payment replay rechecks current payroll visibility without another wallet debit',async()=>{
 const booked=await request('/salaries/book',scopeUser,'POST',payload('2040-10'));assert.equal(booked.status,201);
 const item=booked.payroll.Items[0],key=require('node:crypto').randomUUID();
 const body={salary_item_id:item.id,account_id:wallet.id,amount:10};
 assert.equal((await request('/salaries/pay-single',scopeUser,'POST',body,key)).status,200);
 const balance=Number((await wallet.reload()).balance);
 await db.SalaryPayroll.update({assigned_user_id:admin.id},{where:{tenant_id:1,id:booked.payroll.id}});
 assert.equal((await request(`/salaries/items/${item.id}/payments`,scopeUser)).status,404);
 assert.equal((await request('/salaries/pay-single',scopeUser,'POST',body,key)).status,403);
 assert.equal(Number((await wallet.reload()).balance),balance);
 assert.equal(await db.SalaryPayment.count({where:{tenant_id:1,salary_item_id:item.id}}),1);
});

test('invalid calendar months are rejected consistently by preview, summary, booking and cancellation',async()=>{
 for(const month of ['2044-00','2044-13','0000-01','44-01','2044-1','2044-02-extra']){
  for(const [path,method,body] of [[`/salaries/month/${month}`,'GET'],[`/salaries/summary?month=${month}`,'GET'],['/salaries/book','POST',{month}], [`/salaries/month/${month}`,'DELETE']]){
   const r=await request(path,admin,method,body);assert.equal(r.status,400,JSON.stringify(r));assert.match(r.message,/month/i);
  }
 }
});

test('malformed payroll rows, money, dates and excessive leave fail without any financial writes',async()=>{
 const counts=async()=>Promise.all(['SalaryPayroll','SalaryItem','Expense','SalaryPayment','WalletTransaction'].map(model=>db[model].count({where:{tenant_id:1}})));
 const before=await counts(),balance=Number((await wallet.reload()).balance);
 const bad=[];
 for(const items of [[],{},null,[null],[false],['employee'],[[staff.id]]])bad.push({...payload('2044-02'),items});
 for(const date of ['2044-02-30','2043-02-29','2044-13-01','2044-02-00','2044-2-01','',null,20440201])bad.push({...payload('2044-02'),booking_date:date});
 for(const field of ['basic_salary','hr_allowance','other_allowances','base_salary','deductions','bonus','net_salary','daily_rate','leave_deduction'])for(const value of [-1,'-0.01','12abc','NaN','Infinity','1e3','0x10',true,null,'',{},[],1.234,100000000]){
  const body=payload('2044-02');body.items[0][field]=value;bad.push(body);
 }
 for(const value of [-1,30,'2days',1.25,null,true,'']){const body=payload('2044-02');body.items[0].leave_days=value;bad.push(body);}
 const excessive=payload('2044-02');excessive.items[0].deductions=101;bad.push(excessive);
 const duplicate=payload('2044-02');duplicate.items.push({...duplicate.items[0],user_id:String(staff.id)});bad.push(duplicate);
 const overflow=payload('2044-02');Object.assign(overflow.items[0],{base_salary:99999999.99,bonus:1});bad.push(overflow);
 for(const body of bad){const r=await request('/salaries/book',admin,'POST',body);assert.equal(r.status,400,JSON.stringify({body,r}));assert.ok(r.message && !r.message.includes('Failed to book'));}
 assert.deepEqual(await counts(),before);assert.equal(Number((await wallet.reload()).balance),balance);
});

test('valid leap-month fractional leave, zero salary, missing optional amounts and default booking date remain supported',async()=>{
 const body=payload('2044-02');Object.assign(body.items[0],{base_salary:'290.00',leave_days:'0.5',deductions:'5.00',bonus:'2.00',net_salary:999});delete body.booking_date;
 const r=await request('/salaries/book',admin,'POST',body);assert.equal(r.status,201,JSON.stringify(r));assert.equal(r.payroll.booking_date,'2044-02-29');assert.equal(Number(r.payroll.Items[0].net_salary),282);
 const zero=await request('/salaries/book',admin,'POST',{month:'2044-03',items:[{user_id:String(staff.id),base_salary:0,override_reason:'Unpaid month'}]});assert.equal(zero.status,201,JSON.stringify(zero));assert.equal(Number(zero.payroll.total_amount),0);
 assert.equal((await request(`/salaries/month/2044-03?payroll_id=${zero.payroll.id}`,admin,'DELETE')).status,200);
});

test('booking snapshots its actual basis, components, override reason and calculation without trusting client totals',async()=>{
 const calc=require('../utils/salaryCalculation');
 const body=payload('2044-05');Object.assign(body.items[0],{base_salary:700,leave_days:1,deductions:5,bonus:2,net_salary:999,daily_rate:1,leave_deduction:0,master_base_salary:1,days_in_month:1,calculation_version:99,override_reason:'  Approved temporary allowance  '});
 const r=await request('/salaries/book',admin,'POST',body);assert.equal(r.status,201,JSON.stringify(r));
 const saved=r.payroll.Items[0],expected=calc.calculateSalary(body.items[0],31);
 for(const field of ['base_salary','daily_rate','leave_deduction','net_salary','days_in_month','calculation_version'])assert.equal(Number(saved[field]),expected[field],field);
 assert.equal(Number(saved.net_salary),674.42);assert.equal(Number(saved.basic_salary),100);assert.equal(Number(saved.master_base_salary),100);assert.equal(saved.override_reason,'Approved temporary allowance');assert.equal(Number(r.payroll.total_amount),674.42);
 await staff.update({basic_salary:120,total_salary:120});
 const history=await request('/salaries/month/2044-05');assert.equal(Number(history.payroll.Items[0].master_base_salary),100);assert.equal(Number(history.payroll.Items[0].base_salary),700);
 await staff.update({basic_salary:100,total_salary:100});
});

test('salary overrides require a reason, unchanged salary needs none, and legacy audit fields remain null',async()=>{
 const body=payload('2044-06');body.items[0].base_salary=150;delete body.items[0].override_reason;
 for(const reason of [undefined,'','   ',{},'x'.repeat(2001)]){
  body.items[0].override_reason=reason;
  const r=await request('/salaries/book',admin,'POST',body);assert.equal(r.status,400,JSON.stringify(r));
 }
 assert.equal(await db.SalaryPayroll.count({where:{tenant_id:1,month:'2044-06'}}),0);
 const normal=payload('2044-06');delete normal.items[0].override_reason;assert.equal((await request('/salaries/book',admin,'POST',normal)).status,201);
 const legacy=await db.SalaryPayroll.findOne({where:{tenant_id:1,month:'2040-04'}});
 const old=await db.SalaryItem.findOne({where:{tenant_id:1,payroll_id:legacy.id,user_id:foreign.id}});assert.equal(old.base_salary,null);assert.equal(old.calculation_version,null);
 await require('../utils/salaryCalculationSchema')(db.sequelize);await require('../utils/salaryCalculationSchema')(db.sequelize);
 await old.reload();assert.equal(old.base_salary,null);assert.equal(old.net_salary,'100.00');
});

test('the original 31-day rounding mismatch is eliminated in saved payroll and preview totals use cents',async()=>{
 const preview=await request('/salaries/month/2044-07');assert.equal(preview.estimatedTotal,preview.staffPreview.reduce((sum,row)=>sum+Math.round(Number(row.net_salary)*100),0)/100);
 const body=payload('2044-07');Object.assign(body.items[0],{base_salary:1000,leave_days:10});
 const r=await request('/salaries/book',admin,'POST',body);assert.equal(r.status,201,JSON.stringify(r));assert.equal(Number(r.payroll.Items[0].daily_rate),32.26);assert.equal(Number(r.payroll.Items[0].leave_deduction),322.58);assert.equal(Number(r.payroll.Items[0].net_salary),677.42);assert.equal(Number(r.payroll.total_amount),677.42);
});

test('staff create and edit reject invalid salary values before any user changes are saved',async()=>{
 const before=await db.User.count({where:{tenant_id:1}}),original=await db.User.findOne({where:{tenant_id:1,id:staff.id}});
 const invalid=[-1,'-0.01','12abc','NaN','Infinity','1e3','0x10',true,null,'',{},[],1.234,100000000];
 for(const field of ['basic_salary','hr_allowance','other_allowances','total_salary'])for(const value of invalid){
  const created=await request('/users',admin,'POST',{name:'Invalid salary',can_login:false,[field]:value});assert.equal(created.status,400,JSON.stringify({field,value,created}));assert.match(created.message,/amount|salary/i);
  const edited=await request(`/users/${staff.id}`,admin,'PUT',{name:'Must not be saved',[field]:value});assert.equal(edited.status,400,JSON.stringify({field,value,edited}));
 }
 assert.equal(await db.User.count({where:{tenant_id:1}}),before);await original.reload();assert.equal(original.name,staff.name);assert.equal(Number(original.basic_salary),100);assert.equal(Number(original.total_salary),100);
 const overflow=await request('/users',admin,'POST',{name:'Overflow salary',can_login:false,basic_salary:99999999.99,hr_allowance:0.01});assert.equal(overflow.status,400);
});

test('staff salary defaults, exact component totals, partial updates and explicit total overrides remain supported',async()=>{
 const defaults=await request('/users',admin,'POST',{name:'Optional salary defaults',can_login:false});assert.equal(defaults.status,201,JSON.stringify(defaults));assert.equal(Number(defaults.data.total_salary),0);
 const created=await request('/users',admin,'POST',{name:'Cent salary components',can_login:false,basic_salary:'0.10',hr_allowance:'0.20',other_allowances:'0.30'});assert.equal(created.status,201,JSON.stringify(created));assert.equal(Number(created.data.total_salary),0.6);
 const id=created.data.id,updated=await request(`/users/${id}`,admin,'PUT',{hr_allowance:0.25});assert.equal(updated.status,200,JSON.stringify(updated));assert.equal(Number(updated.data.basic_salary),0.1);assert.equal(Number(updated.data.other_allowances),0.3);assert.equal(Number(updated.data.total_salary),0.65);
 const override=await request(`/users/${id}`,admin,'PUT',{total_salary:1.25});assert.equal(override.status,200);assert.equal(Number(override.data.total_salary),1.25);
 const unrelated=await request(`/users/${id}`,admin,'PUT',{designation:'Updated designation'});assert.equal(unrelated.status,200);assert.equal(Number(unrelated.data.total_salary),1.25);
 assert.equal((await request(`/users/${foreign.id}`,admin,'PUT',{basic_salary:0})).status,404);
});

test('staff edits do not rewrite historical payroll, and unedited legacy salary fields remain unchanged',async()=>{
 const old=await db.SalaryItem.findOne({where:{tenant_id:1,user_id:staff.id}}),net=old.net_salary;
 const legacy=await db.User.create({tenant_id:1,name:'Unmodified legacy salary',can_login:false,basic_salary:-1,total_salary:-1});
 const unrelated=await request(`/users/${legacy.id}`,admin,'PUT',{phone:'12345'});assert.equal(unrelated.status,200,JSON.stringify(unrelated));assert.equal(Number((await legacy.reload()).basic_salary),-1);
 const correction=await request(`/users/${legacy.id}`,admin,'PUT',{basic_salary:0,total_salary:0});assert.equal(correction.status,200);assert.equal(Number((await legacy.reload()).basic_salary),0);
 await old.reload();assert.equal(old.net_salary,net);
});
