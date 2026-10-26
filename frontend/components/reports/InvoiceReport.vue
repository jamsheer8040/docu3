<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-4 align-center">
      <v-col cols="12" md="6">
        <h1 class="text-h4 font-weight-bold color-primary">
          <v-icon icon="mdi-receipt-text" class="mr-2" color="primary"></v-icon>
          Invoice Report
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">Detailed list of all invoices</p>
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
        <v-col cols="12" sm="6" md="4" xl="2">
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
        <v-col cols="12" sm="6" md="4" xl="2">
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
        <v-col cols="12" sm="6" md="4" xl="2">
          <v-select
            v-model="filters.status"
            :items="['All', 'Draft', 'Sent', 'Issued', 'Paid', 'Partially Paid', 'Cancelled']"
            placeholder="Status"
            prepend-inner-icon="mdi-filter-variant"
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="search-pill"
          ></v-select>
        </v-col>
        <v-col cols="12" sm="6" md="4" xl="2">
          <v-text-field
            v-model="filters.search"
            placeholder="Search Inv/Customer"
            prepend-inner-icon="mdi-magnify"
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="search-pill"
          ></v-text-field>
        </v-col>
        <v-col cols="12" sm="6" md="4" xl="2">
          <v-select v-model="filters.aging" :items="agingOptions" label="Invoice aging" prepend-inner-icon="mdi-clock-outline" variant="solo" flat density="comfortable" hide-details class="search-pill" @update:model-value="applyFilters" />
        </v-col>
        <v-col cols="12" sm="6" md="4" xl="2" class="d-flex align-center">
          <v-btn color="primary" class="btn-3d" block height="48" @click="applyFilters">Apply Filters</v-btn>
        </v-col>
      </v-row>
    </v-card>

    <p class="text-caption text-medium-emphasis mb-4">Aging shows all invoices at least the selected number of days old, counted from the invoice date.</p>
    <!-- Data Table -->
    <v-card class="border rounded-xl" variant="flat">
      <v-data-table-server
        v-model:page="currentPage"
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
        <template v-slot:item.status="{ item }">
          <v-chip
            :color="item.status === 'Paid' ? 'success' : (item.status === 'Partially Paid' ? 'orange' : (item.status === 'Cancelled' ? 'error' : 'primary'))"
            size="small"
            class="font-weight-bold"
          >
            {{ item.status }}
          </v-chip>
        </template>
        <template v-slot:item.Customer.name="{ item }">
          <span class="font-weight-medium">{{ item.Customer?.name || 'N/A' }}</span>
        </template>
        <template v-slot:item.subtotal="{ item }">
          AED {{ parseFloat(item.subtotal || 0).toFixed(2) }}
        </template>
        <template v-slot:item.tax="{ item }">
          AED {{ parseFloat(item.tax || 0).toFixed(2) }}
        </template>
        <template v-slot:item.total="{ item }">
          <span class="font-weight-bold">AED {{ parseFloat(item.total || 0).toFixed(2) }}</span>
        </template>
        <template v-slot:item.paid_amount="{ item }">
          <span class="text-success font-weight-medium">AED {{ parseFloat(item.paid_amount || 0).toFixed(2) }}</span>
        </template>
        <template v-slot:tfoot>
          <tr v-if="items.length > 0" class="bg-grey-lighten-4 font-weight-black">
            <td colspan="3" class="text-right">Page Total:</td>
            <td class="text-right">AED {{ currentTotals.subtotal.toFixed(2) }}</td>
            <td class="text-right">AED {{ currentTotals.tax.toFixed(2) }}</td>
            <td class="text-right">AED {{ currentTotals.total.toFixed(2) }}</td>
            <td class="text-right text-success">AED {{ currentTotals.paid_amount.toFixed(2) }}</td>
            <td></td>
          </tr>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'

const uiStore = useUIStore()
import { ref, reactive, computed, watch } from 'vue';

const { $api } = useNuxtApp();
const route = useRoute();
const queryAging = () => ['30', '60', '90', '120'].includes(route.query.aging) ? route.query.aging : '';
const queryDate = key => typeof route.query[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query[key]) ? route.query[key] : '';

const loading = ref(false);
const items = ref([]);
const totalItems = ref(0);
const itemsPerPage = ref(15);
const currentPage = ref(1);

const filters = reactive({
  from: queryDate('from'),
  to: queryDate('to'),
  status: 'All',
  aging: queryAging(),
  search: ''
});
const agingOptions = [
  { title: 'All ages', value: '' },
  { title: '30+ days', value: '30' },
  { title: '60+ days', value: '60' },
  { title: '90+ days', value: '90' },
  { title: '120+ days', value: '120' }
];

const currentTotals = computed(() => {
  return items.value.reduce((acc, curr) => {
    acc.subtotal += parseFloat(curr.subtotal || 0)
    acc.tax += parseFloat(curr.tax || 0)
    acc.total += parseFloat(curr.total || 0)
    acc.paid_amount += parseFloat(curr.paid_amount || 0)
    return acc
  }, { subtotal: 0, tax: 0, total: 0, paid_amount: 0 })
});

const headers = [
  { title: 'Date', key: 'created_at', sortable: false },
  { title: 'Invoice No', key: 'invoice_number', sortable: false },
  { title: 'Customer', key: 'Customer.name', sortable: false },
  { title: 'Subtotal', key: 'subtotal', sortable: false, align: 'end' },
  { title: 'Tax', key: 'tax', sortable: false, align: 'end' },
  { title: 'Total', key: 'total', sortable: false, align: 'end' },
  { title: 'Paid Amount', key: 'paid_amount', sortable: false, align: 'end' },
  { title: 'Status', key: 'status', sortable: false, align: 'center' }
];

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB');
};

const fetchData = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      limit: itemsPerPage.value
    };
    
    if (filters.from) params.date_from = filters.from;
    if (filters.to) params.date_to = filters.to;
    if (filters.status !== 'All') params.status = filters.status;
    if (filters.search) params.search = filters.search;
    if (filters.aging) params.aging = filters.aging;

    const res = await $api.get('/invoices', { params });
    if (res.data?.success) {
      items.value = res.data.data;
      totalItems.value = res.data.meta?.total || 0;
    }
  } catch (err) {
    console.error('Failed to fetch invoice report', err);
    items.value = [];
    totalItems.value = 0;
    uiStore.showError('Failed to fetch invoice report');
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  currentPage.value = 1;
  fetchData();
};
watch(() => [route.query.aging, route.query.from, route.query.to], () => {
  filters.aging = queryAging();
  filters.from = queryDate('from');
  filters.to = queryDate('to');
  applyFilters();
});

const onOptionsUpdate = ({ page, itemsPerPage: limit }) => {
  currentPage.value = page;
  itemsPerPage.value = limit;
  fetchData();
};

const exportCSV = () => {
  if (!items.value.length) return uiStore.showError('No data to export');
  
  const csvHeaders = ['Date', 'Invoice No', 'Customer', 'Subtotal', 'Tax', 'Total', 'Paid Amount', 'Status'];
  const rows = items.value.map(item => [
    formatDate(item.created_at),
    item.invoice_number,
    `"${item.Customer?.name || ''}"`,
    parseFloat(item.subtotal || 0).toFixed(2),
    parseFloat(item.tax || 0).toFixed(2),
    parseFloat(item.total || 0).toFixed(2),
    parseFloat(item.paid_amount || 0).toFixed(2),
    item.status
  ]);

  const csvContent = [csvHeaders.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Invoice_Report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>
