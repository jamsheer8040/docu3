<template>
  <v-card class="soft-card pa-4">
    <v-card-title class="pa-6 d-flex align-center">
      <div class="text-h5 font-weight-bold">
        <v-icon icon="mdi-receipt-text-plus-outline" class="mr-3" color="primary"></v-icon>
        {{ isEdit ? 'Edit Invoice' : 'Create Invoice' }}
      </div>
      <v-spacer></v-spacer>
      <v-btn icon="mdi-close" variant="text" @click="$emit('cancel')"></v-btn>
    </v-card-title>

    <v-card-text>
      <v-alert v-if="isIssuedEdit" type="info" variant="tonal" density="compact" class="mb-4">Billing details can be edited. Existing costs, quantities, funding sources and service links stay locked.</v-alert>
      <v-form ref="form" v-model="valid">
        <v-row>
          <!-- Service Order Selection -->
          <v-col cols="12" md="6">
            <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Choose Service Order *</label>
            <v-autocomplete
              v-model="state.service_order_ids"
              :items="filteredServiceOrders"
              multiple
              chips
              :closable-chips="!isIssuedEdit"
              :readonly="isIssuedEdit"
              :item-title="item => `#${String(item.id).padStart(5, '0')} - ${item.Customer?.name} - ${item.ServiceType?.name} (${item.status})`"
              item-value="id"
              placeholder="Search active assigned service"
              :rules="[v => !!v || 'Service Order is required']"
              variant="outlined"
              density="comfortable"
              class="soft-input"
              bg-color="transparent"
              :loading="loadingServiceOrders"
              @update:model-value="onServiceOrderSelected"
            ></v-autocomplete>
          </v-col>

          <!-- Customer Selection -->
          <v-col cols="12" md="6">
            <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Customer *</label>
            <v-autocomplete
              v-model="state.customer_id"
              :items="customers"
              item-title="name"
              item-value="id"
              placeholder="Search by name"
              :rules="[v => !!v || 'Customer is required']"
              variant="outlined"
              density="comfortable"
              class="soft-input"
              bg-color="transparent"
              :loading="loadingCustomers"
              :readonly="state.service_order_ids.length > 0"
              :hint="state.service_order_ids.length > 0 ? 'Automatically locked to selected Service Orders' : ''"
              persistent-hint
            ></v-autocomplete>
          </v-col>

          <!-- Date Selection -->
          <v-col cols="12" md="6">
            <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Due Date</label>
            <v-text-field
              v-model="state.due_date"
              type="date"
              variant="outlined"
              density="comfortable"
              class="soft-input"
              bg-color="transparent"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-divider class="my-6"></v-divider>

        <!-- Itemized Table Header -->
        <div class="d-flex align-center mb-4 px-2">
          <div class="text-subtitle-1 font-weight-bold">Invoice Items (Internal View)</div>
          <v-spacer></v-spacer>
          <v-btn
            v-if="!isIssuedEdit"
            prepend-icon="mdi-plus"
            variant="tonal"
            color="primary"
            size="small"
            @click="addItem"
          >
            Add Item
          </v-btn>
        </div>

        <div v-for="(item, index) in state.items" :key="index" class="item-row mb-4 pa-4 soft-card">
          <v-row dense align="center">
            <v-col cols="12" md="3">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Item / Service Name *</label>
              
              <!-- Read-only text field for items generated from a Service Order -->
              <v-text-field
                v-if="item.service_order_id || isIssuedEdit"
                v-model="item.description"
                :readonly="!!item.service_order_id"
                hide-details="auto"
                class="soft-input bg-grey-lighten-4"
                variant="outlined"
                density="comfortable"
              ></v-text-field>
              
              <!-- Autocomplete strictly from catalog for manual items -->
              <v-autocomplete
                v-else
                v-model="item.selectedItem"
                :items="serviceTypes"
                item-title="name"
                return-object
                placeholder="Select from catalog"
                :rules="[v => !!v || 'Item name is required']"
                hide-details="auto"
                variant="outlined"
                density="comfortable"
                class="soft-input"
                bg-color="transparent"
                @update:model-value="(val) => onItemCatalogSelected(index, val)"
              ></v-autocomplete>
            </v-col>

            <v-col cols="12" md="1">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Qty</label>
              <v-text-field
                v-model.number="item.quantity"
                :readonly="isIssuedEdit"
                type="number"
                min="1"
                hide-details="auto"
                class="soft-input"
                variant="outlined"
                density="comfortable"
                bg-color="transparent"
                @input="calculateRow(index)"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="2">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Cost (Govt Fee)</label>
              <v-text-field
                v-model.number="item.cost_price"
                :readonly="isIssuedEdit"
                type="number"
                min="0"
                hide-details="auto"
                class="soft-input"
                variant="outlined"
                density="comfortable"
                bg-color="transparent"
                @input="calculateRow(index)"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="2">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Service Charge</label>
              <v-text-field
                v-model.number="item.service_charge"
                type="number"
                min="0"
                hide-details="auto"
                class="soft-input"
                variant="outlined"
                density="comfortable"
                bg-color="transparent"
                @input="calculateRow(index)"
              ></v-text-field>
            </v-col>
            
            <v-col cols="12" md="2">
              <div class="text-right pt-4 px-2">
                 <div class="text-caption opacity-60">Selling Price</div>
                 <div class="font-weight-bold text-subtitle-1">AED {{ item.selling_price.toFixed(2) }}</div>
              </div>
            </v-col>
            <v-col cols="12" md="1" class="text-right">
              <v-btn
                v-if="!isIssuedEdit && !item.service_order_id && state.items.length > 1"
                icon="mdi-minus-circle-outline"
                variant="text"
                color="error"
                size="small"
                @click="removeItem(index)"
              ></v-btn>
            </v-col>
          </v-row>

          <!-- Second Row for VAT and Wallet Selection -->
          <!-- Only show Cost Payment options when:
               - deduction_point is 'invoice_creation' AND
               - cost was NOT already deducted at service completion -->
          <v-row dense align="center" class="mt-2">
            <v-col cols="12" md="4" v-if="showWalletSelection(item)">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Cost Deduction Method</label>
              <div class="d-flex align-center gap-2 mb-2">
                <v-btn-toggle v-model="item.cost_type" mandatory color="primary" variant="tonal" density="compact" class="flex-grow-1" :disabled="item.cost_price <= 0">
                  <v-btn value="Wallet" class="text-caption font-weight-bold">Wallet</v-btn>
                  <v-btn value="Supplier" class="text-caption font-weight-bold">Supplier</v-btn>
                </v-btn-toggle>
              </div>

              <v-autocomplete
                v-if="item.cost_type === 'Wallet'"
                v-model="item.wallet_id"
                :items="wallets"
                item-title="name"
                item-value="id"
                placeholder="Select wallet"
                variant="outlined"
                density="compact"
                hide-details="auto"
                class="soft-input"
                bg-color="transparent"
                :disabled="item.cost_price <= 0"
                :rules="item.cost_price > 0 && item.cost_type === 'Wallet' ? [v => !!v || 'Required'] : []"
              >
                <template v-slot:selection="{ item }">
                  <div class="d-flex align-center">
                    <v-avatar size="20" class="mr-2" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
                    <v-avatar size="20" class="mr-2 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
                    <span>{{ item.raw.name }}</span>
                  </div>
                </template>
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :title="item.raw.name">
                    <template v-slot:prepend>
                      <v-avatar size="24" class="mr-3" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
                      <v-avatar size="24" class="mr-3 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
                    </template>
                  </v-list-item>
                </template>
              </v-autocomplete>

              <v-autocomplete
                v-if="item.cost_type === 'Supplier'"
                v-model="item.cost_supplier_id"
                :items="suppliersList"
                item-title="name"
                item-value="id"
                placeholder="Select supplier"
                variant="outlined"
                density="compact"
                hide-details="auto"
                class="soft-input"
                bg-color="transparent"
                :disabled="item.cost_price <= 0"
                :rules="item.cost_price > 0 && item.cost_type === 'Supplier' ? [v => !!v || 'Required'] : []"
              ></v-autocomplete>
            </v-col>
            <v-col cols="12" md="4" v-else-if="item.is_cost_deducted">
              <v-chip color="success" size="small" variant="tonal" prepend-icon="mdi-check-circle" class="mt-4">
                Cost already deducted <span v-if="item.deducted_wallet_name" class="ml-1 font-weight-bold">(✓ {{ item.deducted_wallet_name.substring(0, 4).toUpperCase() }})</span>
              </v-chip>
            </v-col>
            <v-col cols="12" md="4" v-else-if="item.service_order_id && !item.is_cost_deducted && configStore.walletDeductionPoint === 'service_completion'">
              <v-chip color="info" size="small" variant="tonal" prepend-icon="mdi-clock-outline" class="mt-4">
                Cost will be deducted at Service Completion
              </v-chip>
            </v-col>
            <v-col cols="12" md="2" v-if="configStore.isTaxEnabled">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">VAT Rate</label>
              <v-select
                v-model="item.vat_percentage"
                :items="taxes"
                item-title="name"
                item-value="rate"
                variant="outlined"
                density="compact"
                hide-details="auto"
                class="soft-input"
                bg-color="transparent"
                @update:model-value="calculateRow(index)"
              ></v-select>
            </v-col>
            <v-col cols="12" md="2" v-if="configStore.isTaxEnabled">
               <div class="pt-4 px-2">
                 <div class="text-caption opacity-60">VAT Amount</div>
                 <div class="font-weight-bold">AED {{ item.vat_amount.toFixed(2) }}</div>
              </div>
            </v-col>
            <v-spacer></v-spacer>
            <v-col cols="12" md="3">
               <div class="text-right pt-4 px-2 bg-primary-lighten-5 rounded pa-2">
                 <div class="text-caption opacity-80 text-primary">Item Grand Total</div>
                 <div class="font-weight-bold text-h6 text-primary">AED {{ item.total.toFixed(2) }}</div>
              </div>
            </v-col>
          </v-row>
        </div>

        <!-- Totals & Notes Section -->
        <v-row class="mt-4">
          <v-col cols="12" md="7">
            <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Notes & Payment Terms</label>
            <v-textarea
              v-model="state.notes"
              rows="3"
              placeholder="e.g. Terms and conditions, payment info, etc."
              variant="outlined"
              class="mb-4 soft-input"
              bg-color="transparent"
            ></v-textarea>
          </v-col>
          <v-col cols="12" md="5" class="soft-card pa-6">
            <div class="d-flex justify-space-between mb-4">
              <span class="opacity-70">Total Selling Price (Subtotal)</span>
              <span class="font-weight-bold">AED {{ totals.subtotal.toFixed(2) }}</span>
            </div>
            
            <div class="d-flex justify-space-between align-center mb-4" v-if="configStore.isTaxEnabled">
              <span class="opacity-70">Total VAT</span>
              <span class="font-weight-bold">AED {{ totals.vat.toFixed(2) }}</span>
            </div>

            <div class="d-flex justify-space-between align-center mb-4">
              <span class="opacity-70">Total Cost (Internal)</span>
              <span class="font-weight-bold text-error">AED {{ totals.cost.toFixed(2) }}</span>
            </div>

            <div class="d-flex justify-space-between align-center mb-4">
              <span class="opacity-70">Total Profit (Internal)</span>
              <span class="font-weight-bold text-success">AED {{ (totals.subtotal - totals.cost).toFixed(2) }}</span>
            </div>

            <v-divider class="mb-4"></v-divider>

            <div class="d-flex justify-space-between align-center">
              <span class="text-h6 font-weight-bold">Grand Total</span>
              <span class="text-h5 font-weight-bold text-primary">AED {{ totals.total.toFixed(2) }}</span>
            </div>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>

    <v-card-actions class="pa-6">
      <v-spacer></v-spacer>
      <v-btn variant="text" size="large" @click="$emit('cancel')">Cancel</v-btn>
      <v-btn
        variant="tonal"
        color="secondary"
        size="large"
        class="px-6 font-weight-bold"
        :loading="invoiceStore.loading"
        @click="save(isEdit ? props.invoice.status : 'Draft')"
      >
        {{ isEdit ? 'Save changes' : 'Save as Draft' }}
      </v-btn>
      <v-btn
        v-if="!isIssuedEdit"
        class="btn-standard px-8 ml-2"
        size="large"
        :loading="invoiceStore.loading"
        @click="save('Issued')"
      >
        Issue Invoice
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'

