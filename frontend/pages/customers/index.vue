<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6 align-center">
      <v-col cols="12" sm="7" md="8">
        <div class="text-caption text-uppercase font-weight-bold opacity-60 color-primary mb-1" style="letter-spacing: 0.08em;">
          CUSTOMERS
        </div>
        <h1 class="text-h4 font-weight-black color-primary">
          Client Directory
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1 mt-1">
          Manage client profiles, contact records, and active business relationships.
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
          @click="downloadTemplate"
        >
          Template
        </v-btn>
        <v-btn
          v-if="auth.can('customers', 'create')"
          color="primary"
          prepend-icon="mdi-plus"
          rounded="lg"
          elevation="2"
          height="44"
          class="px-6 font-weight-bold text-capitalize"
          @click="openCreateDialog"
        >
          Add Customer
        </v-btn>
      </v-col>
    </v-row>


    <!-- Plan Usage Limit Info -->
    <v-alert
      v-if="auth.user?.Tenant?.Plan?.max_customers && totalItems >= auth.user.Tenant.Plan.max_customers"
      type="error"
      variant="tonal"
      class="mb-4 rounded-lg font-weight-medium"
      icon="mdi-alert-octagon"
      border="start"
    >
      You have reached your workspace limit of <strong>{{ auth.user.Tenant.Plan.max_customers }}</strong> customers on the {{ auth.user.Tenant.Plan.name }} plan.
    </v-alert>

    <!-- Main Data Table Container -->
    <v-card class="soft-card overflow-hidden pa-4" variant="flat" rounded="xl">
      <!-- Filter Bar Header Inside Card -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4">
        <!-- Search Input -->
        <div style="min-width: 280px; max-width: 380px;" class="flex-grow-1">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search directory by name, email, phone..."
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            bg-color="grey-lighten-5"
            class="search-pill"
            @update:model-value="onSearch"
          ></v-text-field>
        </div>

        <!-- Filters (Status Toggle & CSV Import) -->
        <div class="d-flex align-center gap-3 flex-wrap">
          <v-select
            v-model="statusFilter"
            :items="[
              { title: 'Active Only', value: 'true' },
              { title: 'Inactive Only', value: 'false' },
              { title: 'All Statuses', value: '' }
            ]"
            item-title="title"
            item-value="value"
            prepend-inner-icon="mdi-tune-variant"
            hide-details
            density="compact"
            variant="outlined"
            rounded="lg"
            bg-color="white"
            style="width: 170px;"
            class="text-caption"
            @update:model-value="onSearch"
          ></v-select>

          <input type="file" ref="fileInput" accept=".csv" style="display: none" @change="handleFileUpload" />

          <v-btn
            v-if="auth.can('customers', 'create')"
            variant="outlined"
            color="grey-darken-1"
            prepend-icon="mdi-file-upload-outline"
            rounded="lg"
            height="40"
            class="text-capitalize text-body-2 font-weight-medium bg-white"
            @click="triggerFileInput"
          >
            Import CSV
          </v-btn>
        </div>
      </div>

      <!-- Customer Table -->
      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="customers"
        :items-length="totalItems"
        :loading="loading"
        :row-props="customerRowProps"
        @update:options="loadCustomers"
        class="bg-transparent elevation-0 custom-customer-table"
        hover
      >
        <!-- Customer Name -->
        <template v-slot:item.name="{ item }">
          <div class="d-flex align-center py-1">
            <v-avatar color="rgba(79, 66, 148, 0.1)" size="36" class="mr-3 text-primary font-weight-black">
              {{ item.name.charAt(0).toUpperCase() }}
            </v-avatar>
            <NuxtLink v-if="auth.canRecord('customers', 'detail', item)" :to="`/customers/${item.id}`" class="font-weight-bold text-body-2 color-on-surface text-truncate text-decoration-none" style="max-width: 220px;" @click.stop>
              {{ item.name }}
            </NuxtLink>
            <span v-else class="font-weight-bold text-body-2 color-on-surface text-truncate" style="max-width: 220px;">{{ item.name }}</span>
          </div>
        </template>

        <!-- Email -->
        <template v-slot:item.assigned_user_id="{ item }"><span class="text-body-2">{{ item.AssignedSalesStaff?.name || 'Unassigned' }}</span></template>
        <template v-slot:item.email="{ item }">
          <span class="text-body-2 opacity-80">{{ item.email || '-' }}</span>
        </template>

        <!-- Phone / WhatsApp -->
        <template v-slot:item.phone_whatsapp="{ item }">
          <span class="text-body-2 opacity-80">{{ item.phone_whatsapp || '-' }}</span>
        </template>

        <!-- Location -->
        <template v-slot:item.city="{ item }">
          <span class="text-body-2 opacity-80">{{ item.city || item.country || '-' }}</span>
        </template>

        <!-- Status Chip -->
        <template v-slot:item.is_active="{ item }">
          <v-chip
            size="small"
            rounded="pill"
            class="px-3 font-weight-bold text-capitalize"
            :color="item.is_active ? 'success' : 'grey'"
            variant="tonal"
            style="font-size: 11px; height: 24px;"
          >
            {{ item.is_active ? 'Active' : 'Inactive' }}
          </v-chip>
        </template>

        <!-- Actions -->
        <template v-slot:item.actions="{ item }">
          <div class="d-flex justify-end gap-1 align-center" @click.stop>
            <v-btn v-if="auth.canRecord('customers', 'detail', item)" icon="mdi-eye-outline" variant="text" size="small" color="grey-darken-1" title="View Profile" @click="viewCustomer(item.id)"></v-btn>
            <v-btn icon="mdi-whatsapp" variant="text" size="small" color="success" title="WhatsApp Message" @click.stop="openWhatsApp(item.phone_whatsapp, GENERAL_MSG)"></v-btn>
            <v-btn icon="mdi-email-outline" variant="text" size="small" color="primary" title="Send Email" @click.stop="openSendEmail(item)"></v-btn>
            <v-menu v-if="auth.canRecord('customers', 'edit_form', item) || auth.canRecord('customers', 'delete', item)" location="bottom end">
               <template v-slot:activator="{ props }">
                 <v-btn v-bind="props" icon="mdi-dots-horizontal" variant="text" size="small" color="grey-darken-1"></v-btn>
               </template>
               <v-list density="compact" width="190" rounded="lg" elevation="3">
                 <v-list-item v-if="auth.canRecord('customers', 'edit_form', item)" @click="openEditDialog(item)" prepend-icon="mdi-pencil-outline" title="Edit Customer"></v-list-item>
                 <v-divider v-if="item.is_active"></v-divider>
                 <v-list-item v-if="item.is_active && auth.canRecord('customers', 'delete', item)" @click="confirmDelete(item)" prepend-icon="mdi-delete-outline" title="Deactivate" color="error"></v-list-item>
                 <v-list-item v-if="!item.is_active && auth.canRecord('customers', 'edit', item)" @click="reactivateCustomer(item)" prepend-icon="mdi-account-reactivate-outline" title="Reactivate" color="success"></v-list-item>
               </v-list>
            </v-menu>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <CustomerForm
      v-model="dialog"
      :customer="editingCustomer"
      @saved="onSaved"
    />

    <v-dialog v-model="deleteDialog" max-width="400px">
      <v-card class="soft-card pa-4" variant="flat">
        <v-card-title class="text-h6 font-weight-bold color-on-surface">Deactivate Customer?</v-card-title>
        <v-card-text class="opacity-80">
          Are you sure you want to deactivate <b class="color-primary">{{ itemToDelete?.name }}</b>?
          This will hide them from active lists.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" class="text-capitalize font-weight-bold" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" class="text-capitalize font-weight-bold px-5 rounded-lg" @click="doDelete">Deactivate</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>

    <SendEmailDialog
      v-model="emailDialog"
      :prefill-to="emailTarget?.email"
      :prefill-customer-name="emailTarget?.name"
    />
  </v-container>
