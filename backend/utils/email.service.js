'use strict';

const nodemailer = require('nodemailer');
const { SystemConfig, EmailTemplate, EmailLog } = require('../models');

/**
 * Get SMTP settings for a given tenant from SystemConfig
 */
async function getSmtpConfig(tenantId) {
  const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email', 'smtp_secure'];
  const configs = await SystemConfig.findAll({
    where: { tenant_id: tenantId, key: keys }
  });

  const settings = {};
  configs.forEach(c => { settings[c.key] = c.value; });

  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
    return null;
  }
  return settings;
}

/**
 * Create a Nodemailer transporter for a given tenant
 */
async function getTransporter(tenantId, settings) {
  const smtp = settings || await getSmtpConfig(tenantId);
  if (!smtp) return null;

  return nodemailer.createTransport({
    host: smtp.smtp_host,
    port: parseInt(smtp.smtp_port) || 587,
    secure: smtp.smtp_secure === 'true',
    auth: {
      user: smtp.smtp_user,
      pass: smtp.smtp_pass
    },
    requireTLS: smtp.smtp_secure !== 'true',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true
  });
}

/**
 * Render a template: replace {{variable}} placeholders with data
 */
function renderTemplate(html, data = {}) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Core send function
 * @param {Object} opts - { tenantId, to, subject, html, templateType, sentBy }
 */
async function sendEmail({ tenantId, to, cc = [], subject, html, text, templateType = 'manual', sentBy = null }) {
  const smtp = await getSmtpConfig(tenantId);
  const transporter = smtp ? await getTransporter(tenantId, smtp) : null;
  if (!transporter) {
    console.warn(`[EmailService] No SMTP config for tenant ${tenantId}. Email not sent.`);
    return { success: false, message: 'SMTP not configured' };
  }

  const fromAddress = smtp.smtp_from_email || smtp.smtp_user;
  const fromName = smtp.smtp_from_name || 'DocClear';

  let info;
  try {
    info = await transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to,
      cc,
      subject,
      html,
      text
    });
  } catch (err) {
    console.error('[EmailService] Send failed:', err.message);
    await EmailLog.create({
      tenant_id: tenantId,
      recipient: to,
      subject,
      template_type: templateType,
      status: 'failed',
      error_message: err.message,
      sent_by: sentBy
    }).catch(logError => console.error('[EmailService] Could not save failure log:', logError.message));
    return { success: false, message: err.message };
  }
  // SMTP has accepted the message: a logging failure must not invite duplicate sends.
  let logged = true;
  await EmailLog.create({ tenant_id: tenantId, recipient: to, subject, template_type: templateType, status: 'sent', sent_by: sentBy })
    .catch(error => { logged = false; console.error('[EmailService] Could not save sent log:', error.message); });
  return { success: true, ...(info?.rejected?.length ? { message: 'Email sent, but some recipients were rejected by the mail server.', rejected: info.rejected } : !logged ? { message: 'Email sent, but its delivery log could not be saved.' } : {}) };
}

/**
 * Send via a named template type with variable substitution
 */
async function sendTemplateEmail({ tenantId, to, templateType, data = {}, sentBy = null }) {
  const template = await EmailTemplate.findOne({
    where: { tenant_id: tenantId, type: templateType, is_active: true }
  });

  if (!template) {
    console.warn(`[EmailService] No active template of type "${templateType}" for tenant ${tenantId}`);
    return { success: false, message: `No active template found for type: ${templateType}` };
  }

  const subject = renderTemplate(template.subject, data);
  const html = renderTemplate(template.body_html, data);

  return sendEmail({ tenantId, to, subject, html, templateType, sentBy });
}

/**
 * Test SMTP connection
 */
async function testSmtpConnection(tenantId) {
  const transporter = await getTransporter(tenantId);
  if (!transporter) return { success: false, message: 'SMTP not configured' };
  try {
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

module.exports = { sendEmail, sendTemplateEmail, testSmtpConnection, renderTemplate };
