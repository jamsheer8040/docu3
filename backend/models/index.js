const sequelize = require('../config/database');
const { Sequelize } = require('sequelize');
const path = require('path');

console.log('[Models] Starting initialization with absolute paths...');

// 0. SaaS Models
const Plan = require(path.join(__dirname, 'Plan.js'));
const Tenant = require(path.join(__dirname, 'Tenant.js'));
const TenantInvoice = require(path.join(__dirname, 'TenantInvoice.js'));
const TenantHistory = require(path.join(__dirname, 'TenantHistory.js'));
const PromoCode = require(path.join(__dirname, 'PromoCode.js'));
console.log('  Loaded: Plan, Tenant, TenantInvoice, TenantHistory, PromoCode');

// 1. User & Role
const User = require(path.join(__dirname, 'User.js'));
const Role = require(path.join(__dirname, 'Role.js'));
console.log('  Loaded: User, Role');

// 2. Customer & Lead
const Customer = require(path.join(__dirname, 'Customer.js'));
const UserCustomer = require(path.join(__dirname, 'UserCustomer.js'));
const Lead = require(path.join(__dirname, 'Lead.js'));
const LeadStatusHistory = require(path.join(__dirname, 'LeadStatusHistory.js'));
const LeadFollowUp = require(path.join(__dirname, 'LeadFollowUp.js'));
console.log('  Loaded: Customer, UserCustomer, Lead, LeadStatusHistory');

// 2.5 Supplier & Purchases
const Supplier = require(path.join(__dirname, 'Supplier.js'));
const SupplierPurchase = require(path.join(__dirname, 'SupplierPurchase.js'));
const SupplierPayment = require(path.join(__dirname, 'SupplierPayment.js'));
console.log('  Loaded: Supplier, SupplierPurchase, SupplierPayment');

// 3. Document & DocumentType & StaffDocument
const Document = require(path.join(__dirname, 'Document.js'));
const DocumentType = require(path.join(__dirname, 'DocumentType.js'));
const StaffDocument = require(path.join(__dirname, 'StaffDocument.js'));
console.log('  Loaded: Document, DocumentType, StaffDocument');

// 3.5 Tax
const Tax = require(path.join(__dirname, 'Tax.js'));
console.log('  Loaded: Tax');

// 4. Wallet
const WalletAccount = require(path.join(__dirname, 'WalletAccount.js'));
console.log('  Loaded: WalletAccount');

const WalletTransaction = require(path.join(__dirname, 'WalletTransaction.js'));
console.log('  Loaded: WalletTransaction');

// 5. Service
const ServiceType = require(path.join(__dirname, 'ServiceType.js'));
console.log('  Loaded: ServiceType');
const ServiceTypePricing = require(path.join(__dirname, 'ServiceTypePricing.js'));
console.log('  Loaded: ServiceTypePricing');

const ServiceOrder = require(path.join(__dirname, 'ServiceOrder.js'));
const ServiceAssignment = require(path.join(__dirname, 'ServiceAssignment.js'));
console.log('  Loaded: ServiceOrder');

const SalesOrder = require(path.join(__dirname, 'SalesOrder.js'));
console.log('  Loaded: SalesOrder');

const SalesOrderItem = require(path.join(__dirname, 'SalesOrderItem.js'));
console.log('  Loaded: SalesOrderItem');

// 6. Invoice
const Invoice = require(path.join(__dirname, 'Invoice.js'));
console.log('  Loaded: Invoice');

const InvoiceItem = require(path.join(__dirname, 'InvoiceItem.js'));
console.log('  Loaded: InvoiceItem');

// 7. Expense & Expense Category
const ExpenseType = require(path.join(__dirname, 'ExpenseType.js'));
console.log('  Loaded: ExpenseType');

const ExpenseSubType = require(path.join(__dirname, 'ExpenseSubType.js'));
console.log('  Loaded: ExpenseSubType');

const Expense = require(path.join(__dirname, 'Expense.js'));
console.log('  Loaded: Expense');

