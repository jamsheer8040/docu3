const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {defineStore,createPinia,setActivePinia}=require('pinia');
const source=fs.readFileSync(path.join(__dirname,'../stores/salary.js'),'utf8').replace(/^import[^\r\n]*$/gm,'').replace('export const useSalaryStore =','globalThis.factory =');
function storage(){const data=new Map([['auth_user',JSON.stringify({id:1,tenant_id:1})]]);return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};}
function store(api,local=storage(),ready=true){
  const context={defineStore,crypto:webcrypto,localStorage:local,useNuxtApp:()=>({$api:api}),console};vm.createContext(context);vm.runInContext(source,context);setActivePinia(createPinia());
  const state=context.factory();if(ready){state.loadedMonth=state.currentMonth;state.monthData={isBooked:true,payroll:{id:1,Items:[]}};}
  return {state,local};
}
const refresh=async()=>({data:{success:true,isBooked:true,payroll:{id:1,Items:[]},data:{}}});
const success=()=>({data:{success:true,data:{payment:{id:1}}}});
test('lost responses reuse the same persisted reference and frozen amount; a new instalment uses another reference',async()=>{
  const keys=[],bodies=[];let fail=true;
  const {state,local}=store({post:async(url,body,config)=>{keys.push(config.headers['Idempotency-Key']);bodies.push(JSON.stringify(body));if(fail){fail=false;throw Error('Lost response');}return success();},get:refresh});
  const body={salary_item_id:1,account_id:2,amount:100};await assert.rejects(state.paySingleSalary(body));body.amount=999;
  await state.retryPendingPayment();assert.equal(keys[0],keys[1]);assert.equal(bodies[0],bodies[1]);assert.equal(state.pendingPayment,null);
  await state.paySingleSalary({salary_item_id:1,account_id:2,amount:100});assert.notEqual(keys[1],keys[2]);assert.equal(local.data.size,1);
});
test('a browser reload restores and confirms the original batch request',async()=>{
  let key;const local=storage();
  const first=store({post:async(url,body,config)=>{key=config.headers['Idempotency-Key'];throw Error('Lost response');},get:refresh},local).state;
  await assert.rejects(first.payBatchSalary({salary_item_ids:[1,2],account_id:3}));
  const reloaded=store({post:async(url,body,config)=>{assert.equal(config.headers['Idempotency-Key'],key);assert.equal(JSON.stringify(body.salary_item_ids),'[1,2]');return success();},get:refresh},local).state;
  reloaded.restorePendingPayment();assert.equal(reloaded.pendingPayment.kind,'batch');await reloaded.retryPendingPayment();assert.equal(reloaded.pendingPayment,null);
});
test('changed details or a new batch cannot bypass an unresolved individual transfer',async()=>{
  let posts=0;const {state}=store({post:async()=>{posts++;throw Error('Lost response');},get:refresh});
  await assert.rejects(state.paySingleSalary({salary_item_id:1,amount:100}));
  await assert.rejects(state.paySingleSalary({salary_item_id:1,amount:200}),/previous salary transfer/);
  await assert.rejects(state.payBatchSalary({salary_item_ids:[1]}),/previous salary transfer/);assert.equal(posts,1);
});
test('double submission is blocked before a second HTTP request',async()=>{
  let resolve,posts=0;const {state}=store({post:()=>{posts++;return new Promise(done=>resolve=done);},get:refresh});
  const first=state.paySingleSalary({salary_item_id:1,amount:100});
  await assert.rejects(state.paySingleSalary({salary_item_id:1,amount:100}),/already processing/);resolve(success());await first;assert.equal(posts,1);
});
test('successful payment plus failed refresh is not treated as a failed transfer',async()=>{
  let posts=0,failRefresh=true;const {state}=store({post:async()=>{posts++;return success();},get:async()=>{if(failRefresh)throw Error('Offline');return refresh();}});
  assert.equal((await state.paySingleSalary({salary_item_id:1,amount:100})).success,true);assert.equal(state.pendingPayment,null);assert.match(state.paymentRefreshWarning,/Payment recorded successfully/);
  await assert.rejects(state.paySingleSalary({salary_item_id:1,amount:100}),/refreshing failed/);assert.equal(posts,1);
  failRefresh=false;await state.fetchMonthPayroll();assert.equal(state.paymentRefreshWarning,'');
});
test('a definite initial rejection allows correction, while an ambiguous earlier result remains protected',async()=>{
  const rejected=store({post:async()=>{throw {response:{status:400,data:{message:'Invalid amount'}}};},get:refresh}).state;
  await assert.rejects(rejected.paySingleSalary({amount:-1}));assert.equal(rejected.pendingPayment,null);
  let unknown=true;const {state}=store({post:async()=>{if(unknown){unknown=false;throw Error('Lost response');}throw {response:{status:403}};},get:refresh});
  await assert.rejects(state.paySingleSalary({amount:100}));const key=state.pendingPayment.key;await assert.rejects(state.retryPendingPayment());assert.equal(state.pendingPayment.key,key);
});
test('persisting the request is required before any money-moving call',async()=>{
  let posts=0;const local=storage();local.setItem=()=>{throw Error('Storage unavailable');};
  const {state}=store({post:async()=>{posts++;return success();},get:refresh},local);
  await assert.rejects(state.paySingleSalary({amount:100}),/Storage unavailable/);assert.equal(posts,0);
});
test('pending transfers are isolated by the signed-in user and workspace',async()=>{
  const local=storage();const {state}=store({post:async()=>{throw Error('Lost response');},get:refresh},local);
  await assert.rejects(state.paySingleSalary({amount:100}));local.setItem('auth_user',JSON.stringify({id:2,tenant_id:2}));
  state.restorePendingPayment();assert.equal(state.pendingPayment,null);assert.ok(local.data.has('salary-payment:1:1'));
});
test('a previous user or permission view cannot repopulate salary data after access changes',async()=>{
 for(const action of ['fetchMonthPayroll','fetchSummary','fetchPaymentHistory']){
  let resolve;const {state,local}=store({get:()=>new Promise(done=>resolve=done)});
  const pending=state[action](action==='fetchPaymentHistory'?1:'2030-01');
  local.setItem('auth_user',JSON.stringify({id:2,tenant_id:2}));state.clearSalaryView();
  resolve({data:{success:true,isBooked:true,payroll:{total_amount:9999},data:[{amount:9999}]}});await pending;
  assert.equal(state.payroll,null);assert.equal(state.paymentHistory.length,0);assert.equal(state.summary.salary.total,0);
 }
});
test('an old transfer response cannot erase the new users pending transfer or populate their payroll',async()=>{
 let resolve,gets=0;const {state,local}=store({post:()=>new Promise(done=>resolve=done),get:async()=>{gets++;return refresh();}});
 const old=state.paySingleSalary({salary_item_id:1,amount:100});
 local.setItem('auth_user',JSON.stringify({id:2,tenant_id:2}));
 local.setItem('salary-payment:2:2',JSON.stringify({kind:'single',key:'new-user-reference',payload:{salary_item_id:2,amount:200},month:'2030-02'}));
 state.clearSalaryView();resolve(success());await old;
 assert.equal(state.pendingPayment.key,'new-user-reference');assert.ok(local.getItem('salary-payment:2:2'));assert.equal(gets,0);
});

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const payroll=(id)=>({data:{success:true,isBooked:true,payroll:{id,Items:[{id}],total_amount:100,paid_amount:0}}});
const summary=(total)=>({data:{success:true,data:{salary:{total},operational:{total:0},combined:{total}}}});

