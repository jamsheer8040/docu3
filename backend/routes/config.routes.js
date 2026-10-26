const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const backupController = require('../controllers/backup.controller');
const { verifyToken, requirePermission, optionalVerifyToken } = require('../middleware/auth.middleware');

// Config routes
router.get('/', optionalVerifyToken, configController.getConfigs);
router.put('/', verifyToken, requirePermission('settings', 'write'), configController.updateConfigs);
router.put('/commission', verifyToken, (req,res,next)=>req.user.Role?.type==='CustomerPortal'?res.status(403).json({success:false,message:'Internal settings access is required.'}):next(), requirePermission('settings', 'write'), configController.setCommissionEnabled);
router.post('/upload-logo', verifyToken, requirePermission('settings', 'write'), configController.upload.single('logo'), configController.uploadLogo);

// Backup routes
router.get('/backups', verifyToken, requirePermission('settings', 'read'), backupController.getBackups);
router.post('/backups/create', verifyToken, requirePermission('settings', 'write'), backupController.createBackupManual);
router.get('/backups/download/:filename', verifyToken, requirePermission('settings', 'read'), backupController.downloadBackupFile);
router.delete('/backups/:filename', verifyToken, requirePermission('settings', 'write'), backupController.deleteBackupFile);

module.exports = router;
