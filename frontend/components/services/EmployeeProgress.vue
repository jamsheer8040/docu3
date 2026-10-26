<template>
  <section aria-label="Employee progress and performance" class="mb-5">
    <div class="employee-grid">
      <v-card v-for="employee in employeeCards" :key="employee.id" rounded="xl" variant="flat" class="pa-5">
        <div class="card-heading"><button class="employee-name" @click="$emit('select', employee.id, '', employee.period)"><ServiceStaffAvatar :staff="employee.id === 'unassigned' ? null : employee" /><strong>{{ employee.name }}</strong><span v-if="!employee.is_active" class="text-caption">Inactive</span></button>
        <TrackingPeriodSelect :model-value="employee.period" :label="`${employee.name} period`" compact @update:model-value="employeePeriods[employee.id] = $event" /></div>
        <div class="text-caption text-medium-emphasis mt-2">{{ trackingPeriodLabel(employee.period) }}</div>
        <p v-if="employee.unavailable" class="text-caption mt-4">{{ loading ? 'Loading…' : 'Data unavailable. Please refresh.' }}</p>
        <template v-else>
        <div class="d-flex justify-space-between mt-5 mb-2 text-body-2"><span>Completed {{ employee.completed }} of {{ employee.total - employee.cancelled }}</span><strong>{{ percentage(employee) }}%</strong></div>
        <v-progress-linear :model-value="percentage(employee)" height="8" rounded color="primary" :aria-label="`${employee.name}: ${percentage(employee)}% completed`" />
        <div class="employee-counts mt-4"><button @click="$emit('select', employee.id, '', employee.period)"><strong>{{ employee.total }}</strong><span>Assigned</span></button><button @click="$emit('select', employee.id, 'In Progress', employee.period)"><strong>{{ employee.in_progress }}</strong><span>In progress</span></button><button @click="$emit('select', employee.id, 'completed', employee.period)"><strong>{{ employee.completed }}</strong><span>Completed</span></button></div>
        <div v-if="employee.id !== 'unassigned'" class="performance-note mt-4 text-caption text-medium-emphasis">{{ employee.completed_in_period }} completed in period · Average {{ duration(employee.average_hours) }}</div>
        <p v-if="employee.id !== 'unassigned' && employee.unattributed_in_period" class="text-caption text-medium-emphasis mt-2">{{ employee.unattributed_in_period }} earlier completion(s) have no recorded employee credit.</p>
        </template>
      </v-card>
    </div>
    <v-row class="mt-2">
      <v-col cols="12" lg="6"><v-card rounded="xl" variant="flat" class="pa-5 h-100"><div class="card-heading"><h2 class="text-h6">Workload by Employee</h2><TrackingPeriodSelect v-model="workloadPeriod" label="Workload chart period" compact /></div><p class="text-caption text-medium-emphasis mt-2 mb-4">{{ trackingPeriodLabel(workloadPeriod) }} · Services created</p>
        <p v-if="!reports[workloadPeriod]">{{ loading ? 'Loading…' : 'Data unavailable. Please refresh.' }}</p><template v-else>
        <div class="legend mb-5"><span v-for="segment in segments" :key="segment.key"><i :style="{ background: segment.color }" />{{ segment.label }}</span></div>
        <div v-for="employee in workloadEmployees" :key="employee.id" class="mb-4"><div class="d-flex justify-space-between text-body-2 mb-2"><span>{{ employee.name }}</span><span>{{ employee.total }}</span></div><div class="workload-track"><button v-for="segment in segments.filter(segment => employee[segment.key])" :key="segment.key" :style="{ width: `${employee[segment.key] / maxWorkload * 100}%`, background: segment.color }" :title="`${employee.name}: ${employee[segment.key]} ${segment.label}`" :aria-label="`${employee.name}: ${employee[segment.key]} ${segment.label}; view services`" @click="$emit('select', employee.id, segment.status, workloadPeriod)">{{ employee[segment.key] }}</button></div></div>
        <p v-if="!workloadEmployees.some(employee => employee.total)" class="text-medium-emphasis">No services in this period.</p></template>
      </v-card></v-col>
      <v-col cols="12" lg="6"><v-card rounded="xl" variant="flat" class="pa-5 h-100"><div class="card-heading"><h2 class="text-h6">Completion Trend</h2><TrackingPeriodSelect v-model="trendPeriod" label="Completion trend period" compact /></div><p class="text-caption text-medium-emphasis mt-2 mb-4">{{ trackingPeriodLabel(trendPeriod) }} · {{ trendMonths.length }} months shown</p>
        <p v-if="!reports[trendPeriod]">{{ loading ? 'Loading…' : 'Data unavailable. Please refresh.' }}</p><template v-else>
        <div class="trend-chart" role="img" :aria-label="trendDescription"><div v-for="month in trendMonths" :key="month.month" class="trend-column"><span class="text-caption">{{ month.count }}</span><div class="trend-track"><div :style="{ height: `${month.count / maxTrend * 100}%` }" /></div><span class="text-caption">{{ month.label }}</span></div></div>
        <p class="text-caption text-medium-emphasis mt-4">Based on completion date. Average time runs from start to completion, including waiting time. Cancelled services are excluded from completion percentages.</p><p v-if="unattributed" class="text-caption text-medium-emphasis mt-2">{{ unattributed }} historical completion(s) have no recorded employee.</p>
        </template>
      </v-card></v-col>
    </v-row>
  </section>
