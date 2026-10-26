const { actionScope } = require('../utils/permissionRules');
const recordContext = require('../utils/recordAccessContext');
const { Document, StaffDocument, SalesOrderItem, SalesOrder, User } = require('../models');
const { verifyToken } = require('./auth.middleware');

function canRead(user, module) {
  return actionScope(user, module, 'detail') !== 'none';
}

function linked(user, customerId) {
  return user.Role?.type !== 'CustomerPortal' ||
    user.LinkedCustomers?.some(c => String(c.id) === String(customerId));
}

module.exports = function fileAccess(req, res, next) {
  // Only generated filenames in known directories; reject traversal and nested paths.
  let pathname;
  try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(404); }
  if (!/^\/(documents|avatars|branding)\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(pathname)) return res.sendStatus(404);
  if (pathname.startsWith('/branding/') && /\.(png|jpe?g|webp|gif|ico)$/i.test(pathname)) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.sendStatus(405);
  // Native image/PDF/link requests cannot set Bearer headers. This cookie is accepted
  // only on these read-only file endpoints, never on API mutations. A still-valid
  // refresh session also supports native previews after the access cookie expires;
  // verifyToken rechecks the current user, organization and role on every request.
  const sessionToken = req.cookies?.fileAccessToken || req.cookies?.refreshToken;
  if (!req.headers.authorization && sessionToken) {
    req.headers.authorization = `Bearer ${sessionToken}`;
  }
  return verifyToken(req, res, async () => {
    try {
      res.setHeader('Cache-Control', 'private, no-store');
      const user = req.user;
      const tenant_id = user.tenant_id;
      const file_path = `/uploads${pathname}`;
      if (pathname.startsWith('/avatars/')) {
        if (user.avatar === file_path) return next();
        Object.assign(recordContext.getStore(), { module:'staff', action:'detail' });
        const owner = await User.findOne({ where: { avatar: file_path, tenant_id } });
        if (owner && (owner.id === user.id || (user.Role?.type !== 'CustomerPortal' &&
          ['staff', 'expenses', 'settings'].some(m => canRead(user, m))))) return next();
      }
      if (pathname.startsWith('/documents/')) {
        if (canRead(user, 'documents')) {
          Object.assign(recordContext.getStore(), { module: 'documents', action: 'detail' });
          const document = await Document.findOne({ where: { file_path, tenant_id } });
          if (document && linked(user, document.customer_id)) return next();
        }
        if (user.Role?.type !== 'CustomerPortal' && canRead(user, 'staff')) {
          Object.assign(recordContext.getStore(), { module: 'staff', action: 'detail' });
          const document = await StaffDocument.findOne({ where: { file_path, tenant_id } });
          if (document) return next();
        }
        if (canRead(user, 'sales_orders')) {
          Object.assign(recordContext.getStore(), { module: 'sales_orders', action: 'detail' });
          const item = await SalesOrderItem.findOne({ where: { confirm_attachment: file_path, tenant_id } });
          if (item) {
            const order = await SalesOrder.findOne({ where: { id: item.sales_order_id, tenant_id } });
            if (order && linked(user, order.customer_id)) return next();
          }
        }
      }
      return res.sendStatus(404);
    } catch (error) { next(error); }
  });
};
