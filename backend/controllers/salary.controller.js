const { 
  SalaryPayroll, SalaryItem, SalaryPayment, 
  User, Role, Tenant, WalletAccount, WalletTransaction, Expense, sequelize 
} = require('../models');
const { Op } = require('sequelize');

// Serialize payroll writes per tenant before taking any snapshot reads. This
// covers single/batch payments and cancellation, including different wallets.
async function lockPayrollTenant(tenantId, transaction) {
  const tenant = await Tenant.findOne({
    where: { id: tenantId }, transaction, lock: transaction.LOCK.UPDATE
  });
  if (!tenant) throw new Error('Payroll requires an organization');
}

function validPaymentAmount(amount) {
  return (typeof amount === 'number' || typeof amount === 'string') &&
    /^\d+(\.\d{1,2})?$/.test(String(amount)) &&
    Number.isFinite(Number(amount)) && Number(amount) > 0;
}

/**
 * Helper to compute last day of a month (YYYY-MM)
 */
function getLastDayOfMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  // Month is 1-indexed, day 0 of next month is last day of current month
  const lastDay = new Date(Date.UTC(year, month, 0));
  return lastDay.toISOString().split('T')[0];
}

/**
 * Get Separate Expense Summary (Operational vs Salary vs Combined)
 */
exports.getSummary = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { month } = req.query;

    const expenseWhere = { tenant_id: tenantId };
    const payrollWhere = { tenant_id: tenantId };

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split('-').map(Number);
      const startOfMonth = new Date(year, m - 1, 1);
      const endOfMonth = new Date(year, m, 0, 23, 59, 59, 999);

      expenseWhere.created_at = { [Op.between]: [startOfMonth, endOfMonth] };
      payrollWhere.month = month;
    }

    // 1. Operational Expenses Totals
    const opTotal = parseFloat(await Expense.sum('amount', { where: expenseWhere }) || 0);
    const opPaid = parseFloat(await Expense.sum('paid_amount', { where: expenseWhere }) || 0);
    const opPending = Math.max(0, opTotal - opPaid);

    // 2. Salary & Payroll Totals
    const salaryTotal = parseFloat(await SalaryPayroll.sum('total_amount', { where: payrollWhere }) || 0);
    const salaryPaid = parseFloat(await SalaryPayroll.sum('paid_amount', { where: payrollWhere }) || 0);
    const salaryPending = Math.max(0, salaryTotal - salaryPaid);

    // 3. Combined Grand Totals
    const combinedTotal = opTotal + salaryTotal;
    const combinedPaid = opPaid + salaryPaid;
    const combinedPending = opPending + salaryPending;

    res.json({
      success: true,
      data: {
        operational: {
          total: opTotal,
          paid: opPaid,
          pending: opPending
        },
        salary: {
          total: salaryTotal,
          paid: salaryPaid,
          pending: salaryPending
        },
        combined: {
          total: combinedTotal,
          paid: combinedPaid,
          pending: combinedPending
        }
      }
    });
  } catch (err) {
    console.error('Error in getSummary:', err);
    res.status(err.status || 500).json({ success: false, message: err.status === 403 ? err.message : 'Failed to fetch expense summary' });
  }
};

/**
 * Get Payroll for a Specific Month (or Preview if Not Booked)
 */
