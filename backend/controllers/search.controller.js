const { Op, literal } = require('sequelize');
const db = require('../models');
const { actionScope } = require('../utils/permissionRules');
const { predicate } = require('../utils/recordAccess');

const groups = [
  { key: 'customers', label: 'Customers', model: 'Customer', fields: ['name', 'email', 'phone_whatsapp'], title: 'name', path: id => `/customers/${id}` },
  { key: 'leads', label: 'Leads', model: 'Lead', fields: ['name', 'company_name', 'email', 'phone'], title: 'company_name', path: id => `/leads/${id}` },
  { key: 'invoices', label: 'Invoices', model: 'Invoice', fields: ['invoice_number'], title: 'invoice_number', path: id => `/invoices?invoice_id=${id}` },
  { key: 'quotations', label: 'Quotations', model: 'Quotation', fields: ['quotation_number', 'recipient_name', 'email', 'phone', 'customer_reference'], title: 'quotation_number', path: id => `/quotations?quotation_id=${id}` },
  { key: 'sales_orders', label: 'Sales orders', model: 'SalesOrder', fields: ['order_number', 'contact_person', 'customer_reference'], title: 'order_number', path: id => `/sales-orders?order_id=${id}` },
  { key: 'services', label: 'Services', model: 'ServiceOrder', fields: [], path: id => `/services?service_id=${id}` },
  { key: 'documents', label: 'Documents', model: 'Document', fields: ['doc_number', 'type', 'staff_name'], title: 'doc_number', path: id => `/documents?document_id=${id}` }
];
const allowed = (user, module, action) => actionScope(user, module, action) !== 'none';
const restrictions = (user, model) => [
  { tenant_id: user.tenant_id },
  predicate(db, model, 'list') || {},
  predicate(db, model, 'detail') || {}
];

exports.search = async (req, res, next) => {
  try {
    if (!req.user.tenant_id) return res.status(403).json({ success: false, message: 'Select a company to search.' });
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length > 100) return res.status(400).json({ success: false, message: 'Search must be 100 characters or fewer.' });
    const limit = Math.max(1, Math.min(20, Number.parseInt(req.query.limit, 10) || 3));
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    if (req.query.group && !groups.some(group => group.key === req.query.group)) return res.status(400).json({ success: false, message: 'Unknown search group.' });
    res.set('Cache-Control', 'no-store');
    if (q.length < 2) return res.json({ success: true, data: [], query: q });
    // Treat wildcard characters as text, never as a request to enumerate all data.
    const like = { [Op.like]: `%${q.replace(/[\\%_]/g, '\\$&')}%` };
    const contactMatch = { [Op.or]: ['name', 'email', 'phone_whatsapp'].map(field => ({ [field]: like })) };
    const portal = req.user.Role?.type === 'CustomerPortal';
    const linked = req.user.LinkedCustomers?.map(customer => customer.id) || [];
    const customerWhere = { [Op.and]: [
      ...restrictions(req.user, 'Customer', 'customers'), contactMatch,
      ...(portal ? [{ id: { [Op.in]: linked } }] : [])
    ] };
    const canSearchCustomers = allowed(req.user, 'customers', 'list') && allowed(req.user, 'customers', 'detail');
    const customerIds = canSearchCustomers ? literal(`(${db.sequelize.getQueryInterface().queryGenerator.selectQuery(db.Customer.getTableName(), { attributes: ['id'], where: customerWhere }, db.Customer).replace(/;$/, '')})`) : null;
    const selected = groups.filter(group => (!req.query.group || req.query.group === group.key) &&
      allowed(req.user, group.key, 'list') && allowed(req.user, group.key, 'detail') &&
      (!portal || !['leads', 'quotations'].includes(group.key)));
    const results = await Promise.all(selected.map(async group => {
      const model = db[group.model];
      const matches = group.fields.map(field => ({ [field]: like }));
      const include = [];
      if (model.rawAttributes.customer_id && customerIds) matches.push({ customer_id: { [Op.in]: customerIds } });
      if (group.key === 'sales_orders') {
        // Quotation-derived drafts can still have no customer ID until an item is confirmed.
        for (const field of ['name', 'email', 'phone']) matches.push(db.sequelize.where(
          db.sequelize.fn('JSON_UNQUOTE', db.sequelize.fn('JSON_EXTRACT', db.sequelize.col('SalesOrder.recipient_snapshot'), literal(`'$.${field}'`))), like
        ));
      }
      if (group.key === 'services') {
        const id = q.replace(/^(?:srv-|#)/i, '');
        if (/^\d+$/.test(id)) matches.push({ id: id.replace(/^0+(?=\d)/, '') });
        include.push({ model: db.ServiceType, attributes: ['name'], where: { tenant_id: req.user.tenant_id }, required: false });
        matches.push({ '$ServiceType.name$': like });
      }
      if (group.key === 'documents') {
        include.push({ model: db.DocumentType, attributes: ['name'], where: { tenant_id: req.user.tenant_id }, required: false });
        matches.push({ '$DocumentType.name$': like });
      }
      const where = { [Op.and]: [
        ...restrictions(req.user, group.model, group.key), { [Op.or]: matches },
        ...(portal ? [{ [group.key === 'customers' ? 'id' : 'customer_id']: { [Op.in]: linked } }] : [])
      ] };
      const attributes = [...new Set(['id', group.title, ...group.fields, 'customer_id', 'recipient_name', 'recipient_snapshot', 'status', 'total', 'paid_amount', 'expiry_date', 'created_by', 'assigned_user_id'].filter(field => field && model.rawAttributes[field]))];
      const { count, rows } = await model.findAndCountAll({ where, attributes, include, distinct: true, subQuery: false, order: [['id', 'DESC']], limit, offset: (page - 1) * limit });
      const ids = [...new Set(rows.map(row => row.customer_id).filter(Boolean))];
      const customers = canSearchCustomers && ids.length ? await db.Customer.findAll({ where: { [Op.and]: [...restrictions(req.user, 'Customer', 'customers'), { id: { [Op.in]: ids } }, ...(portal ? [{ id: { [Op.in]: linked } }] : [])] }, attributes: ['id', 'name'] }) : [];
      const names = new Map(customers.map(customer => [String(customer.id), customer.name]));
      return { key: group.key, label: group.label, total: count, page, limit, items: rows.map(row => ({
        id: row.id,
        title: group.key === 'services' ? `SRV-${String(row.id).padStart(5, '0')} · ${row.ServiceType?.name || 'Service'}` : row[group.title] || row.name || row.DocumentType?.name || `Document #${row.id}`,
        subtitle: group.key === 'customers' ? [row.phone_whatsapp, row.email].filter(Boolean).join(' · ') : names.get(String(row.customer_id)) || row.recipient_name || row.recipient_snapshot?.name || row.name || '',
        status: row.status || null, total: row.total ?? null, paid_amount: row.paid_amount ?? null,
        expiry_date: row.expiry_date || null, to: group.path(row.id)
      })) };
    }));
    res.json({ success: true, data: results, query: q });
  } catch (error) { next(error); }
};
