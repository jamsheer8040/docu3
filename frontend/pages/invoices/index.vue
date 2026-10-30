<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6 align-center">
      <v-col cols="12" sm="7" md="8">
        <div class="text-caption text-uppercase font-weight-bold opacity-60 color-primary mb-1" style="letter-spacing: 0.08em;">
          INVOICES
        </div>
        <h1 class="text-h4 font-weight-black color-primary d-flex align-center">
          Invoice List
          <v-chip size="x-small" color="primary" class="ml-3 font-weight-bold text-uppercase px-2" style="height: 20px; font-size: 11px;">
            BETA
          </v-chip>
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1 mt-1">
          Manage, issue and track corporate billing and payment links in one place.
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
          v-if="auth.can('invoices', 'create')"
          color="primary"
          prepend-icon="mdi-plus"
          rounded="lg"
          elevation="2"
          height="44"
          class="px-6 font-weight-bold text-capitalize"
          @click="openCreateDialog"
        >
          Create Invoice
        </v-btn>
      </v-col>
    </v-row>

    <!-- Top 4 Summary KPI Cards Row -->
    <v-row class="mb-6">
      <!-- Card 1: Total Invoices -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-file-document-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Total Invoices</div>
            <div class="text-h5 font-weight-black color-primary mb-1">
              {{ invoiceStore.totalInvoices }}
            </div>
            <div class="text-caption font-weight-bold text-success">
              &uarr; 12% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 2: Total Revenue / Billed -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-currency-usd</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Total Revenue</div>
            <div class="text-h5 font-weight-black color-primary mb-1">
              AED {{ stats.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-bold text-success">
              &uarr; 18% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Pending Invoices -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-clock-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Pending</div>
            <div class="text-h5 font-weight-black text-warning mb-1">
              {{ stats.pendingCount }}
            </div>
            <div class="text-caption font-weight-bold text-success">
              &uarr; 5% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Paid Invoices -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-check-circle-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Paid Invoices</div>
            <div class="text-h5 font-weight-black text-success mb-1">
              {{ stats.paidCount }}
            </div>
            <div class="text-caption font-weight-bold text-success">
              &uarr; 16% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Invoices Table Card Container -->
    <v-card class="soft-card overflow-hidden pa-4" variant="flat" rounded="xl">
      <!-- Filter & Search Bar Header Inside Card -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4">
        <!-- Search Input -->
        <div style="min-width: 280px; max-width: 360px;" class="flex-grow-1">
          <v-text-field
            v-model="search"
            placeholder="Search invoice number, client..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            density="compact"
            variant="outlined"
            rounded="lg"
            bg-color="grey-lighten-5"
            class="search-pill"
          ></v-text-field>
        </div>

        <!-- Filters (Status & Date Range) -->
        <div class="d-flex align-center gap-3">
          <v-select
            v-model="statusFilter"
            :items="['All', 'Paid', 'Pending', 'Overdue', 'Draft', 'Issued', 'Cancelled']"
            prepend-inner-icon="mdi-tune-variant"
            hide-details
            density="compact"
            variant="outlined"
            rounded="lg"
            bg-color="white"
            style="width: 170px;"
            class="text-caption"
          ></v-select>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            prepend-icon="mdi-calendar-range"
            rounded="lg"
            height="40"
            class="text-capitalize text-body-2 font-weight-medium bg-white"
          >
            Date Range
          </v-btn>
        </div>
      </div>

      <!-- Data Table -->
      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="invoiceStore.invoices"
        :items-length="invoiceStore.totalInvoices"
        :loading="invoiceStore.loading"
        :row-props="invoiceRowProps"
        @update:options="loadInvoices"
        class="bg-transparent elevation-0 custom-invoice-table"
        hover
      >
        <!-- Invoice Number -->
        <template v-slot:item.invoice_number="{ item }">
          <span class="font-weight-bold text-primary cursor-pointer text-body-2" @click.stop="viewInvoice(item)">
            {{ item.invoice_number }}
          </span>
        </template>

        <!-- Customer / Client Name -->
        <template v-slot:item.Customer="{ item }">
          <div class="py-1">
            <div class="font-weight-bold text-body-2 color-on-surface">{{ item.Customer?.name || 'Walk-in Client' }}</div>
            <div class="text-caption text-grey-darken-1 opacity-70">
              {{ item.Customer?.trn ? `VAT Registered · TRN ${item.Customer.trn}` : (item.notes || 'Standard Service Invoice') }}
            </div>
          </div>
        </template>

        <!-- Date -->
        <template v-slot:item.created_at="{ item }">
          <span class="text-body-2 opacity-80">{{ formatDate(item.created_at) }}</span>
        </template>

        <!-- Status Chip -->
        <template v-slot:item.status="{ item }">
          <v-chip
            size="small"
            rounded="pill"
            class="px-3 font-weight-bold text-capitalize"
            :class="{ 'invoice-status-paid': item.status === 'Paid', 'invoice-status-unpaid': ['Pending', 'Issued', 'Draft', 'Partially Paid', 'Overdue', 'Approved', 'Pending Approval'].includes(item.status) }"
            :color="getStatusColor(item.status)"
            variant="tonal"
            style="font-size: 11px; height: 24px;"
          >
            {{ getStatusLabel(item.status) }}
          </v-chip>
        </template>

        <!-- Total Amount -->
        <template v-slot:item.total="{ item }">
          <div class="font-weight-black text-body-2 color-on-surface">
            AED {{ parseFloat(item.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
        </template>

        <!-- Actions -->
        <template v-slot:item.actions="{ item }">
          <div class="d-inline-flex flex-column ga-1 py-2 mr-2" @click.stop>
            <DocumentExport v-if="auth.canRecord('invoices', 'detail', item)" remember size="small" :record-id="item.id" :types="[invoiceConfig.invoiceDocumentType]" :label="invoiceConfig.invoiceDocumentType === 'tax_invoice' ? 'Tax Invoice PDF' : 'Invoice PDF'" />
          </div>
          <span class="invoice-edit-slot">
            <v-btn v-if="canEditInvoice(item)" icon="mdi-pencil-outline" variant="text" size="small" color="primary" title="Edit invoice" :loading="editingId === item.id" @click.stop="editInvoice(item)" />
          </span>
          <v-menu location="bottom end">
            <template v-slot:activator="{ props }">
              <v-btn icon="mdi-dots-horizontal" variant="text" size="small" color="grey-darken-1" v-bind="props"></v-btn>
            </template>
            <v-list density="compact" width="200" rounded="lg" elevation="3">
              <v-list-item 
                v-if="canEditInvoice(item)"
                prepend-icon="mdi-pencil-outline" 
                title="Edit Invoice" 
                @click="editInvoice(item)"
              ></v-list-item>

              <v-list-item 
                v-if="item.status === 'Draft' && auth.canRecord('invoices', 'edit', item)"
                prepend-icon="mdi-send-check-outline" 
                title="Issue Invoice" 
                @click="updateStatus(item, 'Issued')"
              ></v-list-item>
              
              <v-list-item 
                prepend-icon="mdi-file-pdf-box" 
                v-if="auth.canRecord('invoices', 'detail', item)"
                title="Download PDF" 
                @click="downloadPDF(item)"
              ></v-list-item>

              <v-list-item 
                v-if="['Issued', 'Partially Paid'].includes(item.status) && auth.canRecord('invoices', 'edit', item)"
                prepend-icon="mdi-credit-card-plus-outline" 
                title="Collect Payment" 
                color="success"
                @click="openPayDialog(item)"
              ></v-list-item>

              <v-divider v-if="item.status !== 'Cancelled'"></v-divider>
              
              <v-list-item 
                v-if="item.status !== 'Cancelled' && auth.canRecord('invoices', 'delete', item)"
                prepend-icon="mdi-cancel" 
                title="Cancel Invoice" 
                color="error"
                @click="confirmCancel(item)"
              ></v-list-item>
            </v-list>
          </v-menu>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Dialogs -->
    <v-dialog v-model="viewDialog" max-width="95vw">
        <InvoiceDetailView 
            v-if="viewDialog" 
            :invoice-id="selectedInvoice?.id" 
            @close="viewDialog = false" 
            @edit="editInvoice($event)"
        />
    </v-dialog>

    <v-dialog v-model="payDialog" max-width="450px" persistent>
        <v-card class="soft-card pa-4">
            <v-card-title class="text-h6 font-weight-bold d-flex align-center">
                <v-icon icon="mdi-cash-register" class="mr-2" color="success"></v-icon>
                Collect Payment
            </v-card-title>
            <v-card-text>
                <div class="mb-6 pa-4 bg-grey-lighten-4 rounded-lg border">
                  <v-row dense>
                    <v-col cols="6">
                      <div class="text-caption text-uppercase font-weight-bold opacity-60 mb-1">Total</div>
                      <div class="font-weight-bold text-primary">AED {{ parseFloat(selectedInvoice?.total || 0).toFixed(2) }}</div>
                    </v-col>
                    <v-col cols="6">
                      <div class="text-caption text-uppercase font-weight-bold opacity-60 mb-1">Due</div>
                      <div class="font-weight-bold text-error">AED {{ (parseFloat(selectedInvoice?.total || 0) - parseFloat(selectedInvoice?.paid_amount || 0)).toFixed(2) }}</div>
                    </v-col>
                  </v-row>
                </div>

                <v-text-field
                    v-model="paymentAmount"
                    label="Amount to Collect"
                    prefix="AED"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    hide-details
                    class="mb-4 soft-input"
                    bg-color="transparent"
                ></v-text-field>

                <v-select
                    v-model="paymentAccount"
                    :items="walletStore.accounts"
                    item-title="name"
                    item-value="id"
                    label="Deposit Into Account"
                    placeholder="Select Bank or Cash"
                    variant="outlined"
                    density="comfortable"
                    :loading="walletStore.loading"
                    hide-details
                    class="soft-input"
                    bg-color="transparent"
                ></v-select>
            </v-card-text>
            <v-card-actions class="px-4 pb-4">
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="payDialog = false">Cancel</v-btn>
                <v-btn 
                    color="success" 
                    variant="flat" 
                    :disabled="!paymentAccount || !paymentAmount" 
                    @click="confirmPayment"
                    :loading="invoiceStore.loading"
                    class="rounded-pill px-6"
                >
                    Confirm Collection
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Invoice Design Dialog (Manual Creation) -->
    <v-dialog v-model="invoiceDialog" fullscreen persistent>
        <InvoiceDialog 
            v-if="invoiceDialog"
            :invoice="editableInvoice"
            @save="onInvoiceSaved"
            @cancel="invoiceDialog = false"
        />
    </v-dialog>

  </v-container>
</template>

<script setup>
import { useConfigStore } from '~/stores/config';
const invoiceConfig = useConfigStore();
import { useUIStore } from '~/stores/ui'

const uiStore = useUIStore()
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useInvoiceStore } from '~/stores/invoices';
import { useWalletStore } from '~/stores/wallet';
import InvoiceStatusChip from '~/components/invoices/InvoiceStatusChip.vue';
import InvoiceDetailView from '~/components/invoices/InvoiceDetailView.vue';
import InvoiceDialog from '~/components/invoices/InvoiceDialog.vue';
import { useWhatsApp } from '~/composables/useWhatsApp';
import { useAuthStore } from '~/stores/auth';

const invoiceStore = useInvoiceStore();
const walletStore = useWalletStore();
const auth = useAuthStore();
const { openWhatsApp, MESSAGES } = useWhatsApp();

// UI State
const search = ref('');
const statusFilter = ref('All');
const itemsPerPage = ref(10);
const currentPage = ref(1);
const viewDialog = ref(false);
const payDialog = ref(false);
const invoiceDialog = ref(false);
const selectedInvoice = ref(null);
const editableInvoice = ref(null);
const editingId = ref(null);
const canEditInvoice = invoice => ['Draft', 'Pending Approval', 'Issued', 'Overdue'].includes(invoice.status) && Number(invoice.paid_amount || 0) === 0 && auth.canRecord('invoices', 'edit_form', invoice);
const paymentAccount = ref(null);
const paymentAmount = ref(0);

const headers = [
  { title: 'INVOICE #', key: 'invoice_number' },
  { title: 'CLIENT NAME', key: 'Customer' },
  { title: 'DATE', key: 'created_at' },
  { title: 'STATUS', key: 'status' },
  { title: 'AMOUNT', key: 'total', align: 'end' },
  { title: 'ACTION', key: 'actions', sortable: false, align: 'end' },
];

const stats = computed(() => {
    let totalBilled = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let activeClientsSet = new Set();
    let pendingApprovalCount = 0;

    invoiceStore.invoices.forEach(inv => {
        const total = parseFloat(inv.total || 0);
        if (inv.status !== 'Cancelled') {
            totalBilled += total;
        }
        if (inv.status === 'Paid') {
            paidCount++;
        }
        if (inv.status === 'Issued' || inv.status === 'Partially Paid' || inv.status === 'Draft' || inv.status === 'Pending') {
            pendingCount++;
        }
        if (inv.Customer?.id) {
            activeClientsSet.add(inv.Customer.id);
        }
        if (inv.status === 'Draft' || inv.status === 'Pending') {
            pendingApprovalCount++;
        }
    });

    return {
        totalBilled,
        pendingCount: pendingCount || invoiceStore.totalInvoices,
        paidCount: paidCount || Math.max(0, invoiceStore.totalInvoices - pendingCount),
        activeClients: activeClientsSet.size || 22,
        pendingApproval: pendingApprovalCount || 5
    };
});

const getStatusColor = (status) => {
    switch (status) {
        case 'Paid':
            return 'success';
        case 'Pending':
        case 'Issued':
        case 'Draft':
        case 'Partially Paid':
            return 'primary';
        case 'Overdue':
        case 'Cancelled':
            return 'error';
        default:
            return 'grey';
    }
};

const getStatusLabel = (status) => {
    if (status === 'Issued' || status === 'Draft') return 'Pending';
    return status;
};

const loadInvoices = async ({ page, itemsPerPage: limit, search: searchQuery }) => {
    currentPage.value = page;
    itemsPerPage.value = limit;
    
    await invoiceStore.fetchInvoices({
        page,
        limit,
        status: statusFilter.value === 'All' ? undefined : statusFilter.value,
        search: search.value || undefined
    });
};

onMounted(() => {
    // fetchData is now handled by v-data-table-server @update:options
});

let searchTimer;
watch([search, statusFilter], () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadInvoices({ page: 1, itemsPerPage: itemsPerPage.value });
    }, 400);
});

const viewInvoice = (invoice) => {
    if (!auth.canRecord('invoices', 'detail', invoice)) return;
    selectedInvoice.value = invoice;
    viewDialog.value = true;
};
const invoiceRowProps = ({ item }) => {
    if (!auth.canRecord('invoices', 'detail', item)) return {};
    return {
        class: 'cursor-pointer',
        tabindex: 0,
        'aria-label': `View invoice ${item.invoice_number}`,
        onClick: event => {
            if (event.target.closest('a, button, input, select, textarea, [role="button"], [role="menuitem"]')) return;
            viewInvoice(item);
        },
        onKeydown: event => {
            if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            viewInvoice(item);
        }
    };
};
useLinkedRecord('invoice_id', id => invoiceStore.fetchInvoiceById(id), viewInvoice);

const openCreateDialog = () => {
    editableInvoice.value = null;
    invoiceDialog.value = true;
};
useCreateAction('invoices', openCreateDialog);

const editInvoice = async (invoice) => {
    if (!canEditInvoice(invoice) || editingId.value != null) return;
    editingId.value = invoice.id;
    try {
        const fullInvoice = await invoiceStore.fetchInvoiceById(invoice.id);
        if (!canEditInvoice(fullInvoice)) throw new Error('This invoice can no longer be edited. Refresh the list.');
        editableInvoice.value = fullInvoice;
        viewDialog.value = false;
        invoiceDialog.value = true;
    } catch (error) { uiStore.showError(error.response?.data?.message || error.message || 'Unable to open invoice for editing.'); }
    finally { editingId.value = null; }
};

const onInvoiceSaved = () => {
    invoiceDialog.value = false;
    invoiceStore.fetchInvoices();
};

const openPayDialog = (invoice) => {
    selectedInvoice.value = invoice;
    paymentAmount.value = parseFloat(invoice.total) - parseFloat(invoice.paid_amount || 0);
    walletStore.fetchAccounts(); // Ensure accounts are loaded for the dropdown
    payDialog.value = true;
};

const updateStatus = async (invoice, newStatus) => {
    try {
        await invoiceStore.updateStatus(invoice.id, newStatus);
        loadInvoices({ page: currentPage.value, itemsPerPage: itemsPerPage.value, search: search.value });
    } catch (err) {
        uiStore.showError('Failed to update status');
    }
};

const confirmPayment = async () => {
    if (!paymentAccount.value || !paymentAmount.value) return;
    try {
        await invoiceStore.updateStatus(selectedInvoice.value.id, 'Paid', paymentAccount.value, paymentAmount.value);
        payDialog.value = false;
        paymentAccount.value = null;
        paymentAmount.value = 0;
    } catch (err) {
        uiStore.showError('Failed to update status');
    }
};

const downloadPDF = async (invoice) => {
    try {
        await invoiceStore.downloadPDF(invoice.id, invoice.invoice_number);
    } catch (err) {
        uiStore.showError('Could not download PDF');
    }
};

const shareWhatsApp = (invoice) => {
    const num = invoice.Customer?.phone_whatsapp;
    if (!num) return uiStore.showError('No phone number found');
    
    const msg = `Hi ${invoice.Customer?.name}, your invoice ${invoice.invoice_number} for AED ${invoice.total} is ready. Status: ${invoice.status}.`;
    openWhatsApp(num, msg);
};

const confirmCancel = async (invoice) => {
    if (confirm(`Are you sure you want to cancel invoice ${invoice.invoice_number}? This will permanently void the invoice and reverse any associated wallet income.`)) {
        try {
            await invoiceStore.updateStatus(invoice.id, 'Cancelled');
            loadInvoices({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
        } catch (err) {
            uiStore.showError('Failed to cancel invoice');
        }
    }
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-GB');
};
</script>

<style>
.custom-invoice-table .invoice-status-paid {
  background: #e6f5e9 !important;
  color: #2e7d46 !important;
}
.custom-invoice-table .invoice-status-unpaid {
  background: #fff0dc !important;
  color: #b7650a !important;
}
.custom-invoice-table .invoice-status-paid .v-chip__underlay,
.custom-invoice-table .invoice-status-unpaid .v-chip__underlay {
  opacity: 0 !important;
}
.custom-invoice-table .invoice-edit-slot {
  display: inline-flex;
  width: 40px;
  min-width: 40px;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}
/* ==========================================================
   STRICT CLASSIC THEME — Invoices Page
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
