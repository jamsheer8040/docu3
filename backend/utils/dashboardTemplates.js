const widgets = [
  {id:'leads',title:'Lead pipeline',description:'New, contacted, qualified and follow-up lead counts.',modules:['leads'],icon:'mdi-account-group-outline',to:'/leads'},
  {id:'followups',title:'Follow-ups due',description:'Today’s and overdue lead follow-ups.',modules:['leads'],icon:'mdi-calendar-clock-outline',to:'/leads'},
  {id:'sales',title:'Sales orders',description:'Sales orders created in the selected period.',modules:['sales_orders'],icon:'mdi-file-document-outline',to:'/sales-orders'},
  {id:'work',title:'Service work queue',description:'Unfinished services, including assigned, waiting and on-hold work.',modules:['services'],icon:'mdi-clipboard-check-outline',to:'/services'},
  {id:'services',title:'Service status overview',description:'Service counts and completion progress.',modules:['services'],icon:'mdi-progress-check',to:'/services'},
  {id:'documents',title:'Document expiries',description:'Documents expired or expiring in the next 30 days.',modules:['documents'],icon:'mdi-file-clock-outline',to:'/documents'},
  {id:'clients',title:'Customers',description:'Customer count for the selected period.',modules:['customers'],icon:'mdi-account-outline',to:'/customers'},
  {id:'revenue',title:'Invoice revenue',description:'Invoice total, paid amount and receivable in the selected period.',modules:['invoices','financials'],icon:'mdi-chart-line',to:'/invoices'},
  {id:'profit',title:'Net profit',description:'Service charges created minus expenses in the selected period.',modules:['invoices','expenses','financials'],icon:'mdi-chart-timeline-variant',to:'/reports?report=profit'},
  {id:'aged',title:'Aged invoices',description:'Invoices at least 30 days old.',modules:['invoices'],icon:'mdi-receipt-text-clock-outline',to:'/reports?report=invoice&aging=30'},
  {id:'wallets',title:'Wallet balances',description:'Current balances of accessible active wallets.',modules:['wallet'],icon:'mdi-wallet-outline',to:'/wallet'},
  {id:'actions',title:'Quick actions',description:'Create links for modules this role can create records in.',modules:[],icon:'mdi-lightning-bolt-outline'}
];
const presets=[
  {name:'Admin Overview',description:'Business totals, financial overview and operational priorities.',record_scope:'accessible',widgets:['revenue','profit','leads','sales','services','documents','wallets','aged','clients','followups','work','actions']},
  {name:'Sales Focus',description:'Assigned leads, follow-ups and sales activity.',record_scope:'assigned',widgets:['followups','leads','sales','actions']},
  {name:'Work Focus',description:'Assigned service work and document deadlines.',record_scope:'assigned',widgets:['work','services','documents','actions']}
];
function validate(body){
  if(typeof body.name!=='string' || !body.name.trim() || body.name.trim().length>100)throw new Error('Enter a template name up to 100 characters.');
  if(body.description!=null && (typeof body.description!=='string' || body.description.length>500))throw new Error('Description must be up to 500 characters.');
  if(!['accessible','assigned'].includes(body.record_scope))throw new Error('Choose an allowed record scope.');
  if(!Array.isArray(body.widgets) || body.widgets.length>widgets.length || new Set(body.widgets).size!==body.widgets.length || body.widgets.some(id=>!widgets.some(widget=>widget.id===id)))throw new Error('Choose valid dashboard cards, without duplicates.');
  return {name:body.name.trim(),description:body.description?.trim() || null,record_scope:body.record_scope,widgets:body.widgets};
}
async function templateId(id,tenant_id,type='Internal',transaction){
  if(id==null || id==='')return null;
  if(type!=='Internal')throw new Error('Dashboard templates are for internal roles.');
  if(!Number.isSafeInteger(Number(id)) || Number(id)<=0)throw new Error('Invalid dashboard template.');
  const template=await require('../models').DashboardTemplate.findOne({where:{id,tenant_id},transaction,...(transaction?{lock:transaction.LOCK.UPDATE}:{})});
  if(!template)throw new Error('Dashboard template was not found in this workspace.');
  return template.id;
}
module.exports={widgets,presets,validate,templateId};