// 8. System Config
const SystemConfig = require(path.join(__dirname, 'SystemConfig.js'));
const DocumentTemplateSnapshot = require(path.join(__dirname, 'DocumentTemplateSnapshot.js'));
console.log('  Loaded: SystemConfig');

// 9. Email
const EmailTemplate = require(path.join(__dirname, 'EmailTemplate.js'));
const EmailLog = require(path.join(__dirname, 'EmailLog.js'));
console.log('  Loaded: EmailTemplate, EmailLog');

// 10. Tools
const SavedCv = require(path.join(__dirname, 'SavedCv.js'));
console.log('  Loaded: SavedCv');

// 7. Management / Shareholder
const Shareholder = require(path.join(__dirname, 'Shareholder.js'));
const OwnershipChange = require(path.join(__dirname, 'OwnershipChange.js'));
const CapitalTransaction = require(path.join(__dirname, 'CapitalTransaction.js'));
const DividendDeclaration = require(path.join(__dirname, 'DividendDeclaration.js'));
const DividendDistribution = require(path.join(__dirname, 'DividendDistribution.js'));
const DividendPayment = require(path.join(__dirname, 'DividendPayment.js'));
console.log('  Loaded: Shareholder, CapitalTransaction, Dividends');

// 8. Voucher Design & Audit Logs
const VoucherDesign = require(path.join(__dirname, 'VoucherDesign.js'));
const VoucherDesignAuditLog = require(path.join(__dirname, 'VoucherDesignAuditLog.js'));
console.log('  Loaded: VoucherDesign, VoucherDesignAuditLog');

// 11. Salary & Payroll
const SalaryPayroll = require(path.join(__dirname, 'SalaryPayroll.js'));
const SalaryItem = require(path.join(__dirname, 'SalaryItem.js'));
const SalaryPayment = require(path.join(__dirname, 'SalaryPayment.js'));
console.log('  Loaded: SalaryPayroll, SalaryItem, SalaryPayment');

// Define SaaS Associations
Tenant.belongsTo(Plan, { foreignKey: 'plan_id' });
Plan.hasMany(Tenant, { foreignKey: 'plan_id' });

// Voucher Design & Audit Scoping
VoucherDesign.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(VoucherDesign, { foreignKey: 'tenant_id' });

VoucherDesignAuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(VoucherDesignAuditLog, { foreignKey: 'tenant_id' });

VoucherDesignAuditLog.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(VoucherDesignAuditLog, { foreignKey: 'user_id' });

TenantInvoice.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(TenantInvoice, { foreignKey: 'tenant_id' });

TenantHistory.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(TenantHistory, { foreignKey: 'tenant_id' });

// Define Tenant Scoping Associations
User.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(User, { foreignKey: 'tenant_id' });

Role.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Role, { foreignKey: 'tenant_id' });

Customer.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.belongsTo(User, { foreignKey: 'assigned_user_id', as: 'AssignedSalesStaff', constraints: false });
Tenant.hasMany(Customer, { foreignKey: 'tenant_id' });

Supplier.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Supplier, { foreignKey: 'tenant_id' });

SupplierPurchase.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(SupplierPurchase, { foreignKey: 'tenant_id' });

SupplierPayment.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(SupplierPayment, { foreignKey: 'tenant_id' });

Lead.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Lead, { foreignKey: 'tenant_id' });

Lead.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
Lead.belongsTo(User, { foreignKey: 'assigned_user_id', as: 'AssignedStaff', onDelete: 'SET NULL' });
User.hasMany(Lead, { foreignKey: 'created_by' });

Lead.belongsTo(Customer, { foreignKey: 'customer_id', as: 'Customer' });
Customer.hasMany(Lead, { foreignKey: 'customer_id' });

LeadStatusHistory.belongsTo(Lead, { foreignKey: 'lead_id', onDelete: 'CASCADE' });
LeadFollowUp.belongsTo(Lead, { foreignKey: 'lead_id', onDelete: 'CASCADE' });
LeadFollowUp.belongsTo(User, { foreignKey: 'created_by', as: 'Recorder' });
Lead.hasMany(LeadStatusHistory, { foreignKey: 'lead_id', as: 'StatusHistories' });