test('changing month clears old rows immediately and older responses cannot replace the latest month or loader',async()=>{
 const a=deferred(),b=deferred();
 const {state}=store({get:url=>url.includes('summary')?Promise.resolve(summary(200)):url.endsWith('2030-01')?a.promise:b.promise});
 state.monthData=payroll(99).data;state.paymentHistory=[{amount:10}];
 const first=state.fetchMonthPayroll('2030-01');assert.equal(state.items.length,0);assert.equal(state.paymentHistory.length,0);assert.equal(state.monthReady,false);
 const latest=state.fetchMonthPayroll('2030-02');a.resolve(payroll(1));await first;
 assert.equal(state.loading,true);assert.equal(state.items.length,0);
 b.resolve(payroll(2));await latest;assert.equal(state.payroll.id,2);assert.equal(state.loadedMonth,'2030-02');assert.equal(state.monthReady,true);assert.equal(state.summary.salary.total,200);
});

test('failed reload leaves no old records and blocks new payments, booking and cancellation until recovery',async()=>{
 let fail=true,posts=0;const {state}=store({get:async url=>{if(fail)throw Error('Payroll offline');return url.includes('summary')?summary(100):payroll(1);},post:async()=>{posts++;return success();}});
 await state.fetchMonthPayroll('2030-03');assert.equal(state.payroll,null);assert.equal(state.monthReady,false);assert.match(state.monthError,/offline/);
 await assert.rejects(state.paySingleSalary({amount:10}),/Load the selected payroll/);
 await assert.rejects(state.bookMonthSalary({items:[]}),/Load the selected payroll/);
 await assert.rejects(state.unbookMonthSalary(),/Load the selected payroll/);assert.equal(posts,0);
 fail=false;await state.fetchMonthPayroll();assert.equal(state.monthError,null);assert.equal(state.monthReady,true);
});

