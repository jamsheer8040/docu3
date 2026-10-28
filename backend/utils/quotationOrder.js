const {Op}=require('sequelize');
const db=require('../models'),{internalRead}=require('./recordAccess'),{actionScope,canRecord}=require('./permissionRules');
const pricing=require('./salesOrderPricing'),documents=require('./salesOrderDocument');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const text=(value,max)=>{if(value==null)return '';if(typeof value!=='string'||value.length>max)fail(`Text must not exceed ${max} characters.`);return value.trim();};
function date(value){if(!value)return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(new Date(value).getTime())||new Date(value).toISOString().slice(0,10)!==value)fail('Choose a valid expected date.');return value;}
function recipient(input){return {name:text(input.name,150),email:text(input.email,100),phone:text(input.phone,30),address:text(input.address,2000)};}
function version(quote){const keys=['id','status','customer_id','lead_id','recipient_name','contact_person','email','phone','address','customer_reference','branch','assigned_user_id','items','discount','tax_rate','bank_details','payment_terms','terms','notes','internal_remarks','template_style','document_footer'];return require('node:crypto').createHash('sha256').update(JSON.stringify(keys.map(key=>quote[key]))).digest('hex');}
function access(user){if(user.Role?.type!=='Internal'||actionScope(user,'sales_orders','create')!==true)fail('Sales Order creation permission is required.',403);}
async function source(id,user,transaction){
 access(user);const quote=await db.Quotation.findOne({where:{id,tenant_id:user.tenant_id},transaction,...(transaction?{lock:transaction.LOCK.UPDATE}:{})});
 if(!quote)fail('Quotation not found.',404);
 if(!canRecord(user,'quotations','detail',quote)||!canRecord(user,'quotations','edit',quote))fail('Quotation detail and edit permissions are required.',403);
 return quote;
}
async function mappedCustomer(quote,user,transaction){
 if(quote.customer_id)return quote.customer_id;
 if(!quote.lead_id)return null;
 const lead=await internalRead(()=>db.Lead.findOne({where:{id:quote.lead_id,tenant_id:user.tenant_id},attributes:['id','customer_id'],transaction}));
 return lead?.customer_id||null;
}
async function customer(id,user,transaction){
 if(!id)return null;
 const row=await db.Customer.findOne({where:{id,tenant_id:user.tenant_id},transaction});if(!row)fail('Choose an accessible customer from this company.');return row;
}
async function seed(id,user){
 const quote=await source(id,user);if(quote.sales_order_id||quote.status==='SO')fail('This quotation already has a sales order.',409);
 if(['Declined','Expired'].includes(quote.status))fail('Reopen this quotation before converting it.',409);
 const customer_id=await mappedCustomer(quote,user);if(customer_id)await customer(customer_id,user);
 const customers=await db.Customer.findAll({where:{tenant_id:user.tenant_id,is_active:true},attributes:['id','name','pricing_category','created_by','assigned_user_id']});
 const services=await db.ServiceType.findAll({where:{tenant_id:user.tenant_id,is_active:true},attributes:['id','name','cost_price','service_charge']});
 return {customers,services,seed:{source_quotation_id:quote.id,source_quotation_version:version(quote),source_quotation_updated_at:quote.updated_at||quote.updatedAt,source_quotation_number:quote.quotation_number,
  customer_id,lead_id:quote.lead_id,recipient_snapshot:recipient({name:quote.recipient_name,email:quote.email,phone:quote.phone,address:quote.address}),
  contact_person:quote.contact_person,sales_executive_id:quote.assigned_user_id,branch:quote.branch,customer_reference:quote.customer_reference,internal_remarks:quote.internal_remarks,notes:quote.notes,
  discount:Number(quote.discount),tax_rate:Number(quote.tax_rate),bank_details:quote.bank_details,payment_terms:quote.payment_terms,terms:quote.terms,template_style:quote.template_style,document_footer:quote.document_footer,
  items:quote.items.map(item=>({...item,estimated_price:Number(item.rate),expected_date:null,priority:'Normal'}))}};
}
async function save(id,input,user){return db.sequelize.transaction(async transaction=>{
 await db.Tenant.findByPk(user.tenant_id,{transaction,lock:transaction.LOCK.UPDATE});
 const quote=await source(id,user,transaction);
 if(quote.sales_order_id){const existing=await internalRead(()=>db.SalesOrder.findOne({where:{id:quote.sales_order_id,tenant_id:user.tenant_id},transaction}));if(!existing)fail('The linked sales order is missing. Ask the administrator to review it.',409);return {id:existing.id,order_number:existing.order_number,confirmation_status:existing.confirmation_status,already_converted:true};}
 if(['Declined','Expired','SO'].includes(quote.status))fail('This quotation cannot be converted in its current status.',409);
 if(input.source_quotation_version!==version(quote))fail('The quotation changed. Reopen Convert to Sales Order to load its latest version.',409);
 const customer_id=input.customer_id||await mappedCustomer(quote,user,transaction);if(customer_id)await customer(customer_id,user,transaction);
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Add between 1 and 100 services.');
 const items=input.items.map(item=>({service_type_id:item.service_type_id||null,service_name:text(item.service_name,250),description:text(item.description,2000),quantity:item.quantity,
  cost:item.cost??0,service_charge:item.service_charge??0,estimated_price:item.estimated_price??0,expected_processing_time:text(item.expected_processing_time,100),expected_date:date(item.expected_date),priority:['Normal','Moderate','Critical'].includes(item.priority)?item.priority:'Normal',status:'Not Started',tenant_id:user.tenant_id}));
 for(const item of items){if(!item.service_name)fail('Each service needs a name.');pricing.calculate([{...item,estimated_price:item.cost}],0,0);pricing.calculate([{...item,estimated_price:item.service_charge}],0,0);}
 const ids=items.map(i=>i.service_type_id).filter(Boolean);
 const types=ids.length?await db.ServiceType.findAll({where:{tenant_id:user.tenant_id,id:{[Op.in]:ids}},attributes:['id'],transaction}):[];
 if(items.some(i=>i.service_type_id&&!types.some(t=>String(t.id)===String(i.service_type_id))))fail('A service belongs to another company or is no longer available.');
 const prices=await pricing.settings(input,user.tenant_id,quote,transaction);pricing.calculate(items,prices.discount,prices.tax_rate);
 const staff_id=await require('./customerSalesperson').customerSalesperson(input.sales_executive_id??quote.assigned_user_id??user.id,user,transaction);
 const order_number=await require('./salesOrderNumber')(user.tenant_id,transaction);
 const order=await db.SalesOrder.create({tenant_id:user.tenant_id,created_by:user.id,assigned_user_id:staff_id,order_number,order_date:today(),customer_id:customer_id||null,
  source_quotation_id:quote.id,lead_id:quote.lead_id,recipient_snapshot:recipient(input.recipient_snapshot||{name:quote.recipient_name,email:quote.email,phone:quote.phone,address:quote.address}),confirmation_status:'Unconfirmed',
  contact_person:text(input.contact_person??quote.contact_person,150),sales_executive_id:staff_id,branch:text(input.branch??quote.branch,150),customer_reference:text(input.customer_reference??quote.customer_reference,150),
  internal_remarks:text(input.internal_remarks??quote.internal_remarks,5000),notes:text(input.notes??quote.notes,5000),template_style:quote.template_style,document_footer:quote.document_footer,
  ...prices,...await documents.prepare({bank_details:quote.bank_details||{},payment_terms:quote.payment_terms,terms:quote.terms,...input},user.tenant_id,quote,transaction)},{transaction});
 const savedItems=await db.SalesOrderItem.bulkCreate(items.map(item=>({...item,sales_order_id:order.id})),{transaction});
 await quote.update({status:'SO',sales_order_id:order.id},{transaction});
 return pricing.serialize({...order.toJSON(),SalesOrderItems:savedItems},user.tenant_id,transaction);
});}
async function confirmation(id,action,user){
 if(!['confirm','cancel'].includes(action))fail('Choose Confirm or Cancel.');
 return db.sequelize.transaction(async transaction=>{
  await db.Tenant.findByPk(user.tenant_id,{transaction,lock:transaction.LOCK.UPDATE});
  const order=await db.SalesOrder.findOne({where:{id,tenant_id:user.tenant_id},transaction,lock:transaction.LOCK.UPDATE});if(!order)fail('Sales order not found.',404);
  if(user.Role?.type!=='Internal'||!canRecord(user,'sales_orders','edit',order))fail('Sales Order edit permission is required.',403);
  const desired=action==='confirm'?'Confirmed':'Cancelled';if(order.confirmation_status===desired)return order;
  if(order.confirmation_status!=='Unconfirmed')fail('Only unconfirmed sales orders can be confirmed or cancelled.',409);
  if(action==='cancel'){await order.update({confirmation_status:'Cancelled'},{transaction});return order;}
  const lead=order.lead_id?await internalRead(()=>db.Lead.findOne({where:{id:order.lead_id,tenant_id:user.tenant_id},transaction,lock:transaction.LOCK.UPDATE})):null;
  let customer_id=order.customer_id||lead?.customer_id;
  if(order.customer_id&&lead?.customer_id&&String(order.customer_id)!==String(lead.customer_id))fail('The lead is linked to a different customer. Review the customer mapping before confirming.',409);
  if(customer_id)await customer(customer_id,user,transaction);
  if(lead&&!lead.customer_id&&!canRecord(user,'leads','edit',lead))fail('Lead edit permission is required to link this customer.',403);
  if(!customer_id){
   if(actionScope(user,'customers','create')!==true)fail('Customer creation permission is required to confirm this order.',403);
   const contact=recipient(order.recipient_snapshot||{});if(!contact.name||!contact.phone||contact.phone.length>20)fail('Edit the draft and provide the customer name and a phone number of at most 20 characters.');
   const matches=[...(contact.email?[{email:contact.email}]:[]),{phone_whatsapp:contact.phone}];
   const duplicate=await internalRead(()=>db.Customer.findOne({where:{tenant_id:user.tenant_id,[Op.or]:matches},attributes:['id'],transaction}));
   if(duplicate)fail('A customer with this email or phone already exists. Edit the draft and select the existing customer.',409);
   const assigned_user_id=await require('./customerSalesperson').customerSalesperson(order.sales_executive_id??user.id,user,transaction);
   const created=await db.Customer.create({tenant_id:user.tenant_id,name:contact.name,email:contact.email||null,phone_whatsapp:contact.phone,address:contact.address,assigned_user_id,created_by:user.id,is_active:true,pricing_category:'Normal'},{transaction});customer_id=created.id;
  }
  if(lead&&!lead.customer_id)await lead.update({customer_id,converted_at:new Date(),converted_by:user.id},{transaction});
  await order.update({customer_id,confirmation_status:'Confirmed'},{transaction});return order;
 });
}
module.exports={seed,save,confirmation,date,recipient};
