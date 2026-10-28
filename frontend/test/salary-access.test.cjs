const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../utils/recordPermissions.js'),'utf8').replace(/export /g,'');
const policy={};vm.createContext(policy);vm.runInContext(source,policy);
const rules={list:'all',detail:'all',create:false,edit:'none',delete:'none'};
const user=(permissions,extra={})=>({id:12,tenant_id:1,role:'HR',role_type:'Internal',permissions,...extra});
test('Expenses permissions do not grant salary access and portal overrides even an Admin name',()=>{
 assert.equal(policy.canAccessSalary(user({expenses:{read:true,write:true}})),false);
 assert.equal(policy.canAccessSalary(user({staff:{read:true,write:true}},{role:'Admin',role_type:'CustomerPortal'})),false);
 assert.equal(policy.canAccessSalary(user({staff:{read:true}})),true);
});
test('salary requires both Staff list and detail; Create, Edit and Delete stay independent',()=>{
 for(const missing of [{list:'none'},{detail:'none'}])assert.equal(policy.canAccessSalary(user({staff:{rules:{...rules,...missing}}})),false);
 const creator=user({staff:{rules:{...rules,create:true}}});assert.equal(policy.canAccessSalary(creator,'create'),true);assert.equal(policy.canAccessSalary(creator,'edit'),false);
 const deleter=user({staff:{rules:{...rules,delete:'all'}}});assert.equal(policy.canAccessSalary(deleter,'delete'),true);assert.equal(policy.canAccessSalary(deleter,'create'),false);
 const scoped=user({staff:{rules:{...rules,edit:'assigned'}}});assert.equal(policy.canAccessSalary(scoped,'edit',{assigned_user_id:12}),true);assert.equal(policy.canAccessSalary(scoped,'edit',{assigned_user_id:99}),false);
});
test('Staff-only HR can navigate to payroll without an Expenses grant',async()=>{
 const actor=user({staff:{read:true}});const redirects=[];
 const context={...policy,useAuthStore:()=>({isAuthenticated:true,user:actor,can:(module,action)=>policy.canAccess(actor,module,action),fetchMe:async()=>{}}),useConfigStore:()=>({commissionEnabled:true,fetchSettings:async()=>{}}),useNuxtApp:()=>({$pinia:{}}),navigateTo:path=>redirects.push(path),defineNuxtRouteMiddleware:fn=>fn,console};
 const middleware=fs.readFileSync(path.join(__dirname,'../middleware/auth.global.ts'),'utf8').replace(/^import[^\r\n]*$/gm,'').replace('export default','globalThis.guard =').replace('import.meta.server','false').replace(': Record<string, string>','');
 vm.createContext(context);vm.runInContext(middleware,context);await context.guard({path:'/expenses',query:{tab:'salary'}},{path:'/expenses'});assert.equal(redirects.length,0);
});
