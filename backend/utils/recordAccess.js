const { Op, literal } = require('sequelize');
const context = require('./recordAccessContext');
const { roots, children } = require('./businessOwnership');
const { actionScope, hasScopedRules, canRecord } = require('./permissionRules');
// Summary fields for list-only records. Notes, addresses, file paths, item lines,
// salary amounts and other details require the independent detail permission.
const summaryFields = new Set(('id tenant_id created_by assigned_user_id name title company_name email phone phone_whatsapp city country is_active customer_id supplier_id service_id service_type_id status source created_at updated_at createdAt updatedAt next_follow_up_date follow_up_scheduled_at follow_up_count whatsapp_clicks order_number order_date invoice_number service_number doc_number document_number document_type_id issue_date expiry_date days_until_expiry expiry_status reminder_count criticality initial_criticality completed_at assigned_at completed_by_user_id total subtotal tax discount cost_total paid_amount amount balance currency type description month booking_date reference_number reference_type reference_id user_id role_id can_login total_amount total_paid total_billed').split(' '));

function moduleFor(name) {
  return roots[name] || (children[name] && moduleFor(children[name][0]));
}
for (const field of ['quotation_number','quotation_date','valid_until','recipient_name','lead_id','lead_type','quote_sent','sent_at','template_style','expense_id']) summaryFields.add(field);
function actionFor(module, operation = 'read') {
  const state = context.getStore();
  if (operation !== 'read') return operation;
  return state?.module === module ? state.action : 'list';
}
function enabled(module) {
  const state = context.getStore();
  return state && !state.metadata && !['Admin', 'Developer'].includes(state.user.Role?.name) &&
    Object.values(roots).includes(module) && hasScopedRules(state.user.Role?.permissions);
}
// For fixed, server-only operations such as numbering, plan limits and a
// directory containing only staff IDs/names. Never derive this flag from input.
function internalRead(callback) {
  const state = context.getStore();
  return state ? context.run({ ...state, metadata: true }, callback) : callback();
}
function predicate(db, name, action) {
  const state = context.getStore();
  const module = moduleFor(name);
  if (!module || !enabled(module)) return null;
  const scope = actionScope(state.user, module, action || actionFor(module));
  // Creation lookups of existing records are limited to list visibility.
  if (scope === true) return predicate(db, name, 'list');
  const tenant = db[name].rawAttributes.tenant_id ? { tenant_id: state.user.tenant_id } : {};
  if (scope === 'none') return { [Op.and]: [tenant, literal('1 = 0')] };
  if (children[name]) {
    const [parent, foreignKey] = children[name];
    const parentWhere = predicate(db, parent, action);
    const generator = db.sequelize.getQueryInterface().queryGenerator;
    const table = generator.quoteTable(db[parent].getTableName());
    const where = generator.getWhereConditions(parentWhere, 'acl_parent', db[parent]);
    return { [Op.and]: [tenant, { [foreignKey]: { [Op.in]: literal(`(SELECT acl_parent.id FROM ${table} AS acl_parent WHERE ${where})`) } }] };
  }
  if (scope === 'all') return tenant;
  const created = { created_by: state.user.id };
  const assigned = { assigned_user_id: state.user.id };
  return { [Op.and]: [tenant, scope === 'created' ? created : scope === 'assigned' ? assigned : { [Op.or]: [created, assigned] }] };
}
function scopeOptions(db, model, options, action) {
  if (roots[model.name] && enabled(roots[model.name]) && !options.raw && !options.group && Array.isArray(options.attributes) && options.attributes.length && options.attributes.every(field => typeof field === 'string')) {
    options.attributes = [...new Set([...options.attributes, 'created_by', 'assigned_user_id'])];
  }
  const restriction = predicate(db, model.name, action);
  if (restriction) options.where = { [Op.and]: [options.where || {}, restriction] };
  for (const include of options.include || []) {
    if (include.required === undefined) include.required = !!include.where;
    if (include.model?.name === 'User' && Array.isArray(include.attributes) && include.attributes.length && include.attributes.every(field => ['id', 'name', 'is_active', 'avatar'].includes(field))) {
      const state = context.getStore();
      if (state) include.where = { [Op.and]: [include.where || {}, { tenant_id: state.user.tenant_id }] };
    } else if (include.model) scopeOptions(db, include.model, include, action && moduleFor(include.model.name) === moduleFor(model.name) ? action : undefined);
  }
}
function forbidden() {
  const error = new Error('You do not have permission to change this record.');
  error.status = 403; error.statusCode = 403;
  return error;
}
function install(db) {
  const { sequelize } = db;
  sequelize.addHook('beforeFindAfterExpandIncludeAll', function(options) { scopeOptions(db, this, options); });
  sequelize.addHook('beforeCount', function(options) { scopeOptions(db, this, options); });
  sequelize.addHook('afterFind', function(result, options) {
    const state = context.getStore();
    if (!state || state.metadata || !['list', undefined].includes(state.action) || options.raw || options.attributes?.some(Array.isArray)) return;
    const decorate = (row, model, includes = []) => {
      if (!row?.dataValues) return;
      for (const include of includes) {
        if (!include.model) continue;
        const key = include.as || include.association?.as;
        const values = row.dataValues[key];
        for (const value of Array.isArray(values) ? values : [values]) decorate(value, include.model, include.include);
      }
      const module = roots[model.name];
      if (!module || !enabled(module)) return;
      const access = Object.fromEntries(['detail', 'edit', 'delete'].map(action => [action, canRecord(state.user, module, action, row)]));
      row.dataValues.record_access = access;
    };
    for (const row of Array.isArray(result) ? result : [result]) decorate(row, this, options.include);
  });
  const aggregate = db.Sequelize.Model.aggregate;
  db.Sequelize.Model.aggregate = async function(field, operation, options = {}) {
    options = { ...options };
    scopeOptions(db, this, options);
    if(this.name==='Expense') {
      if(operation!=='count')options.commissionAccounting=true;
      await require('./commissionFeature').scopeExpenses(options);
    }
    return aggregate.call(this, field, operation, options);
  };
  // Replacing child lines/history is an edit of the parent; deleting the
  // parent itself requires delete permission. Related business roots keep
  // their own edit scope even when changed through another module.
  for (const [hook, action] of [['beforeBulkUpdate', 'edit'], ['beforeBulkDestroy', 'delete']]) {
    sequelize.addHook(hook, async function(options) {
      const state = context.getStore();
      const module = moduleFor(this.name);
      if (state && roots[this.name] && options.attributes) {
        delete options.attributes.created_by;
        if (options.attributes.assigned_user_id !== undefined) await prepare(this.build({ assigned_user_id: options.attributes.assigned_user_id }, { isNewRecord: false }), options);
      }
      if (!state?.module || !enabled(module)) return;
      const effective = state.module === module && state.action === 'delete' ? 'delete' : children[this.name] ? 'edit' : action;
      if (actionScope(state.user, module, effective) === 'none') throw forbidden();
      scopeOptions(db, this, options, effective);
      if (options.attributes) delete options.attributes.created_by;
    });
  }
  for (const [hook, action] of [['beforeUpdate', 'edit'], ['beforeDestroy', 'delete']]) {
    sequelize.addHook(hook, async (row, options) => {
      const state = context.getStore();
      const model = row.constructor;
      const module = moduleFor(model.name);
      if (!state) return;
      if (row.changed('created_by')) throw forbidden();
      if (!state.module || !enabled(module) || state.created?.has(`${model.name}:${row.id}`)) return;
      const effective = state.module === module && state.action === 'delete' ? 'delete' : children[model.name] ? 'edit' : action;
      const where = { [Op.and]: [{ id: row.id }, predicate(db, model.name, effective)] };
      // QueryInterface deliberately avoids the read scope: editing may be
      // allowed even when opening the details screen is not.
      const rows = await sequelize.getQueryInterface().select(model, model.getTableName(), { where, attributes: ['id'], transaction: options.transaction, limit: 1 });
      if (!rows.length) throw forbidden();
    });
  }
  async function prepare(row, options) {
    const state = context.getStore();
    if (!state) return;
    const name = row.constructor.name;
    const creating = row.isNewRecord && options.type !== 'BULKUPDATE';
    if (creating && children[name]) {
      const [parent, key] = children[name];
      const id = row[key];
      const module = moduleFor(parent);
      if (enabled(module) && !state.created?.has(`${parent}:${id}`)) {
        const where = { [Op.and]: [{ id, ...(db[parent].rawAttributes.tenant_id ? { tenant_id:state.user.tenant_id } : {}) }, predicate(db, parent, 'edit')] };
        const found = await sequelize.getQueryInterface().select(db[parent], db[parent].getTableName(), { where, attributes:['id'], limit:1, transaction:options.transaction });
        if (!found.length) throw forbidden();
      }
    }
    if (!roots[name]) return;
    if (creating) {
      const module = roots[row.constructor.name];
      if (enabled(module) && actionScope(state.user, module, 'create') !== true) throw forbidden();
      row.created_by = state.user.id;
    }
    if (row.changed('assigned_user_id') && row.assigned_user_id != null) {
      const id = Number(row.assigned_user_id);
      if (!Number.isSafeInteger(id) || id <= 0) throw forbidden();
      const user = await internalRead(() => db.User.findOne({ where: { id, tenant_id: state.user.tenant_id, is_active: true }, attributes: ['id', 'role_id'], include: [{ model: db.Role, attributes: ['type', 'tenant_id'] }], transaction: options.transaction }));
      if (!user || (user.role_id && !user.Role) || user.Role?.type === 'CustomerPortal' || (user.Role?.tenant_id != null && user.Role.tenant_id !== state.user.tenant_id)) throw forbidden();
    }
  }
  sequelize.addHook('beforeValidate', prepare);
  sequelize.addHook('beforeCreate', prepare);
  sequelize.addHook('beforeBulkCreate', async (rows, options) => { for (const row of rows) await prepare(row, options); });
  const remember = row => {
    const state = context.getStore();
    if (state) { state.created ||= new Set(); state.created.add(`${row.constructor.name}:${row.id}`); }
  };
  sequelize.addHook('afterCreate', remember);
  sequelize.addHook('afterBulkCreate', rows => { for (const row of rows) remember(row); });
}
function sanitizeResponse(value) {
  if (value == null || typeof value !== 'object') return value;
  if (typeof value.toJSON === 'function') return sanitizeResponse(value.toJSON());
  if (Array.isArray(value)) return value.map(sanitizeResponse);
  const listOnly = value.record_access?.detail === false;
  const relations = new Set(['Customer', 'Supplier', 'Service', 'ServiceType', 'Creator', 'AssignedStaff', 'Account', 'WalletAccount']);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !listOnly || key === 'record_access' || summaryFields.has(key) || relations.has(key)).map(([key, item]) => [key, listOnly && relations.has(key) && item ? { id: item.id, name: item.name } : sanitizeResponse(item)]));
}
module.exports = { install, predicate, scopeOptions, moduleFor, context, forbidden, internalRead, sanitizeResponse };