exports.getMonthPayroll = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { month } = req.params;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Expected YYYY-MM.' });
    }

    const payroll = await SalaryPayroll.findOne({
      where: { tenant_id: tenantId, month },
      include: [
        {
          model: SalaryItem,
          as: 'Items',
          include: [
            {
              model: User,
              as: 'Staff',
              attributes: ['id', 'name', 'email', 'avatar', 'designation', 'phone']
            },
            {
              model: WalletAccount,
              as: 'Account',
              attributes: ['id', 'name', 'account_type']
            },
            {
              model: SalaryPayment,
              as: 'Payments',
              include: [{ model: WalletAccount, as: 'Account', attributes: ['id', 'name', 'account_type'] }]
            }
          ]
        }
      ],
      order: [[{ model: SalaryItem, as: 'Items' }, 'id', 'ASC']]
    });

    if (payroll) {
      return res.json({
        success: true,
        isBooked: true,
        payroll
      });
    }

    // Not booked yet: Return preview of active staff salaries
    const suggestedBookingDate = getLastDayOfMonth(month);
    const [year, m] = month.split('-').map(Number);
    const daysInMonth = new Date(year, m, 0).getDate();

    const activeStaff = await User.findAll({
      where: {
        tenant_id: tenantId,
        is_active: true
      },
      include: [
        {
          model: Role,
          attributes: ['name'],
          where: { name: { [Op.ne]: 'Developer' } },
          required: false
        }
      ],
      attributes: ['id', 'name', 'email', 'avatar', 'designation', 'phone', 'basic_salary', 'hr_allowance', 'other_allowances', 'total_salary'],
      order: [['name', 'ASC']]
    });

    const staffPreview = activeStaff.map(staff => {
      const basic = parseFloat(staff.basic_salary) || 0;
      const hr = parseFloat(staff.hr_allowance) || 0;
      const other = parseFloat(staff.other_allowances) || 0;
      const total = parseFloat(staff.total_salary) || (basic + hr + other);
      const dailyRate = daysInMonth > 0 ? parseFloat((total / daysInMonth).toFixed(2)) : 0;

      return {
        user_id: staff.id,
        Staff: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          avatar: staff.avatar,
          designation: staff.designation,
          phone: staff.phone
        },
        basic_salary: basic,
        hr_allowance: hr,
        other_allowances: other,
        base_salary: total,
        leave_days: 0,
        daily_rate: dailyRate,
        leave_deduction: 0.00,
        deductions: 0.00,
        bonus: 0.00,
        net_salary: total,
        paid_amount: 0.00,
        status: 'Unpaid'
      };
    });

    const estimatedTotal = staffPreview.reduce((sum, item) => sum + item.net_salary, 0);

    return res.json({
      success: true,
      isBooked: false,
      month,
      daysInMonth,
      suggestedBookingDate,
      estimatedTotal,
      staffPreview
    });
  } catch (err) {
    console.error('Error in getMonthPayroll:', err);
    res.status(err.status || 500).json({ success: false, message: err.status === 403 ? err.message : 'Failed to fetch month payroll' });
  }
};

/**
 * Book Monthly Salary
 */