const uiStore = useUIStore()
import { reactive, ref, computed, onMounted, watch } from 'vue';
import { useInvoiceStore } from '~/stores/invoices';
import { useConfigStore } from '~/stores/config';

const props = defineProps({
  invoice: Object, // for editing
  prefilledCustomerId: {
    type: [String, Number],
    default: null
  },
  prefilledServiceOrderId: {
    type: [String, Number],
    default: null
  }
});

const emit = defineEmits(['save', 'cancel']);

const invoiceStore = useInvoiceStore();
const configStore = useConfigStore();
const customers = ref([]);
const serviceOrders = ref([]);
const serviceTypes = ref([]);
const wallets = ref([]);
const suppliersList = ref([]);
const taxes = ref([
  { name: 'VAT 5%', rate: 5 },
  { name: 'No VAT', rate: 0 }
]);

const loadingCustomers = ref(false);
const loadingServiceOrders = ref(false);
const loadingServiceTypes = ref(false);
const valid = ref(false);
const form = ref(null);

const isEdit = !!props.invoice;
const isIssuedEdit = computed(() => isEdit && ['Issued', 'Overdue'].includes(props.invoice.status));

const getEmptyItem = () => ({ 
  service_order_id: null,
  selectedItem: '', 
  description: '', 
  quantity: 1, 
  cost_price: 0, 
  service_charge: 0, 
  selling_price: 0, 
  vat_percentage: 0, 
  vat_amount: 0, 
  total: 0,
  cost_type: 'Wallet',
  wallet_id: null,
  cost_supplier_id: null,
  is_cost_deducted: false,
  deducted_wallet_name: ''
});

