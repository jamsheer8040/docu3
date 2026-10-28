const {fail}=require('./managementFinance');
const MAX_MONEY=99999999.99; // SalaryItem DECIMAL(10,2).
function month(value){
  if(typeof value!=='string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value))fail('Select a valid payroll month in YYYY-MM format.');
  const [year,m]=value.split('-').map(Number);
  return new Date(Date.UTC(year,m,0)).getUTCDate();
}
function bookingDate(value,label='booking'){
  if(typeof value!=='string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))fail(`Select a valid ${label} date in YYYY-MM-DD format.`);
  const parsed=new Date(`${value}T00:00:00Z`);
  if(!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value)fail(`Select a valid calendar date for ${label}.`);
  return value;
}
function paymentDate(value,now=new Date()){
  if(value!==undefined)return bookingDate(value,'payment');
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=type=>parts.find(row=>row.type===type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function money(value,label){
  if(value===undefined)return 0;
  if(!['number','string'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value)) || !Number.isFinite(Number(value)) || Number(value)>MAX_MONEY)fail(`${label} must be a non-negative amount with at most two decimal places (maximum ${MAX_MONEY}).`);
  return Number(value);
}
function item(row,days){
  if(!row || typeof row!=='object' || Array.isArray(row))fail('Each salary row must contain valid employee details.');
  if(!['number','string'].includes(typeof row.user_id) || !/^[1-9]\d*$/.test(String(row.user_id)) || !Number.isSafeInteger(Number(row.user_id)))fail('Select a valid employee for every salary row.');
  const result={...row,user_id:Number(row.user_id)};
  for(const field of ['basic_salary','hr_allowance','other_allowances','base_salary','deductions','bonus','net_salary','daily_rate','leave_deduction']){
    if(row[field]!==undefined)result[field]=money(row[field],field.replaceAll('_',' '));
  }
  const leaves=row.leave_days===undefined?0:row.leave_days;
  if(!['number','string'].includes(typeof leaves) || !/^\d+(\.\d)?$/.test(String(leaves)) || !Number.isFinite(Number(leaves)) || Number(leaves)>days)fail(`Unpaid leave must be between 0 and ${days} days, with at most one decimal place.`);
  result.leave_days=Number(leaves);
  if(row.notes!==undefined && row.notes!==null && typeof row.notes!=='string')fail('Salary row notes must be text.');
  if(row.override_reason!==undefined && row.override_reason!==null && (typeof row.override_reason!=='string'||row.override_reason.length>2000))fail('Salary override reason must be text, at most 2000 characters.');
  return result;
}
function items(value,days){
  if(!Array.isArray(value) || !value.length)fail('Include at least one employee in the payroll.');
  const rows=value.map(row=>item(row,days));
  if(new Set(rows.map(row=>row.user_id)).size!==rows.length)fail('Each employee can appear only once in a monthly payroll.');
  return rows;
}
module.exports={month,bookingDate,paymentDate,money,items};
