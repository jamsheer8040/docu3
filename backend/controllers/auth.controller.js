const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { User, Role, Customer, Tenant, Plan, WalletAccount, SystemConfig, sequelize } = require('../models');

const setFileAccessCookie = (res, token) => res.cookie('fileAccessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 15 * 60 * 1000
});

/**
 * Handle user login
 */
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ 
      where: { email, is_active: true },
      include: [
        { model: Role, attributes: ['name', 'permissions', 'type'] },
        { model: Customer, as: 'LinkedCustomers', attributes: ['id', 'name'] },
        { 
          model: Tenant, 
          attributes: ['id', 'name', 'status', 'subscription_ends_at', 'subscription_starts_at', 'trial_ends_at', 'billing_cycle', 'next_billing_date'],
          include: [{ model: Plan }]
        }
      ]
    });
    
    if (!user || user.can_login === false || !(await user.validatePassword(password))) {
      if (user && user.can_login === false) {
        return res.status(403).json({
          success: false,
          message: 'This staff account does not have login access.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const secret = process.env.JWT_SECRET || 'docclear_production_jwt_secret_key_change_me';

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.Role?.name || 'Staff', tenant_id: user.tenant_id },
      secret,
      { expiresIn: '15m' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      secret,
      { expiresIn: '7d' } // Long-lived refresh token
    );

    // Set Refresh Token in HttpOnly cookie
    setFileAccessCookie(res, token);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        token, // Access token for Authorization header
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.Role?.name || 'Staff',
          role_type: user.Role?.type || 'Internal',
          LinkedCustomers: user.LinkedCustomers || [],
          Tenant: user.Tenant || null,
          permissions: typeof user.Role?.permissions === 'string' 
            ? JSON.parse(user.Role.permissions || '{}') 
            : (user.Role?.permissions || {})
        }
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
  }
};

/**
 * Handle new user registration (Admin only)
 */
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password, role_id } = req.body;

  try {
    const user = await User.create({
      name,
      email,
      password_hash: password,
      role_id,
      tenant_id: req.user.tenant_id
    });

    const populated = await User.findByPk(user.id, {
      include: [{ model: Role, attributes: ['name', 'permissions', 'type'] }]
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        id: populated.id,
        name: populated.name,
        email: populated.email,
        role: populated.Role?.name || 'Staff'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * Get current authenticated user profile
 */
exports.me = async (req, res) => {
  // Use the data attached by the verifyToken middleware (already includes Role)
  res.json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.Role?.name || 'No Role',
      role_type: req.user.Role?.type || 'Internal',
      LinkedCustomers: req.user.LinkedCustomers || [],
      Tenant: req.user.Tenant || null,
      permissions: typeof req.user.Role?.permissions === 'string'
        ? JSON.parse(req.user.Role.permissions || '{}')
        : (req.user.Role?.permissions || {})
    }
  });
};

/**
 * Refresh access token
 */
exports.refresh = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token missing' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      include: [
        { model: Role, attributes: ['name', 'permissions', 'type'] },
        { model: Customer, as: 'LinkedCustomers', attributes: ['id', 'name'] },
        { 
          model: Tenant, 
          attributes: ['id', 'name', 'status', 'subscription_ends_at', 'subscription_starts_at', 'trial_ends_at', 'billing_cycle', 'next_billing_date'],
          include: [{ model: Plan }]
        }
      ]
    });

    if (!user || !user.is_active || !user.can_login) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.Role?.name || 'Staff', tenant_id: user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    setFileAccessCookie(res, token);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.Role?.name || 'Staff',
          role_type: user.Role?.type || 'Internal',
          LinkedCustomers: user.LinkedCustomers || [],
          Tenant: user.Tenant || null,
          permissions: typeof user.Role?.permissions === 'string'
            ? JSON.parse(user.Role.permissions || '{}')
            : (user.Role?.permissions || {})
        }
      }
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

/**
 * Logout - Clear cookies
 */