</template>
<script setup>
import ServiceStaffAvatar from './ServiceStaffAvatar.vue';
import TrackingPeriodSelect from './TrackingPeriodSelect.vue';
import { trackingPeriodDates, trackingPeriodLabel } from '~/utils/trackingPeriods';
const props = defineProps({ employees: { type: Array, default: () => [] }, reports: { type: Object, default: () => ({}) }, selectedStaff: String, period: String, resetKey: Number, loading: Boolean });
defineEmits(['select']);
const employeePeriods = ref({}); const workloadPeriod = ref(props.period); const trendPeriod = ref(props.period);
watch(() => props.resetKey, () => { employeePeriods.value = {}; workloadPeriod.value = props.period; trendPeriod.value = props.period; });
const employeeCards = computed(() => props.employees.map(employee => {
  const period = employeePeriods.value[employee.id] || props.period;
  const row = props.reports[period]?.data.find(row => String(row.id) === String(employee.id));
  return { ...employee, ...row, period, unavailable: !row };
}));
function periodEmployees(period) { return (props.reports[period]?.data || []).filter(employee => props.selectedStaff === 'all' || String(employee.id) === props.selectedStaff); }
const workloadEmployees = computed(() => periodEmployees(workloadPeriod.value));
const trendEmployees = computed(() => periodEmployees(trendPeriod.value));
const unattributed = computed(() => ['all', 'unassigned'].includes(props.selectedStaff) ? props.reports[trendPeriod.value]?.meta?.unattributed_completions || 0 : 0);
const segments = [{ key: 'pending', label: 'Pending / Waiting', status: 'pending', color: '#b9a2cc' }, { key: 'in_progress', label: 'In progress', status: 'In Progress', color: '#7faed0' }, { key: 'completed', label: 'Completed', status: 'completed', color: '#719e8b' }, { key: 'cancelled', label: 'Cancelled', status: 'Cancelled', color: '#c7b6b7' }];
const maxWorkload = computed(() => Math.max(1, ...workloadEmployees.value.map(employee => employee.total)));
const percentage = employee => employee.total > employee.cancelled ? Math.round(employee.completed / (employee.total - employee.cancelled) * 100) : 0;
function duration(hours) { return hours == null ? '—' : hours < 1 ? `${Math.round(hours * 60)} min` : hours < 24 ? `${hours.toFixed(1)} hr` : `${(hours / 24).toFixed(1)} days`; }
const trendMonths = computed(() => {
  const counts = new Map();
  for (const employee of trendEmployees.value) for (const item of employee.trend || []) counts.set(item.month, (counts.get(item.month) || 0) + item.count);
  const range = trackingPeriodDates(trendPeriod.value);
  const last = range.to.slice(0, 7);
  const end = new Date(`${last}-01T00:00:00Z`);
  const first = range.from.slice(0, 7);
  const months = [];
  for (let offset = 11; offset >= 0; offset--) { const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - offset, 1)); const month = date.toISOString().slice(0, 7); if (month >= first) months.push({ month, label: date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), count: counts.get(month) || 0 }); }
  return months;
});
const maxTrend = computed(() => Math.max(1, ...trendMonths.value.map(month => month.count)));
const trendDescription = computed(() => trendMonths.value.map(month => `${month.label}: ${month.count} completed`).join(', '));
</script>
<style scoped>
.employee-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr)); gap:16px; }
.card-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.card-heading > :first-child { min-width:0; overflow-wrap:anywhere; }
.card-heading :deep(.tracking-period-select) { flex-shrink:0; }
.employee-name { display:flex; align-items:center; gap:10px; text-align:left; color:inherit; }
.employee-counts { display:flex; justify-content:space-between; gap:8px; }
.employee-counts button { display:flex; flex-direction:column; text-align:left; color:inherit; }
.employee-counts strong { font-size:22px; } .employee-counts span { font-size:12px; opacity:.75; }
.legend { display:flex; flex-wrap:wrap; gap:12px; font-size:12px; } .legend span { display:flex; align-items:center; gap:5px; } .legend i { width:8px; height:8px; border-radius:50%; }
.workload-track { display:flex; height:26px; background:rgba(var(--v-theme-on-surface),.04); border-radius:20px; overflow:hidden; }
.workload-track button { min-width:18px; font-size:12px; color:#172d27; overflow:hidden; }
.trend-chart { display:flex; gap:10px; height:220px; overflow-x:auto; align-items:stretch; }
.trend-column { flex:1 0 42px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.trend-track { height:165px; width:100%; max-width:48px; background:rgba(var(--v-theme-on-surface),.04); border-radius:12px; display:flex; align-items:flex-end; overflow:hidden; }
.trend-track div { width:100%; background:#719e8b; border-radius:12px; min-height:2px; }
button:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:3px; }
</style>
