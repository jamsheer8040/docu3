<template><div v-if="role.type!=='CustomerPortal'" class="pa-4 border-b"><div class="d-flex ga-3 align-start flex-wrap"><DashboardTemplateChoice v-model="selected" :disabled="disabled || role.name==='Developer'" style="min-width:250px;flex:1" /><v-btn color="primary" variant="tonal" :loading="saving" :disabled="disabled || role.name==='Developer' || selected===role.dashboard_template_id || (!selected && !role.dashboard_template_id)" @click="save">Save dashboard</v-btn></div><p v-if="error" class="text-error mt-2">{{ error }}</p></div></template>
<script setup>
import DashboardTemplateChoice from './DashboardTemplateChoice.vue';
import {useUIStore} from '~/stores/ui';
const props=defineProps({role:{type:Object,required:true},disabled:Boolean});const emit=defineEmits(['saved']);
const {$api}=useNuxtApp();const selected=ref(null),saving=ref(false),error=ref('');const ui=useUIStore();
watch(()=>[props.role.id,props.role.dashboard_template_id],()=>{selected.value=props.role.dashboard_template_id || null;error.value='';},{immediate:true});
async function save(){saving.value=true;error.value='';try{await $api.put(`/dashboard/templates/role/${props.role.id}`,{dashboard_template_id:selected.value});emit('saved',selected.value);ui.showSuccess('Dashboard template saved for this role.');}catch(e){error.value=e.response?.data?.message || 'Unable to save dashboard.';}finally{saving.value=false;}}
</script>
