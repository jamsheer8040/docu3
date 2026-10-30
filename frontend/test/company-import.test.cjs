const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function panel(post){
 const source=fs.readFileSync(path.join(__dirname,'../components/settings/CompanyBackup.vue'),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
 class Form{constructor(){this.values={};}append(key,value){this.values[key]=value;}}
 const context={ref:value=>({value}),computed:fn=>({get value(){return fn();}}),watch(){},onMounted(){},useAuthStore:()=>({isAdmin:true,user:{role_type:'Internal'}}),useNuxtApp:()=>({$api:{post}}),FormData:Form,Blob,console};
 vm.createContext(context);return vm.runInContext(source+'\n;({backupFile,importMode,validation,confirmationText,importing,error,result,recovery,confirmOpen,validateBackup,importBackup})',context);
}
test('validation requires a selected SQL backup within the size limit',async()=>{
 let calls=0;const ui=panel(async()=>{calls++;return{data:{data:{file_hash:'file',state_hash:'state'}}};});
 await ui.validateBackup();assert.equal(calls,0);
 ui.backupFile.value={size:26*1024*1024};await ui.validateBackup();assert.equal(calls,0);assert.match(ui.error.value,/25 MB/);
 ui.backupFile.value={size:10};await ui.validateBackup();assert.equal(calls,1);assert.equal(ui.validation.value.file_hash,'file');
});
test('import requires validation and exact mode confirmation and blocks a second submission',async()=>{
 let finish,calls=0,submitted;const ui=panel(async(url,form)=>{assert.equal(url,'/config/backups/company/import');calls++;submitted=form.values;return new Promise(resolve=>{finish=resolve;});});
 ui.backupFile.value={size:10};ui.importMode.value='replace';ui.confirmationText.value='REPLACE';await ui.importBackup();assert.equal(calls,0);
 ui.validation.value={file_hash:'file',state_hash:'state'};ui.confirmationText.value='MERGE';await ui.importBackup();assert.equal(calls,0);
 ui.confirmationText.value='REPLACE';const first=ui.importBackup();await ui.importBackup();assert.equal(calls,1);assert.equal(submitted.mode,'replace');assert.equal(submitted.confirmation,'REPLACE');assert.equal(submitted.file_hash,'file');assert.equal(submitted.state_hash,'state');
 finish({data:{data:{recovery:'safe.sql',inserted:1}}});await first;assert.equal(ui.importing.value,false);assert.equal(ui.validation.value,null);assert.equal(ui.recovery.value,'safe.sql');
});
test('a failed or stale import clears validation and shows the server explanation',async()=>{
 const ui=panel(async()=>{throw{response:{data:{message:'Company data changed. Validate again.',recovery:'before.sql'}}};});
 ui.backupFile.value={size:10};ui.importMode.value='merge';ui.confirmationText.value='MERGE';ui.validation.value={file_hash:'file',state_hash:'state'};ui.confirmOpen.value=true;
 await ui.importBackup();assert.equal(ui.validation.value,null);assert.equal(ui.confirmOpen.value,false);assert.equal(ui.importing.value,false);assert.match(ui.error.value,/Company data changed/);assert.equal(ui.recovery.value,'before.sql');assert.equal(ui.result.value,null);
});
