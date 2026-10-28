const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/sales-order.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Apply common middlewares
router.use(verifyToken);

const { requirePermission } = require('../middleware/auth.middleware');

// Sales Order Routes
router.get('/', requirePermission('sales_orders', 'read'), salesOrderController.getAllSalesOrders);
router.post('/', requirePermission('sales_orders', 'write'), salesOrderController.createSalesOrder);
router.get('/pricing-defaults', requirePermission('sales_orders', 'read'), salesOrderController.getPricingDefaults);
router.get('/:id', requirePermission('sales_orders', 'read'), salesOrderController.getSalesOrderById);
router.put('/:id', requirePermission('sales_orders', 'write'), salesOrderController.updateSalesOrder);
router.post('/:id/confirmation', requirePermission('sales_orders', 'write'), salesOrderController.confirmOrder);
router.delete('/:id', requirePermission('sales_orders', 'write'), salesOrderController.deleteSalesOrder);

// Push Service Item to Execution
router.post('/items/:itemId/push', requirePermission('sales_orders', 'write'), salesOrderController.pushService);

// Confirm/Cancel Service Item (from Customer)
const upload = require('../middleware/upload.middleware');
router.post('/items/:itemId/confirm', requirePermission('sales_orders', 'write'), upload.single('attachment'), salesOrderController.confirmServiceItem);

// Download Proforma PDF
router.get('/:id/proforma-pdf', requirePermission('sales_orders', 'read'), salesOrderController.downloadProformaPDF);

module.exports = router;
