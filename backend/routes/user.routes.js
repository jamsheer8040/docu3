const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, requirePermission } = require('../middleware/auth.middleware');
const { checkUserLimit } = require('../middleware/limit.middleware');
const docUpload = require('../middleware/upload.middleware');

// Apply protection to all user routes
router.use(protect);

const staffRead = (req, res, next) => {
  const { hasScopedRules } = require('../utils/permissionRules');
  return requirePermission(hasScopedRules(req.user.Role?.permissions) ? 'staff' : 'settings', 'read')(req, res, next);
};
router.get('/', staffRead, userController.getUsers);
router.get('/:id', staffRead, userController.getUserById);
router.post('/', requirePermission('settings', 'write'), checkUserLimit, userController.createUser);
router.put('/:id', requirePermission('settings', 'write'), userController.updateUser);
router.delete('/:id', requirePermission('settings', 'write'), userController.deleteUser);
router.post('/:id/avatar', requirePermission('settings', 'write'), userController.upload.single('avatar'), userController.uploadAvatar);

// Staff Documents
router.post('/:id/documents', requirePermission('staff', 'create'), docUpload.single('file'), userController.addStaffDocument);
router.put('/:id/documents/:docId', requirePermission('staff', 'write'), docUpload.single('file'), userController.updateStaffDocument);
router.delete('/:id/documents/:docId', requirePermission('staff', 'delete'), userController.deleteStaffDocument);

module.exports = router;
