const { Op } = require('sequelize');
const sequelize = require('../config/database');
const WalletAccount = require('../models/WalletAccount');
const WalletTransaction = require('../models/WalletTransaction');

/**
 * Helper: Compute credit card billing cycle dates
 * Logic: if bill_day < due_day => same month; if bill_day >= due_day => due is next month
 */
const getCreditCardCycleDates = (billDay, dueDay) => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  // Determine the most recent bill date (on or before today)
  let lastBillDate = new Date(currentYear, currentMonth, billDay);
  if (lastBillDate > today) {
    // Bill date hasn't arrived this month yet, use last month's
    lastBillDate = new Date(currentYear, currentMonth - 1, billDay);
  }

  // Next bill date
  let nextBillDate = new Date(lastBillDate);
  nextBillDate.setMonth(nextBillDate.getMonth() + 1);

  // Due date for the current billing cycle
  let currentDueDate;
  if (dueDay >= billDay) {
    // Due is in the same month as bill
    currentDueDate = new Date(lastBillDate.getFullYear(), lastBillDate.getMonth(), dueDay);
  } else {
    // Due is in the next month after bill
    currentDueDate = new Date(lastBillDate.getFullYear(), lastBillDate.getMonth() + 1, dueDay);
  }

  return {
    lastBillDate,
    nextBillDate,
    currentDueDate
  };
};

/**
 * Get all accounts with computed balance and credit card metrics
 */
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await WalletAccount.findAll({
      where: { is_active: true, tenant_id: req.user.tenant_id }
    });

    const accountsWithBalance = await Promise.all(accounts.map(async (account) => {
      const inSum = await WalletTransaction.sum('amount', {
        where: { account_id: account.id, direction: 'In', tenant_id: req.user.tenant_id }
      }) || 0;
      const outSum = await WalletTransaction.sum('amount', {
        where: { account_id: account.id, direction: 'Out', tenant_id: req.user.tenant_id }
      }) || 0;

      const balance = parseFloat(inSum) - parseFloat(outSum);
      const result = {
        ...account.toJSON(),
        balance
      };

      // Add credit card specific metrics
      if (account.account_type === 'Credit' && account.bill_day && account.due_day) {
        const { lastBillDate, nextBillDate, currentDueDate } = getCreditCardCycleDates(account.bill_day, account.due_day);
        
        const creditLimit = parseFloat(account.credit_limit || 0);
        // For credit cards, "outSum - inSum" = outstanding (money owed)
        const outstandingBalance = parseFloat(outSum) - parseFloat(inSum);
        const availableCredit = creditLimit - Math.max(0, outstandingBalance);

        // Billed: outflows before lastBillDate (gross purchases in that cycle)
        const billedOut = await WalletTransaction.sum('amount', {
          where: { 
            account_id: account.id, 
            direction: 'Out', 
            tenant_id: req.user.tenant_id,
            created_at: { [Op.lt]: lastBillDate }
          }
        }) || 0;
        // Unbilled: outflows after lastBillDate (current cycle spending)
        const unbilledOut = await WalletTransaction.sum('amount', {
          where: { 
            account_id: account.id, 
            direction: 'Out', 
            tenant_id: req.user.tenant_id,
            created_at: { [Op.gte]: lastBillDate }
          }
        }) || 0;
        // Total payments received (all time)
        const totalPaid = parseFloat(inSum);

        // Gross billed amount (total purchases before last bill date)
        const totalBilled = parseFloat(billedOut);
        // Apply all payments to billed debt first, including payments after billing.
        const paidTowardBill = Math.min(totalBilled, totalPaid);
        // Remaining due for the current bill
        const billedRemaining = Math.max(0, totalBilled - paidTowardBill);

        result.outstanding_balance = Math.max(0, outstandingBalance);
        result.available_credit = Math.max(0, availableCredit);
        result.credit_limit = creditLimit;
        // Gross bill breakdown
        result.total_billed = totalBilled;
        result.paid_toward_bill = paidTowardBill;
        result.billed_remaining = billedRemaining;
        // Net billed (for backward compat)
        result.billed_amount = billedRemaining;
        const paymentsBeyondBill = Math.max(0, totalPaid - totalBilled);
        result.unbilled_amount = Math.max(0, parseFloat(unbilledOut) - paymentsBeyondBill);
        // Total payments all time
        result.total_paid = totalPaid;
        // Dates
        result.last_bill_date = lastBillDate;
        result.next_bill_date = nextBillDate;
        result.current_due_date = currentDueDate;
        // Override balance for display: credit cards show outstanding as negative
        result.balance = -Math.max(0, outstandingBalance);
      }

      return result;
    }));

    res.json({ success: true, data: accountsWithBalance });
  } catch (err) {
    console.error('Get Accounts Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching accounts.' });
  }
};

/**
 * Get transaction history with filters
 */
