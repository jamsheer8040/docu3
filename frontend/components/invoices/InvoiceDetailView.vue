<template>
  <v-card class="pa-0 rounded-xl overflow-hidden shadow-2xl">
    <!-- Header with Actions -->
    <v-toolbar color="surface" elevation="0" class="border-b px-4 invoice-download-toolbar" height="72">
      <div class="ml-4">
        <div class="text-h6 font-weight-bold">Invoice {{ currentInvoice?.invoice_number }}</div>
        <div class="text-caption opacity-60">Status: <InvoiceStatusChip :status="currentInvoice?.status || 'Draft'" /></div>
      </div>
      <v-spacer></v-spacer>
      <div class="d-flex gap-2 flex-wrap align-center">
        <v-btn v-if="currentInvoice && ['Draft', 'Pending Approval', 'Issued', 'Overdue'].includes(currentInvoice.status) && Number(currentInvoice.paid_amount || 0) === 0 && auth.canRecord('invoices', 'edit_form', currentInvoice)" prepend-icon="mdi-pencil-outline" variant="tonal" color="primary" @click="emit('edit', currentInvoice)">Edit invoice</v-btn>
        <v-btn
          color="success"
          variant="tonal"
          prepend-icon="mdi-whatsapp"
          @click="shareWhatsApp"
        >
          Share
        </v-btn>
        <template v-if="currentInvoice">
          <DocumentExport remember size="small" :record-id="currentInvoice.id" :types="[configStore.invoiceDocumentType]" :label="configStore.invoiceDocumentType === 'tax_invoice' ? 'Download Tax Invoice' : 'Download Invoice'" />
        </template>
        <v-btn icon="mdi-close" variant="text" @click="$emit('close')" class="ml-2"></v-btn>
      </div>
    </v-toolbar>

    <v-card-text class="pa-4 pa-md-8 bg-grey-lighten-4" style="max-height: 75vh; overflow-y: auto;">
      <!-- Internal View Metrics (Not printed on PDF) -->
      <v-alert
        v-if="currentInvoice && auth.user?.role_type !== 'CustomerPortal'"
        color="info"
        variant="tonal"
        class="mb-6 mx-auto"
        max-width="1200"
        border="start"
      >
        <template v-slot:title>
          <div class="text-subtitle-1 font-weight-bold d-flex align-center">
             <v-icon icon="mdi-shield-lock-outline" class="mr-2"></v-icon>
             Internal Financial View
          </div>
        </template>
        <v-row class="mt-2" dense>
          <v-col cols="4">
            <div class="text-caption opacity-80">Invoice total</div>
            <div class="font-weight-bold">AED {{ parseFloat(currentInvoice.total || 0).toFixed(2) }}</div>
          </v-col>
          <v-col cols="4">
            <div class="text-caption opacity-80">Total Cost (Government Fees)</div>
            <div class="font-weight-bold text-error">AED {{ parseFloat(currentInvoice.cost_total || 0).toFixed(2) }}</div>
          </v-col>
          <v-col cols="4">
            <div class="text-caption opacity-80">{{ !configStore.commissionEnabled ? 'Net Profit' : commissionProfit ? 'Net Profit (after commission)' : 'Margin before commission' }}</div>
            <div class="font-weight-bold" :class="displayedNetProfit < 0 ? 'text-error' : 'text-success'">AED {{ displayedNetProfit.toFixed(2) }}</div>
          </v-col>
        </v-row>
      </v-alert>

      <!-- Invoice Canvas (Mimics A4) -->
      <v-card class="mx-auto pa-4 pa-md-10 shadow-lg invoice-canvas" max-width="1200" elevation="1">
        <!-- Branding -->
        <v-row class="mb-10 align-top">
          <v-col cols="6">
            <div v-if="configStore.appLogo" class="mb-2">
              <v-img :src="configStore.appLogo" max-width="150" max-height="60" contain style="mix-blend-mode: multiply;"></v-img>
            </div>
            <div v-else class="text-h4 font-weight-bold color-primary mb-2">{{ configStore.appName }}</div>
            <div class="text-caption opacity-70">
              <span v-if="configStore.settings.company_address">{{ configStore.settings.company_address }}<br /></span>
              <span v-else>Building A-1, Business Bay<br />Dubai, UAE<br /></span>
              Phone: {{ configStore.settings.company_phone || '+971 4 000 0000' }}
            </div>
          </v-col>
          <v-col cols="6" class="text-right">
            <h1 class="text-h2 font-weight-black opacity-10 mb-4">{{ configStore.invoiceDocumentType === 'tax_invoice' ? 'TAX INVOICE' : 'INVOICE' }}</h1>
            <div class="text-subtitle-1 font-weight-bold">{{ currentInvoice?.invoice_number }}</div>
            <div class="text-caption">Date: {{ formatDate(currentInvoice?.createdAt) }}</div>
            <div class="text-caption" v-if="currentInvoice?.due_date">Due: {{ formatDate(currentInvoice?.due_date) }}</div>
          </v-col>
        </v-row>

        <v-divider class="mb-8 opacity-20"></v-divider>

        <!-- Billing Details -->
        <v-row class="mb-10">
          <v-col cols="6">
            <div class="text-caption text-uppercase font-weight-bold opacity-60 mb-2">Bill To:</div>
            <div class="text-subtitle-1 font-weight-bold">{{ currentInvoice?.Customer?.name }}</div>
            <div class="text-body-2 opacity-70">
              {{ currentInvoice?.Customer?.phone_whatsapp }}<br />
              Dubai, United Arab Emirates
            </div>
          </v-col>
        </v-row>

        <!-- Items Table -->
        <v-table class="mb-10 custom-invoice-table">
          <thead>
            <tr class="bg-primary text-white">
              <th class="text-left font-weight-bold color-on-primary">DESCRIPTION</th>
              <th class="text-center font-weight-bold color-on-primary">QTY</th>
              <th class="text-right font-weight-bold color-on-primary">COST</th>
              <th class="text-right font-weight-bold color-on-primary">SERVICE CHARGE</th>
              <th class="text-right font-weight-bold color-on-primary">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in currentInvoice?.InvoiceItems" :key="item.id">
              <td>{{ item.description }}</td>
              <td class="text-center">{{ item.quantity }}</td>
              <td class="text-right">{{ parseFloat(item.cost_price || 0).toFixed(2) }}</td>
              <td class="text-right">{{ parseFloat(item.service_charge || 0).toFixed(2) }}</td>
              <td class="text-right font-weight-bold">{{ parseFloat(item.total || 0).toFixed(2) }}</td>
            </tr>
          </tbody>
        </v-table>

        <!-- Totals Logic -->
        <v-row justify="end">
          <v-col v-if="configStore.commissionEnabled && auth.user?.role_type !== 'CustomerPortal' && auth.can('commissions') && currentInvoice && Number(currentInvoice.id) === Number(invoiceId)" cols="12" md="7" class="invoice-commission-area pr-md-8">
            <InvoiceCommissionPanel :invoice-id="Number(invoiceId)" @saved="commissionProfit = $event" />
          </v-col>
          <v-col cols="12" md="5">
            <div class="d-flex justify-space-between mb-2">
              <span class="opacity-60">Subtotal</span>
              <span class="font-weight-medium">AED {{ parseFloat(currentInvoice?.subtotal || 0).toFixed(2) }}</span>
            </div>
            <div v-if="parseFloat(currentInvoice?.discount || 0) > 0" class="d-flex justify-space-between mb-2 text-error">
              <span>Discount</span>
              <span>-AED {{ parseFloat(currentInvoice?.discount || 0).toFixed(2) }}</span>
            </div>
            <div v-if="parseFloat(currentInvoice?.tax || 0) > 0" class="d-flex justify-space-between mb-4">
              <span>Tax / VAT (5%)</span>
              <span>AED {{ parseFloat(currentInvoice?.tax || 0).toFixed(2) }}</span>
            </div>
            <v-divider class="mb-4"></v-divider>
            <div class="d-flex justify-space-between align-center mb-2">
              <span class="text-subtitle-1 font-weight-bold">Total (AED)</span>
              <span class="text-h4 font-weight-bold color-primary">{{ parseFloat(currentInvoice?.total || 0).toFixed(2) }}</span>
            </div>
            
            <v-divider class="my-4"></v-divider>
            
            <div v-if="parseFloat(currentInvoice?.paid_amount || 0) > 0" class="d-flex justify-space-between mb-2 text-success">
              <span class="font-weight-bold">Paid Amount</span>
              <span class="font-weight-bold">AED {{ parseFloat(currentInvoice?.paid_amount || 0).toFixed(2) }}</span>
            </div>
            
            <div class="d-flex justify-space-between align-center">
              <span class="text-subtitle-1 font-weight-bold">Balance Due</span>
              <span class="text-h5 font-weight-bold color-primary">AED {{ (parseFloat(currentInvoice?.total || 0) - parseFloat(currentInvoice?.paid_amount || 0)).toFixed(2) }}</span>
            </div>
          </v-col>
        </v-row>

        <!-- Footer Notes -->
        <div class="mt-15 pt-10 border-t text-center">
          <p class="text-caption opacity-40 mb-2">Payment Terms: 15 Days from Invoice Date</p>
          <p class="text-caption opacity-60">Thank you for Choosing {{ configStore.appName }}!</p>
        </div>
      </v-card>
    </v-card-text>
    
    <!-- Status Action Bar (if not paid) -->
    <v-card-actions v-if="currentInvoice?.status !== 'Paid'" class="pa-6 border-t justify-center">
       <v-btn 
            color="success" 
            variant="flat" 
            size="large" 
            prepend-icon="mdi-credit-card-check"
            class="px-10"
            @click="markAsPaid"
       >
        Register Payment
       </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'

