const Excel = require('exceljs');
const { sequelize, Lead, User, Role, Tenant, ServiceType, LeadStatusHistory } = require('../models');
const { internalRead } = require('./recordAccess');
const headers = ['Customer / Company Name','Contact Person','Type','Phone / WhatsApp','Email','Service','Source','Status','Assigned Staff','Next Follow-up','Added On','Archive Reason','Notes'];
const key = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
function text(cell) {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString().slice(0,10);
    if (value.richText) return value.richText.map(part=>part.text).join('').trim();
    if (value.text) return String(value.text).trim();
    throw new Error('Use plain values instead of formulas.');
  }
  return String(value).trim();
}
function phone(value) {
  let digits = value.replace(/\D/g,'');
  if (digits.startsWith('00971')) digits=digits.slice(2);
  if (/^05\d{8}$/.test(digits)) digits='971'+digits.slice(1);
  else if (/^5\d{8}$/.test(digits)) digits='971'+digits;
  return /^9715\d{8}$/.test(digits) ? '+'+digits : value;
}
function day(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Dates must use YYYY-MM-DD.');
  const date=new Date(value+'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw new Error('Invalid date.');
  return value;
}
async function parse(buffer,user,transaction) {
  const workbook=new Excel.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw new Error('Upload a valid .xlsx workbook.'); }
  const sheet=workbook.getWorksheet('Leads') || workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw new Error('The workbook has no lead rows.');
  if (sheet.rowCount > 1001 || sheet.columnCount > 50) throw new Error('Use up to 1,000 leads and 50 columns per file.');
  const columns=new Map();
  sheet.getRow(1).eachCell((cell,index)=>{ const name=key(text(cell)); if(columns.has(name))throw new Error('Duplicate column header.'); columns.set(name,index); });
  for (const name of ['Customer / Company Name','Phone / WhatsApp']) if(!columns.has(key(name))) throw new Error(`Missing column: ${name}. Download the template.`);
  const [services,staff,existing] = await internalRead(()=>Promise.all([
    ServiceType.findAll({where:{tenant_id:user.tenant_id,is_active:true},transaction}),
    User.findAll({where:{tenant_id:user.tenant_id,is_active:true},attributes:['id','name','email','role_id'],include:[{model:Role,attributes:['type']}],transaction}),
    Lead.findAll({where:{tenant_id:user.tenant_id},attributes:['phone'],transaction})
  ]));
  const phones=new Set(existing.map(row=>phone(row.phone).replace(/\D/g,'')));
  const seen=new Set(), rows=[], errors=[];
  for(let index=2;index<=sheet.rowCount;index++) {
    const row=sheet.getRow(index);
    if (!row.values.some(value=>value!=null && String(value).trim()))continue;
    try {
      const get=name=>columns.has(key(name)) ? text(row.getCell(columns.get(key(name)))) : '';
      const company_name=get('Customer / Company Name'), number=phone(get('Phone / WhatsApp'));
      if(!company_name || !number)throw new Error('Customer / Company Name and Phone / WhatsApp are required.');
      const status=get('Status') || 'New';
      if(!['New','Contacted','Qualified','Follow-up','Archived'].includes(status))throw new Error('Choose New, Contacted, Qualified, Follow-up or Archived.');
      const next=get('Next Follow-up'), archive_reason=get('Archive Reason');
      if(status==='Follow-up' && !next)throw new Error('Follow-up status requires a Next Follow-up date.');
      if(next)day(next);
      if(status==='Archived' && !archive_reason)throw new Error('Archived status requires an Archive Reason.');
      const type=get('Type');
      if(type && !['Person','Company','B2B','B2C'].includes(type))throw new Error('Type must be B2B, B2C, Person or Company.');
      const serviceName=get('Service'), staffName=get('Assigned Staff');
      const service=serviceName ? services.filter(item=>key(item.name)===key(serviceName)) : [];
      const assigned=staffName ? staff.filter(item=>(key(item.name)===key(staffName) || item.email?.toLowerCase()===staffName.toLowerCase()) && item.Role?.type!=='CustomerPortal') : [];
      if(serviceName && service.length!==1)throw new Error('Service must match an active service in this workspace.');
      if(staffName && assigned.length!==1)throw new Error('Assigned Staff must match one active internal staff name or email.');
      const data={company_name,name:get('Contact Person') || null,phone:number,email:get('Email') || null,source:get('Source') || null,status,
        lead_type:['Person','B2C'].includes(type)?'Person':type?'Company':null,service_id:service[0]?.id || null,assigned_user_id:assigned[0]?.id || null,
        next_follow_up_date:status==='Follow-up'?next:null,follow_up_scheduled_at:status==='Follow-up'?new Date():null,
        archive_reason:status==='Archived'?archive_reason:null,notes:get('Notes') || null,tenant_id:user.tenant_id,created_by:user.id};
      for(const [field,max] of [['company_name',150],['name',150],['phone',20],['email',100],['source',100],['archive_reason',5000],['notes',20000]]) if(data[field]?.length>max)throw new Error(`${field} exceeds ${max} characters.`);
      if(data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw new Error('Invalid email address.');
      if(get('Added On'))data.created_at=new Date(day(get('Added On'))+'T09:00:00+04:00');
      const normalized=number.replace(/\D/g,'') || number;
      if(normalized!=='0000' && (phones.has(normalized) || seen.has(normalized)))throw new Error('Phone number already exists in this workspace or file.');
      seen.add(normalized);
      rows.push({row:index,data,service:serviceName,assigned:staffName});
    }catch(error){errors.push({row:index,message:error.message});}
  }
  if(!rows.length && !errors.length)throw new Error('The workbook has no lead rows.');
  return {rows,errors};
}
exports.template = async (req,res,next) => {
  try {
    const workbook=new Excel.Workbook(); const sheet=workbook.addWorksheet('Leads');
    sheet.columns=headers.map(header=>({header,width:header==='Notes'?50:26}));
    sheet.getRow(1).font={bold:true}; sheet.views=[{state:'frozen',ySplit:1}];
    sheet.getColumn(4).numFmt='@';
    const guide=workbook.addWorksheet('Instructions');
    ['Required: Customer / Company Name and Phone / WhatsApp. Up to 1,000 rows.','Use YYYY-MM-DD dates. Recognizable UAE mobile numbers are normalized to +971.','Status: New, Contacted, Qualified, Follow-up or Archived. Blank defaults to New.','Follow-up requires Next Follow-up. Archived requires Archive Reason.','Type: B2B / Company or B2C / Person. Optional.','Service and Assigned Staff must already exist in the current workspace. Staff email can disambiguate names.','Duplicate phone numbers are blocked, except the 0000 placeholder. Existing records are never updated.','Added On is optional; blank uses the import date.','Follow-up Count and ID in downloaded exports are informational and are not imported. Activity history is not imported by this template.'].forEach(note=>guide.addRow([note]));
    guide.getColumn(1).width=120;
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition','attachment; filename="lead-import-template.xlsx"');res.set('Cache-Control','no-store');
    res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  }catch(error){next(error);}
};
exports.run = async (req,res) => {
  try {
    if(!req.file) return res.status(400).json({success:false,message:'Choose an .xlsx file.'});
    const apply=req.path.endsWith('/confirm');
    const result=await sequelize.transaction(async transaction=>{
      if(apply)await Tenant.findByPk(req.user.tenant_id,{transaction,lock:transaction.LOCK.UPDATE});
      const result=await parse(req.file.buffer,req.user,transaction);
      if(apply && !result.errors.length) for(const row of result.rows){
        const lead=await Lead.create(row.data,{transaction});
        await LeadStatusHistory.create({lead_id:lead.id,new_status:lead.status,previous_status:null,archive_reason:lead.archive_reason,changed_by:req.user.id,update_source:'System'},{transaction});
      }
      return result;
    });
    const preview=result.rows.map(row=>({row:row.row,name:row.data.company_name,phone:row.data.phone,service:row.service,status:row.data.status,assigned:row.assigned}));
    res.status(apply && result.errors.length?400:200).json({success:!apply || !result.errors.length,data:{total:result.rows.length+result.errors.length,valid:result.rows.length,errors:result.errors,preview:preview.slice(0,100),imported:apply && !result.errors.length?result.rows.length:0}});
  }catch(error){res.status(400).json({success:false,message:error.message});}
};
