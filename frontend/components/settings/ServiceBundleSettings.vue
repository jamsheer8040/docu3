<template>
  <v-card class="soft-card pa-5">
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
      <div><h2 class="text-h6 font-weight-bold">Service Templates</h2><p class="text-body-2 text-medium-emphasis">Bundle the services needed for a complete job. Available in Sales Orders and Quotations.</p></div>
      <v-btn v-if="canManage" prepend-icon="mdi-plus" color="primary" size="small" rounded="pill" @click="open()">New template</v-btn>
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}<v-btn variant="text" size="small" @click="load">Retry</v-btn></v-alert>
    <v-data-table :headers="headers" :items="templates" :loading="loading" :items-per-page="10" no-data-text="No service templates yet. Create a template such as Contract Renewal and add its individual services.">
      <template #item.items="{ item }">{{ item.items.length }} services</template>
      <template #item.is_active="{ item }"><v-chip size="small" :color="item.is_active ? 'success' : 'grey'" variant="tonal">{{ item.is_active ? 'Active' : 'Inactive' }}</v-chip></template>
      <template #item.actions="{ item }"><v-btn v-if="canManage" icon="mdi-pencil-outline" size="small" variant="text" color="primary" :aria-label="`Edit ${item.name}`" @click="open(item)" /><v-btn v-if="auth.can('settings','delete')" icon="mdi-delete-outline" size="small" variant="text" color="error" :aria-label="`Delete ${item.name}`" @click="deleting=item" /></template>
    </v-data-table>
    <v-dialog v-model="editing" max-width="760" scrollable persistent>
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center pa-5"><span>{{ draft.id ? 'Edit service template' : 'New service template' }}</span><v-spacer /><v-btn icon="mdi-close" variant="text" :disabled="saving" @click="editing=false" /></v-card-title>
        <v-card-text>
          <v-alert v-if="editError" type="error" variant="tonal" class="mb-4">{{ editError }}</v-alert>
          <v-form ref="form" :disabled="saving">
            <v-text-field v-model="draft.name" label="Template name *" placeholder="e.g. Contract Renewal" variant="outlined" density="compact" maxlength="150" :rules="[value=>!!value?.trim() || 'Enter a template name']" />
            <v-textarea v-model="draft.description" label="Description" variant="outlined" rows="2" maxlength="1000" />
            <v-switch v-model="draft.is_active" label="Active" color="primary" hide-details class="mb-3" />
            <p class="text-body-2 text-medium-emphasis mb-3">Prices come from the service master when added to a document. Staff can change charges or remove rows without changing this template.</p>
            <div v-for="(item,index) in draft.items" :key="index" class="d-flex align-start ga-2 mb-2">
              <v-autocomplete v-model="item.service_type_id" :items="catalogFor(item)" item-title="name" item-value="id" label="Service *" variant="outlined" density="compact" :rules="[value=>!!value || 'Select a service',value=>activeService(value) || 'Replace this unavailable service']" />
              <v-text-field v-model.number="item.quantity" label="Qty" type="number" min="1" max="100000" step="1" variant="outlined" density="compact" :rules="[value=>Number.isInteger(Number(value)) && Number(value)>0 && Number(value)<=100000 || 'Use a whole quantity']" style="max-width:110px" />
              <v-btn icon="mdi-chevron-up" size="x-small" variant="text" :disabled="saving || index===0" aria-label="Move service up" @click="move(index,-1)" />
              <v-btn icon="mdi-chevron-down" size="x-small" variant="text" :disabled="saving || index===draft.items.length-1" aria-label="Move service down" @click="move(index,1)" />
              <v-btn icon="mdi-close" size="small" variant="text" color="error" :disabled="saving || draft.items.length===1" aria-label="Remove service" @click="draft.items.splice(index,1)" />
            </div>
            <v-btn prepend-icon="mdi-plus" size="small" variant="tonal" :disabled="saving || draft.items.length>=100" @click="draft.items.push({service_type_id:null,quantity:1})">Add service</v-btn>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-5"><v-spacer /><v-btn :disabled="saving" @click="editing=false">Cancel</v-btn><v-btn variant="flat" color="primary" :loading="saving" @click="save">Save template</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!deleting" max-width="440" persistent><v-card rounded="xl" title="Delete service template?"><v-card-text>Delete “{{ deleting?.name }}”? Services already added to quotations or sales orders will stay unchanged.<v-alert v-if="deleteError" type="error" variant="tonal" class="mt-3">{{ deleteError }}</v-alert></v-card-text><v-card-actions><v-spacer /><v-btn :disabled="saving" @click="deleting=null;deleteError=''">Cancel</v-btn><v-btn color="error" :loading="saving" @click="remove">Delete</v-btn></v-card-actions></v-card></v-dialog>
  </v-card>
