const scopes = ['none', 'created', 'assigned', 'own', 'all'];
const businessModules = ['customers', 'leads', 'quotations', 'suppliers', 'documents', 'services', 'sales_orders', 'invoices', 'expenses', 'wallet', 'management', 'staff', 'tools'];
const modules = [...businessModules, 'commissions', 'employee_tracking', 'dashboard', 'reports', 'settings', 'financials'];
function hasScopedRules(permissions) {
  if (typeof permissions === 'string') { try { permissions = JSON.parse(permissions); } catch { return false; } }
  return businessModules.some(module => permissions?.[module]?.rules);
}
function modulePermission(permissions, module) {
  if (typeof permissions === 'string') { try { permissions = JSON.parse(permissions); } catch { permissions = {}; } }
  return permissions?.[module] || (module === 'leads' ? permissions?.customers : null) || {};
}
function rulesFor(permission = {}) {
  if (permission.rules) return permission.rules;
  return { list: permission.read === true ? 'all' : 'none', detail: permission.read === true ? 'all' : 'none', create: permission.write === true, edit: permission.write === true ? 'all' : 'none', delete: permission.delete === true ? 'all' : 'none' };
}
function actionScope(user, module, action) {
  if (['Admin', 'Developer'].includes(user?.Role?.name)) return action === 'create' ? true : 'all';
  const value = rulesFor(modulePermission(user?.Role?.permissions, module))[action];
  return action === 'create' ? value === true : scopes.includes(value) ? value : 'none';
}
function canRecord(user, module, action, record) {
  const scope = actionScope(user, module, action);
  if (scope === true || scope === 'all') return true;
  if (!record || scope === 'none') return false;
  const created = record.created_by != null && String(record.created_by) === String(user.id);
  const assigned = record.assigned_user_id != null && String(record.assigned_user_id) === String(user.id);
  return scope === 'created' ? created : scope === 'assigned' ? assigned : scope === 'own' && (created || assigned);
}
function normalizePermissions(permissions) {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) throw new Error('Permissions must be an object.');
  const result = {};
  for (const [module, permission] of Object.entries(permissions)) {
    if (!modules.includes(module)) throw new Error('Invalid permission module.');
    if (!permission || typeof permission !== 'object' || Array.isArray(permission)) throw new Error('Invalid module permissions.');
    if (module === 'commissions') {
      const list = permission.rules?.list ?? (permission.read === true ? 'own' : 'none');
      if (!['none', 'own', 'all'].includes(list)) throw new Error('Choose No access, Own or All for Commissions.');
      if ((permission.manage_rules === true || permission.pay === true) && list !== 'all') throw new Error('Managing or paying commissions requires All view access.');
      result[module] = { rules: { list, detail: list, create: false, edit: 'none', delete: 'none' }, read: list !== 'none', write: false, delete: false, manage_rules: permission.manage_rules === true, pay: permission.pay === true };
      continue;
    }
    if (module === 'employee_tracking') {
      const list = permission.rules?.list ?? (permission.read === true ? 'all' : 'none');
      if (!['none', 'own', 'all'].includes(list)) throw new Error('Choose No access, Own or All for Employee Tracking.');
      result[module] = { rules: { list, detail: 'none', create: false, edit: 'none', delete: 'none' }, read: list !== 'none', write: false, delete: false };
      continue;
    }
    if (!permission.rules) { result[module] = { ...permission, read: permission.read === true, write: permission.write === true, delete: permission.delete === true }; continue; }
    const rules = permission.rules;
    if (!businessModules.includes(module)) throw new Error('Ownership scopes apply to business records only.');
    for (const action of ['list', 'detail', 'edit', 'delete']) if (!scopes.includes(rules[action])) throw new Error(`Choose a valid ${action} scope for ${module}.`);
    if (typeof rules.create !== 'boolean') throw new Error('Create permission must be on or off.');
    result[module] = { rules: { list: rules.list, detail: rules.detail, create: rules.create, edit: rules.edit, delete: rules.delete }, read: rules.list !== 'none' || rules.detail !== 'none', write: rules.create || rules.edit !== 'none', delete: rules.delete !== 'none' };
  }
  return result;
}
module.exports = { scopes, modules, businessModules, hasScopedRules, modulePermission, rulesFor, actionScope, canRecord, normalizePermissions };
