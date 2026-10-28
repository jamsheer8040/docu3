const {Op}=require('sequelize');
const {actionScope}=require('./permissionRules');
const {predicate}=require('./recordAccess');
function canRead(user){return actionScope(user,'staff','list')!=='none' && actionScope(user,'staff','detail')!=='none';}
function fullView(user){return actionScope(user,'staff','list')==='all' && actionScope(user,'staff','detail')==='all';}
function visibleWhere(model,where){
  const db=require('../models');
  return {tenant_id:where.tenant_id,[Op.and]:[where,predicate(db,model,'list') || {},predicate(db,model,'detail') || {}]};
}
// Same predicate is used for the preview, automatic booking and submitted IDs.
// Non-login employees and employees without a role are legitimate staff.
async function eligibleStaff(tenant_id,transaction,ids){
  const {User,Role}=require('../models');
  const rows=await User.findAll({
    where:visibleWhere('User',{tenant_id,is_active:true,...(ids?{id:{[Op.in]:ids}}:{})}),
    attributes:['id','name','email','avatar','designation','phone','role_id','basic_salary','hr_allowance','other_allowances','total_salary'],
    include:[{model:Role,attributes:['id','name','type','tenant_id'],required:false,where:{tenant_id:{[Op.or]:[{[Op.eq]:tenant_id},{[Op.is]:null}]}}}],
    order:[['name','ASC']],transaction
  });
  return rows.filter(user=>!user.role_id || (user.Role?.type==='Internal' && user.Role.name!=='Developer' && (user.Role.tenant_id==null || Number(user.Role.tenant_id)===Number(tenant_id))));
}
module.exports={canRead,fullView,visibleWhere,eligibleStaff};
