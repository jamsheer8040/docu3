<template>
  <v-card class="pa-4 border" rounded="xl" variant="flat">
    <div class="d-flex align-center justify-space-between mb-3"><h2 class="text-h6">Invoice commission</h2><v-btn icon="mdi-refresh" size="small" variant="text" :loading="loading" aria-label="Refresh commission" @click="load" /></div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert><v-progress-linear v-if="loading" indeterminate />
    <template v-if="data">
      <div class="d-flex flex-wrap align-center ga-3 mb-3"><v-chip size="small" :color="data.eligible?'success':'warning'">{{ data.eligible?'Eligible':'Not eligible' }}</v-chip><v-chip size="small">{{ data.status==='Pending'?'Pending approval':data.status }}</v-chip><span>{{ data.recipient?.name || 'No salesperson assigned' }}</span></div>
      <p class="text-caption text-medium-emphasis mb-3">{{ data.reason }}</p>
      <v-row dense><v-col cols="12" sm="7"><v-text-field :model-value="money(data.service_charge)" label="Service charge after discount (AED)" readonly density="compact" hide-details /><div class="text-caption mt-2">{{ data.percentage }}% × AED {{ money(data.service_charge) }}</div></v-col><v-col cols="12" sm="5"><v-text-field :model-value="money(data.calculated_amount)" label="Calculated commission (AED)" readonly density="compact" hide-details /></v-col></v-row>
      <p class="text-caption text-medium-emphasis my-3">Calculated and saved automatically. Only approved commission reduces recorded profit. {{ data.release_status }}</p>
      <v-btn v-if="data.can_resubmit" size="small" color="primary" :loading="saving" @click="resubmit">Recalculate and resubmit</v-btn>
      <v-divider class="my-4" /><h3 class="text-subtitle-1 mb-3">Invoice net profit</h3>
      <div v-for="row in rows" :key="row.label" class="d-flex justify-space-between text-body-2 mb-2"><span>{{ row.label }}</span><span>AED {{ money(row.amount) }}</span></div>
      <div class="d-flex justify-space-between font-weight-bold mt-3"><span>Recorded net profit</span><span>AED {{ money(data.profit.net_profit) }}</span></div>
      <div v-if="data.eligible && ['Pending','Draft'].includes(data.status)" class="d-flex justify-space-between text-caption mt-2"><span>Net profit if approved</span><span>AED {{ money(data.profit.projected_net_profit) }}</span></div>
    </template>
  </v-card>
</template>
<script setup>
import {computed,ref,watch} from 'vue';
const props=defineProps({invoiceId:{type:Number,required:true}}),emit=defineEmits(['saved']);
const {$api}=useNuxtApp(),data=ref(null),loading=ref(false),saving=ref(false),error=ref('');let sequence=0;
const money=value=>Number(value || 0).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2});
const rows=computed(()=>[{label:'Invoice total after discount',amount:data.value?.profit.total},{label:'VAT excluded',amount:data.value?.profit.tax},{label:'Cost',amount:data.value?.profit.cost},{label:'Other expenses',amount:data.value?.profit.other_expenses},{label:'Approved commission',amount:data.value?.profit.commission}]);
function accept(value){data.value=value;emit('saved',value.profit);}
async function load(){const current=++sequence,id=props.invoiceId;loading.value=true;error.value='';data.value=null;try{const r=await $api.get(`/commissions/invoices/${id}`);if(current===sequence)accept(r.data.data);}catch(e){if(current===sequence)error.value=e.response?.data?.message || 'Unable to load commission.';}finally{if(current===sequence)loading.value=false;}}
async function resubmit(){if(saving.value)return;saving.value=true;try{accept((await $api.put(`/commissions/invoices/${props.invoiceId}`,{})).data.data);}catch(e){error.value=e.response?.data?.message || 'Unable to resubmit.';}finally{saving.value=false;}}
watch(()=>props.invoiceId,load,{immediate:true});
</script>
