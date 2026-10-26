<template>
  <v-container fluid class="sales-orders-page py-6 px-6">
    <!-- Header -->
    <v-row class="mb-6 align-center">
      <v-col cols="12" sm="7" md="8">
        <div class="text-caption text-uppercase font-weight-bold opacity-60 color-primary mb-1" style="letter-spacing: 0.08em;">
          SALES ORDERS
        </div>
        <h1 class="text-h4 font-weight-black color-primary d-flex align-center">
          Sales Orders
          <v-chip size="x-small" color="primary" class="ml-3 font-weight-bold text-uppercase px-2" style="height: 20px; font-size: 11px;">
            BETA
          </v-chip>
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1 mt-1">
          Manage customer service requests and dispatches
        </p>
      </v-col>
      <v-col cols="12" sm="5" md="4" class="d-flex align-center justify-sm-end gap-3 flex-wrap">
        <v-btn
          variant="outlined"
          color="grey-darken-2"
          prepend-icon="mdi-download-outline"
          rounded="lg"
          height="44"
          class="px-5 font-weight-bold text-capitalize bg-white"
        >
          Export
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          rounded="lg"
          elevation="2"
          height="44"
          class="px-6 font-weight-bold text-capitalize"
          v-if="authStore.can('sales_orders', 'create')"
          @click="openCreateDialog"
        >
          Create Sales Order
        </v-btn>
      </v-col>
    </v-row>

    <!-- 1 Consolidated KPI Card: Total Sales Orders with Progress Breakdown -->
    <v-card class="soft-card mb-6 pa-6" variant="flat" rounded="xl">
      <v-row align="center">
        <!-- Master Total Metric Column -->
        <v-col cols="12" md="4" class="so-kpi-main-col pr-md-6 d-flex align-center">
          <div class="d-flex align-center gap-4">
            <div class="pa-4 rounded-xl d-flex align-center justify-center flex-shrink-0" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; width: 60px; height: 60px;">
              <v-icon size="32">mdi-clipboard-text-outline</v-icon>
            </div>
            <div>
              <div class="text-caption font-weight-bold opacity-60 text-uppercase" style="letter-spacing: 0.05em;">Total Sale Orders</div>
              <div class="d-flex align-baseline gap-2 my-1">
                <span class="text-h4 font-weight-black color-primary" style="line-height: 1;">{{ totalOrdersCount }}</span>
                <span class="text-caption font-weight-bold text-secondary">Orders</span>
              </div>
              <div class="d-flex align-center gap-2">
                <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-bold px-2" rounded="pill">
                  {{ totalServicesCount }} Services
                </v-chip>
                <span class="text-caption text-secondary opacity-70">in total</span>
              </div>
            </div>
          </div>
        </v-col>

        <!-- 2 Column x 2 Row Status Breakdown with Individual Progress Bars -->
        <v-col cols="12" md="8" class="pl-md-6">
          <div class="d-flex flex-wrap justify-space-between align-center mb-3 gap-2">
            <span class="text-caption font-weight-bold text-uppercase opacity-70" style="letter-spacing: 0.05em;">Order Status Breakdown</span>
            <span class="text-caption text-secondary font-weight-bold">
              {{ completionRate }}% Active / Started
            </span>
          </div>

          <v-row class="gy-4">
            <!-- Row 1, Col 1: Pending -->
            <v-col cols="12" sm="6" class="py-2 px-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-2">
                  <v-icon size="18" color="warning">mdi-clock-outline</v-icon>
                  <span class="text-subtitle-2 font-weight-bold color-on-surface">Pending</span>
                </div>
                <div class="d-flex align-baseline gap-1">
                  <span class="text-subtitle-1 font-weight-black text-warning">{{ pendingCount }}</span>
                  <span class="text-caption text-secondary font-weight-bold">({{ pendingPercent }}%)</span>
                </div>
              </div>
              <div class="type-progress-track rounded-pill overflow-hidden" style="height: 7px; background: rgba(0, 0, 0, 0.06);">
                <div class="type-progress-bar rounded-pill bg-warning" :style="{ width: `${pendingPercent}%` }"></div>
              </div>
            </v-col>

            <!-- Row 1, Col 2: Confirmed -->
            <v-col cols="12" sm="6" class="py-2 px-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-2">
                  <v-icon size="18" color="success">mdi-check-decagram-outline</v-icon>
                  <span class="text-subtitle-2 font-weight-bold color-on-surface">Confirmed</span>
                </div>
                <div class="d-flex align-baseline gap-1">
                  <span class="text-subtitle-1 font-weight-black text-success">{{ confirmedCount }}</span>
                  <span class="text-caption text-secondary font-weight-bold">({{ confirmedPercent }}%)</span>
                </div>
              </div>
              <div class="type-progress-track rounded-pill overflow-hidden" style="height: 7px; background: rgba(0, 0, 0, 0.06);">
                <div class="type-progress-bar rounded-pill bg-success" :style="{ width: `${confirmedPercent}%` }"></div>
              </div>
            </v-col>

            <!-- Row 2, Col 1: Started -->
            <v-col cols="12" sm="6" class="py-2 px-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-2">
                  <v-icon size="18" style="color: #4F4294;">mdi-play-circle-outline</v-icon>
                  <span class="text-subtitle-2 font-weight-bold color-on-surface">Started</span>
                </div>
                <div class="d-flex align-baseline gap-1">
                  <span class="text-subtitle-1 font-weight-black" style="color: #4F4294;">{{ startedCount }}</span>
                  <span class="text-caption text-secondary font-weight-bold">({{ startedPercent }}%)</span>
                </div>
              </div>
              <div class="type-progress-track rounded-pill overflow-hidden" style="height: 7px; background: rgba(0, 0, 0, 0.06);">
                <div class="type-progress-bar rounded-pill" style="background: #4F4294;" :style="{ width: `${startedPercent}%` }"></div>
              </div>
            </v-col>

            <!-- Row 2, Col 2: Cancelled -->
            <v-col cols="12" sm="6" class="py-2 px-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-2">
                  <v-icon size="18" color="error">mdi-close-circle-outline</v-icon>
                  <span class="text-subtitle-2 font-weight-bold color-on-surface">Cancelled</span>
                </div>
                <div class="d-flex align-baseline gap-1">
                  <span class="text-subtitle-1 font-weight-black text-error">{{ cancelledCount }}</span>
                  <span class="text-caption text-secondary font-weight-bold">({{ cancelledPercent }}%)</span>
                </div>
              </div>
              <div class="type-progress-track rounded-pill overflow-hidden" style="height: 7px; background: rgba(0, 0, 0, 0.06);">
                <div class="type-progress-bar rounded-pill bg-error" :style="{ width: `${cancelledPercent}%` }"></div>
              </div>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-card>

    <!-- Search & Filters -->
    <v-card class="soft-card mb-6 pa-4" variant="flat" rounded="xl">
      <v-row align="center">
        <v-col cols="12" sm="6" md="4">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search Orders..."
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="search-pill"
          ></v-text-field>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-select
            v-model="customerFilter"
            :items="customers"
            item-title="name"
            item-value="id"
            prepend-inner-icon="mdi-filter-variant"
            placeholder="Filter by Customer"
            variant="solo"
            flat
            density="comfortable"
            hide-details
            clearable
            class="search-pill"
          ></v-select>
        </v-col>
      </v-row>
    </v-card>

    <!-- Data Table -->
    <v-card class="soft-card overflow-hidden" variant="flat" rounded="xl">
      <v-data-table
        :headers="headers"
        :items="filteredSalesOrders"
        :search="search"
        :loading="loading"
        class="bg-transparent cursor-pointer"
        hover
        @click:row="(_, { item }) => viewOrder(item)"
      >
        <template v-slot:item.order_number="{ item }">
          <span class="font-weight-black color-primary clickable-name">{{ item.order_number }}</span>
        </template>

        <template v-slot:item.customer="{ item }">
          <div class="font-weight-bold color-on-surface">{{ item.Customer?.name || 'N/A' }}</div>
          <div class="text-caption text-secondary">{{ item.Customer?.email }}</div>
        </template>

        <template v-slot:item.order_date="{ item }">
          {{ formatDate(item.order_date) }}
        </template>

        <template v-slot:item.contact_person="{ item }">
          <span class="text-body-2 opacity-80">{{ item.contact_person || '-' }}</span>
        </template>

        <template v-slot:item.services_count="{ item }">
          <v-chip size="small" color="primary" variant="tonal" class="font-weight-bold" rounded="pill">
            {{ item.SalesOrderItems?.length || 0 }} Services
          </v-chip>
        </template>

        <template v-slot:item.confirmed="{ item }">
          <div class="d-flex align-center">
            <span class="text-subtitle-2 font-weight-medium mr-1" :class="getConfirmedCount(item) > 0 ? 'text-success' : 'text-grey'">
              {{ getConfirmedCount(item) > 0 ? `${getConfirmedCount(item)}/${item.SalesOrderItems?.length} confirmed` : '-' }}
            </span>
            <v-icon
              v-if="item.SalesOrderItems?.length > 0 && (getConfirmedCount(item) + getCancelledCount(item)) >= item.SalesOrderItems?.length"
              color="success"
              size="small"
              title="All services processed"
            >mdi-check-circle</v-icon>
          </div>
        </template>

        <template v-slot:item.started="{ item }">
          <span class="text-subtitle-2 font-weight-medium" :class="getStartedCount(item) > 0 ? 'text-primary' : 'text-grey'">
            {{ getStartedCount(item) > 0 ? `${getStartedCount(item)}/${item.SalesOrderItems?.length} started` : '-' }}
          </span>
        </template>

        <template v-slot:item.cancelled="{ item }">
          <span class="text-subtitle-2 font-weight-medium" :class="getCancelledCount(item) > 0 ? 'text-error' : 'text-grey'">
            {{ getCancelledCount(item) > 0 ? `${getCancelledCount(item)} cancelled` : '-' }}
          </span>
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex justify-end gap-1 align-center">
            <v-btn
              icon="mdi-pencil-outline"
              variant="text"
              color="primary"
              size="small"
              v-if="authStore.canRecord('sales_orders', 'edit_form', item)"
              title="Edit Order / Add Services"
              @click.stop="openEditDialog(item)"
            ></v-btn>
            <div v-if="authStore.canRecord('sales_orders', 'detail', item)" class="d-flex ga-2 py-2 align-center" @click.stop>
              <DocumentExport remember compact size="small" :record-id="item.id" :types="['proforma']" label="PI" />
              <DocumentExport remember compact size="small" :record-id="item.id" :types="['sales_order']" label="SO" />
            </div>
            <v-btn
              icon="mdi-eye-outline"
              variant="text"
              color="secondary"
              size="small"
              title="View Details"
              @click.stop="viewOrder(item)"
            ></v-btn>
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              size="small"
              v-if="authStore.canRecord('sales_orders', 'delete', item)"
              title="Delete Order"
              @click.stop="deleteOrder(item)"
            ></v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <SalesOrderDialog
      v-model="dialogVisible"
      :customers="customers"
      :service-types="serviceTypes"
      :order-to-edit="orderToEdit"
      @saved="fetchData"
    />

    <SalesOrderDetail
      v-model="detailVisible"
      :order="selectedOrder"
      @edit="onEditFromDetail"
      @refresh="fetchData"
    />
  </v-container>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import SalesOrderDialog from '@/components/sales-orders/SalesOrderDialog.vue'