exports.bookMonthSalary = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const tenantId = req.user.tenant_id;
    await lockPayrollTenant(tenantId, transaction);
    const { month, booking_date, notes, items } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Valid month in YYYY-MM format is required' });
    }

    const existing = await SalaryPayroll.findOne({
      where: { tenant_id: tenantId, month },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Payroll for ${month} is already booked.` });
    }

    const finalBookingDate = booking_date || getLastDayOfMonth(month);
    const [year, m] = month.split('-').map(Number);
    const daysInMonth = new Date(year, m, 0).getDate();

    let salaryItemsData = items;

    // If items not provided explicitly, pull all active staff with salary
    if (!salaryItemsData || !Array.isArray(salaryItemsData) || salaryItemsData.length === 0) {
      const activeStaff = await User.findAll({
        where: { tenant_id: tenantId, is_active: true },
        attributes: ['id', 'basic_salary', 'hr_allowance', 'other_allowances', 'total_salary'],
        transaction
      });

      salaryItemsData = activeStaff.map(staff => {
        const basic = parseFloat(staff.basic_salary) || 0;
        const hr = parseFloat(staff.hr_allowance) || 0;
        const other = parseFloat(staff.other_allowances) || 0;
        const total = parseFloat(staff.total_salary) || (basic + hr + other);

        return {
          user_id: staff.id,
          basic_salary: basic,
          hr_allowance: hr,
          other_allowances: other,
          base_salary: total,
          leave_days: 0,
          deductions: 0,
          bonus: 0,
          net_salary: total,
          paid_amount: 0,
          status: 'Unpaid'
        };
      });
    }

    let payrollTotal = 0;
    const preparedItems = salaryItemsData.map(item => {
      const basic = parseFloat(item.basic_salary) || 0;
      const hr = parseFloat(item.hr_allowance) || 0;
      const other = parseFloat(item.other_allowances) || 0;
      const baseSalary = (item.base_salary !== undefined && item.base_salary !== null)
        ? parseFloat(item.base_salary)
        : (basic + hr + other || parseFloat(item.net_salary) || 0);

      const leaveDays = parseFloat(item.leave_days) || 0;
      const dailyRate = daysInMonth > 0 ? (baseSalary / daysInMonth) : 0;
      const leaveDeduction = parseFloat((leaveDays * dailyRate).toFixed(2));
      const otherDeductions = parseFloat(item.deductions) || 0;
      const bonus = parseFloat(item.bonus) || 0;

      const net = (item.net_salary !== undefined && item.net_salary !== null && item.leave_days === undefined)
        ? parseFloat(item.net_salary)
        : Math.max(0, parseFloat((baseSalary - leaveDeduction - otherDeductions + bonus).toFixed(2)));

      payrollTotal += net;

      return {
        tenant_id: tenantId,
        user_id: item.user_id,
        basic_salary: basic,
        hr_allowance: hr,
        other_allowances: other,
        leave_days: leaveDays,
        daily_rate: parseFloat(dailyRate.toFixed(2)),
        leave_deduction: leaveDeduction,
        deductions: otherDeductions,
        bonus,
        net_salary: net,
        paid_amount: 0,
        status: 'Unpaid',
        notes: item.notes || null
      };
    });

    const payroll = await SalaryPayroll.create({
      tenant_id: tenantId,
      month,
      booking_date: finalBookingDate,
      total_amount: payrollTotal,
      paid_amount: 0,
      status: 'Booked',
      notes,
      created_by: req.user.id
    }, { transaction });

    for (const item of preparedItems) {
      item.payroll_id = payroll.id;
      await SalaryItem.create(item, { transaction });
    }

    await transaction.commit();

    // Fetch complete payroll object to return
    const createdPayroll = await SalaryPayroll.findOne({
      where: { id: payroll.id },
      include: [
        {
          model: SalaryItem,
          as: 'Items',
          include: [
            {
              model: User,
              as: 'Staff',
              attributes: ['id', 'name', 'email', 'avatar', 'designation', 'phone']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: `Salary for ${month} booked successfully on ${finalBookingDate}`,
      payroll: createdPayroll
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in bookMonthSalary:', err);
    res.status(err.status || 500).json({ success: false, message: err.status === 403 ? err.message : 'Failed to book salary' });
  }
};

/**
 * Pay Single Staff Salary (Full or Partial)
 */
exports.paySingleSalary = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const tenantId = req.user.tenant_id;
    await lockPayrollTenant(tenantId, transaction);
    const { salary_item_id, account_id, amount, payment_date, payment_method = 'Bank Transfer', notes } = req.body;

    if (amount !== undefined && !validPaymentAmount(amount)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Payment amount must be a positive number with at most two decimal places' });
    }

    if (!salary_item_id || !account_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Salary Item and Bank/Wallet Account are required' });
    }

    const item = await SalaryItem.findOne({
      where: { id: salary_item_id, tenant_id: tenantId },
      include: [
        { model: SalaryPayroll, as: 'Payroll' },
        { model: User, as: 'Staff', attributes: ['id', 'name'] }
      ],
      transaction
    });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Salary item not found' });
    }

    if (item.status === 'Paid') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'This staff salary is already fully paid' });
    }

    const account = await WalletAccount.findOne({
      where: { id: account_id, tenant_id: tenantId },
      transaction
    });

    if (!account) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Payment account not found' });
    }

    const netSalary = parseFloat(item.net_salary);
    const alreadyPaid = parseFloat(item.paid_amount || 0);
    const pendingBalance = Math.max(0, netSalary - alreadyPaid);

    const payAmount = amount === undefined ? pendingBalance : Number(amount);

    if (payAmount > pendingBalance) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Payment exceeds the remaining salary balance' });
    }

    if (payAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }

    // 1. Create Wallet Transaction
    const walletTx = await WalletTransaction.create({
      account_id: account.id,
      type: 'Expense',
      direction: 'Out',
      amount: payAmount,
      reference_id: item.id,
      reference_type: 'SalaryPayment',
      description: `Salary: ${item.Staff?.name || 'Staff'} (${item.Payroll?.month || ''})`,
      tenant_id: tenantId
    }, { transaction });

    // 2. Decrement Wallet Balance
    await WalletAccount.decrement('balance', {
      by: payAmount,
      where: { id: account.id, tenant_id: tenantId },
      transaction
    });

    // 3. Create Salary Payment Record
    const paymentRecord = await SalaryPayment.create({
      salary_item_id: item.id,
      tenant_id: tenantId,
      account_id: account.id,
      amount: payAmount,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      payment_method,
      transaction_id: walletTx.id,
      notes
    }, { transaction });

    // 4. Update Salary Item
    const updatedPaid = alreadyPaid + payAmount;
    const finalItemStatus = updatedPaid >= netSalary ? 'Paid' : 'Partially Paid';

    await item.update({
      paid_amount: updatedPaid,
      status: finalItemStatus,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      account_id: account.id
    }, { transaction });

    // 5. Update Payroll Overall Totals & Status
    const payroll = await SalaryPayroll.findOne({
      where: { id: item.payroll_id, tenant_id: tenantId },
      include: [{ model: SalaryItem, as: 'Items' }],
      transaction
    });

    const newPayrollPaid = payroll.Items.reduce((sum, it) => {
      return sum + (it.id === item.id ? updatedPaid : parseFloat(it.paid_amount || 0));
    }, 0);

    const allPaid = payroll.Items.every(it => {
      const itPaid = it.id === item.id ? updatedPaid : parseFloat(it.paid_amount || 0);
      return itPaid >= parseFloat(it.net_salary);
    });

    const anyPaid = newPayrollPaid > 0;

    await payroll.update({
      paid_amount: newPayrollPaid,
      status: allPaid ? 'Paid' : (anyPaid ? 'Partially Paid' : 'Booked')
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Payment of AED ${payAmount.toLocaleString()} recorded for ${item.Staff?.name}`,
      data: {
        payment: paymentRecord,
        status: finalItemStatus,
        paid_amount: updatedPaid,
        pending_amount: Math.max(0, netSalary - updatedPaid)
      }
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in paySingleSalary:', err);
    res.status(err.status || 500).json({ success: false, message: err.status === 403 ? err.message : 'Failed to process salary payment' });
  }
};

