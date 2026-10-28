const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const licenseMiddleware = require('./middleware/license.middleware');
require('dotenv').config();

// 1. Initialize Models & Associations FIRST
const db = require('./models');
const { 
  sequelize, User, Customer, Document, 
  WalletAccount, WalletTransaction, 
  ServiceType, ServiceOrder, 
  Invoice, InvoiceItem, Expense 
} = db;

const app = express();
app.set('trust proxy', 1);

// 2. Load Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roleRoutes = require('./routes/role.routes');
const walletRoutes = require('./routes/wallet.routes');
const customerRoutes = require('./routes/customer.routes');
const documentRoutes = require('./routes/document.routes');
const serviceRoutes = require('./routes/service.routes');
const documentTypeRoutes = require('./routes/documentType.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const expenseRoutes = require('./routes/expense.routes');
const expenseTypeRoutes = require('./routes/expense-type.routes');
const expenseSubTypeRoutes = require('./routes/expense-sub-type.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportsRoutes = require('./routes/reports.routes');
const configRoutes = require('./routes/config.routes');
const saasRoutes = require('./routes/saas.routes');
const taxRoutes = require('./routes/tax.routes');
const salesOrderRoutes = require('./routes/sales-order.routes');
const managementRoutes = require('./routes/management.routes');
const voucherDesignRoutes = require('./routes/voucher-design.routes');
const leadRoutes = require('./routes/lead.routes');
const emailRoutes = require('./routes/email.routes');
const toolsRoutes = require('./routes/tools.routes');
const supplierRoutes = require('./routes/supplier.routes');
const salaryRoutes = require('./routes/salary.routes');

// Sync Database safely on startup
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: false });
    await require('./utils/commissionApprovalSchema')(sequelize);
    await require('./utils/dashboardTemplateSchema')(sequelize);
    await require('./utils/leadTypeSchema')(sequelize);
    await require('./utils/leadFollowUpSchema')(sequelize);
    await require('./utils/leadArchiveSchema')(sequelize);
    await require('./utils/businessOwnership').ensureSchema(sequelize);
    await require('./utils/serviceAssignmentSchema')(sequelize);
    console.log('[System] Synced successfully with all associations.');
    
    // Ensure default Plan and Tenant exist before referencing tenant_id: 1
    const { Plan, Tenant, Role, User } = require('./models');
    const [defaultPlan] = await Plan.findOrCreate({
      where: { id: 1 },
      defaults: {
        name: 'Standard Plan',
        price_monthly: 0,
        price_yearly: 0,
        max_users: 10,
        max_customers: 500,
        max_documents: 1000,
        max_wallet_accounts: 5,
        features: ['documents', 'customers', 'invoices', 'services', 'reports'],
        is_active: true
      }
    });

    await Tenant.findOrCreate({
      where: { id: 1 },
      defaults: {
        name: 'Default Workspace',
        slug: 'default',
        plan_id: defaultPlan.id,
        status: 'active',
        billing_cycle: 'yearly'
      }
    });

    // Sync Admin Role (Force all permissions ON at every startup)
    const fullPermissions = {
      dashboard: { read: true, write: true, delete: true },
      customers: { read: true, write: true, delete: true },
      suppliers: { read: true, write: true, delete: true },
      documents: { read: true, write: true, delete: true },
      services: { read: true, write: true, delete: true },
      invoices: { read: true, write: true, delete: true },
      expenses: { read: true, write: true, delete: true },
      wallet: { read: true, write: true, delete: true },
      reports: { read: true, write: true, delete: true },
      settings: { read: true, write: true, delete: true },
      financials: { read: true, write: true, delete: true },
      management: { read: true, write: true, delete: true },
      tools: { read: true, write: true, delete: true },
      staff: { read: true, write: true, delete: true }
    };

    const [adminRole] = await Role.findOrCreate({
      where: { name: 'Admin', tenant_id: 1 },
      defaults: { permissions: fullPermissions, tenant_id: 1 }
    });
    await adminRole.update({ permissions: fullPermissions });
    console.log('[System] Admin Role permissions synchronized (All Access).');

    const [staffRole, staffCreated] = await Role.findOrCreate({
      where: { name: 'Staff', tenant_id: 1 },
      defaults: {
        permissions: {
          dashboard: { read: true, write: false, delete: false },
          customers: { read: true, write: true, delete: false },
          documents: { read: true, write: true, delete: false },
          services: { read: true, write: true, delete: false },
          invoices: { read: true, write: true, delete: false },
          expenses: { read: false, write: false, delete: false },
          wallet: { read: false, write: false, delete: false },
          reports: { read: false, write: false, delete: false },
          settings: { read: false, write: false, delete: false },
          financials: { read: false, write: false, delete: false },
          management: { read: false, write: false, delete: false },
          staff: { read: false, write: false, delete: false }
        },
        tenant_id: 1
      }
    });
    
    if (staffCreated) {
       console.log('[System] Staff Role created with default permissions.');
    }
    console.log('[System] Default roles initialized.');

    // 3. Seed Developer & Admin Accounts
    const [developerRole] = await Role.findOrCreate({
      where: { name: 'Developer', tenant_id: null },
      defaults: {
        permissions: fullPermissions,
        tenant_id: null
      }
    });
    await developerRole.update({ permissions: fullPermissions });

    await require('./utils/bootstrap-accounts').retireDefaultAccounts(User);

    // Bootstrap initial Administrator account if supplied via environment
    if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
      const bEmail = process.env.BOOTSTRAP_ADMIN_EMAIL.trim();
      const bPass = process.env.BOOTSTRAP_ADMIN_PASSWORD;
      const bTenantId = Number(process.env.BOOTSTRAP_TENANT_ID || 1);
      const existingAdmin = await User.findOne({ where: { email: bEmail } });
      if (!existingAdmin && bPass.length >= 8) {
        await User.create({
          name: 'System Administrator',
          email: bEmail,
          password_hash: bPass,
          role_id: adminRole.id,
          tenant_id: bTenantId,
          is_active: true,
          can_login: true
        });
        console.log(`[System] Initial Administrator (${bEmail}) bootstrapped successfully.`);
      }
    }

    // Seed Default System Config
    const { SystemConfig } = require('./models');
    const defaultConfig = [
      { key: 'business_name', value: 'DocClear Management' },
      { key: 'app_name', value: 'DocClear' },
      { key: 'app_logo', value: '' },
      { key: 'license_expiry_date', value: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }, // Default 1 year
      { key: 'base_currency', value: 'AED' },
      { key: 'contact_email', value: 'support@docclear.com' },
      { key: 'default_language', value: 'English' }
    ];

    for (const item of defaultConfig) {
      await SystemConfig.findOrCreate({
        where: { key: item.key, tenant_id: 1 },
        defaults: { value: item.value, tenant_id: 1 }
      });
    }
    console.log('[System] Default configurations initialized.');

    // Seed Default Email Templates
    const { EmailTemplate } = require('./models');
    const defaultTemplates = [
      {
        type: 'invoice_issued',
        name: 'Invoice Issued',
        subject: 'Invoice {{invoice_number}} from {{business_name}}',
        body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="color:#4f46e5;">Invoice {{invoice_number}}</h2>
  <p>Dear {{customer_name}},</p>
  <p>Please find your invoice details below:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Invoice No.</td><td style="padding:8px;border:1px solid #e5e7eb;">{{invoice_number}}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Total Amount</td><td style="padding:8px;border:1px solid #e5e7eb;">{{currency}} {{total}}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Due Date</td><td style="padding:8px;border:1px solid #e5e7eb;">{{due_date}}</td></tr>
  </table>
  <p>Please make payment before the due date. Thank you for your business.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px;">{{business_name}} | {{contact_email}}</p>
</div>`
      },
      {
        type: 'payment_received',
        name: 'Payment Received',
        subject: 'Payment Received - {{invoice_number}}',
        body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="color:#16a34a;">Payment Confirmed ✓</h2>
  <p>Dear {{customer_name}},</p>
  <p>We have received your payment of <strong>{{currency}} {{amount}}</strong> for invoice <strong>{{invoice_number}}</strong>. Thank you!</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px;">{{business_name}} | {{contact_email}}</p>
</div>`
      },
      {
        type: 'document_reminder',
        name: 'Document Expiry Reminder',
        subject: 'Reminder: {{document_name}} expires in {{days_remaining}} days',
        body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="color:#d97706;">⚠️ Document Expiry Reminder</h2>
  <p>Dear {{customer_name}},</p>
  <p>This is a reminder that your document <strong>{{document_name}}</strong> is due to expire on <strong>{{expiry_date}}</strong> ({{days_remaining}} days remaining).</p>
  <p>Please take the necessary steps to renew it before it expires to avoid any disruptions.</p>
  <p>Contact us to start the renewal process.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px;">{{business_name}} | {{contact_email}}</p>
</div>`
      },
      {
        type: 'document_expired',
        name: 'Document Expired',
        subject: 'URGENT: {{document_name}} has expired',
        body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #fecaca;border-radius:8px;">
  <h2 style="color:#dc2626;">🚨 Document Expired</h2>
  <p>Dear {{customer_name}},</p>
  <p>Your document <strong>{{document_name}}</strong> expired on <strong>{{expiry_date}}</strong>. Please contact us immediately to arrange renewal.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px;">{{business_name}} | {{contact_email}}</p>
</div>`
      },
      {
        type: 'sales_order_confirmation',
        name: 'Sales Order Confirmation',
        subject: 'Sales Order {{order_number}} - Confirmation',
        body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
  <h2 style="color:#4f46e5;">Sales Order Confirmation</h2>
  <p>Dear {{customer_name}},</p>
  <p>Your Sales Order <strong>{{order_number}}</strong> has been received and is being processed.</p>
  <p>Our team will be in touch shortly with further updates.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px;">{{business_name}} | {{contact_email}}</p>
</div>`
      },
      {
        type: 'manual',
        name: 'General Email',
        subject: 'Message from {{business_name}}',
        body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
  <p>Dear {{customer_name}},</p>
  <p>{{message}}</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px;">{{business_name}} | {{contact_email}}</p>
</div>`
      }
    ];

    for (const tmpl of defaultTemplates) {
      await EmailTemplate.findOrCreate({
        where: { type: tmpl.type, tenant_id: 1 },
        defaults: { ...tmpl, tenant_id: 1 }
      });
    }
    console.log('[System] Default email templates initialized.');
  } catch (err) {
    console.error('[System] Startup FAILED:', err);
    throw err;
  }
}

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many login attempts, please try again in an hour.' }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false,
  contentSecurityPolicy: false
}));
app.use(compression());
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim()) 
  : ['http://127.0.0.2:3000', 'http://localhost:3000', 'https://obedient-politics-ger.domcloud.dev'];

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow internal/mobile/tool requests (no origin)
    if (!origin) return callback(null, true);
    
    // 2. Check allowlist or dev mode
    const isAllowed = allowedOrigins.includes(origin) || 
                     origin.includes('127.0.0.2') ||
                     process.env.NODE_ENV === 'development' ||
                     origin.includes('domcloud.dev');
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const path = require('path');
const fileAccess = require('./middleware/file-access.middleware');
app.use('/uploads', fileAccess, (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Also serve under /api/v1/uploads to match frontend apiBase + file_path
app.use('/api/v1/uploads', fileAccess, (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/health', (req, res) => {
  sequelize.authenticate().then(() => {
    res.json({ status: 'OK', timestamp: new Date() });
  }).catch(() => res.status(503).json({ status: 'Unavailable' }));
});

// Routes
app.get('/api/v1', (req, res) => {
  res.json({ message: 'Welcome to DocClear API v1' });
});

// Apply License Protection (Global Check)
app.use('/api/v1', licenseMiddleware);

app.use('/api/v1', globalLimiter);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/record-assignments', require('./routes/record-assignments.routes'));
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/expense-types', expenseTypeRoutes);
app.use('/api/v1/expense-sub-types', expenseSubTypeRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/document-types', documentTypeRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/saas', saasRoutes);
app.use('/api/v1/taxes', taxRoutes);
app.use('/api/v1/sales-orders', salesOrderRoutes);
app.use('/api/v1/quotations', require('./routes/quotation.routes'));
app.use('/api/v1/service-bundles', require('./routes/service-bundle.routes'));
app.use('/api/v1/management', managementRoutes);
app.use('/api/v1/commissions', require('./routes/commission.routes'));
app.use('/api/v1/voucher-designs', voucherDesignRoutes);
app.use('/api/v1/document-templates', require('./routes/document-templates.routes'));
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/tools', toolsRoutes);
app.use('/api/v1/salaries', salaryRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err);

  // Sequelize Validation Errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: err.errors ? err.errors[0].message : 'Validation error',
      errors: err.errors || []
    });
  }

  // JWT Errors
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing authentication token'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: process.env.NODE_ENV === 'development' ? err.errors : []
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.2');
async function start() {
 await initializeDatabase();
 await require('./utils/commissionFeature').initializeActivations();
 return app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  if (process.env.DISABLE_CRON === 'true') return;
  // Start background cron jobs
  const { startDocumentReminderCron } = require('./cron/documentReminder.cron');
  startDocumentReminderCron();

  // Start daily database backup cron (02:00 AM UAE Time)
  const { startDatabaseBackupCron } = require('./cron/databaseBackup.cron');
  startDatabaseBackupCron();

  // SaaS Subscription Cron Jobs
  const cron = require('node-cron');
  const { runAllJobs } = require('./cron/saas-jobs');
  
  // Run every hour at the 0th minute
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running SaaS subscription checks...');
    await runAllJobs();
  });
});
}

if (require.main === module) {
  start().catch(async () => {
    await sequelize.close();
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.start = start;
