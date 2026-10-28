<template>
  <section>
    <div class="d-flex justify-space-between align-center flex-wrap ga-3 mb-4">
      <div><h2 class="text-h6">Commission statement</h2><p class="text-body-2 text-medium-emphasis">This staff member's commission and payment history.</p></div>
      <v-btn variant="tonal" size="small" prepend-icon="mdi-refresh" :loading="loading" @click="load">Refresh</v-btn>
    </div>
    <v-row align="center" class="mb-3">
      <v-col cols="12" sm="5"><v-text-field v-model="filters.from" type="date" label="Invoice date from" density="compact" hide-details clearable /></v-col>
      <v-col cols="12" sm="5"><v-text-field v-model="filters.to" type="date" label="Invoice date to" density="compact" hide-details clearable /></v-col>
      <v-col cols="12" sm="2"><v-btn color="primary" variant="tonal" :loading="loading" @click="load">Apply</v-btn></v-col>
    </v-row>
    <p class="text-caption text-medium-emphasis mb-4">Leave dates empty to view all history. Approved balances become payable after full invoice payment.</p>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <template v-else>
      <v-row class="mb-4">
        <v-col v-for="card in cards" :key="card.key" cols="6" md="3">
          <v-card rounded="xl" variant="tonal" :color="card.color" class="pa-4 h-100">
            <div class="text-caption">{{ card.label }}</div>
            <div class="text-h6 mt-2">{{ loading ? '—' : card.key === 'eligible_count' ? (totals.eligible_count || 0) : money(totals[card.key]) }}</div>
          </v-card>
        </v-col>
      </v-row>
      <v-data-table :headers="headers" :items="entries" :loading="loading" :items-per-page="10" show-expand item-value="id" no-data-text="No commission entries for this staff member in the selected period.">
        <template #item.invoice_number="{ item }">
          <strong>{{ item.invoice_number }}</strong>
          <div class="text-caption text-medium-emphasis">{{ item.invoice_date }}</div>
        </template>
        <template #item.calculation="{ item }">{{ money(item.service_charge) }} × {{ item.percentage }}%</template>
        <template v-for="key in ['amount','paid','balance']" :key="key" #[`item.${key}`]="{ item }">{{ money(item[key]) }}</template>
        <template #item.status="{ item }"><v-chip size="small" :color="item.status === 'Paid' ? 'success' : item.status === 'Rejected' ? 'error' : item.status === 'Voided' ? 'grey' : 'primary'">{{ item.status }}</v-chip><div v-if="item.balance > 0 && !item.payable" class="text-caption mt-1">Awaiting invoice payment</div></template>
        <template #expanded-row="{ columns, item }">
          <tr><td :colspan="columns.length" class="pa-4">
            <p v-if="item.reviewed_at" class="text-caption mb-2">Reviewed {{ new Date(item.reviewed_at).toLocaleString() }}</p>
            <v-alert v-if="item.rejection_reason || item.void_reason" type="info" variant="tonal" density="compact" class="mb-3">{{ item.rejection_reason || item.void_reason }}</v-alert>
            <h3 class="text-subtitle-2 mb-2">Payment history</h3>
            <p v-if="!item.payments.length" class="text-body-2 text-medium-emphasis">No payments recorded.</p>
            <v-list v-else density="compact" bg-color="transparent"><v-list-item v-for="payment in item.payments" :key="payment.id" :title="`${money(payment.amount)} · ${payment.payment_date}`" :subtitle="payment.reversed_at ? `Reversed: ${payment.reversal_reason}` : payment.notes || 'Paid'" /></v-list>
          </td></tr>
        </template>
      </v-data-table>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '~/stores/auth';
const props = defineProps({ staffId: { type: [Number, String], required: true } });
const { $api } = useNuxtApp();
const auth = useAuthStore();
const filters = ref({ from: '', to: '' }), entries = ref([]), totals = ref({}), loading = ref(false), error = ref('');
const money = value => `AED ${Number(value || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cards = [
  { key: 'eligible_count', label: 'Eligible invoices', color: 'primary' },
  { key: 'eligible', label: 'Eligible commission', color: 'primary' },
  { key: 'pending', label: 'Pending approval', color: 'warning' },
  { key: 'approved', label: 'Approved commission', color: 'success' },
  { key: 'paid', label: 'Commission paid', color: 'success' },
  { key: 'balance', label: 'Balance to be paid', color: 'primary' },
  { key: 'payable', label: 'Payable now', color: 'primary' },
  { key: 'rejected', label: 'Rejected commission', color: 'error' }
];
const headers = computed(() => [
  { title: 'Invoice', key: 'invoice_number' }, { title: 'Calculation', key: 'calculation', sortable: false },
  { title: 'Commission', key: 'amount' }, { title: 'Paid', key: 'paid' }, { title: 'Balance', key: 'balance' }, { title: 'Status', key: 'status' }
]);
let requestVersion = 0;
async function load() {
  const version = ++requestVersion, staffId = String(props.staffId);
  loading.value = true; error.value = ''; entries.value = []; totals.value = {};
  try {
    const options = (await $api.get('/commissions/options')).data.data;
    if (options.access.view !== 'all' && staffId !== String(auth.user?.id)) throw new Error('You do not have permission to view this staff member’s commission.');
    const params = { staff_id: staffId, ...(filters.value.from ? { from: filters.value.from } : {}), ...(filters.value.to ? { to: filters.value.to } : {}) };
    const data = (await $api.get('/commissions/statement', { params })).data.data;
    if (version !== requestVersion) return;
    if (data.entries.some(entry => String(entry.staff_id) !== staffId)) throw new Error('The statement does not match this staff member. Please refresh.');
    entries.value = data.entries; totals.value = data.totals;
  } catch (err) {
    if (version === requestVersion) error.value = err.response?.data?.message || err.message || 'Unable to load commission history.';
  } finally { if (version === requestVersion) loading.value = false; }
}
watch(() => props.staffId, load, { immediate: true });
</script>
