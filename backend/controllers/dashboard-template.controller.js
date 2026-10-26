const {Op,fn,col}=require('sequelize');
const db=require('../models');
const catalog=require('../utils/dashboardTemplates');
const {actionScope}=require('../utils/permissionRules');
const allowed=(user,module,action='list')=>{const scope=actionScope(user,module,action);return scope===true || (scope && scope!=='none');};
const failure=(res,error)=>res.status(error.name==='SequelizeUniqueConstraintError'?409:400).json({success:false,message:error.name==='SequelizeUniqueConstraintError'?'A template with this name already exists.':error.message});
exports.list=async(req,res)=>{try{res.json({success:true,data:{templates:await db.DashboardTemplate.findAll({where:{tenant_id:req.user.tenant_id},order:[['name','ASC']]}),widgets:catalog.widgets,presets:catalog.presets}});}catch(error){failure(res,error);}};
exports.create=async(req,res)=>{try{const template=await db.DashboardTemplate.create({...catalog.validate(req.body),tenant_id:req.user.tenant_id});res.status(201).json({success:true,data:template});}catch(error){failure(res,error);}};
exports.update=async(req,res)=>{try{const template=await db.DashboardTemplate.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id}});if(!template)return res.status(404).json({success:false,message:'Template not found.'});await template.update(catalog.validate(req.body));res.json({success:true,data:template});}catch(error){failure(res,error);}};
exports.remove=async(req,res)=>{try{await db.sequelize.transaction(async transaction=>{const template=await db.DashboardTemplate.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id},transaction,lock:transaction.LOCK.UPDATE});if(!template)throw new Error('Template not found.');if(await db.Role.count({where:{tenant_id:req.user.tenant_id,dashboard_template_id:template.id},transaction}))throw new Error('Choose another template for the roles using this one before deleting it.');await template.destroy({transaction});});res.json({success:true});}catch(error){failure(res,error);}};
exports.presets=async(req,res)=>{try{await db.sequelize.transaction(async transaction=>{for(const preset of catalog.presets)await db.DashboardTemplate.findOrCreate({where:{tenant_id:req.user.tenant_id,name:preset.name},defaults:preset,transaction});});res.json({success:true});}catch(error){failure(res,error);}};
exports.assign=async(req,res)=>{try{await db.sequelize.transaction(async transaction=>{const role=await db.Role.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id},transaction});if(!role || role.name==='Developer')throw new Error('Editable role not found in this workspace.');const id=await catalog.templateId(req.body.dashboard_template_id,req.user.tenant_id,role.type,transaction);await role.update({dashboard_template_id:id},{transaction});});res.json({success:true});}catch(error){failure(res,error);}};