Lead.belongsTo(ServiceType, { foreignKey: 'service_id', as: 'Service' });
ServiceType.hasMany(Lead, { foreignKey: 'service_id' });

LeadStatusHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'ChangedBy' });
User.hasMany(LeadStatusHistory, { foreignKey: 'changed_by' });

Lead.belongsTo(User, { foreignKey: 'converted_by', as: 'ConvertedBy' });

Document.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Document, { foreignKey: 'tenant_id' });

DocumentType.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(DocumentType, { foreignKey: 'tenant_id' });

StaffDocument.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(StaffDocument, { foreignKey: 'tenant_id' });

StaffDocument.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(StaffDocument, { foreignKey: 'user_id', as: 'StaffDocuments' });

StaffDocument.belongsTo(DocumentType, { foreignKey: 'document_type_id', as: 'DocumentType' });
DocumentType.hasMany(StaffDocument, { foreignKey: 'document_type_id' });

Tax.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Tax, { foreignKey: 'tenant_id' });

WalletAccount.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(WalletAccount, { foreignKey: 'tenant_id' });

WalletTransaction.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(WalletTransaction, { foreignKey: 'tenant_id' });

ServiceType.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(ServiceType, { foreignKey: 'tenant_id' });

ServiceOrder.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(ServiceOrder, { foreignKey: 'tenant_id' });

SalesOrder.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(SalesOrder, { foreignKey: 'tenant_id' });

SalesOrderItem.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(SalesOrderItem, { foreignKey: 'tenant_id' });

Invoice.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Invoice, { foreignKey: 'tenant_id' });

InvoiceItem.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(InvoiceItem, { foreignKey: 'tenant_id' });

Expense.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Expense, { foreignKey: 'tenant_id' });

ExpenseType.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(ExpenseType, { foreignKey: 'tenant_id' });

ExpenseSubType.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(ExpenseSubType, { foreignKey: 'tenant_id' });

SystemConfig.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(SystemConfig, { foreignKey: 'tenant_id' });

Shareholder.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(Shareholder, { foreignKey: 'tenant_id' });

OwnershipChange.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(OwnershipChange, { foreignKey: 'tenant_id' });

CapitalTransaction.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(CapitalTransaction, { foreignKey: 'tenant_id' });

DividendDeclaration.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(DividendDeclaration, { foreignKey: 'tenant_id' });

DividendDistribution.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(DividendDistribution, { foreignKey: 'tenant_id' });

DividendPayment.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(DividendPayment, { foreignKey: 'tenant_id' });

// Define Regular Associations
User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(User, { foreignKey: 'role_id' });

User.belongsToMany(Customer, { through: UserCustomer, foreignKey: 'user_id', otherKey: 'customer_id', as: 'LinkedCustomers' });
Customer.belongsToMany(User, { through: UserCustomer, foreignKey: 'customer_id', otherKey: 'user_id', as: 'LinkedUsers' });

WalletTransaction.belongsTo(WalletAccount, { foreignKey: 'account_id' });
WalletAccount.hasMany(WalletTransaction, { foreignKey: 'account_id' });

Document.belongsTo(Customer, { foreignKey: 'customer_id' });
Customer.hasMany(Document, { foreignKey: 'customer_id' });

Document.belongsTo(DocumentType, { foreignKey: 'document_type_id', constraints: false });
DocumentType.hasMany(Document, { foreignKey: 'document_type_id', constraints: false });

ServiceOrder.belongsTo(Customer, { foreignKey: 'customer_id' });
ServiceOrder.belongsTo(User, { foreignKey: 'assigned_user_id', as: 'AssignedStaff', onDelete: 'SET NULL' });
ServiceAssignment.belongsTo(ServiceOrder, { foreignKey: 'service_order_id', onDelete: 'CASCADE' });
ServiceAssignment.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(ServiceOrder, { foreignKey: 'customer_id' });

ServiceOrder.belongsTo(ServiceType, { foreignKey: 'service_type_id' });
ServiceType.hasMany(ServiceOrder, { foreignKey: 'service_type_id' });

