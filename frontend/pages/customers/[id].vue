<template>
  <v-container fluid class="pa-2 pa-sm-4 pa-md-6" v-if="!loading && customer">
    <!-- Header -->
    <v-row class="mb-2">
      <v-col cols="12" class="py-1">
        <div class="d-flex align-center mb-1">
          <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/customers" class="font-weight-bold px-0 text-grey-darken-1" size="small" density="comfortable">
            Back to Customers
          </v-btn>
        </div>
        <div class="d-flex justify-space-between align-center">
          <div>
            <h1 class="text-h4 font-weight-black text-black mb-0" style="line-height: 1.15;">{{ customer.name }}</h1>
            <p class="text-subtitle-2 text-grey-darken-1 font-weight-medium mb-0">Customer Profile & History</p>
          </div>
          <v-btn color="primary" prepend-icon="mdi-pencil" variant="flat" class="font-weight-bold" @click="editDialog = true">
            Edit Customer
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Info Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="4">
        <v-card class="glass-card pa-6 rounded-2xl h-100" variant="flat">
          <div class="d-flex align-center mb-4">
            <v-avatar color="primary" size="64" class="mr-4 rounded-lg">
              <span class="text-h5 text-white font-weight-bold">{{ customer.name.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold">{{ customer.name }}</div>
              <v-chip :color="customer.is_active ? 'success' : 'grey'" size="small" class="mt-1 font-weight-bold text-uppercase text-caption">
                {{ customer.is_active ? 'Active' : 'Inactive' }}
              </v-chip>
            </div>
          </div>
          <v-divider class="mb-4"></v-divider>
          <div class="d-flex align-center mb-3">
             <v-icon icon="mdi-email-outline" color="primary" class="mr-3"></v-icon>
             <span class="font-weight-medium">{{ customer.email || 'N/A' }}</span>
          </div>
          <div class="d-flex align-center mb-3">
             <v-icon icon="mdi-whatsapp" color="success" class="mr-3"></v-icon>
             <span class="font-weight-medium">{{ customer.phone_whatsapp }}</span>
          </div>
          <div class="d-flex align-center mb-3">
             <v-icon icon="mdi-map-marker-outline" color="primary" class="mr-3"></v-icon>
             <span class="font-weight-medium">{{ customer.city || 'N/A' }}, {{ customer.country }}</span>
          </div>
        </v-card>
      </v-col>

      <!-- Stats / Address / TRN -->
      <v-col cols="12" md="8">
        <v-card class="glass-card pa-6 rounded-2xl h-100 d-flex flex-column" variant="flat">
          <h3 class="text-h6 font-weight-bold mb-4">Business Details</h3>
          <v-row>
            <v-col cols="12" sm="6">
              <div class="text-caption font-weight-bold opacity-60 uppercase ls-1 mb-1">Trade License No</div>
              <div class="font-weight-bold text-body-1">{{ customer.trade_license_no || 'N/A' }}</div>
            </v-col>
            <v-col cols="12" sm="6">
               <div class="text-caption font-weight-bold opacity-60 uppercase ls-1 mb-1">Full Address</div>
               <div class="font-weight-medium text-body-1">{{ customer.address || 'N/A' }}</div>
            </v-col>
          </v-row>
          <v-divider class="my-6"></v-divider>
          <div v-if="customer.notes" class="flex-grow-1">
             <div class="text-caption font-weight-bold opacity-60 uppercase ls-1 mb-2">Notes</div>
             <p class="font-weight-medium text-body-2 bg-grey-lighten-4 pa-4 rounded-lg">{{ customer.notes }}</p>
          </div>
          <div v-else class="flex-grow-1 d-flex align-center text-grey text-caption font-weight-medium">
             No specific notes written for this client.
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tabs for Documents, Services, Invoices -->
    <v-card class="glass-card rounded-2xl" variant="flat">
      <div class="d-flex align-center px-4 pt-2">
        <v-tabs v-model="tab" color="primary">
          <v-tab value="documents" class="font-weight-bold"><v-icon start icon="mdi-file-document-outline"></v-icon> Documents</v-tab>
          <v-tab value="services" class="font-weight-bold"><v-icon start icon="mdi-briefcase-outline"></v-icon> Services</v-tab>
          <v-tab value="invoices" class="font-weight-bold"><v-icon start icon="mdi-receipt"></v-icon> Invoices</v-tab>
        </v-tabs>
        <v-spacer></v-spacer>
        <div class="d-flex align-center gap-2">
          <v-btn size="small" color="primary" prepend-icon="mdi-file-document-plus" variant="flat" class="font-weight-bold" @click="addDocumentDialog = true">
            + Document
          </v-btn>
          <v-btn size="small" color="primary" prepend-icon="mdi-briefcase-plus" variant="flat" class="font-weight-bold" @click="openAddService">
            + Service
          </v-btn>
          <v-btn size="small" color="primary" prepend-icon="mdi-cart-plus" variant="flat" class="font-weight-bold" @click="addSalesOrderDialog = true">
            + Sales Order
          </v-btn>
          <v-btn size="small" color="primary" prepend-icon="mdi-receipt-text-plus" variant="flat" class="font-weight-bold" @click="addInvoiceDialog = true">
            + Invoice
          </v-btn>
        </div>
      </div>
      <v-divider class="mt-2"></v-divider>
      
      <v-window v-model="tab">
        <v-window-item value="documents">
          <div class="px-4 pt-4 pb-0 d-flex justify-space-between align-center flex-wrap gap-4">
            <v-btn-toggle
              v-model="categoryFilter"
              multiple
              variant="outlined"
              color="primary"
              divided
              class="bg-surface"
              density="compact"
            >
              <v-btn value="Company Document" size="small" class="font-weight-bold">
                <v-icon start size="small">mdi-domain</v-icon> Company Documents
              </v-btn>
              <v-btn value="Personal Document" size="small" class="font-weight-bold">
                <v-icon start size="small">mdi-account-multiple</v-icon> Personal Documents
              </v-btn>
            </v-btn-toggle>

            <v-autocomplete
              v-if="availableStaffNames.length > 0 && categoryFilter.includes('Personal Document')"
              v-model="staffFilter"
              :items="availableStaffNames"
              placeholder="Filter by Staff Name"
              prepend-inner-icon="mdi-filter-variant"
              variant="solo"
              density="comfortable"
              flat
              clearable
              hide-details
              class="search-pill"
              style="max-width: 300px; width: 100%;"
            ></v-autocomplete>
          </div>
          <v-data-table
            :headers="docHeaders"
            :items="filteredDocuments"
            class="pa-4 bg-transparent"
          >
             <template v-slot:item.doc_type_display="{ item }">
               <div class="d-flex align-center gap-2">
                 <v-chip
                   :color="item.DocumentType ? 'primary' : 'grey-darken-1'"
                   size="small"
                   label
                   class="font-weight-bold mr-2"
                   variant="flat"
                 >
                   {{ item.DocumentType?.name || item.type || 'General' }}
                 </v-chip>
                 <v-chip
                   v-if="getDocumentAlertStage(item)"
                   :color="getDocumentAlertStage(item).color"
                   size="x-small"
                   label
                   class="font-weight-bold"
                 >
                   {{ getDocumentAlertStage(item).title }}
                 </v-chip>
               </div>
             </template>
             <template v-slot:item.category="{ item }">
               <div class="d-flex flex-column">
                 <span class="font-weight-medium text-body-2">
                   {{ item.DocumentType?.category || 'Company Document' }}
                 </span>
                 <span v-if="item.staff_name" class="text-caption text-grey">
                   {{ item.staff_name }}
                 </span>
               </div>
             </template>
             <template v-slot:item.expiry_date="{ item }">
               <span class="font-weight-medium">{{ formatDate(item.expiry_date) }}</span>
             </template>
             <template v-slot:item.actions="{ item }">
                 <v-btn 
                   variant="text" 
                   size="small" 
                   color="success" 
                   title="Share via WhatsApp"
                   @click="shareWhatsApp(item)"
                   v-if="customer?.phone_whatsapp && authStore.user?.role_type !== 'CustomerPortal'"
                 >
                   <v-icon icon="mdi-whatsapp"></v-icon>
                 </v-btn>
                 <v-btn 
                   variant="text" 
                   size="small" 
                   color="warning" 
                   title="Add Reminder Count"
                   @click="addDocumentReminderCount(item)"
                   :disabled="!getDocumentAlertStage(item, ['expired', 'critical', 'warning'])"
                   v-if="authStore.user?.role_type !== 'CustomerPortal'"
                   class="px-2"
                 >
                   <v-icon icon="mdi-bell-ring-outline" class="mr-1"></v-icon>
                   <span class="text-caption font-weight-bold">{{ item.reminder_count || 0 }}</span>
                 </v-btn>
                <v-btn 
                  v-if="item.file_path" 
                  icon="mdi-eye-outline" 
                  variant="text" 
                  size="small" 
                  color="info" 
                  title="View Document"
                  @click="openDocumentPreview(item.file_path)"
                ></v-btn>
                <v-btn 
                  v-if="authStore.can('documents', 'write')" 
                  icon="mdi-pencil" 
                  variant="text" 
                  size="small" 
                  color="primary" 
                  @click="openEditDocument(item)"
                  title="Edit Document"
                ></v-btn>
             </template>
          </v-data-table>
        </v-window-item>
        
        <v-window-item value="services">
          <v-data-table
            :headers="serviceHeaders"
            :items="customer.ServiceOrders"
            class="pa-4 bg-transparent"
          >
            <template v-slot:item.created_at="{ item }">
               <span class="font-weight-medium">{{ formatDate(item.created_at) }}</span>
            </template>
            <template v-slot:item.service="{ item }">
               <span class="font-weight-bold">{{ item.ServiceType?.name }}</span>
            </template>
            <template v-slot:item.total_price="{ item }">
               <span class="font-weight-medium">AED {{ parseFloat(item.ServiceType?.sell_price || 0).toFixed(2) }}</span>
            </template>
            <template v-slot:item.status="{ item }">
                <v-chip size="x-small" :color="getServiceColor(item.status)" class="font-weight-bold text-uppercase">{{ item.status }}</v-chip>
            </template>
          </v-data-table>
        </v-window-item>

        <v-window-item value="invoices">
          <v-data-table
            :headers="invoiceHeaders"
            :items="customer.Invoices"
            class="pa-4 bg-transparent"
          >
            <template v-slot:item.created_at="{ item }">
               <span class="font-weight-medium">{{ formatDate(item.created_at) }}</span>
            </template>
            <template v-slot:item.invoice_number="{ item }">
               <span class="font-weight-bold text-primary">{{ item.invoice_number }}</span>
            </template>
            <template v-slot:item.total="{ item }">
               <span class="font-weight-medium">AED {{ parseFloat(item.total).toFixed(2) }}</span>
            </template>
            <template v-slot:item.pending_amount="{ item }">
               <span class="font-weight-bold" :class="(parseFloat(item.total) - parseFloat(item.paid_amount || 0)) > 0 ? 'text-error' : 'text-success'">
                 AED {{ (parseFloat(item.total) - parseFloat(item.paid_amount || 0)).toFixed(2) }}
               </span>
            </template>
            <template v-slot:item.status="{ item }">
                <v-chip size="x-small" :color="getInvoiceColor(item.status)" class="font-weight-bold text-uppercase">{{ item.status }}</v-chip>
            </template>
            <template v-slot:item.actions="{ item }">
               <div class="d-flex justify-end pt-1">
                 <v-btn icon="mdi-eye-outline" variant="text" size="small" color="primary" @click="viewInvoice(item)" title="View Invoice"></v-btn>
               </div>
            </template>
          </v-data-table>
        </v-window-item>
      </v-window>
    </v-card>

    <!-- Document Viewer Dialog -->
    <v-dialog v-model="previewDialog" max-width="900" fullscreen-on-mobile>
      <v-card class="rounded-xl overflow-hidden glass-card" variant="flat">
        <v-toolbar color="transparent" title="Document Preview">
          <template v-slot:append>
             <v-btn icon="mdi-share-variant" variant="text" @click="shareDocument(previewUrl)" title="Share Document Link"></v-btn>
             <v-btn icon="mdi-open-in-new" variant="text" :href="previewUrl" target="_blank" title="Open PDF / Image in new tab"></v-btn>
             <v-btn icon="mdi-close" @click="previewDialog = false" variant="text"></v-btn>
          </template>
        </v-toolbar>
        <v-divider></v-divider>
        <v-card-text class="pa-0 bg-grey-lighten-4 d-flex align-center justify-center p-relative" style="min-height: 500px;">
            <iframe 
              v-if="previewUrl && previewUrl.toLowerCase().endsWith('.pdf')" 
              :src="previewUrl" 
              style="width: 100%; height: 75vh; border: none; display: block;"
            ></iframe>
            <img 
              v-else-if="previewUrl"
              :src="previewUrl" 
              style="max-width: 100%; max-height: 75vh; object-fit: contain; display: block;" 
            />
            <div v-else class="text-h6 text-grey font-weight-medium">Preview not available</div>
        </v-card-text>
      </v-card>
    </v-dialog>
    
    <!-- Invoice Preview Dialog -->
    <v-dialog v-model="viewInvoiceDialog" max-width="95vw">
        <InvoiceDetailView 
            v-if="viewInvoiceDialog" 
            :invoice-id="selectedInvoiceId" 
            @close="viewInvoiceDialog = false" 
        />
    </v-dialog>

    <!-- Edit Customer Dialog -->
    <CustomerForm 
      v-model="editDialog" 
      :customer="customer" 
      @saved="handleCustomerSaved" 
    />

    <!-- Add Document Dialog -->
    <v-dialog v-model="addDocumentDialog" max-width="800px">
      <DocumentForm 
        :prefilled-customer-id="customer.id"
        @cancel="addDocumentDialog = false" 
        @save="handleAddDocumentSave" 
      />
    </v-dialog>

    <!-- Edit Document Dialog -->
    <v-dialog v-model="editDocumentDialog" max-width="800px">
      <DocumentForm 
        v-if="selectedDocument"
        :document="selectedDocument"
        :prefilled-customer-id="customer.id"
        @cancel="editDocumentDialog = false" 
        @save="handleEditDocumentSave" 
      />
    </v-dialog>

    <!-- Add Service Dialog -->
    <v-dialog v-model="addServiceDialog" max-width="600px" persistent>
      <ServiceOrderForm 
        v-if="addServiceDialog"
        :service-types="activeServiceTypes"
        :prefilled-customer-id="customer.id"
        @cancel="addServiceDialog = false" 
        @save="handleAddServiceSave" 
      />
    </v-dialog>

    <!-- Add Invoice Dialog -->
    <v-dialog v-model="addInvoiceDialog" fullscreen persistent>
      <InvoiceDialog 
        v-if="addInvoiceDialog"
        :prefilled-customer-id="customer.id"
        @cancel="addInvoiceDialog = false" 
        @save="handleAddInvoiceSave" 
      />
    </v-dialog>

    <SalesOrderDialog
      v-if="addSalesOrderDialog"
      v-model="addSalesOrderDialog"
      :initial-customer-id="customer.id"
      :customers="[customer]"
      :service-types="serviceTypes"
      @saved="handleAddSalesOrderSave"
    />

  </v-container>
  
  <div v-else-if="loading" class="d-flex justify-center align-center h-100 pt-16">
    <v-progress-circular indeterminate color="primary" size="64" width="6"></v-progress-circular>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useNuxtApp, useRuntimeConfig } from '#app';
import { useUIStore } from '@/stores/ui';
import { useInvoiceStore } from '@/stores/invoices';
import { useServiceStore } from '@/stores/services';
import { useAuthStore } from '@/stores/auth';
import { useDocumentStore } from '@/stores/documents';
import { useWhatsApp } from '@/composables/useWhatsApp';
import InvoiceDetailView from '~/components/invoices/InvoiceDetailView.vue';
import CustomerForm from '~/components/customers/CustomerForm.vue';
import DocumentForm from '~/components/documents/DocumentForm.vue';
import ServiceOrderForm from '~/components/services/ServiceOrderForm.vue';
import InvoiceDialog from '~/components/invoices/InvoiceDialog.vue';
import SalesOrderDialog from '~/components/sales-orders/SalesOrderDialog.vue';
import dayjs from 'dayjs';

const route = useRoute();
const { $api } = useNuxtApp();
const config = useRuntimeConfig();
const uiStore = useUIStore();
const invoiceStore = useInvoiceStore();
const serviceStore = useServiceStore();
const documentStore = useDocumentStore();
const authStore = useAuthStore();
const { openWhatsApp, MESSAGES } = useWhatsApp();

const customer = ref(null);
const loading = ref(true);
const tab = ref('documents');

const addSalesOrderDialog = ref(false);
const serviceTypes = ref([]);

const staffFilter = ref(null);
const categoryFilter = ref(['Company Document', 'Personal Document']);

const availableStaffNames = computed(() => {
  if (!customer.value?.Documents) return [];
  const names = customer.value.Documents
    .filter(d => (d.DocumentType?.category || 'Company Document') === 'Personal Document')
    .map(d => d.staff_name)
    .filter(n => n && n.trim().length > 0);
  return [...new Set(names)].sort();
});

const filteredDocuments = computed(() => {
  if (!customer.value?.Documents) return [];
  
  return customer.value.Documents.filter(d => {
    const docCat = d.DocumentType?.category || 'Company Document';
    if (!categoryFilter.value.includes(docCat)) return false;
    
    if (staffFilter.value && docCat === 'Personal Document') {
      if (d.staff_name !== staffFilter.value) return false;
    }
    
    return true;
  });
});

const getDocumentAlertStage = (doc, allowedStages = ['expired', 'critical']) => {
  if (!doc.expiry_date) return null;
  const today = dayjs().startOf('day');
  const expiry = dayjs(doc.expiry_date).startOf('day');
  const diffDays = expiry.diff(today, 'day');

  const defaultStages = [
    { id: 'expired', title: 'Expired', minDays: -Infinity, maxDays: -1, color: 'error' },
    { id: 'critical', title: 'Critical (0-7 Days)', minDays: 0, maxDays: 7, color: 'error-lighten-1' },
    { id: 'warning', title: 'Warning (8-14 Days)', minDays: 8, maxDays: 14, color: 'warning' }
  ];
  
  const stages = (documentStore.stages && documentStore.stages.length > 0) ? documentStore.stages : defaultStages;
  
  for (const stage of stages) {
    if (!allowedStages.includes(stage.id)) continue;
    const min = stage.minDays !== null && stage.minDays !== '' ? parseInt(stage.minDays) : -Infinity;
    const max = stage.maxDays !== null && stage.maxDays !== '' ? parseInt(stage.maxDays) : Infinity;
    
    if (diffDays >= min && diffDays <= max) {
      return stage;
    }
  }
  return null;
};


const previewDialog = ref(false);
const previewUrl = ref('');
const viewInvoiceDialog = ref(false);
const selectedInvoiceId = ref(null);
const editDialog = ref(false);

const addDocumentDialog = ref(false);
const editDocumentDialog = ref(false);
const selectedDocument = ref(null);
const addServiceDialog = ref(false);
const addInvoiceDialog = ref(false);

const activeServiceTypes = computed(() => 
  serviceStore.serviceTypes.filter(t => t.is_active)
);

const handleCustomerSaved = (updatedCustomer) => {
  customer.value = updatedCustomer;
  uiStore.showSuccess('Customer updated successfully');
};

const openAddService = async () => {
  if (!serviceStore.serviceTypes || serviceStore.serviceTypes.length === 0) {
    await serviceStore.fetchServiceTypes({ limit: 1000 });
  }
  addServiceDialog.value = true;
};

const handleAddDocumentSave = async (formData) => {
  try {
    const res = await $api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data.success) {
      uiStore.showSuccess('Document added successfully');
      addDocumentDialog.value = false;
      fetchCustomer();
    }
  } catch (err) {
    uiStore.showError('Failed to add document');
  }
};

