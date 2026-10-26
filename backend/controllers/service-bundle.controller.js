const db = require('../models');
const { Op } = require('sequelize');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const id = value => {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail('Invalid template or service ID.');
  return Number(value);
};
const respond = (res, error) => {
  if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'A service template with this name already exists.' });
  if (!error.status) console.error('[Service templates]', error);
  return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to process service templates.' });
};
async function servicesFor(items, tenant_id, transaction) {
  const services = await db.ServiceType.findAll({
    where: { tenant_id, is_active: true, id: { [Op.in]: items.map(item => item.service_type_id) } },
    include: [{ model: db.ServiceTypePricing }], transaction
  });
  // Never silently omit a missing/inactive service from a complete-work checklist.
  if (services.length !== items.length) fail('One or more template services are inactive or unavailable. Update the template in Settings before using it.', 409);
  return services;
}
async function prepare(body, tenant_id, transaction) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 150) fail('Enter a template name up to 150 characters.');
  if (body.description != null && (typeof body.description !== 'string' || body.description.length > 1000)) fail('Description must be up to 1,000 characters.');
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') fail('Active must be on or off.');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) fail('Choose between 1 and 100 services.');
  const items = body.items.map(item => {
    if (!item || typeof item !== 'object') fail('Choose a valid service.');
    const service_type_id = id(item.service_type_id);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000) fail('Quantity must be a whole number between 1 and 100,000.');
    return { service_type_id, quantity: item.quantity };
  });
  if (new Set(items.map(item => item.service_type_id)).size !== items.length) fail('Each service can appear once. Change its quantity instead.');
  // Inactive entries already saved can be viewed/deleted, but saving requires a valid checklist.
  await servicesFor(items, tenant_id, transaction);
  return { name: body.name.trim(), description: body.description?.trim() || null, items, is_active: body.is_active ?? true };
}
exports.list = async (req, res) => {
  try {
    const where = { tenant_id: req.user.tenant_id };
    if (req.query.manage !== 'true') where.is_active = true;
    const rows = await db.ServiceBundle.findAll({ where, order: [['name', 'ASC'], ['id', 'ASC']] });
    res.json({ success: true, data: rows });
  } catch (error) { respond(res, error); }
};
exports.catalog = async (req, res) => {
  try {
    const rows = await db.ServiceType.findAll({ where: { tenant_id: req.user.tenant_id, is_active: true }, attributes: ['id', 'name'], order: [['name', 'ASC']] });
    res.json({ success: true, data: rows });
  } catch (error) { respond(res, error); }
};
exports.expand = async (req, res) => {
  try {
    const result = await db.sequelize.transaction(async transaction => {
      const row = await db.ServiceBundle.findOne({ where: { id: id(req.params.id), tenant_id: req.user.tenant_id, is_active: true }, transaction });
      if (!row) fail('Service template not found or inactive.', 404);
      const services = await servicesFor(row.items, req.user.tenant_id, transaction);
      return { id: row.id, name: row.name, items: row.items.map(item => ({ quantity: item.quantity, service: services.find(service => Number(service.id) === item.service_type_id) })) };
    });
    res.set('Cache-Control', 'no-store').json({ success: true, data: result });
  } catch (error) { respond(res, error); }
};
exports.save = async (req, res) => {
  try {
    const row = await db.sequelize.transaction(async transaction => {
      let existing;
      if (req.params.id) {
        existing = await db.ServiceBundle.findOne({ where: { id: id(req.params.id), tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });
        if (!existing) fail('Service template not found.', 404);
      }
      const values = await prepare(req.body, req.user.tenant_id, transaction);
      return existing ? existing.update(values, { transaction }) : db.ServiceBundle.create({ ...values, tenant_id: req.user.tenant_id }, { transaction });
    });
    res.status(req.params.id ? 200 : 201).json({ success: true, data: row });
  } catch (error) { respond(res, error); }
};
exports.remove = async (req, res) => {
  try {
    const count = await db.ServiceBundle.destroy({ where: { id: id(req.params.id), tenant_id: req.user.tenant_id } });
    if (!count) fail('Service template not found.', 404);
    res.json({ success: true });
  } catch (error) { respond(res, error); }
};
