<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-4 align-center">
      <v-col cols="12" md="6">
        <h1 class="text-h4 font-weight-bold color-primary">
          <v-icon icon="mdi-chart-line" class="mr-2" color="success"></v-icon>
          Profitability Report
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">{{ commissionEnabled ? 'Net profit = service charges − discounts − expenses. Commission expense is recognised on approval, once.' : 'Net profit = service charges − discounts − expenses.' }}</p>
      </v-col>
      <v-col cols="12" md="6" class="text-md-right">
        <v-btn color="primary" class="btn-3d" prepend-icon="mdi-download" @click="exportCSV" :loading="loading">
          Export to CSV
        </v-btn>
      </v-col>
    </v-row>

    <!-- Filters -->
    <v-card class="pa-4 border rounded-xl mb-6 bg-surface" variant="flat">
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="filters.from"
            type="date"
            placeholder="Date From"
            prepend-inner-icon="mdi-calendar"
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="search-pill"
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="filters.to"
            type="date"
            placeholder="Date To"
            prepend-inner-icon="mdi-calendar"
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="search-pill"
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center">
          <v-btn color="primary" class="btn-3d" block height="48" @click="fetchData">Apply Filters</v-btn>
        </v-col>
      </v-row>
    </v-card>

    <!-- Summary Overview -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card class="pa-4 border rounded-xl bg-blue-lighten-5" variant="flat">
          <div class="text-caption font-weight-bold text-uppercase opacity-70">Total Service Charges Created</div>
          <div class="text-h5 font-weight-bold text-primary">AED {{ totals.revenue.toFixed(2) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="pa-4 border rounded-xl bg-orange-lighten-5" variant="flat">
          <div class="text-caption font-weight-bold text-uppercase opacity-70">Internal Cost (This Page)</div>
          <div class="text-h5 font-weight-bold text-orange-darken-3">AED {{ totals.cost.toFixed(2) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="pa-4 border rounded-xl bg-red-lighten-5" variant="flat">
          <div class="text-caption font-weight-bold text-uppercase opacity-70">Total Overhead (Expenses)</div>
          <div class="text-h5 font-weight-bold text-error">AED {{ totals.overhead.toFixed(2) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="pa-4 border rounded-xl bg-green-lighten-5" variant="flat">
          <div class="text-caption font-weight-bold text-uppercase opacity-70">True Net Profit</div>
          <div class="text-h5 font-weight-bold text-success">AED {{ totals.netProfit.toFixed(2) }}</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Data Table -->
    <v-card class="border rounded-xl" variant="flat">
      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="items"
        :items-length="totalItems"
        :loading="loading"
        @update:options="onOptionsUpdate"
        hover
      >
        <template v-slot:item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
        <template v-slot:item.Customer.name="{ item }">
          <span class="font-weight-medium">{{ item.Customer?.name || 'N/A' }}</span>
        </template>
        <template v-slot:item.subtotal="{ item }">
          AED {{ parseFloat(item.subtotal || 0).toFixed(2) }}
        </template>
        <template v-slot:item.cost_total="{ item }">
          <span class="text-error">AED {{ parseFloat(item.cost_total || 0).toFixed(2) }}</span>
        </template>
        <template v-slot:item.gross_profit="{ item }">
          <span class="font-weight-bold text-success">AED {{ parseFloat(item.gross_profit || 0).toFixed(2) }}</span>
        </template>
        <template v-slot:item.commission="{ item }">
          <span class="text-error">AED {{ parseFloat(item.commission || 0).toFixed(2) }}</span>
        </template>
        <template v-slot:item.margin="{ item }">
          <v-chip
            size="small"
            :color="getMarginColor(item.subtotal, item.gross_profit)"
            variant="tonal"
            class="font-weight-bold"
          >
            {{ calculateMargin(item.subtotal, item.gross_profit) }}%
          </v-chip>
        </template>
        <template v-slot:tfoot>
          <tr v-if="items.length > 0" class="bg-grey-lighten-4 font-weight-black">
            <td colspan="3" class="text-right">Page Total:</td>
            <td class="text-right">AED {{ currentTotals.subtotal.toFixed(2) }}</td>
            <td class="text-right text-error">AED {{ currentTotals.cost_total.toFixed(2) }}</td>
            <td v-if="commissionEnabled" class="text-right text-error">AED {{ currentTotals.commission.toFixed(2) }}</td>
            <td class="text-right text-success">AED {{ currentTotals.gross_profit.toFixed(2) }}</td>
            <td></td>
          </tr>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'
import { useConfigStore } from '~/stores/config'
const configStore=useConfigStore();
const commissionEnabled=computed(()=>configStore.commissionEnabled);

const uiStore = useUIStore()
import { ref, reactive, computed, watch } from 'vue';

const { $api } = useNuxtApp();
const route = useRoute();
const queryDate = key => typeof route.query[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query[key]) ? route.query[key] : '';

const loading = ref(false);
const items = ref([]);
const totalItems = ref(0);
const itemsPerPage = ref(15);
const currentPage = ref(1);

const totals = reactive({
  revenue: 0,
  cost: 0,
  overhead: 0,
  netProfit: 0
});

const filters = reactive({
  from: queryDate('from'),
  to: queryDate('to')
});

const currentTotals = computed(() => {
  return items.value.reduce((acc, curr) => {
    acc.subtotal += parseFloat(curr.subtotal || 0)
    acc.cost_total += parseFloat(curr.cost_total || 0)
    acc.commission += parseFloat(curr.commission || 0)
    acc.gross_profit += parseFloat(curr.gross_profit || 0)
    return acc
  }, { subtotal: 0, cost_total: 0, commission: 0, gross_profit: 0 })
});

const headers = computed(() => [
  { title: 'Date', key: 'created_at', sortable: false },
  { title: 'Invoice No', key: 'invoice_number', sortable: false },
  { title: 'Customer', key: 'Customer.name', sortable: false },
  { title: 'Invoice Subtotal', key: 'subtotal', sortable: false, align: 'end' },
  { title: 'Internal Cost', key: 'cost_total', sortable: false, align: 'end' },
  { title: 'Approved Commission', key: 'commission', sortable: false, align: 'end' },
  { title: commissionEnabled.value ? 'Invoice Profit after Commission' : 'Invoice Profit', key: 'gross_profit', sortable: false, align: 'end' },
  { title: 'Margin', key: 'margin', sortable: false, align: 'center' }
].filter(header=>header.key!=='commission' || commissionEnabled.value));

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB');
};

const calculateMargin = (revenue, profit) => {
  const rev = parseFloat(revenue) || 0;
  const prof = parseFloat(profit) || 0;
  if (rev === 0) return 0;
  return ((prof / rev) * 100).toFixed(1);
};

const getMarginColor = (revenue, profit) => {
  const margin = calculateMargin(revenue, profit);
  if (margin >= 30) return 'success';
  if (margin >= 10) return 'warning';
  return 'error';
};

const fetchData = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      limit: itemsPerPage.value
    };
    
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;

    const res = await $api.get('/reports/profit-details', { params });
    if (res.data?.success) {
      if(typeof res.data.data.commission_enabled==='boolean')configStore.settings.commission_enabled=res.data.data.commission_enabled;
      items.value = res.data.data.invoices;
      totalItems.value = res.data.data.total_invoices;
      totals.overhead = res.data.data.overhead_costs || 0;
      
      // Calculate totals for current page or we can just sum what's loaded
      // Ideally backend returns total aggregates, but we can do it on the frontend for now
      let rev = 0, cost = 0, profit = 0;
      items.value.forEach(i => {
        rev += parseFloat(i.subtotal || 0);
        cost += parseFloat(i.cost_total || 0);
        profit += parseFloat(i.gross_profit || 0);
      });
      totals.revenue = Number(res.data.data.totals?.service_charges || 0);
      totals.cost = cost;
      // Note: net profit = gross profit - overhead
      totals.netProfit = Number(res.data.data.totals?.net_profit || 0);
    }
  } catch (err) {
    console.error('Failed to fetch profit report', err);
  } finally {
    loading.value = false;
  }
};

const onOptionsUpdate = ({ page, itemsPerPage: limit }) => {
  currentPage.value = page;
  itemsPerPage.value = limit;
  fetchData();
};
watch(() => [route.query.from, route.query.to], () => {
  filters.from = queryDate('from'); filters.to = queryDate('to');
  currentPage.value = 1; fetchData();
});

const exportCSV = () => {
  if (!items.value.length) return uiStore.showError('No data to export');
  
  const csvHeaders = ['Date','Invoice No','Customer','Invoice Subtotal','Internal Cost',...(commissionEnabled.value?['Approved Commission']:[]),commissionEnabled.value?'Invoice Profit after Commission':'Invoice Profit','Margin %'];
  const rows = items.value.map(item => [
    formatDate(item.created_at),
    item.invoice_number,
    `"${item.Customer?.name || ''}"`,
    parseFloat(item.subtotal || 0).toFixed(2),
    parseFloat(item.cost_total || 0).toFixed(2),
    ...(commissionEnabled.value?[parseFloat(item.commission || 0).toFixed(2)]:[]),
    parseFloat(item.gross_profit || 0).toFixed(2),
    calculateMargin(item.subtotal, item.gross_profit)
  ]);

  // Add Summary rows
  rows.push(['']);
  if(commissionEnabled.value)rows.push(['Approved Commission (This Page)', currentTotals.value.commission.toFixed(2)]);
  rows.push(['Total Overhead Expenses', totals.overhead.toFixed(2)]);
  rows.push(['True Net Profit (Selected Period)', totals.netProfit.toFixed(2)]);

  const csvContent = [csvHeaders.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Profit_Report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>
