const {Op}=require('sequelize');
const db=require('../models');
const {cents}=require('./commissionEngine');

// Approved costs and actual legacy payouts never depend on feature visibility.
module.exports=async function invoiceRecordedProfit(invoice){
  const tenant_id=invoice.tenant_id;
  const entries=await db.CommissionEntry.findAll({where:{tenant_id,invoice_id:invoice.id,voided_at:null},attributes:['id','amount','approval_status','rule_snapshot']});
  let commission=entries.filter(entry=>entry.approval_status==='Approved').reduce((sum,entry)=>sum+cents(entry.amount),0);
  const legacy=entries.filter(entry=>entry.approval_status!=='Approved' && !entry.rule_snapshot?.simple_criteria).map(entry=>entry.id);
  if(legacy.length)commission+=cents(await db.CommissionPayment.sum('amount',{where:{tenant_id,entry_id:{[Op.in]:legacy},reversed_at:null}}) || 0);
  return (cents(invoice.total)-cents(invoice.tax || 0)-cents(invoice.cost_total || 0)-commission)/100;
};
