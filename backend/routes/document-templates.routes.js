const router = require('express').Router();
const db = require('../models');
const path = require('path');
const fs = require('fs');
const { protect, requirePermission } = require('../middleware/auth.middleware');
const { styles, types, validateSettings, renderDocument } = require('../utils/documentTemplates');
const { loadInvoiceDocumentPolicy } = require('../utils/invoiceDocumentPolicy');
router.use(protect);
router.use((req, res, next) => req.user.tenant_id ? next() : res.status(403).json({ message: 'Select a workspace to manage documents' }));
const parse = row => { try { return JSON.parse(row?.value || '{}'); } catch { return {}; } };
async function settings(tenant_id) {
  return parse(await db.SystemConfig.findOne({ where: { key: 'document_templates', tenant_id } }));
}
router.get('/', async (req, res, next) => {
  try { res.json({ styles, types, settings: await settings(req.user.tenant_id) }); } catch (e) { next(e); }
});
router.put('/defaults', requirePermission('settings', 'write'), async (req, res, next) => {
  let value; try { value = validateSettings(req.body); } catch (e) { return res.status(400).json({ message: e.message }); }
  try {
    const where = { key: 'document_templates', tenant_id: req.user.tenant_id };
    const [row] = await db.SystemConfig.findOrCreate({ where, defaults: { ...where, value: JSON.stringify(value) } });
    await row.update({ value: JSON.stringify(value) }); res.json({ success: true });
  } catch (e) { next(e); }
});
async function company(tenant_id) {
  const rows = await db.SystemConfig.findAll({ where: { tenant_id } });
  const config = Object.fromEntries(rows.map(r => { let v; try { v = JSON.parse(r.value); } catch { v = r.value; } return [r.key, v]; }));
  const uploads = path.resolve(__dirname, '../uploads');
  const candidate = typeof config.app_logo === 'string' ? path.resolve(__dirname, '..', config.app_logo.replace(/^\//, '')) : '';
  const logo = candidate.startsWith(uploads + path.sep) && fs.existsSync(candidate) ? candidate : undefined;
  const trn = (await loadInvoiceDocumentPolicy(tenant_id)).trn;
  return { logo, company: config.app_name || 'My Company', companyDetails: [config.company_address, config.company_phone, config.company_email, trn && `TRN: ${trn}`].filter(Boolean).join(' | ') };
}
router.get('/preview', requirePermission('settings', 'read'), async (req, res, next) => {
  const { type, template } = req.query;
  if (!Object.hasOwn(types, type) || !styles.includes(template)) return res.status(400).json({ message: 'Unknown template or document type' });
  try {
    const preferences = await settings(req.user.tenant_id);
    res.type('pdf'); renderDocument({ ...await company(req.user.tenant_id), title: `${types[type]} — SAMPLE`, number: 'SAMPLE-001', date: 'Preview only', customer: 'Sample Customer', items: [{ description: 'Example service', quantity: 2, rate: 100, total: 200 }], totals: [['Subtotal', 200], ['VAT', 10], ['Total', 210]], footer: preferences.footer || '' }, template, res);
  } catch (e) { next(e); }
});
router.get('/:type/:id/pdf', (req, res, next) => {
  if (!Object.hasOwn(types, req.params.type)) return res.status(400).json({ message: 'Unknown document type' });
  const module = { invoice: 'invoices', tax_invoice: 'invoices', proforma: 'sales_orders', sales_order: 'sales_orders', quotation:'quotations', receipt: 'wallet', expense: 'expenses' }[req.params.type];
  return module ? requirePermission(module, 'read')(req, res, next) : res.status(400).json({ message: 'Unknown document type' });
}, async (req, res, next) => {
  const { type, id } = req.params; const tenant_id = req.user.tenant_id;
  if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'Invalid document ID' });
  if (req.query.template && req.query.template !== 'default' && !styles.includes(req.query.template)) return res.status(400).json({ message: 'Unknown template' });
  if(type==='quotation'){if(req.query.template==='default')delete req.query.template;return require('../controllers/quotation.controller').pdf(req,res,next);}
  try {
    let record, items, totals, number, customer, date;
    if (type === 'invoice' || type === 'tax_invoice') {
      record = await db.Invoice.findOne({ where: { id, tenant_id }, include: [{ model: db.Customer, where: { tenant_id }, required: true }, { model: db.InvoiceItem, where: { tenant_id }, required: false }] });
      if (record) { items = record.InvoiceItems.map(i => ({ description: i.description, quantity: i.quantity, rate: i.unit_price, total: i.total })); totals = [['Subtotal', record.subtotal], ['Discount', -Number(record.discount)], ['VAT', record.tax], ['Total', record.total], ['Paid', record.paid_amount]]; number = record.invoice_number; customer = record.Customer.name; date = record.createdAt || record.created_at; }
    } else if (type === 'sales_order' || type === 'proforma') {
      record = await db.SalesOrder.findOne({ where: { id, tenant_id }, include: [{ model: db.Customer, where: { tenant_id }, required: false }, { model: db.SalesOrderItem, where: { tenant_id }, required: false }] });
      if (record && record.customer_id && !record.Customer) record = null;
      if (record) { items = record.SalesOrderItems.map(i => ({ description: [i.service_name,i.description,i.expected_processing_time && `Processing: ${i.expected_processing_time}`,i.expected_date && `Expected date: ${i.expected_date}`].filter(Boolean).join('\n'), quantity: i.quantity, rate: i.estimated_price, total: Number(i.quantity) * Number(i.estimated_price) })); const pricing = await require('../utils/salesOrderPricing').totals(record, tenant_id); totals = [['Subtotal', pricing.subtotal], ['Discount', -pricing.discount], [`VAT (${pricing.tax_rate}%)`, pricing.tax_amount], ['Total', pricing.total]]; number = record.order_number; customer = record.source_quotation_id && record.recipient_snapshot ? [record.recipient_snapshot.name,record.recipient_snapshot.email,record.recipient_snapshot.phone,record.recipient_snapshot.address].filter(Boolean).join('\n') : record.Customer?.name || 'Customer'; date = record.order_date; }
    } else if (type === 'expense') {
      record = await db.Expense.findOne({ where: { id, tenant_id } });
      if (record) { items = [{ description: record.description, quantity: 1, rate: record.amount, total: record.amount }]; totals = [['Total', record.amount], ['Paid', record.paid_amount]]; number = `EXP-${id}`; date = record.payment_date; }
    } else {
      const payment = await db.WalletTransaction.findOne({ where: { id, tenant_id, type: 'Income', direction: 'In', reference_type: 'Invoice' } });
      if (payment) { record = await db.Invoice.findOne({ where: { id: payment.reference_id, tenant_id }, include: [{ model: db.Customer, where: { tenant_id }, required: true }] }); if (record) { items = [{ description: `Payment for ${record.invoice_number}`, quantity: 1, rate: payment.amount, total: payment.amount }]; totals = [['Amount received', payment.amount]]; number = `RCPT-${id}`; customer = record.Customer.name; date = payment.created_at || payment.createdAt; } }
    }
    if (!record) return res.status(404).json({ message: 'Document not found' });
    if (req.user.Role?.type === 'CustomerPortal' && (!record.customer_id || !req.user.LinkedCustomers?.some(c => String(c.id) === String(record.customer_id)))) return res.status(404).json({ message: 'Document not found' });
    if (type === 'invoice' || type === 'tax_invoice') {
      const policy = await loadInvoiceDocumentPolicy(tenant_id);
      if (type !== policy.type) return res.status(400).json({ message: policy.type === 'invoice' ? 'Tax Invoice is unavailable. Enable VAT and provide a tax registration number first.' : 'VAT is enabled for this registered business. Download Tax Invoice instead.' });
    }
    const group = { invoice: 'invoice', tax_invoice: 'invoice', proforma: 'order', sales_order: 'order', expense: 'expense', receipt: 'receipt' }[type];
    const snapshot = await db.DocumentTemplateSnapshot.findOne({ where: { document_group: group, record_id: id, tenant_id } });
    const preferences = snapshot?.version === 1 ? snapshot : await settings(tenant_id);
    const template = req.query.template && req.query.template !== 'default' ? req.query.template : (['sales_order','proforma'].includes(type) && record.template_style) || preferences.defaults?.[type] || 'classic';
    res.type('pdf').attachment(`${type}-${id}.pdf`);
    renderDocument({ ...await company(tenant_id), title: types[type], number, date: date ? new Date(date).toISOString().slice(0, 10) : '', customer, status: type === 'receipt' ? 'Payment received' : record.status, items, totals, sections: ['sales_order','proforma'].includes(type) ? require('../utils/salesOrderDocument').sections(record) : [], footer: (['sales_order','proforma'].includes(type) ? record.document_footer : null) ?? preferences.footer ?? '' }, template, res);
  } catch (e) { next(e); }
});
module.exports = router;