exports.getTransactions = async (req, res) => {
  const { account_id, type, date_from, date_to, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const where = { tenant_id: req.user.tenant_id };
  if (account_id) where.account_id = account_id;
  if (type) where.type = type;
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
        const endDate = new Date(date_to);
        endDate.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = endDate;
    }
  }

  try {
    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      include: [{ model: WalletAccount, attributes: ['name', 'account_type'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      meta: {
        total: count,
        page: parseInt(page),
        last_page: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching transactions.' });
  }
};

/**
 * Handle manual transfer between accounts
 * Enforces credit limit for Credit card accounts
 */
exports.transfer = async (req, res) => {
  const { from_account_id, to_account_id, amount, description } = req.body;

  if (from_account_id === to_account_id) {
    return res.status(400).json({ success: false, message: 'Source and destination accounts must be different.' });
  }

  const t = await sequelize.transaction();

  try {
    const fromAcc = await WalletAccount.findOne({ where: { id: from_account_id, tenant_id: req.user.tenant_id } });
    const toAcc = await WalletAccount.findOne({ where: { id: to_account_id, tenant_id: req.user.tenant_id } });
    if (!fromAcc || !toAcc) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Invalid accounts.' });
    }

    // For Cash and Debit: verify sufficient balance
    if (fromAcc.account_type !== 'Credit') {
      const inSum = await WalletTransaction.sum('amount', {
        where: { account_id: from_account_id, direction: 'In' },
        transaction: t
      }) || 0;
      const outSum = await WalletTransaction.sum('amount', {
        where: { account_id: from_account_id, direction: 'Out' },
        transaction: t
      }) || 0;
      const currentBalance = parseFloat(inSum) - parseFloat(outSum);

      if (currentBalance < amount) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Insufficient balance in source account.' });
      }
    }

    // For Credit card as source (spending from credit): enforce credit limit
    if (fromAcc.account_type === 'Credit') {
      const inSum = await WalletTransaction.sum('amount', {
        where: { account_id: from_account_id, direction: 'In' },
        transaction: t
      }) || 0;
      const outSum = await WalletTransaction.sum('amount', {
        where: { account_id: from_account_id, direction: 'Out' },
        transaction: t
      }) || 0;
      const outstanding = parseFloat(outSum) - parseFloat(inSum);
      const creditLimit = parseFloat(fromAcc.credit_limit || 0);
      const availableCredit = creditLimit - Math.max(0, outstanding);

      if (amount > availableCredit) {
        await t.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Credit limit exceeded. Available credit: AED ${availableCredit.toFixed(2)}` 
        });
      }
    }

    // 1. Create Out transaction from source
    await WalletTransaction.create({
      account_id: from_account_id,
      type: 'Transfer',
      direction: 'Out',
      amount,
      description: `Transfer to ${toAcc.name}: ${description || ''}`,
      tenant_id: req.user.tenant_id
    }, { transaction: t });

    // Update from_account balance
    await WalletAccount.decrement('balance', {
      by: amount,
      where: { id: from_account_id },
      transaction: t
    });

    // 2. Create In transaction to destination
    await WalletTransaction.create({
      account_id: to_account_id,
      type: 'Transfer',
      direction: 'In',
      amount,
      description: `Transfer from ${fromAcc.name}: ${description || ''}`,
      tenant_id: req.user.tenant_id
    }, { transaction: t });

    // Update to_account balance
    await WalletAccount.increment('balance', {
      by: amount,
      where: { id: to_account_id },
      transaction: t
    });

    await t.commit();
    res.json({ success: true, message: 'Transfer completed successfully.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ success: false, message: 'Internal server error during transfer.' });
  }
};

/**
 * Get wallet summary
 */
exports.getSummary = async (req, res) => {
  try {
    // Get all active accounts to categorize
    const accounts = await WalletAccount.findAll({
      where: { is_active: true, tenant_id: req.user.tenant_id }
    });

    let cashTotal = 0;
    let debitTotal = 0;
    let creditOutstanding = 0;

    for (const account of accounts) {
      const inSum = await WalletTransaction.sum('amount', {
        where: { account_id: account.id, direction: 'In', tenant_id: req.user.tenant_id }
      }) || 0;
      const outSum = await WalletTransaction.sum('amount', {
        where: { account_id: account.id, direction: 'Out', tenant_id: req.user.tenant_id }
      }) || 0;

      const balance = parseFloat(inSum) - parseFloat(outSum);

      if (account.account_type === 'Cash') {
        cashTotal += balance;
      } else if (account.account_type === 'Debit') {
        debitTotal += balance;
      } else if (account.account_type === 'Credit') {
        // Outstanding = money owed (outSum - inSum)
        creditOutstanding += Math.max(0, parseFloat(outSum) - parseFloat(inSum));
      }
    }

    res.json({
      success: true,
      data: {
        cash_total: cashTotal,
        debit_total: debitTotal,
        credit_outstanding: creditOutstanding,
        total_balance: cashTotal + debitTotal,
        net_worth: cashTotal + debitTotal - creditOutstanding
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching summary.' });
  }
};

/**
 * Create a new wallet account
 */
exports.createAccount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, description, opening_balance, account_type, credit_limit, bill_day, due_day } = req.body;
    if (!name) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    
    const type = account_type || 'Cash';

    // Validate credit card fields
    if (type === 'Credit') {
      if (!credit_limit || parseFloat(credit_limit) <= 0) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Credit limit is required for credit cards' });
      }
      if (!bill_day || bill_day < 1 || bill_day > 31) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Valid billing day (1-31) is required for credit cards' });
      }
      if (!due_day || due_day < 1 || due_day > 31) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Valid due day (1-31) is required for credit cards' });
      }
    }

    const existing = await WalletAccount.findOne({ where: { name, tenant_id: req.user.tenant_id }, transaction: t });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Wallet name already exists' });
    }

    let balance = 0;
    if (type !== 'Credit' && opening_balance && parseFloat(opening_balance) > 0) {
      balance = parseFloat(opening_balance);
    }

    const account = await WalletAccount.create({ 
      name, 
      description, 
      balance, 
      account_type: type,
      credit_limit: type === 'Credit' ? parseFloat(credit_limit) : null,
      bill_day: type === 'Credit' ? parseInt(bill_day) : null,
      due_day: type === 'Credit' ? parseInt(due_day) : null,
      tenant_id: req.user.tenant_id 
    }, { transaction: t });
    
    if (balance > 0) {
      await WalletTransaction.create({
        account_id: account.id,
        type: 'Manual',
        direction: 'In',
        amount: balance,
        description: 'Opening Balance',
        tenant_id: req.user.tenant_id
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ success: true, data: { ...account.toJSON(), balance } });
  } catch (err) {
    await t.rollback();
    console.error('Error creating wallet account:', err);
    res.status(500).json({ success: false, message: 'Error creating wallet account.' });
  }
};

/**
 * Update wallet account
 */
exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, account_type, credit_limit, bill_day, due_day } = req.body;
    
    const account = await WalletAccount.findOne({ where: { id, tenant_id: req.user.tenant_id } });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    if (name && name !== account.name) {
      const existing = await WalletAccount.findOne({ where: { name, tenant_id: req.user.tenant_id } });
      if (existing) return res.status(400).json({ success: false, message: 'Wallet name already exists' });
    }

    const newType = account_type || account.account_type;

    // Validate credit card fields if type is Credit
    if (newType === 'Credit') {
      const newLimit = credit_limit !== undefined ? credit_limit : account.credit_limit;
      const newBillDay = bill_day !== undefined ? bill_day : account.bill_day;
      const newDueDay = due_day !== undefined ? due_day : account.due_day;

      if (!newLimit || parseFloat(newLimit) <= 0) {
        return res.status(400).json({ success: false, message: 'Credit limit is required for credit cards' });
      }
      if (!newBillDay || newBillDay < 1 || newBillDay > 31) {
        return res.status(400).json({ success: false, message: 'Valid billing day (1-31) is required' });
      }
      if (!newDueDay || newDueDay < 1 || newDueDay > 31) {
        return res.status(400).json({ success: false, message: 'Valid due day (1-31) is required' });
      }
    }

    await account.update({ 
      name: name || account.name, 
      description: description !== undefined ? description : account.description,
      account_type: newType,
      credit_limit: newType === 'Credit' ? (credit_limit !== undefined ? parseFloat(credit_limit) : account.credit_limit) : null,
      bill_day: newType === 'Credit' ? (bill_day !== undefined ? parseInt(bill_day) : account.bill_day) : null,
      due_day: newType === 'Credit' ? (due_day !== undefined ? parseInt(due_day) : account.due_day) : null
    });
    
    res.json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating wallet account.' });
  }
};

/**
 * Check credit limit before an expense or invoice deduction
 * Exported for use as a utility by other controllers
 */
exports.checkCreditAvailability = async (accountId, amount, transaction) => {
  const account = await WalletAccount.findByPk(accountId, { transaction });
  if (!account || account.account_type !== 'Credit') return { allowed: true };

  const inSum = await WalletTransaction.sum('amount', {
    where: { account_id: accountId, direction: 'In' },
    transaction
  }) || 0;
  const outSum = await WalletTransaction.sum('amount', {
    where: { account_id: accountId, direction: 'Out' },
    transaction
  }) || 0;

  const outstanding = parseFloat(outSum) - parseFloat(inSum);
  const creditLimit = parseFloat(account.credit_limit || 0);
  const availableCredit = creditLimit - Math.max(0, outstanding);

  if (amount > availableCredit) {
    return { 
      allowed: false, 
      message: `Credit limit exceeded. Available credit: AED ${availableCredit.toFixed(2)} of AED ${creditLimit.toFixed(2)} limit.`
    };
  }
  return { allowed: true, availableCredit };
};