test('same-month stale failures cannot overwrite a successful newer reload',async()=>{
 const old=deferred();let calls=0;const {state}=store({get:url=>url.includes('summary')?Promise.resolve(summary(7)):++calls===1?old.promise:Promise.resolve(payroll(7))});
 const pending=state.fetchMonthPayroll('2030-04');await state.fetchMonthPayroll('2030-04');old.reject(Error('Old failure'));await pending;
 assert.equal(state.payroll.id,7);assert.equal(state.monthError,null);assert.equal(state.monthReady,true);
});

test('payment history switches staff atomically, reports failure, and ignores responses after closing',async()=>{
 const a=deferred(),b=deferred(),c=deferred();let calls=0;const {state}=store({get:()=>[a,b,c][calls++].promise});
 state.paymentHistory=[{amount:99}];const first=state.fetchPaymentHistory(1);assert.equal(state.paymentHistory.length,0);
 const second=state.fetchPaymentHistory(2);a.resolve({data:{success:true,data:[{amount:100}]}});await first;assert.equal(state.historyLoading,true);assert.equal(state.paymentHistory.length,0);
 b.reject(Error('History offline'));await second;assert.match(state.historyError,/offline/);assert.equal(state.historyItemId,2);assert.equal(state.paymentHistory.length,0);
 const third=state.fetchPaymentHistory(3);state.clearPaymentHistory();c.resolve({data:{success:true,data:[{amount:300}]}});await third;
 assert.equal(state.paymentHistory.length,0);assert.equal(state.historyLoading,false);assert.equal(state.historyError,null);
});

test('summary failures clear old totals and stale summary requests cannot replace the latest result',async()=>{
 const old=deferred();let calls=0;const {state}=store({get:()=>++calls===1?old.promise:Promise.resolve(summary(8))});
 const pending=state.fetchSummary();await state.fetchSummary();old.resolve(summary(99));await pending;assert.equal(state.summary.salary.total,8);
 const broken=store({get:async()=>{throw Error('Summary offline');}}).state;broken.summary=summary(99).data.data;
 await broken.fetchSummary();assert.equal(broken.summary.salary.total,0);assert.match(broken.summaryError,/offline/);
});

