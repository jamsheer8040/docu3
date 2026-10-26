const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth.verifyToken);

const excelImport = require('../utils/leadExcelImport');
const upload = require('multer')({ storage:require('multer').memoryStorage(), limits:{fileSize:5*1024*1024,files:1} });
const excelFile = (req,res,next) => upload.single('file')(req,res,error=>error ? res.status(400).json({success:false,message:error.code==='LIMIT_FILE_SIZE'?'File must be under 5 MB.':'Unable to read upload.'}) : next());
router.get('/import/template', auth.requirePermission('leads','create'), excelImport.template);
router.post('/import/preview', auth.requirePermission('leads','create'), excelFile, excelImport.run);
router.post('/import/confirm', auth.requirePermission('leads','create'), excelFile, excelImport.run);

// Both Admin and Staff can manage leads (Assuming they have 'customers' permission)
router.get('/', auth.requirePermission('leads', 'read'), leadController.getLeads);
router.post('/export/excel', auth.requirePermission('leads', 'read'), leadController.exportExcel);
router.get('/:id', auth.requirePermission('leads', 'read'), leadController.getLeadById);
router.post('/', auth.requirePermission('leads', 'write'), leadController.createLead);
router.put('/:id', auth.requirePermission('leads', 'write'), leadController.updateLead);
router.delete('/:id', auth.requirePermission('leads', 'delete'), leadController.deleteLead);
router.post('/:id/convert', auth.requirePermission('leads', 'write'), leadController.convertLead);
const followUpUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8, fieldSize: 20000 } });
const followUpFile = (req, res, next) => followUpUpload.single('attachment')(req, res, error => error
  ? res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Attachment must be under 10 MB.' : 'Unable to read attachment. Choose one file.' }) : next());
router.post('/:id/follow-ups', auth.requirePermission('leads', 'write'), followUpFile, leadController.addFollowUp);
router.get('/:id/follow-ups/:activityId/attachment', auth.requirePermission('leads', 'read'), leadController.downloadFollowUpAttachment);
router.post('/:id/whatsapp-click', auth.requirePermission('leads', 'read'), leadController.trackWhatsappClick);


module.exports = router;