const uiStore = useUIStore()
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '~/stores/auth';
import InvoiceCommissionPanel from '~/components/invoices/InvoiceCommissionPanel.vue';
import { useInvoiceStore } from '~/stores/invoices';
import { useConfigStore } from '~/stores/config';
import InvoiceStatusChip from '~/components/invoices/InvoiceStatusChip.vue';
import { useWhatsApp } from '~/composables/useWhatsApp';

const props = defineProps({
  invoiceId: { type: Number, required: true }
});

const emit = defineEmits(['close', 'edit']);
const invoiceStore = useInvoiceStore();
const configStore = useConfigStore();
const { openWhatsApp } = useWhatsApp();

const currentInvoice = computed(() => invoiceStore.currentInvoice);
const auth = useAuthStore(), commissionProfit = ref(null);
const marginBeforeCommission = computed(() => Number(currentInvoice.value?.total || 0) - Number(currentInvoice.value?.cost_total || 0) - Number(currentInvoice.value?.tax || 0));
const displayedNetProfit=computed(()=>configStore.commissionEnabled && commissionProfit.value ? commissionProfit.value.net_profit : Number(currentInvoice.value?.recorded_net_profit ?? marginBeforeCommission.value));
watch(() => props.invoiceId, () => { commissionProfit.value = null; });
watch(()=>configStore.commissionEnabled,()=>{commissionProfit.value=null;});

