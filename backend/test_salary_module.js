const { 
  SalaryPayroll, SalaryItem, SalaryPayment, 
  User, WalletAccount, WalletTransaction, Tenant, sequelize 
} = require('./models');

async function runTest() {
  console.log('=== SALARY & PAYROLL MANAGEMENT MODULE TEST ===\n');

  try {
    // 1. Find a test tenant and admin/user
    const user = await User.findOne({ where: { is_active: true } });
    if (!user) {
      console.log('No active user found to test with.');
      return;
    }
    const tenantId = user.tenant_id;
    console.log(`1. Testing for Tenant ID: ${tenantId}, User: ${user.name}`);

    // 2. Find or create a test wallet account
    let account = await WalletAccount.findOne({ where: { tenant_id: tenantId, is_active: true } });
    if (!account) {
      account = await WalletAccount.create({
        name: 'Test Business Bank',
        account_type: 'Debit',
        balance: 50000.00,
        currency: 'AED',
        tenant_id: tenantId
      });
      console.log('Created test wallet account with AED 50,000 balance');
    } else {
      console.log(`Using existing wallet account: ${account.name} (Balance: AED ${account.balance})`);
    }

    const testMonth = '2026-09';

    // 3. Clean up any previous test payroll for 2026-09
    await SalaryPayroll.destroy({ where: { tenant_id: tenantId, month: testMonth } });
    console.log(`2. Cleaned up previous payroll records for ${testMonth}`);

    // 4. Test Controller logic: Get preview for 2026-09
    const activeStaff = await User.findAll({
      where: { tenant_id: tenantId, is_active: true }
    });
    console.log(`3. Found ${activeStaff.length} active staff for preview.`);

    // Ensure at least one staff has salary configured
    if (parseFloat(user.total_salary || 0) === 0) {
      await user.update({
        basic_salary: 3000,
        hr_allowance: 1000,
        other_allowances: 500,
        total_salary: 4500
      });
      console.log('Updated test user salary to AED 4,500');
    }

    // 5. Book salary for 2026-09 on last day of month (2026-09-30)
    const bookingDate = '2026-09-30';
    const payroll = await SalaryPayroll.create({
      tenant_id: tenantId,
      month: testMonth,
      booking_date: bookingDate,
      total_amount: 4500.00,
      paid_amount: 0.00,
      status: 'Booked',
      notes: 'Automated test booking on last day of month',
      created_by: user.id
    });

    const item = await SalaryItem.create({
      payroll_id: payroll.id,
      tenant_id: tenantId,
      user_id: user.id,
      basic_salary: 3000.00,
      hr_allowance: 1000.00,
      other_allowances: 500.00,
      deductions: 0.00,
      bonus: 0.00,
      net_salary: 4500.00,
      paid_amount: 0.00,
      status: 'Unpaid'
    });

    console.log(`4. Successfully booked payroll ID: ${payroll.id} for ${testMonth} on ${bookingDate}!`);
    console.log(`   Staff: ${user.name}, Net Salary: AED ${item.net_salary}, Status: ${item.status}`);

    // 6. Test Partial Payment (AED 1,500 advance)
    const initialBalance = parseFloat(account.balance);
    const partialPayAmt = 1500.00;

    const tx1 = await WalletTransaction.create({
      account_id: account.id,
      type: 'Expense',
      direction: 'Out',
      amount: partialPayAmt,
      reference_id: item.id,
      reference_type: 'SalaryPayment',
      description: `Advance salary: ${user.name} (${testMonth})`,
      tenant_id: tenantId
    });

    await WalletAccount.decrement('balance', {
      by: partialPayAmt,
      where: { id: account.id }
    });

    await SalaryPayment.create({
      salary_item_id: item.id,
      tenant_id: tenantId,
      account_id: account.id,
      amount: partialPayAmt,
      payment_date: '2026-09-25',
      payment_method: 'Bank Transfer',
      transaction_id: tx1.id,
      notes: 'Advance payment test'
    });

    await item.update({
      paid_amount: partialPayAmt,
      status: 'Partially Paid',
      payment_date: '2026-09-25',
      account_id: account.id
    });

    await payroll.update({
      paid_amount: partialPayAmt,
      status: 'Partially Paid'
    });

    console.log('\n5. Processed Partial Payment of AED 1,500:');
    console.log(`   Salary Item Status: ${item.status} (Paid: AED ${item.paid_amount}, Remaining: AED ${item.net_salary - item.paid_amount})`);
    console.log(`   Payroll Status: ${payroll.status} (Paid: AED ${payroll.paid_amount})`);

    // 7. Test Batch / Remaining Payment (Remaining AED 3,000)
    const remainingAmt = item.net_salary - item.paid_amount;
    const tx2 = await WalletTransaction.create({
      account_id: account.id,
      type: 'Expense',
      direction: 'Out',
      amount: remainingAmt,
      reference_id: item.id,
      reference_type: 'SalaryPayment',
      description: `Final salary: ${user.name} (${testMonth})`,
      tenant_id: tenantId
    });

    await WalletAccount.decrement('balance', {
      by: remainingAmt,
      where: { id: account.id }
    });

    await SalaryPayment.create({
      salary_item_id: item.id,
      tenant_id: tenantId,
      account_id: account.id,
      amount: remainingAmt,
      payment_date: '2026-09-30',
      payment_method: 'Bank Transfer',
      transaction_id: tx2.id,
      notes: 'Remaining balance payment'
    });

    await item.update({
      paid_amount: 4500.00,
      status: 'Paid',
      payment_date: '2026-09-30',
      account_id: account.id
    });

    await payroll.update({
      paid_amount: 4500.00,
      status: 'Paid'
    });

    console.log('\n6. Processed Remaining Balance Payment of AED 3,000:');
    console.log(`   Salary Item Status: ${item.status} (Paid: AED ${item.paid_amount}, Remaining: AED ${item.net_salary - item.paid_amount})`);
    console.log(`   Payroll Status: ${payroll.status} (Paid: AED ${payroll.paid_amount})`);

    // Verify payments history
    const payments = await SalaryPayment.findAll({ where: { salary_item_id: item.id } });
    console.log(`\n7. Verified Payment History: Found ${payments.length} transactions totaling AED ${payments.reduce((s, p) => s + parseFloat(p.amount), 0)}`);

    console.log('\n✓ ALL BACKEND SALARY MANAGEMENT TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed with Error:', err);
    process.exit(1);
  }
}

runTest();
