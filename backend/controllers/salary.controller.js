const { 
  SalaryPayroll, SalaryItem, SalaryPayment, 
  User, Role, Tenant, WalletAccount, WalletTransaction, Expense, sequelize 
} = require('../models');
const { Op } = require('sequelize');
const salaryAccess=require('../utils/salaryAccess');
const salaryValidation=require('../utils/salaryValidation');
const {calculateSalary,masterBasis,cents}=require('../utils/salaryCalculation');
const {internalRead}=require('../utils/recordAccess');

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
    if(month!==undefined)salaryValidation.month(month);

    // Linked salary expenses are already represented by the salary subtotal.
    const expenseWhere = { tenant_id: tenantId, salary_payroll_id: null };
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
    const opPending = Math.max(0, Math.round(opTotal*100) - Math.round(opPaid*100))/100;

    // 2. Salary & Payroll Totals
    let salaryTotal, salaryPaid;
    if(salaryAccess.fullView(req.user)){
      salaryTotal=parseFloat(await SalaryPayroll.sum('total_amount',{where:payrollWhere})||0);
      salaryPaid=parseFloat(await SalaryPayroll.sum('paid_amount',{where:payrollWhere})||0);
    }else{
      const totals=await SalaryItem.findOne({where:salaryAccess.visibleWhere('SalaryItem',{tenant_id:tenantId}),attributes:[[sequelize.fn('SUM',sequelize.col('SalaryItem.net_salary')),'total'],[sequelize.fn('SUM',sequelize.col('SalaryItem.paid_amount')),'paid']],include:[{model:SalaryPayroll,as:'Payroll',required:true,attributes:[],where:salaryAccess.visibleWhere('SalaryPayroll',payrollWhere)}],raw:true});
      salaryTotal=Number(totals?.total||0);salaryPaid=Number(totals?.paid||0);
    }
    const salaryPending = Math.max(0, cents(salaryTotal) - cents(salaryPaid))/100;

    // 3. Combined Grand Totals
    const combinedTotal = (Math.round(opTotal*100) + cents(salaryTotal))/100;
    const combinedPaid = (Math.round(opPaid*100) + cents(salaryPaid))/100;
    const combinedPending = (cents(opPending) + cents(salaryPending))/100;

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
    res.status(err.status || 500).json({ success: false, message: err.status < 500 ? err.message : 'Failed to fetch expense summary' });
  }
};

/**
 * Get Payroll for a Specific Month (or Preview if Not Booked)
 */
