<template>
  <div>
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div><h1 class="text-h4">Record assignments</h1><p class="text-body-2 mt-2">Assign business records to staff. Your role controls which records you can change.</p></div>
      <v-btn to="/settings" variant="tonal">Settings</v-btn>
    </div>
    <v-card class="rounded-xl pa-5">
      <v-select v-model="model" :items="availableModels" label="Record type" density="compact" variant="outlined" style="max-width: 360px" />
      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
      <v-data-table :headers="headers" :items="records" :loading="loading" hide-default-footer :items-per-page="50">
        <template #item.created_by="{ item }">{{ staffName(item.created_by) }}</template>
        <template #item.assigned_user_id="{ item }">
          <div class="d-flex align-center ga-2 py-2">
            <v-select v-model="drafts[item.id]" :items="staffOptions" label="Assigned staff" density="compact" variant="outlined" hide-details :disabled="!auth.canRecord(moduleForModel, 'edit', item) || saving === item.id" style="min-width: 210px; max-width: 300px" />
            <v-btn v-if="auth.canRecord(moduleForModel, 'edit', item)" :disabled="drafts[item.id] === item.assigned_user_id" :loading="saving === item.id" variant="tonal" @click="save(item)">Save</v-btn>
          </div>
        </template>
      </v-data-table>
      <v-pagination v-if="total > 50" v-model="page" :length="Math.ceil(total / 50)" />
    </v-card>
    <v-snackbar v-model="saved" timeout="2500">Assignment saved</v-snackbar>
  </div>
</template>
<script setup>
import { useAuthStore } from '~/stores/auth';
const auth = useAuthStore();
const { $api } = useNuxtApp();
const models = [
  ['Customer','Customers','customers'], ['Lead','Leads','leads'], ['Supplier','Suppliers','suppliers'],
  ['Document','Documents','documents'], ['ServiceOrder','Services','services'], ['SalesOrder','Sales orders','sales_orders'], ['Quotation','Quotations','quotations'],
  ['Invoice','Invoices','invoices'], ['Expense','Expenses','expenses'], ['WalletAccount','Wallet accounts','wallet'],
  ['Shareholder','Shareholders','management'], ['CapitalTransaction','Capital transactions','management'],
  ['DividendDeclaration','Dividend declarations','management'], ['OwnershipChange','Ownership changes','management'],
  ['User','Staff','staff'], ['SalaryPayroll','Payrolls','staff'], ['SalaryItem','Salary items','staff'], ['StaffDocument','Staff documents','staff'], ['SavedCv','Saved CVs','tools']
];
const availableModels = computed(() => models.filter(([, , module]) => auth.can(module)).map(([value, title]) => ({value,title})));
const model = ref(availableModels.value[0]?.value || null);
const moduleForModel = computed(() => models.find(([name]) => name === model.value)?.[2]);
const records = ref([]), staff = ref([]), drafts = ref({}), page = ref(1), total = ref(0), loading = ref(false), error = ref(''), saving = ref(null), saved = ref(false);
const headers = [{ title:'Record', key:'label' }, { title:'Created by', key:'created_by' }, { title:'Assigned staff', key:'assigned_user_id', sortable:false }];
const staffOptions = computed(() => [...(model.value === 'Customer' ? [] : [{ title:'Unassigned', value:null }]), ...staff.value.map(user => ({ title:user.name, value:user.id }))]);
const staffName = id => id == null ? 'Not recorded' : staff.value.find(user => String(user.id) === String(id))?.name || `Staff #${id}`;
let requestId = 0;
async function load() {
  const id = ++requestId;
  records.value = []; error.value = '';
  if (!model.value) return;
  loading.value = true;
  try {
    const response = await $api.get(`/record-assignments/${model.value}`, { params:{page:page.value} });
    if (id !== requestId) return;
    records.value = response.data.data; total.value = response.data.total;
    drafts.value = Object.fromEntries(records.value.map(row => [row.id, row.assigned_user_id]));
  } catch (e) { if (id === requestId) error.value = e.response?.data?.message || 'Could not load assignments.'; }
  finally { if (id === requestId) loading.value = false; }
}
async function save(row) {
  saving.value = row.id; error.value = '';
  try { await $api.put(`/record-assignments/${model.value}/${row.id}`, { assigned_user_id:drafts.value[row.id] }); saved.value = true; await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Could not save assignment.'; }
  finally { saving.value = null; }
}
watch(model, () => { page.value = 1; load(); });
watch(page, load);
onMounted(async () => { try { staff.value = (await $api.get('/record-assignments/staff')).data.data; } catch {} await load(); });
</script>
