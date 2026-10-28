const {internalRead}=require('./recordAccess');
module.exports=async(tenant_id,transaction)=>{
 const {SalesOrder}=require('../models');
 let suffix=await internalRead(()=>SalesOrder.count({where:{tenant_id},transaction}))+1;
 const year=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric'}).format(new Date());
 let value;do{value=`SO-${year}${String(suffix++).padStart(4,'0')}`;}while(await internalRead(()=>SalesOrder.findOne({where:{tenant_id,order_number:value},attributes:['id'],transaction})));
 return value;
};
