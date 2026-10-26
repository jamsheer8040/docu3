<template>
  <v-container fluid class="pa-2 pa-sm-4 pa-md-6">
    <!-- Back Button -->
    <div class="d-flex align-center mb-2">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        to="/suppliers"
        class="font-weight-bold px-0 text-grey-darken-1"
        size="small"
        density="comfortable"
      >
        Back to Suppliers
      </v-btn>
    </div>

    <!-- Header Section -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-6" v-if="supplier || loadingSupplier">
      <div class="d-flex align-center gap-4">
        <v-avatar color="primary" size="56" class="rounded-xl elevation-2 text-white font-weight-black text-h5">
          {{ (supplier?.name || 'S').charAt(0).toUpperCase() }}
        </v-avatar>
        <div>
          <div class="d-flex align-center gap-2 flex-wrap">
            <h1 class="text-h4 font-weight-black text-blue-grey-darken-4 mb-0">
              {{ supplier?.name || 'Loading Supplier...' }}
            </h1>
            <v-chip
              v-if="supplier"
              :color="supplier.is_active ? '#22C55E' : '#94A3B8'"
              variant="flat"
              size="small"
              class="font-weight-bold text-white px-3"
            >
              {{ supplier.is_active ? 'Active' : 'Inactive' }}
            </v-chip>
          </div>
          <p class="text-blue-grey-darken-1 text-subtitle-2 mt-1 mb-0">
            Supplier Profile, Purchases & Accounts Payable (AP)
          </p>
        </div>
      </div>

      <div class="d-flex align-center gap-2">
        <v-btn
          v-if="supplier && auth.canRecord('suppliers', 'edit', supplier)"
          color="white"
          variant="flat"
          class="font-weight-bold px-4 rounded-lg elevation-1"
          prepend-icon="mdi-pencil-outline"
          @click="openEditDialog"
        >
          Edit Supplier
        </v-btn>
      </div>
    </div>

    <v-card class="glass-card-ethereal pa-5 rounded-xl mb-6 supplier-contact-summary" variant="flat">
      <h2><button type="button" class="supplier-contact-toggle text-h6 font-weight-bold" :aria-expanded="contactExpanded" aria-controls="supplier-contact-details" @click="contactExpanded = !contactExpanded"><span>Contact Information</span><v-icon :icon="contactExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="22" /></button></h2>
      <v-expand-transition><div v-show="contactExpanded" id="supplier-contact-details" class="pt-4">
      <dl class="supplier-contact-grid">
        <div><dt>Contact Person</dt><dd>{{ supplier?.contact_person || '—' }}</dd></div>
        <div><dt>Phone Number</dt><dd><a v-if="supplier?.phone" :href="`tel:${supplier.phone}`" class="text-primary text-decoration-none">{{ supplier.phone }}</a><span v-else>—</span></dd></div>
        <div><dt>Email Address</dt><dd><a v-if="supplier?.email" :href="`mailto:${supplier.email}`" class="text-primary text-decoration-none">{{ supplier.email }}</a><span v-else>—</span></dd></div>
        <div><dt>Address</dt><dd>{{ supplier?.address || '—' }}</dd></div>
      </dl>
      <div class="supplier-contact-notes mt-4 pt-4"><h3 class="text-caption font-weight-bold text-medium-emphasis mb-1">Notes &amp; Details</h3><p class="text-body-2 mb-0" :class="{ 'text-medium-emphasis font-italic': !supplier?.notes }">{{ supplier?.notes || 'No additional notes recorded for this supplier.' }}</p></div>
      </div></v-expand-transition>
    </v-card>

    <!-- KPI Summary Stat Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card class="glass-card pa-4 rounded-xl h-100" variant="flat">
          <div class="d-flex justify-space-between align-center">
            <div>
              <div class="text-caption font-weight-bold text-blue-grey-darken-1 text-uppercase ls-1">
                Total Billed
              </div>
              <div class="text-h5 font-weight-black text-blue-grey-darken-4 mt-1">
                {{ formatCurrency(totalPurchasesAmount) }}
              </div>
              <div class="text-caption text-grey mt-1">{{ purchases.length }} purchase bills</div>
            </div>
            <v-avatar color="rgba(147, 51, 234, 0.1)" size="48" class="rounded-lg text-primary">
              <SupplierSummaryIcon name="billed" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="glass-card pa-4 rounded-xl h-100" variant="flat">
          <div class="d-flex justify-space-between align-center">
            <div>
              <div class="text-caption font-weight-bold text-blue-grey-darken-1 text-uppercase ls-1">
                Total Paid
              </div>
              <div class="text-h5 font-weight-black text-success mt-1">
                {{ formatCurrency(totalPaidAmount) }}
              </div>
              <div class="text-caption text-grey mt-1">{{ payments.length }} payments settled</div>
            </div>
            <v-avatar color="rgba(34, 197, 94, 0.1)" size="48" class="rounded-lg text-success">
              <SupplierSummaryIcon name="paid" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="glass-card pa-4 rounded-xl h-100" variant="flat">
          <div class="d-flex justify-space-between align-center">
            <div>
              <div class="text-caption font-weight-bold text-blue-grey-darken-1 text-uppercase ls-1">
                Balance Due (AP)
              </div>
              <div class="text-h5 font-weight-black text-error mt-1">
                {{ formatCurrency(totalOutstandingAmount) }}
              </div>
              <div class="text-caption text-grey mt-1">
                {{ pendingBillsCount }} unpaid/partial bills
              </div>
            </div>
            <v-avatar color="rgba(239, 68, 68, 0.1)" size="48" class="rounded-lg text-error">
              <SupplierSummaryIcon name="balance" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="glass-card pa-4 rounded-xl h-100" variant="flat">
          <div class="d-flex justify-space-between align-center">
            <div>
              <div class="text-caption font-weight-bold text-blue-grey-darken-1 text-uppercase ls-1">
                Settlement Rate
              </div>
              <div class="text-h5 font-weight-black text-primary mt-1">
                {{ settlementRate }}%
              </div>
              <div class="text-caption text-grey mt-1">of all liabilities cleared</div>
            </div>
            <v-avatar color="rgba(59, 130, 246, 0.1)" size="48" class="rounded-lg text-info">
              <SupplierSummaryIcon name="settlement" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Main Detail Content -->
    <v-row>
      <!-- Accounting Tabs: Purchases & Payments -->
      <v-col cols="12">
        <v-card class="glass-card-ethereal overflow-hidden rounded-2xl h-100" variant="flat">
          <div class="px-4 pt-3 pb-0" style="background: rgba(255,255,255,0.2); border-bottom: 1px solid rgba(0,0,0,0.06)">
            <v-tabs v-model="tab" color="primary" class="bg-transparent">
              <v-tab value="purchases" class="font-weight-bold text-none px-6">
                <v-icon start icon="mdi-receipt"></v-icon>
                Purchases & Bills
                <v-chip size="x-small" color="primary" variant="flat" class="ml-2 font-weight-bold">
                  {{ purchases.length }}
                </v-chip>
              </v-tab>
              <v-tab value="statement" class="font-weight-bold text-none px-6">
                <v-icon start icon="mdi-book-open-page-variant-outline" />Statement
              </v-tab>
              <v-tab value="payments" class="font-weight-bold text-none px-6">
                <v-icon start icon="mdi-cash-multiple"></v-icon>
                Payment History
                <v-chip size="x-small" color="success" variant="flat" class="ml-2 font-weight-bold">
                  {{ payments.length }}
                </v-chip>
              </v-tab>
            </v-tabs>
          </div>

          <v-window v-model="tab">
            <!-- PURCHASES TAB -->
            <v-window-item value="purchases">
              <v-data-table
                :headers="purchaseHeaders"
                :items="purchases"
                :loading="loadingPurchases"
                class="bg-transparent elevation-0 ethereal-table"
                hover
              >
                <template v-slot:item.created_at="{ item }">
                  <span class="text-body-2 text-blue-grey-darken-3">{{ formatDate(item.created_at) }}</span>
                </template>

                <template v-slot:item.reference_type="{ item }">
                  <div class="font-weight-bold text-blue-grey-darken-4">
                    {{ item.reference_type }}
                    <span v-if="item.reference_id" class="text-caption text-grey font-weight-regular">
                      #{{ item.reference_id }}
                    </span>
                  </div>
                </template>

                <template v-slot:item.description="{ item }">
                  <span class="text-body-2 text-blue-grey-darken-3">{{ item.description || '—' }}</span>
                </template>

                <template v-slot:item.amount="{ item }">
                  <span class="font-weight-bold text-blue-grey-darken-4">{{ formatCurrency(item.amount) }}</span>
                </template>

                <template v-slot:item.paid_amount="{ item }">
                  <span class="font-weight-bold text-success">{{ formatCurrency(item.paid_amount) }}</span>
                </template>

                <template v-slot:item.balance_due="{ item }">
                  <span class="font-weight-bold" :class="item.amount - item.paid_amount > 0 ? 'text-error' : 'text-grey'">
                    {{ formatCurrency(item.amount - item.paid_amount) }}
                  </span>
                </template>

                <template v-slot:item.status="{ item }">
                  <v-chip
                    :color="getStatusColor(item.status)"
                    variant="flat"
                    size="small"
                    class="font-weight-bold text-white px-3"
                  >
                    {{ item.status }}
                  </v-chip>
                </template>

                <template v-slot:item.actions="{ item }">
                  <v-btn
                    v-if="item.status !== 'Paid' && auth.can('suppliers', 'write')"
                    color="primary"
                    variant="flat"
                    size="small"
                    class="btn-3d text-none font-weight-bold px-3 rounded-lg"
                    prepend-icon="mdi-cash-fast"
                    @click="openPaymentDialog(item)"
                  >
                    Pay
                  </v-btn>
                  <span v-else-if="item.status === 'Paid'" class="text-caption text-success font-weight-bold">
                    <v-icon size="14" class="mr-1">mdi-check-all</v-icon> Settled
                  </span>
                </template>

                <template v-slot:no-data>
                  <div class="pa-8 text-center text-grey">
                    <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-receipt-outline</v-icon>
                    <div class="text-body-1 font-weight-bold">No purchase records yet</div>
                    <div class="text-caption text-grey">Supplier costs from invoice items will appear here automatically.</div>
                  </div>
                </template>
              </v-data-table>
            </v-window-item>

            <v-window-item value="statement">
              <div class="pa-4">
                <h2 class="text-h6 font-weight-bold mb-4">Supplier Statement</h2>
                <div class="statement-toolbar mb-3">
                  <v-text-field v-model="statementFrom" class="statement-date-picker" label="Start date" type="date" variant="outlined" density="compact" hide-details clearable :max="statementTo || undefined" />
                  <v-text-field v-model="statementTo" class="statement-date-picker" label="End date" type="date" variant="outlined" density="compact" hide-details clearable :min="statementFrom || undefined" />
                  <v-btn variant="text" rounded="pill" :disabled="!statementFrom && !statementTo" @click="statementFrom = ''; statementTo = ''">Clear dates</v-btn>
                  <v-btn color="primary" variant="tonal" rounded="pill" prepend-icon="mdi-file-excel-outline" :loading="exporting === 'xlsx'" :disabled="!!exporting || !supplier || !!statementDateError" @click="downloadStatement('xlsx')">Download Excel</v-btn>
                  <v-btn color="primary" variant="tonal" rounded="pill" prepend-icon="mdi-file-pdf-box" :loading="exporting === 'pdf'" :disabled="!!exporting || !supplier || !!statementDateError" @click="downloadStatement('pdf')">Download PDF</v-btn>
                  <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loadingPurchases || loadingPayments" @click="reloadStatement">Refresh statement</v-btn>
                </div>
                <v-alert v-if="statementError" type="error" variant="tonal" class="mt-4">Unable to load the complete statement. Please refresh to try again.</v-alert>
                <v-alert v-else-if="statementDateError" type="warning" variant="tonal" class="mt-4">{{ statementDateError }}</v-alert>
                <div v-else-if="!loadingPurchases && !loadingPayments" class="d-flex flex-wrap ga-6 mt-4">
                  <div><span class="text-caption text-medium-emphasis">Opening Balance</span><p class="font-weight-bold">{{ formatCurrency(statementRange.opening) }}</p></div>
                  <div><span class="text-caption text-medium-emphasis">Period Debit (Paid)</span><p class="font-weight-bold text-success">{{ formatCurrency(statementRange.debit) }}</p></div>
                  <div><span class="text-caption text-medium-emphasis">Period Credit (Purchases)</span><p class="font-weight-bold">{{ formatCurrency(statementRange.credit) }}</p></div>
                  <div><span class="text-caption text-medium-emphasis">Closing Balance{{ statementTo ? ` as of ${statementTo}` : '' }}</span><p class="font-weight-bold" :class="statementRange.closing > 0 ? 'text-error' : 'text-success'">{{ formatCurrency(statementRange.closing) }} <span v-if="statementRange.closing < 0" class="text-caption">Advance / credit</span></p></div>
                </div>
              </div>
              <v-data-table v-if="!statementError && !statementDateError" v-model:page="statementPage" :headers="statementHeaders" :items="loadingPurchases || loadingPayments ? [] : statementRows" item-value="key" :loading="loadingPurchases || loadingPayments" :items-per-page="15" class="bg-transparent ethereal-table" hover>
                <template #body.prepend><tr v-if="statementFrom && statementPage === 1 && !loadingPurchases && !loadingPayments"><td colspan="5" class="font-weight-bold">Opening balance (brought forward)</td><td class="text-end font-weight-bold text-no-wrap">{{ formatCurrency(statementRange.opening) }}</td></tr></template>
                <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
                <template #item.description="{ item }"><div class="py-3" style="min-width:200px; max-width:420px; white-space:normal; overflow-wrap:anywhere;"><strong>{{ item.description }}</strong><small class="d-block text-medium-emphasis">{{ item.kind }} · {{ item.detail }}</small></div></template>
                <template #item.debit="{ item }"><span class="text-success text-no-wrap">{{ item.kind === 'Payment' ? formatCurrency(item.debit) : '—' }}</span></template>
                <template #item.credit="{ item }"><span class="text-no-wrap">{{ item.kind === 'Purchase' ? formatCurrency(item.credit) : '—' }}</span></template>
                <template #item.balance="{ item }"><strong class="text-no-wrap" :class="item.balance > 0 ? 'text-error' : 'text-success'">{{ formatCurrency(item.balance) }}</strong><small v-if="item.balance < 0" class="d-block text-success">Advance / credit</small></template>
                <template #no-data><div class="pa-8 text-medium-emphasis">No purchases or payments in the selected period.</div></template>
              </v-data-table>
            </v-window-item>

            <!-- PAYMENTS TAB -->
            <v-window-item value="payments">
              <v-data-table
                :headers="paymentHeaders"
                :items="payments"
                :loading="loadingPayments"
                class="bg-transparent elevation-0 ethereal-table"
                hover
              >
                <template v-slot:item.payment_date="{ item }">
                  <span class="text-body-2 text-blue-grey-darken-3">{{ formatDate(item.payment_date) }}</span>
                </template>

                <template v-slot:item.amount="{ item }">
                  <span class="font-weight-black text-primary">{{ formatCurrency(item.amount) }}</span>
                </template>

                <template v-slot:item.WalletAccount="{ item }">
                  <v-chip v-if="item.WalletAccount" size="small" variant="tonal" color="primary" class="font-weight-bold">
                    <v-icon start size="14">mdi-wallet-outline</v-icon>
                    {{ item.WalletAccount.name }}
                  </v-chip>
                  <span v-else class="text-grey">—</span>
                </template>

                <template v-slot:item.purchase_id="{ item }">
                  <span v-if="item.purchase_id" class="text-caption font-weight-bold text-grey-darken-1">
                    Bill #{{ item.purchase_id }}
                  </span>
                  <span v-else class="text-grey">—</span>
                </template>

                <template v-slot:item.reference="{ item }">
                  <span class="text-body-2 text-blue-grey-darken-3">{{ item.reference || '—' }}</span>
                </template>

                <template v-slot:no-data>
                  <div class="pa-8 text-center text-grey">
                    <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-cash-remove</v-icon>
                    <div class="text-body-1 font-weight-bold">No payment history yet</div>
                    <div class="text-caption text-grey">Payments settled through wallet accounts will be recorded here.</div>
                  </div>
                </template>
              </v-data-table>
            </v-window-item>
          </v-window>
        </v-card>
      </v-col>
    </v-row>

    <!-- Payment Dialog -->
    <SupplierPaymentDialog
      v-model="paymentDialog"
      :purchase="selectedPurchase"
      :supplier-id="supplierId"
      @paid="onPaymentMade"
    />

    <!-- Edit Supplier Dialog -->
    <SupplierForm
      v-model="editDialog"
      :supplier="supplier"
      @saved="onSupplierSaved"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
