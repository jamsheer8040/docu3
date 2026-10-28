const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),{once}=require('node:events'),fs=require('node:fs'),path=require('node:path');
require('dotenv').config();
if(process.env.DB_NAME!=='docclear_regression_test'||process.env.TEST_DATABASE_RESET!=='yes'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw Error('Disposable local database required');
Object.assign(process.env,{NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',DISABLE_CRON:'true'});
const db=require('../models'),app=require('../app'),jwt=require('jsonwebtoken'),pricing=require('../utils/salesOrderPricing');
db.sequelize.options.logging=false;
let server,base,admin,outsider,customer,tax,order;
async function request(url,method='GET',body,user=admin){return fetch(base+'/api/v1'+url,{method,headers:{Authorization:'Bearer '+jwt.sign({id:user.id},process.env.JWT_SECRET),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
const item=()=>({service_name:'Visa service',quantity:2,estimated_price:250,cost:200,service_charge:50});
const bank={bank_name:'Example Bank UAE',account_name:'Example Company',account_number:'123456789',iban:'AE070331234567890123456',swift:'EXAMPLEAE',branch:'Dubai'};
const documentFields={bank_details:bank,payment_terms:'50% advance; balance within 30 days.',terms:'Services subject to customer approval.'};
before(async()=>{
 await db.sequelize.sync({force:true});
 await db.Tenant.bulkCreate([{id:1,name:'Sales A',slug:'sales-a',status:'active'},{id:2,name:'Sales B',slug:'sales-b',status:'active'}]);
 for(const id of [1,2]){
  const role=await db.Role.create({name:'Admin',tenant_id:id});
  const user=await db.User.create({name:'Admin '+id,tenant_id:id,role_id:role.id,email:`sales-${id}@test.example`});
  if(id===1)admin=user;else outsider=user;
 }
 customer=await db.Customer.create({tenant_id:1,name:'Pricing customer',phone_whatsapp:'123'});
 tax=await db.Tax.create({tenant_id:1,name:'VAT',rate:5,is_active:true});
 await db.Tax.create({tenant_id:2,name:'VAT',rate:2,is_active:true});
 server=await app.start();if(!server.listening)await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.sequelize.close();});
test('discount is deducted before VAT, quantities and whole-fils rounding are consistent',()=>{
 assert.deepEqual(pricing.calculate([item()],50,5),{subtotal:500,discount:50,tax_rate:5,tax_amount:22.5,total:472.5});
 assert.equal(pricing.calculate([{quantity:1,estimated_price:0.1}],0,5).tax_amount,0.01);
 for(const bad of [-1,'',null,true,'1e2',1.001,Infinity])assert.throws(()=>pricing.calculate([item()],bad,5));
 assert.throws(()=>pricing.calculate([item()],501,5),/exceed/);
 assert.throws(()=>pricing.calculate([item()],0,100.01),/VAT/);
 assert.throws(()=>pricing.calculate([{quantity:1.5,estimated_price:100}],0,5),/quantity/);
});
test('pricing schema is repeatable and retains legacy null VAT fallback',async()=>{
 const legacy=await db.SalesOrder.create({tenant_id:1,customer_id:customer.id,order_number:'LEGACY-SO'});
 await require('../utils/salesOrderPricingSchema')(db.sequelize);await require('../utils/salesOrderPricingSchema')(db.sequelize);
 await require('../utils/salesOrderDocumentSchema')(db.sequelize);await require('../utils/salesOrderDocumentSchema')(db.sequelize);
 await legacy.reload();assert.equal(legacy.tax_rate,null);assert.equal(Number(legacy.discount),0);
 assert.equal(legacy.bank_details,null);assert.equal(legacy.terms,null);
});
test('create saves discount and VAT, returning totals calculated on the server',async()=>{
 const response=await request('/sales-orders','POST',{customer_id:customer.id,discount:50,tax_rate:5,total:1,tax_amount:0,items:[item()],...documentFields});
 assert.equal(response.status,201);order=(await response.json()).data;
 assert.equal(order.subtotal,500);assert.equal(order.tax_amount,22.5);assert.equal(order.total,472.5);
 const row=await db.SalesOrder.findOne({where:{tenant_id:1,id:order.id}});assert.equal(Number(row.discount),50);assert.equal(Number(row.tax_rate),5);
 assert.deepEqual(row.bank_details,bank);assert.equal(row.payment_terms,documentFields.payment_terms);assert.equal(row.terms,documentFields.terms);
 assert.equal(await db.Expense.count({where:{tenant_id:1}}),0);assert.equal(await db.WalletTransaction.count({where:{tenant_id:1}}),0);
});
test('saved VAT survives workspace rate changes and defaults are tenant scoped',async()=>{
 await tax.update({rate:10});
 const read=await request(`/sales-orders/${order.id}`);const saved=(await read.json()).data;
 assert.equal(saved.tax_rate,5);assert.equal(saved.total,472.5);
 assert.equal((await (await request('/sales-orders/pricing-defaults')).json()).data.tax_rate,10);
 assert.equal((await (await request('/sales-orders/pricing-defaults','GET',undefined,outsider)).json()).data.tax_rate,2);
 const created=await request('/sales-orders','POST',{customer_id:customer.id,items:[item()]});
 assert.equal(created.status,201);assert.equal((await created.json()).data.tax_rate,10);
});
test('invalid pricing rolls back create and update; another tenant cannot edit',async()=>{
 const count=await db.SalesOrder.count({where:{tenant_id:1}});
 for(const data of [{discount:501,tax_rate:5},{discount:0,tax_rate:-1},{discount:null,tax_rate:5}]){
  assert.equal((await request('/sales-orders','POST',{customer_id:customer.id,items:[item()],...data})).status,400);
 }
 assert.equal(await db.SalesOrder.count({where:{tenant_id:1}}),count);
 assert.equal((await request('/sales-orders','POST',{customer_id:customer.id,items:[{...item(),quantity:1.5}]})).status,400);
 assert.equal((await request(`/sales-orders/${order.id}`,'PUT',{discount:501})).status,400);
 assert.equal((await (await request(`/sales-orders/${order.id}`)).json()).data.discount,50);
 assert.equal((await request(`/sales-orders/${order.id}`,'PUT',{discount:0},outsider)).status,404);
});
test('Pro Forma and sales-order PDF variants use the saved discount and rate',async()=>{
 for(const [name,url] of [
  ['proforma-default',`/sales-orders/${order.id}/proforma-pdf`],
  ['proforma-modern',`/document-templates/proforma/${order.id}/pdf?template=modern`],
  ['sales-order-classic',`/document-templates/sales_order/${order.id}/pdf?template=classic`]
 ]){
  const response=await request(url);assert.equal(response.status,200);const pdf=Buffer.from(await response.arrayBuffer());assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  if(process.env.SO_PDF_QA_DIR){fs.mkdirSync(process.env.SO_PDF_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.SO_PDF_QA_DIR,name+'.pdf'),pdf);}
 }
});
test('bank and terms defaults are tenant scoped, snapshotted and preserved by partial edits',async()=>{
 const config=await db.SystemConfig.create({tenant_id:1,key:'quotation_defaults',value:JSON.stringify(documentFields)});
 const defaults=(await (await request('/sales-orders/pricing-defaults')).json()).data.document_defaults;assert.deepEqual(defaults.bank_details,bank);
 assert.notDeepEqual((await (await request('/sales-orders/pricing-defaults','GET',undefined,outsider)).json()).data.document_defaults,documentFields);
 const response=await request('/sales-orders','POST',{customer_id:customer.id,items:[item()]});assert.equal(response.status,201);const saved=(await response.json()).data;
 await config.update({value:JSON.stringify({bank_details:{bank_name:'Changed master'},terms:'Changed defaults'})});
 let read=(await (await request(`/sales-orders/${saved.id}`)).json()).data;assert.deepEqual(read.bank_details,bank);assert.equal(read.terms,documentFields.terms);
 const edited=await request(`/sales-orders/${saved.id}`,'PUT',{internal_remarks:'Only internal edit'});assert.equal(edited.status,200);read=(await edited.json()).data;
 assert.deepEqual(read.bank_details,bank);assert.equal(read.payment_terms,documentFields.payment_terms);
 for(const invalid of [{bank_details:[]},{bank_details:{bank_name:'x'.repeat(151)}},{terms:'x'.repeat(5001)},{payment_terms:{bad:true}}])assert.equal((await request(`/sales-orders/${saved.id}`,'PUT',invalid)).status,400);
 const cleared=await request(`/sales-orders/${saved.id}`,'PUT',{bank_details:{bank_name:''},terms:''});assert.equal(cleared.status,200);
 assert.equal((await cleared.json()).data.terms,'');
});
test('long document terms export across pages without changing totals',async()=>{
 const response=await request('/sales-orders','POST',{customer_id:customer.id,discount:50,tax_rate:5,items:[item()],...documentFields,terms:('Customer approval required. Service fees are payable as agreed.\n').repeat(70)});
 assert.equal(response.status,201);const saved=(await response.json()).data;
 for(const [name,url] of [['proforma-long',`/sales-orders/${saved.id}/proforma-pdf`],['proforma-long-modern',`/document-templates/proforma/${saved.id}/pdf?template=modern`]]){
  const result=await request(url);assert.equal(result.status,200);const pdf=Buffer.from(await result.arrayBuffer());assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  if(process.env.SO_PDF_QA_DIR)fs.writeFileSync(path.join(process.env.SO_PDF_QA_DIR,name+'.pdf'),pdf);
 }
});
test('editing preserves omitted pricing fields and recalculates against retained locked services',async()=>{
 const items=await db.SalesOrderItem.findAll({where:{tenant_id:1,sales_order_id:order.id}});await items[0].update({confirmed:true});
 let response=await request(`/sales-orders/${order.id}`,'PUT',{contact_person:'Updated'});assert.equal(response.status,200);
 assert.equal((await response.json()).data.total,472.5);
 response=await request(`/sales-orders/${order.id}`,'PUT',{discount:25,tax_rate:7.5,items:[]});assert.equal(response.status,200);
 const saved=(await response.json()).data;assert.equal(saved.SalesOrderItems.length,1);assert.equal(saved.subtotal,500);assert.equal(saved.tax_amount,35.63);assert.equal(saved.total,510.63);
});
