const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const { verifyToken, requirePermission } = require('../middleware/auth.middleware');

router.use(verifyToken);

// Supplier CRUD
router.get('/', requirePermission('suppliers', 'read'), supplierController.getSuppliers);
router.get('/purchases', requirePermission('suppliers', 'read'), supplierController.getPurchases);
router.post('/', requirePermission('suppliers', 'write'), supplierController.createSupplier);
router.get('/:id', requirePermission('suppliers', 'read'), supplierController.getSupplier);
router.put('/:id', requirePermission('suppliers', 'write'), supplierController.updateSupplier);
router.delete('/:id', requirePermission('suppliers', 'delete'), supplierController.deleteSupplier);

// Supplier AP (Purchases & Payments)
router.get('/:id/statement/:format', requirePermission('suppliers', 'read'), supplierController.downloadStatement);
router.get('/:id/purchases', requirePermission('suppliers', 'read'), supplierController.getSupplierPurchases);
router.get('/:id/payments', requirePermission('suppliers', 'read'), supplierController.getSupplierPayments);
router.post('/:id/payments', requirePermission('suppliers', 'write'), supplierController.makePayment);

module.exports = router;