// Supplier Associations
SupplierPurchase.belongsTo(Supplier, { foreignKey: 'supplier_id' });
Supplier.hasMany(SupplierPurchase, { foreignKey: 'supplier_id' });

SupplierPayment.belongsTo(Supplier, { foreignKey: 'supplier_id' });
Supplier.hasMany(SupplierPayment, { foreignKey: 'supplier_id' });

SupplierPayment.belongsTo(SupplierPurchase, { foreignKey: 'purchase_id' });
SupplierPurchase.hasMany(SupplierPayment, { foreignKey: 'purchase_id' });

SupplierPayment.belongsTo(WalletAccount, { foreignKey: 'wallet_id' });
WalletAccount.hasMany(SupplierPayment, { foreignKey: 'wallet_id' });

ServiceOrder.belongsTo(Supplier, { foreignKey: 'cost_supplier_id' });
Supplier.hasMany(ServiceOrder, { foreignKey: 'cost_supplier_id' });

InvoiceItem.belongsTo(Supplier, { foreignKey: 'cost_supplier_id' });
Supplier.hasMany(InvoiceItem, { foreignKey: 'cost_supplier_id' });

SalesOrder.belongsTo(Customer, { foreignKey: 'customer_id' });
Customer.hasMany(SalesOrder, { foreignKey: 'customer_id' });

SalesOrder.belongsTo(User, { foreignKey: 'sales_executive_id', as: 'SalesExecutive' });
User.hasMany(SalesOrder, { foreignKey: 'sales_executive_id' });

SalesOrderItem.belongsTo(SalesOrder, { foreignKey: 'sales_order_id' });
SalesOrder.hasMany(SalesOrderItem, { foreignKey: 'sales_order_id' });

SalesOrderItem.belongsTo(ServiceType, { foreignKey: 'service_type_id' });
ServiceType.hasMany(SalesOrderItem, { foreignKey: 'service_type_id' });

SalesOrderItem.belongsTo(ServiceOrder, { foreignKey: 'service_order_id' });
ServiceOrder.hasOne(SalesOrderItem, { foreignKey: 'service_order_id' });

ServiceTypePricing.belongsTo(ServiceType, { foreignKey: 'service_type_id' });
ServiceType.hasMany(ServiceTypePricing, { foreignKey: 'service_type_id' });

Invoice.belongsTo(Customer, { foreignKey: 'customer_id' });
Customer.hasMany(Invoice, { foreignKey: 'customer_id' });

Invoice.hasMany(ServiceOrder, { foreignKey: 'invoice_id' });
ServiceOrder.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Invoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoice_id' });

InvoiceItem.belongsTo(ServiceOrder, { foreignKey: 'service_order_id' });
ServiceOrder.hasMany(InvoiceItem, { foreignKey: 'service_order_id' });

Expense.belongsTo(WalletAccount, { foreignKey: 'account_id' });
WalletAccount.hasMany(Expense, { foreignKey: 'account_id' });

ExpenseType.hasMany(ExpenseSubType, { foreignKey: 'expense_type_id', as: 'SubTypes' });
ExpenseSubType.belongsTo(ExpenseType, { foreignKey: 'expense_type_id', as: 'ParentType' });

Expense.belongsTo(ExpenseSubType, { foreignKey: 'expense_sub_type_id', as: 'SubType' });
ExpenseSubType.hasMany(Expense, { foreignKey: 'expense_sub_type_id' });

// Management Relations
OwnershipChange.belongsTo(Shareholder, { foreignKey: 'shareholder_id' });
Shareholder.hasMany(OwnershipChange, { foreignKey: 'shareholder_id' });

OwnershipChange.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(OwnershipChange, { foreignKey: 'user_id' });

CapitalTransaction.belongsTo(Shareholder, { foreignKey: 'shareholder_id' });
Shareholder.hasMany(CapitalTransaction, { foreignKey: 'shareholder_id' });

CapitalTransaction.belongsTo(WalletAccount, { foreignKey: 'wallet_id' });
WalletAccount.hasMany(CapitalTransaction, { foreignKey: 'wallet_id' });

