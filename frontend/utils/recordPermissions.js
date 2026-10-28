export const businessModules = ['customers', 'leads', 'quotations', 'suppliers', 'documents', 'sales_orders', 'services', 'invoices', 'expenses', 'wallet', 'management', 'staff', 'tools'];
export function hasScopedRules(permissions) {
  if (typeof permissions === 'string') { try { permissions = JSON.parse(permissions); } catch { return false; } }
  return businessModules.some(module => permissions?.[module]?.rules);
}
export function permissionFor(user, module) {
  let permissions = user?.permissions || {};
  if (typeof permissions === 'string') { try { permissions = JSON.parse(permissions); } catch { permissions = {}; } }
  return permissions[module] || (module === 'leads' ? permissions.customers : null) || {};
}
export function rulesFor(permission = {}) {
  return permission.rules || { list: permission.read === true ? 'all' : 'none', detail: permission.read === true ? 'all' : 'none', create: permission.write === true, edit: permission.write === true ? 'all' : 'none', delete: permission.delete === true ? 'all' : 'none' };
}
export function canAccess(user, module, action = 'read', record) {
  if (module === 'commissions' && user?.role_type === 'CustomerPortal') return false;
  if (action === 'edit_form') return canAccess(user, module, 'edit', record) && canAccess(user, module, 'detail', record);
  if (['admin', 'developer'].includes(user?.role?.toLowerCase())) return true;
  if (record?.record_access && ['detail', 'edit', 'delete'].includes(action)) return record.record_access[action] === true;
  const rules = rulesFor(permissionFor(user, module));
  if (module === 'commissions' && ['manage_rules', 'pay'].includes(action)) return rules.list === 'all' && permissionFor(user, module)[action] === true;
  if (action === 'write') return rules.create === true || ['created', 'assigned', 'own', 'all'].includes(rules.edit);
  const value = rules[action === 'read' ? 'list' : action];
  if (action === 'create') return value === true;
  if (value === 'all') return true;
  if (!['created', 'assigned', 'own'].includes(value)) return false;
  if (!record) return true; // Show the module; the API restricts its rows.
  const created = record.created_by != null && String(record.created_by) === String(user?.id);
  const assigned = record.assigned_user_id != null && String(record.assigned_user_id) === String(user?.id);
  return value === 'created' ? created : value === 'assigned' ? assigned : created || assigned;
}
export function canAccessSalary(user, action = 'read', record) {
  if (!user || user.role_type === 'CustomerPortal') return false;
  if (['admin','developer'].includes(user.role?.toLowerCase())) return true;
  const rules = rulesFor(permissionFor(user, 'staff'));
  if (!['created','assigned','own','all'].includes(rules.list) || !['created','assigned','own','all'].includes(rules.detail)) return false;
  return action === 'read' || canAccess(user, 'staff', action, record);
}