exports.logout = async (req, res) => {
  res.clearCookie('refreshToken');
  res.clearCookie('fileAccessToken', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
};

/**
 * Handle password change
 */
exports.changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    
    if (!(await user.validatePassword(oldPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid old password.'
      });
    }

    user.password_hash = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * Get active subscription plans for public registration
 */
exports.getPublicPlans = async (req, res) => {
  try {
    const plans = await Plan.findAll({ where: { is_active: true }, order: [['price_monthly', 'ASC']] });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching plans.' });
  }
};

/**
 * Register a new Tenant (SaaS self-service onboarding)
 */
exports.registerTenant = async (req, res) => {
  const { companyName, slug, name, email, password, planId, billingCycle } = req.body;

  if (!companyName || !slug || !name || !email || !password || !planId) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Default billingCycle to monthly if not provided by frontend
  const finalBillingCycle = billingCycle || 'monthly';

  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) {
    return res.status(400).json({ success: false, message: 'Slug can only contain lowercase letters, numbers, and dashes.' });
  }

  const transaction = await sequelize.transaction();

  try {
    // 1. Verify slug uniqueness
    const existingTenant = await Tenant.findOne({ where: { slug }, transaction });
    if (existingTenant) {
      return res.status(400).json({ success: false, message: 'Subdomain/slug is already taken.' });
    }

    // 2. Verify email uniqueness
    const existingUser = await User.findOne({ where: { email }, transaction });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email address is already in use.' });
    }

    // 3. Verify plan exists
    const plan = await Plan.findByPk(planId, { transaction });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Selected subscription plan not found.' });
    }

    // 4. Create Tenant
    const tenant = await Tenant.create({
      name: companyName,
      slug,
      plan_id: planId,
      status: 'new_registration',
      billing_cycle: finalBillingCycle
    }, { transaction });

    // Insert history
    await sequelize.models.TenantHistory.create({
      tenant_id: tenant.id,
      action: 'Registration',
      old_status: null,
      new_status: 'new_registration',
      plan_id: planId
    }, { transaction });

    // 5. Create Default Roles for new Tenant
    const fullPermissions = {
      dashboard: { read: true, write: true, delete: true },
      customers: { read: true, write: true, delete: true },
      documents: { read: true, write: true, delete: true },
      services: { read: true, write: true, delete: true },
      invoices: { read: true, write: true, delete: true },
      expenses: { read: true, write: true, delete: true },
      wallet: { read: true, write: true, delete: true },
      reports: { read: true, write: true, delete: true },
      settings: { read: true, write: true, delete: true },
      financials: { read: true, write: true, delete: true },
      management: { read: true, write: true, delete: true },
      sales_orders: { read: true, write: true, delete: true }
    };

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: fullPermissions,
      tenant_id: tenant.id
    }, { transaction });

    await Role.create({
      name: 'Staff',
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
        sales_orders: { read: true, write: true, delete: false }
      },
      tenant_id: tenant.id
    }, { transaction });

    await Role.create({
      name: 'Customer',
      type: 'CustomerPortal',
      permissions: {
        dashboard: { read: false, write: false, delete: false },
        customers: { read: false, write: false, delete: false },
        documents: { read: true, write: false, delete: false },
        services: { read: false, write: false, delete: false },
        invoices: { read: false, write: false, delete: false },
        expenses: { read: false, write: false, delete: false },
        wallet: { read: false, write: false, delete: false },
        reports: { read: false, write: false, delete: false },
        settings: { read: false, write: false, delete: false },
        financials: { read: false, write: false, delete: false },
        management: { read: false, write: false, delete: false },
        sales_orders: { read: false, write: false, delete: false }
      },

      tenant_id: tenant.id
    }, { transaction });

    // 6. Create Admin User
    const user = await User.create({
      name,
      email,
      password_hash: password,
      role_id: adminRole.id,
      tenant_id: tenant.id,
      is_active: true
    }, { transaction });

    // 7. Create Default Wallet Accounts
    await WalletAccount.create({
      name: 'Cash',
      currency: 'AED',
      description: 'Default Cash Account',
      tenant_id: tenant.id,
      balance: 0.00
    }, { transaction });

    await WalletAccount.create({
      name: 'Bank',
      currency: 'AED',
      description: 'Default Bank Account',
      tenant_id: tenant.id,
      balance: 0.00
    }, { transaction });

    // 8. Create Default System Configs
    const defaultConfig = [
      { key: 'business_name', value: companyName },
      { key: 'app_name', value: 'DocClear' },
      { key: 'app_logo', value: '' },
      { key: 'base_currency', value: 'AED' },
      { key: 'contact_email', value: email },
      { key: 'default_language', value: 'English' }
    ];

    for (const item of defaultConfig) {
      await SystemConfig.create({
        key: item.key,
        value: item.value,
        tenant_id: tenant.id
      }, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Tenant and Admin user created successfully. You can now log in.',
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (err) {
    await transaction.rollback();
    console.error('[Tenant Registration Error]', err);
    res.status(500).json({ success: false, message: 'Error registering tenant: ' + err.message });
  }
};