const openEditDocument = (doc) => {
  selectedDocument.value = doc;
  editDocumentDialog.value = true;
};

const handleEditDocumentSave = async (formData) => {
  try {
    const res = await $api.put(`/documents/${selectedDocument.value.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data.success) {
      uiStore.showSuccess('Document updated successfully');
      editDocumentDialog.value = false;
      selectedDocument.value = null;
      fetchCustomer();
    }
  } catch (err) {
    uiStore.showError('Failed to update document');
  }
};

const shareWhatsApp = (doc) => {
  const num = customer.value?.phone_whatsapp;
  if (!num) return;
  
  let msg = '';
  if (doc.file_path) {
    const baseUrl = config.public.apiBase.replace('/api/v1', '');
    msg = baseUrl + doc.file_path;
  }
  
  openWhatsApp(num, msg);
};

const addDocumentReminderCount = async (doc) => {
  const num = customer.value?.phone_whatsapp;
  if (num) {
    const msg = MESSAGES.docReminder(
      customer.value.name,
      doc.DocumentType?.name || doc.type,
      doc.doc_number || 'N/A',
      formatDate(doc.expiry_date)
    );
    openWhatsApp(num, msg);
  }

  try {
    await documentStore.incrementReminderCount(doc.id);
    await fetchCustomer();
  } catch (err) {
    console.error('Failed to increment reminder count:', err);
  }
};

const handleAddServiceSave = async (data) => {
  try {
    await serviceStore.createServiceOrder(data);
    uiStore.showSuccess('Service added successfully');
    addServiceDialog.value = false;
    fetchCustomer();
  } catch (err) {
    uiStore.showError(err.message || 'Failed to add service');
  }
};

const handleAddInvoiceSave = () => {
  uiStore.showSuccess('Invoice added successfully');
  addInvoiceDialog.value = false;
  fetchCustomer();
};

const handleAddSalesOrderSave = () => {
  uiStore.showSuccess('Sales Order added successfully');
  addSalesOrderDialog.value = false;
  // If there's a sales orders tab in the future, refresh it here.
};

const docHeaders = [
  { title: 'Document Type', key: 'doc_type_display', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Doc Number', key: 'doc_number', sortable: false },
  { title: 'Expiry Date', key: 'expiry_date', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
];

const serviceHeaders = [
  { title: 'Date', key: 'created_at', sortable: true },
  { title: 'Service Name', key: 'service', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Total Amount', key: 'total_price', sortable: false }
];

const invoiceHeaders = [
  { title: 'Invoice Date', key: 'created_at', sortable: true },
  { title: 'Invoice No.', key: 'invoice_number', sortable: true },
  { title: 'Total Amount', key: 'total', sortable: false },
  { title: 'Pending Amount', key: 'pending_amount', sortable: false },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
];

const fetchCustomer = async () => {
  try {
    const [res, servRes] = await Promise.all([
      $api.get(`/customers/${route.params.id}`),
      $api.get('/services/types')
    ]);
    if (res.data.success) {
      customer.value = res.data.data;
    }
    if (servRes.data.success) {
      serviceTypes.value = servRes.data.data;
    }
  } catch (err) {
    console.error('Failed to load customer details', err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return dayjs(dateString).format('DD/MM/YYYY');
};

const getServiceColor = (status) => {
  switch (status) {
    case 'Pending': return 'warning';
    case 'In Progress': return 'primary';
    case 'Completed': return 'success';
    case 'Cancelled': return 'error';
    default: return 'grey';
  }
};

const getInvoiceColor = (status) => {
  switch (status) {
    case 'Draft': return 'grey';
    case 'Sent': return 'primary';
    case 'Partially Paid': return 'info';
    case 'Paid': return 'success';
    case 'Overdue': return 'error';
    case 'Cancelled': return 'warning';
    default: return 'grey';
  }
};

const openDocumentPreview = (filePath) => {
  if (!filePath) return;
  const baseUrl = config.public.apiBase.replace('/api/v1', '');
  previewUrl.value = baseUrl + filePath;
  previewDialog.value = true;
};

const shareDocument = async (url) => {
  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Document Shared via DocClear',
        url: url
      });
    } else {
      await navigator.clipboard.writeText(url);
      uiStore.showSuccess('Document link copied to clipboard!');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      uiStore.showError('Failed to share document');
    }
  }
};

const viewInvoice = (invoice) => {
  selectedInvoiceId.value = invoice.id;
  viewInvoiceDialog.value = true;
};

onMounted(() => {
  fetchCustomer();
});
</script>

<style scoped>
/* Keep the deep soft UI consistent */
</style>
