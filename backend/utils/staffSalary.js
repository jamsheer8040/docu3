const {money}=require('./salaryValidation');
const {cents}=require('./salaryCalculation');
const fields=['basic_salary','hr_allowance','other_allowances','total_salary'];
module.exports=function staffSalary(payload,current){
  if(current && !fields.some(field=>payload[field]!==undefined))return {};
  const result={};
  for(const field of fields.slice(0,3))result[field]=money(payload[field]===undefined?(current?.[field]??0):payload[field],field.replaceAll('_',' '));
  result.total_salary=money(payload.total_salary===undefined?fields.slice(0,3).reduce((sum,field)=>sum+cents(result[field]),0)/100:payload.total_salary,'Total monthly salary');
  return result;
};
