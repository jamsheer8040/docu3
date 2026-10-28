const {createHash}=require('node:crypto');
const {Op}=require('sequelize');
const {fail}=require('./managementFinance');
const {cents}=require('./salaryCalculation');
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
// Caller already holds the tenant financial lock. Receipts commit atomically
// with the payment and contain identifiers, never cached privileged responses.
async function begin(req,transaction,kind){
  const key=req.get('Idempotency-Key');
  if(!key || !/^[A-Za-z0-9_-]{8,80}$/.test(key))fail('A valid payment request reference is required. Refresh the page before paying.',400);
  const fingerprint=createHash('sha256').update(JSON.stringify(stable({operation:`salary-${kind}`,body:req.body}))).digest('hex');
  const {ManagementRequest}=require('../models');
  const where={tenant_id:req.user.tenant_id,user_id:req.user.id,request_key:key};
  const prior=await ManagementRequest.findOne({where,transaction});
  if(prior && (prior.fingerprint!==fingerprint || prior.response?.salary_operation!==kind))fail('This payment request reference was already used for different data. Confirm the original transfer before starting another.',409);
  return {where,fingerprint,prior,kind};
}
async function save(attempt,paymentIds,transaction){
  const {ManagementRequest}=require('../models');
  await ManagementRequest.create({...attempt.where,fingerprint:attempt.fingerprint,response:{salary_operation:attempt.kind,payment_ids:paymentIds}},{transaction});
}
async function replay(attempt,transaction){
  const {SalaryPayment,SalaryItem,SalaryPayroll,WalletAccount}=require('../models');
  const {visibleWhere}=require('./salaryAccess');
  const ids=attempt.prior.response.payment_ids;
  if(!Array.isArray(ids) || !ids.length)fail('The original transfer receipt needs administrator review.',409);
  const tenant_id=attempt.where.tenant_id;
  // These reads intentionally retain current record and wallet permissions.
  const payments=await SalaryPayment.findAll({where:visibleWhere('SalaryPayment',{tenant_id,id:{[Op.in]:ids}}),transaction});
  if(payments.length!==ids.length)fail('The original salary transfer is not accessible under your current permissions.',403);
  const itemIds=[...new Set(payments.map(p=>String(p.salary_item_id)))];
  const accountIds=[...new Set(payments.map(p=>String(p.account_id)))];
  const items=await SalaryItem.findAll({where:visibleWhere('SalaryItem',{tenant_id,id:{[Op.in]:itemIds}}),include:[{model:SalaryPayroll,as:'Payroll',attributes:['id'],required:true,where:visibleWhere('SalaryPayroll',{tenant_id})}],transaction});
  const accounts=await WalletAccount.findAll({where:{tenant_id,id:{[Op.in]:accountIds}},attributes:['id'],transaction});
  if(items.length!==itemIds.length || accounts.length!==accountIds.length)fail('The original salary transfer is not accessible under your current permissions.',403);
  if(attempt.kind==='single'){
    const payment=payments[0],item=items.find(row=>String(row.id)===String(payment.salary_item_id));
    return {success:true,replayed:true,reversed:!!payment.reversed_at,message:payment.reversed_at?'This original salary payment was reversed. No additional transfer was made.':'This salary payment was already recorded. No additional transfer was made.',data:{payment,status:item.status,paid_amount:Number(item.paid_amount),pending_amount:Math.max(0,cents(item.net_salary)-cents(item.paid_amount))/100}};
  }
  const total=payments.reduce((sum,p)=>sum+cents(p.amount),0)/100;
  const reversed_count=payments.filter(payment=>payment.reversed_at).length;
  return {success:true,replayed:true,message:`This batch salary transfer was already recorded.${reversed_count?` ${reversed_count} payment(s) have since been reversed.`:''} No additional transfer was made.`,count:payments.length,total_amount:total,reversed_count};
}
module.exports={begin,save,replay};