const contactExpanded = ref(false);
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNuxtApp } from '#app';
import { useAuthStore } from '@/stores/auth';
import { useCurrency } from '@/composables/useCurrency';
import SupplierPaymentDialog from '@/components/suppliers/SupplierPaymentDialog.vue';
import SupplierForm from '@/components/suppliers/SupplierForm.vue';
import SupplierSummaryIcon from '@/components/suppliers/SupplierSummaryIcon.vue';
import { supplierStatement, statementPeriod } from '~/utils/supplierStatement.mjs';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { $api } = useNuxtApp();
const { formatCurrency } = useCurrency();

const supplierId = parseInt(route.params.id, 10);
const tab = ref('purchases');

const supplier = ref(null);
const loadingSupplier = ref(false);
const purchases = ref([]);
const payments = ref([]);

const loadingPurchases = ref(false);
const loadingPayments = ref(false);
const statementErrors = reactive({ purchases: false, payments: false });
const statementError = computed(() => statementErrors.purchases || statementErrors.payments);
const allStatementRows = computed(() => supplierStatement(purchases.value, payments.value));
const statementFrom = ref('');
const statementTo = ref('');
const statementPage = ref(1);
const statementResult = computed(() => {
  try { return { period: statementPeriod(allStatementRows.value, statementFrom.value || '', statementTo.value || ''), error: '' }; }
  catch (error) { return { period: { rows: [], opening: 0, closing: 0, debit: 0, credit: 0 }, error: error.message }; }
});
const statementRange = computed(() => statementResult.value.period);
const statementDateError = computed(() => statementResult.value.error);
const statementRows = computed(() => statementRange.value.rows);
watch([statementFrom, statementTo], () => { statementPage.value = 1; });
const statementHeaders = [
  { title: 'Date', key: 'date' }, { title: 'Reference', key: 'reference' }, { title: 'Description', key: 'description' },
  { title: 'Debit (AED)', key: 'debit', align: 'end' }, { title: 'Credit (AED)', key: 'credit', align: 'end' },
  { title: 'Running Balance (AED)', key: 'balance', align: 'end' }
].map(header => ({ ...header, sortable: false }));
const reloadStatement = () => Promise.all([loadPurchases(), loadPayments()]);
const exporting = ref('');
async function downloadStatement(format) {
  if (exporting.value || statementDateError.value) return;
  exporting.value = format;
  try {
    const { data } = await $api.get(`/suppliers/${supplierId}/statement/${format}`, { responseType: 'blob', params: { from: statementFrom.value || undefined, to: statementTo.value || undefined } });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url; link.download = `supplier-${supplierId}-statement.${format}`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    snackbar.text = 'Unable to download the statement. Please try again.';
    snackbar.color = 'error'; snackbar.show = true;
  } finally { exporting.value = ''; }
}