DividendDistribution.belongsTo(DividendDeclaration, { foreignKey: 'declaration_id' });
DividendDeclaration.hasMany(DividendDistribution, { foreignKey: 'declaration_id' });

DividendDistribution.belongsTo(Shareholder, { foreignKey: 'shareholder_id' });
Shareholder.hasMany(DividendDistribution, { foreignKey: 'shareholder_id' });

DividendPayment.belongsTo(DividendDistribution, { foreignKey: 'distribution_id' });
DividendDistribution.hasMany(DividendPayment, { foreignKey: 'distribution_id' });

DividendPayment.belongsTo(WalletAccount, { foreignKey: 'wallet_id' });
WalletAccount.hasMany(DividendPayment, { foreignKey: 'wallet_id' });

// Email Associations
EmailTemplate.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(EmailTemplate, { foreignKey: 'tenant_id' });

// EmailLog Associations
EmailLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
EmailLog.belongsTo(EmailTemplate, { foreignKey: 'template_id' });

// SavedCv Associations
SavedCv.belongsTo(Tenant, { foreignKey: 'tenant_id' });
SavedCv.belongsTo(User, { foreignKey: 'user_id' });

EmailLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
// Salary & Payroll Associations
SalaryPayroll.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(SalaryPayroll, { foreignKey: 'tenant_id' });

SalaryPayroll.hasMany(SalaryItem, { foreignKey: 'payroll_id', as: 'Items', onDelete: 'CASCADE' });
SalaryItem.belongsTo(SalaryPayroll, { foreignKey: 'payroll_id', as: 'Payroll' });

SalaryItem.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(SalaryItem, { foreignKey: 'tenant_id' });

SalaryItem.belongsTo(User, { foreignKey: 'user_id', as: 'Staff' });
User.hasMany(SalaryItem, { foreignKey: 'user_id' });

SalaryItem.belongsTo(WalletAccount, { foreignKey: 'account_id', as: 'Account' });
WalletAccount.hasMany(SalaryItem, { foreignKey: 'account_id' });

SalaryItem.hasMany(SalaryPayment, { foreignKey: 'salary_item_id', as: 'Payments', onDelete: 'CASCADE' });
SalaryPayment.belongsTo(SalaryItem, { foreignKey: 'salary_item_id' });

SalaryPayment.belongsTo(WalletAccount, { foreignKey: 'account_id', as: 'Account' });
WalletAccount.hasMany(SalaryPayment, { foreignKey: 'account_id' });

SalaryPayment.belongsTo(WalletTransaction, { foreignKey: 'transaction_id', as: 'Transaction' });

console.log('[Models] All associations defined.');
require('../utils/documentTemplateSnapshots')({ SystemConfig, DocumentTemplateSnapshot, Invoice, SalesOrder, Expense, WalletTransaction });

// Add Global Hooks for Automatic Tenant Scoping
const tenantContext = require('../utils/tenantContext');

sequelize.addHook('beforeFind', function (options) {
  const tenantId = tenantContext.getStore();
  if (tenantId !== undefined && tenantId !== null) {
    if (this.rawAttributes && this.rawAttributes.tenant_id) {
      options.where = options.where || {};
      if (options.where.tenant_id === undefined) {
        options.where.tenant_id = tenantId;
      }
    }
  }
});

sequelize.addHook('beforeBulkUpdate', function (options) {
  const tenantId = tenantContext.getStore();
  if (tenantId !== undefined && tenantId !== null) {
    if (this.rawAttributes && this.rawAttributes.tenant_id) {
      options.where = options.where || {};
      if (options.where.tenant_id === undefined) {
        options.where.tenant_id = tenantId;
      }
    }
  }
});

sequelize.addHook('beforeBulkDestroy', function (options) {
  const tenantId = tenantContext.getStore();
  if (tenantId !== undefined && tenantId !== null) {
    if (this.rawAttributes && this.rawAttributes.tenant_id) {
      options.where = options.where || {};
      if (options.where.tenant_id === undefined) {
        options.where.tenant_id = tenantId;
      }
    }
  }
});

