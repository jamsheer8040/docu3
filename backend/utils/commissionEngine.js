const { createHash } = require('node:crypto');
const { Op } = require('sequelize');
const db = require('../models');
const { internalRead } = require('./recordAccess');
const { fail, units } = require('./managementFinance');
const issued = ['Issued', 'Partially Paid', 'Paid', 'Overdue'];
function businessDay(value) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }
function cents(value) { return units(value, 'Amount', true); }
function fullyPaid(invoice) { return invoice && issued.includes(invoice.status) && cents(invoice.total) > 0 && cents(invoice.paid_amount) >= cents(invoice.total); }
function formula(base, percentage) { return Number((BigInt(base) * BigInt(units(percentage, 'Percentage', true)) + 5000n) / 10000n); }
function evaluateRule(rule, staff, invoice, lines, day) {
  const no = reason => ({ eligible: false, reason });
  if (rule.simple_criteria) {
    const gross = lines.reduce((sum, line) => sum + line.charge, 0);
    if (!Number.isSafeInteger(gross)) fail('Service charge total exceeds the supported range.');
    const base = Math.max(0, gross - cents(invoice.discount));
    if (!rule.active) return no('Commission criteria are disabled.');
    if (base <= 0 || base < cents(rule.min_service_charge)) return no('Service charge after discount is below the eligibility threshold or zero.');
    return { eligible:true, reason:'Service charge after discount meets the eligibility threshold.', base, amount:formula(base,rule.percentage) };
  }
  return no('Legacy formula calculations have been replaced by simple commission criteria.');
}
function matches(...args) { const result = evaluateRule(...args); return result.eligible ? { base: result.base, amount: result.amount } : null; }