exports.getMonthPayroll = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { month } = req.params;

    salaryValidation.month(month);

    const payroll = await SalaryPayroll.findOne({
      where: salaryAccess.visibleWhere('SalaryPayroll',{ tenant_id: tenantId, month }),
      include: [
        {
          model: SalaryItem,
          as: 'Items',
          required:false,where:salaryAccess.visibleWhere('SalaryItem',{tenant_id:tenantId}),
          include: [
            {
              model: User,
              as: 'Staff',
              required:false,where:salaryAccess.visibleWhere('User',{tenant_id:tenantId}),
              attributes: ['id', 'name', 'email', 'avatar', 'designation', 'phone']
            },
            {
              model: WalletAccount,
              as: 'Account',
              required:false,where:{tenant_id:tenantId},
              attributes: ['id', 'name', 'account_type']
            },
            {
              model: SalaryPayment,
              as: 'Payments',
              required:false,where:{tenant_id:tenantId},
              include: [{ model: WalletAccount, as: 'Account', required:false,where:{tenant_id:tenantId},attributes: ['id', 'name', 'account_type'] }]
            }
          ]
        }
      ],
      order: [[{ model: SalaryItem, as: 'Items' }, 'id', 'ASC']]
    });

    if (payroll) {
      const value=payroll.toJSON();
      if(!salaryAccess.fullView(req.user)){
        value.total_amount=value.Items.reduce((sum,item)=>sum+cents(item.net_salary||0),0)/100;
        value.paid_amount=value.Items.reduce((sum,item)=>sum+cents(item.paid_amount||0),0)/100;
        value.status=value.Items.length && value.Items.every(item=>Number(item.paid_amount)>=Number(item.net_salary))?'Paid':value.paid_amount>0?'Partially Paid':'Booked';
      }
      return res.json({
        success: true,
        isBooked: true,
        payroll:value
      });
    }

    // Not booked yet: Return preview of active staff salaries
    const suggestedBookingDate = getLastDayOfMonth(month);
    const [year, m] = month.split('-').map(Number);
    const daysInMonth = new Date(year, m, 0).getDate();

    const activeStaff = await salaryAccess.eligibleStaff(tenantId);

    const staffPreview = activeStaff.map(staff => {
      const basic = parseFloat(staff.basic_salary) || 0;
      const hr = parseFloat(staff.hr_allowance) || 0;
      const other = parseFloat(staff.other_allowances) || 0;
      const total = masterBasis(staff);
      const calculation=calculateSalary({base_salary:total,leave_days:0},daysInMonth);

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
        master_base_salary:total,
        days_in_month:daysInMonth,
        calculation_version:1,
        leave_days: 0,
        daily_rate: calculation.daily_rate,
        leave_deduction: 0.00,
        deductions: 0.00,
        bonus: 0.00,
        net_salary: total,
        paid_amount: 0.00,
        status: 'Unpaid'
      };
    });

    const estimatedTotal = staffPreview.reduce((sum, item) => sum + cents(item.net_salary), 0)/100;

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
    res.status(err.status || 500).json({ success: false, message: err.status < 500 ? err.message : 'Failed to fetch month payroll' });
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
    const daysInMonth=salaryValidation.month(month);
    const finalBookingDate=salaryValidation.bookingDate(booking_date===undefined?getLastDayOfMonth(month):booking_date);
    if(notes!==undefined && notes!==null && typeof notes!=='string')require('../utils/managementFinance').fail('Booking notes must be text.');

    const existing = await SalaryPayroll.findOne({
      where: { tenant_id: tenantId, month },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Payroll for ${month} is already booked.` });
    }

    let salaryItemsData = items;

    // If items not provided explicitly, pull all active staff with salary
    if (salaryItemsData===undefined) {
      const activeStaff = await salaryAccess.eligibleStaff(tenantId,transaction);

      salaryItemsData = activeStaff.map(staff => {
        const basic = parseFloat(staff.basic_salary) || 0;
        const hr = parseFloat(staff.hr_allowance) || 0;
        const other = parseFloat(staff.other_allowances) || 0;
        const total = masterBasis(staff);

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

    salaryItemsData=salaryValidation.items(salaryItemsData,daysInMonth);
    const staffIds = salaryItemsData.map(item => Number(item.user_id));
    const eligible=await salaryAccess.eligibleStaff(tenantId,transaction,staffIds);
    if(!staffIds.length || eligible.length!==staffIds.length){
      await transaction.rollback();return res.status(400).json({success:false,message:'Select active internal employees in this company within your Staff/HR access.'});
    }
    const employees=new Map(eligible.map(staff=>[Number(staff.id),staff]));
    let payrollTotal = 0;
    const preparedItems = salaryItemsData.map(item => {
      const employee=employees.get(item.user_id),master=masterBasis(employee);
      const basic = item.basic_salary===undefined?Number(employee.basic_salary):item.basic_salary;
      const hr = item.hr_allowance===undefined?Number(employee.hr_allowance):item.hr_allowance;
      const other = item.other_allowances===undefined?Number(employee.other_allowances):item.other_allowances;
      const baseSalary = (item.base_salary !== undefined)
        ? parseFloat(item.base_salary)
        : master;

      const leaveDays = parseFloat(item.leave_days) || 0;
      const otherDeductions = parseFloat(item.deductions) || 0;
      const bonus = parseFloat(item.bonus) || 0;

      salaryValidation.money(baseSalary,'Salary basis');
      const calculation=calculateSalary({...item,base_salary:baseSalary},daysInMonth);
      const net=calculation.net_salary;
      salaryValidation.money(net,'Calculated net salary (deductions cannot exceed salary plus bonus)');
      const changed=cents(baseSalary)!==cents(master)||cents(basic)!==cents(employee.basic_salary??0)||cents(hr)!==cents(employee.hr_allowance??0)||cents(other)!==cents(employee.other_allowances??0);
      const reason=item.override_reason?.trim()||null;
      if(changed&&!reason)require('../utils/managementFinance').fail(`Enter a salary override reason for ${employee.name}.`);

      payrollTotal += cents(net);

      return {
        tenant_id: tenantId,
        user_id: Number(item.user_id),
        assigned_user_id: req.user.id,
        basic_salary: basic,
        hr_allowance: hr,
        other_allowances: other,
        ...calculation,
        master_base_salary:master,
        override_reason:reason,
        leave_days: leaveDays,
        deductions: otherDeductions,
        bonus,
        net_salary: net,
        paid_amount: 0,
        status: 'Unpaid',
        notes: item.notes || null
      };
    });

    if(payrollTotal>999999999999)require('../utils/managementFinance').fail('Payroll total exceeds the supported amount.');
    const payroll = await SalaryPayroll.create({
      tenant_id: tenantId,
      month,
      booking_date: finalBookingDate,
      total_amount: payrollTotal / 100,
      paid_amount: 0,
      status: 'Booked',
      notes,
      created_by: req.user.id,
      assigned_user_id: req.user.id
    }, { transaction });

    for (const item of preparedItems) {
      item.payroll_id = payroll.id;
      await SalaryItem.create(item, { transaction });
    }

    await require('../utils/salaryAccounting').book(payroll, transaction);

    await transaction.commit();

    // Fetch complete payroll object to return
    const createdPayroll = await SalaryPayroll.findOne({
      where: salaryAccess.visibleWhere('SalaryPayroll',{ id: payroll.id,tenant_id:tenantId }),
      include: [
        {
          model: SalaryItem,
          as: 'Items',
          required:false,where:salaryAccess.visibleWhere('SalaryItem',{tenant_id:tenantId}),
          include: [
            {
              model: User,
              as: 'Staff',
              required:false,where:salaryAccess.visibleWhere('User',{tenant_id:tenantId}),
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
    if(!transaction.finished)await transaction.rollback();
    console.error('Error in bookMonthSalary:', err);
    res.status(err.status || 500).json({ success: false, message: err.status < 500 ? err.message : 'Failed to book salary' });
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
    const requests=require('../utils/salaryPaymentRequest');
    const attempt=await requests.begin(req,transaction,'single');
    if(attempt.prior){const result=await requests.replay(attempt,transaction);await transaction.commit();return res.json(result);}
    const { salary_item_id, account_id, amount, payment_date, payment_method = 'Bank Transfer', notes } = req.body;
    const txDate=salaryValidation.paymentDate(payment_date);

    if (amount !== undefined && !validPaymentAmount(amount)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Payment amount must be a positive number with at most two decimal places' });
    }

    if (!salary_item_id || !account_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Salary Item and Bank/Wallet Account are required' });
    }

    const item = await SalaryItem.findOne({
      where: salaryAccess.visibleWhere('SalaryItem',{ id: salary_item_id, tenant_id: tenantId }),
      include: [
        { model: SalaryPayroll, as: 'Payroll',required:true,where:salaryAccess.visibleWhere('SalaryPayroll',{tenant_id:tenantId}) },
        { model: User, as: 'Staff',required:false,where:{tenant_id:tenantId},attributes: ['id', 'name'] }
      ],
      transaction
    });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Salary item not found' });
    }
    if(!item.Staff){await transaction.rollback();return res.status(400).json({success:false,message:'The employee is not in this company. Reconcile this historical payroll before paying.'});}

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

    const netSalaryFils = cents(item.net_salary);
    const alreadyPaidFils = cents(item.paid_amount || 0);
    const pendingFils = Math.max(0, netSalaryFils - alreadyPaidFils);

    const payFils = amount === undefined ? pendingFils : cents(amount);
    const payAmount = payFils/100;

    if (payFils > pendingFils) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Payment exceeds the remaining salary balance' });
    }

    if (payFils <= 0) {
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
      payment_date: txDate,
      payment_method,
      transaction_id: walletTx.id,
      notes
    }, { transaction });

    // 4. Update Salary Item
    const updatedPaidFils = alreadyPaidFils + payFils;
    const finalItemStatus = updatedPaidFils >= netSalaryFils ? 'Paid' : 'Partially Paid';

    await item.update({
      paid_amount: updatedPaidFils/100,
      status: finalItemStatus,
      payment_date: txDate,
      account_id: account.id
    }, { transaction });

    // 5. Update Payroll Overall Totals & Status
    const payroll = await SalaryPayroll.findOne({
      where: { id: item.payroll_id, tenant_id: tenantId },
      transaction
    });
    // This payroll is authorized above; totals must include every child even
    // when the operator is only allowed to display some of the rows.
    const payrollItems=await internalRead(()=>SalaryItem.findAll({where:{tenant_id:tenantId,payroll_id:payroll.id},transaction}));

    const newPayrollPaidFils = payrollItems.reduce((sum, it) => {
      return sum + (it.id === item.id ? updatedPaidFils : cents(it.paid_amount || 0));
    }, 0);

    const allPaid = payrollItems.every(it => {
      const itPaid = it.id === item.id ? updatedPaidFils : cents(it.paid_amount || 0);
      return itPaid >= cents(it.net_salary);
    });

    const anyPaid = newPayrollPaidFils > 0;

    await payroll.update({
      paid_amount: newPayrollPaidFils/100,
      status: allPaid ? 'Paid' : (anyPaid ? 'Partially Paid' : 'Booked')
    }, { transaction });
    await require('../utils/salaryAccounting').settle(payroll, transaction, {account_id: account.id, payment_date: paymentRecord.payment_date});

    await requests.save(attempt,[paymentRecord.id],transaction);

    await transaction.commit();

    res.json({
      success: true,
      message: `Payment of AED ${payAmount.toLocaleString()} recorded for ${item.Staff?.name}`,
      data: {
        payment: paymentRecord,
        status: finalItemStatus,
        paid_amount: updatedPaidFils/100,
        pending_amount: Math.max(0, netSalaryFils - updatedPaidFils)/100
      }
    });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error in paySingleSalary:', err);
    res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to process salary payment' });
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
    const requests=require('../utils/salaryPaymentRequest');
    const attempt=await requests.begin(req,transaction,'batch');
    if(attempt.prior){const result=await requests.replay(attempt,transaction);await transaction.commit();return res.json(result);}
    const { salary_item_ids, account_id, payment_date, payment_method = 'Bank Transfer', notes } = req.body;
    const txDate=salaryValidation.paymentDate(payment_date);

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

    const selectedIds=[...new Set(salary_item_ids.map(Number))];
    if(selectedIds.some(id=>!Number.isSafeInteger(id)||id<=0)){await transaction.rollback();return res.status(400).json({success:false,message:'Select valid salary items.'});}
    const selected = await SalaryItem.findAll({
      where: salaryAccess.visibleWhere('SalaryItem',{id:{[Op.in]:selectedIds},tenant_id:tenantId}),
      include: [
        { model: SalaryPayroll, as: 'Payroll',required:true,where:salaryAccess.visibleWhere('SalaryPayroll',{tenant_id:tenantId}) },
        { model: User, as: 'Staff',required:false,where:{tenant_id:tenantId},attributes: ['id', 'name'] }
      ],
      transaction
    });
    if(selected.length!==selectedIds.length){await transaction.rollback();return res.status(404).json({success:false,message:'One or more selected salary items are not accessible.'});}
    if(selected.some(item=>!item.Staff)){await transaction.rollback();return res.status(400).json({success:false,message:'An employee is not in this company. Reconcile this historical payroll before paying.'});}
    const items=selected.filter(item=>item.status!=='Paid');

    if (items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'None of the selected items require payment' });
    }

    let totalBatchFils = 0;
    const payrollIdsToUpdate = new Set();
    const paymentIds=[];

    for (const item of items) {
      const netFils = cents(item.net_salary);
      const paidFils = cents(item.paid_amount || 0);
      const pendingFils = Math.max(0, netFils - paidFils);
      const pending = pendingFils/100;

      if (pending <= 0) continue;

      totalBatchFils += pendingFils;
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
      const payment=await SalaryPayment.create({
        salary_item_id: item.id,
        tenant_id: tenantId,
        account_id: account.id,
        amount: pending,
        payment_date: txDate,
        payment_method,
        transaction_id: walletTx.id,
        notes: notes || 'Batch salary payment'
      }, { transaction });
      paymentIds.push(payment.id);

      // Update Salary Item
      await item.update({
        paid_amount: netFils/100,
        status: 'Paid',
        payment_date: txDate,
        account_id: account.id
      }, { transaction });
    }

    // Decrement wallet balance in one go
    if (totalBatchFils > 0) {
      await WalletAccount.decrement('balance', {
        by: totalBatchFils/100,
        where: { id: account.id, tenant_id: tenantId },
        transaction
      });
    }

    // Update affected Payrolls
    for (const pId of payrollIdsToUpdate) {
      const payroll = await SalaryPayroll.findOne({
        where: { id: pId, tenant_id: tenantId },
        transaction
      });
      const payrollItems=await internalRead(()=>SalaryItem.findAll({where:{tenant_id:tenantId,payroll_id:pId},transaction}));

      const totalPaidFils = payrollItems.reduce((sum, it) => sum + cents(it.paid_amount || 0), 0);
      const allPaid = payrollItems.every(it => cents(it.paid_amount || 0) >= cents(it.net_salary));

      await payroll.update({
        paid_amount: totalPaidFils/100,
        status: allPaid ? 'Paid' : 'Partially Paid'
      }, { transaction });
      await require('../utils/salaryAccounting').settle(payroll, transaction, {account_id: account.id, payment_date: txDate});
    }

    if(!paymentIds.length){await transaction.rollback();return res.status(400).json({success:false,message:'None of the selected items require payment'});}
    await requests.save(attempt,paymentIds,transaction);
    await transaction.commit();

    res.json({
      success: true,
      message: `Batch transfer completed: AED ${(totalBatchFils/100).toLocaleString()} disbursed for ${paymentIds.length} staff member(s)`,
      count: paymentIds.length,
      total_amount: totalBatchFils/100
    });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error in payBatchSalary:', err);
    res.status(err.status || 500).json({ success: false, message: err.status && err.status < 500 ? err.message : 'Failed to process batch salary payment' });
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
    salaryValidation.month(month);
    const expectedId=req.query.payroll_id;
    if(typeof expectedId!=='string'||!(/^[1-9]\d{0,19}$/).test(expectedId)){
      await transaction.rollback();return res.status(400).json({success:false,message:'The exact payroll reference is required. Reload payroll before cancelling.'});
    }
    const payroll = await SalaryPayroll.findOne({
      where: salaryAccess.visibleWhere('SalaryPayroll', { tenant_id: tenantId, month }),
      include: [{ model: SalaryItem, as: 'Items', where: { tenant_id: tenantId }, required: false }],
      transaction
    });

    if (!payroll) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Payroll for this month not found' });
    }

    if(String(payroll.id)!==expectedId){
      await transaction.rollback();return res.status(409).json({success:false,message:'This payroll has changed since it was loaded. Reload payroll and review it before cancelling.'});
    }

    if (parseFloat(payroll.paid_amount || 0) > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot unbook a payroll that has disbursed payments. Revert payments first.'
      });
    }

    const history=await internalRead(()=>SalaryPayment.findOne({where:{tenant_id:tenantId},attributes:['id'],include:[{model:SalaryItem,required:true,attributes:[],where:{tenant_id:tenantId,payroll_id:payroll.id}}],transaction}));
    if(history){await transaction.rollback();return res.status(409).json({success:false,message:'Payroll with payment history cannot be unbooked, even after reversal. Its audit history must be retained.'});}

    await require('../utils/salaryAccounting').unbook(payroll, transaction);
    await payroll.destroy({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: `Payroll for ${month} unbooked successfully`,payroll_id:String(payroll.id)
    });
  } catch (err) {
    console.error('Error in unbookMonthSalary:', err);
    if (!transaction.finished) await transaction.rollback();
    res.status(err.status || 500).json({ success: false, message: err.status < 500 ? err.message : 'Failed to unbook salary' });
  }
};

// Full reversal of one recorded instalment, never a deletion or a backdated edit.
exports.reversePayment=async(req,res)=>{
  const transaction=await sequelize.transaction();
  const {fail,units}=require('../utils/managementFinance');
  try{
    const tenant_id=req.user.tenant_id;
    await lockPayrollTenant(tenant_id,transaction);
    if(!/^[1-9]\d*$/.test(req.params.id))fail('Select a valid salary payment.');
    const reason=req.body?.reason;
    if(typeof reason!=='string'||!reason.trim()||reason.length>2000)fail('A reversal reason is required (maximum 2000 characters).');
    const payment=await SalaryPayment.findOne({where:{tenant_id,id:req.params.id},transaction,lock:transaction.LOCK.UPDATE});
    if(!payment)fail('Salary payment not found.',404);
    if(payment.reversed_at){
      if(payment.reversal_reason!==reason.trim())fail('This salary payment was already reversed with a different reason.',409);
      await transaction.commit();return res.json({success:true,replayed:true,message:'This salary payment was already reversed. No additional credit was made.',data:{payment}});
    }
    const item=await SalaryItem.findOne({where:{tenant_id,id:payment.salary_item_id},transaction});
    const payroll=item&&await SalaryPayroll.findOne({where:{tenant_id,id:item.payroll_id},transaction});
    const employee=item&&await User.findOne({where:{tenant_id,id:item.user_id},attributes:['id'],transaction});
    const account=await WalletAccount.findOne({where:{tenant_id,id:payment.account_id},transaction,lock:transaction.LOCK.UPDATE});
    const original=payment.transaction_id&&await WalletTransaction.findOne({where:{tenant_id,id:payment.transaction_id,account_id:payment.account_id},transaction});
    const amount=units(payment.amount,'Salary payment');
    if(!item||!payroll||!employee||!account||!original||original.type!=='Expense'||original.direction!=='Out'||original.reference_type!=='SalaryPayment'||Number(original.reference_id)!==Number(item.id)||units(original.amount,'Original wallet debit')!==amount)fail('The original salary payment and wallet debit could not be verified. Reconcile this historical entry before reversal.',409);
    const active=await SalaryPayment.findAll({where:{tenant_id,salary_item_id:item.id,reversed_at:null},order:[['id','DESC']],transaction});
    const paid=units(item.paid_amount,'Paid salary',true);
    if(active.reduce((sum,row)=>sum+units(row.amount,'Payment'),0)!==paid||paid<amount)fail('Salary payments and paid balance do not match. Reconcile before reversal.',409);
    const items=await SalaryItem.findAll({where:{tenant_id,payroll_id:payroll.id},transaction});
    const totalPaid=items.reduce((sum,row)=>sum+units(row.paid_amount,'Paid salary',true),0);
    if(totalPaid!==units(Number(payroll.paid_amount).toFixed(2),'Payroll paid',true))fail('Payroll paid totals do not match. Reconcile before reversal.',409);
    if(payroll.expense_id){
      const expense=await Expense.findOne({where:{tenant_id,id:payroll.expense_id,salary_payroll_id:payroll.id},transaction});
      if(!expense||units(expense.paid_amount,'Salary expense paid',true)!==totalPaid)fail('The linked salary expense does not match payroll payments. Reconcile before reversal.',409);
    }
    const balance=Math.sign(Number(account.balance))*units(Math.abs(Number(account.balance)).toFixed(2),'Wallet balance',true);
    if(balance+amount>999999999999)fail('Reversal would exceed the wallet balance limit.',409);
    const credit=await WalletTransaction.create({tenant_id,account_id:account.id,type:'Expense',direction:'In',amount:amount/100,balance_after:Math.abs(balance+amount)<=9999999999?(balance+amount)/100:null,reference_type:'SalaryPaymentReversal',reference_id:payment.id,description:`Reversal of salary payment #${payment.id}`},{transaction});
    await WalletAccount.increment('balance',{by:amount/100,where:{tenant_id,id:account.id},transaction});
    await payment.update({reversed_at:new Date(),reversed_by_user_id:req.user.id,reversal_reason:reason.trim(),reversal_transaction_id:credit.id},{transaction});
    const remaining=active.filter(row=>Number(row.id)!==Number(payment.id)),last=remaining[0];
    const newPaid=paid-amount,net=units(item.net_salary,'Net salary',true);
    await item.update({paid_amount:newPaid/100,status:newPaid===0?'Unpaid':newPaid>=net?'Paid':'Partially Paid',account_id:last?.account_id||null,payment_date:last?.payment_date||null},{transaction});
    const updatedTotal=totalPaid-amount;
    const allPaid=items.every(row=>Number(row.id)===Number(item.id)?newPaid>=net:units(row.paid_amount,'Paid salary',true)>=units(row.net_salary,'Net salary',true));
    await payroll.update({paid_amount:updatedTotal/100,status:allPaid?'Paid':updatedTotal>0?'Partially Paid':'Booked'},{transaction});
    const latest=await SalaryPayment.findOne({where:{tenant_id,salary_item_id:{[Op.in]:items.map(row=>row.id)},reversed_at:null},order:[['id','DESC']],transaction});
    await require('../utils/salaryAccounting').settle(payroll,transaction,{account_id:latest?.account_id||null,payment_date:latest?.payment_date||null});
    await transaction.commit();
    res.json({success:true,message:'Salary payment reversed. The original wallet and outstanding salary balance have been restored.',data:{payment,paid_amount:newPaid/100,pending_amount:(net-newPaid)/100}});
  }catch(err){
    if(!transaction.finished)await transaction.rollback();
    console.error('Error reversing salary payment:',err);
    res.status(err.status||500).json({success:false,message:err.status<500?err.message:'Failed to reverse salary payment.'});
  }
};

/**
 * Get Payment History for a Salary Item
 */
exports.getStaffPaymentHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const item=await SalaryItem.findOne({where:salaryAccess.visibleWhere('SalaryItem',{tenant_id:tenantId,id}),include:[{model:SalaryPayroll,as:'Payroll',attributes:['id'],required:true,where:salaryAccess.visibleWhere('SalaryPayroll',{tenant_id:tenantId})}]});
    if(!item)return res.status(404).json({success:false,message:'Salary item not found or not accessible.'});

    const payments = await SalaryPayment.findAll({
      where: { salary_item_id: id, tenant_id: tenantId },
      include: [
        {
          model: WalletAccount,
          as: 'Account',
          required:false,where:{tenant_id:tenantId},
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
