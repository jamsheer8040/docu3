// Operational records only. Catalogs, configuration and login/role records keep
// their separate administrative permissions. Children inherit their parent's ACL.
const roots = {
  Customer: 'customers', Lead: 'leads', Quotation: 'quotations', Supplier: 'suppliers',
  Document: 'documents', ServiceOrder: 'services', SalesOrder: 'sales_orders',
  Invoice: 'invoices', Expense: 'expenses', WalletAccount: 'wallet',
  Shareholder: 'management', CapitalTransaction: 'management',
  DividendDeclaration: 'management', OwnershipChange: 'management',
  User: 'staff', SalaryPayroll: 'staff', StaffDocument: 'staff', SalaryItem: 'staff', SavedCv: 'tools'
};
const children = {
  LeadFollowUp: ['Lead', 'lead_id'], LeadStatusHistory: ['Lead', 'lead_id'],
  ServiceAssignment: ['ServiceOrder', 'service_order_id'],
  SalesOrderItem: ['SalesOrder', 'sales_order_id'], InvoiceItem: ['Invoice', 'invoice_id'],
  SupplierPurchase: ['Supplier', 'supplier_id'], SupplierPayment: ['Supplier', 'supplier_id'],
  WalletTransaction: ['WalletAccount', 'account_id'],
  SalaryPayment: ['SalaryItem', 'salary_item_id'],
  DividendDistribution: ['DividendDeclaration', 'declaration_id'],
  DividendPayment: ['DividendDistribution', 'distribution_id']
};
function registerOwnership(db) {
  const { DataTypes } = require('sequelize');
  for (const name of Object.keys(roots)) {
    const model = db[name];
    for (const field of ['created_by', 'assigned_user_id']) {
      if (!model.rawAttributes[field]) model.rawAttributes[field] = {
        type: DataTypes.INTEGER, allowNull: true, field,
        _modelAttribute: true, Model: model
      };
    }
    model.refreshAttributes();
  }
}
async function ensureSchema(sequelize) {
  const { DataTypes } = require('sequelize');
  const query = sequelize.getQueryInterface();
  for (const name of Object.keys(roots)) {
    const table = sequelize.models[name].getTableName();
    const columns = await query.describeTable(table);
    for (const field of ['created_by', 'assigned_user_id']) {
      if (!columns[field]) await query.addColumn(table, field, { type: DataTypes.INTEGER, allowNull: true });
    }
  }
}
module.exports = { roots, children, registerOwnership, ensureSchema };
