const test = require('node:test');
const assert = require('node:assert/strict');
test('frontend controls distinguish creation, editing and record ownership', async () => {
  const { canAccess } = await import('../../frontend/utils/recordPermissions.js');
  const user = { id:7, role:'Junior', permissions:{leads:{rules:{list:'all',detail:'own',create:false,edit:'assigned',delete:'none'}}} };
  assert.equal(canAccess(user,'leads','read'),true);
  assert.equal(canAccess(user,'leads','create'),false);
  assert.equal(canAccess(user,'leads','detail',{created_by:7}),true);
  assert.equal(canAccess(user,'leads','edit',{created_by:7}),false);
  assert.equal(canAccess(user,'leads','edit',{assigned_user_id:7}),true);
  assert.equal(canAccess(user,'leads','delete',{assigned_user_id:7}),false);
  assert.equal(canAccess(user,'leads','detail',{created_by:null,assigned_user_id:null}),false);
  assert.equal(canAccess(user,'leads','edit',{assigned_user_id:7,record_access:{edit:false}}),false);
  assert.equal(canAccess(user,'leads','edit_form',{record_access:{edit:true,detail:false}}),false);
  assert.equal(canAccess({role:'Admin'},'invoices','delete'),true);
});
test('legacy frontend roles and lead fallback remain compatible', async () => {
  const { canAccess } = await import('../../frontend/utils/recordPermissions.js');
  const user = { permissions: JSON.stringify({customers:{read:true,write:true,delete:false}}) };
  assert.equal(canAccess(user,'leads','read'),true);
  assert.equal(canAccess(user,'leads','create'),true);
  assert.equal(canAccess(user,'leads','edit',{}),true);
  assert.equal(canAccess(user,'leads','delete',{}),false);
});
