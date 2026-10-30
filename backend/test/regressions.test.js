const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
require('dotenv').config();

// This suite creates/drops schema only in an explicitly selected disposable DB.
if (process.env.DB_NAME !== 'docclear_regression_test' || process.env.TEST_DATABASE_RESET !== 'yes' ||
    !['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) {
  throw new Error('Use local DB_NAME=docclear_regression_test and TEST_DATABASE_RESET=yes');
}
process.env.NODE_ENV = 'test';
process.env.HOST = '127.0.0.1';
process.env.PORT = '0';
process.env.DISABLE_CRON = 'true';
const db = require('../models');
db.sequelize.options.logging = false;
const app = require('../app');
const jwt = require('jsonwebtoken');
let server, base, admin, outsider, portal, denied, customer, otherCustomer, wallet, staff;
const files = [];
function token(user) { return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' }); }
async function request(url, user, method = 'GET', body, cookie) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${token(user)}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method === 'POST' && /\/salaries\/pay-(single|batch)$/.test(url)) headers['Idempotency-Key'] = require('node:crypto').randomUUID();
  return fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
function file(directory, name) {
  const relative = `/uploads/${directory}/regression-${name}.png`;
  const absolute = path.join(__dirname, '..', relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64'));
  files.push(absolute);
  return relative;
}
async function payroll(month, count = 1) {
  const p = await db.SalaryPayroll.create({ tenant_id: 1, month, booking_date: `${month}-01`, total_amount: count * 100 });
  const items = [];
  for (let i = 0; i < count; i++) items.push(await db.SalaryItem.create({ tenant_id: 1, payroll_id: p.id, user_id: staff.id, net_salary: 100 }));
  return { p, items };
}
before(async () => {
  await db.sequelize.sync({ force: true });
  await db.Tenant.bulkCreate([{ id: 1, name: 'Test A', slug: 'test-a', status: 'active' }, { id: 2, name: 'Test B', slug: 'test-b', status: 'active' }]);
  const role = await db.Role.create({ name: 'Admin', tenant_id: 1 });
  const role2 = await db.Role.create({ name: 'Admin', tenant_id: 2 });
  const portalRole = await db.Role.create({ name: 'Portal', type: 'CustomerPortal', tenant_id: 1, permissions: { documents: { read: true }, sales_orders: { read: true }, staff: { read: true } } });
  const deniedRole = await db.Role.create({ name: 'Denied', tenant_id: 1, permissions: {} });
  admin = await db.User.create({ name: 'Admin', email: 'regression-admin@example.test', password_hash: 'regression-password-only', role_id: role.id, tenant_id: 1 });
  outsider = await db.User.create({ name: 'Other', email: 'regression-other@example.test', role_id: role2.id, tenant_id: 2 });
  portal = await db.User.create({ name: 'Portal', email: 'regression-portal@example.test', role_id: portalRole.id, tenant_id: 1 });
  denied = await db.User.create({ name: 'Denied', email: 'regression-denied@example.test', role_id: deniedRole.id, tenant_id: 1 });
  staff = await db.User.create({ name: 'Staff', tenant_id: 1, can_login: false });
  customer = await db.Customer.create({ name: 'Linked', phone_whatsapp: '+971500000001', tenant_id: 1 });
  otherCustomer = await db.Customer.create({ name: 'Unlinked', phone_whatsapp: '+971500000002', tenant_id: 1 });
  await db.UserCustomer.create({ user_id: portal.id, customer_id: customer.id });
  wallet = await db.WalletAccount.create({ name: 'Payroll Wallet', tenant_id: 1, balance: 10000 });
  server = await app.start();
  if (!server.listening) await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await db.sequelize.close();
  for (const absolute of files) fs.rmSync(absolute, { force: true });
});

test('service bundles isolate administration and expand complete ordered checklists into editable document lines', async () => {
  const root = '/api/v1/service-bundles';
  const service = await db.ServiceType.create({ tenant_id:1,name:'Bundle EID',cost_price:100,service_charge:20 });
  const medical = await db.ServiceType.create({ tenant_id:1,name:'Bundle Medical',cost_price:200,service_charge:30 });
  const foreign = await db.ServiceType.create({ tenant_id:2,name:'Foreign bundle service' });
  const payload = { name:'Contract Renewal',description:'Visa and identity work',items:[{service_type_id:medical.id,quantity:2},{service_type_id:service.id,quantity:1}],tenant_id:2 };
  assert.equal((await request(root,undefined)).status,401);
  assert.equal((await request(root,portal)).status,403);
  assert.equal((await request(root,denied)).status,403);
  assert.equal((await request(root,admin,'POST',{...payload,items:[{service_type_id:foreign.id,quantity:1}]})).status,409);
  assert.equal((await request(root,admin,'POST',{...payload,items:[]})).status,400);
  assert.equal((await request(root,admin,'POST',{...payload,items:[payload.items[0],payload.items[0]]})).status,400);
  assert.equal((await request(root,admin,'POST',{...payload,items:[{service_type_id:service.id,quantity:0}]})).status,400);
  const create = await request(root,admin,'POST',payload);
  assert.equal(create.status,201,await create.clone().text());
  const bundle = (await create.json()).data;
  assert.equal(bundle.tenant_id,1,'Tenant is server owned');
  assert.equal((await request(root,admin,'POST',payload)).status,409);
  const role = await db.Role.create({ tenant_id:1,name:'Bundle quote creator',permissions:require('../utils/permissionRules').normalizePermissions({quotations:{rules:{list:'none',detail:'none',edit:'none',delete:'none',create:true}}}) });
  const worker = await db.User.create({tenant_id:1,name:'Bundle staff',email:'bundle-worker@example.test',role_id:role.id});
  assert.equal((await request(root,worker)).status,200,'Creating quotes does not require settings access to use a template');
  assert.equal((await request(root+'?manage=true',worker)).status,403);
  assert.equal((await request(root+'/catalog',worker)).status,403);
  assert.equal((await request(root,worker,'POST',payload)).status,403);
  assert.equal((await request(`${root}/${bundle.id}`,worker,'PUT',payload)).status,403);
  assert.equal((await request(`${root}/${bundle.id}`,worker,'DELETE')).status,403);
  assert.equal((await request(`${root}/${bundle.id}/expand`,outsider)).status,404);
  assert.equal((await request(`${root}/${bundle.id}`,outsider,'PUT',payload)).status,404);
  assert.equal((await request(`${root}/${bundle.id}`,outsider,'DELETE')).status,404);
  await medical.update({service_charge:45});
  const expanded = await (await request(`${root}/${bundle.id}/expand`,worker)).json();
  assert.deepEqual(expanded.data.items.map(row=>Number(row.service.id)),[Number(medical.id),Number(service.id)]);
  assert.equal(Number(expanded.data.items[0].service.service_charge),45,'Fetch current master price');
  assert.equal(expanded.data.items[0].quantity,2);
  const { bundleLines } = await import('../../frontend/utils/serviceBundleLines.mjs');
  const lines = bundleLines(expanded.data.items,{kind:'quotation'});
  lines[0].service_charge=50; lines[0].rate=250;
  const quoteResult = await request('/api/v1/quotations',admin,'POST',{recipient_name:'Bundle customer',items:lines});
  assert.equal(quoteResult.status,201,await quoteResult.clone().text());
  const quote = (await quoteResult.json()).data;
  assert.equal(quote.items.length,2);
  assert.equal(Number(quote.total),620);
  const orderResult = await request('/api/v1/sales-orders',admin,'POST',{customer_id:customer.id,items:bundleLines(expanded.data.items,{kind:'sales-order'})});
  assert.equal(orderResult.status,201,await orderResult.clone().text());
  const order = (await orderResult.json()).data;
  assert.equal(await db.SalesOrderItem.count({where:{tenant_id:1,sales_order_id:order.id}}),2);
  const edited = await request(`${root}/${bundle.id}`,admin,'PUT',{...payload,name:'Contract Renewal Revised',items:[{service_type_id:service.id,quantity:3}],is_active:false});
  assert.equal(edited.status,200,await edited.clone().text());
  assert.equal((await request(`${root}/${bundle.id}/expand`,admin)).status,404);
  assert.equal((await (await request(root,admin)).json()).data.some(row=>row.id===bundle.id),false);
  assert.equal((await (await request(root+'?manage=true',admin)).json()).data.some(row=>row.id===bundle.id),true);
  assert.equal((await request(`${root}/${bundle.id}`,admin,'PUT',{...payload,is_active:true})).status,200);
  await medical.update({is_active:false});
  assert.equal((await request(`${root}/${bundle.id}/expand`,admin)).status,409,'An unavailable item rejects the entire template, not part of it');
  assert.equal((await request(`${root}/${bundle.id}`,admin,'DELETE')).status,200);
  await db.Quotation.findByPk(quote.id).then(row=>assert.equal(row.items.length,2,'Deleting templates never changes saved documents'));
  assert.equal(await db.SalesOrderItem.count({where:{tenant_id:1,sales_order_id:order.id}}),2);
});

test('granular business permissions enforce independent actions, ownership, reports and exports', async () => {
  const { normalizePermissions } = require('../utils/permissionRules');
  const rules = (list, detail = list, edit = list, create = false, remove = 'none') => ({ rules: { list, detail, edit, create, delete: remove } });
  const role = await db.Role.create({ name: 'Scoped sales', tenant_id: 1, permissions: normalizePermissions({
    invoices: rules('created', 'assigned', 'own', true, 'created'),
    customers: { read: true }, expenses: rules('none'), wallet: rules('none'),
    suppliers: rules('own'), leads: rules('assigned'),
    dashboard: { read: true }, reports: { read: true }
  }) });
  const worker = await db.User.create({ name: 'Scoped employee', email: 'scope@example.test', tenant_id: 1, role_id: role.id });
  const owned = await db.Invoice.create({ tenant_id: 1, customer_id: customer.id, invoice_number: 'SCOPE-OWN', total: 101, paid_amount: 11, status: 'Partially Paid', created_by: worker.id });
  const assigned = await db.Invoice.create({ tenant_id: 1, customer_id: customer.id, invoice_number: 'SCOPE-ASSIGNED', total: 202, created_by: admin.id, assigned_user_id: worker.id });
  const hidden = await db.Invoice.create({ tenant_id: 1, customer_id: customer.id, invoice_number: 'SCOPE-HIDDEN', total: 9999, created_by: admin.id });
  await db.InvoiceItem.bulkCreate([owned, assigned, hidden].map(row => ({ tenant_id: 1, invoice_id: row.id, description: row.invoice_number, quantity: 1, unit_price: row.total, total: row.total, service_charge: 10 })));
  const list = await (await request('/api/v1/invoices?limit=100', worker)).json();
  assert.equal(list.success, true, JSON.stringify(list));
  assert.deepEqual(list.data.map(row => row.id), [owned.id]);
  assert.equal(list.data[0].InvoiceItems, undefined, 'List access must not expose detail lines');
  assert.equal((await request(`/api/v1/invoices/${owned.id}`, worker)).status, 404);
  assert.equal((await request(`/api/v1/invoices/${assigned.id}`, worker)).status, 200);
  assert.equal((await request(`/api/v1/invoices/${hidden.id}`, worker)).status, 404);
  assert.equal((await request(`/api/v1/document-templates/invoice/${hidden.id}/pdf`, worker)).status, 404);
  assert.equal((await request(`/api/v1/document-templates/invoice/${assigned.id}/pdf`, worker)).status, 200);
  const financial = await (await request('/api/v1/reports/financial-summary', worker)).json();
  assert.equal(financial.data.total_revenue, 11, JSON.stringify(financial));
  assert.equal(financial.data.total_cost, 0);
  assert.equal((await request('/api/v1/salaries/summary',worker)).status,403,'Scoped roles cannot fall back to an unrelated legacy module');
  const stats = await (await request('/api/v1/dashboard/stats', worker)).json();
  assert.equal(stats.data.monthly_receivable, 101, JSON.stringify(stats));
  assert.equal((await request(`/api/v1/record-assignments/Invoice/${hidden.id}`, worker, 'PUT', { assigned_user_id: worker.id })).status, 404);
  assert.equal((await request(`/api/v1/record-assignments/Invoice/${assigned.id}`, worker, 'PUT', { assigned_user_id: outsider.id })).status, 400);
  assert.equal((await request(`/api/v1/record-assignments/Invoice/${assigned.id}`, worker, 'PUT', { assigned_user_id: worker.id })).status, 200);
  assert.equal((await request(`/api/v1/invoices/${assigned.id}`, worker, 'DELETE')).status, 404);
  const supplier = await db.Supplier.create({ tenant_id: 1, name: 'Scope supplier', assigned_user_id: worker.id });
  const hiddenSupplier = await db.Supplier.create({ tenant_id: 1, name: 'Hidden supplier' });
  await db.SupplierPurchase.bulkCreate([supplier, hiddenSupplier].map(row => ({ tenant_id: 1, supplier_id: row.id, reference_type: 'Manual', amount: 42 })));
  const purchases = await (await request('/api/v1/suppliers/purchases', worker)).json();
  assert.deepEqual(purchases.data.map(row => row.supplier_id), [supplier.id]);
  assert.equal((await request(`/api/v1/suppliers/${hiddenSupplier.id}/statement/xlsx`, worker)).status, 404);
  // Creation records the session user even when a caller supplies another creator.
  const leadRole = await db.Role.create({ name: 'Create only', tenant_id: 1, permissions: normalizePermissions({ leads: rules('none','none','none',true), customers:{read:true} }) });
  const creator = await db.User.create({ name: 'Creator', email: 'creator@example.test', tenant_id: 1, role_id: leadRole.id });
  const created = await request('/api/v1/leads', creator, 'POST', { name:'New lead', company_name:'Scoped company', phone:'123', source:'Website', status:'New', created_by:admin.id });
  assert.equal(created.status, 201, await created.clone().text());
  const lead = await db.Lead.findOne({where:{company_name:'Scoped company'}});
  assert.equal(lead.created_by, creator.id);
  assert.equal((await request(`/api/v1/leads/${lead.id}`, creator, 'PUT', { notes:'Blocked' })).status, 403);
  assert.equal((await request('/api/v1/leads', creator)).status, 403);
  // Role changes are read on the next request, without issuing a new token.
  await role.update({ permissions: normalizePermissions({ invoices: rules('none') }) });
  assert.equal((await request('/api/v1/invoices', worker)).status, 403);
  const savedRules = { invoices: rules('all','own','assigned',true,'none') };
  const save = await request(`/api/v1/roles/${role.id}`,admin,'PUT',{permissions:savedRules});
  assert.equal(save.status,200,await save.clone().text());
  await role.reload(); assert.equal(role.permissions.invoices.rules.edit,'assigned');
  assert.equal((await request('/api/v1/roles',admin,'POST',{name:'Developer',type:'Internal'})).status,400);
  assert.equal((await request(`/api/v1/roles/${role.id}`,outsider,'PUT',{permissions:savedRules})).status,404);
});

test('lead type badges remain visible with list-only access', async () => {
  const role = await db.Role.create({tenant_id:1,name:'Lead type summary',permissions:require('../utils/permissionRules').normalizePermissions({leads:{rules:{list:'all',detail:'none',edit:'none',create:false,delete:'none'}}})});
  const reader = await db.User.create({tenant_id:1,name:'Lead summary reader',email:'lead-summary@example.test',role_id:role.id});
  const leads = await Promise.all(['Company','Person',null].map(lead_type => db.Lead.create({tenant_id:1,company_name:'Type summary',phone:'0000',lead_type,notes:'Private details'})));
  const response = await request('/api/v1/leads',reader);
  assert.equal(response.status,200);
  const rows = (await response.json()).data;
  for (const lead of leads) {
    const row = rows.find(item => item.id === lead.id);
    assert.equal(row.lead_type,lead.lead_type);
    assert.equal(row.notes,undefined);
    assert.equal((await request(`/api/v1/leads/${lead.id}`,reader)).status,403);
  }
});

test('document templates isolate settings and exports by tenant and permission', async () => {
  const root = '/api/v1/document-templates';
  assert.equal((await request(root)).status, 401);
  assert.equal((await request(root + '/defaults', denied, 'PUT', { defaults: {}, footer: '' })).status, 403);
  assert.equal((await request(root + '/defaults', admin, 'PUT', { defaults: { invoice: 'modern' }, footer: 'Tenant A footer' })).status, 200);
  const otherSettings = await (await request(root, outsider)).json();
  assert.equal(otherSettings.settings.footer, undefined);
  assert.equal((await request(root + '/defaults', admin, 'PUT', { defaults: { invoice: 'arbitrary' }, footer: '' })).status, 400);
  const invoice = await db.Invoice.create({ tenant_id: 1, customer_id: customer.id, invoice_number: 'TEMPLATE-001', subtotal: 100, total: 100 });
  await db.InvoiceItem.create({ tenant_id: 1, invoice_id: invoice.id, description: 'Example', quantity: 1, unit_price: 100, total: 100 });
  await request(root + '/defaults', admin, 'PUT', { defaults: { invoice: 'minimal' }, footer: 'Changed footer' });
  const snapshot = await db.DocumentTemplateSnapshot.findOne({ where: { document_group: 'invoice', record_id: invoice.id, tenant_id: 1 } });
  assert.equal(snapshot.defaults.invoice, 'modern');
  assert.equal(snapshot.footer, 'Tenant A footer');
  for (const type of ['invoice', 'tax_invoice']) {
    await request('/api/v1/config',admin,'PUT',{is_tax_enabled:type==='tax_invoice',tax_registration_number:type==='tax_invoice'?'100000000000001':''});
    assert.equal((await request(`${root}/${type}/${invoice.id}/pdf`, outsider)).status, 404);
    assert.equal((await request(`${root}/${type}/${invoice.id}/pdf`, denied)).status, 403);
    const pdf = await request(`${root}/${type}/${invoice.id}/pdf?template=modern`, admin);
    assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /application\/pdf/);
    assert.ok(Buffer.from(await pdf.arrayBuffer()).toString('latin1').startsWith('%PDF-'));
  }
  await request('/api/v1/config',admin,'PUT',{is_tax_enabled:false,tax_registration_number:''});
  assert.equal((await request(root + '/preview?type=invoice&template=classic', denied)).status, 403);
  assert.equal((await request(root + '/preview?type=invoice&template=classic', admin)).status, 200);
  assert.equal((await request(root + '/invoice/1/pdf?template=invalid', admin)).status, 400);
});

test('internal quotation detail includes pricing and salesperson while PDF omits internal amounts', async () => {
 const response=await request('/api/v1/quotations',admin,'POST',{
  recipient_name:'Internal quotation sample',assigned_user_id:admin.id,contact_person:'Sample contact',customer_reference:'VIEW-REF',branch:'Dubai',
  internal_remarks:'PRIVATE REMARK 8844',items:[{service_name:'Visa assistance',description:'Customer-facing service description',quantity:2,cost:123.45,service_charge:67.89,rate:191.34,expected_processing_time:'3 working days'}]
 });
 assert.equal(response.status,201);const quote=(await response.json()).data;
 const detail=await request(`/api/v1/quotations/${quote.id}`,admin);assert.equal(detail.status,200);const data=(await detail.json()).data;
 assert.equal(Number(data.items[0].cost),123.45);assert.equal(Number(data.items[0].service_charge),67.89);
 assert.equal(data.items[0].expected_processing_time,'3 working days');assert.equal(data.assigned_staff.name,admin.name);
 assert.equal(data.customer_reference,'VIEW-REF');assert.equal(data.internal_remarks,'PRIVATE REMARK 8844');
 assert.equal((await request(`/api/v1/quotations/${quote.id}`,outsider)).status,404);
 assert.equal((await request(`/api/v1/quotations/${quote.id}`,portal)).status,403);
 for(const style of ['classic','modern','compact','minimal']){
  const pdf=await request(`/api/v1/quotations/${quote.id}/pdf?template=${style}`,admin);assert.equal(pdf.status,200);
  const bytes=Buffer.from(await pdf.arrayBuffer());assert.ok(bytes.toString('latin1').startsWith('%PDF-'));
  if(process.env.QUOTATION_PDF_QA_DIR){fs.mkdirSync(process.env.QUOTATION_PDF_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.QUOTATION_PDF_QA_DIR,`quotation-${style}.pdf`),bytes);}
 }
});

