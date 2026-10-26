<template>
  <v-dialog v-model="open" max-width="1000" :persistent="busy">
    <v-card rounded="xl">
      <v-card-title class="pa-6 d-flex align-center justify-space-between">Import Leads<v-btn icon="mdi-close" variant="text" :disabled="busy" @click="open=false" /></v-card-title>
      <v-card-text>
        <p class="mb-3">Upload an Excel workbook to add new leads to this workspace. Existing leads will not be updated.</p>
        <v-btn variant="tonal" prepend-icon="mdi-download-outline" class="mb-4" :disabled="busy" @click="downloadTemplate">Download template</v-btn>
        <v-file-input v-model="file" label="Excel workbook (.xlsx)" accept=".xlsx" variant="outlined" :disabled="busy" show-size @update:model-value="resetPreview" />
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <v-alert v-if="result" :type="result.errors.length ? 'warning' : 'success'" variant="tonal" class="mb-4">{{ result.valid }} valid · {{ result.errors.length }} errors · {{ result.total }} total. {{ result.errors.length ? 'Correct the errors in Excel and upload again. No leads have been saved.' : 'Review the preview, then click Import leads to save.' }}</v-alert>
        <v-alert v-if="result" type="info" variant="tonal" class="mb-4">Follow-up counts in downloaded files are informational. This import adds lead records only; it does not recreate activity history.</v-alert>
        <div v-if="result?.errors.length" class="mb-4" style="max-height:180px;overflow:auto"><p v-for="item in result.errors" :key="item.row">Row {{ item.row }}: {{ item.message }}</p></div>
        <v-table v-if="result?.preview.length" density="compact" height="320" fixed-header>
          <thead><tr><th>Row</th><th>Name</th><th>Phone</th><th>Service</th><th>Status</th><th>Assigned Staff</th></tr></thead>
          <tbody><tr v-for="row in result.preview" :key="row.row"><td>{{ row.row }}</td><td>{{ row.name }}</td><td>{{ row.phone }}</td><td>{{ row.service || '—' }}</td><td>{{ row.status }}</td><td>{{ row.assigned || '—' }}</td></tr></tbody>
        </v-table>
        <p v-if="result?.valid > 100" class="text-caption mt-2">Showing the first 100 valid rows. All {{ result.valid }} valid rows will be imported.</p>
      </v-card-text>
      <v-card-actions class="pa-6"><v-spacer /><v-btn variant="text" :disabled="busy" @click="open=false">Cancel</v-btn><v-btn v-if="!result || result.errors.length" color="primary" variant="flat" :loading="busy" :disabled="!selectedFile" @click="preview">Preview</v-btn><v-btn v-else color="primary" variant="flat" :loading="busy" @click="confirm">Import {{ result.valid }} leads</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup>
import { useUIStore } from '~/stores/ui';
const open=defineModel({type:Boolean});
const emit=defineEmits(['saved']);
const {$api}=useNuxtApp();
const ui=useUIStore();
const file=ref(null), result=ref(null), busy=ref(false), error=ref('');
const selectedFile=computed(()=>Array.isArray(file.value)?file.value[0]:file.value);
const resetPreview=()=>{result.value=null;error.value='';};
watch(open,value=>{if(value){file.value=null;resetPreview();}});
async function send(action){
  if(!selectedFile.value)return;
  if(!/\.xlsx$/i.test(selectedFile.value.name) || selectedFile.value.size>5*1024*1024){error.value='Choose an .xlsx file under 5 MB.';return;}
  busy.value=true;error.value='';
  try{
    const body=new FormData();body.append('file',selectedFile.value);
    const response=await $api.post(`/leads/import/${action}`,body);
    result.value=response.data.data;
    if(action==='confirm'){ui.showSuccess(`${result.value.imported} leads imported`);emit('saved');open.value=false;}
  }catch(e){if(e.response?.data?.data)result.value=e.response.data.data;error.value=e.response?.data?.message || 'Unable to import leads. Check the file and try again.';}
  finally{busy.value=false;}
}
const preview=()=>send('preview');
const confirm=()=>send('confirm');
async function downloadTemplate(){
  try{const {data}=await $api.get('/leads/import/template',{responseType:'blob'});const url=URL.createObjectURL(data);const link=document.createElement('a');link.href=url;link.download='lead-import-template.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch{error.value='Unable to download template.';}
}
</script>
