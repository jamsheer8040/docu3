const { sequelize, Lead, Customer, User, LeadStatusHistory, LeadFollowUp, ServiceType } = require('../models');
const stages = ['New', 'Contacted', 'Qualified', 'Follow-up', 'Archived'];
const serialize = lead => ({ ...lead.toJSON(), status: ['Won', 'Lost'].includes(lead.status) ? 'Qualified' : lead.status });
async function quoteBadges(leads,tenant_id){
  if(!leads.length)return [];
  const db=require('../models');
  const quotes=await require('../utils/recordAccess').internalRead(()=>db.Quotation.findAll({where:{tenant_id,lead_id:{[require('sequelize').Op.in]:leads.map(row=>row.id)},sent_at:{[require('sequelize').Op.ne]:null}},attributes:['lead_id'],raw:true}));
  const sent=new Set(quotes.map(row=>row.lead_id));
  return leads.map(row=>({...serialize(row),quote_sent:sent.has(row.id)}));
}
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value;
function validateStage(data, existing) {
  const status = data.status || existing?.status || 'New';
  if (data.status !== undefined && !stages.includes(data.status)) throw new Error('Choose New, Contacted, Qualified, Follow-up or Archived.');
  if (status === 'Archived') {
    const reason = data.archive_reason === undefined ? existing?.archive_reason : data.archive_reason;
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 5000) throw new Error('Enter an archive reason up to 5,000 characters.');
    data.archive_reason = reason.trim();
  } else data.archive_reason = null;
  const due = data.next_follow_up_date === undefined ? existing?.next_follow_up_date : data.next_follow_up_date;
  if (due && !validDay(due)) throw new Error('Choose a valid follow-up date.');
  if (status === 'Follow-up' && !due) throw new Error('Choose a follow-up date before putting the lead on Follow-up.');
  // Scheduling timestamps are server-owned; unrelated lead edits retain them.
  delete data.follow_up_scheduled_at;
  if (status !== 'Follow-up') { data.next_follow_up_date = null; data.follow_up_scheduled_at = null; }
  else if (!existing || existing.status !== 'Follow-up' || due !== existing.next_follow_up_date) data.follow_up_scheduled_at = new Date();
}