test('invoice PDF type requires both VAT enabled and registration and stays tenant scoped', async () => {
  const invoice=await db.Invoice.create({tenant_id:1,customer_id:customer.id,invoice_number:'VAT-TYPE-001',subtotal:100,total:100});
  const root='/api/v1/document-templates';
  for (const [enabled,trn,type] of [[false,'','invoice'],[true,'','invoice'],[false,'100000000000001','invoice'],[true,'   ','invoice'],[true,'100000000000001','tax_invoice']]) {
    assert.equal((await request('/api/v1/config',admin,'PUT',{is_tax_enabled:enabled,tax_registration_number:trn})).status,200);
    const wrong=type==='invoice'?'tax_invoice':'invoice';
    assert.equal((await request(`${root}/${wrong}/${invoice.id}/pdf`,admin)).status,400);
    const pdf=await request(`${root}/${type}/${invoice.id}/pdf?template=classic`,admin);
    assert.equal(pdf.status,200); await pdf.arrayBuffer();
    assert.equal((await request(`${root}/${type}/${invoice.id}/pdf`,outsider)).status,404);
    const legacy=await request(`/api/v1/invoices/${invoice.id}/pdf`,admin);
    assert.equal(legacy.status,200); assert.match(legacy.headers.get('content-disposition'),type==='tax_invoice'?/TaxInvoice_/:/filename=Invoice_/); await legacy.arrayBuffer();
  }
  const otherInvoice=await db.Invoice.create({tenant_id:2,customer_id:(await db.Customer.create({tenant_id:2,name:'Other VAT customer',phone_whatsapp:'123'})).id,invoice_number:'VAT-TYPE-OTHER',total:100});
  assert.equal((await request(`${root}/tax_invoice/${otherInvoice.id}/pdf`,outsider)).status,400);
  assert.equal((await request(`${root}/invoice/${otherInvoice.id}/pdf`,outsider)).status,200);
  await request('/api/v1/config',admin,'PUT',{is_tax_enabled:false,tax_registration_number:''});
});

test('template adapters export real orders, expenses and payments without creating transactions', async () => {
  const root = '/api/v1/document-templates';
  const order = await db.SalesOrder.create({ tenant_id: 1, customer_id: customer.id, order_number: 'TEMPLATE-SO-001', order_date: '2030-01-01' });
  await db.SalesOrderItem.create({ tenant_id: 1, sales_order_id: order.id, service_name: 'Test service', quantity: 2, estimated_price: 100 });
  const expense = await db.Expense.create({ tenant_id: 1, description: 'Test expense', amount: 200, paid_amount: 50, status: 'Partially Paid' });
  const invoice = await db.Invoice.create({ tenant_id: 1, customer_id: customer.id, invoice_number: 'TEMPLATE-PAY-001', total: 200, paid_amount: 50 });
  const payment = await db.WalletTransaction.create({ tenant_id: 1, account_id: wallet.id, type: 'Income', direction: 'In', reference_type: 'Invoice', reference_id: invoice.id, amount: 50 });
  const count = await db.WalletTransaction.count({ where: { tenant_id: 1 } });
  for (const [type, id] of [['sales_order', order.id], ['proforma', order.id], ['expense', expense.id], ['receipt', payment.id]]) {
    const response = await request(`${root}/${type}/${id}/pdf?template=compact`, admin);
    assert.equal(response.status, 200, `${type}: ${await response.text()}`);
    assert.equal((await request(`${root}/${type}/${id}/pdf`, outsider)).status, 404);
  }
  assert.equal(await db.WalletTransaction.count({ where: { tenant_id: 1 } }), count);
  assert.equal((await request(`${root}/receipt/999999/pdf`, admin)).status, 404);
  const role = await db.Role.create({ name: 'Template portal', type: 'CustomerPortal', tenant_id: 1, permissions: { invoices: { read: true }, wallet: { read: true } } });
  const reader = await db.User.create({ name: 'Template portal', email: 'template-portal@example.test', role_id: role.id, tenant_id: 1 });
  assert.equal((await request(`${root}/invoice/${invoice.id}/pdf`, reader)).status, 404);
  assert.equal((await request(`${root}/receipt/${payment.id}/pdf`, reader)).status, 404);
  await db.UserCustomer.create({ user_id: reader.id, customer_id: customer.id });
  assert.equal((await request(`${root}/invoice/${invoice.id}/pdf`, reader)).status, 200);
  assert.equal((await request(`${root}/receipt/${payment.id}/pdf`, reader)).status, 200);
});

test('invoice aging filters all statuses by invoice date with correct boundaries, pagination and tenant scope', async () => {
  const { invoiceAgingCutoff } = require('../utils/invoiceAging');
  const agingCustomer = await db.Customer.create({ tenant_id: 1, name: 'Aging customer', phone_whatsapp: '+971500000099' });
  const ages = [29, 30, 59, 60, 89, 90, 119, 120, 150];
  const cutoff30 = invoiceAgingCutoff('30');
  const anchor = cutoff30.getTime() - 12 * 60 * 60 * 1000 + 30 * 86400000;
  for (const age of ages) {
    const invoice = await db.Invoice.create({ tenant_id: 1, customer_id: agingCustomer.id, invoice_number: `AGING-${age}`, total: 100, status: age === 60 ? 'Paid' : age === 90 ? 'Cancelled' : 'Issued', paid_amount: age === 60 ? 100 : 0, created_at: new Date(anchor - age * 86400000), due_date: '2099-01-01' });
    await db.InvoiceItem.bulkCreate([1, 2].map(n => ({ tenant_id: 1, invoice_id: invoice.id, description: `Line ${n}`, quantity: 1, unit_price: 50, total: 50 })));
  }
  for (const threshold of [30, 60, 90, 120]) {
    const response = await request(`/api/v1/invoices?aging=${threshold}&customer_id=${agingCustomer.id}&limit=100`, admin);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.data.map(row => Number(row.invoice_number.split('-')[1])).sort((a,b) => a-b), ages.filter(age => age >= threshold));
    assert.equal(result.meta.total, ages.filter(age => age >= threshold).length);
  }
  const page = await (await request(`/api/v1/invoices?aging=30&customer_id=${agingCustomer.id}&limit=2&page=2`, admin)).json();
  assert.equal(page.data.length, 2); assert.equal(page.meta.total, 8); assert.equal(page.meta.page, 2);
  const combined = await (await request('/api/v1/invoices?aging=60&status=Paid&search=AGING-60&date_from=2000-01-01&date_to=2099-01-01', admin)).json();
  assert.deepEqual(combined.data.map(row => row.invoice_number), ['AGING-60']);
  assert.equal((await request('/api/v1/invoices?aging=31', admin)).status, 400);
  const foreign = await (await request(`/api/v1/invoices?aging=30&customer_id=${agingCustomer.id}`, outsider)).json();
  assert.equal(foreign.data.length, 0);
});

test('startup does not create default privileged accounts', async () => {
  assert.equal(await db.User.count({ where: { email: ['admin@test.com', 'developer@looppe.com'] } }), 0);
});

test('known legacy credentials are retired without changing customized passwords', async () => {
  const role = await db.Role.findOne({ where: { name: 'Admin', tenant_id: 1 } });
  const old = await db.User.create({ name: 'Legacy', email: 'admin@test.com', password_hash: 'admin123', tenant_id: 1, role_id: role.id });
  const customized = await db.User.create({ name: 'Customized', email: 'developer@looppe.com', password_hash: 'customized-safe-password', tenant_id: 1, role_id: role.id });
  const { retireDefaultAccounts } = require('../utils/bootstrap-accounts');
  await retireDefaultAccounts(db.User);
  await old.reload(); await customized.reload();
  assert.equal(old.is_active, false); assert.equal(old.can_login, false); assert.equal(old.password_hash, null);
  assert.equal(await customized.validatePassword('customized-safe-password'), true);
  assert.equal((await request('/api/v1/auth/me', old)).status, 401);
});

test('explicit account provisioning rejects missing credentials and existing accounts', async () => {
  const { createAdmin } = require('../create_admin');
  await assert.rejects(createAdmin(), /Supply BOOTSTRAP/);
  process.env.BOOTSTRAP_ADMIN_EMAIL = 'provisioned@example.test';
  process.env.BOOTSTRAP_ADMIN_PASSWORD = 'explicit-long-test-password';
  process.env.BOOTSTRAP_TENANT_ID = '1';
  await createAdmin();
  await assert.rejects(createAdmin(), /already exists/);
  const user = await db.User.findOne({ where: { email: process.env.BOOTSTRAP_ADMIN_EMAIL } });
  assert.equal(await user.validatePassword(process.env.BOOTSTRAP_ADMIN_PASSWORD), true);
});