import SalesOrderDetail from '@/components/sales-orders/SalesOrderDetail.vue'
import { useNuxtApp } from '#app'

const uiStore = useUIStore()
const { $api } = useNuxtApp()
const authStore = useAuthStore()

const loading = ref(false)
const search = ref('')
const customerFilter = ref(null)

const salesOrders = ref([])
const customers = ref([])
const serviceTypes = ref([])

const dialogVisible = ref(false)
const detailVisible = ref(false)
const selectedOrder = ref(null)
const orderToEdit = ref(null)

const headers = [
  { title: 'ORDER NO.', key: 'order_number', sortable: true },
  { title: 'CUSTOMER', key: 'customer', sortable: true },
  { title: 'DATE', key: 'order_date', sortable: true },
  { title: 'CONTACT PERSON', key: 'contact_person', sortable: true },
  { title: 'SERVICES', key: 'services_count', sortable: false },
  { title: 'CONFIRMED', key: 'confirmed', sortable: true },
  { title: 'STARTED', key: 'started', sortable: true },
  { title: 'CANCELLED', key: 'cancelled', sortable: true },
  { title: 'ACTIONS', key: 'actions', sortable: false, align: 'end' }
]

const filteredSalesOrders = computed(() => {
  let list = salesOrders.value
  if (customerFilter.value) {
    list = list.filter(o => o.customer_id === customerFilter.value)
  }
  return list
})