/**
 * Pay Batch / Multiple Salaries (or Select All)
 */
exports.payBatchSalary = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const tenantId = req.user.tenant_id;
    await lockPayrollTenant(tenantId, transaction);
    const { salary_item_ids, account_id, payment_date, payment_method = 'Bank Transfer', notes } = req.body;

    if (!Array.isArray(salary_item_ids) || salary_item_ids.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'No salary items selected for payment' });
    }

    if (!account_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Bank/Wallet Account is required' });
    }

    const account = await WalletAccount.findOne({
      where: { id: account_id, tenant_id: tenantId },
      transaction
    });

    if (!account) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Selected bank/wallet account not found' });
    }

    const items = await SalaryItem.findAll({
      where: {
        id: { [Op.in]: salary_item_ids },
        tenant_id: tenantId,
        status: { [Op.ne]: 'Paid' }
      },
      include: [
        { model: SalaryPayroll, as: 'Payroll' },
        { model: User, as: 'Staff', attributes: ['id', 'name'] }
      ],
      transaction
    });

    if (items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'None of the selected items require payment' });
    }

    const txDate = payment_date || new Date().toISOString().split('T')[0];
    let totalBatchDisbursed = 0;
    const payrollIdsToUpdate = new Set();

    for (const item of items) {
      const net = parseFloat(item.net_salary);
      const paid = parseFloat(item.paid_amount || 0);
      const pending = Math.max(0, net - paid);

      if (pending <= 0) continue;

      totalBatchDisbursed += pending;
      payrollIdsToUpdate.add(item.payroll_id);

      // Create Wallet Transaction per staff for individual transaction ledger
      const walletTx = await WalletTransaction.create({
        account_id: account.id,
        type: 'Expense',
        direction: 'Out',
        amount: pending,
        reference_id: item.id,
        reference_type: 'SalaryPayment',
        description: `Salary: ${item.Staff?.name || 'Staff'} (${item.Payroll?.month || ''})`,
        tenant_id: tenantId
      }, { transaction });

      // Create Salary Payment
      await SalaryPayment.create({
        salary_item_id: item.id,
        tenant_id: tenantId,
        account_id: account.id,
        amount: pending,
        payment_date: txDate,
        payment_method,
        transaction_id: walletTx.id,
        notes: notes || 'Batch salary payment'
      }, { transaction });

      // Update Salary Item
      await item.update({
        paid_amount: net,
        status: 'Paid',
        payment_date: txDate,
        account_id: account.id
      }, { transaction });
    }

    // Decrement wallet balance in one go
    if (totalBatchDisbursed > 0) {
      await WalletAccount.decrement('balance', {
        by: totalBatchDisbursed,
        where: { id: account.id, tenant_id: tenantId },
        transaction
      });
    }

    // Update affected Payrolls
    for (const pId of payrollIdsToUpdate) {
      const payroll = await SalaryPayroll.findOne({
        where: { id: pId, tenant_id: tenantId },
        include: [{ model: SalaryItem, as: 'Items' }],
        transaction
      });

      const totalPaid = payroll.Items.reduce((sum, it) => sum + parseFloat(it.paid_amount || 0), 0);
      const allPaid = payroll.Items.every(it => parseFloat(it.paid_amount || 0) >= parseFloat(it.net_salary));

      await payroll.update({
        paid_amount: totalPaid,
        status: allPaid ? 'Paid' : 'Partially Paid'
      }, { transaction });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `Batch transfer completed: AED ${totalBatchDisbursed.toLocaleString()} disbursed for ${items.length} staff member(s)`,
      count: items.length,
      total_amount: totalBatchDisbursed
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in payBatchSalary:', err);
    res.status(err.status || 500).json({ success: false, message: err.status === 403 ? err.message : 'Failed to process batch salary payment' });
  }
};