test('both private file aliases enforce authentication, tenancy, permissions and portal links', async () => {
  const linkedPath = file('documents', 'linked');
  const unlinkedPath = file('documents', 'unlinked');
  await db.Document.bulkCreate([
    { customer_id: customer.id, tenant_id: 1, expiry_date: '2030-01-01', file_path: linkedPath },
    { customer_id: otherCustomer.id, tenant_id: 1, expiry_date: '2030-01-01', file_path: unlinkedPath }
  ]);
  for (const prefix of ['', '/api/v1']) {
    assert.equal((await request(prefix + linkedPath)).status, 401);
    assert.equal((await request(prefix + linkedPath, outsider)).status, 404);
    assert.equal((await request(prefix + linkedPath, denied)).status, 404);
    assert.equal((await request(prefix + linkedPath, portal)).status, 200);
    assert.equal((await request(prefix + unlinkedPath, portal)).status, 404);
    const response = await request(prefix + linkedPath, admin);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal((await request('/uploads/documents/%2e%2e%2fbranding%2fregression-linked.png', admin)).status, 404);
  assert.equal((await request('/uploads/documents/%252e%252e%252fsecret.png', admin)).status, 404);
  assert.equal((await request(file('documents', 'orphan'), admin)).status, 404);
});

test('branding stays public; staff and sales attachments keep their access boundaries', async () => {
  assert.equal((await request(file('branding', 'logo'))).status, 200);
  const staffPath = file('documents', 'staff');
  await db.StaffDocument.create({ tenant_id: 1, user_id: staff.id, expiry_date: '2030-01-01', file_path: staffPath });
  assert.equal((await request(staffPath, admin)).status, 200);
  assert.equal((await request(staffPath, portal)).status, 404);
  const order = await db.SalesOrder.create({ tenant_id: 1, customer_id: customer.id, order_number: 'REG-1' });
  const attachment = file('documents', 'sales');
  await db.SalesOrderItem.create({ tenant_id: 1, sales_order_id: order.id, service_name: 'Test', confirm_attachment: attachment });
  assert.equal((await request(attachment, portal)).status, 200);
  await order.update({ customer_id: otherCustomer.id });
  assert.equal((await request(attachment, portal)).status, 404);
  const avatar = file('avatars', 'avatar'); await admin.update({ avatar });
  assert.equal((await request(avatar, admin)).status, 200);
  assert.equal((await request(avatar, outsider)).status, 404);
});

test('login and refresh enable native private previews; logout clears the file cookie', async () => {
  const response = await request('/api/v1/auth/login', null, 'POST', { email: admin.email, password: 'regression-password-only' });
  assert.equal(response.status, 200);
  const cookies = response.headers.getSetCookie();
  const fileCookie = cookies.find(c => c.startsWith('fileAccessToken='));
  assert.match(fileCookie, /HttpOnly/); assert.match(fileCookie, /SameSite=Strict/);
  assert.equal((await request('/uploads/documents/regression-linked.png', null, 'GET', undefined, fileCookie.split(';')[0])).status, 200);
  const refreshCookie = cookies.find(c => c.startsWith('refreshToken=')).split(';')[0];
  // Native previews still work after the 15-minute access cookie has expired.
  assert.equal((await request('/uploads/documents/regression-linked.png', null, 'GET', undefined, refreshCookie)).status, 200);
  const refresh = await request('/api/v1/auth/refresh', null, 'POST', {}, refreshCookie);
  assert.equal(refresh.status, 200); assert.match(refresh.headers.get('set-cookie'), /fileAccessToken=/);
  const logout = await request('/api/v1/auth/logout', null, 'POST', {});
  assert.match(logout.headers.get('set-cookie'), /fileAccessToken=;/);
  // Cookie-only authentication does not grant access to mutating API routes.
  assert.equal((await request('/api/v1/documents', null, 'POST', {}, fileCookie.split(';')[0])).status, 401);
  assert.equal((await request('/api/v1/documents', null, 'POST', {}, refreshCookie)).status, 401);
});

test('client cannot claim another attachment using file_path on document create/update', async () => {
  const body = { customer_id: customer.id, expiry_date: '2030-01-01', file_path: '/uploads/documents/regression-staff.png' };
  const response = await request('/api/v1/documents', admin, 'POST', body);
  assert.equal(response.status, 201);
  const document = (await response.json()).data;
  assert.equal(document.file_path, null);
  assert.equal((await request(`/api/v1/documents/${document.id}`, admin, 'PUT', body)).status, 200);
  assert.equal((await db.Document.findByPk(document.id)).file_path, null);
});

test('legitimate multipart uploads remain readable by their owner', async () => {
  const form = new FormData();
  form.append('customer_id', String(customer.id));
  form.append('expiry_date', '2030-01-01');
  form.append('file', new Blob([fs.readFileSync(files[0])], { type: 'image/png' }), 'test.png');
  const response = await fetch(base + '/api/v1/documents', { method: 'POST', headers: { Authorization: `Bearer ${token(admin)}` }, body: form });
  assert.equal(response.status, 201);
  const document = (await response.json()).data;
  files.push(path.join(__dirname, '..', document.file_path));
  assert.equal((await request(document.file_path, admin)).status, 200);
  assert.equal((await request(document.file_path, outsider)).status, 404);
});

test('invalid payment amounts never turn into full payments; partial and omitted amounts work', async () => {
  const { items } = await payroll('2030-01');
  for (const amount of [0, -1, '', null, 'junk', '10oops', 'Infinity', true, [], 1.001, 101]) {
    const response = await request('/api/v1/salaries/pay-single', admin, 'POST', { salary_item_id: items[0].id, account_id: wallet.id, amount });
    assert.equal(response.status, 400, `Amount ${JSON.stringify(amount)}`);
  }
  assert.equal(await db.SalaryPayment.count(), 0);
  assert.equal((await request('/api/v1/salaries/pay-single', admin, 'POST', { salary_item_id: items[0].id, account_id: wallet.id, amount: '25.50' })).status, 200);
  assert.equal((await request('/api/v1/salaries/pay-single', admin, 'POST', { salary_item_id: items[0].id, account_id: wallet.id })).status, 200);
  assert.equal(Number((await items[0].reload()).paid_amount), 100);
});

test('concurrent single payments from different wallets create exactly one disbursement', async () => {
  const { items } = await payroll('2030-02');
  const wallet2 = await db.WalletAccount.create({ name: 'Other Wallet', tenant_id: 1, balance: 10000 });
  const results = await Promise.all([wallet, wallet2].map(account => request('/api/v1/salaries/pay-single', admin, 'POST', { salary_item_id: items[0].id, account_id: account.id, amount: 100 })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal(await db.SalaryPayment.count({ where: { salary_item_id: items[0].id } }), 1);
});

test('overlapping single and batch payments retain correct item and payroll totals', async () => {
  const { p, items } = await payroll('2030-03', 2);
  const results = await Promise.all([
    request('/api/v1/salaries/pay-single', admin, 'POST', { salary_item_id: items[0].id, account_id: wallet.id }),
    request('/api/v1/salaries/pay-batch', admin, 'POST', { salary_item_ids: items.map(i => i.id), account_id: wallet.id })
  ]);
  assert.ok(results.every(r => [200, 400].includes(r.status)));
  assert.equal(await db.SalaryPayment.count({ where: { salary_item_id: items.map(i => i.id) } }), 2);
  assert.equal(Number((await p.reload()).paid_amount), 200);
  assert.equal((await request('/api/v1/salaries/month/2030-03', admin, 'DELETE')).status, 400);
});

test('payments after billing reduce billed debt first and do not double-credit unbilled debt', async () => {
  const card = await db.WalletAccount.create({ name: 'Credit Card', tenant_id: 1, account_type: 'Credit', bill_day: 1, due_day: 20, credit_limit: 5000 });
  const now = new Date();
  const beforeBill = new Date(now.getFullYear(), now.getMonth(), 0, 12);
  const current = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  await db.WalletTransaction.bulkCreate([
    { account_id: card.id, tenant_id: 1, type: 'Expense', direction: 'Out', amount: 1000, created_at: beforeBill },
    { account_id: card.id, tenant_id: 1, type: 'Expense', direction: 'Out', amount: 300, created_at: current },
    { account_id: card.id, tenant_id: 1, type: 'Transfer', direction: 'In', amount: 600, created_at: current }
  ]);
  let data = (await (await request('/api/v1/wallet/accounts', admin)).json()).data.find(a => a.id === card.id);
  assert.equal(data.billed_remaining, 400); assert.equal(data.unbilled_amount, 300); assert.equal(data.outstanding_balance, 700);
  await db.WalletTransaction.create({ account_id: card.id, tenant_id: 1, type: 'Transfer', direction: 'In', amount: 500, created_at: current });
  data = (await (await request('/api/v1/wallet/accounts', admin)).json()).data.find(a => a.id === card.id);
  assert.equal(data.billed_remaining, 0); assert.equal(data.unbilled_amount, 200); assert.equal(data.outstanding_balance, 200);
});

test('unavailable database prevents startup from opening an HTTP listener', async () => {
  const child = spawn(process.execPath, ['app.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, DB_PORT: '1' }, windowsHide: true });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1); assert.doesNotMatch(output, /Server running on/);
  assert.equal((await request('/health')).status, 200);
  const authenticate = db.sequelize.authenticate;
  try {
    db.sequelize.authenticate = async () => { throw new Error('Database unavailable'); };
    assert.equal((await request('/health')).status, 503);
  } finally { db.sequelize.authenticate = authenticate; }
});

test('lead details and follow-ups preserve channels, history and tenant isolation', async () => {
  const root = '/api/v1/leads';
  const lead = await db.Lead.create({ tenant_id: 1, company_name: 'Follow-up test', phone: '+971500000000', status: 'New' });
  assert.equal((await request(`${root}/${lead.id}`, outsider)).status, 404);
  assert.equal((await request(`${root}/${lead.id}/follow-ups`, denied, 'POST', {})).status, 403);
  assert.equal((await request(`${root}/${lead.id}/follow-ups`, outsider, 'POST', {})).status, 404);
  for (const channel of ['Call', 'WhatsApp', 'Meeting', 'Email']) {
    const response = await request(`${root}/${lead.id}/follow-ups`, admin, 'POST', {
      channel, occurred_at: '2026-01-01T10:00:00Z', notes: `Completed ${channel}`, tenant_id: 2, created_by: outsider.id
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.tenant_id, 1);
    assert.equal(body.data.created_by, admin.id);
  }
  for (const payload of [
    { channel: 'SMS', occurred_at: '2026-01-01', notes: 'Invalid' },
    { channel: 'Call', occurred_at: 'bad', notes: 'Invalid' },
    { channel: 'Call', occurred_at: '2099-01-01', notes: 'Invalid' },
    { channel: 'Call', occurred_at: '2026-01-01', notes: ' ' }
  ]) assert.equal((await request(`${root}/${lead.id}/follow-ups`, admin, 'POST', payload)).status, 400);
  assert.equal((await request(`${root}/${lead.id}`, admin, 'PUT', { status: 'Contacted', update_source: 'Details' })).status, 200);
  const detail = (await (await request(`${root}/${lead.id}`, admin)).json()).data;
  assert.equal(detail.followUps.length, 4);
  assert.equal(detail.history[0].new_status, 'Contacted');
  assert.equal(detail.history[0].previous_status, 'New');
  assert.equal(detail.status, 'Contacted');
});

test('follow-up attachments are optional, validated and protected by lead access', async () => {
  const lead = await db.Lead.create({tenant_id:1,company_name:'Attachment prospect',phone:'0000'});
  const endpoint = `/api/v1/leads/${lead.id}/follow-ups`;
  const bytes = Buffer.from('%PDF-1.4\nFollow-up attachment\n%%EOF');
  const upload = async (content, filename = 'conversation.pdf', mime = 'application/pdf') => {
    const form = new FormData();
    form.append('channel','Call');form.append('occurred_at','2026-01-01T10:00:00Z');form.append('notes','Customer discussion');
    form.append('attachment',new Blob([content],{type:mime}),filename);
    return fetch(base+endpoint,{method:'POST',headers:{Authorization:`Bearer ${token(admin)}`},body:form});
  };
  const response = await upload(bytes);
  assert.equal(response.status,201);
  const activity = (await response.json()).data;
  assert.equal(activity.attachment_name,'conversation.pdf');assert.equal(activity.attachment_data,undefined);
  const detail = (await (await request(`/api/v1/leads/${lead.id}`,admin)).json()).data;
  assert.equal(detail.followUps[0].attachment_data,undefined);assert.equal(detail.followUps[0].attachment_name,'conversation.pdf');
  const download = endpoint+`/${activity.id}/attachment`;
  const saved = await request(download,admin);
  assert.equal(saved.status,200);assert.match(saved.headers.get('content-disposition'),/attachment/);
  assert.deepEqual(Buffer.from(await saved.arrayBuffer()),bytes);
  assert.equal((await request(download,outsider)).status,404);
  assert.equal((await request(download,denied)).status,403);
  const listRole = await db.Role.create({tenant_id:1,name:'Lead attachment list only',permissions:require('../utils/permissionRules').normalizePermissions({leads:{rules:{list:'all',detail:'none',edit:'none',create:false,delete:'none'}}})});
  const listUser = await db.User.create({tenant_id:1,name:'List only',role_id:listRole.id,email:'attachment-list@example.test'});
  assert.equal((await request(download,listUser)).status,403);
  assert.equal((await upload('not a PDF')).status,400);
  assert.equal((await upload('<script>bad</script>','bad.html','text/html')).status,400);
  assert.equal((await upload(Buffer.alloc(10*1024*1024+1))).status,400);
  assert.equal(await db.LeadFollowUp.count({where:{lead_id:lead.id}}),1);
});

test('scheduled lead follow-ups require dates, complete once, reschedule and reopen safely', async () => {
  const root = '/api/v1/leads';
  const lead = await db.Lead.create({tenant_id:1,company_name:'Scheduled prospect',phone:'123',status:'Qualified'});
  const endpoint = `${root}/${lead.id}`;
  await db.LeadStatusHistory.bulkCreate([
    {lead_id:lead.id,previous_status:'New',new_status:'Contacted',changed_by:admin.id},
    {lead_id:lead.id,previous_status:'Contacted',new_status:'Qualified',changed_by:admin.id}
  ]);
  for (const date of [null, 'invalid', '2026-02-30']) {
    assert.equal((await request(endpoint, admin, 'PUT', {status:'Follow-up',next_follow_up_date:date})).status,400);
  }
  assert.equal((await request(endpoint, admin, 'PUT', {status:'Won'})).status,400);
  assert.equal((await request(endpoint, outsider, 'PUT', {status:'Follow-up',next_follow_up_date:'2026-10-13'})).status,404);
  assert.equal((await request(endpoint, denied, 'PUT', {status:'Follow-up',next_follow_up_date:'2026-10-13'})).status,403);
  assert.equal((await request(endpoint, admin, 'PUT', {status:'Follow-up',next_follow_up_date:'2026-10-13'})).status,200);
  let detail=(await (await request(endpoint,admin)).json()).data;
  assert.equal(detail.next_follow_up_date,'2026-10-13');assert.equal(detail.status,'Follow-up');
  assert.ok(detail.follow_up_scheduled_at);
  const scheduledAt=detail.follow_up_scheduled_at;
  assert.equal((await request(endpoint,admin,'PUT',{notes:'Ordinary edit',follow_up_scheduled_at:'2000-01-01T00:00:00Z'})).status,200);
  detail=(await (await request(endpoint,admin)).json()).data;
  assert.equal(detail.follow_up_scheduled_at,scheduledAt);
  const activity={channel:'Call',notes:'Discussed the opportunity',occurred_at:'2026-01-01T10:00:00Z',complete_scheduled_date:'2026-10-13',next_follow_up_date:'2026-11-01'};
  assert.equal((await request(endpoint+'/follow-ups',admin,'POST',activity)).status,201);
  assert.equal((await request(endpoint+'/follow-ups',admin,'POST',activity)).status,409);
  detail=(await (await request(endpoint,admin)).json()).data;
  assert.equal(detail.followUps.length,1);assert.equal(detail.next_follow_up_date,'2026-11-01');
  assert.equal((await request(endpoint+'/follow-ups',admin,'POST',{...activity,complete_scheduled_date:'2026-11-01',next_follow_up_date:null})).status,201);
  detail=(await (await request(endpoint,admin)).json()).data;
  assert.equal(detail.status,'Qualified');assert.equal(detail.next_follow_up_date,null);assert.equal(detail.followUps.length,2);
  assert.equal(detail.history.filter(entry=>entry.new_status==='Contacted').length,1,'Completing follow-ups retains Contacted without requiring it again');
  assert.ok(detail.history.some(entry=>entry.previous_status==='Contacted' && entry.new_status==='Qualified'),'The original qualification milestone remains recorded');
  assert.equal(detail.follow_up_scheduled_at,null);
  assert.equal((await request(endpoint,admin,'PUT',{status:'Follow-up',next_follow_up_date:'2026-12-01'})).status,200);
  assert.equal((await request(endpoint,admin,'PUT',{status:'Contacted'})).status,200);
  detail=(await (await request(endpoint,admin)).json()).data;
  assert.equal(detail.next_follow_up_date,null);assert.equal(detail.status,'Contacted');
  assert.equal(detail.follow_up_scheduled_at,null);
  const legacy=await db.Lead.create({tenant_id:1,company_name:'Historical prospect',phone:'456',status:'Lost'});
  assert.equal((await (await request(`${root}/${legacy.id}`,admin)).json()).data.status,'Qualified');
  await legacy.reload();assert.equal(legacy.status,'Lost');
  const upgrade=require('../utils/leadFollowUpSchema');
  await upgrade(db.sequelize);await upgrade(db.sequelize);
});

test('archived leads require a reason, stop follow-ups, preserve history and reopen', async () => {
  const upgrade = require('../utils/leadArchiveSchema');
  await upgrade(db.sequelize); await upgrade(db.sequelize);
  const lead = await db.Lead.create({ tenant_id:1, company_name:'Archive lifecycle', phone:'123', status:'Follow-up', next_follow_up_date:'2026-12-01', follow_up_scheduled_at:new Date() });
  const endpoint = `/api/v1/leads/${lead.id}`;
  const activity = { channel:'Call', notes:'Earlier conversation', occurred_at:'2026-01-01T10:00:00Z' };
  assert.equal((await request(endpoint+'/follow-ups',admin,'POST',activity)).status,201);
  assert.equal((await request(endpoint,admin,'PUT',{status:'Archived'})).status,400);
  assert.equal((await request(endpoint,admin,'PUT',{status:'Archived',archive_reason:'   '})).status,400);
  assert.equal((await request(endpoint,outsider,'PUT',{status:'Archived',archive_reason:'Not interested'})).status,404);
  assert.equal((await request(endpoint,denied,'PUT',{status:'Archived',archive_reason:'Not interested'})).status,403);
  assert.equal((await request(endpoint,admin,'PUT',{status:'Archived',archive_reason:' Not interested '})).status,200);
  let detail = (await (await request(endpoint,admin)).json()).data;
  assert.equal(detail.status,'Archived'); assert.equal(detail.archive_reason,'Not interested');
  assert.equal(detail.next_follow_up_date,null); assert.equal(detail.follow_up_scheduled_at,null);
  assert.equal(detail.followUps.length,1);
  assert.ok(detail.history.some(entry => entry.new_status==='Archived' && entry.archive_reason==='Not interested'));
  assert.equal((await request(endpoint+'/follow-ups',admin,'POST',{...activity,next_follow_up_date:'2026-12-02'})).status,409);
  assert.equal((await request(endpoint,admin,'PUT',{status:'Follow-up'})).status,400);
  assert.equal((await request(endpoint,admin,'PUT',{status:'Follow-up',next_follow_up_date:'2026-12-02'})).status,200);
  detail = (await (await request(endpoint,admin)).json()).data;
  assert.equal(detail.status,'Follow-up'); assert.equal(detail.archive_reason,null);
  assert.equal(detail.followUps.length,1);
  assert.ok(detail.history.some(entry => entry.new_status==='Archived' && entry.archive_reason==='Not interested'));
});

test('lead Excel export keeps selected records, text phones and permission boundaries', async () => {
  const { normalizePermissions } = require('../utils/permissionRules');
  const role = await db.Role.create({tenant_id:1,name:'Lead export list only',permissions:normalizePermissions({leads:{rules:{list:'assigned',detail:'none',edit:'none',delete:'none',create:false}}})});
  const reader = await db.User.create({tenant_id:1,name:'Export reader',role_id:role.id});
  const lead = await db.Lead.create({tenant_id:1,company_name:'=Customer text',phone:'0502029780',source:'Meta Ads',notes:'Private note',assigned_user_id:reader.id});
  const hidden = await db.Lead.create({tenant_id:1,company_name:'Hidden lead',phone:'123'});
  const other = await db.Lead.create({tenant_id:2,company_name:'Other tenant',phone:'456'});
  await db.LeadFollowUp.create({tenant_id:1,lead_id:lead.id,channel:'Call',occurred_at:new Date(),notes:'Private call'});
  const root = '/api/v1/leads/export/excel';
  assert.equal((await request(root,denied,'POST',{ids:[lead.id]})).status,403);
  assert.equal((await request(root,admin,'POST',{ids:['invalid']})).status,400);
  const Excel = require('exceljs');
  const response = await request(root,reader,'POST',{ids:[other.id,hidden.id,lead.id]});
  assert.equal(response.status,200); assert.match(response.headers.get('content-type'),/spreadsheetml/);
  const workbook = new Excel.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const sheet = workbook.getWorksheet('Leads');
  assert.equal(sheet.rowCount,2); assert.equal(sheet.getCell('B2').value,'=Customer text');
  assert.equal(sheet.getCell('E2').value,'0502029780'); assert.equal(sheet.getCell('K2').value,1);
  assert.equal(sheet.getCell('O2').value,null);
  const adminResponse = await request(root,admin,'POST',{ids:[lead.id,other.id]});
  const full = new Excel.Workbook(); await full.xlsx.load(Buffer.from(await adminResponse.arrayBuffer()));
  assert.equal(full.getWorksheet('Leads').rowCount,2);
  assert.equal(full.getWorksheet('Leads').getCell('O2').value,'Private note');
});

test('lead Excel import previews, validates atomically and enforces workspace/create permissions', async () => {
  const Excel = require('exceljs');
  const endpoint='/api/v1/leads/import';
  const template=await request(endpoint+'/template',admin);
  assert.equal(template.status,200);
  const original=Buffer.from(await template.arrayBuffer());
  async function workbook(rows){
    const book=new Excel.Workbook(); await book.xlsx.load(original);
    for(const row of rows)book.getWorksheet('Leads').addRow(row);
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  async function upload(action,user,bytes){
    const body=new FormData();body.append('file',new Blob([bytes]),'leads.xlsx');
    return fetch(base+endpoint+'/'+action,{method:'POST',headers:{Authorization:`Bearer ${token(user)}`},body});
  }
  const { normalizePermissions } = require('../utils/permissionRules');
  const role=await db.Role.create({tenant_id:1,name:'Import create only',permissions:normalizePermissions({leads:{rules:{list:'none',detail:'none',edit:'none',delete:'none',create:true}}})});
  const creator=await db.User.create({tenant_id:1,name:'Importer',role_id:role.id});
  const service=await db.ServiceType.create({tenant_id:1,name:'Import service'});
  const foreignStaff=await db.User.create({tenant_id:2,name:'Foreign import staff'});
  const bytes=await workbook([['Import prospect','','B2C','0502029799','','Import service','Meta Ads','Follow-up','Importer','2026-12-01','2026-06-07','','Import notes']]);
  assert.equal((await upload('preview',denied,bytes)).status,403);
  assert.equal((await upload('confirm',denied,bytes)).status,403);
  const before=await db.Lead.count();
  const preview=await upload('preview',creator,bytes); assert.equal(preview.status,200);
  const data=(await preview.json()).data; assert.equal(data.valid,1,JSON.stringify(data.errors));assert.equal(data.errors.length,0);
  assert.equal(data.preview[0].phone,'+971502029799');assert.equal(await db.Lead.count(),before);
  const invalid=await workbook([['Valid row','','','0509991111','','','','New'],['Invalid archived','','','0509992222','','','','Archived']]);
  assert.equal((await upload('confirm',admin,invalid)).status,400);assert.equal(await db.Lead.count(),before);
  const crossTenant=await workbook([['Foreign assignment','','','0509993333','','','','New',foreignStaff.name]]);
  assert.equal((await upload('confirm',admin,crossTenant)).status,400);
  const confirmed=await upload('confirm',creator,bytes); assert.equal(confirmed.status,200,await confirmed.clone().text());
  assert.equal((await confirmed.json()).data.imported,1);
  const lead=await db.Lead.findOne({where:{company_name:'Import prospect'}});
  assert.equal(lead.tenant_id,1);assert.equal(lead.created_by,creator.id);assert.equal(lead.assigned_user_id,creator.id);
  assert.equal(lead.service_id,service.id);assert.equal(lead.lead_type,'Person');assert.equal(lead.status,'Follow-up');
  assert.equal(lead.created_at.toISOString().slice(0,10),'2026-06-07');
  assert.equal(await db.LeadStatusHistory.count({where:{lead_id:lead.id}}),1);
  assert.equal((await upload('confirm',creator,bytes)).status,400); assert.equal(await db.Lead.count(),before+1);
  const malformed=await upload('preview',admin,Buffer.from('not an excel workbook'));assert.equal(malformed.status,400);
});

test('lead staff avatars return assigned identity and keep other workspace staff private', async () => {
  const assigned=await db.Lead.create({tenant_id:1,company_name:'Avatar assigned',phone:'0500011122',assigned_user_id:staff.id});
  const unassigned=await db.Lead.create({tenant_id:1,company_name:'Avatar unassigned',phone:'0500011133'});
  const foreign=await db.Lead.create({tenant_id:1,company_name:'Avatar foreign',phone:'0500011144',assigned_user_id:outsider.id});
  const rows=(await (await request('/api/v1/leads',admin)).json()).data;
  assert.equal(rows.find(row=>row.id===assigned.id).AssignedStaff.name,staff.name);
  assert.deepEqual(Object.keys(rows.find(row=>row.id===assigned.id).AssignedStaff).sort(),['avatar','id','name']);
  assert.equal(rows.find(row=>row.id===unassigned.id).AssignedStaff,null);
  assert.equal(rows.find(row=>row.id===foreign.id).AssignedStaff,null);
  const detail=(await (await request(`/api/v1/leads/${assigned.id}`,admin)).json()).data;
  assert.equal(detail.AssignedStaff.id,staff.id);
});

test('dashboard templates are tenant-scoped, role-assigned and never broaden record permissions', async () => {
  const root='/api/v1/dashboard';
  assert.equal((await request(root+'/templates',denied)).status,403);
  assert.equal((await request(root+'/templates',denied,'POST',{})).status,403);
  assert.equal((await request(root+'/templates',admin,'POST',{name:'Invalid widgets',record_scope:'accessible',widgets:['sql']})).status,400);
  assert.equal((await request(root+'/templates/presets',admin,'POST',{})).status,200);
  assert.equal((await request(root+'/templates/presets',admin,'POST',{})).status,200);
  const directory=(await (await request(root+'/templates',admin)).json()).data;
  assert.equal(directory.templates.filter(row=>['Admin Overview','Sales Focus','Work Focus'].includes(row.name)).length,3);
  const created=await request(root+'/templates',admin,'POST',{name:'Scoped dashboard test',record_scope:'assigned',widgets:['followups','leads','revenue','work','services','documents','actions']});
  assert.equal(created.status,201);const template=(await created.json()).data;
  assert.equal((await request(root+`/templates/${template.id}`,outsider,'PUT',{name:'Hijack',record_scope:'accessible',widgets:[]})).status,404);
  const foreign=await db.DashboardTemplate.create({tenant_id:2,name:'Foreign layout',record_scope:'accessible',widgets:['leads']});
  const {normalizePermissions}=require('../utils/permissionRules');
  const role=await db.Role.create({tenant_id:1,name:'Dashboard sales',permissions:normalizePermissions({dashboard:{read:true},leads:{rules:{list:'all',detail:'assigned',edit:'assigned',delete:'none',create:true}},services:{rules:{list:'assigned',detail:'assigned',edit:'assigned',delete:'none',create:false}},documents:{rules:{list:'assigned',detail:'assigned',edit:'none',delete:'none',create:false}}})});
  const worker=await db.User.create({tenant_id:1,name:'Dashboard worker',role_id:role.id});
  assert.equal((await request(root+`/templates/role/${role.id}`,admin,'PUT',{dashboard_template_id:foreign.id})).status,400);
  assert.equal((await request(root+`/templates/role/${role.id}`,outsider,'PUT',{dashboard_template_id:template.id})).status,400);
  const permissionSnapshot=JSON.parse(JSON.stringify(role.permissions));
  assert.equal((await request(root+`/templates/role/${role.id}`,admin,'PUT',{dashboard_template_id:template.id})).status,200);
  await role.reload();assert.deepEqual(role.permissions,permissionSnapshot);
  await db.Lead.bulkCreate([{tenant_id:1,company_name:'Assigned dashboard lead',phone:'500111111',status:'Follow-up',next_follow_up_date:'2001-01-01',assigned_user_id:worker.id},{tenant_id:1,company_name:'Other dashboard lead',phone:'500222222',status:'New',assigned_user_id:admin.id}]);
  const service=await db.ServiceType.create({tenant_id:1,name:'Dashboard work service'});
  await db.ServiceOrder.bulkCreate([{tenant_id:1,customer_id:customer.id,service_type_id:service.id,status:'Waiting for Customer',assigned_user_id:worker.id},{tenant_id:1,customer_id:customer.id,service_type_id:service.id,status:'Pending',assigned_user_id:admin.id}]);
  await db.Document.create({tenant_id:1,customer_id:customer.id,doc_number:'DASH-ASSIGNED',expiry_date:'2001-01-01',assigned_user_id:worker.id});
  let response=await request(root+'/layout?period=yearly',worker);assert.equal(response.status,200,await response.clone().text());
  let layout=(await response.json()).data;
  assert.equal(layout.template.id,template.id);assert.equal(layout.widgets[0].id,'followups');
  assert.equal(layout.widgets.find(row=>row.id==='leads').value,1);
  assert.equal(layout.widgets.find(row=>row.id==='work').value,1);
  assert.equal(layout.widgets.find(row=>row.id==='documents').value,1);
  assert.ok(!layout.widgets.some(row=>row.id==='revenue'));
  assert.equal(layout.widgets.find(row=>row.id==='actions').actions[0].label,'Lead');
  assert.equal((await request(root+`/templates/${template.id}`,admin,'DELETE')).status,400);
  const rules=normalizePermissions({dashboard:{read:true},leads:{rules:{list:'assigned',detail:'none',edit:'none',delete:'none',create:false}}});
  await role.update({permissions:rules});
  assert.equal((await request(root+`/templates/${template.id}`,admin,'PUT',{name:template.name,record_scope:'accessible',widgets:['leads','work','revenue']})).status,200);
  layout=(await (await request(root+'/layout',worker)).json()).data;
  assert.deepEqual(layout.widgets.map(row=>row.id),['leads']);assert.equal(layout.widgets[0].value,1);
  assert.equal((await request(root+`/templates/role/${role.id}`,admin,'PUT',{dashboard_template_id:null})).status,200);
  assert.equal((await (await request(root+'/layout',worker)).json()).data.template,null);
  assert.equal((await request(root+`/templates/${template.id}`,admin,'DELETE')).status,200);
  assert.equal((await request('/api/v1/roles',admin,'POST',{name:'Foreign template role',type:'Internal',dashboard_template_id:foreign.id})).status,400);
  const adminPreset=directory.templates.find(row=>row.name==='Admin Overview');
  assert.equal((await request(root+`/templates/role/${admin.role_id}`,admin,'PUT',{dashboard_template_id:adminPreset.id})).status,200);
  const overview=await request(root+'/layout?period=monthly',admin);assert.equal(overview.status,200,await overview.clone().text());
  assert.equal((await overview.json()).data.widgets.length,12);
  assert.equal((await request(root+`/templates/role/${admin.role_id}`,admin,'PUT',{dashboard_template_id:null})).status,200);
});

test('quotations calculate totals, link leads, record sent badges and protect revisions/PDFs', async () => {
  const root='/api/v1/quotations';
  const lead=await db.Lead.create({tenant_id:1,company_name:'Quoted prospect',phone:'0506667711',status:'Follow-up',next_follow_up_date:'2099-01-01'});
  const service=await db.ServiceType.create({tenant_id:1,name:'Quoted service',cost_price:80,service_charge:20});
  const payload={lead_id:lead.id,quotation_date:'2026-10-19',valid_until:'2099-12-31',recipient_name:'Quoted prospect',contact_person:'Contact',phone:lead.phone,discount:10,tax_rate:0,items:[{service_type_id:service.id,service_name:service.name,quantity:2,cost:80,service_charge:20,rate:100,total:999}],bank_details:{bank_name:'Test bank',iban:'AE-TEST-ONLY',account_name:'Test Company'},payment_terms:'Advance payment',terms:'Scope as listed',notes:'Public note',internal_remarks:'Private cost discussion'};
  const customerCount=await db.Customer.count();
  assert.equal((await request(root,denied,'POST',payload)).status,403);
  assert.equal((await request(root,portal,'POST',payload)).status,403);
  assert.equal((await request(root,admin,'POST',{...payload,valid_until:'2026-02-30'})).status,400);
  assert.equal((await request(root,outsider,'POST',payload)).status,400);
  const response=await request(root,admin,'POST',{...payload,tenant_id:2,status:'Accepted',total:999,created_by:outsider.id});
  assert.equal(response.status,201,await response.clone().text());const quote=(await response.json()).data;
  assert.equal(quote.status,'Draft');assert.equal(quote.tenant_id,1);assert.equal(quote.created_by,admin.id);
  assert.deepEqual((await (await request(`${root}?lead_id=${lead.id}`,admin)).json()).data.map(row=>row.id),[quote.id]);
  assert.deepEqual((await (await request(`${root}?lead_id=99999999`,admin)).json()).data,[]);
  assert.deepEqual((await (await request(`${root}?lead_id=${lead.id}`,outsider)).json()).data,[]);
  assert.equal((await request(`${root}?lead_id=invalid`,admin)).status,400);
  assert.equal(Number(quote.subtotal),200);assert.equal(Number(quote.total),190);assert.equal(quote.items[0].total,200);
  assert.equal(await db.Customer.count(),customerCount,'Quoting a lead must not create a customer');
  assert.equal((await request(`${root}/${quote.id}`,outsider)).status,404);
  assert.equal((await (await request(`/api/v1/leads/${lead.id}`,admin)).json()).data.quote_sent,false);
  assert.equal((await request(`${root}/${quote.id}/status`,admin,'POST',{status:'Accepted'})).status,400);
  assert.equal((await request(`${root}/${quote.id}/status`,admin,'POST',{status:'Sent'})).status,200);
  const leadDetail=(await (await request(`/api/v1/leads/${lead.id}`,admin)).json()).data;
  assert.equal(leadDetail.quote_sent,true);assert.equal(leadDetail.status,'Follow-up');assert.equal(leadDetail.next_follow_up_date,'2099-01-01');
  assert.equal((await request(`${root}/${quote.id}`,admin,'DELETE')).status,400);
  for(const style of ['classic','modern','compact','minimal']){
    const pdf=await request(`${root}/${quote.id}/pdf?template=${style}`,admin);assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/pdf/);assert.ok(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).equals(Buffer.from('%PDF')));
  }
  assert.equal((await request(`/api/v1/document-templates/quotation/${quote.id}/pdf?template=default`,admin)).status,200);
  assert.equal((await request(`${root}/${quote.id}/pdf`,outsider)).status,404);
  assert.equal((await request(`${root}/${quote.id}/status`,admin,'POST',{status:'Accepted'})).status,200);
  assert.equal((await request(`${root}/${quote.id}`,admin,'PUT',payload)).status,400);
});

test('quotation scopes keep bank details private and validate recipients and staff', async () => {
  const {normalizePermissions}=require('../utils/permissionRules');
  const role=await db.Role.create({tenant_id:1,name:'Quotation worker',permissions:normalizePermissions({quotations:{rules:{list:'own',detail:'assigned',edit:'own',delete:'created',create:true}},leads:{rules:{list:'assigned',detail:'assigned',edit:'none',delete:'none',create:false}}})});
  const worker=await db.User.create({tenant_id:1,name:'Quotation worker',role_id:role.id});
  const lead=await db.Lead.create({tenant_id:1,company_name:'Accessible quote lead',phone:'0000',assigned_user_id:worker.id});
  const hiddenLead=await db.Lead.create({tenant_id:1,company_name:'Hidden quote lead',phone:'0000'});
  const payload={lead_id:lead.id,quotation_date:'2026-10-19',recipient_name:lead.company_name,items:[{service_name:'Manual service',quantity:1,rate:25}],bank_details:{bank_name:'Private Bank'}};
  const root='/api/v1/quotations';
  const options=(await (await request(root+'/options',worker)).json()).data;
  assert.ok(options.leads.some(row=>row.id===lead.id));assert.ok(!options.leads.some(row=>row.id===hiddenLead.id));
  assert.equal((await request(root,worker,'POST',{...payload,lead_id:hiddenLead.id})).status,400);
  assert.equal((await request(root,worker,'POST',{...payload,assigned_user_id:outsider.id})).status,400);
  const response=await request(root,worker,'POST',payload);assert.equal(response.status,201,await response.clone().text());const quote=(await response.json()).data;
  const other=await db.Quotation.create({tenant_id:1,lead_id:lead.id,quotation_number:'QT-PRIVATE-SCOPE',quotation_date:'2026-10-19',recipient_name:'Other',bank_details:{bank_name:'Hidden'},items:[]});
  const list=(await (await request(root,worker)).json()).data;assert.ok(list.some(row=>row.id===quote.id));assert.ok(!list.some(row=>row.id===other.id));
  assert.deepEqual((await (await request(`${root}?lead_id=${lead.id}`,worker)).json()).data.map(row=>row.id),[quote.id],'Lead quote history retains quotation ownership scopes');
  assert.equal((await request(`${root}/${other.id}`,worker,'PUT',payload)).status,404);
  assert.equal((await request(`${root}/${quote.id}/pdf`,worker)).status,200);
  const updated=await request(`${root}/${quote.id}`,worker,'PUT',{...payload,assigned_user_id:admin.id});assert.equal(updated.status,200);
  assert.equal((await updated.json()).data.bank_details,undefined);
  assert.equal((await request(`${root}/${quote.id}`,worker)).status,404);
  assert.equal((await request(`${root}/${quote.id}/pdf`,worker)).status,404);
  const listOnly=await db.Role.create({tenant_id:1,name:'Quotes list only',permissions:normalizePermissions({quotations:{rules:{list:'all',detail:'none',edit:'none',delete:'none',create:false}}})});
  const reader=await db.User.create({tenant_id:1,name:'Quotes reader',role_id:listOnly.id});
  const summary=(await (await request(root,reader)).json()).data.find(row=>row.id===quote.id);assert.equal(summary.bank_details,undefined);assert.equal(summary.items,undefined);
  assert.equal((await request(root+'/options',reader)).status,403);
});

test('dashboard aged invoice count matches the 30+ invoice-date report', async () => {
  const oldDate=new Date(Date.now()-70*86400000);
  await db.Invoice.create({tenant_id:1,customer_id:customer.id,invoice_number:'AGED-CARD-PAID',created_at:oldDate,status:'Paid',payment_status:'Paid',due_date:'2099-01-01',total:100});
  await db.Invoice.create({tenant_id:1,customer_id:customer.id,invoice_number:'AGED-CARD-RECENT',status:'Overdue',due_date:'2001-01-01',total:100});
  const stats=await (await request('/api/v1/dashboard/stats',admin)).json();
  const report=await (await request('/api/v1/invoices?aging=30&limit=100',admin)).json();
  assert.equal(stats.success,true);
  assert.equal(stats.data.aged_invoices,report.meta.total);
  assert.ok(report.data.some(invoice=>invoice.invoice_number==='AGED-CARD-PAID'));
  assert.ok(!report.data.some(invoice=>invoice.invoice_number==='AGED-CARD-RECENT'));
});

test('dashboard periods use UAE boundaries and match invoice, expense and template totals', async () => {
  const periodRange=require('../utils/dashboardPeriod');
  const fixed=new Date('2026-10-20T20:30:00Z');
  assert.equal(periodRange('today',fixed).start.toISOString(),'2026-10-20T20:00:00.000Z');
  assert.equal(periodRange('monthly',fixed).start.toISOString(),'2026-09-30T20:00:00.000Z');
  assert.equal(periodRange('yearly',fixed).start.toISOString(),'2025-12-31T20:00:00.000Z');
  assert.equal(periodRange('today',fixed).end.toISOString(),'2026-10-21T20:00:00.000Z');
  assert.equal(periodRange('monthly',fixed).to,'2026-10-31');
  assert.equal(periodRange('yearly',fixed).to,'2026-12-31');
  assert.equal(periodRange('monthly',new Date('2024-02-28T23:00:00Z')).to,'2024-02-29');
  assert.equal(periodRange('today',new Date('2026-12-31T21:00:00Z')).from,'2027-01-01');
  const tenant=await db.Tenant.create({name:'Period isolation',slug:'period-isolation',status:'active'});
  const role=await db.Role.create({name:'Admin',tenant_id:tenant.id});
  const reader=await db.User.create({name:'Period admin',email:'period-admin@example.test',tenant_id:tenant.id,role_id:role.id});
  const recipient=await db.Customer.create({name:'Period customer',phone_whatsapp:'0000',tenant_id:tenant.id});
  const ranges=Object.fromEntries(['yearly','monthly','today'].map(period=>[period,periodRange(period)]));
  const moments=[new Date(+ranges.yearly.start-1000),ranges.yearly.start,ranges.monthly.start,ranges.today.start,new Date(+ranges.today.end-1000),ranges.today.end,ranges.monthly.end,ranges.yearly.end];
  const fixtures=[];
  for(const [index,created_at] of moments.entries()){
    const total=(index+1)*100;
    const invoice=await db.Invoice.create({tenant_id:tenant.id,customer_id:recipient.id,invoice_number:`PERIOD-${index}`,created_at,total,paid_amount:total/4,status:'Partially Paid'});
    await db.InvoiceItem.create({tenant_id:tenant.id,invoice_id:invoice.id,description:'Period fee',quantity:2,service_charge:total/10,total});
    await db.Expense.create({tenant_id:tenant.id,description:'Period expense',amount:total/20,status:'Unpaid',created_at});
    fixtures.push({created_at,total});
  }
  const cancelled=await db.Invoice.create({tenant_id:tenant.id,customer_id:recipient.id,invoice_number:'PERIOD-CANCELLED',created_at:ranges.today.start,total:9999,status:'Cancelled'});
  await db.InvoiceItem.create({tenant_id:tenant.id,invoice_id:cancelled.id,description:'Cancelled fee',service_charge:9999,quantity:1,total:9999});
  const template=await db.DashboardTemplate.create({tenant_id:tenant.id,name:'Period financials',widgets:['revenue','profit'],record_scope:'accessible'});
  await role.update({dashboard_template_id:template.id});
  for(const [period,range] of Object.entries(ranges)){
    const sum=fixtures.filter(row=>row.created_at>=range.start && row.created_at<range.end).reduce((value,row)=>value+row.total,0);
    const response=await request(`/api/v1/dashboard/stats?period=${period}`,reader);assert.equal(response.status,200);
    const data=(await response.json()).data;
    assert.equal(data.period,period);assert.deepEqual(data.date_range,{from:range.from,to:range.to,timezone:'Asia/Dubai'});
    assert.equal(data.monthly_receivable,sum,period+' invoice total');assert.equal(data.monthly_revenue,sum/4,period+' paid');
    assert.equal(data.monthly_service_charges,sum/5,period+' service charges');assert.equal(data.monthly_expenses,sum/20,period+' expenses');assert.equal(data.monthly_profit,sum*0.15,period+' profit');
    const layout=(await (await request(`/api/v1/dashboard/layout?period=${period}`,reader)).json()).data;
    assert.equal(layout.widgets.find(widget=>widget.id==='revenue').value,sum);
    assert.equal(layout.widgets.find(widget=>widget.id==='profit').value,data.monthly_profit);
  }
});

test('dashboard financial cards include partial payments and agree with financial summary', async () => {
  const created_at = new Date();
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = new Date(Date.UTC(now.getFullYear(),now.getMonth()+1,0)).toISOString().slice(0,10);
  const beforeStats=(await (await request('/api/v1/dashboard/stats',admin)).json()).data;
  await db.Invoice.create({tenant_id:1,customer_id:customer.id,invoice_number:'CARD-PARTIAL-PAYMENT',created_at,status:'Partially Paid',payment_status:'Partial',total:100,paid_amount:35});
  await db.Expense.create({tenant_id:1,description:'Card partial expense',amount:80,paid_amount:10,status:'Partially Paid',created_at});
  const stats=(await (await request('/api/v1/dashboard/stats',admin)).json()).data;
  assert.equal(stats.monthly_revenue-beforeStats.monthly_revenue,35);
  assert.equal(stats.monthly_cost-beforeStats.monthly_cost,10);
  const summary=(await (await request(`/api/v1/reports/financial-summary?from=${from}&to=${to}`,admin)).json()).data;
  assert.equal(stats.monthly_revenue,summary.total_revenue);
  assert.equal(stats.monthly_cost,summary.total_cost);
  assert.equal(stats.monthly_profit,stats.monthly_service_charges-stats.monthly_expenses);
});

test('net profit uses created service charges times quantity less full expenses', async () => {
  const now=new Date();const from=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to=new Date(Date.UTC(now.getFullYear(),now.getMonth()+1,0)).toISOString().slice(0,10);
  const before=(await (await request('/api/v1/dashboard/stats',admin)).json()).data;
  const invoice=await db.Invoice.create({tenant_id:1,customer_id:customer.id,invoice_number:'PROFIT-SERVICE-CHARGES',status:'Issued',total:1200,paid_amount:0});
  await db.InvoiceItem.create({tenant_id:1,invoice_id:invoice.id,description:'Created service fee',quantity:3,service_charge:40,cost_price:300,total:1020});
  const cancelled=await db.Invoice.create({tenant_id:1,customer_id:customer.id,invoice_number:'PROFIT-CANCELLED',status:'Cancelled',total:999});
  await db.InvoiceItem.create({tenant_id:1,invoice_id:cancelled.id,description:'Cancelled fee',service_charge:999,quantity:1});
  await db.Expense.create({tenant_id:1,description:'Unpaid expense',amount:25,paid_amount:0,status:'Unpaid'});
  const stats=(await (await request('/api/v1/dashboard/stats',admin)).json()).data;
  assert.equal(stats.monthly_service_charges-before.monthly_service_charges,120);
  assert.equal(stats.monthly_expenses-before.monthly_expenses,25);
  assert.equal(stats.monthly_profit-before.monthly_profit,95);
  const report=(await (await request(`/api/v1/reports/profit-details?from=${from}&to=${to}&limit=1`,admin)).json()).data;
  assert.equal(report.totals.service_charges,stats.monthly_service_charges);
  assert.equal(report.totals.expenses,stats.monthly_expenses);
  assert.equal(report.totals.net_profit,stats.monthly_profit);
  const other=(await (await request('/api/v1/dashboard/stats',outsider)).json()).data;
  assert.notEqual(other.monthly_service_charges,stats.monthly_service_charges);
});

test('purchase list returns supplier purchases for the current tenant only', async () => {
 const a=await db.Supplier.create({tenant_id:1,name:'Purchase list supplier A'});
 const b=await db.Supplier.create({tenant_id:2,name:'Purchase list supplier B'});
 const own=await db.SupplierPurchase.create({tenant_id:1,supplier_id:a.id,reference_type:'Manual',description:'Visible purchase',amount:100,paid_amount:20,status:'Partially Paid'});
 const other=await db.SupplierPurchase.create({tenant_id:2,supplier_id:b.id,reference_type:'Manual',description:'Other tenant purchase',amount:999});
 const endpoint='/api/v1/suppliers/purchases';
 assert.equal((await request(endpoint)).status,401);
 assert.equal((await request(endpoint,denied)).status,403);
 const response=await request(endpoint+'?tenant_id=2',admin);assert.equal(response.status,200);
 const data=(await response.json()).data;
 assert.ok(data.some(p=>p.id===own.id&&p.Supplier.name===a.name));
 assert.ok(!data.some(p=>p.id===other.id));
 assert.ok(data.every(p=>p.tenant_id===1));
 const theirs=(await (await request(endpoint,outsider)).json()).data;
 assert.ok(theirs.some(p=>p.id===other.id));assert.ok(!theirs.some(p=>p.id===own.id));
});

test('supplier list totals all purchases and actual payments without double counting', async () => {
 const supplier=await db.Supplier.create({tenant_id:1,name:'Supplier totals'});
 const empty=await db.Supplier.create({tenant_id:1,name:'Supplier with no transactions'});
 const credit=await db.Supplier.create({tenant_id:1,name:'Supplier advance'});
 const other=await db.Supplier.create({tenant_id:2,name:'Other tenant totals'});
 const p1=await db.SupplierPurchase.create({tenant_id:1,supplier_id:supplier.id,reference_type:'Manual',amount:100,paid_amount:40});
 const p2=await db.SupplierPurchase.create({tenant_id:1,supplier_id:supplier.id,reference_type:'Manual',amount:200,paid_amount:40});
 for(const purchase_id of [p1.id,p2.id])await db.SupplierPayment.create({tenant_id:1,supplier_id:supplier.id,purchase_id,wallet_id:wallet.id,amount:40});
 await db.SupplierPayment.create({tenant_id:1,supplier_id:supplier.id,wallet_id:wallet.id,amount:10});
 await db.SupplierPayment.create({tenant_id:1,supplier_id:credit.id,wallet_id:wallet.id,amount:25});
 await db.SupplierPurchase.create({tenant_id:2,supplier_id:other.id,reference_type:'Manual',amount:9999});
 const response=await request('/api/v1/suppliers?tenant_id=2',admin);assert.equal(response.status,200);
 const data=(await response.json()).data;
 const row=data.find(s=>s.id===supplier.id);
 assert.equal(row.total_amount,300);assert.equal(row.paid,90);assert.equal(row.balance,210);
 const none=data.find(s=>s.id===empty.id);assert.equal(none.total_amount,0);assert.equal(none.paid,0);assert.equal(none.balance,0);
 assert.equal(data.find(s=>s.id===credit.id).balance,-25);
 assert.ok(!data.some(s=>s.id===other.id));
 assert.equal((await request('/api/v1/suppliers',denied)).status,403);
});

test('supplier statement downloads include every transaction and enforce tenant permissions', async () => {
 const supplier=await db.Supplier.create({tenant_id:1,name:'Export supplier'});
 const other=await db.Supplier.create({tenant_id:2,name:'Private supplier'});
 await db.SupplierPurchase.bulkCreate(Array.from({length:35},(_,i)=>({tenant_id:1,supplier_id:supplier.id,reference_type:'Manual',amount:10.25,description:i===0?'=SUM(A1:A2)':'Statement purchase '+i})));
 await db.SupplierPayment.create({tenant_id:1,supplier_id:supplier.id,wallet_id:wallet.id,amount:25.50});
 const endpoint=`/api/v1/suppliers/${supplier.id}/statement`;
 for(const format of ['xlsx','pdf']) {
  assert.equal((await request(`${endpoint}/${format}`)).status,401);
  assert.equal((await request(`${endpoint}/${format}`,denied)).status,403);
  assert.equal((await request(`${endpoint}/${format}`,outsider)).status,404);
  assert.equal((await request(`/api/v1/suppliers/${other.id}/statement/${format}`,admin)).status,404);
 }
 assert.equal((await request(`${endpoint}/invalid`,admin)).status,400);
 const response=await request(`${endpoint}/xlsx?tenant_id=2`,admin);
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/spreadsheetml/);
 assert.match(response.headers.get('content-disposition'),/attachment/);
 const ExcelJS=require('exceljs');const workbook=new ExcelJS.Workbook();
 await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
 const sheet=workbook.worksheets[0];
 assert.equal(sheet.rowCount,43); // Six header rows, 36 transactions, total.
 assert.equal(sheet.getCell('A2').value,'Export supplier');
 assert.equal(sheet.getCell('D43').value,25.50);
 assert.equal(sheet.getCell('E43').value,358.75);
 assert.equal(sheet.getCell('F43').value,333.25);
 assert.equal(typeof sheet.getCell('F7').value,'number');
 assert.equal(sheet.getCell('C7').type,ExcelJS.ValueType.String);
 assert.match(sheet.getCell('C7').value,/^=SUM/);
 const pdf=await request(`${endpoint}/pdf`,admin);assert.equal(pdf.status,200);
 assert.match(pdf.headers.get('content-type'),/application\/pdf/);
 const text=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.ok(text.startsWith('%PDF-'));
 assert.equal((text.match(/\/Type \/Page\b/g)||[]).length,4);
 assert.equal(await db.SupplierPayment.count({where:{supplier_id:supplier.id,tenant_id:1}}),1);
 // A selected period must carry the balance forward, including when there is no activity.
 await db.SupplierPurchase.create({tenant_id:1,supplier_id:supplier.id,reference_type:'Manual',amount:100,created_at:'2030-01-01T12:00:00Z'});
 await db.SupplierPayment.create({tenant_id:1,supplier_id:supplier.id,wallet_id:wallet.id,amount:20,payment_date:'2030-01-02T12:00:00Z'});
 await db.SupplierPurchase.create({tenant_id:1,supplier_id:supplier.id,reference_type:'Manual',amount:900,created_at:'2030-01-03T12:00:00Z'});
 const filtered=await request(`${endpoint}/xlsx?from=2030-01-02&to=2030-01-02`,admin);
 assert.equal(filtered.status,200);
 const periodBook=new ExcelJS.Workbook(); await periodBook.xlsx.load(Buffer.from(await filtered.arrayBuffer()));
 const periodSheet=periodBook.worksheets[0];
 assert.equal(periodSheet.rowCount,9);assert.equal(periodSheet.getCell('F7').value,433.25);
 assert.match(periodSheet.getCell('C7').value,/Opening balance/);
 assert.equal(periodSheet.getCell('D8').value,20);assert.equal(periodSheet.getCell('F8').value,413.25);
 assert.equal(periodSheet.getCell('F9').value,413.25);
 assert.match(periodSheet.getCell('A3').value,/2030-01-02 to 2030-01-02/);
 const empty=await request(`${endpoint}/xlsx?from=2030-01-04&to=2030-01-05`,admin);
 const emptyBook=new ExcelJS.Workbook();await emptyBook.xlsx.load(Buffer.from(await empty.arrayBuffer()));
 assert.equal(emptyBook.worksheets[0].getCell('F8').value,1313.25);
 const periodPdf=await request(`${endpoint}/pdf?from=2030-01-02&to=2030-01-02`,admin);
 assert.equal(periodPdf.status,200);
 assert.equal((Buffer.from(await periodPdf.arrayBuffer()).toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1);
 for(const query of ['from=2030-02-30','from=bad','from=2030-01-03&to=2030-01-02','from=2030-01-02&from=2030-01-03']) {
  assert.equal((await request(`${endpoint}/xlsx?${query}`,admin)).status,400);
 }
});


test('dashboard supplier count matches the tenant supplier list', async () => {
 await db.Supplier.create({tenant_id:1,name:'Dashboard supplier A'});
 await db.Supplier.create({tenant_id:2,name:'Dashboard supplier B'});
 for(const user of [admin,outsider]) {
  const stats=(await (await request('/api/v1/dashboard/stats?tenant_id=999',user)).json()).data;
  const list=(await (await request('/api/v1/suppliers',user)).json()).data;
  assert.equal(stats.total_suppliers,list.length);
 }
});

test('staff assignment validates tenant users, preserves notes, tracks changes and auto-claims on start', async () => {
 const role=await db.Role.create({name:'Service Operator',tenant_id:1,permissions:{services:{read:true,write:true},employee_tracking:{read:true}}});
 const operator=await db.User.create({name:'Service Operator',tenant_id:1,role_id:role.id});
 const inactive=await db.User.create({name:'Inactive operator',tenant_id:1,is_active:false});
 const type=await db.ServiceType.create({name:'Staff assignment test',tenant_id:1,cost_price:0});
 const payload={customer_id:customer.id,service_type_id:type.id,notes:'Keep these notes',assigned_user_id:staff.id};
 const root='/api/v1/services';
 assert.equal((await request(root+'/assignees',denied)).status,403);
 assert.equal((await request(root+'/assignees',portal)).status,403);
 const choicesResponse=await request(root+'/assignees',operator);assert.equal(choicesResponse.status,200);
 const choices=(await choicesResponse.json()).data;
 assert.ok(choices.some(user=>user.id===staff.id));
 assert.ok(!choices.some(user=>[inactive.id,outsider.id,portal.id].includes(user.id)));
 assert.ok(choices.every(user=>Object.keys(user).sort().join(',')==='id,name'));
 assert.equal((await request('/api/v1/users',operator)).status,403);
 for(const assigned_user_id of [inactive.id,outsider.id,portal.id,'no',-1,true]) assert.equal((await request(root+'/orders',operator,'POST',{...payload,assigned_user_id})).status,400);
 const created=await request(root+'/orders',operator,'POST',payload);assert.equal(created.status,201);
 const order=(await created.json()).data;assert.equal(order.assigned_user_id,staff.id);assert.equal(order.AssignedStaff.name,staff.name);assert.equal(order.notes,'Keep these notes');
 const edit=await request(`${root}/orders/${order.id}`,operator,'PUT',{...payload,assigned_user_id:operator.id});assert.equal(edit.status,200);
 assert.equal((await edit.json()).data.AssignedStaff.id,operator.id);
 assert.equal((await request(`${root}/orders/${order.id}/assignment`,outsider,'PUT',{assigned_user_id:outsider.id})).status,404);
 const start=await request(`${root}/orders/${order.id}/status`,admin,'PUT',{status:'In Progress'});assert.equal(start.status,200);
 assert.equal((await start.json()).data.assigned_user_id,operator.id); // Existing assignee is retained.
 assert.equal((await request(`${root}/orders/${order.id}/assignment`,operator,'PUT',{assigned_user_id:null})).status,200);
 assert.equal((await request(`${root}/orders/${order.id}/assignment`,operator,'PUT',{assigned_user_id:staff.id})).status,200);
 assert.equal((await request(`${root}/orders/${order.id}/assignment`,operator,'PUT',{assigned_user_id:staff.id})).status,200); // No duplicate log.
 const history=(await (await request(`${root}/orders/${order.id}/assignment-history`,operator)).json()).data;
 assert.equal(history.length,4);assert.equal(history[0].to_name,staff.name);assert.equal(history[0].actor_name,operator.name);
 assert.equal((await request(`${root}/orders/${order.id}/assignment-history`,outsider)).status,404);
 const unassigned=(await (await request(root+'/orders',operator,'POST',{...payload,assigned_user_id:null})).json()).data;
 const starts=await Promise.all([request(`${root}/orders/${unassigned.id}/status`,operator,'PUT',{status:'In Progress'}),request(`${root}/orders/${unassigned.id}/status`,admin,'PUT',{status:'In Progress'})]);
 assert.ok(starts.every(response=>response.status===200));
 const claimed=await db.ServiceOrder.findOne({where:{id:unassigned.id,tenant_id:1}});
 assert.ok([operator.id,admin.id].includes(claimed.assigned_user_id));assert.ok(claimed.started_at);assert.ok(claimed.assigned_at);
 assert.equal(await db.ServiceAssignment.count({where:{service_order_id:claimed.id,tenant_id:1}}),1);
 const complete=await request(`${root}/orders/${order.id}/status`,operator,'PUT',{status:'Completed'});assert.equal(complete.status,200);
 assert.equal((await complete.json()).data.assigned_user_id,staff.id);
 assert.equal((await request(`${root}/orders/${order.id}/assignment`,operator,'PUT',{assigned_user_id:admin.id})).status,400);
 const list=(await (await request(`${root}/orders?assigned_user_id=${staff.id}`,operator)).json()).data;
 assert.ok(list.some(row=>row.id===order.id));assert.ok(list.every(row=>row.assigned_user_id===staff.id));
 const summary=(await (await request(root+'/employee-tracking',operator)).json()).data;
 assert.ok(summary.find(row=>row.id===staff.id).completed>=1);
 assert.ok(summary.find(row=>row.id===staff.id).completed_in_period>=1);
 const completedRecord=await db.ServiceOrder.findOne({where:{id:order.id,tenant_id:1}});
 assert.equal(completedRecord.completed_by_user_id,staff.id);
 const dated=(await (await request(`${root}/employee-tracking?from=2000-01-01&to=2000-01-02`,operator)).json()).data;
 assert.ok(dated.every(row=>row.total===0 && row.completed_in_period===0));
 const typed=await (await request(`${root}/employee-tracking?service_type_id=${type.id}`,operator)).json();
 assert.ok(typed.meta.service_types.some(item=>item.id===type.id));
 assert.ok(!typed.meta.service_types.some(item=>item.name==='Other tenant service'));
 const matching=await (await request(`${root}/orders?tracking=true&status_group=completed&service_type_id=${type.id}`,operator)).json();
 assert.ok(matching.data.some(item=>item.id===order.id));
 assert.ok(matching.data.every(item=>item.service_type_id===type.id && item.status.startsWith('Completed')));
 assert.equal((await request(`${root}/employee-tracking?from=2026-02-30`,operator)).status,400);
 assert.equal((await request(`${root}/orders?tracking=true&from=2026-10-02&to=2026-10-01`,operator)).status,400);
 assert.equal((await request(root+'/employee-tracking',denied)).status,403);
 assert.equal((await request(root+'/employee-tracking',portal)).status,403);
 const otherSummary=(await (await request(root+'/employee-tracking',outsider)).json()).data;
 assert.ok(!otherSummary.some(row=>row.id===staff.id||row.id===operator.id));
});

test('employee tracking has independent Own and All report permissions', async () => {
 const {normalizePermissions}=require('../utils/permissionRules');
 const rules=scope=>normalizePermissions({employee_tracking:{rules:{list:scope}},services:{rules:{list:'none',detail:'none',edit:'none',delete:'none',create:false}}});
 assert.throws(()=>normalizePermissions({employee_tracking:{rules:{list:'created'}}}),/Own or All/);
 const role=await db.Role.create({tenant_id:1,name:'Tracking own',permissions:rules('own')});
 const worker=await db.User.create({tenant_id:1,name:'Tracking worker',role_id:role.id});
 const type=await db.ServiceType.create({tenant_id:1,name:'Report permission service',cost_price:99});
 const create=values=>db.ServiceOrder.create({tenant_id:1,customer_id:customer.id,service_type_id:type.id,status:'Pending',cost:99,notes:'Private service notes',...values});
 const own=await create({assigned_user_id:worker.id});
 const other=await create({assigned_user_id:staff.id,created_by:worker.id});
 const completed=await create({assigned_user_id:staff.id,completed_by_user_id:worker.id,status:'Completed',started_at:'2026-01-01T08:00:00Z',completed_at:'2026-01-01T09:00:00Z'});
 const unassigned=await create({});
 const foreign=await create({tenant_id:2,customer_id:otherCustomer.id,assigned_user_id:worker.id});
 await db.ServiceAssignment.create({tenant_id:1,service_order_id:own.id,to_user_id:worker.id,to_name:worker.name,actor_id:admin.id,actor_name:admin.name,reason:'Manual'});
 const root='/api/v1/services/employee-tracking';
 let summary=await (await request(root,worker)).json();
 assert.deepEqual(summary.data.map(row=>row.id),[worker.id]);
 assert.equal(summary.data[0].total,1);assert.equal(summary.data[0].completed_in_period,1);assert.equal(summary.meta.scope,'own');
 let response=await request(root+'/orders',worker);assert.equal(response.status,200);
 let rows=(await response.json()).data;
 assert.deepEqual(rows.map(row=>row.id).sort((a,b)=>a-b),[own.id,completed.id].sort((a,b)=>a-b));
 assert.ok(rows.every(row=>row.cost===undefined && row.notes===undefined && row.ServiceType.cost_price===undefined && row.can_edit_service===false && row.can_view_service===false));
 const manipulated=(await (await request(root+`/orders?assigned_user_id=${staff.id}&tenant_id=2`,worker)).json()).data;
 assert.ok(!manipulated.some(row=>row.id===other.id || row.id===foreign.id));
 assert.equal((await request(root+`/orders/${own.id}/history`,worker)).status,200);
 assert.equal((await request(root+`/orders/${other.id}/history`,worker)).status,404);
 assert.equal((await request(root+`/orders/${foreign.id}/history`,worker)).status,404);
 assert.equal((await request('/api/v1/services/orders',worker)).status,403);
 assert.equal((await request(`/api/v1/services/orders/${own.id}/assignment`,worker,'PUT',{assigned_user_id:staff.id})).status,403);
 const saved=await request(`/api/v1/roles/${role.id}`,admin,'PUT',{permissions:rules('all')});assert.equal(saved.status,200,await saved.clone().text());
 summary=await (await request(root,worker)).json();assert.equal(summary.meta.scope,'all');assert.ok(summary.data.some(row=>row.id===staff.id));
 rows=(await (await request(root+'/orders',worker)).json()).data;
 assert.ok(rows.some(row=>row.id===other.id));assert.ok(rows.some(row=>row.id===unassigned.id));assert.ok(!rows.some(row=>row.id===foreign.id));
 const serviceOnlyRole=await db.Role.create({tenant_id:1,name:'Services without tracking',permissions:{services:{read:true,write:true}}});
 const serviceOnly=await db.User.create({tenant_id:1,name:'Services only',role_id:serviceOnlyRole.id});
 for(const suffix of ['', '/orders',`/orders/${own.id}/history`])assert.equal((await request(root+suffix,serviceOnly)).status,403);
 await role.update({permissions:rules('none')});assert.equal((await request(root,worker)).status,403);
});

test('sales order push accepts optional staff selection and safely rejects duplicate pushes', async () => {
 const type=await db.ServiceType.create({name:'Pushed assignment test',tenant_id:1});
 const order=await db.SalesOrder.create({tenant_id:1,customer_id:customer.id,order_number:'ASSIGNMENT-SO-001',order_date:'2026-10-17'});
 const item=async()=>db.SalesOrderItem.create({tenant_id:1,sales_order_id:order.id,service_type_id:type.id,service_name:type.name});
 const root='/api/v1/sales-orders/items';const first=await item();
 assert.equal((await request(`${root}/${first.id}/push`,admin,'POST',{assigned_user_id:outsider.id})).status,400);
 assert.equal((await request(`${root}/${first.id}/push`,outsider,'POST',{assigned_user_id:outsider.id})).status,404);
 assert.equal((await request(`${root}/${first.id}/push`,admin,'POST',{})).status,409);
 assert.equal((await request(`${root}/${first.id}/confirm`,admin,'POST',{action:'confirm'})).status,200);
 const pushed=await request(`${root}/${first.id}/push`,admin,'POST',{assigned_user_id:staff.id});assert.equal(pushed.status,200);
 const serviceId=(await pushed.json()).service_order_id;
 const service=await db.ServiceOrder.findOne({where:{id:serviceId,tenant_id:1}});assert.equal(service.assigned_user_id,staff.id);
 assert.equal((await db.ServiceAssignment.findOne({where:{tenant_id:1,service_order_id:serviceId}})).reason,'SalesOrder');
 assert.equal((await request(`${root}/${first.id}/push`,admin,'POST',{})).status,400);
 const second=await item();assert.equal((await request(`${root}/${second.id}/confirm`,admin,'POST',{action:'confirm'})).status,200);const responses=await Promise.all([request(`${root}/${second.id}/push`,admin,'POST',{}),request(`${root}/${second.id}/push`,admin,'POST',{})]);
 assert.deepEqual(responses.map(response=>response.status).sort(),[200,400]);
 await second.reload();const unassigned=await db.ServiceOrder.findOne({where:{id:second.service_order_id,tenant_id:1}});assert.equal(unassigned.assigned_user_id,null);
 assert.equal((await request(`/api/v1/services/orders/${unassigned.id}/status`,admin,'PUT',{status:'In Progress'})).status,200);
 await unassigned.reload();assert.equal(unassigned.assigned_user_id,admin.id);
});

test('service completion enforces cost policy, account selection and one posting', async () => {
 const tenant=await db.Tenant.create({name:'Service cost policy',slug:'service-cost-policy',status:'active'});
 const role=await db.Role.create({tenant_id:tenant.id,name:'Admin'});
 const user=await db.User.create({tenant_id:tenant.id,name:'Cost admin',email:'cost-admin@example.test',role_id:role.id});
 const recipient=await db.Customer.create({tenant_id:tenant.id,name:'Cost customer',phone_whatsapp:'0000'});
 const type=await db.ServiceType.create({tenant_id:tenant.id,name:'Cost service',cost_price:40});
 const freeType=await db.ServiceType.create({tenant_id:tenant.id,name:'Zero master',cost_price:0});
 const account=await db.WalletAccount.create({tenant_id:tenant.id,name:'Cost wallet',balance:1000});
 const foreign=await db.WalletAccount.create({tenant_id:2,name:'Foreign cost wallet',balance:1000});
 const inactive=await db.WalletAccount.create({tenant_id:tenant.id,name:'Inactive cost wallet',balance:1000,is_active:false});
 const supplier=await db.Supplier.create({tenant_id:tenant.id,name:'Cost supplier'});
 const policy=await db.SystemConfig.create({tenant_id:tenant.id,key:'wallet_deduction_point',value:'service_completion'});
 const order=async(service_type_id=type.id)=>db.ServiceOrder.create({tenant_id:tenant.id,customer_id:recipient.id,service_type_id,status:'In Progress'});
 const endpoint=id=>`/api/v1/services/orders/${id}/status`;
 const complete=async(id,payload={})=>request(endpoint(id),user,'PUT',{status:'Completed',...payload});
 const first=await order();
 let preview=(await (await request(`/api/v1/services/orders/${first.id}/completion`,user)).json()).data;
 assert.equal(preview.policy,'service_completion');assert.equal(preview.amount,40);assert.equal(preview.source,'Service master');
 assert.equal((await request(`/api/v1/services/orders/${first.id}/completion`,outsider)).status,404);
 assert.equal((await complete(first.id)).status,400);
 assert.equal((await request(endpoint(first.id),user,'PUT',{status:'CompletedInvoiceCreated'})).status,409,'A completed-stage payload cannot bypass cost validation');
 assert.equal((await complete(first.id,{wallet_id:foreign.id})).status,400);
 assert.equal((await complete(first.id,{wallet_id:inactive.id})).status,400);
 assert.equal((await complete(first.id,{cost_type:'Supplier',wallet_id:account.id,cost_supplier_id:supplier.id})).status,400);
 await first.reload();await account.reload();assert.equal(first.status,'In Progress');assert.equal(Number(account.balance),1000);
 const competing=await Promise.all([complete(first.id,{wallet_id:account.id}),complete(first.id,{wallet_id:account.id})]);
 assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
 await account.reload();assert.equal(Number(account.balance),960);assert.equal(await db.WalletTransaction.count({where:{tenant_id:tenant.id,reference_type:'ServiceCost',reference_id:first.id}}),1);
 assert.equal((await complete(first.id,{wallet_id:account.id})).status,409);
 const zero=await order(freeType.id);
 assert.equal((await complete(zero.id)).status,400);
 assert.equal((await complete(zero.id,{confirm_zero_cost:true})).status,200);
 assert.equal(await db.WalletTransaction.count({where:{tenant_id:tenant.id,reference_id:zero.id,reference_type:'ServiceCost'}}),0);
 const pushed=await order(freeType.id);
 const sale=await db.SalesOrder.create({tenant_id:tenant.id,customer_id:recipient.id,order_number:'COST-POLICY-SO',order_date:'2026-10-21'});
 await db.SalesOrderItem.create({tenant_id:tenant.id,sales_order_id:sale.id,service_order_id:pushed.id,service_name:'Pushed service cost',cost:60,quantity:3,status:'In Progress'});
 preview=(await (await request(`/api/v1/services/orders/${pushed.id}/completion`,user)).json()).data;
 assert.equal(preview.amount,180);assert.equal(preview.source,'Sales order');
 assert.equal((await complete(pushed.id)).status,400);
 assert.equal((await complete(pushed.id,{cost_type:'Supplier',cost_supplier_id:supplier.id})).status,200);
 assert.equal(Number((await db.SupplierPurchase.findOne({where:{tenant_id:tenant.id,reference_type:'ServiceOrder',reference_id:pushed.id}})).amount),180);
 const explicitZero=await order();
 await db.SalesOrderItem.create({tenant_id:tenant.id,sales_order_id:sale.id,service_order_id:explicitZero.id,service_name:'Explicit zero',cost:0,quantity:2,status:'In Progress'});
 assert.equal((await (await request(`/api/v1/services/orders/${explicitZero.id}/completion`,user)).json()).data.amount,0,'An explicit zero sales-order cost must not fall back to a positive master cost');
 const invoiced=await order();
 const invoicePayload={customer_id:recipient.id,service_order_ids:[invoiced.id],status:'Draft',items:[{service_order_id:invoiced.id,description:'Deferred service cost',quantity:2,cost_price:25,service_charge:10,cost_type:'Wallet',wallet_id:account.id}]};
 let response=await request('/api/v1/invoices',user,'POST',invoicePayload);assert.equal(response.status,201,await response.clone().text());
 const invoice=(await response.json()).data;
 assert.equal((await request(`/api/v1/invoices/${invoice.id}`,user,'PUT',invoicePayload)).status,200);
 assert.equal((await request(`/api/v1/invoices/${invoice.id}/status`,user,'PUT',{status:'Issued'})).status,200);
 await account.reload();await invoiced.reload();assert.equal(Number(account.balance),960);assert.equal(invoiced.is_cost_deducted,false,'Invoice create/edit/issue defer a linked cost under Service Completion policy');
 preview=(await (await request(`/api/v1/services/orders/${invoiced.id}/completion`,user)).json()).data;
 assert.equal(preview.amount,50);assert.equal(preview.source,'Invoice');
 assert.equal((await complete(invoiced.id,{wallet_id:account.id})).status,200);await account.reload();assert.equal(Number(account.balance),910);
 await policy.update({value:'invoice_creation'});
 const deferred=await order();assert.equal((await complete(deferred.id,{wallet_id:account.id})).status,409);
 assert.equal((await complete(deferred.id)).status,200);await deferred.reload();assert.equal(deferred.is_cost_deducted,false);
 const already=await order();await already.update({is_cost_deducted:true});await policy.update({value:'service_completion'});
 assert.equal((await complete(already.id)).status,200);await account.reload();assert.equal(Number(account.balance),910);
});

test('service footer colours save per workspace, reject unsafe values and preserve escalation settings', async () => {
 const root='/api/v1/services/config/criticality';
 const defaults=require('../utils/serviceAppearance').defaults;
 let response=await request(root,admin);assert.equal(response.status,200);
 assert.deepEqual((await response.json()).data.service_footer_colors,defaults);
 const palette={...defaults,Pending:'#ffc880','In Progress':'#ABCDEF'};
 assert.equal((await request(root,denied,'PUT',{service_footer_colors:palette})).status,403);
 assert.equal((await request(root,admin,'PUT',{svc_escalation_normal_to_moderate_days:3,service_footer_colors:palette,tenant_id:2})).status,200);
 let config=(await (await request(root,admin)).json()).data;
 assert.equal(config.svc_escalation_normal_to_moderate_days,3);assert.equal(config.service_footer_colors.Pending,'#FFC880');
 assert.equal((await (await request(root,outsider)).json()).data.service_footer_colors.Pending,defaults.Pending);
 const visible=(await (await request('/api/v1/config',admin)).json()).data;
 assert.equal(visible.service_footer_colors.Pending,'#FFC880');
 assert.equal((await request(root,admin,'PUT',{svc_escalation_normal_to_moderate_days:9,service_footer_colors:{...palette,Pending:'url(https://invalid.test)'}})).status,400);
 assert.equal((await request(root,admin,'PUT',{service_footer_colors:{...palette,Unknown:'#FFFFFF'}})).status,400);
 config=(await (await request(root,admin)).json()).data;
 assert.equal(config.svc_escalation_normal_to_moderate_days,3);assert.equal(config.service_footer_colors.Pending,'#FFC880','An invalid palette must not partially save settings');
 assert.equal((await request(root,admin,'PUT',{service_footer_colors:defaults})).status,200);
 config=(await (await request(root,admin)).json()).data;
 assert.deepEqual(config.service_footer_colors,defaults);assert.equal(config.svc_escalation_normal_to_moderate_days,3,'Colour reset retains workflow settings');
});

test('service assignment schema upgrade is additive and safe to repeat', async () => {
 const ensure=require('../utils/serviceAssignmentSchema');
 const before=await db.ServiceOrder.count({where:{tenant_id:1}});
 await ensure(db.sequelize);await ensure(db.sequelize);
 assert.equal(await db.ServiceOrder.count({where:{tenant_id:1}}),before);
 const columns=await db.sequelize.getQueryInterface().describeTable('service_orders');
 assert.ok(columns.assigned_user_id);assert.ok(columns.assigned_at);
});

test('every business root enforces all ownership scopes in lists and counts', async () => {
  const { roots, ensureSchema } = require('../utils/businessOwnership');
  const { context } = require('../utils/recordAccess');
  const { normalizePermissions } = require('../utils/permissionRules');
  const role = await db.Role.create({ name:'Matrix role', tenant_id:1 });
  const worker = await db.User.create({ name:'Matrix employee', tenant_id:1, role_id:role.id });
  const shareholder = await db.Shareholder.create({ name:'Matrix shareholder', tenant_id:1 });
  const type = await db.ServiceType.create({ name:'Matrix service', tenant_id:1 });
  const payroll = await db.SalaryPayroll.create({ month:'2029-01', booking_date:'2029-01-31', tenant_id:1 });
  const defaults = {
    User:{name:'Matrix staff'}, Customer:{name:'Matrix customer',phone_whatsapp:'111'}, Lead:{company_name:'Matrix lead',phone:'123'},
    Supplier:{name:'Matrix supplier'}, Quotation:{recipient_name:'Matrix prospect',quotation_date:'2029-01-01'}, Document:{customer_id:customer.id,expiry_date:'2030-01-01'},
    ServiceOrder:{customer_id:customer.id,service_type_id:type.id}, SalesOrder:{customer_id:customer.id,order_date:'2029-01-01'},
    Invoice:{customer_id:customer.id,total:7}, Expense:{description:'Matrix expense',amount:7}, WalletAccount:{name:'Matrix wallet'},
    Shareholder:{name:'Matrix shareholder'}, CapitalTransaction:{shareholder_id:shareholder.id,type:'Contribution',amount:7,date:'2029-01-01'},
    DividendDeclaration:{financial_year:'2029',total_profit:7,dividend_amount:7,declaration_date:'2029-01-01'},
    OwnershipChange:{shareholder_id:shareholder.id,previous_percentage:0,new_percentage:1},
    SalaryPayroll:{booking_date:'2029-01-01'}, SalaryItem:{payroll_id:payroll.id,user_id:staff.id,net_salary:7},
    StaffDocument:{user_id:staff.id,expiry_date:'2030-01-01'}, SavedCv:{name:'Matrix CV',data:{},user_id:staff.id}
  };
  const fixtures = {};
  for (const name of Object.keys(roots)) {
    fixtures[name] = [];
    for (let i=0;i<3;i++) {
      const values = { ...defaults[name], tenant_id:1, created_by:i===0?worker.id:admin.id, assigned_user_id:i===1?worker.id:null };
      if (values.name) values.name += ` ${i}`;
      if (name==='Invoice') values.invoice_number=`MATRIX-${i}`;
      if (name==='Quotation') values.quotation_number=`MATRIX-Q-${i}`;
      if (name==='SalesOrder') values.order_number=`MATRIX-${i}`;
      if (name==='SalaryPayroll') values.month=`2029-0${i+2}`;
      fixtures[name].push(await db[name].create(values));
    }
  }
  for (const [scope, expected] of [['none',0],['created',1],['assigned',1],['own',2],['all',3]]) {
    const permissions = normalizePermissions(Object.fromEntries([...new Set(Object.values(roots))].map(module => [module,{rules:{list:scope,detail:scope,edit:scope,delete:scope,create:true}}])));
    const user = { id:worker.id,tenant_id:1,Role:{name:'Matrix role',permissions} };
    await context.run({user,module:'reports',action:'list'}, async () => {
      for (const name of Object.keys(roots)) {
        const where = { id:fixtures[name].map(row=>row.id) };
        assert.equal((await db[name].findAll({where})).length,expected,`${name} ${scope} list`);
        assert.equal(await db[name].count({where}),expected,`${name} ${scope} count`);
      }
    });
  }
  // Child histories without tenant_id must still inherit the parent's scope.
  for (const row of fixtures.Lead) await db.LeadStatusHistory.create({lead_id:row.id,new_status:'New'});
  const permissions = normalizePermissions({ leads:{rules:{list:'assigned',detail:'assigned',edit:'assigned',delete:'assigned',create:false}} });
  const user = {id:worker.id,tenant_id:1,Role:{name:'Matrix role',permissions}};
  await context.run({user,module:'reports',action:'list'}, async () => {
    assert.equal(await db.Invoice.count(),0,'Missing business module must deny aggregates in a scoped role');
    assert.equal((await db.Expense.findAll()).length,0,'Missing business module must deny records in a scoped role');
  });
  await context.run({user,module:'leads',action:'detail'}, async () => {
    const history = await db.LeadStatusHistory.findAll({where:{lead_id:fixtures.Lead.map(row=>row.id)}});
    assert.deepEqual(history.map(row=>row.lead_id),[fixtures.Lead[1].id]);
  });
  await context.run({user,module:'leads',action:'edit'}, async () => {
    await assert.rejects(()=>fixtures.Lead[2].update({notes:'Not allowed'}),/permission/);
    await fixtures.Lead[1].update({notes:'Permitted'});
    await assert.rejects(()=>fixtures.Lead[1].update({created_by:worker.id}),/permission/);
  });
  const invoicePermissions = normalizePermissions({invoices:{rules:{list:'all',detail:'all',edit:'own',delete:'none',create:false}}});
  const invoiceUser = {...user,Role:{name:'Matrix role',permissions:invoicePermissions}};
  const lines = [];
  for (const row of fixtures.Invoice) lines.push(await db.InvoiceItem.create({tenant_id:1,invoice_id:row.id,description:'Matrix line',quantity:1,unit_price:7,total:7}));
  await context.run({user:invoiceUser,module:'invoices',action:'edit'}, async () => {
    const [changed] = await db.Invoice.update({paid_amount:1},{where:{id:fixtures.Invoice[2].id}});
    assert.equal(changed,0,'Bulk update cannot edit someone else’s invoice');
    assert.equal(await db.InvoiceItem.destroy({where:{id:lines[1].id}}),1,'Editing an assigned invoice can replace its lines without permission to delete the invoice');
    assert.equal(await db.InvoiceItem.destroy({where:{id:lines[2].id}}),0,'Cannot delete someone else’s lines');
    await assert.rejects(()=>db.InvoiceItem.create({tenant_id:1,invoice_id:fixtures.Invoice[2].id,description:'Blocked line',quantity:1,unit_price:7,total:7}),/permission/);
    await assert.rejects(()=>fixtures.Expense[0].update({description:'Blocked linked change'}),/permission/,'Missing-module write scopes apply across workflows');
    await assert.rejects(()=>db.WalletTransaction.create({tenant_id:1,account_id:fixtures.WalletAccount[2].id,type:'Expense',direction:'Out',amount:1}),/permission/,'A workflow cannot post to an inaccessible wallet');
  });
  const beforeCount = await db.Invoice.count();
  await ensureSchema(db.sequelize); await ensureSchema(db.sequelize);
  assert.equal(await db.Invoice.count(),beforeCount,'Schema upgrade preserves records');
});

test('services sharing an invoice expose its live payment balance, including partial, full and reversed payments', async () => {
 const tenant=await db.Tenant.create({name:'Shared service payment',slug:'shared-service-payment',status:'active'});
 const role=await db.Role.create({tenant_id:tenant.id,name:'Admin',type:'Internal'});
 const actor=await db.User.create({tenant_id:tenant.id,name:'Invoice badge admin',role_id:role.id});
 const recipient=await db.Customer.create({tenant_id:tenant.id,name:'Shared invoice customer',phone_whatsapp:'0504444444'});
 const account=await db.WalletAccount.create({tenant_id:tenant.id,name:'Shared invoice receipts',balance:0});
 const type=await db.ServiceType.create({tenant_id:tenant.id,name:'Shared invoice service',cost_price:0,service_charge:50});
 const services=await db.ServiceOrder.bulkCreate([1,2].map(()=>({tenant_id:tenant.id,customer_id:recipient.id,service_type_id:type.id,status:'CompletedInvoicePending'})));
 const response=await request('/api/v1/invoices',actor,'POST',{customer_id:recipient.id,service_order_ids:services.map(row=>row.id),items:services.map(row=>({service_order_id:row.id,description:'Shared service '+row.id,quantity:1,cost_price:0,service_charge:50,selling_price:50}))});
 assert.equal(response.status,201,await response.clone().text());const invoice=(await response.json()).data;
 assert.equal((await request(`/api/v1/invoices/${invoice.id}/status`,actor,'PUT',{status:'Issued'})).status,200);
 const {isServiceInvoicePaid}=await import('../../frontend/utils/serviceInvoice.mjs');
 const verify=async(expectedStatus,expectedPaid,expectedBadge)=>{
  const response=await request('/api/v1/services/orders',actor);assert.equal(response.status,200);const rows=(await response.json()).data;
  assert.equal(rows.length,2);
  for(const row of rows){assert.equal(String(row.Invoice.id),String(invoice.id));assert.equal(row.Invoice.status,expectedStatus);assert.equal(Number(row.Invoice.paid_amount),expectedPaid);assert.equal(Number(row.Invoice.total),100);assert.equal(isServiceInvoicePaid(row.Invoice),expectedBadge);}
 };
 await verify('Issued',0,false);
 assert.equal((await request(`/api/v1/invoices/${invoice.id}/status`,actor,'PUT',{status:'Partially Paid',account_id:account.id,amount:99.99})).status,200);
 await verify('Partially Paid',99.99,false);
 assert.equal((await request(`/api/v1/invoices/${invoice.id}/status`,actor,'PUT',{status:'Paid',account_id:account.id,amount:0.01})).status,200);
 await verify('Paid',100,true);
 assert.equal((await request(`/api/v1/invoices/${invoice.id}/status`,actor,'PUT',{status:'Draft'})).status,200);
 await verify('Draft',0,false);
 const foreign=await request('/api/v1/services/orders',outsider);assert.equal(foreign.status,200);assert.ok(!(await foreign.json()).data.some(row=>String(row.Invoice?.id)===String(invoice.id)));
 assert.equal((await request('/api/v1/services/orders',denied)).status,403);
});

test('global search groups customer history, opens exact records, paginates and enforces tenant and ownership access', async () => {
 const tenant=await db.Tenant.create({name:'Search company',slug:'search-company',status:'active'});
 const role=await db.Role.create({name:'Admin',tenant_id:tenant.id});
 const actor=await db.User.create({tenant_id:tenant.id,name:'Search admin',email:'search-admin@example.test',role_id:role.id});
 const recipient=await db.Customer.create({tenant_id:tenant.id,name:'Search Mana',email:'search-mana@example.test',phone_whatsapp:'971555123456'});
 const lead=await db.Lead.create({tenant_id:tenant.id,name:'Search Mana',company_name:'Search Mana prospect',phone:'971555123456'});
 const service=await db.ServiceType.create({tenant_id:tenant.id,name:'Search typing',cost_price:100,service_charge:20});
 const work=await db.ServiceOrder.create({tenant_id:tenant.id,customer_id:recipient.id,service_type_id:service.id,status:'Pending'});
 const invoice=await db.Invoice.create({tenant_id:tenant.id,customer_id:recipient.id,invoice_number:'INV-SEARCH-001',status:'Issued',total:120,paid_amount:20});
 await db.Invoice.create({tenant_id:tenant.id,customer_id:recipient.id,invoice_number:'INV-SEARCH-002',status:'Paid',total:50,paid_amount:50});
 const quote=await db.Quotation.create({tenant_id:tenant.id,customer_id:recipient.id,quotation_number:'QT-SEARCH-001',quotation_date:'2026-10-30',recipient_name:'Search Mana',items:[]});
 const sale=await db.SalesOrder.create({tenant_id:tenant.id,customer_id:recipient.id,order_number:'SO-SEARCH-001'});
 const doc=await db.Document.create({tenant_id:tenant.id,customer_id:recipient.id,doc_number:'DOC-SEARCH-001',expiry_date:'2027-01-01'});
 const draft=await db.SalesOrder.create({tenant_id:tenant.id,order_number:'SO-SEARCH-DRAFT',confirmation_status:'Unconfirmed',recipient_snapshot:{name:'Renewal Prospect',email:'renewal-prospect@example.test',phone:'971000234567'}});
 const documentType=await db.DocumentType.create({tenant_id:tenant.id,name:'Resident permit'});
 await doc.update({document_type_id:documentType.id});
 const root='/api/v1/search';
 async function search(q,user=actor,extra='') {
   const response=await request(`${root}?q=${encodeURIComponent(q)}${extra}`,user);
   assert.equal(response.status,200,await response.clone().text());
   assert.equal(response.headers.get('cache-control'),'no-store');
   return (await response.json()).data;
 }
 assert.equal((await request(root,undefined)).status,401);
 assert.deepEqual(await search('S'),[]);
 assert.deepEqual(await search('Search',denied),[]);
 const result=await search('Search Mana');
 const get=key=>result.find(group=>group.key===key);
 assert.equal(get('customers').items[0].to,`/customers/${recipient.id}`);
 assert.equal(get('leads').items[0].to,`/leads/${lead.id}`);
 assert.equal(get('invoices').total,2);
 assert.equal(get('quotations').items[0].to,`/quotations?quotation_id=${quote.id}`);
 assert.equal(get('sales_orders').items[0].to,`/sales-orders?order_id=${sale.id}`);
 assert.equal(get('services').items[0].to,`/services?service_id=${work.id}`);
 assert.equal(get('documents').items[0].to,`/documents?document_id=${doc.id}`);
 assert.equal(get('invoices').items[0].subtitle,'Search Mana');
 const byEmail=await search('search-mana@example.test');
 assert.equal(byEmail.find(group=>group.key==='invoices').total,2);
 assert.equal((await search('971555123456')).find(group=>group.key==='documents').total,1);
 assert.equal((await search('INV-SEARCH-001')).find(group=>group.key==='invoices').items[0].id,invoice.id);
 assert.equal((await search(`SRV-${String(work.id).padStart(5,'0')}`)).find(group=>group.key==='services').total,1);
 assert.equal((await search('Search typing')).find(group=>group.key==='services').total,1);
 assert.equal((await search('Resident permit')).find(group=>group.key==='documents').total,1);
 assert.equal((await search('Renewal Prospect')).find(group=>group.key==='sales_orders').items[0].id,draft.id);
 assert.equal((await search('renewal-prospect@example.test')).find(group=>group.key==='sales_orders').items[0].subtitle,'Renewal Prospect');
 const first=(await search('Search Mana',actor,'&group=invoices&limit=1'))[0];
 const second=(await search('Search Mana',actor,'&group=invoices&limit=1&page=2'))[0];
 assert.equal(first.total,2);assert.notEqual(first.items[0].id,second.items[0].id);
 assert.ok((await search('Search Mana',outsider)).every(group=>group.total===0));
 assert.ok((await search("%' OR 1=1 --")).every(group=>group.total===0));
 assert.ok((await search('%%')).every(group=>group.total===0),'SQL wildcard search cannot enumerate records');
 assert.equal((await request(`${root}?q=${'x'.repeat(101)}`,actor)).status,400);
 assert.equal((await request(`${root}?q=Mana&group=users`,actor)).status,400);
 const scopedRole=await db.Role.create({tenant_id:tenant.id,name:'Search scoped',permissions:require('../utils/permissionRules').normalizePermissions({
   customers:{rules:{list:'all',detail:'all',create:false,edit:'none',delete:'none'}},invoices:{rules:{list:'created',detail:'assigned',create:false,edit:'none',delete:'none'}},services:{rules:{list:'all',detail:'none',create:false,edit:'none',delete:'none'}}
 })});
 const worker=await db.User.create({tenant_id:tenant.id,name:'Search worker',email:'search-worker@example.test',role_id:scopedRole.id});
 await invoice.update({created_by:worker.id,assigned_user_id:worker.id});
 const visible=await search('Search Mana',worker);
 assert.equal(visible.find(group=>group.key==='invoices').total,1);
 assert.ok(!visible.some(group=>group.key==='services'));
 await invoice.update({assigned_user_id:actor.id});
 assert.equal((await search('Search Mana',worker)).find(group=>group.key==='invoices').total,0,'Both independent list and detail scopes apply');
 const portalRole=await db.Role.create({tenant_id:tenant.id,name:'Search portal',type:'CustomerPortal',permissions:{customers:{read:true},documents:{read:true},invoices:{read:true},services:{read:true},sales_orders:{read:true}}});
 const portalUser=await db.User.create({tenant_id:tenant.id,name:'Search portal',email:'search-portal@example.test',role_id:portalRole.id});
 assert.ok((await search('Search Mana',portalUser)).every(group=>group.total===0));
 await db.UserCustomer.create({user_id:portalUser.id,customer_id:recipient.id});
 assert.equal((await search('Search Mana',portalUser)).find(group=>group.key==='invoices').total,2);
 const serviceResponse=await request(`/api/v1/services/orders?service_id=${work.id}`,actor);
 assert.equal(serviceResponse.status,200);
 assert.deepEqual((await serviceResponse.json()).data.map(row=>String(row.id)),[String(work.id)]);
 assert.equal((await request(`/api/v1/services/orders?service_id=invalid`,actor)).status,400);
});

test('document expiry email composes scoped reminders, validates CC and uses company SMTP without exposing credentials', async () => {
 const tenant=await db.Tenant.create({name:'Email company',slug:'email-company',status:'active'});
 const role=await db.Role.create({name:'Admin',tenant_id:tenant.id});
 const actor=await db.User.create({tenant_id:tenant.id,name:'Email admin',email:'email-admin@example.test',role_id:role.id});
 const recipient=await db.Customer.create({tenant_id:tenant.id,name:'Email customer',email:'recipient@example.test',phone_whatsapp:'971500007777'});
 const doc=await db.Document.create({tenant_id:tenant.id,customer_id:recipient.id,type:'Visa',doc_number:'EMAIL-VISA-1',staff_name:'Document holder',expiry_date:'2027-01-20'});
 const endpoint=`/api/v1/email/documents/${doc.id}/reminder`;
 const nodemailer=require('nodemailer'),original=nodemailer.createTransport;
 const sent=[];let mode='success',transportOptions;
 nodemailer.createTransport=options=>{transportOptions=options;return {verify:async()=>true,sendMail:async message=>{sent.push(message);if(mode==='failure')throw new Error('Simulated SMTP failure');return {accepted:[message.to],rejected:mode==='partial'?['cc@example.test']:[]};}};};
 try {
  assert.equal((await request(endpoint,undefined)).status,401);
  assert.equal((await request(endpoint,portal)).status,403);
  assert.equal((await request(endpoint,denied)).status,403);
  assert.equal((await request(endpoint,outsider)).status,404);
  let response=await request(endpoint,actor);assert.equal(response.status,200);
  let draft=(await response.json()).data;
  assert.equal(draft.configured,false);assert.equal(draft.to,'recipient@example.test');
  assert.match(draft.body,/Email customer/);assert.match(draft.body,/20 January 2027/);assert.match(draft.body,/Document holder/);assert.match(draft.subject,/EMAIL-VISA-1/);
  const payload={to:draft.to,subject:draft.subject,body:draft.body,cc:['cc@example.test']};
  assert.equal((await request(endpoint,actor,'POST',payload)).status,409);assert.equal(sent.length,0);
  const smtp={smtp_host:'smtp.gmail.com',smtp_port:'587',smtp_user:'sender@gmail.com',smtp_pass:'test app pass word',smtp_from_email:'sender@gmail.com',smtp_from_name:'Email company',smtp_secure:'false',email_auto_invoice:'false',email_auto_document_reminder:'false'};
  assert.equal((await request('/api/v1/email/smtp',actor,'POST',smtp)).status,200);
  const config=await db.SystemConfig.findOne({where:{tenant_id:tenant.id,key:'smtp_pass'}});assert.equal(config.value,'testapppassword');
  response=await request('/api/v1/email/smtp',actor);assert.equal(response.status,200);assert.equal((await response.json()).data.smtp_pass,'••••••••');
  assert.equal((await request('/api/v1/email/smtp',denied)).status,403);
  assert.equal((await request('/api/v1/email/smtp',portal,'POST',smtp)).status,403);
  const general=await (await request('/api/v1/config',actor)).json();assert.ok(!Object.keys(general.data).some(key=>key.startsWith('smtp_')));
  assert.equal((await request('/api/v1/config',actor,'PUT',{smtp_pass:'bypass'})).status,400);
  assert.equal((await request('/api/v1/email/smtp',actor,'POST',{smtp_pass:'••••••••'})).status,200);
  assert.equal((await db.SystemConfig.findByPk(config.id)).value,'testapppassword');
  for(const invalid of [{smtp_port:'99999'},{smtp_host:'https://smtp.gmail.com'},{smtp_from_email:['bad']},{smtp_user:'sender\r\nBcc: injected'}]) assert.equal((await request('/api/v1/email/smtp',actor,'POST',invalid)).status,400);
  assert.equal((await request('/api/v1/email/smtp/test',actor,'POST',{})).status,200);assert.equal(sent.length,0,'Connection test sends no mail');
  response=await request(endpoint,actor);draft=(await response.json()).data;assert.equal(draft.from_email,'sender@gmail.com');assert.equal(draft.configured,true);assert.ok(!JSON.stringify(draft).includes('testapppassword'));
  for(const invalid of [{to:'not-email'},{subject:'Subject\r\nBcc: bad@example.test'},{cc:['bad-email']},{cc:Array.from({length:21},(_,i)=>`cc${i}@example.test`)},{body:''}]) assert.equal((await request(endpoint,actor,'POST',{...payload,...invalid})).status,400);
  assert.equal(sent.length,0);
  response=await request(endpoint,actor,'POST',{...payload,body:'Renew <script>alert(1)</script> & confirm',cc:'cc@example.test; cc@example.test',from_email:'spoof@example.test',tenant_id:2});
  assert.equal(response.status,200,await response.clone().text());assert.equal(sent.length,1);
  assert.equal(sent[0].from.address,'sender@gmail.com');assert.deepEqual(sent[0].cc,['cc@example.test']);assert.equal(sent[0].to,'recipient@example.test');assert.ok(sent[0].html.includes('&lt;script&gt;'));assert.ok(!sent[0].html.includes('<script>'));assert.equal(sent[0].text,'Renew <script>alert(1)</script> & confirm');
  assert.equal(transportOptions.requireTLS,true);assert.notEqual(transportOptions.tls?.rejectUnauthorized,false);assert.equal(transportOptions.disableFileAccess,true);
  const log=await db.EmailLog.findOne({where:{tenant_id:tenant.id,recipient:'recipient@example.test'}});assert.equal(log.status,'sent');assert.equal(log.sent_by,actor.id);
  assert.equal((await db.Document.findByPk(doc.id)).reminder_count,0,'Email does not change the WhatsApp count');
  mode='failure';response=await request(endpoint,actor,'POST',payload);assert.equal(response.status,502);assert.equal((await response.json()).success,false);
  mode='partial';response=await request(endpoint,actor,'POST',payload);assert.equal(response.status,200);assert.match((await response.json()).message,/some recipients/);
  const readRole=await db.Role.create({tenant_id:tenant.id,name:'Email read only',permissions:{documents:{read:true,write:false},settings:{read:true,write:false}}});
  const reader=await db.User.create({tenant_id:tenant.id,name:'Email reader',email:'email-reader@example.test',role_id:readRole.id});
  assert.equal((await request(endpoint,reader)).status,403);
  assert.equal((await request(endpoint,reader,'POST',payload)).status,403);
  assert.equal((await request('/api/v1/email/smtp',reader,'POST',smtp)).status,403);
  assert.equal((await request('/api/v1/email/smtp',reader)).status,200);
  const scopedRole=await db.Role.create({tenant_id:tenant.id,name:'Scoped document sender',permissions:require('../utils/permissionRules').normalizePermissions({documents:{rules:{list:'all',detail:'assigned',create:false,edit:'assigned',delete:'none'}},customers:{rules:{list:'all',detail:'all',create:false,edit:'none',delete:'none'}}})});
  const worker=await db.User.create({tenant_id:tenant.id,name:'Email worker',email:'email-worker@example.test',role_id:scopedRole.id});
  assert.ok([403,404].includes((await request(endpoint,worker)).status));
  await doc.update({assigned_user_id:worker.id});
  assert.equal((await request(endpoint,worker)).status,200);
  assert.equal((await request('/api/v1/email/smtp',worker)).status,403,'Document sender does not need SMTP administration');
 } finally {nodemailer.createTransport=original;}
});
