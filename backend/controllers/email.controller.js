'use strict';

const { EmailTemplate, EmailLog, Customer, Invoice, SystemConfig } = require('../models');
const { sendEmail, sendTemplateEmail, testSmtpConnection } = require('../utils/email.service');
const { Op } = require('sequelize');

// ─── Email Templates ─────────────────────────────────────────────────────────

exports.getTemplates = async (req, res) => {
  try {
    const templates = await EmailTemplate.findAll({
      where: { tenant_id: req.user.tenant_id },
      order: [['type', 'ASC']]
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    console.error('[EmailController] getTemplates:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.upsertTemplate = async (req, res) => {
  try {
    const { type, name, subject, body_html, is_active } = req.body;
    const tenantId = req.user.tenant_id;

    const [template, created] = await EmailTemplate.findOrCreate({
      where: { type, tenant_id: tenantId },
      defaults: { name, subject, body_html, is_active: is_active !== false, tenant_id: tenantId }
    });

    if (!created) {
      await template.update({ name, subject, body_html, is_active: is_active !== false });
    }

    res.json({ success: true, data: template });
  } catch (err) {
    console.error('[EmailController] upsertTemplate:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id }
    });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    await template.destroy();
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    console.error('[EmailController] deleteTemplate:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Send Manual Email ────────────────────────────────────────────────────────

exports.sendManual = async (req, res) => {
  try {
    const { to, subject, body_html, template_id } = req.body;
    const tenantId = req.user.tenant_id;

    let html = body_html;
    let emailSubject = subject;

    if (template_id) {
      const tmpl = await EmailTemplate.findOne({ where: { id: template_id, tenant_id: tenantId } });
      if (tmpl) {
        html = tmpl.body_html;
        emailSubject = tmpl.subject;
      }
    }

    if (!to || !emailSubject || !html) {
      return res.status(400).json({ success: false, message: 'Missing required fields: to, subject, body_html' });
    }

    const result = await sendEmail({
      tenantId,
      to,
      subject: emailSubject,
      html,
      templateType: 'manual',
      sentBy: req.user.id
    });

    res.json(result);
  } catch (err) {
    console.error('[EmailController] sendManual:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Send Template Email ──────────────────────────────────────────────────────

exports.sendTemplate = async (req, res) => {
  try {
    const { to, template_type, data } = req.body;
    const tenantId = req.user.tenant_id;

    if (!to || !template_type) {
      return res.status(400).json({ success: false, message: 'Missing required fields: to, template_type' });
    }

    const result = await sendTemplateEmail({
      tenantId,
      to,
      templateType: template_type,
      data: data || {},
      sentBy: req.user.id
    });

    res.json(result);
  } catch (err) {
    console.error('[EmailController] sendTemplate:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Email Logs ───────────────────────────────────────────────────────────────

exports.getLogs = async (req, res) => {
  try {
    const logs = await EmailLog.findAll({
      where: { tenant_id: req.user.tenant_id },
      order: [['created_at', 'DESC']],
      limit: 200
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[EmailController] getLogs:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── SMTP Settings ────────────────────────────────────────────────────────────

exports.getSmtpSettings = async (req, res) => {
  try {
    const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email', 'smtp_secure', 'email_auto_invoice', 'email_auto_document_reminder'];
    const configs = await SystemConfig.findAll({
      where: { tenant_id: req.user.tenant_id, key: keys }
    });

    const settings = {};
    configs.forEach(c => {
      // Mask password
      settings[c.key] = c.key === 'smtp_pass' ? (c.value ? '••••••••' : '') : c.value;
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[EmailController] getSmtpSettings:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.saveSmtpSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const allowedKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email', 'smtp_secure', 'email_auto_invoice', 'email_auto_document_reminder'];
    const { email } = require('../utils/documentReminderEmail');
    const input = req.body || {};
    if (input.smtp_host != null && (typeof input.smtp_host !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(input.smtp_host.trim()))) return res.status(400).json({ success: false, message: 'Enter a valid SMTP hostname.' });
    if (input.smtp_port != null && (!/^\d+$/.test(String(input.smtp_port)) || Number(input.smtp_port) < 1 || Number(input.smtp_port) > 65535)) return res.status(400).json({ success: false, message: 'Enter a valid SMTP port.' });
    if (input.smtp_from_email != null && (typeof input.smtp_from_email !== 'string' || (input.smtp_from_email.trim() && !email(input.smtp_from_email.trim())))) return res.status(400).json({ success: false, message: 'Enter a valid From email address.' });
    if (['smtp_user', 'smtp_from_name'].some(key => input[key] != null && (typeof input[key] !== 'string' || input[key].length > 250 || /[\r\n]/.test(input[key])))) return res.status(400).json({ success: false, message: 'Enter a valid sender name and SMTP username.' });
    if (input.smtp_pass != null && (typeof input.smtp_pass !== 'string' || input.smtp_pass.length > 1000)) return res.status(400).json({ success: false, message: 'Enter a valid SMTP password.' });
    if (['smtp_secure', 'email_auto_invoice', 'email_auto_document_reminder'].some(key => input[key] != null && !['true', 'false', true, false].includes(input[key]))) return res.status(400).json({ success: false, message: 'Invalid email option.' });

    await SystemConfig.sequelize.transaction(async transaction => {
    for (const key of allowedKeys) {
      if (input[key] !== undefined) {
        // Don't overwrite masked password
        if (key === 'smtp_pass' && input[key] === '••••••••') continue;
        let value = String(input[key]);
        if (['smtp_host', 'smtp_user', 'smtp_from_email', 'smtp_from_name'].includes(key)) value = value.trim();
        if (key === 'smtp_pass' && input.smtp_host?.trim().toLowerCase() === 'smtp.gmail.com') value = value.replace(/\s/g, '');
        await SystemConfig.upsert({ key, value, tenant_id: tenantId }, { transaction });
      }
    }
    });

    res.json({ success: true, message: 'SMTP settings saved' });
  } catch (err) {
    console.error('[EmailController] saveSmtpSettings:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.testSmtp = async (req, res) => {
  try {
    const result = await testSmtpConnection(req.user.tenant_id);
    res.json(result);
  } catch (err) {
    console.error('[EmailController] testSmtp:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