const state = reactive({
  customer_id: null,
  service_order_ids: [],
  due_date: new Date().toISOString().substring(0, 10),
  notes: '',
  discount: 0, 
  tax: 0, 
  items: [getEmptyItem()]
});

// Calculate main totals from items
const totals = computed(() => {
    let subtotal = 0;
    let cost = 0;
    let vat = 0;
    let total = 0;
    
    state.items.forEach(item => {
        subtotal += (item.selling_price * item.quantity);
        cost += (item.cost_price * item.quantity);
        vat += item.vat_amount;
        total += item.total;
    });
    
    return { 
        subtotal: parseFloat(subtotal.toFixed(2)), 
        cost: parseFloat(cost.toFixed(2)),
        vat: parseFloat(vat.toFixed(2)),
        total: parseFloat(total.toFixed(2)) 
    };
});

const calculateSellingPrice = (serviceType, customer) => {
  if (!serviceType) return 0;
  const cost = parseFloat(serviceType.cost_price) || 0;
  const pricings = serviceType.ServiceTypePricings || [];
  
  let targetPricing = null;
  if (serviceType.pricing_mode === 'Single') {
    targetPricing = pricings.find(p => p.pricing_type === 'Single');
  } else if (customer) {
    const category = customer.pricing_category || 'Normal';
    targetPricing = pricings.find(p => p.pricing_type === category);
  }
  
  if (!targetPricing && pricings.length > 0) targetPricing = pricings[0];
  
  return targetPricing ? parseFloat(targetPricing.selling_price) : cost;
};



