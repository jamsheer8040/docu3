// Integer cents; displayed daily rate is informational, never multiplied back.
// The independently deployed browser implementation is parity-tested against this.
function cents(value=0){
  if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error('Enter a valid salary amount.');
  const [whole,fraction='']=String(value).split('.');
  return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
function calculateSalary(row,days){
  const base=cents(row.base_salary),deductions=cents(row.deductions),bonus=cents(row.bonus);
  const leaves=Number(row.leave_days||0);
  if(!Number.isInteger(days)||days<28||days>31||!Number.isFinite(leaves)||leaves<0||leaves>days||!Number.isInteger(leaves*10))throw new Error('Enter valid unpaid leave days.');
  const leave=Math.floor((base*Math.round(leaves*10)*2+days*10)/(days*20));
  return {base_salary:base/100,daily_rate:Math.floor((base*2+days)/(days*2))/100,leave_deduction:leave/100,net_salary:(base-leave-deductions+bonus)/100,days_in_month:days,calculation_version:1};
}
function masterBasis(staff){
  return Number(staff.total_salary)||((cents(staff.basic_salary??0)+cents(staff.hr_allowance??0)+cents(staff.other_allowances??0))/100);
}
module.exports={cents,calculateSalary,masterBasis};
