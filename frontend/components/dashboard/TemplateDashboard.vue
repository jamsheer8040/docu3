<template>
  <div class="template-dashboard pa-4 pa-md-6">
    <header class="d-flex align-center justify-space-between ga-4 flex-wrap mb-6"><div><h1 class="text-h4 font-weight-bold">{{ data?.template?.name || 'Home' }}</h1><p class="text-body-2 text-medium-emphasis mt-2">{{ data?.template?.description }}</p><v-chip v-if="data?.template?.record_scope==='assigned'" size="small" variant="tonal" class="mt-2">Assigned to me</v-chip></div><v-btn-toggle v-model="period" mandatory divided color="primary" variant="tonal" rounded="pill" @update:model-value="load"><v-btn value="yearly" size="small">Yearly</v-btn><v-btn value="monthly" size="small">Monthly</v-btn><v-btn value="today" size="small">Today</v-btn></v-btn-toggle></header>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}<v-btn variant="text" @click="load">Retry</v-btn></v-alert>
    <v-alert v-if="!loading && !data?.widgets?.length" variant="tonal" color="primary">No dashboard cards are available for your current template and permissions.</v-alert>
    <div class="dashboard-widget-grid">
      <v-card v-for="widget in data?.widgets || []" :key="widget.id" rounded="xl" class="pa-5 dashboard-widget" variant="flat">
        <NuxtLink v-if="widget.id === 'followups' && widget.to" :to="widget.to" class="widget-card-link" aria-label="Open Lead Management" />
        <div class="d-flex align-center justify-space-between ga-3 mb-3"><div class="d-flex ga-3 align-center"><v-avatar color="primary" variant="tonal" size="38"><v-icon size="20">{{ widget.icon }}</v-icon></v-avatar><h2 class="text-subtitle-1 font-weight-bold">{{ widget.title }}</h2></div><v-btn v-if="widget.to" :to="widget.to" class="widget-header-link" icon="mdi-arrow-top-right" variant="text" size="small" :aria-label="`Open ${widget.title}`" /></div>
        <p v-if="widget.caption" class="text-caption text-medium-emphasis">{{ widget.caption }}</p>
        <div v-if="widget.value !== undefined" class="text-h4 font-weight-bold mt-3 mb-4">{{ widget.money ? 'AED ' : '' }}{{ number(widget.value,widget.money) }}</div>
        <div v-for="item in widget.items || []" :key="item.label" class="mb-3"><div class="d-flex justify-space-between text-body-2 mb-1"><span>{{ item.label }}</span><strong>{{ widget.money?'AED ':'' }}{{ number(item.value,widget.money) }}</strong></div><v-progress-linear v-if="!widget.money" :model-value="widget.value?item.value/widget.value*100:0" height="5" rounded color="primary" /></div>
        <component v-for="row in widget.rows || []" :key="row.id" :is="rowLink(row) ? NuxtLink : 'div'" :to="rowLink(row)" class="widget-row d-flex align-center justify-space-between ga-3 py-3 border-b" :aria-label="rowLink(row) ? `Open ${row.label}` : undefined"><div class="min-width-0"><span class="text-body-2" :class="{'text-primary font-weight-medium':rowLink(row)}">{{ row.label }}</span><p class="text-caption text-medium-emphasis">{{ row.detail }}</p></div><v-icon v-if="row.detail && widget.id==='followups'" size="18" color="error">mdi-clock-alert-outline</v-icon></component>
        <p v-if="widget.rows && !widget.rows.length" class="text-body-2 text-medium-emphasis mt-3">Nothing pending.</p>
        <div v-if="widget.actions" class="d-flex flex-wrap ga-2 mt-4"><v-btn v-for="action in widget.actions" :key="action.to" :to="action.to" size="small" color="primary" variant="tonal" prepend-icon="mdi-plus">{{ action.label }}</v-btn><p v-if="!widget.actions.length" class="text-body-2 text-medium-emphasis">No create actions available for this role.</p></div>
      </v-card>
    </div>
  </div>
</template>
<script setup>
import {useAuthStore} from '~/stores/auth';
import {NuxtLink} from '#components';
const props=defineProps({initial:{type:Object,required:true}});
const auth=useAuthStore(),{$api}=useNuxtApp();
const rowLink=row=>row.to && (!row.record || auth.canRecord('leads','detail',row.record)) ? row.to : undefined;
const data=ref(props.initial),period=ref('monthly'),loading=ref(false),error=ref('');
const number=(value,money)=>Number(value||0).toLocaleString('en-US',{minimumFractionDigits:money?2:0,maximumFractionDigits:money?2:0});
let requestId=0;
async function load(){const id=++requestId;loading.value=true;error.value='';try{const response=(await $api.get('/dashboard/layout',{params:{period:period.value}})).data.data;if(id===requestId)data.value=response;}catch(e){if(id===requestId)error.value=e.response?.data?.message || 'Unable to load dashboard.';}finally{if(id===requestId)loading.value=false;}}
</script>
<style scoped>
.dashboard-widget-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px;align-items:start}
.dashboard-widget{box-shadow:0 8px 30px rgba(24,55,47,.05)!important;border:1px solid rgba(var(--v-theme-primary),.04);height:100%;position:relative}
.widget-card-link{position:absolute;inset:0;z-index:1;border-radius:inherit}
.widget-card-link:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:-3px}
.widget-header-link,.widget-row{position:relative;z-index:2}
a.widget-row{color:inherit;text-decoration:none;border-radius:8px}
a.widget-row:hover,a.widget-row:focus-visible{background:rgba(var(--v-theme-primary),.06)}
.widget-row:last-child{border-bottom:0!important}.min-width-0{min-width:0}.widget-row a{overflow-wrap:anywhere}
</style>
