<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-4 align-center">
      <v-col cols="12" sm="7" md="8">
        <div class="text-caption text-uppercase font-weight-bold opacity-60 color-primary mb-1" style="letter-spacing: 0.08em;">
          FINANCIAL MANAGEMENT
        </div>
        <h1 class="text-h4 font-weight-black color-primary">
          Expenses &amp; Salary Management
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1 mt-1">
          Monitor operational costs, vendor invoices, and manage monthly staff salary payroll in one unified hub.
        </p>
      </v-col>
      <v-col cols="12" sm="5" md="4" class="d-flex align-center justify-sm-end gap-3 flex-wrap">
        <v-btn
          v-if="activeTab === 'operational' && auth.can('settings', 'write')"
          variant="outlined"
          color="grey-darken-2"
          prepend-icon="mdi-cog-outline"
          rounded="lg"
          height="44"
          class="px-4 font-weight-bold text-capitalize bg-white"
          @click="settingsDialog = true"
        >
          Settings
        </v-btn>
        <v-btn
          v-if="activeTab === 'operational' && auth.can('expenses', 'create')"
          color="primary"
          prepend-icon="mdi-plus"
          rounded="lg"
          elevation="2"
          height="44"
          class="px-6 font-weight-bold text-capitalize"
          @click="openAddDialog"
        >
          Add New Expense
        </v-btn>
      </v-col>
    </v-row>

    <!-- Top 4 Summary KPI Cards Row (Operational vs Salary vs Combined) -->
    <v-row class="mb-6">
      <!-- Card 1: Combined Total Expenses -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-receipt-text-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Total Expenses</div>
            <div class="text-h5 font-weight-black color-primary mb-1">
              AED {{ (salaryStore.summary.combined?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-medium text-grey-darken-1">
              Paid: <strong>AED {{ (salaryStore.summary.combined?.paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</strong>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 2: Operational Expenses Total -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(2, 136, 209, 0.1); color: #0288D1; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-office-building-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Operational OpEx</div>
            <div class="text-h5 font-weight-black color-primary mb-1">
              AED {{ (salaryStore.summary.operational?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-medium text-grey-darken-1">
              Paid: AED {{ (salaryStore.summary.operational?.paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }} &bull; Due: <strong class="text-error">AED {{ (salaryStore.summary.operational?.pending || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</strong>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Staff Salary Total -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(46, 125, 50, 0.1); color: #2E7D32; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-account-cash-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Staff Salaries</div>
            <div class="text-h5 font-weight-black color-primary mb-1">
              AED {{ (salaryStore.summary.salary?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-medium text-grey-darken-1">
              Paid: AED {{ (salaryStore.summary.salary?.paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }} &bull; Due: <strong class="text-error">AED {{ (salaryStore.summary.salary?.pending || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</strong>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Total Pending Liabilities -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(198, 40, 40, 0.1); color: #C62828; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-clock-alert-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Total Pending</div>
            <div class="text-h5 font-weight-black text-error mb-1">
              AED {{ (salaryStore.summary.combined?.pending || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-bold text-error">
              OpEx: AED {{ (salaryStore.summary.operational?.pending || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }} | Salary: AED {{ (salaryStore.summary.salary?.pending || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Navigation Tabs -->
    <v-tabs
      v-model="activeTab"
      color="primary"
      class="mb-6 modern-tabs"
      align-tabs="start"
      grow
      style="background: #FFFFFF; border-radius: 16px; border: 1px solid rgba(79, 66, 148, 0.12); padding: 4px;"
    >
      <v-tab value="operational" class="font-weight-bold text-capitalize px-6 rounded-xl" height="46">
        <v-icon start>mdi-office-building-outline</v-icon>
        Operational Expenses
        <v-chip size="x-small" color="primary" class="ml-2 font-weight-bold" variant="tonal">
          {{ expenseStore.totalItems }}
        </v-chip>
      </v-tab>
      <v-tab value="salary" class="font-weight-bold text-capitalize px-6 rounded-xl" height="46">
        <v-icon start>mdi-account-cash-outline</v-icon>
        Salary &amp; Payroll Management
        <v-chip
          size="x-small"
          :color="salaryStore.isBooked ? 'success' : 'warning'"
          class="ml-2 font-weight-bold"
          variant="tonal"
        >
          {{ salaryStore.isBooked ? 'Booked' : 'Not Booked' }}
        </v-chip>
      </v-tab>
    </v-tabs>

    <!-- Tab Contents Window -->
    <v-window v-model="activeTab">
      <!-- TAB 1: OPERATIONAL EXPENSES -->
      <v-window-item value="operational">
        <!-- Expenses Table Card Container -->
        <v-card class="soft-card overflow-hidden pa-4" variant="flat" rounded="xl">
          <!-- Filter Bar Header Inside Card -->
          <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4">
            <!-- Search Input -->
            <div style="min-width: 260px; max-width: 360px;" class="flex-grow-1">
              <v-text-field
                v-model="search"
                placeholder="Search by description, supplier, category..."
                prepend-inner-icon="mdi-magnify"
                hide-details
                density="compact"
                variant="outlined"
                rounded="lg"
                bg-color="grey-lighten-5"
                class="search-pill"
              ></v-text-field>
            </div>

            <!-- Filter Dropdowns & Controls -->
            <div class="d-flex align-center gap-3 flex-wrap">
              <v-select
                v-model="statusFilter"
                :items="['All', 'Paid', 'Unpaid', 'Partially Paid']"
                prepend-inner-icon="mdi-tune-variant"
                hide-details
                density="compact"
                variant="outlined"
                rounded="lg"
                bg-color="white"
                style="width: 160px;"
                class="text-caption"
              ></v-select>

              <v-select
                v-model="categoryFilter"
                :items="categoryOptions"
                prepend-inner-icon="mdi-shape-outline"
                hide-details
                density="compact"
                variant="outlined"
                rounded="lg"
                bg-color="white"
                style="width: 180px;"
                class="text-caption"
              ></v-select>
            </div>
          </div>

          <!-- Expenses Table -->
          <v-data-table-server
            v-model:items-per-page="itemsPerPage"
            :headers="headers"
            :items="expenseStore.expenses"
            :items-length="expenseStore.totalItems"
            :loading="expenseStore.loading"
            @update:options="loadExpenses"
            class="bg-transparent elevation-0 custom-expense-table"
            hover
          >
            <!-- Date -->
            <template v-slot:item.created_at="{ item }">
              <span class="text-body-2 opacity-80 font-weight-medium">{{ formatDate(item.created_at) }}</span>
            </template>

            <!-- Description -->
            <template v-slot:item.description="{ item }">
              <div class="py-1">
                <div class="font-weight-bold text-body-2 color-on-surface">{{ item.description || 'General Expense' }}</div>
                <div v-if="item.supplier_name" class="text-caption text-grey-darken-1 opacity-70">
                  Supplier: {{ item.supplier_name }}
                </div>
              </div>
            </template>

            <!-- Category -->
            <template v-slot:item.category="{ item }">
              <div class="d-flex flex-column gap-1 align-start">
                <v-chip size="x-small" variant="tonal" color="primary" class="font-weight-bold px-2 rounded-pill" style="height: 20px;">
                  {{ item.SubType?.ParentType?.type_name || 'Uncategorized' }}
                </v-chip>
                <div v-if="item.SubType" class="text-caption opacity-60">
                  {{ item.SubType.sub_type_name }}
                </div>
              </div>
            </template>

            <!-- Amount -->
            <template v-slot:item.amount="{ item }">
              <div class="font-weight-black text-body-2 color-on-surface">
                AED {{ parseFloat(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </div>
            </template>

            <!-- Pending -->
            <template v-slot:item.pending="{ item }">
              <span :class="parseFloat(item.amount) - parseFloat(item.paid_amount) > 0 ? 'text-error font-weight-bold text-body-2' : 'text-success font-weight-bold text-body-2'">
                AED {{ (parseFloat(item.amount) - parseFloat(item.paid_amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </span>
            </template>

            <!-- Status Chip -->
            <template v-slot:item.status="{ item }">
              <v-chip
                size="small"
                rounded="pill"
                class="px-3 font-weight-bold text-capitalize"
                :color="item.status === 'Paid' ? 'success' : (item.status === 'Partially Paid' ? 'primary' : 'warning')"
                variant="tonal"
                style="font-size: 11px; height: 24px;"
              >
                {{ item.status }}
              </v-chip>
            </template>

            <!-- Actions -->
            <template v-slot:item.actions="{ item }">
              <v-menu location="bottom end">
                <template v-slot:activator="{ props }">
                  <v-btn icon="mdi-dots-horizontal" variant="text" size="small" color="grey-darken-1" v-bind="props"></v-btn>
                </template>
                <v-list density="compact" width="200" rounded="lg" elevation="3">
                  <v-list-item 
                    v-if="item.status !== 'Paid' && auth.canRecord('expenses', 'edit', item)"
                    prepend-icon="mdi-credit-card-check-outline" 
                    title="Register Payment" 
                    color="success"
                    @click="openPayDialog(item)"
                  ></v-list-item>
                  
                  <v-list-item 
                    v-if="auth.canRecord('expenses', 'edit_form', item)"
                    prepend-icon="mdi-pencil-outline" 
                    title="Edit Details" 
                    @click="openEditDialog(item)"
                  ></v-list-item>

                  <v-divider v-if="item.status === 'Unpaid'"></v-divider>
                  
                  <v-list-item 
                    v-if="item.status === 'Unpaid' && auth.canRecord('expenses', 'delete', item)"
                    prepend-icon="mdi-delete-outline" 
                    title="Delete Expense" 
                    color="error"
                    @click="confirmDelete(item)"
                  ></v-list-item>
                </v-list>
              </v-menu>
            </template>
          </v-data-table-server>
        </v-card>
      </v-window-item>

      <!-- TAB 2: SALARY & PAYROLL MANAGEMENT -->
      <v-window-item value="salary">
        <SalaryPayrollTab />
      </v-window-item>
    </v-window>

    <!-- Dialogs -->
    <v-dialog v-model="expenseDialog" max-width="700px" persistent>
      <ExpenseDialog 
        v-if="expenseDialog"
        :expense="selectedExpense"
        @save="onExpenseSaved"
        @cancel="expenseDialog = false"
      />
    </v-dialog>

    <v-dialog v-model="payDialog" max-width="450px" persistent>
      <MarkPaidDialog
        v-if="payDialog"
        :expense="selectedExpense"
        :accounts="walletStore.accounts"
        :loading="expenseStore.loading"
        @submit="onPaymentSubmit"
        @cancel="payDialog = false"
      />
    </v-dialog>

    <!-- Settings Dialog -->
    <ExpenseSettingsDialog 
      v-if="settingsDialog"
      v-model="settingsDialog" 
      @saved="onSettingsSaved" 
    />
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUIStore } from '~/stores/ui';
import { useExpenseStore } from '~/stores/expenses';
import { useWalletStore } from '~/stores/wallet';
import { useSalaryStore } from '~/stores/salary';
import { useAuthStore } from '~/stores/auth';
import ExpenseDialog from '~/components/expenses/ExpenseDialog.vue';
import MarkPaidDialog from '~/components/expenses/MarkPaidDialog.vue';
import ExpenseSettingsDialog from '~/components/expenses/ExpenseSettingsDialog.vue';
import SalaryPayrollTab from '~/components/expenses/SalaryPayrollTab.vue';

const route = useRoute();
const router = useRouter();
const uiStore = useUIStore();
const expenseStore = useExpenseStore();
const walletStore = useWalletStore();
const salaryStore = useSalaryStore();
const auth = useAuthStore();

// Tab state (support ?tab=salary or ?tab=operational)
const activeTab = ref(route.query.tab === 'salary' ? 'salary' : 'operational');

watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } });
});

// UI State
const search = ref('');
const statusFilter = ref('All');
const categoryFilter = ref('All');
const expenseDialog = ref(false);
const payDialog = ref(false);
const settingsDialog = ref(false);
const selectedExpense = ref(null);
const itemsPerPage = ref(10);
const currentPage = ref(1);

const categoryOptions = [
  'All',
  'Office Rent',
  'Utilities',
  'Marketing',
  'Software/SaaS',
  'Government Fees',
  'Supplies',
  'Travel',
  'Other'
];

const headers = [
  { title: 'DATE', key: 'created_at' },
  { title: 'DESCRIPTION', key: 'description' },
  { title: 'CATEGORY', key: 'category' },
  { title: 'AMOUNT (AED)', key: 'amount', align: 'end' },
  { title: 'PENDING', key: 'pending', align: 'end' },
  { title: 'STATUS', key: 'status', align: 'center' },
  { title: 'ACTIONS', key: 'actions', sortable: false, align: 'end' },
];

onMounted(async () => {
  await Promise.all([
    walletStore.fetchAccounts(),
    salaryStore.fetchSummary(),
    salaryStore.fetchMonthPayroll()
  ]);
});

const loadExpenses = async ({ page, itemsPerPage: limit }) => {
  currentPage.value = page;
  itemsPerPage.value = limit;

  await expenseStore.fetchExpenses({
    page,
    limit,
    status: statusFilter.value === 'All' ? undefined : statusFilter.value,
    category: categoryFilter.value === 'All' ? undefined : categoryFilter.value,
    search: search.value || undefined
  });
  // Also refresh overall summary
  await salaryStore.fetchSummary();
};

let searchTimer;
watch([statusFilter, categoryFilter, search], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadExpenses({ page: 1, itemsPerPage: itemsPerPage.value });
  }, 400);
});

const openAddDialog = () => {
  selectedExpense.value = null;
  expenseDialog.value = true;
};

const openEditDialog = (expense) => {
  selectedExpense.value = expense;
  expenseDialog.value = true;
};

const onExpenseSaved = () => {
  expenseDialog.value = false;
  loadExpenses({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
};

const openPayDialog = (expense) => {
  selectedExpense.value = expense;
  payDialog.value = true;
};

const onPaymentSubmit = async (data) => {
  try {
    await expenseStore.payExpense(selectedExpense.value.id, data.account_id, data.payment_date, data.amount);
    payDialog.value = false;
    loadExpenses({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
  } catch (err) {
    uiStore.showError('Payment processing failed');
  }
};

const confirmDelete = async (expense) => {
  if (confirm(`Delete expense: ${expense.description}?`)) {
    await expenseStore.deleteExpense(expense.id);
    await salaryStore.fetchSummary();
  }
};

const onSettingsSaved = () => {
  loadExpenses({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB');
};
</script>

<style>
/* ==========================================================
   STRICT CLASSIC THEME — Expense & Salary Page
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

/* ── Modern Tabs ── */
:global(.v-theme--classic) .modern-tabs .v-tab--selected {
  background: #4F4294 !important;
  color: #FFFFFF !important;
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

/* ── Row Hover ── */
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
