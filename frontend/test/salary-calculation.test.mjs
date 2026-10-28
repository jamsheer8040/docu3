import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {calculateSalary,salaryBalance,salaryAmountRule,salaryComponentsTotal,paymentDateRule} from '../utils/salaryCalculation.mjs';
const backend=createRequire(import.meta.url)('../../backend/utils/salaryCalculation.js');
test('browser and server round once from monthly basis and match an independent integer reference',()=>{
 for(const days of [28,29,30,31])for(const baseCents of [0,1,15,10001,70000,9999999999])for(let tenths=0;tenths<=days*10;tenths++){
  const row={base_salary:baseCents/100,leave_days:tenths/10,deductions:0,bonus:0};
  const expected=Number((BigInt(baseCents)*BigInt(tenths)*2n+BigInt(days*10))/BigInt(days*20));
  const result=calculateSalary(row,days);assert.deepEqual(result,backend.calculateSalary(row,days));
  assert.equal(result.leave_deduction,expected/100);assert.equal(result.net_salary,(baseCents-expected)/100);
 }
});

test('payment balances use whole fils, including the final fils and small decimal instalments',()=>{
 assert.equal(salaryBalance('60.00','59.99'),0.01);assert.equal(salaryBalance(0.3,0.1),0.2);assert.equal(salaryBalance(60,60),0);assert.equal(salaryBalance(60,61),0);
 for(let net=1;net<=6000;net+=31)for(let paid=0;paid<=net;paid+=17)assert.equal(salaryBalance(net/100,paid/100),(net-paid)/100);
});

test('staff salary fields reject invalid values and component totals are exact',()=>{
 for(const value of [-1,'12abc','1e3','0x10',null,true,{},[],1.234,'',100000000])assert.notEqual(salaryAmountRule(value),true);
 assert.equal(salaryAmountRule(0),true);assert.equal(salaryAmountRule('99999999.99'),true);
 assert.equal(salaryComponentsTotal({basic_salary:0.1,hr_allowance:0.2,other_allowances:0.3}),0.6);
 assert.throws(()=>salaryComponentsTotal({basic_salary:99999999.99,hr_allowance:0.01,other_allowances:0}),/exceeds/);
});

test('payment date fields accept real date-only values and reject blanks, timestamps and invalid calendar dates',()=>{
 for(const value of ['2024-02-29','2026-10-27','1000-01-01','9999-12-31'])assert.equal(paymentDateRule(value),true);
 for(const value of ['',null,false,{},[],20260101,'2026-02-29','2026-13-01','2026-01-00','2026-1-01','0000-01-01','2026-01-01T00:00:00Z','2026-01-01 '])assert.notEqual(paymentDateRule(value),true);
});
test('half-cent rounding, allowances in the basis, deductions and bonus remain explicit',()=>{
 const result=calculateSalary({base_salary:700,leave_days:1,deductions:5,bonus:2},31);
 assert.equal(result.daily_rate,22.58);assert.equal(result.leave_deduction,22.58);assert.equal(result.net_salary,674.42);
 assert.equal(calculateSalary({base_salary:1000,leave_days:10},31).net_salary,677.42,'Do not multiply the displayed 32.26 daily rate back into the calculation');
 assert.equal(calculateSalary({base_salary:0.15,leave_days:1},30).leave_deduction,0.01);
 assert.equal(calculateSalary({base_salary:290,leave_days:0.5,deductions:5,bonus:2},29).net_salary,282);
 assert.equal(calculateSalary({base_salary:0,leave_days:0},31).net_salary,0);
 assert.equal(backend.masterBasis({basic_salary:null,hr_allowance:null,other_allowances:null,total_salary:null}),0,'Legacy empty salary settings remain zero');
});