const filteredServiceOrders = computed(() => {
  if (!state.customer_id) return serviceOrders.value;
  return serviceOrders.value.filter(o => o.customer_id === state.customer_id);
});

const fetchData = async () => {
  const { $api } = useNuxtApp();
  
  // Fetch Customers
  loadingCustomers.value = true;
  $api.get('/customers', { params: { limit: 1000, is_active: 'true' } }).then(r => {
    if (r.data?.success) customers.value = r.data.data;
    loadingCustomers.value = false;
  }).catch(() => loadingCustomers.value = false);

  // Fetch Service Orders
  loadingServiceOrders.value = true;
  $api.get('/services/orders', { params: { limit: 1000 } }).then(r => {
    if (r.data?.success) {
      const linked = new Set((props.invoice?.InvoiceItems || []).map(item => String(item.service_order_id)));
      let filtered = r.data.data.filter(
        o => linked.has(String(o.id)) || o.status === 'Pending' || o.status === 'In Progress' || o.status === 'CompletedInvoicePending'
      );
      if (props.prefilledCustomerId) {
        filtered = filtered.filter(o => o.customer_id === parseInt(props.prefilledCustomerId));
      }
      serviceOrders.value = filtered;
    }
    loadingServiceOrders.value = false;
  }).catch(() => loadingServiceOrders.value = false);

  // Fetch Service Types
  loadingServiceTypes.value = true;
  $api.get('/services/types', { params: { limit: 1000, is_active: 'true' } }).then(r => {
    if (r.data?.success) serviceTypes.value = r.data.data;
    loadingServiceTypes.value = false;
  }).catch(() => loadingServiceTypes.value = false);

  // Fetch Wallets
  $api.get('/wallet/accounts', { params: { limit: 100 } }).then(r => {
    if (r.data?.success) wallets.value = r.data.data;
  });

  // Fetch Suppliers
  $api.get('/suppliers', { params: { limit: 100, is_active: 'true' } }).then(r => {
    if (r.data?.success) suppliersList.value = r.data.data;
  });

  // Fetch Taxes
  $api.get('/taxes').then(r => {
    if (r.data?.success && r.data.data.length > 0) {
      const activeTaxes = r.data.data.filter(t => t.is_active);
      taxes.value = activeTaxes.map(t => ({ name: t.name, rate: parseFloat(t.rate) }));
    }
  });
};