exports.getLeads = async (req, res) => {
  try {
    const leads = await Lead.findAll({
      where: { tenant_id: req.user.tenant_id },
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'Creator', attributes: ['id', 'name'] },
        { model: User, as: 'AssignedStaff', attributes: ['id', 'name', 'avatar'], required: false, where: { tenant_id: req.user.tenant_id } },
        { model: Customer, as: 'Customer', attributes: ['id', 'name'] },
        { model: ServiceType, as: 'Service', attributes: ['id', 'name'] }
      ]
    });
    res.status(200).json({ success: true, data: await quoteBadges(leads,req.user.tenant_id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length > 10000 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
      return res.status(400).json({ success:false, message:'Choose up to 10,000 leads to export.' });
    }
    const { Op } = require('sequelize');
    const { sanitizeResponse, internalRead } = require('../utils/recordAccess');
    const leads = await Lead.findAll({ where:{ tenant_id:req.user.tenant_id, id:{[Op.in]:ids} },
      include:[{model:ServiceType,as:'Service',attributes:['id','name']}] });
    const rows = sanitizeResponse(leads);
    const staff = await internalRead(() => User.findAll({ where:{tenant_id:req.user.tenant_id}, attributes:['id','name'] }));
    const names = new Map(staff.map(user => [user.id,user.name]));
    const activities = await LeadFollowUp.findAll({ where:{tenant_id:req.user.tenant_id,lead_id:{[Op.in]:rows.map(row=>row.id)}}, attributes:['lead_id'] });
    const counts = new Map();
    for (const activity of activities) counts.set(activity.lead_id,(counts.get(activity.lead_id)||0)+1);
    const order = new Map(ids.map((id,index)=>[id,index]));
    rows.sort((a,b)=>order.get(a.id)-order.get(b.id));
    const workbook = new (require('exceljs').Workbook)();
    const sheet = workbook.addWorksheet('Leads');
    sheet.columns = [
      ['ID','id',10],['Customer / Company Name','company_name',30],['Contact Person','name',24],['Type','type',12],
      ['Phone / WhatsApp','phone',22],['Email','email',30],['Service','service',24],['Source','source',18],['Status','status',16],
      ['Assigned Staff','assigned',24],['Follow-up Count','followups',18],['Next Follow-up','next_follow_up_date',20],
      ['Added On','added',16],['Archive Reason','archive_reason',35],['Notes','notes',60]
    ].map(([header,key,width])=>({header,key,width}));
    const date = value => value ? new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)) : '';
    for (const row of rows) sheet.addRow({...row,type:row.lead_type==='Person'?'B2C':row.lead_type==='Company'?'B2B':'',
      service:row.Service?.name || '',assigned:names.get(row.assigned_user_id)||'',followups:counts.get(row.id)||0,added:date(row.created_at)});
    sheet.getColumn('phone').numFmt = '@';
    sheet.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
    sheet.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF4F7F73'}};
    sheet.views = [{state:'frozen',ySplit:1}];
    sheet.autoFilter = {from:'A1',to:'O1'};
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition',`attachment; filename="leads-${date(new Date())}.xlsx"`);
    res.set('Cache-Control','no-store');
    res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch(error) { res.status(500).json({success:false,message:error.message}); }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [
        { model: User, as: 'Creator', attributes: ['id', 'name'] },
        { model: User, as: 'AssignedStaff', attributes: ['id', 'name', 'avatar'], required: false, where: { tenant_id: req.user.tenant_id } },
        { model: ServiceType, as: 'Service', attributes: ['id', 'name'] }
      ]
    });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    // History has no tenant column; enforce ownership through its parent lead.
    const [history, followUps] = await Promise.all([
      LeadStatusHistory.findAll({ where: { lead_id: lead.id }, include: [
        { model: Lead, attributes: [], required: true, where: { tenant_id: req.user.tenant_id } }
      ], order: [['created_at', 'DESC'], ['id', 'DESC']] }),
      LeadFollowUp.findAll({ where: { lead_id: lead.id, tenant_id: req.user.tenant_id },
        order: [['occurred_at', 'DESC'], ['id', 'DESC']] })
    ]);
    res.status(200).json({ success: true, data: { ...(await quoteBadges([lead],req.user.tenant_id))[0], history, followUps } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    const data = {
      ...req.body,
      tenant_id: req.user.tenant_id,
      created_by: req.user.id
    };
    validateStage(data);
    const lead = await Lead.create(data);
    
    // Log initial status
    await LeadStatusHistory.create({
      lead_id: lead.id,
      previous_status: null,
      new_status: lead.status || 'New',
      archive_reason: lead.archive_reason,
      changed_by: req.user.id,
      update_source: req.body.update_source || 'Details'
    });

    res.status(201).json({ success: true, data: serialize(lead) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const result = await sequelize.transaction(async transaction => {
      const lead = await Lead.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!lead) { const error = new Error('Lead not found'); error.status = 404; throw error; }
      const previousStatus = lead.status;
      const { id, tenant_id, created_by, converted_by, converted_at, ...updateData } = req.body;
      validateStage(updateData, lead);
      await lead.update(updateData, { transaction });
      if (lead.status !== previousStatus) await LeadStatusHistory.create({
        lead_id: lead.id, previous_status: previousStatus, new_status: lead.status,
        archive_reason: lead.archive_reason,
        changed_by: req.user.id, update_source: req.body.update_source || 'Details'
      }, { transaction });
      return serialize(lead);
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.customer_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete a lead linked to a customer.'
      });
    }

    await lead.destroy();
    res.status(200).json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.convertLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (lead.customer_id) {
      return res.status(400).json({ success: false, message: 'Lead is already linked to a customer.' });
    }

    if (lead.status !== 'Won') {
      return res.status(400).json({ success: false, message: 'Lead must be in Won status to convert.' });
    }

    // Check if email already exists as a customer within the same tenant
    if (lead.email) {
      const existingCustomer = await Customer.findOne({ 
        where: { email: lead.email, tenant_id: req.user.tenant_id } 
      });
      if (existingCustomer) {
        return res.status(400).json({ success: false, message: 'A customer with this email already exists' });
      }
    }

    // Create the customer
    const customerName = lead.company_name || lead.name;
    const newCustomerData = {
      assigned_user_id: await require('../utils/customerSalesperson').customerSalesperson(req.body.assigned_user_id, req.user),
      name: customerName,
      email: lead.email || null,
      phone_whatsapp: lead.phone,
      notes: lead.notes || '',
      is_active: true,
      pricing_category: 'Normal',
      tenant_id: req.user.tenant_id
    };

    const customerData = await Customer.create(newCustomerData);
    
    // Link customer to lead and set converted_at
    await lead.update({ 
      customer_id: customerData.id,
      converted_by: req.user.id,
      converted_at: new Date()
    });

    res.status(200).json({ 
      success: true, 
      message: 'Lead successfully converted to Customer',
      data: {
        customer: customerData,
        lead: lead
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.trackWhatsappClick = async (req, res) => {
  try {
    const lead = await Lead.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    await lead.increment('whatsapp_clicks', { by: 1 });
    await lead.reload();

    res.status(200).json({ success: true, whatsapp_clicks: lead.whatsapp_clicks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addFollowUp = async (req, res) => {
  try {
    const ownedLead = await Lead.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!ownedLead) return res.status(404).json({ success: false, message: 'Lead not found' });
    let attachment = {};
    if (req.file) {
      const file = req.file;
      const bytes = file.buffer;
      const extension = require('path').extname(file.originalname).toLowerCase();
      const formats = {
        '.pdf': ['application/pdf', bytes.subarray(0, 5).toString() === '%PDF-'],
        '.png': ['image/png', bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
        '.jpg': ['image/jpeg', bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255],
        '.jpeg': ['image/jpeg', bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255],
        '.webp': ['image/webp', bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP']
      };
      const format = formats[extension];
      if (!format || !format[1] || format[0] !== file.mimetype) return res.status(400).json({ success: false, message: 'Choose a PDF, JPG, PNG or WEBP attachment.' });
      attachment = { attachment_name: require('path').basename(file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255), attachment_type: format[0], attachment_data: bytes };
    }
    const { channel, occurred_at, notes } = req.body;
    const date = new Date(occurred_at);
    if (!['Call', 'WhatsApp', 'Meeting', 'Email'].includes(channel) ||
        typeof occurred_at !== 'string' || !Number.isFinite(date.getTime()) || date > new Date() ||
        typeof notes !== 'string' || !notes.trim() || notes.length > 5000) {
      return res.status(400).json({ success: false, message: 'Choose a channel, a past or current date, and notes up to 5,000 characters.' });
    }
    const nextDate = req.body.next_follow_up_date;
    if (nextDate && !validDay(nextDate)) return res.status(400).json({ success: false, message: 'Choose a valid next follow-up date.' });
    const result = await sequelize.transaction(async transaction => {
      const lead = await Lead.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!lead) { const error = new Error('Lead not found'); error.status = 404; throw error; }
      const scheduledDate = req.body.complete_scheduled_date;
      if (lead.status === 'Archived') { const error = new Error('Reopen this lead before logging a follow-up.'); error.status = 409; throw error; }
      if (scheduledDate && (lead.status !== 'Follow-up' || lead.next_follow_up_date !== scheduledDate)) {
        const error = new Error('The schedule changed. Refresh the lead before recording this follow-up.'); error.status = 409; throw error;
      }
      const activity = await LeadFollowUp.create({ lead_id: lead.id, tenant_id: req.user.tenant_id,
        created_by: req.user.id, channel, occurred_at: date, notes: notes.trim(), ...attachment }, { transaction });
      if (scheduledDate || nextDate) {
        const previousStatus = lead.status;
        const status = nextDate ? 'Follow-up' : 'Qualified';
        await lead.update({ status, next_follow_up_date: nextDate || null, follow_up_scheduled_at: nextDate ? new Date() : null }, { transaction });
        if (status !== previousStatus) await LeadStatusHistory.create({ lead_id: lead.id, previous_status: previousStatus,
          new_status: status, changed_by: req.user.id, update_source: 'Details' }, { transaction });
      }
      const publicActivity = activity.toJSON();
      delete publicActivity.attachment_data;
      return { activity: publicActivity, lead: serialize(lead) };
    });
    res.status(201).json({ success: true, data: result.activity, lead: result.lead });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

exports.downloadFollowUpAttachment = async (req, res) => {
  try {
    const lead = await Lead.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const activity = await LeadFollowUp.findOne({ where: { id: req.params.activityId, lead_id: lead.id, tenant_id: req.user.tenant_id }, attributes: ['id', 'attachment_name', 'attachment_type', 'attachment_data'] });
    if (!activity?.attachment_data) return res.status(404).json({ success: false, message: 'Attachment not found' });
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.attachment(activity.attachment_name).type(activity.attachment_type).send(activity.attachment_data);
  } catch (error) {
    res.status(400).json({ success: false, message: 'Unable to download attachment.' });
  }
};
