const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function compose(post){
 const source=fs.readFileSync(path.join(__dirname,'../pages/documents/email/[id].vue'),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'');
 const messages=[],navigations=[];
 const context={ref:value=>({value}),computed:fn=>({get value(){return fn();}}),watch(){},onMounted(){},onBeforeUnmount(){},useRoute:()=>({params:{id:'7'}}),useAuthStore:()=>({can:()=>true}),useUIStore:()=>({showSuccess:message=>messages.push(message)}),useNuxtApp:()=>({$api:{post,get:async()=>({data:{data:{to:'customer@example.test',subject:'Expiry reminder',body:'Renew visa',from_email:'sender@gmail.com',from_name:'Company',configured:true}}})}}),navigateTo:async to=>navigations.push(to)};
 vm.createContext(context);
 const state=vm.runInContext(source+'\n;({form,loaded,configured,sending,error,composeForm,fromLabel,load,send})',context);
 state.composeForm.value={validate:async()=>({valid:true})};
 return {state,messages,navigations};
}
test('composer prefills from, to and content without sending or navigating',async()=>{
 let calls=0;const h=compose(async()=>{calls++;});await h.state.load();
 assert.equal(calls,0);assert.equal(h.state.form.value.to,'customer@example.test');assert.equal(h.state.fromLabel.value,'Company <sender@gmail.com>');assert.equal(h.state.form.value.body,'Renew visa');assert.equal(h.navigations.length,0);
});
test('composer validates CC and blocks double sends while preserving message on failure',async()=>{
 let finish,calls=0,payload;const h=compose(async(_,data)=>{calls++;payload=data;return new Promise(resolve=>{finish=resolve;});});await h.state.load();
 h.state.form.value.cc='bad';await h.state.send();assert.equal(calls,0);assert.match(h.state.error.value,/valid CC/);
 h.state.form.value.cc='cc@example.test; second@example.test';const first=h.state.send();await Promise.resolve();await h.state.send();assert.equal(calls,1);assert.deepEqual(Array.from(payload.cc),['cc@example.test','second@example.test']);
 finish({data:{success:false,message:'SMTP not available'}});await first;assert.equal(h.state.form.value.body,'Renew visa');assert.equal(h.state.error.value,'SMTP not available');assert.equal(h.state.sending.value,false);assert.equal(h.navigations.length,0);
});
test('composer requires configured sender and closes only after successful send',async()=>{
 let calls=0;const h=compose(async()=>{calls++;return{data:{success:true}};});await h.state.load();h.state.configured.value=false;await h.state.send();assert.equal(calls,0);
 h.state.configured.value=true;await h.state.send();assert.equal(calls,1);assert.equal(h.messages.length,1);assert.deepEqual(h.navigations,['/documents']);
});
