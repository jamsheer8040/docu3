const jwt = require('jsonwebtoken');
const { User, Role, Customer, Tenant, Plan } = require('../models');
const tenantContext = require('../utils/tenantContext');
const recordContext = require('../utils/recordAccessContext');
const { actionScope } = require('../utils/permissionRules');

/**
 * Middleware to verify JWT token (Alias: protect)
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.'
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'docclear_production_jwt_secret_key_change_me';
    const decoded = jwt.verify(token, secret);

    const user = await User.findByPk(decoded.id, {
      include: [
        { model: Role, attributes: ['name', 'permissions', 'type', 'dashboard_template_id'] },
        { model: Customer, as: 'LinkedCustomers', attributes: ['id', 'name'] },
        { 
          model: Tenant, 
          attributes: ['id', 'name', 'status', 'subscription_ends_at', 'subscription_starts_at', 'trial_ends_at', 'billing_cycle', 'next_billing_date'],
          include: [{ model: Plan }]
        }
      ]
    });

    if (!user || !user.is_active || !user.can_login) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user.'
      });
    }

    if (user.tenant_id) {
      if (!user.Tenant) {
        return res.status(401).json({
          success: false,
          message: 'Organization not found or inactive.'
        });
      }

      const tenantStatus = user.Tenant.status;
      if (['suspended', 'cancelled'].includes(tenantStatus)) {
        return res.status(403).json({
          success: false,
          message: 'Your organization has been suspended or cancelled. Please contact support.'
        });
      }

      if (['new_registration', 'trial_expired', 'expired'].includes(tenantStatus) && req.method !== 'GET') {
        return res.status(403).json({
          success: false,
          message: 'Your organization subscription is not active. Transactions are currently blocked.'
        });
      }

      req.tenantId = user.tenant_id;
    } else {
      req.tenantId = null; // Global/Super Admin
    }

    req.user = user;
    const json = res.json.bind(res);
    res.json = body => json(require('../utils/recordAccess').sanitizeResponse(body));

    // Wrap subsequent execution in tenant context
    tenantContext.run(req.tenantId, () => {
      recordContext.run({ user }, () => next());
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token is not valid.'
    });
  }
};

exports.protect = exports.verifyToken;

/**
 * Middleware to optionally verify JWT token. 
 * If no token is provided, it just calls next().
 * If token is invalid, it just calls next().
 */
exports.optionalVerifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'docclear_production_jwt_secret_key_change_me';
    const decoded = jwt.verify(token, secret);

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

    if (user && user.is_active) {
      req.user = user;
    }
    next();
  } catch (err) {
    next(); // Proceed as anonymous
  }
};

/**
 * Middleware to restrict access by permission (e.g., 'invoices.write')
 */
exports.requirePermission = (moduleName, accessType = 'read') => {
  return (req, res, next) => {
    if (!req.user || !req.user.Role) {
      return res.status(403).json({ success: false, message: 'Access denied. No role assigned.' });
    }

    const path = req.route?.path || '';
    const creates = req.method === 'POST' && !req.params.id &&
      ['/', '/orders', '/cvs', '/accounts', '/shareholders', '/capital-transactions', '/dividends', '/bulk-import', '/book'].includes(path);
    const action = req.method === 'DELETE' ? 'delete' : accessType === 'read' ? ((req.params.id || req.params.itemId) ? 'detail' : 'list') :
      accessType === 'write' ? (creates ? 'create' : 'edit') : accessType;
    const scope = actionScope(req.user, moduleName, action);
    if (scope === true || (typeof scope === 'string' && scope !== 'none')) {
      const state = recordContext.getStore();
      if (state) { state.module = moduleName; state.action = action; }
      return next();
    }
    return res.status(403).json({ success: false, message: `Access denied. Insufficient permissions for ${moduleName}.${action}` });
  };
};

/**
 * Middleware to restrict access by role name (Backward compatibility)
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.Role || !roles.includes(req.user.Role.name)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

/**
 * Middleware to restrict access to Super Admins (tenant_id = null)
 */
exports.requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.tenant_id !== null) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super Admin privileges required.'
    });
  }
  next();
};
