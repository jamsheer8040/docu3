const { Op } = require('sequelize');
const db = require('../models');
const f = require('../utils/managementFinance');
const engine = require('../utils/commissionEngine');
const { internalRead } = require('../utils/recordAccess');
const { modulePermission, canRecord } = require('../utils/permissionRules');
function access(user) {
  if (user.Role?.type === 'CustomerPortal') return { view: 'none', manage: false, pay: false };
  if (['Admin', 'Developer'].includes(user.Role?.name)) return { view: 'all', manage: true, pay: true, approve: true };
  const p = modulePermission(user.Role?.permissions, 'commissions');
  return { view: p.rules?.list || (p.read ? 'own' : 'none'), manage: p.manage_rules === true, pay: p.pay === true };
}
exports.access = access;
exports.requireAccess = action => (req, res, next) => {
  req.commissionAccess = access(req.user);
  if (action === 'view' ? ['own', 'all'].includes(req.commissionAccess.view) : req.commissionAccess[action] && req.commissionAccess.view === 'all') return next();
  return res.status(403).json({ success: false, message: 'Commission permission is required for this action.' });
};
const handler = fn => async (req, res) => { try { await fn(req, res); } catch (error) { f.error(res, error, 'Commission operation failed. Please try again.'); } };
const ok = (res, data) => res.json({ success: true, data });
function bounds(query) {
  const where = {};
  if (query.from) where[Op.gte] = f.date(query.from);
  if (query.to) where[Op.lte] = f.date(query.to);
  if (query.from && query.to && query.from > query.to) f.fail('Start date must be before end date.');
  return Object.getOwnPropertySymbols(where).length ? where : null;
}
async function directory(tenant_id, transaction) {
  return internalRead(async () => {
    const staff = await db.User.findAll({ where: { tenant_id }, attributes: ['id', 'name', 'role_id', 'is_active', 'joining_date'], include: [{ model: db.Role, attributes: ['id', 'type', 'tenant_id'], required: false }], transaction });
    const roles = await db.Role.findAll({ where: { type: 'Internal', [Op.or]: [{ tenant_id }, { tenant_id: null }] }, attributes: ['id', 'name'], transaction });
    const services = await db.ServiceType.findAll({ where: { tenant_id }, attributes: ['id', 'name'], transaction });
    return { staff: staff.filter(s => s.Role?.type !== 'CustomerPortal' && (!s.Role?.tenant_id || s.Role.tenant_id === tenant_id)).map(s => ({ id: s.id, name: s.name, role_id: s.role_id, is_active: s.is_active })), roles, services };
  });
}
exports.options = handler(async (req, res) => {
  const choices = req.commissionAccess.view === 'all' ? await directory(req.user.tenant_id) : { staff: [{ id: req.user.id, name: req.user.name }], roles: [], services: [] };
  ok(res, { ...choices, access: req.commissionAccess });
});
exports.rules = handler(async (req, res) => ok(res, await db.CommissionRule.findAll({ where: { tenant_id: req.user.tenant_id }, order: [['priority', 'ASC'], ['id', 'ASC']] })));
exports.criteria = handler(async (req,res) => {
  const config=await db.SystemConfig.findOne({where:{tenant_id:req.user.tenant_id,key:'simple_commission_criteria'}});
  let saved; try {saved=JSON.parse(config?.value || 'null');} catch {}
  const rule=saved?.rule_id ? await db.CommissionRule.findOne({where:{tenant_id:req.user.tenant_id,id:saved.rule_id}}) : null;
  ok(res,{enabled:rule?.active ?? false,min_service_charge:Number(rule?.min_service_charge || 0),percentage:Number(rule?.percentage || 0),configured:!!rule});
});
exports.saveCriteria = handler(async (req,res) => {
  if(typeof req.body.enabled!=='boolean') f.fail('Choose whether commission is enabled.');
  const threshold=f.units(req.body.min_service_charge,'Minimum service charge',true), percentage=f.units(req.body.percentage,'Commission percentage',!req.body.enabled);
  if(percentage>10000 || threshold>999999999999) f.fail('Use a percentage up to 100 and a supported threshold.');
  await db.sequelize.transaction(async transaction=>{
    await require('../utils/commissionFeature').lockEnabled(req.user.tenant_id,transaction);
    const tenant_id=req.user.tenant_id;
    await db.Tenant.findOne({where:{id:tenant_id},transaction,lock:transaction.LOCK.UPDATE});
    await require('../utils/commissionFeature').activate(tenant_id,transaction);
    const rule=await db.CommissionRule.create({tenant_id,name:'Service Charge Commission',active:req.body.enabled,percentage:percentage/100,min_service_charge:threshold/100,participation:'customer_owner',effective_from:'2000-01-01',created_by:req.user.id},{transaction});
    const where={tenant_id,key:'simple_commission_criteria'};
    const [config]=await db.SystemConfig.findOrCreate({where,defaults:{...where,value:'{}'},transaction});
    await config.update({value:JSON.stringify({rule_id:rule.id})},{transaction});
  });
  ok(res,{saved:true});
});
exports.review = handler(async (req,res) => {
  const decision=req.body.decision;
  if(!['Approved','Rejected'].includes(decision)) f.fail('Choose Approve or Reject.');
  const reason=String(req.body.reason || '').trim();
  if(decision==='Rejected' && (reason.length<3 || reason.length>500)) f.fail('Enter a rejection reason of 3â€“500 characters.');
  const result=await db.sequelize.transaction({isolationLevel:'READ COMMITTED'},async transaction=>{
    await require('../utils/commissionFeature').lockEnabled(req.user.tenant_id,transaction);
    const tenant_id=req.user.tenant_id;
    const entry=await db.CommissionEntry.findOne({where:{tenant_id,id:f.id(req.params.id,'commission')},transaction});
    if(!entry) f.fail('Commission not found.',404);
    const invoice=await internalRead(()=>db.Invoice.findOne({where:{tenant_id,id:entry.invoice_id},transaction,lock:transaction.LOCK.UPDATE}));
    await entry.reload({transaction,lock:transaction.LOCK.UPDATE});
    if(entry.voided_at || !invoice || !['Issued','Overdue','Partially Paid','Paid'].includes(invoice.status)) f.fail('Only an active issued invoice commission can be reviewed.',409);
    if(entry.approval_status===decision) return {id:entry.id,status:decision};
    if(entry.approval_status==='Rejected') f.fail('Rejected commission must be recalculated and resubmitted from the invoice.',409);
    const paid=await db.CommissionPayment.count({where:{tenant_id,entry_id:entry.id,reversed_at:null},transaction});
    if(paid) f.fail('Reverse recorded commission payments before changing approval.',409);
    if(!entry.rule_snapshot.simple_criteria) f.fail('Recalculate this legacy commission using the new criteria before approval.',409);
    if(decision==='Approved') {
      const expense=await internalRead(()=>db.Expense.create({tenant_id,description:`Approved commission: ${entry.staff_name} / ${entry.invoice_number}`,amount:entry.amount,paid_amount:0,status:'Unpaid',notes:`Commission approval #${entry.id}`,created_by:req.user.id},{transaction}));
      await entry.update({approval_expense_id:expense.id},{transaction});
    } else await internalRead(()=>engine.voidExpenses([entry],transaction));
    await entry.update({approval_status:decision,reviewed_by:req.user.id,reviewed_at:new Date(),rejection_reason:decision==='Rejected'?reason:null},{transaction});
    return {id:entry.id,status:decision};
  });
  ok(res,result);
});
exports.statement = handler(async (req, res) => {
  const tenant_id = req.user.tenant_id, where = { tenant_id }, period = bounds(req.query);
  if (req.commissionAccess.view !== 'all') where.staff_id = req.user.id;
  else if (req.query.staff_id) where.staff_id = f.id(req.query.staff_id, 'staff');
  if (period) where.invoice_date = period;
  const entries = await db.CommissionEntry.findAll({ where, order: [['invoice_date', 'DESC'], ['id', 'DESC']], limit: 5001 });
  if (entries.length > 5000) f.fail('More than 5,000 entries match. Choose a smaller date range or one employee.');
  const invoices = await internalRead(() => db.Invoice.findAll({ where: { tenant_id, id: { [Op.in]: [...new Set(entries.map(e => e.invoice_id))] } }, attributes: ['id', 'total', 'paid_amount', 'status'] }));
  const payments = await db.CommissionPayment.findAll({ where: { tenant_id, entry_id: { [Op.in]: entries.map(e => e.id) } }, order: [['id', 'DESC']] });
  const totals = { eligible_count:0, eligible:0, pending:0, approved:0, paid:0, balance:0, payable:0, rejected:0, voided:0 };
  const data = entries.map(entry => {
    const history=payments.filter(p=>p.entry_id===entry.id), paid=history.filter(p=>!p.reversed_at).reduce((sum,p)=>sum+engine.cents(p.amount),0), amount=engine.cents(entry.amount);
    const invoice=invoices.find(i=>String(i.id)===String(entry.invoice_id));
    const approved=entry.approval_status==='Approved' && !!entry.approval_expense_id;
    const legacy=!entry.rule_snapshot.simple_criteria;
    const balance=approved && !entry.voided_at ? Math.max(0,amount-paid) : 0;
    const payable=balance && engine.fullyPaid(invoice) ? balance : 0;
    const status=entry.voided_at?'Voided':legacy?'Legacy — needs review':entry.approval_status==='Rejected'?'Rejected':approved?(paid>=amount?'Paid':paid?'Partially paid':'Approved'):'Pending approval';
    if(entry.voided_at) totals.voided+=amount;
    else {
      totals.paid+=paid;
      if(!legacy){totals.eligible_count++;totals.eligible+=amount;}
      if(entry.approval_status==='Rejected') totals.rejected+=amount;
      else if(!legacy) {if(approved){totals.approved+=amount;totals.balance+=balance;totals.payable+=payable;}else totals.pending+=amount;}
    }
    return {id:entry.id,staff_id:entry.staff_id,staff_name:entry.staff_name,invoice_id:entry.invoice_id,invoice_number:entry.invoice_number,invoice_date:entry.invoice_date,
      rule_name:entry.rule_snapshot.name,percentage:entry.rule_snapshot.percentage,service_charge:entry.service_charge,invoice_total:entry.invoice_total,amount:entry.amount,
      paid:paid/100,balance:balance/100,payable:payable/100,approval_status:entry.approval_status,status,reviewed_at:entry.reviewed_at,reviewed_by:entry.reviewed_by,rejection_reason:entry.rejection_reason,void_reason:entry.void_reason,
      can_approve:!entry.voided_at && !legacy && entry.approval_status==='Pending',can_reject:!entry.voided_at && !legacy && entry.approval_status!=='Rejected' && !paid,
      payments:history.map(p=>({id:p.id,amount:p.amount,payment_date:p.payment_date,notes:p.notes,reversed_at:p.reversed_at,reversal_reason:p.reversal_reason}))};
  });
  const summary=Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,key==='eligible_count'?value:value/100]));
  ok(res,{entries:data,totals:summary,access:req.commissionAccess});
});
exports.calculateExisting = handler(async (req, res) => {
  const configured=await db.SystemConfig.findOne({where:{tenant_id:req.user.tenant_id,key:'simple_commission_criteria'}});
  if(!configured) f.fail('Configure simple commission criteria before calculating existing invoices.');
  const from = f.date(req.body.from), to = f.date(req.body.to);
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 366) f.fail('Choose a range of up to one year.');
  const tenant_id = req.user.tenant_id;
  const invoices = await internalRead(() => db.Invoice.findAll({ where: { tenant_id, created_at: { [Op.gte]: new Date(from + 'T00:00:00+04:00'), [Op.lt]: new Date(Date.parse(to + 'T00:00:00+04:00') + 86400000) } }, attributes: ['id'], limit: 501, order: [['id', 'ASC']] }));
  if (invoices.length > 500) f.fail('More than 500 invoices match. Choose a smaller date range.');
  let created = 0;
  // One transaction makes a failed backfill retryable without a partially applied range.
  await db.sequelize.transaction({ isolationLevel: 'READ COMMITTED' }, async transaction => {
    await require('../utils/commissionFeature').lockEnabled(req.user.tenant_id,transaction);
    for (const row of invoices) {
      const invoice = await internalRead(() => db.Invoice.findOne({ where: { id: row.id, tenant_id }, transaction, lock: transaction.LOCK.UPDATE }));
      if (invoice) created += (await engine.syncInvoice(invoice, transaction, 'Historical calculation', { retryEmpty: true })).created;
    }
  });
  ok(res, { invoices_checked: invoices.length, entries_created: created });
});
exports.pay = handler(async (req, res) => {
  const tenant_id = req.user.tenant_id, entry_id = f.id(req.params.id, 'commission'), amount = f.units(req.body.amount), payment_date = f.date(req.body.payment_date), account_id = f.id(req.body.account_id, 'wallet');
  const key = req.get('Idempotency-Key');
  if (!key || !/^[a-zA-Z0-9_-]{8,80}$/.test(key)) f.fail('A valid payment request key is required.');
  const result = await db.sequelize.transaction({ isolationLevel: 'READ COMMITTED' }, async transaction => {
    await require('../utils/commissionFeature').lockEnabled(req.user.tenant_id,transaction);
    const entry = await db.CommissionEntry.findOne({ where: { id: entry_id, tenant_id }, transaction });
    if (!entry) f.fail('Commission not found.', 404);
    const invoice = await internalRead(() => db.Invoice.findOne({ where: { id: entry.invoice_id, tenant_id }, transaction, lock: transaction.LOCK.UPDATE }));
    await entry.reload({ transaction, lock: transaction.LOCK.UPDATE });
    const existing = await db.CommissionPayment.findOne({ where: { tenant_id, request_key: key }, transaction });
    if (existing) {
      if (existing.entry_id !== entry.id || engine.cents(existing.amount) !== amount || existing.account_id !== account_id || existing.payment_date !== payment_date || existing.reversed_at) f.fail('This request key has already been used. Refresh before making another payment.', 409);
      return { id: existing.id };
    }
    if (entry.approval_status !== 'Approved' || !entry.approval_expense_id) f.fail('Admin approval is required before paying commission.',409);
    if (entry.voided_at || !engine.fullyPaid(invoice)) f.fail('Commission can only be released after the invoice is fully paid.');
    if (entry.rule_snapshot.recipient_source !== 'customer_owner') f.fail('Recalculate this invoice under the single customer salesperson rule before paying commission.', 409);
    const recipients = await db.CommissionEntry.count({ where: { tenant_id, invoice_id: entry.invoice_id, voided_at: null }, transaction });
    if (recipients !== 1) f.fail('An invoice can have only one commission recipient. Correct its calculation before paying.', 409);
    const payments = await db.CommissionPayment.findAll({ where: { tenant_id, entry_id, reversed_at: null }, transaction });
    const paid = payments.reduce((sum, p) => sum + engine.cents(p.amount), 0);
    if (amount > engine.cents(entry.amount) - paid) f.fail('Payment exceeds the remaining commission.');
    const wallet = await f.wallet(req, account_id, transaction);
    if (amount > Math.round(Number(wallet.balance) * 100)) f.fail('The selected wallet has insufficient balance.');
    const payment = await db.CommissionPayment.create({ tenant_id, entry_id, staff_id: entry.staff_id, amount: amount / 100, payment_date, account_id, request_key: key, created_by: req.user.id, notes: String(req.body.notes || '').slice(0, 255) }, { transaction });
    await internalRead(async () => {
      const expense = await db.Expense.findOne({where:{tenant_id,id:entry.approval_expense_id},transaction,lock:transaction.LOCK.UPDATE});
      if (!expense) f.fail('Commission expense is missing. Contact the administrator.',409);
      const expensePaid=engine.cents(expense.paid_amount)+amount;
      await expense.update({paid_amount:expensePaid/100,status:expensePaid>=engine.cents(expense.amount)?'Paid':'Partially Paid',payment_date,account_id},{transaction,commissionReversal:true});
      const balance = Math.round(Number(wallet.balance) * 100) - amount;
      const ledger = await db.WalletTransaction.create({ tenant_id, account_id, type: 'Expense', direction: 'Out', amount: amount / 100, balance_after: balance / 100, reference_type: 'Commission', reference_id: payment.id, description: `Commission: ${entry.staff_name} / ${entry.invoice_number}` }, { transaction });
      await wallet.update({ balance: balance / 100 }, { transaction });
      await payment.update({ expense_id: expense.id, transaction_id: ledger.id }, { transaction });
    });
    return { id: payment.id };
  });
  ok(res, result);
});
exports.reverse = handler(async (req, res) => {
  const tenant_id = req.user.tenant_id, id = f.id(req.params.id, 'payment'), reason = String(req.body.reason || '').trim();
  if (reason.length < 3 || reason.length > 255) f.fail('Enter a reversal reason (3â€“255 characters).');
  const result = await db.sequelize.transaction({ isolationLevel: 'READ COMMITTED' }, async transaction => {
    await require('../utils/commissionFeature').lockEnabled(req.user.tenant_id,transaction);
    const initial = await db.CommissionPayment.findOne({ where: { id, tenant_id }, transaction });
    if (!initial) f.fail('Payment not found.', 404);
    const entry = await db.CommissionEntry.findOne({ where: { id: initial.entry_id, tenant_id }, transaction });
    await internalRead(() => db.Invoice.findOne({ where: { id: entry.invoice_id, tenant_id }, transaction, lock: transaction.LOCK.UPDATE }));
    await initial.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (initial.reversed_at) return { id, already_reversed: true };
    const wallet = await f.wallet(req, initial.account_id, transaction);
    await internalRead(async () => {
      const balance = Math.round(Number(wallet.balance) * 100) + engine.cents(initial.amount);
      const ledger = await db.WalletTransaction.create({ tenant_id, account_id: wallet.id, type: 'Income', direction: 'In', amount: initial.amount, balance_after: balance / 100, reference_type: 'CommissionReversal', reference_id: id, description: reason }, { transaction });
      await wallet.update({ balance: balance / 100 }, { transaction });
      if (entry.approval_expense_id && String(entry.approval_expense_id)===String(initial.expense_id)) {
        const expense=await db.Expense.findOne({where:{tenant_id,id:entry.approval_expense_id},transaction,lock:transaction.LOCK.UPDATE});
        if (!expense) f.fail('Commission expense is missing.',409);
        const paid=Math.max(0,engine.cents(expense.paid_amount)-engine.cents(initial.amount));
        await expense.update({paid_amount:paid/100,status:paid?'Partially Paid':'Unpaid'},{transaction,commissionReversal:true});
      } else {
        // Preserve legacy payment history; reversing it removes only its historical expense.
        await db.Expense.update({amount:0,paid_amount:0,status:'Unpaid'}, {where:{id:initial.expense_id,tenant_id},transaction,commissionReversal:true});
      }
      await initial.update({ reversed_at: new Date(), reversed_by: req.user.id, reversal_reason: reason, reversal_transaction_id: ledger.id }, { transaction });
    });
    return { id };
  });
  ok(res, result);
});
// Invoice detail controls use invoice detail scope as well as commission scope.
async function invoiceForCommission(req, transaction, lock = false) {
  const invoice = await db.Invoice.findOne({ where: { id: f.id(req.params.id, 'invoice'), tenant_id: req.user.tenant_id }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!invoice) f.fail('Invoice not found or not accessible.', 404);
  if (!canRecord(req.user, 'invoices', 'detail', invoice)) f.fail('Invoice details permission is required.', 403);
  return invoice;
}
const settingVersion = setting => setting?.version || null;
async function invoicePanel(req, invoice, transaction) {
  const tenant_id=req.user.tenant_id,invoice_id=invoice.id;
  const context=await engine.invoiceContext(invoice,transaction);
  const entries=await db.CommissionEntry.findAll({where:{tenant_id,invoice_id,voided_at:null},transaction});
  const entry=entries.length===1?entries[0]:null;
  const recipient_id=entry?.staff_id || context.person?.id;
  if(req.commissionAccess.view!=='all' && Number(recipient_id)!==Number(req.user.id)) f.fail('Only your own invoice commission is visible.',403);
  const rule=context.rules[0];
  const check=context.prospective && context.person && rule ? engine.evaluateRule(rule,context.person,invoice,context.lines,context.day) : {eligible:false,reason:context.reason || 'Configure simple commission criteria first.'};
  const approved=entry?.approval_status==='Approved' && !entry.voided_at;
  const legacyPaid=entry && !entry.rule_snapshot.simple_criteria ? await db.CommissionPayment.sum('amount',{where:{tenant_id,entry_id:entry.id,reversed_at:null},transaction}) : 0;
  const commission=approved?engine.cents(entry.amount):engine.cents(legacyPaid || 0);
  const total=engine.cents(invoice.total),cost=engine.cents(invoice.cost_total), tax=engine.cents(invoice.tax);
  const cancelled=invoice.status==='Cancelled';
  return {eligible:!cancelled && (entry?true:check.eligible),reason:cancelled?'Cancelled invoices do not earn commission.':entry?.rejection_reason || (entry?'Saved commission for this invoice. Only approval recognises an expense.':check.reason),
    status:entry && !entry.rule_snapshot.simple_criteria?'Legacy — recalculate':entry?.approval_status || 'Draft',entry_id:entry?.id || null,recipient:entry?{id:entry.staff_id,name:entry.staff_name}:context.person?{id:context.person.id,name:context.person.name}:null,
    service_charge:entry?Number(entry.service_charge):(check.base || 0)/100,percentage:Number(entry?.rule_snapshot.percentage ?? rule?.percentage ?? 0),
    calculated_amount:entry?Number(entry.amount):(check.amount || 0)/100,discount:Number(invoice.discount || 0),
    can_resubmit:context.prospective && !!entry && entry.approval_status==='Rejected' && req.commissionAccess.manage && canRecord(req.user,'invoices','edit',invoice),
    release_status:engine.fullyPaid(invoice)?'Invoice fully paid — approved balance can be paid.':'Commission payment waits for full invoice payment.',
    profit:{total:total/100,cost:cost/100,tax:tax/100,other_expenses:0,commission:commission/100,net_profit:(total-cost-tax-commission)/100,projected_net_profit:(total-cost-tax-(entry?.approval_status==='Rejected'?0:engine.cents(entry?.amount ?? ((check.amount || 0)/100))))/100}};
}
exports.invoiceCommission = handler(async (req, res) => {
  // A repeatable read keeps saved amount, revision and payment lock consistent.
  const data = await db.sequelize.transaction(async transaction => invoicePanel(req, await invoiceForCommission(req, transaction), transaction));
  ok(res, data);
});
exports.saveInvoiceCommission = handler(async (req,res)=>{
  const data=await db.sequelize.transaction({isolationLevel:'READ COMMITTED'},async transaction=>{
    await require('../utils/commissionFeature').lockEnabled(req.user.tenant_id,transaction);
    const invoice=await invoiceForCommission(req,transaction,true);
    if(!canRecord(req.user,'invoices','edit',invoice)) f.fail('Invoice edit permission is required.',403);
    if(!await require('../utils/commissionFeature').eligibleInvoice(invoice,transaction)) f.fail('This invoice predates commission activation. Historical transactions remain unchanged.',409);
    const entry=await db.CommissionEntry.findOne({where:{tenant_id:req.user.tenant_id,invoice_id:invoice.id,voided_at:null},transaction});
    if(entry && entry.approval_status!=='Rejected') f.fail('Only rejected commission can be resubmitted. Other amounts recalculate when the invoice changes.',409);
    await engine.syncInvoice(invoice,transaction,'Commission resubmitted for approval',{force:true});
    return invoicePanel(req,invoice,transaction);
  });
  ok(res,data);
});
// Old clients must not silently reintroduce the removed formula system.
exports.saveRule = handler(async()=>f.fail('Use the simple commission criteria settings instead.',409));
