const test = require('node:test');
const assert = require('node:assert/strict');
const { modulePermission, rulesFor, actionScope, normalizePermissions } = require('../utils/permissionRules');
test('legacy roles retain read/write/delete behaviour', () => {
  assert.deepEqual(rulesFor({ read: true, write: false, delete: false }), { list: 'all', detail: 'all', create: false, edit: 'none', delete: 'none' });
  assert.equal(modulePermission({ customers: { read: true } }, 'leads').read, true);
  assert.equal(modulePermission({ customers: { read: true }, leads: {} }, 'leads').read, undefined);
});
test('new rules separate detail, creation and ownership scopes', () => {
  const permissions = normalizePermissions({ leads: { rules: { list: 'all', detail: 'own', create: true, edit: 'assigned', delete: 'none' } } });
  const user = { Role: { name: 'Junior Sales', permissions } };
  assert.equal(actionScope(user, 'leads', 'detail'), 'own');
  assert.equal(actionScope(user, 'leads', 'create'), true);
  assert.equal(actionScope(user, 'leads', 'edit'), 'assigned');
  assert.equal(actionScope(user, 'leads', 'delete'), 'none');
  assert.equal(actionScope(user, 'invoices', 'detail'), 'none');
  assert.equal(actionScope({ Role: { name: 'Admin' } }, 'leads', 'delete'), 'all');
});
test('invalid rule scopes cannot be saved or interpreted as grants', () => {
  assert.throws(() => normalizePermissions({ leads: { rules: { list: 'everyone' } } }));
  assert.equal(actionScope({ Role: { name: 'Staff', permissions: { leads: { rules: { edit: 'anything' } } } } }, 'leads', 'edit'), 'none');
});
