const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken, requirePermission } = require('../middleware/auth.middleware');

// All dashboard routes are protected
router.use(verifyToken);
const templates=require('../controllers/dashboard-template.controller');
router.get('/templates',requirePermission('settings','read'),templates.list);
router.post('/templates',requirePermission('settings','write'),templates.create);
router.post('/templates/presets',requirePermission('settings','write'),templates.presets);
router.put('/templates/:id',requirePermission('settings','write'),templates.update);
router.delete('/templates/:id',requirePermission('settings','delete'),templates.remove);
router.put('/templates/role/:id',requirePermission('settings','write'),templates.assign);
router.get('/layout',requirePermission('dashboard','read'),templates.layout);

router.get('/stats', requirePermission('dashboard', 'read'), dashboardController.getStats);
router.get('/recent-activity', requirePermission('dashboard', 'read'), dashboardController.getRecentActivity);

module.exports = router;
