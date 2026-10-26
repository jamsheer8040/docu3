const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salary.controller');
const { protect, requirePermission } = require('../middleware/auth.middleware');

// Protect all salary routes
router.use(protect);

// Helper middleware: allow if user has either 'expenses' or 'staff' permission (or Admin/Developer)
const canAccessSalary = (accessType = 'read') => {
  return (req, res, next) => {
    if (!req.user || !req.user.Role) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.Role.name === 'Admin' || req.user.Role.name === 'Developer') {
      return next();
    }
    let perms = req.user.Role.permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
    }
    if (require('../utils/permissionRules').hasScopedRules(perms)) return requirePermission('staff', accessType)(req, res, next);
    const hasExp = perms?.expenses && perms.expenses[accessType];
    const hasStaff = perms?.staff && perms.staff[accessType];
    if (hasExp || hasStaff) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Access denied. Insufficient permissions for salary management (${accessType}).`
    });
  };
};

// --- Summary (Operational vs Salary vs Combined) ---
router.get('/summary', canAccessSalary('read'), salaryController.getSummary);

// --- Month Payroll Fetch / Preview ---
router.get('/month/:month', canAccessSalary('read'), salaryController.getMonthPayroll);

// --- Book Monthly Salary ---
router.post('/book', canAccessSalary('write'), salaryController.bookMonthSalary);

// --- Individual Payment (Full or Partial) ---
router.post('/pay-single', canAccessSalary('write'), salaryController.paySingleSalary);

// --- Batch / Bulk Payment ---
router.post('/pay-batch', canAccessSalary('write'), salaryController.payBatchSalary);

// --- Unbook / Cancel Unpaid Month Payroll ---
router.delete('/month/:month', canAccessSalary('write'), salaryController.unbookMonthSalary);

// --- Staff Item Payment History ---
router.get('/items/:id/payments', canAccessSalary('read'), salaryController.getStaffPaymentHistory);

module.exports = router;
