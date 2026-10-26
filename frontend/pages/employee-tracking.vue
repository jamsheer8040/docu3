<template>
  <v-container fluid class="pa-4 pa-md-6">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div><h1 class="text-h4 font-weight-bold">Employee Tracking</h1><p class="text-medium-emphasis mt-1">Staff assignments and service progress</p></div>
      <div class="d-flex ga-2"><v-btn v-if="auth.can('services')" variant="tonal" rounded="pill" to="/services">Services</v-btn><v-btn variant="text" rounded="pill" prepend-icon="mdi-refresh" :loading="loading || loadingSummary" @click="refresh">Refresh</v-btn></div>
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-card rounded="xl" variant="flat" class="pa-4 mb-5">
      <div class="d-flex align-center flex-wrap ga-3 mb-4">
        <TrackingPeriodSelect :model-value="selectedPeriod" label="Tracking period" @update:model-value="changePeriod" />
        <span class="text-body-2 text-medium-emphasis">{{ periodLabel }}</span>
      </div><div class="tracking-filters">
      <v-select v-model="selectedStaff" label="Employee" :items="employeeOptions" density="compact" variant="outlined" hide-details />
      <v-select v-model="serviceType" label="Service type" :items="serviceTypes" item-title="name" item-value="id" clearable density="compact" variant="outlined" hide-details />
      <v-btn variant="text" rounded="pill" @click="clearFilters">Clear filters</v-btn>
    </div><p class="text-caption text-medium-emphasis mt-3">Workload: creation date · Performance: completion date · UAE time</p></v-card>
    <v-progress-linear v-if="loadingSummary" indeterminate color="primary" class="mb-4" />
    <v-row class="mb-4"><v-col v-for="card in summaryCards" :key="card.key" cols="6" md="3"><v-card rounded="xl" variant="flat" class="pa-5"><div class="text-caption text-medium-emphasis mb-2">{{ card.title }}</div><strong class="text-h4">{{ card.value }}</strong></v-card></v-col></v-row>
    <EmployeeProgress :employees="visibleEmployees" :reports="reports" :selected-staff="selectedStaff" :period="selectedPeriod" :reset-key="periodReset" :loading="loadingSummary" @select="selectServices" />
    <v-card rounded="xl" variant="flat" class="mb-5">
      <div class="pa-4"><div class="tracking-card-heading"><h2 class="text-h6">Workload by Employee</h2><TrackingPeriodSelect v-model="workloadTablePeriod" label="Workload table period" compact /></div><div class="text-caption text-medium-emphasis mt-2">{{ trackingPeriodLabel(workloadTablePeriod) }}</div></div>
      <v-data-table :headers="employeeHeaders" :items="filteredEmployees(workloadTablePeriod)" :loading="loadingSummary" :items-per-page="10" hover>
        <template #item.name="{ item }"><v-btn variant="text" class="px-0 text-none" @click="selectedStaff = item.id === 'unassigned' ? 'unassigned' : String(item.id)">{{ item.name }}{{ !item.is_active ? ' (inactive)' : '' }}</v-btn></template>
      </v-data-table>
    </v-card>
    <v-card id="service-assignments" rounded="xl" variant="flat">
      <div class="pa-4"><div class="tracking-card-heading"><h2 class="text-h6">Service Assignments</h2><TrackingPeriodSelect v-model="serviceListPeriod" label="Service assignments period" compact /></div><div class="text-caption text-medium-emphasis mt-2 mb-4">{{ trackingPeriodLabel(serviceListPeriod) }}</div><div class="tracking-filters">
        <v-select v-model="selectedStaff" label="Employee" :items="employeeOptions" variant="outlined" density="compact" hide-details />
        <v-select v-model="status" label="Status" :items="statuses" variant="outlined" density="compact" hide-details />
      </div></div>
      <v-data-table-server v-model:page="page" v-model:items-per-page="perPage" :headers="serviceHeaders" :items="orders" :items-length="total" :items-per-page-options="[15, 30, 50]" :loading="loading" hover>
        <template #item.id="{ item }"><div class="d-flex align-center ga-2 text-no-wrap"><ServiceStaffAvatar :staff="item.AssignedStaff" /><NuxtLink v-if="item.can_view_service" :to="`/services?search=SRV-${String(item.id).padStart(5, '0')}`">SRV-{{ String(item.id).padStart(5, '0') }}</NuxtLink><span v-else>SRV-{{ String(item.id).padStart(5, '0') }}</span></div></template>
        <template #item.AssignedStaff.name="{ item }">{{ item.AssignedStaff?.name || 'Unassigned' }}</template>
        <template #item.status="{ item }">{{ statusLabel(item.status) }}</template>
        <template #item.started_at="{ item }">{{ dateText(item.started_at) }}</template>
        <template #item.completed_at="{ item }">{{ dateText(item.completed_at) }}</template>
        <template #item.actions="{ item }"><div class="d-flex ga-1"><v-btn v-if="item.can_edit_service && openStatuses.includes(item.status)" size="small" variant="tonal" rounded="pill" @click="openAssignment(item)">{{ item.assigned_user_id ? 'Reassign' : 'Assign staff' }}</v-btn><v-btn size="small" variant="text" rounded="pill" @click="showHistory(item)">History</v-btn></div></template>
      </v-data-table-server>
    </v-card>
    <v-dialog v-model="assignmentDialog" max-width="480" :persistent="saving"><v-card rounded="xl">
      <v-card-title>Assign Staff · SRV-{{ selected?.id }}</v-card-title><v-card-text><StaffAssignmentSelect v-if="assignmentDialog" v-model="assignedUser" :current-staff="selected?.AssignedStaff" :disabled="saving" /><p class="text-caption text-medium-emphasis mt-2">Clear the selection to leave this service unassigned.</p><v-alert v-if="assignmentError" type="error" variant="tonal" class="mt-3">{{ assignmentError }}</v-alert></v-card-text>
      <v-card-actions class="pa-4"><v-spacer /><v-btn :disabled="saving" @click="assignmentDialog = false">Cancel</v-btn><v-btn color="primary" variant="tonal" :loading="saving" @click="saveAssignment">Save assignment</v-btn></v-card-actions>
    </v-card></v-dialog>
    <v-dialog v-model="historyDialog" max-width="850"><v-card rounded="xl">
      <v-card-title class="d-flex align-center justify-space-between">Assignment History · SRV-{{ historyService?.id }}<v-btn icon="mdi-close" variant="text" aria-label="Close assignment history" @click="historyDialog = false" /></v-card-title>
      <v-card-text>
        <div class="service-stages mb-6"><div v-for="stage in [{ name: 'Assigned', date: historyService?.assigned_at }, { name: 'Started', date: historyService?.started_at }, { name: 'Completed', date: historyService?.completed_at }]" :key="stage.name" :class="{ reached: stage.date }"><strong>{{ stage.name }}</strong><span>{{ dateText(stage.date) }}</span></div></div>
        <v-progress-linear v-if="loadingHistory" indeterminate /><v-alert v-else-if="historyError" type="error" variant="tonal">{{ historyError }}</v-alert><v-table v-else><thead><tr><th>Date</th><th>From</th><th>To</th><th>Changed by</th><th>Reason</th></tr></thead><tbody><tr v-for="event in history" :key="event.id"><td>{{ dateText(event.created_at) }}</td><td>{{ event.from_name || 'Unassigned' }}</td><td>{{ event.to_name || 'Unassigned' }}</td><td>{{ event.actor_name || '—' }}</td><td>{{ { Started: 'Auto-assigned on start', SalesOrder: 'Sales order push', Manual: 'Manual assignment' }[event.reason] || event.reason }}</td></tr><tr v-if="!history.length"><td colspan="5">No assignment changes recorded yet.</td></tr></tbody></v-table></v-card-text>
    </v-card></v-dialog>
  </v-container>