onMounted(async () => {
  await invoiceStore.fetchInvoiceById(props.invoiceId);
});

const downloadPDF = async () => {
    await invoiceStore.downloadPDF(currentInvoice.value.id, currentInvoice.value.invoice_number);
};

const shareWhatsApp = () => {
    const num = currentInvoice.value.Customer?.phone_whatsapp;
    const msg = `Hi ${currentInvoice.value.Customer?.name}, please see your invoice ${currentInvoice.value.invoice_number} for AED ${currentInvoice.value.total}.`;
    openWhatsApp(num, msg);
};

const markAsPaid = () => {
    // This usually opens the Pay Dialog in the parent, but I'll 
    // emit a specific event or just alert the user to use the list action.
    uiStore.showError('Please use the "Mark as Paid" option in the main list to select a destination account.');
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
};
</script>

<style scoped>
.invoice-download-toolbar { height: auto !important; }
.invoice-download-toolbar :deep(.v-toolbar__content) { height: auto !important; min-height: 72px; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; gap: 12px; }
.invoice-canvas {
    background-color: #fff;
    min-height: 1000px;
    border-radius: 4px;
}
@media print {
    .invoice-commission-area { display: none !important; }
}
.custom-invoice-table thead th {
    height: 48px !important;
}
.shadow-2xl {
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5) !important;
}
</style>
