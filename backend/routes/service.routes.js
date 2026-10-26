const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const { validateServiceType, validateServiceOrder } = require('../validators/service.validators');
const { protect, requirePermission } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware.js');
const { internalOnly, assigneeAccess } = require('../utils/serviceAssignment');

// Apply protection to all service routes
router.use(protect);
router.get('/assignees', assigneeAccess, serviceController.getAssignees);
router.get('/employee-tracking', requirePermission('employee_tracking', 'read'), internalOnly, serviceController.getEmployeeTracking);
router.get('/employee-tracking/orders', requirePermission('employee_tracking', 'read'), internalOnly, serviceController.getTrackingOrders);
router.get('/employee-tracking/orders/:id/history', requirePermission('employee_tracking', 'list'), internalOnly, serviceController.getTrackingHistory);
router.get('/orders/:id/assignment-history', requirePermission('services', 'read'), internalOnly, serviceController.getAssignmentHistory);
router.put('/orders/:id/assignment', requirePermission('services', 'write'), internalOnly, serviceController.assignServiceOrder);

/**
 * Service Types (Catalog) - Part of System Configuration
 */
router.get('/types', requirePermission('settings', 'read'), serviceController.getServiceTypes);
router.post('/types', requirePermission('settings', 'write'), validateServiceType, validate, serviceController.createServiceType);
router.put('/types/:id', requirePermission('settings', 'write'), validateServiceType, validate, serviceController.updateServiceType);
router.delete('/types/:id', requirePermission('settings', 'delete'), serviceController.deleteServiceType);

/**
 * Service Orders (Workflow)
 */
router.get('/orders', requirePermission('services', 'read'), serviceController.getServiceOrders);
router.get('/orders/:id/completion', requirePermission('services', 'edit'), internalOnly, serviceController.getCompletionCost);
router.post('/orders', requirePermission('services', 'write'), internalOnly, validateServiceOrder, validate, serviceController.createServiceOrder);
router.put('/orders/:id', requirePermission('services', 'write'), internalOnly, validateServiceOrder, validate, serviceController.updateServiceOrder);
router.post('/orders/escalate', requirePermission('services', 'write'), serviceController.runEscalation);
router.get('/config/criticality', requirePermission('settings', 'read'), serviceController.getCriticalityConfig);
router.put('/config/criticality', requirePermission('settings', 'write'), serviceController.saveCriticalityConfig);
router.put('/orders/:id/status', requirePermission('services', 'write'), internalOnly, serviceController.updateServiceOrderStatus);
router.put('/orders/:id/followup', requirePermission('services', 'write'), serviceController.markFollowUpDone);
router.post('/orders/:id/remind', requirePermission('services', 'write'), serviceController.incrementReminderCount);
router.delete('/orders/:id', requirePermission('services', 'delete'), serviceController.deleteServiceOrder);

module.exports = router;
