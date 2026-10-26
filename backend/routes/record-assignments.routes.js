const router = require('express').Router();
const db = require('../models');
const { roots } = require('../utils/businessOwnership');
const { protect, requirePermission } = require('../middleware/auth.middleware');
const { eligibleStaff, internalOnly, resolveAssignee, recordAssignment } = require('../utils/serviceAssignment');
const { actionScope, businessModules } = require('../utils/permissionRules');
router.use(protect, internalOnly);
router.get('/staff', async (req, res, next) => {
  if (!businessModules.some(module => actionScope(req.user, module, 'edit') !== 'none' || actionScope(req.user, module, 'create') === true)) return res.sendStatus(403);
  try { res.json({ success: true, data: (await eligibleStaff(req.user.tenant_id)).map(user => ({ id: user.id, name: user.name })) }); } catch (error) { next(error); }
});
router.use('/:model', (req, res, next) => {
  if (!Object.hasOwn(roots, req.params.model)) return res.sendStatus(404);
  req.ownershipModel = req.params.model;
  next();
});
router.get('/:model', (req, res, next) => requirePermission(roots[req.ownershipModel], 'read')(req, res, next), async (req, res, next) => {
  try {
    const model = db[req.ownershipModel];
    const labelFields = ['name', 'title', 'quotation_number', 'invoice_number', 'order_number', 'service_number', 'doc_number', 'document_number', 'description', 'month', 'reference_number'].filter(field => model.rawAttributes[field]);
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    const { rows, count } = await model.findAndCountAll({ where: { tenant_id: req.user.tenant_id }, attributes: ['id', 'created_by', 'assigned_user_id', ...labelFields], order: [['id', 'DESC']], limit: 50, offset: (page - 1) * 50 });
    res.json({ success: true, total: count, data: rows.map(row => ({ id: row.id, created_by: row.created_by, assigned_user_id: row.assigned_user_id, label: labelFields.map(key => row[key]).find(Boolean) || `${req.ownershipModel} #${row.id}` })) });
  } catch (error) { next(error); }
});
router.put('/:model/:id', (req, res, next) => requirePermission(roots[req.ownershipModel], 'write')(req, res, next), async (req, res, next) => {
  try {
    await db.sequelize.transaction(async transaction => {
      const model = db[req.ownershipModel];
      const row = await model.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw Object.assign(new Error('Record not found or assignment is not permitted.'), { status: 404 });
      if (req.ownershipModel === 'ServiceOrder' && ['Completed', 'CompletedInvoicePending', 'CompletedInvoiceCreated', 'Cancelled'].includes(row.status)) throw Object.assign(new Error('Only open services can be reassigned.'), { status: 400 });
      if (!Object.hasOwn(req.body, 'assigned_user_id')) throw Object.assign(new Error('Choose a staff member or Unassigned.'), { status: 400 });
      const id = await resolveAssignee(req.body.assigned_user_id, req.user.tenant_id, transaction);
      if (req.ownershipModel === 'Customer' && id == null) throw Object.assign(new Error('A salesperson is required for the customer.'), { status: 400 });
      if (id === undefined) throw Object.assign(new Error('Choose a staff member or Unassigned.'), { status: 400 });
      const data = req.ownershipModel === 'ServiceOrder' ? await recordAssignment(row, id, req.user, 'Manual', transaction) : { assigned_user_id: id };
      await row.update(data, { transaction });
    });
    res.json({ success: true });
  } catch (error) { next(error); }
});
module.exports = router;
