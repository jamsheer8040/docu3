const { Supplier, SupplierPurchase, SupplierPayment, WalletAccount, WalletTransaction } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

exports.downloadStatement = async (req, res, next) => {
  try {
    const format = req.params.format;
    if (!['xlsx', 'pdf'].includes(format)) return res.status(400).json({ success: false, message: 'Choose Excel or PDF' });
    const tenant_id = req.user.tenant_id;
    const supplier = await Supplier.findOne({ where: { id: req.params.id, tenant_id } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    const where = { supplier_id: supplier.id, tenant_id };
    const [purchases, payments] = await Promise.all([
      SupplierPurchase.findAll({ where }),
      SupplierPayment.findAll({ where, include: [{ model: WalletAccount, attributes: ['name'], required: false, where: { tenant_id } }] })
    ]);
    const { supplierStatement, statementPeriod } = await import('../utils/supplierStatement.mjs');
    const rows = supplierStatement(purchases.map(row => row.toJSON()), payments.map(row => row.toJSON()));
    let period;
    try { period = statementPeriod(rows, req.query.from ?? '', req.query.to ?? ''); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const exporter = require('../utils/supplierStatementExport');
    const buffer = await exporter[format === 'xlsx' ? 'excel' : 'pdf'](supplier, period.rows, period);
    res.type(format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="supplier-${supplier.id}-statement.${format}"`);
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) { next(error); }
};

// Allowed fields for create/update (prevents mass-assignment)
const SUPPLIER_ALLOWED_FIELDS = ['name', 'contact_person', 'email', 'phone', 'address', 'notes', 'is_active'];

exports.getPurchases = async (req, res, next) => {
  try {
    const purchases = await SupplierPurchase.findAll({
      where: { tenant_id: req.user.tenant_id },
      include: [{ model: Supplier, attributes: ['id', 'name'], required: true, where: { tenant_id: req.user.tenant_id } }],
      order: [['created_at', 'DESC'], ['id', 'DESC']]
    });
    res.json({ success: true, data: purchases });
  } catch (err) { next(err); }
};

exports.getSuppliers = async (req, res, next) => {
  try {
    const tenant_id = req.user.tenant_id;
    // Aggregate independently so multiple bills and payments cannot multiply totals.
    const [suppliers, purchases, payments] = await Promise.all([
      Supplier.findAll({ where: { tenant_id }, order: [['created_at', 'DESC']] }),
      SupplierPurchase.findAll({ where: { tenant_id }, attributes: ['supplier_id', [sequelize.fn('SUM', sequelize.col('amount')), 'total']], group: ['supplier_id'], raw: true }),
      SupplierPayment.findAll({ where: { tenant_id }, attributes: ['supplier_id', [sequelize.fn('SUM', sequelize.col('amount')), 'total']], group: ['supplier_id'], raw: true })
    ]);
    const purchaseTotals = new Map(purchases.map(row => [row.supplier_id, Number(row.total || 0)]));
    const paymentTotals = new Map(payments.map(row => [row.supplier_id, Number(row.total || 0)]));
    const data = suppliers.map(supplier => {
      const total_amount = purchaseTotals.get(supplier.id) || 0;
      const paid = paymentTotals.get(supplier.id) || 0;
      return { ...supplier.toJSON(), total_amount, paid, balance: Number((total_amount - paid).toFixed(2)) };
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id }
    });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    // Whitelist allowed fields — prevents mass-assignment of id, tenant_id, etc.
    const safeData = {};
    for (const field of SUPPLIER_ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) safeData[field] = req.body[field];
    }

    if (!safeData.name || !safeData.name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const supplier = await Supplier.create({
      ...safeData,
      tenant_id: req.user.tenant_id
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'A supplier with this email already exists' });
    }
    next(err);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id }
    });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    // Whitelist allowed fields — prevents tenant_id or id overwrite
    const safeData = {};
    for (const field of SUPPLIER_ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) safeData[field] = req.body[field];
    }

    await supplier.update(safeData);
    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id }
    });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    // Block hard-delete if purchases exist; caller should deactivate instead
    const count = await SupplierPurchase.count({ where: { supplier_id: supplier.id } });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a supplier with existing purchases. Deactivate the supplier instead.'
      });
    }

    await supplier.destroy();
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getSupplierPurchases = async (req, res, next) => {
  try {
    const purchases = await SupplierPurchase.findAll({
      where: { supplier_id: req.params.id, tenant_id: req.user.tenant_id },
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: purchases });
  } catch (err) {
    next(err);
  }
};

exports.getSupplierPayments = async (req, res, next) => {
  try {
    const payments = await SupplierPayment.findAll({
      where: { supplier_id: req.params.id, tenant_id: req.user.tenant_id },
      include: [{ model: WalletAccount, attributes: ['id', 'name'] }],
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']]
    });
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
};

exports.makePayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const supplier_id = parseInt(req.params.id, 10);
    if (isNaN(supplier_id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid supplier ID' });
    }

    const { purchase_id, wallet_id, payment_date, reference } = req.body;
    const amount = req.body.amount;

    // --- Input Validation ---
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid payment amount. Must be a positive number.' });
    }

    if (!wallet_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Wallet is required' });
    }

    if (!payment_date) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Payment date is required' });
    }

    // --- Resolve Entities ---
    const supplier = await Supplier.findOne({
      where: { id: supplier_id, tenant_id: req.user.tenant_id },
      transaction
    });
    if (!supplier) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // purchase_id is optional — allows freeform payments not linked to a specific purchase
    let purchase = null;
    if (purchase_id) {
      purchase = await SupplierPurchase.findOne({
        where: { id: purchase_id, supplier_id, tenant_id: req.user.tenant_id },
        transaction
      });
      if (!purchase) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Purchase record not found for this supplier' });
      }

      // Overpayment guard — only when linked to a specific purchase
      const remainingBalance = parseFloat(purchase.amount) - parseFloat(purchase.paid_amount);
      if (paymentAmount > remainingBalance + 0.001) { // tiny float tolerance
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Payment amount (${paymentAmount}) exceeds the remaining balance (${remainingBalance.toFixed(2)})`
        });
      }
    }

    const wallet = await WalletAccount.findOne({
      where: { id: wallet_id, tenant_id: req.user.tenant_id },
      transaction,
      lock: true  // row-level lock to prevent concurrent double-spend
    });
    if (!wallet) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Wallet account not found' });
    }

    // --- Wallet Balance Check (for non-credit accounts) ---
    if (wallet.account_type !== 'Credit') {
      const currentBalance = parseFloat(wallet.balance);
      if (currentBalance < paymentAmount) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. Available: ${currentBalance.toFixed(2)}, Required: ${paymentAmount.toFixed(2)}`
        });
      }
    }

    // --- Create Payment Record ---
    const payment = await SupplierPayment.create({
      tenant_id: req.user.tenant_id,
      supplier_id,
      purchase_id: purchase_id || null,
      wallet_id,
      amount: paymentAmount,
      payment_date: payment_date || new Date(),
      reference: reference ? String(reference).substring(0, 100) : null
    }, { transaction });

    // --- Update Purchase Status (only if linked) ---
    if (purchase) {
      const newPaidAmount = parseFloat(purchase.paid_amount) + paymentAmount;
      let newStatus = 'Partially Paid';
      if (newPaidAmount >= parseFloat(purchase.amount) - 0.001) {
        newStatus = 'Paid';
      }
      await purchase.update({ paid_amount: newPaidAmount, status: newStatus }, { transaction });
    }

    // --- Compute new balance for audit trail ---
    const balanceAfter = parseFloat(wallet.balance) - paymentAmount;

    // --- Create Wallet Transaction with balance_after snapshot ---
    await WalletTransaction.create({
      tenant_id: req.user.tenant_id,
      account_id: wallet_id,
      type: 'Expense',
      direction: 'Out',
      amount: paymentAmount,
      balance_after: balanceAfter,
      reference_id: payment.id,
      reference_type: 'SupplierPayment',
      description: `Payment to Supplier: ${supplier.name}${purchase ? ` for Purchase #${purchase.id}` : ''}`
    }, { transaction });

    // --- Decrement Wallet Balance ---
    await wallet.decrement('balance', { by: paymentAmount, transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Payment recorded successfully', data: payment });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

