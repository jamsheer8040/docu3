const { internalRead } = require('./recordAccess');
const { User, Role, ServiceAssignment } = require('../models');
const { Op } = require('sequelize');
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
function internalOnly(req, res, next) {
  if (req.user?.Role?.type === 'CustomerPortal') return res.status(403).json({ success: false, message: 'Staff assignment is available to internal users only.' });
  next();
}
function assigneeAccess(req, res, next) {
  if (req.user?.Role?.type === 'CustomerPortal') return internalOnly(req, res, next);
  const role = req.user?.Role;
  let permissions = role?.permissions;
  if (typeof permissions === 'string') { try { permissions = JSON.parse(permissions); } catch { permissions = {}; } }
  if (['Admin', 'Developer'].includes(role?.name) || permissions?.services?.read || permissions?.sales_orders?.write) return next();
  res.status(403).json({ success: false, message: 'Access denied.' });
}
async function eligibleStaff(tenant_id, transaction) {
  return internalRead(() => User.findAll({ where: { tenant_id, is_active: true }, attributes: ['id', 'name', 'role_id'],
    include: [{ model: Role, attributes: ['type'], required: false, where: { [Op.or]: [{ tenant_id }, { tenant_id: null }] } }],
    transaction, order: [['name', 'ASC']] })).then(users => users.filter(user => (!user.role_id || user.Role) && user.Role?.type !== 'CustomerPortal'));
}
async function resolveAssignee(value, tenant_id, transaction) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) fail('Choose a valid staff member.');
  const user = await internalRead(() => User.findOne({ where: { id: Number(value), tenant_id, is_active: true }, attributes: ['id', 'name', 'role_id'], include: [{ model: Role, attributes: ['type'], required: false, where: { [Op.or]: [{ tenant_id }, { tenant_id: null }] } }], transaction }));
  if (!user || (user.role_id && !user.Role) || user.Role?.type === 'CustomerPortal') fail('Choose an active internal staff member from this tenant.');
  return user.id;
}
async function recordAssignment(order, nextId, actor, reason, transaction) {
  const previousId = order.assigned_user_id ?? null;
  nextId = nextId ?? null;
  if (String(previousId) === String(nextId)) return {};
  const ids = [previousId, nextId].filter(Boolean);
  const users = ids.length ? await internalRead(() => User.findAll({ where: { id: ids, tenant_id: actor.tenant_id }, attributes: ['id', 'name'], transaction })) : [];
  const name = id => users.find(user => String(user.id) === String(id))?.name || null;
  await ServiceAssignment.create({ tenant_id: actor.tenant_id, service_order_id: order.id,
    from_user_id: previousId, to_user_id: nextId, actor_id: actor.id,
    from_name: name(previousId), to_name: name(nextId), actor_name: actor.name, reason }, { transaction });
  return { assigned_user_id: nextId, assigned_at: nextId ? new Date() : null };
}
module.exports = { resolveAssignee, recordAssignment, eligibleStaff, internalOnly, assigneeAccess };