/**
 * Unbook / Delete a Month's Payroll (Only if No Payments Disbursed)
 */
exports.unbookMonthSalary = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const tenantId = req.user.tenant_id;
    await lockPayrollTenant(tenantId, transaction);
    const { month } = req.params;

    const payroll = await SalaryPayroll.findOne({
      where: { tenant_id: tenantId, month },
      include: [{ model: SalaryItem, as: 'Items' }],
      transaction
    });

    if (!payroll) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Payroll for this month not found' });
    }

    if (parseFloat(payroll.paid_amount || 0) > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot unbook a payroll that has disbursed payments. Revert payments first.'
      });
    }

    await payroll.destroy({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: `Payroll for ${month} unbooked successfully`
    });
  } catch (err) {
    console.error('Error in unbookMonthSalary:', err);
    if (!transaction.finished) await transaction.rollback();
    res.status(err.status || 500).json({ success: false, message: err.status === 403 ? err.message : 'Failed to unbook salary' });
  }
};

/**
 * Get Payment History for a Salary Item
 */
exports.getStaffPaymentHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const payments = await SalaryPayment.findAll({
      where: { salary_item_id: id, tenant_id: tenantId },
      include: [
        {
          model: WalletAccount,
          as: 'Account',
          attributes: ['id', 'name', 'account_type']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: payments });
  } catch (err) {
    console.error('Error in getStaffPaymentHistory:', err);
    res.status(err.status || 500).json({ success: false, message: err.status === 403 ? err.message : 'Failed to fetch payment history' });
  }
};