const paymentDialog = ref(false);
const editDialog = ref(false);
const selectedPurchase = ref(null);
const snackbar = reactive({ show: false, text: '', color: '' });

// Headers for Purchases
const purchaseHeaders = [
  { title: 'Date', key: 'created_at' },
  { title: 'Reference', key: 'reference_type' },
  { title: 'Description', key: 'description' },
  { title: 'Billed (AED)', key: 'amount', align: 'end' },
  { title: 'Paid (AED)', key: 'paid_amount', align: 'end' },
  { title: 'Balance Due', key: 'balance_due', align: 'end' },
  { title: 'Status', key: 'status', align: 'center' },
  { title: 'Action', key: 'actions', align: 'end', sortable: false }
];

// Headers for Payments
const paymentHeaders = [
  { title: 'Payment Date', key: 'payment_date' },
  { title: 'Paid Amount', key: 'amount' },
  { title: 'Deducted From', key: 'WalletAccount' },
  { title: 'For Purchase', key: 'purchase_id' },
  { title: 'Reference / Note', key: 'reference' }
];

// Computed Stats
const totalPurchasesAmount = computed(() => {
  return purchases.value.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
});

const totalPaidAmount = computed(() => {
  return payments.value.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
});

const totalOutstandingAmount = computed(() => {
  return allStatementRows.value.at(-1)?.balance || 0;
});

