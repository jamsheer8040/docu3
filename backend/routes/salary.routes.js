const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salary.controller');
const { protect, requirePermission } = require('../middleware/auth.middleware');

// Protect all salary routes
router.use(protect);

// Validate the company/internal-role boundary before privileged-role shortcuts.
router.use(async(req,res,next)=>{
  try{
    const {Role}=require('../models'),{Op}=require('sequelize');
    const tenant_id=req.user?.tenant_id;
    if(!tenant_id || req.user.Role?.type!=='Internal')return res.status(403).json({success:false,message:'Salary management is restricted to internal Staff/HR users in this company.'});
    const role=await Role.findOne({where:{id:req.user.role_id,type:'Internal',tenant_id:{[Op.or]:[{[Op.eq]:tenant_id},{[Op.is]:null}]}},attributes:['id']});
    if(!role || !require('../utils/salaryAccess').canRead(req.user))return res.status(403).json({success:false,message:'Staff/HR list and detail permissions are required for salary management.'});
    next();
  }catch(error){next(error);}
});
const canAccessSalary=action=>requirePermission('staff',action==='read'?'detail':action);

// --- Summary (Operational vs Salary vs Combined) ---
router.get('/summary', canAccessSalary('read'), salaryController.getSummary);

// --- Month Payroll Fetch / Preview ---
router.get('/month/:month', canAccessSalary('read'), salaryController.getMonthPayroll);

// --- Book Monthly Salary ---
router.post('/book', canAccessSalary('create'), salaryController.bookMonthSalary);

// --- Individual Payment (Full or Partial) ---
router.post('/pay-single', canAccessSalary('edit'), salaryController.paySingleSalary);

// --- Batch / Bulk Payment ---
router.post('/pay-batch', canAccessSalary('edit'), salaryController.payBatchSalary);

// Corrections retain the original debit and require an internal company Admin.
router.post('/payments/:id/reverse',(req,res,next)=>{
  if(req.user.Role?.name!=='Admin')return res.status(403).json({success:false,message:'Only a company administrator can reverse salary payments.'});
  next();
},canAccessSalary('edit'),salaryController.reversePayment);

// --- Unbook / Cancel Unpaid Month Payroll ---
router.delete('/month/:month', canAccessSalary('delete'), salaryController.unbookMonthSalary);

// --- Staff Item Payment History ---
router.get('/items/:id/payments', canAccessSalary('read'), salaryController.getStaffPaymentHistory);

module.exports = router;