exports.layout=async(req,res)=>{
  try{
    const role=req.user.Role;
    const template=role?.type==='Internal' && role.dashboard_template_id ? await db.DashboardTemplate.findOne({where:{id:role.dashboard_template_id,tenant_id:req.user.tenant_id}}):null;
    if(!template)return res.json({success:true,data:{template:null,widgets:[]}});
    const range=require('../utils/dashboardPeriod')(req.query.period);
    const {period,day,start,end:next}=range;
    const base={tenant_id:req.user.tenant_id,...(template.record_scope==='assigned'?{assigned_user_id:req.user.id}:{})};
    const dated={...base,created_at:{[Op.gte]:start,[Op.lt]:next}};
    const grouped=async(model,where)=>{const rows=await model.findAll({where,attributes:['status',[fn('COUNT',col('id')),'count']],group:['status'],raw:true});return rows.map(row=>({label:row.status,value:Number(row.count)}));};
    const result=[];
    for(const id of template.widgets){
      const definition=catalog.widgets.find(widget=>widget.id===id);
      if(!definition || !definition.modules.every(module=>allowed(req.user,module)))continue;
      let data={};
      if(id==='leads'){const items=await grouped(db.Lead,{...base,status:{[Op.ne]:'Archived'}});data={value:items.reduce((sum,row)=>sum+row.value,0),items,caption:'Current active pipeline'};}
      if(id==='followups'){const where={...base,status:'Follow-up',next_follow_up_date:{[Op.lte]:day}};data={value:await db.Lead.count({where}),rows:(await db.Lead.findAll({where,attributes:['id','company_name','status','next_follow_up_date','created_by','assigned_user_id'],limit:6,order:[['next_follow_up_date','ASC']]})).map(row=>({id:row.id,label:row.company_name,detail:row.next_follow_up_date,to:`/leads/${row.id}`,record:row})),caption:'Due today or overdue'};}
      if(id==='sales')data={value:await db.SalesOrder.count({where:dated}),caption:'Created in selected period'};
      if(id==='work'){const where={...base,status:{[Op.notIn]:['Completed','Cancelled','CompletedInvoicePending','CompletedInvoiceCreated']}};data={value:await db.ServiceOrder.count({where}),rows:(await db.ServiceOrder.findAll({where,attributes:['id','status'],limit:6,order:[['created_at','ASC']]})).map(row=>({id:row.id,label:`SRV-${String(row.id).padStart(5,'0')}`,detail:row.status,to:`/services?search=SRV-${String(row.id).padStart(5,'0')}`})),caption:'Current unfinished work, including waiting and on-hold services'};}
      if(id==='services'){const items=await grouped(db.ServiceOrder,dated);data={value:items.reduce((sum,row)=>sum+row.value,0),items,caption:'Created in selected period'};}
      if(id==='documents'){const limitDay=new Date(new Date(day+'T00:00:00Z').getTime()+30*86400000).toISOString().slice(0,10);const where={...base,expiry_date:{[Op.lte]:limitDay}};data={value:await db.Document.count({where}),caption:'Expired or expiring within 30 days',rows:(await db.Document.findAll({where,attributes:['id','doc_number','expiry_date'],limit:6,order:[['expiry_date','ASC']]})).map(row=>({id:row.id,label:row.doc_number||`Document #${row.id}`,detail:row.expiry_date,to:'/documents'}))};}
      if(id==='clients')data={value:await db.Customer.count({where:dated}),caption:'Created in selected period'};
      if(id==='revenue'){const where={...dated,status:{[Op.ne]:'Cancelled'}};const [total,paid]=await Promise.all([db.Invoice.sum('total',{where}),db.Invoice.sum('paid_amount',{where})]);data={value:Number(total||0),money:true,items:[{label:'Invoice Paid',value:Number(paid||0)},{label:'Total Receivable',value:Math.max(0,Number(total||0)-Number(paid||0))}],caption:'Selected period'};}
      if(id==='profit'){const totals=await require('../utils/profitTotals')(dated,dated);data={value:totals.net_profit,money:true,items:[{label:'Service charges',value:totals.service_charges},{label:'Expenses',value:totals.expenses}],caption:'Selected period'};}
      if(id==='aged')data={value:await db.Invoice.count({where:{...base,created_at:{[Op.lt]:require('../utils/invoiceAging').invoiceAgingCutoff('30')}}}),caption:'30+ days since invoice date'};
      if(id==='wallets'){const wallets=await db.WalletAccount.findAll({where:{...base,is_active:true},attributes:['id','name','balance']});data={value:wallets.reduce((sum,row)=>sum+Number(row.balance),0),money:true,items:wallets.map(row=>({label:row.name,value:Number(row.balance)})),caption:'Current balances'};}
      if(id==='actions'){const options=[['invoices','Invoice','/invoices?action=create'],['sales_orders','Sales order','/sales-orders?action=create'],['services','Service','/services?action=create'],['documents','Document','/documents?action=create'],['leads','Lead','/leads?action=create']];data={actions:options.filter(([module])=>allowed(req.user,module,'create')).map(([,label,to])=>({label,to}))};}
      const to=id==='aged' && !allowed(req.user,'reports')?'/invoices':id==='profit' && !allowed(req.user,'reports')?null:definition.to;
      result.push({id,title:definition.title,icon:definition.icon,to,...data});
    }
    res.json({success:true,data:{template:{id:template.id,name:template.name,description:template.description,record_scope:template.record_scope},period,widgets:result}});
  }catch(error){res.status(500).json({success:false,message:error.message});}
};
