<template>
  <section class="my-6">
    <div class="d-flex align-center ga-4 mb-3"><v-avatar color="primary" variant="tonal" rounded="lg" size="48"><v-icon icon="mdi-percent-circle-outline" /></v-avatar><div><h3 class="text-h6 font-weight-bold">Commission</h3><p class="text-caption text-medium-emphasis">Choose whether your company pays staff commission. This is normally a long-term company preference.</p></div></div>
    <v-switch :model-value="config.commissionEnabled" :disabled="!auth.can('settings','write') || saving" label="Commission enabled" color="primary" hide-details @update:model-value="requestChange" />
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">{{ error }}</v-alert>
    <v-dialog :model-value="pending!==null" max-width="520" persistent>
      <v-card rounded="xl"><v-card-title class="pa-5">{{ pending?'Enable commission?':'Disable commission?' }}</v-card-title><v-card-text><p>{{ pending?'Commission menus, invoice fields, statements and reports will be available under the existing permissions. Eligibility applies only to invoices created after enabling. Earlier invoices, including drafts issued later, stay unchanged.':'Commission menus, invoice fields, report columns and expense entries will be hidden. Historical expenses and profit deductions remain included in accounting. New calculations stop.' }}</p><p class="mt-3">Existing records and actual wallet payments are preserved. Turning OFF requires no pending approvals and no unpaid approved balances. This applies to everyone in this workspace.</p><v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert></v-card-text><v-card-actions class="pa-4"><v-spacer /><v-btn :disabled="saving" @click="pending=null;error=''">Cancel</v-btn><v-btn color="primary" variant="flat" :loading="saving" @click="confirm">{{ pending?'Enable commission':'Disable commission' }}</v-btn></v-card-actions></v-card>
    </v-dialog>
  </section>
</template>
<script setup>
import {useAuthStore} from '~/stores/auth';
import {useConfigStore} from '~/stores/config';
const auth=useAuthStore(),config=useConfigStore(),{$api}=useNuxtApp();
const pending=ref(null),saving=ref(false),error=ref('');
function requestChange(value){if(value===config.commissionEnabled)return;pending.value=!!value;error.value='';}
async function confirm(){if(saving.value || pending.value===null)return;saving.value=true;error.value='';try{const response=await $api.put('/config/commission',{enabled:pending.value,expected_enabled:config.commissionEnabled,confirmed:true});config.settings.commission_enabled=response.data.data.commission_enabled;pending.value=null;}catch(e){error.value=e.response?.data?.message || 'Unable to change commission availability.';}finally{saving.value=false;}}
</script>
