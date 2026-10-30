'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken, requirePermission } = require('../middleware/auth.middleware');
const emailCtrl = require('../controllers/email.controller');
const documentEmail = require('../controllers/document-email.controller');

// All routes require authentication
router.use(verifyToken);
router.use((req, res, next) => req.user.tenant_id && req.user.Role?.type !== 'CustomerPortal' ? next() : res.status(403).json({ success: false, message: 'Internal company access is required.' }));
router.get('/documents/:id/reminder', requirePermission('documents', 'read'), documentEmail.compose);
router.post('/documents/:id/reminder', requirePermission('documents', 'write'), documentEmail.send);

// SMTP Settings
router.get('/smtp', requirePermission('settings', 'read'), emailCtrl.getSmtpSettings);
router.post('/smtp', requirePermission('settings', 'write'), emailCtrl.saveSmtpSettings);
router.post('/smtp/test', requirePermission('settings', 'write'), emailCtrl.testSmtp);

// Templates
router.get('/templates', (req, res, next) => ['customers', 'settings'].some(module => require('../utils/permissionRules').actionScope(req.user, module, 'list') !== 'none') ? next() : res.status(403).json({ success: false, message: 'Email template access is required.' }), emailCtrl.getTemplates);
router.post('/templates', requirePermission('settings', 'write'), emailCtrl.upsertTemplate);
router.delete('/templates/:id', requirePermission('settings', 'delete'), emailCtrl.deleteTemplate);

// Send
router.post('/send', requirePermission('customers', 'write'), emailCtrl.sendManual);
router.post('/send-template', requirePermission('settings', 'write'), emailCtrl.sendTemplate);

// Logs
router.get('/logs', requirePermission('settings', 'read'), emailCtrl.getLogs);

module.exports = router;