sequelize.addHook('beforeValidate', function (instance, options) {
  const tenantId = tenantContext.getStore();
  if (tenantId !== undefined && tenantId !== null) {
    if (instance.constructor.rawAttributes && instance.constructor.rawAttributes.tenant_id && (instance.tenant_id === undefined || instance.tenant_id === null)) {
      instance.tenant_id = tenantId;
    }
  }
});

sequelize.addHook('beforeCount', function (options) {
  const tenantId = tenantContext.getStore();
  if (tenantId !== undefined && tenantId !== null) {
    if (this.rawAttributes && this.rawAttributes.tenant_id) {
      options.where = options.where || {};
      if (options.where.tenant_id === undefined) {
        options.where.tenant_id = tenantId;
      }
    }
  }
});

// Patch Model.aggregate to enforce tenant isolation since it bypasses beforeFind hooks
const originalAggregate = Sequelize.Model.aggregate;
Sequelize.Model.aggregate = async function (field, aggregateFunction, options) {
  options = options || {};
  const tenantId = tenantContext.getStore();
  if (tenantId !== undefined && tenantId !== null) {
    if (this.rawAttributes && this.rawAttributes.tenant_id) {
      options.where = options.where || {};
      if (options.where.tenant_id === undefined) {
        options.where.tenant_id = tenantId;
      }
    }
  }
  return originalAggregate.call(this, field, aggregateFunction, options);
};

// Export Database Object
const Quotation=require('./Quotation');
const db = {
  ServiceBundle: require('./ServiceBundle'),
  ...require('./Commission'),
  ManagementRequest: require('./ManagementRequest'),
  Quotation,
  sequelize,
  Sequelize,
  Plan,
  Tenant,
  TenantInvoice,
  TenantHistory,
  PromoCode,
  User,
  Role,
  Customer,
  UserCustomer,
  Supplier,
  SupplierPurchase,
  SupplierPayment,
  Lead,
  LeadStatusHistory,
  LeadFollowUp,
  Document,
  DocumentType,
  StaffDocument,
  Tax,
  WalletAccount,
  WalletTransaction,
  ServiceType,
  ServiceTypePricing,
  ServiceOrder,
  ServiceAssignment,
  SalesOrder,
  SalesOrderItem,
  Invoice,
  InvoiceItem,
  ExpenseType,
  ExpenseSubType,
  Expense,
  SystemConfig,
  DocumentTemplateSnapshot,
  Shareholder,
  OwnershipChange,
  CapitalTransaction,
  DividendDeclaration,
  DividendDistribution,
  DividendPayment,
  VoucherDesign,
  VoucherDesignAuditLog,
  EmailTemplate,
  EmailLog,
  SavedCv,
  SalaryPayroll,
  SalaryItem,
  SalaryPayment
};

require('../utils/businessOwnership').registerOwnership(db);
require('../utils/recordAccess').install(db);
for (const hook of ['beforeFindAfterExpandIncludeAll','beforeCount']) db.Expense.addHook(hook, options => require('../utils/commissionFeature').scopeExpenses(options));
db.DashboardTemplate = require('./DashboardTemplate');
for (const hook of ['beforeUpdate', 'beforeDestroy']) db.Expense.addHook(hook, async (expense, options) => {
  if ((expense.salary_payroll_id || expense.previous('salary_payroll_id')) && !options.salaryAccounting) {
    const error = new Error('Manage this salary expense through Salary payroll.'); error.status = 409; throw error;
  }
  if (options.commissionReversal) return;
  const approval = await db.CommissionEntry.findOne({where:{tenant_id:expense.tenant_id,approval_expense_id:expense.id},transaction:options.transaction});
  if (approval) { const error=new Error('Manage this approved expense through Commissions.');error.status=409;throw error; }
  const linked = await db.CommissionPayment.findOne({ where: { tenant_id: expense.tenant_id, expense_id: expense.id }, transaction: options.transaction });
  if (linked) { const error = new Error('Manage this expense through the Commissions payment history.'); error.status = 409; throw error; }
});
module.exports = db;