</template>

<script setup>
import { useWhatsApp } from '@/composables/useWhatsApp';
import CustomerForm from '@/components/customers/CustomerForm.vue';
import SendEmailDialog from '@/components/email/SendEmailDialog.vue';
import Papa from 'papaparse';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { openWhatsApp, GENERAL_MSG } = useWhatsApp();
const { $api } = useNuxtApp();
const router = useRouter();

const customers = ref([]);
const totalItems = ref(0);
const loading = ref(false);
const search = ref('');
const statusFilter = ref('true');
const itemsPerPage = ref(10);
const currentPage = ref(1);

const dialog = ref(false);
const editingCustomer = ref(null);
const deleteDialog = ref(false);
const itemToDelete = ref(null);

const snackbar = reactive({ show: false, text: '', color: '' })

const emailDialog = ref(false)
const emailTarget = ref(null)

const openSendEmail = (customer) => {
  emailTarget.value = customer
  emailDialog.value = true
}

const fileInput = ref(null)
const importing = ref(false)


const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.value = '';
    fileInput.value.click();
  }
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  importing.value = true;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      try {
        const res = await $api.post('/customers/bulk-import', { customers: results.data });
        if (res.data.success) {
          snackbar.text = res.data.message || 'Import successful';
          snackbar.color = 'success';
          snackbar.show = true;
          loadCustomers({ page: 1, itemsPerPage: itemsPerPage.value });
        }
      } catch (err) {
        console.error(err);
        snackbar.text = err.response?.data?.message || 'Failed to import CSV';
        snackbar.color = 'error';
        snackbar.show = true;
      } finally {
        importing.value = false;
      }
    },
    error: (error) => {
      console.error(error);
      snackbar.text = 'Failed to parse CSV file';
      snackbar.color = 'error';
      snackbar.show = true;
      importing.value = false;
    }
  });
};