</template>

<script setup>
import StaffAssignmentSelect from '~/components/services/StaffAssignmentSelect.vue';
import ServiceStaffAvatar from '~/components/services/ServiceStaffAvatar.vue';
import EmployeeProgress from '~/components/services/EmployeeProgress.vue';
import TrackingPeriodSelect from '~/components/services/TrackingPeriodSelect.vue';
import { trackingPeriods, trackingPeriodDates, trackingPeriodLabel } from '~/utils/trackingPeriods';
import { useAuthStore } from '~/stores/auth';
const auth = useAuthStore(); const { $api } = useNuxtApp();
const trackingScope=ref('all');
const employees = ref([]); const orders = ref([]); const total = ref(0);
const selectedStaff = ref('all'); const status = ref(''); const page = ref(1); const perPage = ref(15);
const selectedPeriod = ref('monthly');
const reports = ref({}); const periodReset = ref(0);
const workloadTablePeriod = ref('monthly'); const serviceListPeriod = ref('monthly');
const serviceType = ref(null); const serviceTypes = ref([]);
const periodLabel = computed(() => trackingPeriodLabel(selectedPeriod.value));
function changePeriod(period) { selectedPeriod.value = period; periodReset.value++; workloadTablePeriod.value = period; serviceListPeriod.value = period; }
function filteredEmployees(period) { return (reports.value[period]?.data || []).filter(user => selectedStaff.value === 'all' || String(user.id) === selectedStaff.value); }
const visibleEmployees = computed(() => employees.value.filter(user => selectedStaff.value === 'all' || String(user.id) === selectedStaff.value));
const summaryCards = computed(() => [{ title: 'Total Services', key: 'total' }, { title: 'Unassigned', key: 'unassigned' }, { title: 'In Progress', key: 'in_progress' }, { title: 'Completed', key: 'completed' }].map(card => ({ ...card, value: !reports.value[selectedPeriod.value] ? '—' : card.key === 'unassigned' ? filteredEmployees(selectedPeriod.value).find(user => user.id === 'unassigned')?.total || 0 : filteredEmployees(selectedPeriod.value).reduce((sum, user) => sum + user[card.key], 0) })));
function clearFilters() { changePeriod('monthly'); serviceType.value = null; selectedStaff.value = 'all'; status.value = ''; }
function selectServices(id, group, period) { selectedStaff.value = String(id); status.value = group; serviceListPeriod.value = period || selectedPeriod.value; nextTick(() => document.querySelector('#service-assignments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
const loading = ref(false); const loadingSummary = ref(false); const error = ref('');
const openStatuses = ['Pending', 'Assigned', 'In Progress', 'Waiting for Customer', 'On Hold'];
const statuses = [{ title: 'All statuses', value: '' }, { title: 'All completed', value: 'completed' }, { title: 'Pending / Waiting', value: 'pending' }, ...['Pending', 'Assigned', 'In Progress', 'Waiting for Customer', 'On Hold', 'Completed', 'CompletedInvoicePending', 'CompletedInvoiceCreated', 'Cancelled'].map(value => ({ title: statusLabel(value), value }))];
const employeeOptions = computed(() => [{ title: trackingScope.value==='own'?'My work':'All employees', value: 'all' }, ...employees.value.map(user => ({ title: `${user.name}${!user.is_active ? ' (inactive)' : ''}`, value: String(user.id) }))]);
const employeeHeaders = [{ title: 'Employee', key: 'name' }, { title: 'Total', key: 'total' }, { title: 'Pending / Waiting', key: 'pending' }, { title: 'In Progress', key: 'in_progress' }, { title: 'Completed', key: 'completed' }, { title: 'Cancelled', key: 'cancelled' }];
const serviceHeaders = [{ title: 'Service ID', key: 'id' }, { title: 'Customer', key: 'Customer.name' }, { title: 'Service', key: 'ServiceType.name' }, { title: 'Assigned Staff', key: 'AssignedStaff.name' }, { title: 'Status', key: 'status' }, { title: 'Started', key: 'started_at' }, { title: 'Completed', key: 'completed_at' }, { title: 'Actions', key: 'actions' }].map(header => ({ ...header, sortable: false }));
function statusLabel(value) { return { CompletedInvoicePending: 'Completed · Invoice Pending', CompletedInvoiceCreated: 'Completed · Invoice Created' }[value] || value; }
function dateText(value) { return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
let requestId = 0;
async function loadOrders() {
  const id = ++requestId; loading.value = true;
  try {
    const grouped = ['completed', 'pending'].includes(status.value);
    const response = await $api.get('/services/employee-tracking/orders', { params: { tracking: true, ...trackingPeriodDates(serviceListPeriod.value), service_type_id: serviceType.value || undefined, page: page.value, limit: perPage.value, assigned_user_id: selectedStaff.value === 'all' ? undefined : selectedStaff.value, status: grouped ? undefined : status.value || undefined, status_group: grouped ? status.value : undefined } });
    if (id !== requestId) return;
    orders.value = response.data.data; total.value = response.data.meta.total;
  } catch { if (id === requestId) { orders.value = []; total.value = 0; error.value = 'Unable to load service assignments. Please refresh.'; } }
  finally { if (id === requestId) loading.value = false; }
}
let summaryRequestId = 0;
async function loadSummary() {
  const id = ++summaryRequestId;
  loadingSummary.value = true;
  reports.value = {};
  try {
    const results = await Promise.allSettled(trackingPeriods.map(async period => ({ period: period.value, report: (await $api.get('/services/employee-tracking', { params: { ...trackingPeriodDates(period.value), service_type_id: serviceType.value || undefined } })).data })));
    if (id !== summaryRequestId) return;
    const loaded = {}; for (const result of results) if (result.status === 'fulfilled') loaded[result.value.period] = result.value.report;
    reports.value = loaded; const first = Object.values(loaded)[0]; employees.value = first?.data || []; trackingScope.value=first?.meta?.scope || 'all'; serviceTypes.value = first?.meta?.service_types || [];
    if (results.some(result => result.status === 'rejected')) error.value = 'Some tracking periods could not be loaded. Please refresh.';
  }
  catch { if (id === summaryRequestId) { employees.value = []; error.value = 'Unable to load employee workload. Please refresh.'; } }
  finally { if (id === summaryRequestId) loadingSummary.value = false; }
}
async function refresh() { error.value = ''; await Promise.all([loadSummary(), loadOrders()]); }
watch([selectedStaff, status, serviceListPeriod, serviceType], () => { page.value = 1; });
watch([selectedStaff, status, page, perPage, serviceListPeriod, serviceType], loadOrders);
watch(serviceType, () => { error.value = ''; loadSummary(); });
onMounted(refresh);
const assignmentDialog = ref(false); const selected = ref(null); const assignedUser = ref(null); const saving = ref(false); const assignmentError = ref('');
function openAssignment(order) { selected.value = order; assignedUser.value = order.assigned_user_id || null; assignmentError.value = ''; assignmentDialog.value = true; }
async function saveAssignment() {
  if (saving.value) return; saving.value = true; assignmentError.value = '';
  try { await $api.put(`/services/orders/${selected.value.id}/assignment`, { assigned_user_id: assignedUser.value || null }); assignmentDialog.value = false; await refresh(); }
  catch (err) { assignmentError.value = err.response?.data?.message || 'Unable to save assignment.'; }
  finally { saving.value = false; }
}
const historyDialog = ref(false); const historyService = ref(null); const history = ref([]); const loadingHistory = ref(false); const historyError = ref('');
async function showHistory(order) {
  historyService.value = order; history.value = []; historyError.value = ''; historyDialog.value = true; loadingHistory.value = true;
  try { history.value = (await $api.get(`/services/employee-tracking/orders/${order.id}/history`)).data.data; }
  catch { historyError.value = 'Unable to load assignment history.'; }
  finally { loadingHistory.value = false; }
}
</script>
<style scoped>
.tracking-filters { display:flex; flex-wrap:wrap; gap:16px; }
.tracking-card-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.tracking-card-heading > :first-child { min-width:0; overflow-wrap:anywhere; }
.tracking-card-heading :deep(.tracking-period-select) { flex-shrink:0; }
.period-options { display:flex; padding:4px; gap:2px; border-radius:999px; background:rgba(var(--v-theme-on-surface),.04); }
.tracking-filters :deep(.v-input) { flex:0 1 250px; min-width:190px; }
.service-stages { display:flex; flex-wrap:wrap; gap:16px; }
.service-stages > div { flex:1; min-width:150px; display:flex; flex-direction:column; gap:6px; padding:14px; border-radius:18px; background:rgba(var(--v-theme-on-surface),.04); opacity:.65; }
.service-stages .reached { background:rgba(var(--v-theme-primary),.12); opacity:1; }
.service-stages span { font-size:12px; }
</style>
