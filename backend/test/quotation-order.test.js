const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
require('dotenv').config();
if(process.env.DB_NAME!=='docclear_regression_test'||process.env.TEST_DATABASE_RESET!=='yes'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw Error('Disposable local database required');
Object.assign(process.env,{NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',DISABLE_CRON:'true'});
const db=require('../models'),app=require('../app'),jwt=require('jsonwebtoken');db.sequelize.options.logging=false;
let server,base,admin,outsider,portal,denied,salesman,customer,lead,quote,seed,order;
async function request(url,method='GET',body,user=admin){const r=await fetch(base+'/api/v1'+url,{method,headers:{Authorization:'Bearer '+jwt.sign({id:user.id},process.env.JWT_SECRET),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();let parsed;try{parsed=JSON.parse(raw);}catch{parsed={message:raw};}return {status:r.status,...parsed};}
const payload=(extra={})=>({recipient_name:'Conversion company',contact_person:'Contact',phone:'0501234567',email:'convert@example.test',address:'Dubai',customer_reference:'Reference',branch:'Main',assigned_user_id:salesman.id,
 items:[{service_name:'Custom visa service',quantity:2,cost:110,service_charge:40,rate:150,description:'Copied description',expected_processing_time:'3 working days'}],discount:10,tax_rate:0,notes:'Customer notes',internal_remarks:'Internal notes',bank_details:{bank_name:'Example Bank',iban:'AE123'},payment_terms:'30 days',terms:'Agreed terms',template_style:'modern',...extra});
async function create(extra={}){const r=await request('/quotations','POST',payload(extra));assert.equal(r.status,201,JSON.stringify(r));return r.data;}
async function draft(q){const r=await request(`/quotations/${q.id}/sales-order-draft`);assert.equal(r.status,200,JSON.stringify(r));return r.data.seed;}
async function save(q,s){const r=await request(`/quotations/${q.id}/sales-order`,'POST',s);assert.equal(r.status,201,JSON.stringify(r));return r.data;}
before(async()=>{
 await db.sequelize.sync({force:true});await db.Tenant.bulkCreate([{id:1,name:'Convert A',slug:'convert-a',status:'active'},{id:2,name:'Convert B',slug:'convert-b',status:'active'}]);
 for(const tenant_id of [1,2]){const role=await db.Role.create({name:'Admin',tenant_id});const user=await db.User.create({name:'Admin '+tenant_id,email:`convert-${tenant_id}@test.example`,tenant_id,role_id:role.id});if(tenant_id===1)admin=user;else outsider=user;}
 const salesRole=await db.Role.create({name:'Sales owner',tenant_id:1,type:'Internal'});salesman=await db.User.create({name:'Salesperson',tenant_id:1,role_id:salesRole.id});
 const portalRole=await db.Role.create({name:'Portal',tenant_id:1,type:'CustomerPortal',permissions:{sales_orders:{read:true,write:true},quotations:{read:true,write:true}}});portal=await db.User.create({name:'Portal',tenant_id:1,role_id:portalRole.id});
 const deniedRole=await db.Role.create({name:'Quote only',tenant_id:1,permissions:{quotations:{read:true,write:true}}});denied=await db.User.create({name:'Quote only',tenant_id:1,role_id:deniedRole.id});
 customer=await db.Customer.create({name:'Existing customer',tenant_id:1,phone_whatsapp:'0509999999',assigned_user_id:salesman.id});
 lead=await db.Lead.create({company_name:'Conversion company',name:'Contact',phone:'0501234567',email:'convert@example.test',tenant_id:1,status:'Qualified',assigned_user_id:salesman.id});
 server=await app.start();if(!server.listening)await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.sequelize.close();});
test('conversion schema is additive and repeatable; existing orders stay confirmed',async()=>{
 const legacy=await db.SalesOrder.create({tenant_id:1,order_number:'LEGACY',customer_id:customer.id});
 await require('../utils/quotationOrderSchema')(db.sequelize);await require('../utils/quotationOrderSchema')(db.sequelize);
 await legacy.reload();assert.equal(legacy.confirmation_status,'Confirmed');assert.equal(legacy.source_quotation_id,null);
});
test('opening conversion returns a complete editable seed without saving or creating a customer',async()=>{
 quote=await create({lead_id:lead.id});const before=await db.SalesOrder.count({where:{tenant_id:1}});seed=await draft(quote);
 assert.equal(seed.items[0].cost,110);assert.equal(seed.items[0].service_charge,40);assert.equal(seed.items[0].estimated_price,150);assert.equal(seed.items[0].quantity,2);
 assert.equal(seed.items[0].expected_processing_time,'3 working days');assert.equal(seed.items[0].expected_date,null);assert.equal(seed.customer_id,null);
 assert.equal(seed.bank_details.bank_name,'Example Bank');assert.equal(seed.payment_terms,'30 days');assert.equal(seed.discount,10);assert.equal(seed.sales_executive_id,salesman.id);
 await draft(quote);assert.equal(await db.SalesOrder.count({where:{tenant_id:1}}),before);assert.equal(await db.Customer.count({where:{tenant_id:1}}),1);
 assert.equal((await db.Quotation.findByPk(quote.id)).status,'Draft');
});
test('concurrent Save creates one unconfirmed order and only then marks quotation SO',async()=>{
 const responses=await Promise.all([request(`/quotations/${quote.id}/sales-order`,'POST',seed),request(`/quotations/${quote.id}/sales-order`,'POST',seed)]);
 assert.deepEqual(responses.map(r=>r.status),[201,201]);assert.equal(String(responses[0].data.id),String(responses[1].data.id));order=responses.find(r=>!r.data.already_converted).data;
 assert.equal(order.confirmation_status,'Unconfirmed');assert.equal(order.customer_id,null);assert.equal(order.total,290);assert.equal(order.SalesOrderItems[0].expected_date,null);
 assert.equal(order.notes,'Customer notes');assert.equal(order.terms,'Agreed terms');assert.equal(order.template_style,'modern');
 const saved=await db.Quotation.findByPk(quote.id);assert.equal(saved.status,'SO');assert.equal(String(saved.sales_order_id),String(order.id));
 assert.equal(await db.SalesOrder.count({where:{tenant_id:1,source_quotation_id:quote.id}}),1);assert.equal(await db.Customer.count({where:{tenant_id:1}}),1);
 assert.equal(await db.ServiceOrder.count({where:{tenant_id:1}}),0);assert.equal(await db.WalletTransaction.count({where:{tenant_id:1}}),0);
});
test('unconfirmed orders cannot start services and converted quotes cannot be edited',async()=>{
 const id=order.SalesOrderItems[0].id;
 assert.equal((await request(`/sales-orders/items/${id}/push`,'POST',{})).status,409);
 assert.equal((await request(`/quotations/${quote.id}`,'PUT',payload())).status,409);
 assert.equal((await request(`/sales-orders/${order.id}`,'DELETE')).status,409);
 assert.equal((await request(`/sales-orders/${order.id}`,'GET',undefined,portal)).status,404);
});
test('unconfirmed order PDFs use copied recipient, terms and prices without creating a customer',async()=>{
 const fs=require('node:fs'),path=require('node:path');
 for(const [name,url]of [['converted-proforma',`/sales-orders/${order.id}/proforma-pdf`],['converted-proforma-modern',`/document-templates/proforma/${order.id}/pdf?template=modern`]]){
  const response=await fetch(base+'/api/v1'+url,{headers:{Authorization:'Bearer '+jwt.sign({id:admin.id},process.env.JWT_SECRET)}});
  assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');
  if(process.env.CONVERSION_PDF_QA_DIR){fs.mkdirSync(process.env.CONVERSION_PDF_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.CONVERSION_PDF_QA_DIR,name+'.pdf'),bytes);}
 }
 assert.equal(await db.Customer.count({where:{tenant_id:1}}),1);
});
test('first item confirmation creates one customer atomically and links the original lead',async()=>{
 const results=await Promise.all([request(`/sales-orders/items/${order.SalesOrderItems[0].id}/confirm`,'POST',{action:'confirm'}),request(`/sales-orders/items/${order.SalesOrderItems[0].id}/confirm`,'POST',{action:'confirm'})]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);
 const updated=await db.SalesOrder.findByPk(order.id);const linked=await db.Customer.findByPk(updated.customer_id);assert.equal(linked.assigned_user_id,salesman.id);assert.equal(linked.name,'Conversion company');
 await lead.reload();assert.equal(lead.customer_id,linked.id);assert.ok(lead.converted_at);assert.equal(await db.Customer.count({where:{tenant_id:1}}),2);
 assert.equal(await db.Invoice.count({where:{tenant_id:1}}),0);assert.equal(await db.Expense.count({where:{tenant_id:1}}),0);assert.equal(await db.ServiceOrder.count({where:{tenant_id:1}}),0);
});
test('manual and quotation orders both confirm or cancel individual items without changing siblings',async()=>{
 const q=await create({customer_id:customer.id}),s=await draft(q);s.items.push({...s.items[0]});const converted=await save(q,s);
 const manual=await request('/sales-orders','POST',{customer_id:customer.id,items:s.items,discount:0,tax_rate:0});assert.equal(manual.status,201,JSON.stringify(manual));
 for(const target of [converted,manual.data]){
  const items=await db.SalesOrderItem.findAll({where:{tenant_id:1,sales_order_id:target.id},order:[['id','ASC']]});assert.equal(items.length,2);
  assert.equal((await request(`/sales-orders/items/${items[0].id}/confirm`,'POST',{action:'confirm'})).status,200);
  await items[0].reload();await items[1].reload();assert.equal(items[0].confirmed,true);assert.equal(items[1].confirmed,false);assert.equal(items[1].cancelled,false);
  assert.equal((await request(`/sales-orders/items/${items[1].id}/push`,'POST',{})).status,409);
  assert.equal((await request(`/sales-orders/items/${items[0].id}/confirm`,'POST',{action:'cancel'})).status,409);
  assert.equal((await request(`/sales-orders/items/${items[1].id}/confirm`,'POST',{action:'cancel'})).status,200);
  await items[1].reload();assert.equal(items[1].cancelled,true);
  assert.equal((await request(`/sales-orders/items/${items[1].id}/confirm`,'POST',{action:'confirm'})).status,409);
 }
 assert.equal(await db.ServiceOrder.count({where:{tenant_id:1}}),0);
});
test('cancelling every quotation item requires no customer creation',async()=>{
 const q=await create({phone:'0507777777',email:'item-cancel@example.test'}),saved=await save(q,await draft(q));const before=await db.Customer.count({where:{tenant_id:1}});
 assert.equal((await request(`/sales-orders/items/${saved.SalesOrderItems[0].id}/confirm`,'POST',{action:'cancel'})).status,200);
 const updated=await db.SalesOrder.findByPk(saved.id);assert.equal(updated.confirmation_status,'Cancelled');assert.equal(updated.customer_id,null);assert.equal(await db.Customer.count({where:{tenant_id:1}}),before);
});
test('existing customers are reused and expected dates are optional and editable',async()=>{
 const q=await create({customer_id:customer.id}),s=await draft(q);s.items[0].expected_date='2026-11-15';const saved=await save(q,s);
 assert.equal(String(saved.customer_id),String(customer.id));assert.equal(saved.SalesOrderItems[0].expected_date,'2026-11-15');
 const result=await request(`/sales-orders/${saved.id}/confirmation`,'POST',{action:'confirm'});assert.equal(result.status,200);assert.equal(await db.Customer.count({where:{tenant_id:1}}),2);
});
test('cancellation retains the saved order and SO link without creating a customer',async()=>{
 const q=await create({phone:'0508888888',email:'cancel@example.test'}),saved=await save(q,await draft(q));
 assert.equal((await request(`/sales-orders/${saved.id}/confirmation`,'POST',{action:'cancel'})).status,200);
 assert.equal((await request(`/sales-orders/${saved.id}/confirmation`,'POST',{action:'cancel'})).status,200);
 assert.equal((await request(`/sales-orders/${saved.id}/confirmation`,'POST',{action:'confirm'})).status,409);
 assert.equal((await request(`/sales-orders/${saved.id}`,'PUT',{internal_remarks:'Cannot edit'})).status,409);
 assert.equal(await db.Customer.count({where:{tenant_id:1}}),2);assert.equal((await db.Quotation.findByPk(q.id)).status,'SO');
});
test('stale quotations, invalid dates and failed saves cannot mark SO or leave partial orders',async()=>{
 const q=await create(),s=await draft(q);await db.Quotation.update({customer_reference:'Changed'},{where:{tenant_id:1,id:q.id}});
 assert.equal((await request(`/quotations/${q.id}/sales-order`,'POST',s)).status,409);
 const fresh=await draft(q);fresh.items[0].expected_date='2026-02-30';assert.equal((await request(`/quotations/${q.id}/sales-order`,'POST',fresh)).status,400);
 fresh.items[0].expected_date=null;const count=await db.SalesOrder.count({where:{tenant_id:1}});
 db.SalesOrderItem.addHook('beforeBulkCreate','conversion-fail',()=>{throw Error('Injected conversion failure');});
 try{assert.ok((await request(`/quotations/${q.id}/sales-order`,'POST',fresh)).status>=400);}finally{db.SalesOrderItem.removeHook('beforeBulkCreate','conversion-fail');}
 assert.equal(await db.SalesOrder.count({where:{tenant_id:1}}),count);assert.equal((await db.Quotation.findByPk(q.id)).status,'Draft');assert.equal((await db.Quotation.findByPk(q.id)).sales_order_id,null);
});
test('conversion requires permissions and cannot cross tenants or portal boundaries',async()=>{
 const q=await create();for(const actor of [portal,denied])assert.equal((await request(`/quotations/${q.id}/sales-order-draft`,'GET',undefined,actor)).status,403);
 assert.equal((await request(`/quotations/${q.id}/sales-order-draft`,'GET',undefined,outsider)).status,404);
 assert.equal((await request(`/sales-orders/${order.id}/confirmation`,'POST',{action:'cancel'},outsider)).status,404);
});
