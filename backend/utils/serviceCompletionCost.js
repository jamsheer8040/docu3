const db = require('../models');
const {internalRead} = require('./recordAccess');
async function deductionPoint(tenant_id,transaction){
  const rows=await db.SystemConfig.findAll({where:{key:'wallet_deduction_point',tenant_id:{[require('sequelize').Op.or]:[tenant_id,null]}},transaction});
  const setting=rows.find(row=>row.tenant_id===tenant_id) || rows.find(row=>row.tenant_id==null);
  let value=setting?.value;try{value=JSON.parse(value);}catch{}
  return String(value || '').trim().toLowerCase()==='service_completion'?'service_completion':'invoice_creation';
}
async function completionCost(order,transaction){
  return internalRead(async()=>{
    const item=await db.SalesOrderItem.findOne({where:{tenant_id:order.tenant_id,service_order_id:order.id},attributes:['cost','quantity','service_name'],transaction});
    let amount,name,source;
    if(item){amount=Number(item.cost)*Number(item.quantity || 1);name=item.service_name;source='Sales order';}
    else {
      const lines=await db.InvoiceItem.findAll({where:{tenant_id:order.tenant_id,service_order_id:order.id},attributes:['cost_price','quantity'],include:[{model:db.Invoice,attributes:[],required:true,where:{tenant_id:order.tenant_id,status:{[require('sequelize').Op.ne]:'Cancelled'}}}],transaction});
      if(lines.length){amount=lines.reduce((sum,line)=>sum+Number(line.cost_price)*Number(line.quantity || 1),0);source='Invoice';}
      else{const type=await db.ServiceType.findOne({where:{id:order.service_type_id,tenant_id:order.tenant_id},attributes:['name','cost_price'],transaction});amount=Number(type?.cost_price || 0);name=type?.name;source='Service master';}
    }
    if(!Number.isFinite(amount) || amount<0)throw Object.assign(new Error('The service cost is invalid. Correct its source before completing.'),{status:400});
    return {amount:Math.round(amount*100)/100,name:name || `Service #${order.id}`,source};
  });
}
module.exports={deductionPoint,completionCost};