</template>
<script setup>
import { useAuthStore } from '~/stores/auth';
import { useUIStore } from '~/stores/ui';
const auth = useAuthStore(), ui = useUIStore(), { $api } = useNuxtApp();
const canManage = computed(() => auth.can('settings','write'));
const templates = ref([]), catalog = ref([]), loading = ref(false), saving = ref(false), error = ref(''), editError = ref(''), deleteError = ref('');
const editing = ref(false), deleting = ref(null), form = ref(null);
const draft = reactive({ id: null, name: '', description: '', is_active: true, items: [] });
const headers = [{ title:'Template',key:'name' },{ title:'Description',key:'description' },{ title:'Includes',key:'items',sortable:false },{ title:'Status',key:'is_active' },{ title:'Actions',key:'actions',sortable:false }];
async function load() {
  loading.value = true; error.value = '';
  try { templates.value = (await $api.get('/service-bundles?manage=true')).data.data; }
  catch (e) { error.value = e.response?.data?.message || 'Unable to load service templates.'; }
  finally { loading.value = false; }
}
const activeService = id => catalog.value.some(service => String(service.id) === String(id));
function catalogFor(item) {
  return item.service_type_id && !activeService(item.service_type_id)
    ? [...catalog.value, {id:item.service_type_id,name:'Unavailable service — replace before saving'}] : catalog.value;
}
async function open(template) {
  editError.value = ''; editing.value = true; saving.value = true;
  Object.assign(draft, template ? JSON.parse(JSON.stringify(template)) : {id:null,name:'',description:'',is_active:true,items:[{service_type_id:null,quantity:1}]});
  try { catalog.value = (await $api.get('/service-bundles/catalog')).data.data; await nextTick(); form.value?.resetValidation(); }
  catch (e) { editError.value = e.response?.data?.message || 'Unable to load services. Close and try again.'; }
  finally { saving.value = false; }
}
function move(index, direction) { const next = index + direction; [draft.items[index],draft.items[next]] = [draft.items[next],draft.items[index]]; }
async function save() {
  if (saving.value || !(await form.value?.validate())?.valid) return;
  if (new Set(draft.items.map(item=>String(item.service_type_id))).size !== draft.items.length) { editError.value='Each service can appear once. Change its quantity instead.'; return; }
  saving.value=true; editError.value='';
  try { await $api[draft.id?'put':'post'](draft.id?`/service-bundles/${draft.id}`:'/service-bundles',draft); editing.value=false; ui.showSuccess('Service template saved.'); await load(); }
  catch (e) { editError.value=e.response?.data?.message || 'Unable to save service template.'; }
  finally { saving.value=false; }
}
async function remove() {
  if (saving.value) return;
  saving.value=true; deleteError.value='';
  try { await $api.delete(`/service-bundles/${deleting.value.id}`); deleting.value=null; ui.showSuccess('Service template deleted.'); await load(); }
  catch (e) { deleteError.value=e.response?.data?.message || 'Unable to delete service template.'; }
  finally { saving.value=false; }
}
onMounted(load);
</script>