const downloadTemplate = () => {
  const headers = ['name', 'phone_whatsapp', 'email', 'address', 'city', 'country', 'trade_license_no', 'notes', 'pricing_category'];
  const dummyRow = ['John Doe', '+971501234567', 'john@example.com', 'Business Bay', 'Dubai', 'UAE', 'TL123456', 'VIP Customer', 'Prime'];
  
  const csvContent = [headers.join(','), dummyRow.join(',')].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Customer_Import_Template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const headers = [
  { title: 'CUSTOMER NAME', key: 'name', align: 'start' },
  { title: 'SALESPERSON', key: 'assigned_user_id', sortable: false },
  { title: 'EMAIL ADDRESS', key: 'email' },
  { title: 'CONTACT', key: 'phone_whatsapp' },
  { title: 'LOCATION', key: 'city' },
  { title: 'STATUS', key: 'is_active', align: 'center' },
  { title: 'ACTIONS', key: 'actions', align: 'end', sortable: false }
];

const loadCustomers = async ({ page, itemsPerPage: limit }) => {
  loading.value = true;
  currentPage.value = page;
  try {
    const response = await $api.get('/customers', {
      params: {
        page,
        limit,
        search: search.value,
        is_active: statusFilter.value
      }
    });

    if (response.data.success) {
      customers.value = response.data.data;
      totalItems.value = response.data.meta.total;
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimer;
const onSearch = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadCustomers({ page: 1, itemsPerPage: itemsPerPage.value });
  }, 400);
};

const openCreateDialog = () => {
  editingCustomer.value = null;
  dialog.value = true;
};

const openEditDialog = (item) => {
  editingCustomer.value = { ...item };
  dialog.value = true;
};

const viewCustomer = (id) => {
  router.push(`/customers/${id}`);
};

const customerRowProps = ({ item }) => {
  if (!auth.canRecord('customers', 'detail', item)) return {};
  return {
    class: 'cursor-pointer',
    onClick: (event) => {
      if (event.target.closest('a, button, input, select, textarea, [role="button"], [role="menuitem"]')) return;
      viewCustomer(item.id);
    }
  };
};

const onSaved = () => {
  loadCustomers({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
  snackbar.text = 'Customer saved successfully';
  snackbar.color = 'success';
  snackbar.show = true;
};

const confirmDelete = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const doDelete = async () => {
  try {
    const response = await $api.delete(`/customers/${itemToDelete.value.id}`);
    if (response.data.success) {
      loadCustomers({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
      snackbar.text = response.data.message;
      snackbar.color = 'success';
      snackbar.show = true;
    }
  } catch (error) {
    snackbar.text = error.response?.data?.message || 'Error deleting customer';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    deleteDialog.value = false;
  }
};

const reactivateCustomer = async (item) => {
  try {
    const payload = { ...item, is_active: true };
    const response = await $api.put(`/customers/${item.id}`, payload);
    if (response.data.success) {
      loadCustomers({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
      snackbar.text = 'Customer successfully reactivated!';
      snackbar.color = 'success';
      snackbar.show = true;
    }
  } catch (error) {
    snackbar.text = error.response?.data?.message || 'Error reactivating customer';
    snackbar.color = 'error';
    snackbar.show = true;
  }
};
</script>

<style>
/* ==========================================================
   STRICT CLASSIC THEME — Customer Directory Page
   Scoped under .v-theme--classic only
   ========================================================== */

:global(.v-theme--classic) .v-container {
  background: #F8F9FE !important;
}

/* ── Stat Cards ── */
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
</style>
