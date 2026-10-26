const db=require('../models');
const {Op}=require('sequelize');
const {internalRead}=require('../utils/recordAccess');
const {actionScope,canRecord}=require('../utils/permissionRules');
const {styles,renderDocument}=require('../utils/documentTemplates');
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const text=(value,max=5000)=>{if(value==null)return null;if(typeof value!=='string' || value.length>max)fail(`Text must be no more than ${max} characters.`);return value.trim() || null;};
const amount=(value,max=999999999)=>{const number=Number(value??0);if(!Number.isFinite(number) || number<0 || number>max)fail('Enter a valid positive amount.');return Math.round(number*100)/100;};
function date(value,required=false){if(!value && !required)return null;if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(value).getTime()) || new Date(value).toISOString().slice(0,10)!==value)fail('Choose a valid date.');return value;}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const can=(user,module,action='list')=>{const result=actionScope(user,module,action);return result===true || (result && result!=='none');};
const publicRow=(user,row)=>({...row.toJSON(),record_access:Object.fromEntries(['detail','edit','delete'].map(action=>[action,canRecord(user,'quotations',action,row)]))});
async function config(tenant_id,key,transaction){const row=await db.SystemConfig.findOne({where:{tenant_id,key},transaction});try{return JSON.parse(row?.value || '{}');}catch{return {};}}
function extras(input){const bank={};for(const key of ['bank_name','account_name','account_number','iban','swift','branch'])bank[key]=text(input.bank_details?.[key],150) || '';return {bank_details:bank,payment_terms:text(input.payment_terms),terms:text(input.terms),notes:text(input.notes),internal_remarks:text(input.internal_remarks)};}
async function linked(model,id,user,existingId,transaction){
  if(!id)return null;
  if(!Number.isSafeInteger(Number(id)) || Number(id)<=0)fail('Invalid linked record.');
  if(Number(id)===Number(existingId))return internalRead(()=>model.findOne({where:{id,tenant_id:user.tenant_id},transaction}));
  const scope=can(user,model===db.Lead?'leads':'customers');if(!scope)fail('You do not have access to that recipient.');
  const row=await model.findOne({where:{id,tenant_id:user.tenant_id},transaction});if(!row)fail('Recipient not found or not accessible.');return row;
}
async function prepare(input,user,existing,transaction){
  const quotation_date=date(input.quotation_date || existing?.quotation_date || today(),true),valid_until=date(input.valid_until);
  if(valid_until && valid_until<quotation_date)fail('Valid until cannot be before the quotation date.');
  const lead=await linked(db.Lead,input.lead_id,user,existing?.lead_id,transaction);
  const customer=await linked(db.Customer,input.customer_id,user,existing?.customer_id,transaction);
  if(input.lead_id && !lead || input.customer_id && !customer)fail('Linked recipient no longer exists.');
  if(lead && customer && lead.customer_id!==customer.id)fail('Choose the customer already linked to this lead, or quote the lead directly.');
  const recipient_name=text(input.recipient_name,150) || lead?.company_name || customer?.name;if(!recipient_name)fail('Enter a recipient name or select a lead/customer.');
  if(!Array.isArray(input.items) || !input.items.length || input.items.length>100)fail('Add between 1 and 100 service lines.');
  const ids=input.items.map(item=>item.service_type_id).filter(Boolean);
  const services=ids.length?await db.ServiceType.findAll({where:{id:{[Op.in]:ids},tenant_id:user.tenant_id,is_active:true},transaction}):[];
  const items=input.items.map(item=>{
    const service=item.service_type_id?services.find(row=>Number(row.id)===Number(item.service_type_id)):null;
    if(item.service_type_id && !service)fail('Choose an active service from this workspace.');
    const service_name=text(item.service_name,250) || service?.name;if(!service_name)fail('Each line requires a service name.');
    const quantity=Number(item.quantity);if(!Number.isInteger(quantity) || quantity<1 || quantity>100000)fail('Quantity must be a whole number between 1 and 100,000.');
    const cost=amount(item.cost),service_charge=amount(item.service_charge),rate=amount(item.rate??cost+service_charge);
    return {service_type_id:service?.id || null,service_name,description:text(item.description,2000),quantity,cost,service_charge,rate,total:amount(rate*quantity),expected_processing_time:text(item.expected_processing_time,100)};
  });
  const subtotal=amount(items.reduce((sum,row)=>sum+row.total,0));const discount=amount(input.discount);if(discount>subtotal)fail('Discount cannot exceed subtotal.');
  const tax_rate=amount(input.tax_rate,100);if(tax_rate && (await require('../utils/invoiceDocumentPolicy').loadInvoiceDocumentPolicy(user.tenant_id)).type!=='tax_invoice')fail('Enable VAT and configure tax registration before adding VAT.');
  const tax_amount=amount((subtotal-discount)*tax_rate/100),total=amount(subtotal-discount+tax_amount);
  const defaults=await config(user.tenant_id,'document_templates',transaction);
  const template_style=input.template_style || existing?.template_style || defaults.defaults?.quotation || 'classic';if(!styles.includes(template_style))fail('Choose a valid PDF template.');
  const assigned_user_id=input.assigned_user_id===undefined?(existing?.assigned_user_id ?? user.id):input.assigned_user_id || null;
  if(assigned_user_id!=null)await require('../utils/serviceAssignment').resolveAssignee(assigned_user_id,user.tenant_id,transaction);
  return {quotation_date,valid_until,lead_id:lead?.id || null,customer_id:customer?.id || null,recipient_name,contact_person:text(input.contact_person,150),email:text(input.email,100),phone:text(input.phone,30),address:text(input.address,2000),customer_reference:text(input.customer_reference,150),branch:text(input.branch,150),assigned_user_id,items,subtotal,discount,tax_rate,tax_amount,total,template_style,document_footer:existing?.document_footer ?? defaults.footer ?? '',...extras(input)};
}
const respond=(res,error)=>res.status(error.status || (error.name==='SequelizeUniqueConstraintError'?409:400)).json({success:false,message:error.message});
exports.list=async(req,res)=>{try{
  const where={tenant_id:req.user.tenant_id};
  if(req.query.lead_id!==undefined){if(!/^[1-9]\d*$/.test(String(req.query.lead_id)))fail('Choose a valid lead.');where.lead_id=req.query.lead_id;}
  const rows=await db.Quotation.findAll({where,order:[['id','DESC']]});res.json({success:true,data:rows});
}catch(error){respond(res,error);}};
exports.detail=async(req,res)=>{try{const row=await db.Quotation.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id}});if(!row)return res.status(404).json({success:false,message:'Quotation not found.'});res.json({success:true,data:row});}catch(error){respond(res,error);}};
exports.options=async(req,res)=>{try{
  const [customers,leads,services,staff,defaults]=await Promise.all([
    can(req.user,'customers')?db.Customer.findAll({where:{tenant_id:req.user.tenant_id,is_active:true},attributes:['id','name','email','phone_whatsapp','address','pricing_category','created_by','assigned_user_id']}):[],
    can(req.user,'leads')?db.Lead.findAll({where:{tenant_id:req.user.tenant_id},attributes:['id','company_name','name','email','phone','customer_id','created_by','assigned_user_id']}):[],
    db.ServiceType.findAll({where:{tenant_id:req.user.tenant_id,is_active:true},attributes:['id','name','cost_price','service_charge']}),
    internalRead(()=>db.User.findAll({where:{tenant_id:req.user.tenant_id,is_active:true},attributes:['id','name','role_id'],include:[{model:db.Role,attributes:['type']}]})),
    config(req.user.tenant_id,'quotation_defaults')]);
  const documentSettings=await config(req.user.tenant_id,'document_templates');
  res.json({success:true,data:{customers,leads,services,staff:staff.filter(row=>row.Role?.type!=='CustomerPortal').map(row=>({id:row.id,name:row.name})),defaults,styles,default_style:documentSettings.defaults?.quotation || 'classic',tax_enabled:(await require('../utils/invoiceDocumentPolicy').loadInvoiceDocumentPolicy(req.user.tenant_id)).type==='tax_invoice'}});
}catch(error){respond(res,error);}};
exports.defaults=async(req,res)=>{try{const values=extras(req.body);delete values.internal_remarks;delete values.notes;const where={tenant_id:req.user.tenant_id,key:'quotation_defaults'};const [row]=await db.SystemConfig.findOrCreate({where,defaults:{...where,value:JSON.stringify(values)}});await row.update({value:JSON.stringify(values)});res.json({success:true});}catch(error){respond(res,error);}};
exports.create=async(req,res)=>{try{const row=await db.sequelize.transaction(async transaction=>{
  await db.Tenant.findByPk(req.user.tenant_id,{transaction,lock:transaction.LOCK.UPDATE});
  const data=await prepare(req.body,req.user,null,transaction);
  const last=await internalRead(()=>db.Quotation.findOne({where:{tenant_id:req.user.tenant_id},order:[['id','DESC']],attributes:['id'],transaction}));
  return db.Quotation.create({...data,quotation_number:`QT-${data.quotation_date.slice(0,4)}-${String(Number(last?.id || 0)+1).padStart(5,'0')}`,status:'Draft',tenant_id:req.user.tenant_id,created_by:req.user.id},{transaction});
});res.status(201).json({success:true,data:publicRow(req.user,row)});}catch(error){respond(res,error);}};
exports.update=async(req,res)=>{try{const row=await db.sequelize.transaction(async transaction=>{
  const row=await db.Quotation.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id},transaction,lock:transaction.LOCK.UPDATE});if(!row)throw Object.assign(new Error('Quotation not found.'),{status:404});
  if(row.status==='Accepted')fail('Accepted quotations are locked. Duplicate the quotation to make a new offer.');
  const data=await prepare(req.body,req.user,row,transaction);await row.update({...data,status:'Draft',sent_at:null},{transaction});return row;
});res.json({success:true,data:publicRow(req.user,row)});}catch(error){respond(res,error);}};
exports.status=async(req,res)=>{try{const row=await db.sequelize.transaction(async transaction=>{
  const row=await db.Quotation.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id},transaction,lock:transaction.LOCK.UPDATE});if(!row)throw Object.assign(new Error('Quotation not found.'),{status:404});
  const status=req.body.status;
  const allowed={Draft:['Sent'],Sent:['Accepted','Declined','Expired'],Accepted:[],Declined:['Sent'],Expired:['Sent']};
  if(!allowed[row.status]?.includes(status))fail('This quotation cannot move to the selected status.');
  if(status==='Sent' && row.valid_until && row.valid_until<today())fail('Update the validity date before marking this quotation as sent.');
  if(status==='Expired' && (!row.valid_until || row.valid_until>=today()))fail('Only a quotation past its validity date can be marked expired.');
  await row.update({status,...(status==='Sent'?{sent_at:new Date()}: {})},{transaction});return row;
});res.json({success:true,data:publicRow(req.user,row)});}catch(error){respond(res,error);}};
exports.remove=async(req,res)=>{try{const row=await db.Quotation.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id}});if(!row)return res.status(404).json({success:false,message:'Quotation not found.'});if(row.status!=='Draft')fail('Only draft quotations can be deleted.');await row.destroy();res.json({success:true});}catch(error){respond(res,error);}};
exports.pdf=async(req,res,next)=>{try{
  if(req.user.Role?.type==='CustomerPortal')return res.sendStatus(403);
  const row=await db.Quotation.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id}});if(!row)return res.status(404).json({success:false,message:'Quotation not found.'});
  const style=req.query.template && req.query.template!=='default'?req.query.template:row.template_style;if(!styles.includes(style))fail('Choose a valid PDF template.');
  const rows=await db.SystemConfig.findAll({where:{tenant_id:req.user.tenant_id}});const settings={};for(const setting of rows){try{settings[setting.key]=JSON.parse(setting.value);}catch{settings[setting.key]=setting.value;}}
  const bank=row.bank_details || {};const sections=[{title:'Quotation details',text:[row.valid_until && `Valid until: ${row.valid_until}`,row.customer_reference && `Reference: ${row.customer_reference}`,row.contact_person && `Contact: ${row.contact_person}`,row.branch && `Branch: ${row.branch}`].filter(Boolean).join('\n')},
    {title:'Payment terms',text:row.payment_terms},{title:'Bank details',text:[['Bank',bank.bank_name],['Account name',bank.account_name],['Account number',bank.account_number],['IBAN',bank.iban],['SWIFT / BIC',bank.swift],['Branch',bank.branch]].filter(([,value])=>value).map(([label,value])=>`${label}: ${value}`).join('\n')},
    {title:'Terms and conditions',text:row.terms},{title:'Notes',text:row.notes}];
  res.type('pdf').attachment(`${row.quotation_number}.pdf`);res.set('Cache-Control','no-store');
  const path=require('path'),fs=require('fs');const uploads=path.resolve(__dirname,'../uploads');const logoPath=typeof settings.app_logo==='string'?path.resolve(__dirname,'..',settings.app_logo.replace(/^\//,'')):'';
  const logo=logoPath.startsWith(uploads+path.sep) && fs.existsSync(logoPath)?logoPath:undefined;
  const policy=await require('../utils/invoiceDocumentPolicy').loadInvoiceDocumentPolicy(req.user.tenant_id);
  renderDocument({title:'Quotation',logo,company:settings.app_name || 'My Company',companyDetails:[settings.company_address,settings.company_phone,settings.company_email,policy.trn && `TRN: ${policy.trn}`].filter(Boolean).join(' | '),number:row.quotation_number,date:row.quotation_date,status:row.status,
    customer:[row.recipient_name,row.email,row.phone,row.address].filter(Boolean).join('\n'),items:row.items.map(item=>({description:[item.service_name,item.description,item.expected_processing_time && `Processing: ${item.expected_processing_time}`].filter(Boolean).join('\n'),quantity:item.quantity,rate:item.rate,total:item.total})),
    totals:[['Subtotal',row.subtotal],['Discount',-Number(row.discount)],[`VAT (${row.tax_rate}%)`,row.tax_amount],['Total',row.total]],sections,footer:row.document_footer},style,res);
}catch(error){next(error);}};
