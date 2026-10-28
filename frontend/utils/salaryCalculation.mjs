// Keep parity with the backend calculator; the two apps deploy independently.
export function cents(value=0){
  if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error('Enter a valid salary amount.');
  const [whole,fraction='']=String(value).split('.');
  return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function salaryBalance(net,paid){return Math.max(0,cents(net??0)-cents(paid??0))/100;}
export function paymentDateRule(value){
  const parsed=typeof value==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)?new Date(`${value}T00:00:00Z`):null;
  return parsed&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?true:'Select a valid payment date (YYYY-MM-DD).';
}
export function salaryAmountRule(value){
  return ['number','string'].includes(typeof value)&&/^\d+(\.\d{1,2})?$/.test(String(value))&&Number.isFinite(Number(value))&&Number(value)<=99999999.99
    ?true:'Enter 0 or a positive amount with up to 2 decimal places (maximum AED 99,999,999.99).';
}
export function salaryComponentsTotal(row){
  const fields=['basic_salary','hr_allowance','other_allowances'];
  for(const field of fields){const valid=salaryAmountRule(row[field]);if(valid!==true)throw new Error(valid);}
  const total=fields.reduce((sum,field)=>sum+cents(row[field]),0)/100;
  if(salaryAmountRule(total)!==true)throw new Error('Total monthly salary exceeds AED 99,999,999.99.');
  return total;
}
export function calculateSalary(row,days){
  const base=cents(row.base_salary),deductions=cents(row.deductions),bonus=cents(row.bonus);
  const leaves=Number(row.leave_days||0);
  if(!Number.isInteger(days)||days<28||days>31||!Number.isFinite(leaves)||leaves<0||leaves>days||!Number.isInteger(leaves*10))throw new Error('Enter valid unpaid leave days.');
  const leave=Math.floor((base*Math.round(leaves*10)*2+days*10)/(days*20));
  return {base_salary:base/100,daily_rate:Math.floor((base*2+days)/(days*2))/100,leave_deduction:leave/100,net_salary:(base-leave-deductions+bonus)/100,days_in_month:days,calculation_version:1};
}
