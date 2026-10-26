<template><v-select :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" :items="options" item-title="name" item-value="id" label="Dashboard template" variant="outlined" density="comfortable" :disabled="disabled" hint="Uses this template for everyone assigned to the role. Sections still follow module and record permissions." persistent-hint @focus="load" /></template>
<script setup>
defineProps({modelValue:{default:null},disabled:Boolean});defineEmits(['update:modelValue']);
const {$api}=useNuxtApp();const templates=ref([]);
const options=computed(()=>[{id:null,name:'Current dashboard (default)'},...templates.value]);
async function load(){try{templates.value=(await $api.get('/dashboard/templates')).data.data.templates;}catch{}}
onMounted(load);
</script>
