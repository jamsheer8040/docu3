<template>
  <v-card v-if="auth.isAdmin && auth.user?.role_type === 'Internal'" class="soft-card pa-6 mt-4" variant="flat">
    <h4 class="text-subtitle-1 font-weight-bold mb-2">Company Database Backup &amp; Import</h4>
    <p class="text-body-2 text-medium-emphasis mb-4">Download this company's database structure and records as a restorable SQL file. Uploaded documents and images are not included.</p>
    <v-btn color="primary" variant="tonal" prepend-icon="mdi-database-export-outline" rounded="lg" :loading="downloading" :disabled="downloading || importing" @click="download">Download Backup</v-btn>
    <v-alert v-if="error" type="error" variant="tonal" class="mt-4" role="alert">{{ error }}</v-alert>
    <v-divider class="my-5" />
    <h4 class="text-subtitle-2 font-weight-bold mb-3">Import Company Backup</h4>
    <p class="text-body-2 text-medium-emphasis mb-3">Use a SQL file downloaded from this company's backup button. Your current administrator login and platform subscription are preserved.</p>
    <v-file-input v-model="backupFile" accept=".sql" label="Company SQL backup" variant="outlined" density="compact" :disabled="importing || !!result" hint="Maximum 25 MB. Uploaded documents and images must be restored separately." persistent-hint />
    <v-select v-model="importMode" label="Import mode" :items="[{title:'Merge — add missing records',value:'merge'},{title:'Replace — restore company snapshot',value:'replace'}]" variant="outlined" density="compact" class="mt-3" :disabled="importing || !!result" />
    <p class="text-caption text-medium-emphasis mb-3">{{ importMode === 'merge' ? 'Existing records are kept. Conflicting records or incompatible financial history stop the import.' : 'Current company records will be replaced with the backup. Other companies are unchanged.' }} A pre-import recovery backup is saved automatically.</p>
    <v-btn v-if="!validation && !result" variant="tonal" color="primary" :loading="validating" :disabled="!selectedFile || validating" @click="validateBackup">Validate Backup</v-btn>
    <template v-if="validation && !result">
      <v-alert type="info" variant="tonal" class="mb-3">{{ validation.inserted }} new · {{ validation.replaced }} replaced · {{ validation.removed }} removed</v-alert>
      <v-btn :color="importMode === 'replace' ? 'warning' : 'primary'" variant="flat" @click="confirmationText = ''; confirmOpen = true">{{ importMode === 'replace' ? 'Replace Company Data' : 'Merge Backup' }}</v-btn>
    </template>
    <v-alert v-if="result" type="success" variant="tonal" class="mt-4">Import completed. Reload the app to use the restored data.<v-btn variant="text" class="mt-2" @click="reload">Reload App</v-btn></v-alert>
    <v-btn v-if="recovery" variant="text" size="small" prepend-icon="mdi-download" class="mt-3" :loading="recoveryDownloading" @click="downloadRecovery">Download Pre-import Backup</v-btn>
    <v-dialog v-model="confirmOpen" max-width="520" :persistent="importing">
      <v-card class="soft-card pa-6">
        <h3 class="text-h6 mb-3">{{ importMode === 'replace' ? 'Replace company data?' : 'Merge company backup?' }}</h3>
        <p class="text-body-2 mb-4">{{ importMode === 'replace' ? 'This replaces the current company records with the validated backup.' : 'This adds missing records from the validated backup.' }} A recovery backup will be saved first. Your administrator login and other companies remain unchanged.</p>
        <v-text-field v-model="confirmationText" :label="`Type ${importMode.toUpperCase()} to confirm`" variant="outlined" :disabled="importing" autocomplete="off" />
        <v-card-actions class="px-0"><v-spacer /><v-btn :disabled="importing" @click="confirmOpen = false">Cancel</v-btn><v-btn color="primary" variant="flat" :loading="importing" :disabled="confirmationText !== importMode.toUpperCase() || importing" @click="importBackup">Confirm Import</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
const auth = useAuthStore(), { $api } = useNuxtApp();
const downloading = ref(false), error = ref('');
const backupFile=ref(null),importMode=ref('merge'),validation=ref(null),validating=ref(false),importing=ref(false),confirmOpen=ref(false),confirmationText=ref(''),result=ref(null),recovery=ref(null),recoveryDownloading=ref(false);
const selectedFile=computed(()=>Array.isArray(backupFile.value)?backupFile.value[0]:backupFile.value);
watch([backupFile,importMode],()=>{validation.value=null;error.value='';});
onMounted(async()=>{if(auth.isAdmin&&auth.user?.role_type==='Internal')try{recovery.value=(await $api.get('/config/backups/company/recovery/latest')).data.data?.id||null;}catch{}});
function importData(){const form=new FormData();form.append('backup',selectedFile.value);form.append('mode',importMode.value);return form;}
async function validateBackup(){
  if(validating.value||!selectedFile.value)return;
  if(selectedFile.value.size>25*1024*1024){error.value='Choose a SQL backup up to 25 MB.';return;}
  validating.value=true;error.value='';validation.value=null;
  try{validation.value=(await $api.post('/config/backups/company/validate',importData(),{timeout:180000})).data.data;}
  catch(failure){error.value=failure.response?.data?.message||'Unable to validate the backup.';}
  finally{validating.value=false;}
}
async function importBackup(){
  if(importing.value||!validation.value||confirmationText.value!==importMode.value.toUpperCase())return;
  importing.value=true;error.value='';
  try{
    const form=importData();for(const field of ['file_hash','state_hash'])form.append(field,validation.value[field]);form.append('confirmation',confirmationText.value);
    result.value=(await $api.post('/config/backups/company/import',form,{timeout:180000})).data.data;
    recovery.value=result.value.recovery;confirmOpen.value=false;validation.value=null;
  }catch(failure){error.value=failure.response?.data?.message||'Import failed. No changes were applied.';recovery.value=failure.response?.data?.recovery||recovery.value;validation.value=null;confirmOpen.value=false;}
  finally{importing.value=false;}
}
async function downloadRecovery(){
  if(recoveryDownloading.value)return;recoveryDownloading.value=true;error.value='';
  try{const response=await $api.get(`/config/backups/company/recovery/${recovery.value}`,{responseType:'blob'});saveDownload(response.data,recovery.value);}
  catch{error.value='Unable to download the pre-import backup.';}
  finally{recoveryDownloading.value=false;}
}
function reload(){window.location.reload();}
function saveDownload(blob,filename){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function download() {
  if (downloading.value) return;
  downloading.value = true; error.value = '';
  try {
    const response = await $api.post('/config/backups/company', {}, { responseType: 'blob', timeout: 180000 });
    const disposition = response.headers['content-disposition'] || '';
    const filename = disposition.match(/filename="([^"]+\.sql)"/i)?.[1] || `company-backup-${new Date().toISOString().slice(0,10)}.sql`;
    saveDownload(response.data, filename);
  } catch (failure) {
    let message = failure.response?.data?.message;
    if (!message && failure.response?.data instanceof Blob) {
      try { message = JSON.parse(await failure.response.data.text()).message; } catch {}
    }
    error.value = message || 'Unable to download the company backup. Please try again.';
  } finally { downloading.value = false; }
}
</script>