const totalOrdersCount = computed(() => filteredSalesOrders.value.length)

const totalServicesCount = computed(() => {
  return filteredSalesOrders.value.reduce((acc, o) => acc + (o.SalesOrderItems?.length || 0), 0)
})

const pendingCount = computed(() => {
  return filteredSalesOrders.value.reduce((acc, o) => {
    const items = o.SalesOrderItems || []
    return acc + items.filter(i => !i.confirmed && !i.service_order_id && !i.cancelled && i.status !== 'Cancelled').length
  }, 0)
})

const confirmedCount = computed(() => {
  return filteredSalesOrders.value.reduce((acc, o) => {
    const items = o.SalesOrderItems || []
    return acc + items.filter(i => i.confirmed && !i.service_order_id && !i.cancelled && i.status !== 'Cancelled').length
  }, 0)
})

const startedCount = computed(() => {
  return filteredSalesOrders.value.reduce((acc, o) => {
    const items = o.SalesOrderItems || []
    return acc + items.filter(i => (i.service_order_id != null || i.status === 'In Progress' || i.status === 'CompletedInvoicePending' || i.status === 'CompletedInvoiceCreated') && !i.cancelled && i.status !== 'Cancelled').length
  }, 0)
})

const cancelledCount = computed(() => {
  return filteredSalesOrders.value.reduce((acc, o) => {
    const items = o.SalesOrderItems || []
    return acc + items.filter(i => i.cancelled || i.status === 'Cancelled').length
  }, 0)
})