const pendingBillsCount = computed(() => {
  return purchases.value.filter(p => p.status !== 'Paid').length;
});

const settlementRate = computed(() => {
  if (totalPurchasesAmount.value <= 0) return 100;
  const rate = (totalPaidAmount.value / totalPurchasesAmount.value) * 100;
  return Math.min(100, Math.round(rate));
});

const loadSupplier = async () => {
  loadingSupplier.value = true;
  try {
    const response = await $api.get(`/suppliers/${supplierId}`);
    if (response.data.success) {
      supplier.value = response.data.data;
    }
  } catch (error) {
    console.error('Error fetching supplier:', error);
    snackbar.text = error.response?.data?.message || 'Failed to load supplier';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loadingSupplier.value = false;
  }
};

const loadPurchases = async () => {
  loadingPurchases.value = true;
  statementErrors.purchases = false;
  try {
    const response = await $api.get(`/suppliers/${supplierId}/purchases`);
    if (response.data.success) {
      purchases.value = response.data.data;
    }
  } catch (error) {
    console.error('Error fetching purchases:', error);
    statementErrors.purchases = true;
  } finally {
    loadingPurchases.value = false;
  }
};

const loadPayments = async () => {
  loadingPayments.value = true;
  statementErrors.payments = false;
  try {
    const response = await $api.get(`/suppliers/${supplierId}/payments`);
    if (response.data.success) {
      payments.value = response.data.data;
    }
  } catch (error) {
    console.error('Error fetching payments:', error);
    statementErrors.payments = true;
  } finally {
    loadingPayments.value = false;
  }
};