onMounted(() => {
  fetchData();

  if (isEdit) {
      Object.assign(state, {
          customer_id: props.invoice.customer_id,
          service_order_ids: [...new Set(props.invoice.InvoiceItems.map(i => i.service_order_id).filter(Boolean))],
          due_date: props.invoice.due_date,
          notes: props.invoice.notes || '',
          discount: parseFloat(props.invoice.discount) || 0,
          tax: parseFloat(props.invoice.tax) || 0,
          items: props.invoice.InvoiceItems.map(i => {
              const qty = parseFloat(i.quantity);
              return {
                  id: i.id,
                  service_order_id: i.service_order_id || null,
                  selectedItem: i.description,
                  description: i.description,
                  quantity: qty,
                  list_price: parseFloat(i.list_price || 0),
                  cost_price: parseFloat(i.cost_price || 0),
                  service_charge: parseFloat(i.service_charge || 0),
                  selling_price: parseFloat(i.selling_price || 0) || parseFloat(i.unit_price || 0),
                  vat_percentage: parseFloat(i.vat_percentage || 0),
                  vat_amount: parseFloat(i.vat_amount || 0),
                  total: parseFloat(i.total),
                  cost_type: i.cost_type || 'Wallet',
                  wallet_id: i.wallet_id,
                  cost_supplier_id: i.cost_supplier_id
              };
          })
      });
  } else if (props.prefilledServiceOrderId) {
      state.service_order_ids = [parseInt(props.prefilledServiceOrderId)];
  } else if (props.prefilledCustomerId) {
      state.customer_id = parseInt(props.prefilledCustomerId);
  }
});

watch(serviceOrders, (newOrders) => {
  if (props.prefilledServiceOrderId && newOrders.length > 0 && !state.customer_id) {
    onServiceOrderSelected([parseInt(props.prefilledServiceOrderId)]);
  }
}, { immediate: true });

const onServiceOrderSelected = (orderIds) => {
  if (!orderIds || orderIds.length === 0) {
    state.items = [getEmptyItem()];
    state.customer_id = null;
    return;
  }

  // Preserve existing items to keep wallet selections
  const oldItemsMap = {};
  state.items.forEach(item => {
    if (item.service_order_id) {
      oldItemsMap[item.service_order_id] = item;
    }
  });

  const newItems = [];
  
  orderIds.forEach((orderId, index) => {
    const order = serviceOrders.value.find(o => o.id === orderId);
    if (!order) return;

    if (index === 0) {
      state.customer_id = order.customer_id; // Lock to first customer
    }

    const customer = customers.value.find(c => c.id === order.customer_id);
    const sellingPrice = calculateSellingPrice(order.ServiceType, customer);
    const costPrice = parseFloat(order.ServiceType?.cost_price || 0);
    const serviceCharge = sellingPrice > costPrice ? sellingPrice - costPrice : 0;

    let desc = order.ServiceType?.name || '';
    if (order.is_cost_deducted && order.deducted_wallet_name) {
      desc += ` ✓ ${order.deducted_wallet_name.substring(0, 4).toUpperCase()}`;
    }
    
    // Check if we already had this service in the list to preserve wallet selection
    let newItem = getEmptyItem();
    if (oldItemsMap[orderId]) {
      newItem = oldItemsMap[orderId];
    }

    newItem.service_order_id = orderId;
    newItem.description = desc;
    newItem.cost_price = costPrice;
    newItem.service_charge = serviceCharge;
    newItem.selling_price = sellingPrice;
    newItem.is_cost_deducted = !!order.is_cost_deducted;
    newItem.deducted_wallet_name = order.deducted_wallet_name || '';

    newItems.push(newItem);
  });

  // Re-add preserved manual items at the bottom
  const manualItems = state.items.filter(i => !i.service_order_id && (i.description || i.selectedItem));
  newItems.push(...manualItems);

  state.items = newItems.length > 0 ? newItems : [getEmptyItem()];
  state.items.forEach((_, i) => calculateRow(i));
};