const confirmedServicesCount = confirmedCount
const startedServicesCount = startedCount

const pendingPercent = computed(() => {
  if (!totalServicesCount.value) return 0
  return Math.round((pendingCount.value / totalServicesCount.value) * 100)
})

const confirmedPercent = computed(() => {
  if (!totalServicesCount.value) return 0
  return Math.round((confirmedCount.value / totalServicesCount.value) * 100)
})

const startedPercent = computed(() => {
  if (!totalServicesCount.value) return 0
  return Math.round((startedCount.value / totalServicesCount.value) * 100)
})

const cancelledPercent = computed(() => {
  if (!totalServicesCount.value) return 0
  return Math.round((cancelledCount.value / totalServicesCount.value) * 100)
})

const completionRate = computed(() => {
  if (!totalServicesCount.value) return 0
  return Math.round(((confirmedCount.value + startedCount.value) / totalServicesCount.value) * 100)
})

const fetchData = async () => {
  loading.value = true
  try {
    const [ordersRes, custRes, servRes] = await Promise.all([
      $api.get('/sales-orders'),
      $api.get('/customers?limit=1000&is_active=true'),
      $api.get('/services/types')
    ])
    salesOrders.value = ordersRes.data.data
    customers.value = custRes.data.data
    serviceTypes.value = servRes.data.data

    if (selectedOrder.value) {
      const updatedOrder = salesOrders.value.find(o => o.id === selectedOrder.value.id)
      if (updatedOrder) {
        selectedOrder.value = updatedOrder
      }
    }
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

const openCreateDialog = () => {
  orderToEdit.value = null
  dialogVisible.value = true
}
useCreateAction('sales_orders', openCreateDialog)

const openEditDialog = (item) => {
  orderToEdit.value = item
  dialogVisible.value = true
}

const onEditFromDetail = (item) => {
  detailVisible.value = false
  openEditDialog(item)
}

const viewOrder = (item) => {
  if (!authStore.canRecord('sales_orders', 'detail', item)) return;
  selectedOrder.value = item
  detailVisible.value = true
}

const deleteOrder = async (item) => {
  if (!confirm(`Are you sure you want to delete ${item.order_number}?`)) return
  try {
    await $api.delete(`/sales-orders/${item.id}`)
    fetchData()
  } catch (err) {
    console.error(err)
    uiStore.showError('Failed to delete')
  }
}

const downloadProforma = async (item) => {
  if (!item?.id) return
  try {
    const res = await $api.get(`/sales-orders/${item.id}/proforma-pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url;
    link.setAttribute('download', `Proforma_Invoice_${item.order_number}.pdf`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download proforma pdf', error)
    uiStore.showError('Failed to download Proforma Invoice')
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

const getConfirmedCount = (item) => {
  return item.SalesOrderItems?.filter(i => i.confirmed || i.service_order_id != null).length || 0
}

const getStartedCount = (item) => {
  return item.SalesOrderItems?.filter(i => i.service_order_id != null).length || 0
}

const getCancelledCount = (item) => {
  return item.SalesOrderItems?.filter(i => i.cancelled || i.status === 'Cancelled').length || 0
}
</script>

<style>
/* ==========================================================
   STRICT CLASSIC THEME — Sales Orders Page
   Scoped under .v-theme--classic only
   ========================================================== */

:global(.v-theme--classic) .v-container {
  background: #F8F9FE !important;
}

/* ── Stat & Filter Cards ── */
:global(.v-theme--classic) .soft-card {
  background: #FFFFFF !important;
  border: 1px solid rgba(79, 66, 148, 0.12) !important;
  box-shadow: 0 4px 20px -4px rgba(79, 66, 148, 0.08) !important;
}

/* ── Primary Buttons ── */
:global(.v-theme--classic) .v-btn--variant-elevated,
:global(.v-theme--classic) .v-btn--variant-flat {
  background: #4F4294 !important;
  color: #FFFFFF !important;
  box-shadow: 0 4px 14px -4px rgba(79, 66, 148, 0.40) !important;
}
:global(.v-theme--classic) .v-btn--variant-elevated:hover,
:global(.v-theme--classic) .v-btn--variant-flat:hover {
  background: #6554C0 !important;
  transform: translateY(-1px) !important;
}

:global(.v-theme--classic) .v-btn--variant-outlined {
  border-color: rgba(79, 66, 148, 0.30) !important;
  color: #4F4294 !important;
  background: #FFFFFF !important;
}

/* ── Data Table Header ── */
:global(.v-theme--classic) .v-data-table .v-data-table-header__content {
  color: #4F4294 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

/* ── Row Hover & Links ── */
:global(.v-theme--classic) .clickable-name {
  color: #4F4294 !important;
  transition: color 0.2s ease;
}
:global(.v-theme--classic) .clickable-name:hover {
  color: #6554C0 !important;
  text-decoration: underline;
}

:global(.v-theme--classic) .v-data-table .v-data-table__tr:hover td {
  background: rgba(79, 66, 148, 0.04) !important;
}

/* ── Active Pagination Button ── */
:global(.v-theme--classic) .v-pagination .v-btn--active {
  background: #4F4294 !important;
  color: #FFFFFF !important;
}

/* ── Focus Outline ── */
:global(.v-theme--classic) .v-field--focused .v-field__outline {
  border-color: #4F4294 !important;
}

/* ── Consolidated KPI Progress Card ── */
@media (min-width: 960px) {
  .so-kpi-main-col {
    border-right: 1px solid rgba(79, 66, 148, 0.12);
  }
}

.type-progress-track {
  position: relative;
  width: 100%;
}

.type-progress-bar {
  height: 100%;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>