async function invoiceContext(invoice, transaction, items) {
  return internalRead(async () => {
    const tenant_id = invoice.tenant_id;
    items ||= await db.InvoiceItem.findAll({ where: { tenant_id, invoice_id: invoice.id }, order: [['id', 'ASC']], transaction });
    const lines = items.map(item => ({ charge: cents(item.service_charge) * Number(item.quantity) }));
    if (lines.some(line => !Number.isSafeInteger(line.charge) || line.charge < 0)) fail('Invalid invoiced service charge or quantity.');
    const customer = await db.Customer.findOne({ where: { tenant_id, id: invoice.customer_id }, attributes: ['id', 'assigned_user_id'], transaction });
    const person = customer?.assigned_user_id ? await db.User.findOne({ where: { tenant_id, id: customer.assigned_user_id, is_active: true }, attributes: ['id', 'name', 'role_id', 'joining_date'], include: [{ model: db.Role, attributes: ['id', 'type', 'tenant_id'], required: false }], transaction }) : null;
    const validPerson = person && person.Role?.type !== 'CustomerPortal' && (!person.Role?.tenant_id || Number(person.Role.tenant_id) === Number(tenant_id)) && (!person.role_id || person.Role);
    const config = await db.SystemConfig.findOne({where:{tenant_id,key:'simple_commission_criteria'},transaction});
    let criteria; try { criteria=JSON.parse(config?.value || 'null'); } catch {}
    // Legacy formulas remain audit records, but cannot produce new awards.
    const savedRule = criteria?.rule_id ? await db.CommissionRule.findOne({where:{tenant_id,id:criteria.rule_id},transaction}) : null;
    const rules = savedRule ? [Object.assign(savedRule,{simple_criteria:true})] : [];
    const day = businessDay(invoice.created_at || invoice.getDataValue('createdAt') || new Date());
    const prospective = await require('./commissionFeature').eligibleInvoice(invoice,transaction);
    const reason = !prospective ? 'This invoice predates commission activation. Historical transactions remain unchanged.' : !customer?.assigned_user_id ? 'No salesperson is assigned to this customer.' : !validPerson ? 'The assigned salesperson is inactive or is not an internal employee in this workspace.' : null;
    return { customer, person: validPerson ? person : null, rules, lines, day, reason, configured:!!savedRule, prospective };
  });
}
// Called inside the invoice transaction after its items/totals are complete.
// Explicit tenant constraints remain even when internal reads bypass display ACLs.
async function syncInvoice(invoice, transaction, reason = 'Invoice changed', { retryEmpty = false, force = false } = {}) {
  if (!transaction) throw new Error('Commission calculation requires an invoice transaction');
  return internalRead(async () => {
    const tenant_id = invoice.tenant_id;
    await require('./commissionFeature').lockTenant(tenant_id,transaction);
    const entries = await db.CommissionEntry.findAll({ where: { tenant_id, invoice_id: invoice.id, voided_at: null }, transaction });
    const payments = entries.length ? await db.CommissionPayment.findAll({ where: { tenant_id, entry_id: { [Op.in]: entries.map(e => e.id) }, reversed_at: null }, transaction }) : [];
    let batch = await db.CommissionBatch.findOne({ where: { tenant_id, invoice_id: invoice.id }, transaction });
    const items = await db.InvoiceItem.findAll({ where: { tenant_id, invoice_id: invoice.id }, order: [['id', 'ASC']], transaction });
    const setting = await db.CommissionInvoiceSetting.findOne({ where: { tenant_id, invoice_id: invoice.id }, transaction });
    const fingerprint = createHash('sha256').update(JSON.stringify({ recipient_mode: 'customer_owner_simple_approval', customer_id: invoice.customer_id, total: cents(invoice.total), discount: cents(invoice.discount), items: items.map(i => [i.id, i.service_order_id, i.service_charge, i.quantity, i.total]) })).digest('hex');
    if(!await require('./commissionFeature').isEnabled(tenant_id,transaction)) {
      if(payments.length && (batch?.fingerprint!==fingerprint || !fullyPaid(invoice)))fail('Enable commission and reverse its payments before changing this historical invoice.',409);
      if(entries.length && (!issued.includes(invoice.status) || batch?.fingerprint!==fingerprint)) {
        await voidExpenses(entries,transaction);
        await db.CommissionEntry.update({voided_at:new Date(),void_reason:'Invoice changed while commission disabled'},{where:{tenant_id,invoice_id:invoice.id,voided_at:null},transaction});
        if(batch)await batch.update({fingerprint:null},{transaction});
      }
      return {created:0};
    }
    if (force && payments.length) fail('Reverse commission payments before changing the invoice commission.', 409);
    if (reason === 'Historical calculation' && payments.length) return {created:0};
    if (payments.length && (!fullyPaid(invoice) || (batch && batch.fingerprint !== fingerprint))) fail('Reverse the paid commissions before editing or reversing this invoice.', 409);
    if (!await require('./commissionFeature').eligibleInvoice(invoice,transaction)) {
      if (force) fail('This invoice predates commission activation. Historical transactions remain unchanged.',409);
      if (reason !== 'Historical calculation' && entries.length && (batch?.fingerprint !== fingerprint || !issued.includes(invoice.status))) fail('This historical invoice has saved commission. Its commission cannot be recalculated after reactivation.',409);
      return {created:0};
    }
    if (!issued.includes(invoice.status)) {
      await voidExpenses(entries, transaction);
      await db.CommissionEntry.update({ voided_at: new Date(), void_reason: reason }, { where: { tenant_id, invoice_id: invoice.id, voided_at: null }, transaction });
      if (batch) await batch.update({ fingerprint: null }, { transaction });
      return { created: 0 };
    }
    // An explicit historical calculation may retry a previously empty result
    // after eligibility is corrected. Existing awards keep their snapshots.
    if (!force && batch?.fingerprint === fingerprint && !(retryEmpty && !entries.length)) return { created: 0 };
    const context = await invoiceContext(invoice, transaction, items);
    const { customer, person, day } = context;
    if (!context.configured) return {created:0};
    const rules = context.rules;
    if (!rules.length && !entries.length && !setting) return { created: 0 };
    await voidExpenses(entries, transaction);
    await db.CommissionEntry.update({ voided_at: new Date(), void_reason: reason }, { where: { tenant_id, invoice_id: invoice.id, voided_at: null }, transaction });
    const staff = person ? [person] : [];
    const lines = context.lines;
    if (!batch) batch = await db.CommissionBatch.create({ tenant_id, invoice_id: invoice.id }, { transaction });
    const revision = batch.revision + 1;
    let created = 0;
    for (const person of staff) {
      if (person.Role?.type === 'CustomerPortal' || (person.Role?.tenant_id && Number(person.Role.tenant_id) !== Number(tenant_id)) || (person.role_id && !person.Role)) continue;
      for (const rule of rules) {
        const match = matches(rule, person, invoice, lines, day);
        if (!match) continue;
        const amount = match.amount;
        if (amount > 0) {
          await db.CommissionEntry.create({ tenant_id, invoice_id: invoice.id, invoice_number: invoice.invoice_number, invoice_date: day, staff_id: person.id, staff_name: person.name, rule_id: rule.id, rule_snapshot: { ...rule.toJSON(), simple_criteria: true, recipient_source: 'customer_owner', customer_id: customer.id, recipient_id: person.id, calculated_amount: match.amount / 100, discount:invoice.discount }, revision, service_charge: match.base / 100, invoice_total: invoice.total, amount: amount / 100 }, { transaction });
          created++;
        }
        break; // Highest-priority matching rule per employee, never stacking.
      }
    }
    await batch.update({ revision, fingerprint }, { transaction });
    return { created };
  });
}
async function voidExpenses(entries, transaction) {
  for (const entry of entries) if (entry.approval_expense_id) {
    await db.Expense.update({amount:0,paid_amount:0,status:'Unpaid'}, {where:{tenant_id:entry.tenant_id,id:entry.approval_expense_id},transaction,commissionReversal:true});
  }
}
module.exports = { syncInvoice, fullyPaid, businessDay, matches, evaluateRule, invoiceContext, formula, cents, voidExpenses };