const onItemCatalogSelected = (index, value) => {
  const item = state.items[index];
  if (typeof value === 'object' && value !== null) {
    const customer = customers.value.find(c => c.id === state.customer_id);
    const sellingPrice = calculateSellingPrice(value, customer);
    const costPrice = parseFloat(value.cost_price || 0);
    const serviceCharge = sellingPrice > costPrice ? sellingPrice - costPrice : 0;

    item.description = value.name;
    item.cost_price = costPrice;
    item.service_charge = serviceCharge;
    item.selling_price = sellingPrice;
    calculateRow(index);
  } else if (typeof value === 'string') {
    item.description = value;
  }
};

const addItem = () => {
    state.items.push(getEmptyItem());
};

const removeItem = (index) => {
    state.items.splice(index, 1);
};

const calculateRow = (index) => {
    const item = state.items[index];
    const cost = parseFloat(item.cost_price) || 0;
    const charge = parseFloat(item.service_charge) || 0;
    
    item.selling_price = cost + charge;
    
    const qty = parseFloat(item.quantity) || 1;
    const totalSelling = item.selling_price * qty;
    
    const vatRate = parseFloat(item.vat_percentage) || 0;
    item.vat_amount = parseFloat(((totalSelling * vatRate) / 100).toFixed(2));
    item.total = totalSelling + item.vat_amount;
};

const showWalletSelection = (item) => {
    if (isIssuedEdit.value) return false;
    // Manual items always show wallet dropdown if they have a cost
    if (!item.service_order_id) return true;
    
    // If it's already deducted at the Kanban, never show it again
    if (item.is_cost_deducted) return false;
    
    // If policy is service completion, strictly hide from invoice level
    if (configStore.walletDeductionPoint === 'service_completion') return false;
    
    // Otherwise, check the global deduction point setting
    return configStore.walletDeductionPoint === 'invoice_creation';
};

const save = async (status) => {
    const { valid: isFormValid } = await form.value.validate();
    if (!isFormValid) return;

    try {
        let targetStatus = status;
        // Always save as Draft first to let backend properly trigger the 'Issued' deduction hook
        if (status === 'Issued' && !isIssuedEdit.value) {
            state.status = 'Draft';
        } else {
            state.status = status;
        }
        
        state.items.forEach(item => {
          if (isIssuedEdit.value) return;
          if (item.selectedItem && typeof item.selectedItem === 'object') {
            item.description = item.selectedItem.name;
          } else if (item.selectedItem && typeof item.selectedItem === 'string') {
            item.description = item.selectedItem;
          }
        });

        let res;
        if (isEdit) {
            res = await invoiceStore.updateInvoice(props.invoice.id, state); 
        } else {
            res = await invoiceStore.createInvoice(state);
        }

        // If target was Issued, now trigger the status transition
        if (targetStatus === 'Issued' && !isIssuedEdit.value && res && res.data) {
            await invoiceStore.updateStatus(res.data.id, 'Issued');
        }

        emit('save');
    } catch (err) {
        uiStore.showError(err.response?.data?.message || err.message || 'Operation failed');
    }
};
</script>

<style scoped>
.item-row {
    transition: all 0.2s;
}
.item-row:hover {
    border: 1px solid #0B57D0 !important;
}
</style>
