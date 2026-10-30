const { Document, Customer, DocumentType, SystemConfig } = require('../models');
const { predicate } = require('../utils/recordAccess');
const { canRecord } = require('../utils/permissionRules');
const { sendEmail } = require('../utils/email.service');
const reminder = require('../utils/documentReminderEmail');
const { Op } = require('sequelize');

async function findDocument(req) {
  if (!/^\d+$/.test(req.params.id)) return null;
  return Document.findOne({
    where: { [Op.and]: [{ id: req.params.id, tenant_id: req.user.tenant_id }, predicate(require('../models'), 'Document', 'detail') || {}] },
    include: [
      { model: Customer, attributes: ['name', 'email'], where: { tenant_id: req.user.tenant_id }, required: false },
      { model: DocumentType, attributes: ['name'], where: { [Op.or]: [{ tenant_id: req.user.tenant_id }, { tenant_id: null }] }, required: false }
    ]
  });
}
async function sender(tenantId) {
  const rows = await SystemConfig.findAll({ where: { tenant_id: tenantId, key: ['smtp_host', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name', 'company_name'] } });
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const address = settings.smtp_from_email || settings.smtp_user || '';
  return { email: address, name: settings.smtp_from_name || settings.company_name || 'DocClear', configured: !!(settings.smtp_host && settings.smtp_user && settings.smtp_pass && reminder.email(address)) };
}
async function accessible(req, res) {
  const document = await findDocument(req);
  if (!document) { res.status(404).json({ success: false, message: 'Document not found.' }); return null; }
  if (!canRecord(req.user, 'documents', 'edit', document) || !canRecord(req.user, 'documents', 'detail', document)) {
    res.status(403).json({ success: false, message: 'Document detail and edit access are required to send reminders.' }); return null;
  }
  return document;
}
exports.compose = async (req, res, next) => {
  try {
    const document = await accessible(req, res); if (!document) return;
    const from = await sender(req.user.tenant_id);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { ...reminder.draft(document, from.name), from_email: from.email, from_name: from.name, configured: from.configured, document_id: document.id } });
  } catch (error) { next(error); }
};
exports.send = async (req, res, next) => {
  try {
    const document = await accessible(req, res); if (!document) return;
    let message;
    try { message = reminder.validateMessage(req.body || {}); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const from = await sender(req.user.tenant_id);
    if (!from.configured) return res.status(409).json({ success: false, message: 'Configure the company email account in Settings → Email before sending.' });
    const result = await sendEmail({ tenantId: req.user.tenant_id, to: message.to, cc: message.cc, subject: message.subject, text: message.body, html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${reminder.escapeHtml(message.body)}</div>`, templateType: 'document_reminder', sentBy: req.user.id });
    res.status(result.success ? 200 : 502).json(result);
  } catch (error) { next(error); }
};