test('unconfirmed transfers can still be retried after a loading failure without switching the viewed month',async()=>{
 let fail=true,keys=[];const {state}=store({post:async(url,body,config)=>{keys.push(config.headers['Idempotency-Key']);if(fail){fail=false;throw Error('Lost reply');}return success();},get:async url=>url.includes('summary')?summary(0):payroll(2)});
 state.currentMonth='2030-01';state.loadedMonth='2030-01';await assert.rejects(state.paySingleSalary({amount:10}));
 state.currentMonth='2030-02';state.loadedMonth=null;state.monthError='Offline';
 await state.retryPendingPayment();assert.equal(keys[0],keys[1]);assert.equal(state.currentMonth,'2030-02');assert.equal(state.payroll.id,2);
});

test('saved booking and cancellation remain successful if refreshing fails',async()=>{
 for(const action of ['bookMonthSalary','unbookMonthSalary']){
  const {state}=store({post:async()=>success(),delete:async()=>success(),get:async()=>{throw Error('Refresh offline');}});
  const r=await state[action](action==='bookMonthSalary'?{items:[]}:undefined);
  assert.equal(r.success,true);assert.equal(r.refreshFailed,true);assert.equal(state.monthReady,false);assert.equal(state.mutationLoading,false);
 }
});

test('a delayed booking confirmation does not pull the user back to the original month',async()=>{
 const saved=deferred(),gets=[];const {state}=store({post:()=>saved.promise,get:async url=>{gets.push(url);return url.includes('summary')?summary(2):payroll(2);}});
 state.currentMonth='2030-01';state.loadedMonth='2030-01';const booking=state.bookMonthSalary({items:[]});
 await state.fetchMonthPayroll('2030-02');saved.resolve(success());await booking;
 assert.equal(state.currentMonth,'2030-02');assert.equal(state.payroll.id,2);assert.ok(!gets.some(url=>url.includes('2030-01')));
});

test('salary reversal uses the original payment reference and a saved reversal survives failed refresh',async()=>{
 let posted;const {state}=store({post:async(url,body)=>{posted={url,body};return success();},get:async()=>{throw Error('Reload offline');}});
 const result=await state.reverseSalaryPayment(12,'Wrong wallet');assert.equal(posted.url,'/salaries/payments/12/reverse');assert.equal(posted.body.reason,'Wrong wallet');assert.equal(result.success,true);assert.equal(result.refreshFailed,true);assert.equal(state.monthReady,false);assert.equal(state.mutationLoading,false);
});

test('an uncertain reversal clears stale balances and requires loading before another financial action',async()=>{
 const {state}=store({post:async()=>{throw Error('Lost reversal reply');}});
 await assert.rejects(state.reverseSalaryPayment(12,'Wrong wallet'));assert.equal(state.payroll,null);assert.equal(state.monthReady,false);assert.match(state.monthError,/check payment history/);assert.equal(state.mutationLoading,false);
 await assert.rejects(state.paySingleSalary({amount:10}),/Load the selected payroll/);
});

test('monthly paid-balance display retains the final one fils exactly',()=>{
 const {state}=store({});state.monthData={isBooked:true,payroll:{total_amount:'60.00',paid_amount:'59.99',Items:[]}};
 assert.equal(state.monthTotals.pending,0.01);
});

test('cancellation sends the exact loaded payroll ID instead of selecting by month alone',async()=>{
 let sent;const {state}=store({delete:async(url,config)=>{sent={url,id:config.params.payroll_id};return success();},get:refresh});
 state.currentMonth='2034-01';state.loadedMonth='2034-01';state.monthData=payroll(123).data;
 await state.unbookMonthSalary();assert.equal(sent.url,'/salaries/month/2034-01');assert.equal(sent.id,'123');
});

test('conflicting and uncertain cancellations clear old data and require review before another cancellation',async()=>{
 for(const failure of [Error('Lost reply'),{response:{status:409,data:{message:'Payroll has changed'}}}]){
  let deletes=0;const {state}=store({delete:async()=>{deletes++;throw failure;}});
  await assert.rejects(state.unbookMonthSalary());assert.equal(state.payroll,null);assert.equal(state.monthReady,false);assert.ok(state.monthError);
  await assert.rejects(state.unbookMonthSalary(),/Load the selected payroll/);assert.equal(deletes,1);
 }
});
