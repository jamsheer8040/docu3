const router = require('express').Router();
const { verifyToken, requirePermission } = require('../middleware/auth.middleware');
const { actionScope } = require('../utils/permissionRules');
const controller = require('../controllers/service-bundle.controller');
router.use(verifyToken, (req, res, next) => req.user.Role?.type === 'CustomerPortal' ? res.sendStatus(403) : next());
const useTemplates = (req, res, next) => {
  if (['quotations', 'sales_orders'].some(module => actionScope(req.user, module, 'create') === true || actionScope(req.user, module, 'edit') !== 'none')) return next();
  return res.sendStatus(403);
};
router.get('/catalog', requirePermission('settings', 'write'), controller.catalog);
router.get('/', (req, res, next) => req.query.manage === 'true' ? requirePermission('settings', 'read')(req, res, next) : useTemplates(req, res, next), controller.list);
router.get('/:id/expand', useTemplates, controller.expand);
router.post('/', requirePermission('settings', 'write'), controller.save);
router.put('/:id', requirePermission('settings', 'write'), controller.save);
router.delete('/:id', requirePermission('settings', 'delete'), controller.remove);
module.exports = router;
