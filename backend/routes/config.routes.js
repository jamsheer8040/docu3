const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const backupController = require('../controllers/backup.controller');
const { verifyToken, requirePermission, optionalVerifyToken, requireRole } = require('../middleware/auth.middleware');

// Config routes
router.get('/', optionalVerifyToken, configController.getConfigs);
router.put('/', verifyToken, requirePermission('settings', 'write'), configController.updateConfigs);
router.put('/commission', verifyToken, (req,res,next)=>req.user.Role?.type==='CustomerPortal'?res.status(403).json({success:false,message:'Internal settings access is required.'}):next(), requirePermission('settings', 'write'), configController.setCommissionEnabled);
router.post('/upload-logo', verifyToken, requirePermission('settings', 'write'), configController.upload.single('logo'), configController.uploadLogo);

// Backup routes
router.post('/backups/company', verifyToken, backupController.requireCompanyAdmin, backupController.downloadCompanyBackup);
const companySqlUpload = require('multer')({storage:require('multer').memoryStorage(),limits:{fileSize:25*1024*1024,files:1,fields:6},fileFilter:(req,file,callback)=>callback(null,/\.sql$/i.test(file.originalname))}).single('backup');
const receiveCompanySql = (req,res,next) => companySqlUpload(req,res,error=>error?res.status(400).json({success:false,message:'Choose one SQL backup file up to 25 MB.'}):next());
router.post('/backups/company/validate',verifyToken,backupController.requireCompanyAdmin,receiveCompanySql,backupController.validateCompanyImport);
router.post('/backups/company/import',verifyToken,backupController.requireCompanyAdmin,receiveCompanySql,backupController.importCompanyBackup);
router.get('/backups/company/recovery/latest',verifyToken,backupController.requireCompanyAdmin,backupController.latestCompanyRecovery);
router.get('/backups/company/recovery/:id',verifyToken,backupController.requireCompanyAdmin,backupController.downloadCompanyRecovery);
// These legacy files contain every company and belong to platform maintenance.
const platformBackupAccess = [verifyToken, requireRole('Developer'), (req,res,next) => req.user.Role.type === 'Internal' ? next() : res.sendStatus(403)];
router.get('/backups', ...platformBackupAccess, backupController.getBackups);
router.post('/backups/create', ...platformBackupAccess, backupController.createBackupManual);
router.get('/backups/download/:filename', ...platformBackupAccess, backupController.downloadBackupFile);
router.delete('/backups/:filename', ...platformBackupAccess, backupController.deleteBackupFile);

module.exports = router;
