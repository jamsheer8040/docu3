const { internalRead } = require('../utils/recordAccess');
const { User, Customer, Document, WalletAccount } = require('../models');

exports.checkUserLimit = async (req, res, next) => {
  if (!req.tenantId) return next();

  // Non-login staff (drivers, field staff, etc.) do not consume login user seats
  if (req.body.can_login === false || req.body.can_login === 'false') {
    return next();
  }

  const plan = req.user?.Tenant?.Plan;
  if (!plan) return next();

  if (plan.max_users !== null && plan.max_users > -1) {
    try {
      const count = await internalRead(() => User.count({ where: { tenant_id: req.tenantId, can_login: true } }));
      if (count >= plan.max_users) {
        return res.status(403).json({
          success: false,
          message: `Plan limit reached. You can create a maximum of ${plan.max_users} login users on your current plan. Non-login staff can still be added.`
        });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error checking plan limits.' });
    }
  }
  next();
};

exports.checkCustomerLimit = async (req, res, next) => {
  if (!req.tenantId) return next();

  const plan = req.user?.Tenant?.Plan;
  if (!plan) return next();

  if (plan.max_customers !== null && plan.max_customers > -1) {
    try {
      const count = await internalRead(() => Customer.count({ where: { tenant_id: req.tenantId } }));
      if (count >= plan.max_customers) {
        return res.status(403).json({
          success: false,
          message: `Plan limit reached. You can create a maximum of ${plan.max_customers} customers on your current plan. Please upgrade to add more.`
        });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error checking plan limits.' });
    }
  }
  next();
};

exports.checkDocumentLimit = async (req, res, next) => {
  if (!req.tenantId) return next();

  const plan = req.user?.Tenant?.Plan;
  if (!plan) return next();

  if (plan.max_documents !== null && plan.max_documents > -1) {
    try {
      const count = await internalRead(() => Document.count({ where: { tenant_id: req.tenantId } }));
      if (count >= plan.max_documents) {
        return res.status(403).json({
          success: false,
          message: `Plan limit reached. You can track a maximum of ${plan.max_documents} documents on your current plan. Please upgrade to add more.`
        });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error checking plan limits.' });
    }
  }
  next();
};

exports.checkWalletLimit = async (req, res, next) => {
  if (!req.tenantId) return next();

  const plan = req.user?.Tenant?.Plan;
  if (!plan) return next();

  if (plan.max_wallet_accounts !== null && plan.max_wallet_accounts > -1) {
    try {
      const count = await internalRead(() => WalletAccount.count({ where: { tenant_id: req.tenantId } }));
      if (count >= plan.max_wallet_accounts) {
        return res.status(403).json({
          success: false,
          message: `Plan limit reached. You can create a maximum of ${plan.max_wallet_accounts} wallet/bank accounts on your current plan. Please upgrade to add more.`
        });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error checking plan limits.' });
    }
  }
  next();
};