onMounted(() => {
  loadSupplier();
  loadPurchases();
  loadPayments();
});

watch(tab, (newVal) => {
  if (newVal === 'statement') reloadStatement();
  if (newVal === 'purchases') loadPurchases();
  if (newVal === 'payments') loadPayments();
});

const openEditDialog = () => {
  editDialog.value = true;
};

const onSupplierSaved = () => {
  loadSupplier();
  snackbar.text = 'Supplier updated successfully!';
  snackbar.color = 'success';
  snackbar.show = true;
};

const openPaymentDialog = (purchase) => {
  selectedPurchase.value = purchase;
  paymentDialog.value = true;
};

const onPaymentMade = () => {
  snackbar.text = 'Payment successfully settled from wallet!';
  snackbar.color = 'success';
  snackbar.show = true;
  loadPurchases();
  loadPayments();
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Dubai' });
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Paid': return '#22C55E';
    case 'Partially Paid': return '#F59E0B';
    default: return '#EF4444';
  }
};
</script>

<style scoped>
.statement-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
.statement-toolbar .statement-date-picker { flex:0 0 190px; width:190px; min-width:190px; max-width:190px; }
.supplier-contact-toggle { display:flex; align-items:center; justify-content:space-between; gap:16px; width:100%; text-align:left; color:inherit; border-radius:10px; }
.supplier-contact-toggle:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:5px; }
.supplier-contact-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:20px; }
.supplier-contact-grid dt { font-size:12px; opacity:.65; margin-bottom:6px; }
.supplier-contact-grid dd { font-size:14px; font-weight:500; white-space:pre-wrap; overflow-wrap:anywhere; }
.supplier-contact-notes { border-top:1px solid rgba(var(--v-theme-on-surface),.07); }
.supplier-contact-notes p { white-space:pre-wrap; overflow-wrap:anywhere; }
@media(max-width:1100px) { .supplier-contact-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:600px) { .supplier-contact-grid { grid-template-columns:1fr; gap:14px; } }
:deep(.ethereal-table th) {
  background: transparent !important;
  color: #94A3B8 !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(255,255,255,0.4) !important;
}

:deep(.ethereal-table td) {
  border-bottom: 1px solid rgba(255,255,255,0.2) !important;
  background: transparent !important;
}

:deep(.ethereal-table tr:hover td) {
  background: rgba(255,255,255,0.3) !important;
}

.ls-1 {
  letter-spacing: 0.5px;
}
</style>
