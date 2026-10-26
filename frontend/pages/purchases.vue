<template>
  <v-container fluid class="purchases-page pa-4 pa-md-6">
    <header class="purchase-header mb-6">
      <div><p class="text-overline text-medium-emphasis">PURCHASING</p><h1 class="text-h4 font-weight-bold">Purchases</h1><p class="text-body-2 text-medium-emphasis mt-2">Supplier purchases, payments and outstanding balances</p></div>
      <v-btn to="/suppliers" color="primary" rounded="pill" prepend-icon="mdi-truck-delivery-outline">Suppliers</v-btn>
    </header>
    <v-row class="mb-4">
      <v-col v-for="metric in metrics" :key="metric.label" cols="12" sm="4"><v-card rounded="xl" flat class="pa-5 purchase-card"><p class="text-caption text-medium-emphasis mb-2">{{ metric.label }}</p><strong class="text-h5" :class="metric.color">{{ money(metric.value) }}</strong><p class="text-caption text-medium-emphasis mt-2">{{ filtered.length }} matching purchases</p></v-card></v-col>
    </v-row>
    <v-card rounded="xl" flat class="purchase-card pa-4 mb-5">
      <v-row dense>
        <v-col cols="12" md="5"><v-text-field v-model="search" label="Search purchases" placeholder="Description, supplier or purchase number" prepend-inner-icon="mdi-magnify" variant="outlined" rounded="xl" hide-details clearable @update:model-value="page=1" /></v-col>
        <v-col cols="12" sm="6" md="3"><v-select v-model="supplierId" :items="supplierOptions" label="Supplier" variant="outlined" rounded="xl" hide-details @update:model-value="page=1" /></v-col>
        <v-col cols="12" sm="6" md="3"><v-select v-model="status" :items="['All statuses','Unpaid','Partially Paid','Paid']" label="Payment status" variant="outlined" rounded="xl" hide-details @update:model-value="page=1" /></v-col>
        <v-col cols="12" md="1" class="d-flex align-center justify-end"><v-btn icon="mdi-refresh" aria-label="Refresh purchases" variant="text" :loading="loading" @click="load" /></v-col>
      </v-row>
    </v-card>
    <v-alert v-if="error" type="error" variant="tonal" rounded="xl" class="mb-4">{{ error }}<v-btn variant="text" @click="load">Retry</v-btn></v-alert>
    <v-card rounded="xl" flat class="purchase-card overflow-hidden">
      <v-data-table v-model:page="page" :headers="headers" :items="filtered" :loading="loading" :items-per-page="15" hover>
        <template #item.id="{ item }"><strong>PUR-{{ item.id }}</strong></template>
        <template #item.created_at="{ item }">{{ formatDate(item.created_at) }}</template>
        <template #item.supplier="{ item }"><NuxtLink :to="`/suppliers/${item.supplier_id}`" class="text-primary font-weight-medium">{{ item.Supplier?.name }}</NuxtLink></template>
        <template #item.description="{ item }"><div class="purchase-description">{{ item.description || 'Supplier purchase' }}<small class="d-block text-medium-emphasis">{{ sourceLabel(item) }}</small></div></template>
        <template #item.amount="{ item }">{{ money(item.amount) }}</template>
        <template #item.paid_amount="{ item }">{{ money(item.paid_amount) }}</template>
        <template #item.balance="{ item }"><span :class="balance(item)>0 ? 'text-error' : 'text-success'">{{ money(balance(item)) }}</span></template>
        <template #item.status="{ item }"><v-chip :color="item.status==='Paid'?'success':item.status==='Partially Paid'?'warning':'error'" size="small" variant="tonal">{{ item.status }}</v-chip></template>
        <template #item.actions="{ item }"><v-btn :to="`/suppliers/${item.supplier_id}`" variant="text" size="small" color="primary">View supplier</v-btn></template>
        <template #no-data><div class="pa-8 text-center"><v-icon icon="mdi-shopping-outline" size="36" color="primary" class="mb-3" /><h2 class="text-h6">{{ purchases.length ? 'No matching purchases' : 'No purchases yet' }}</h2><p class="text-body-2 text-medium-emphasis mt-2">{{ purchases.length ? 'Try changing your search or filters.' : 'Supplier purchases from services and invoices will appear here.' }}</p></div></template>
      </v-data-table>
    </v-card>
  </v-container>
</template>
<script setup>
const { $api }=useNuxtApp();
const purchases=ref([]),loading=ref(false),error=ref(''),search=ref(''),supplierId=ref('all'),status=ref('All statuses'),page=ref(1);
const money=value=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'}).format(Number(value||0));
const balance=item=>Math.max(0,Number(item.amount||0)-Number(item.paid_amount||0));
const formatDate=value=>value?new Date(value).toLocaleDateString('en-GB'):'—';
const sourceLabel=item=>({ServiceOrder:'Service order',InvoiceItem:'Invoice item',Manual:'Manual purchase'}[item.reference_type]||'Purchase')+(item.reference_id?` #${item.reference_id}`:'');
const supplierOptions=computed(()=>[{title:'All suppliers',value:'all'},...Array.from(new Map(purchases.value.map(p=>[p.supplier_id,{title:p.Supplier?.name||'Supplier',value:p.supplier_id}])).values()).sort((a,b)=>a.title.localeCompare(b.title))]);
const filtered=computed(()=>purchases.value.filter(item=>{
 const q=(search.value||'').trim().toLowerCase();
 return (supplierId.value==='all'||item.supplier_id===supplierId.value)&&(status.value==='All statuses'||item.status===status.value)&&(!q||`${item.description||''} ${item.Supplier?.name||''} PUR-${item.id} ${sourceLabel(item)}`.toLowerCase().includes(q));
}));
const metrics=computed(()=>[
 {label:'Total purchased',value:filtered.value.reduce((sum,p)=>sum+Number(p.amount||0),0),color:'text-primary'},
 {label:'Paid against purchases',value:filtered.value.reduce((sum,p)=>sum+Number(p.paid_amount||0),0),color:'text-success'},
 {label:'Outstanding balance',value:filtered.value.reduce((sum,p)=>sum+balance(p),0),color:'text-error'}
]);
const headers=[{title:'Purchase',key:'id'},{title:'Date',key:'created_at'},{title:'Supplier',key:'supplier',sortable:false},{title:'Description / source',key:'description'},{title:'Amount',key:'amount',align:'end'},{title:'Paid',key:'paid_amount',align:'end'},{title:'Balance',key:'balance',align:'end',sortable:false},{title:'Status',key:'status'},{title:'',key:'actions',sortable:false}];
async function load(){loading.value=true;error.value='';try{const response=await $api.get('/suppliers/purchases');purchases.value=response.data.data||[];}catch(e){purchases.value=[];error.value=e.response?.data?.message||'Unable to load purchases';}finally{loading.value=false;}}
onMounted(load);
</script>
<style scoped>
.purchase-header {display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
.purchase-card {background:rgba(var(--v-theme-surface),.95);box-shadow:0 10px 32px rgba(var(--v-theme-primary),.045)!important;}
.purchase-description {min-width:160px;max-width:320px;white-space:normal;overflow-wrap:anywhere;padding:12px 0;}
</style>
