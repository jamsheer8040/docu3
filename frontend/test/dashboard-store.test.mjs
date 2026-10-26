import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPinia,setActivePinia} from 'pinia';
import {useDashboardStore} from '../stores/dashboard.js';

test('period switching ignores older responses and clears earlier failures',async()=>{
  setActivePinia(createPinia());
  const pending=[];
  globalThis.useNuxtApp=()=>({$api:{get:(url,options)=>new Promise((resolve,reject)=>pending.push({url,options,resolve,reject}))}});
  const store=useDashboardStore();
  const yearly=store.fetchStats({period:'yearly'});
  const monthly=store.fetchStats({period:'monthly'});
  assert.equal(pending[0].options.params.period,'yearly');
  assert.equal(pending[1].options.params.period,'monthly');
  pending[1].resolve({data:{success:true,data:{period:'monthly',monthly_receivable:130}}});await monthly;
  pending[0].resolve({data:{success:true,data:{period:'yearly',monthly_receivable:900}}});await yearly;
  assert.equal(store.stats.period,'monthly');assert.equal(store.stats.monthly_receivable,130);assert.equal(store.loading,false);
  const failed=store.fetchStats({period:'today'});pending[2].reject(new Error('Offline'));await failed;
  assert.match(store.error,/Failed to fetch/);
  const retry=store.fetchStats({period:'today'});assert.equal(store.error,null);
  pending[3].resolve({data:{success:true,data:{period:'today',monthly_receivable:20}}});await retry;
  assert.equal(store.stats.period,'today');assert.equal(store.loading,false);
  const oldFailure=store.fetchStats({period:'yearly'}),latest=store.fetchStats({period:'monthly'});
  pending[4].reject(new Error('Old failure'));await oldFailure;assert.equal(store.loading,true);assert.equal(store.error,null);
  pending[5].resolve({data:{success:true,data:{period:'monthly',monthly_receivable:130}}});await latest;
  assert.equal(store.error,null);assert.equal(store.stats.period,'monthly');
});
