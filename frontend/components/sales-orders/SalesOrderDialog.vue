<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" width="97vw" max-width="1900px" height="97vh" scrollable persistent>
    <v-card class="soft-card">
      <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
        <span class="text-h5 font-weight-black text-primary">
          {{ isEditMode ? `Edit Sales Order (${orderToEdit?.order_number})` : 'Create Sales Order' }}
        </span>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)"></v-btn>
      </v-card-title>

      <v-card-text class="pa-6">
        <v-form ref="form" v-model="valid">
          <h3 class="text-h6 font-weight-bold mb-4">Header Information</h3>
          <v-row>
            <v-col v-if="!isConvertingQuotation" cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">{{ orderToEdit?.source_quotation_id ? 'Linked Customer' : 'Customer *' }}</label>
              <v-autocomplete
                v-model="formData.customer_id"
                :items="customers"
                item-title="name"
                item-value="id"
                :rules="[v => !!v || !!(quotationSeed || orderToEdit?.source_quotation_id) || 'Customer is required']"
                :disabled="isEditMode && orderToEdit?.confirmation_status !== 'Unconfirmed'"
                clearable
                variant="outlined"
                density="comfortable"
                class="mb-2 soft-input"
                bg-color="transparent"
                placeholder="Search customer..."
              ></v-autocomplete>
            </v-col>
            <v-col v-else cols="12" md="6">
              <div class="text-caption font-weight-bold mb-2">Quotation Recipient</div>
              <div class="font-weight-bold text-body-1">{{ formData.recipient_snapshot.name }}</div>
              <p class="text-body-2 text-medium-emphasis mt-1">{{ [formData.recipient_snapshot.phone, formData.recipient_snapshot.email].filter(Boolean).join(' · ') }}</p>
              <p v-if="formData.recipient_snapshot.address" class="text-body-2 text-medium-emphasis mt-1">{{ formData.recipient_snapshot.address }}</p>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Contact Person</label>
              <v-text-field
                v-model="formData.contact_person"
                variant="outlined"
                density="comfortable"
                class="mb-2 soft-input"
                bg-color="transparent"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Customer Reference</label>
              <v-text-field
                v-model="formData.customer_reference"
                variant="outlined"
                density="comfortable"
                class="mb-2 soft-input"
                bg-color="transparent"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Branch</label>
              <v-text-field
                v-model="formData.branch"
                variant="outlined"
                density="comfortable"
                class="mb-2 soft-input"
                bg-color="transparent"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Internal Remarks</label>
              <v-textarea
                v-model="formData.internal_remarks"
                variant="outlined"
                density="comfortable"
                rows="2"
                class="mb-2 soft-input"
                bg-color="transparent"
              ></v-textarea>
            </v-col>
          </v-row>
          <v-alert v-if="isConvertingQuotation || orderToEdit?.confirmation_status === 'Unconfirmed'" variant="tonal" type="info" class="mb-4">{{ quotationSeed?.source_quotation_number || 'Converted quotation' }} · Save as Unconfirmed. Expected dates are optional.</v-alert>
          <v-row v-if="isEditMode && orderToEdit?.source_quotation_id && !formData.customer_id">
            <v-col cols="12" md="6"><v-text-field v-model="formData.recipient_snapshot.name" label="Customer / Company Name" variant="outlined" /></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="formData.recipient_snapshot.phone" label="Phone / WhatsApp" variant="outlined" /></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="formData.recipient_snapshot.email" label="Email" variant="outlined" /></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="formData.recipient_snapshot.address" label="Address" variant="outlined" /></v-col>
          </v-row>
          <v-textarea v-if="quotationSeed || orderToEdit?.source_quotation_id" v-model="formData.notes" label="Customer-facing Notes" rows="2" variant="outlined" />
          <v-expansion-panels class="my-5" multiple :model-value="[0,1]">
            <v-expansion-panel>
              <v-expansion-panel-title>Bank Account Details</v-expansion-panel-title>
              <v-expansion-panel-text><v-row>
                <v-col v-for="field in bankFields" :key="field.key" cols="12" md="6">
                  <v-text-field v-model="formData.bank_details[field.key]" :label="field.label" maxlength="150" variant="outlined" @update:model-value="documentTouched = true" />
                </v-col>
              </v-row></v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel>
              <v-expansion-panel-title>Payment Terms &amp; Terms and Conditions</v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-textarea v-model="formData.payment_terms" label="Payment Terms" rows="3" maxlength="5000" variant="outlined" @update:model-value="documentTouched = true" />
                <v-textarea v-model="formData.terms" label="Terms and Conditions" rows="5" maxlength="5000" variant="outlined" @update:model-value="documentTouched = true" />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-divider class="my-6"></v-divider>

          <div class="d-flex align-center justify-space-between mb-4">
            <div>
              <h3 class="text-h6 font-weight-bold">Requested Services</h3>
              <p v-if="isEditMode" class="text-caption text-secondary">
                Add more services or update pending services below. Processed services are preserved.
              </p>
            </div>
            <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" @click="addServiceItem" rounded="lg">
              Add Service
            </v-btn>
          </div>

          <ServiceBundlePicker v-if="modelValue" kind="sales-order" :disabled="saving" :pricing-category="customers.find(row=>String(row.id)===String(formData.customer_id))?.pricing_category || 'Normal'" @add="addTemplate" @busy="templateBusy=$event" />
          <v-table class="bg-transparent soft-card mb-4">
            <thead>
              <tr>
                <th>Service Type</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Cost</th>
                <th>Service Charge</th>
                <th>Total Price</th>
                <th>Priority</th>
                <th>Expected Date</th>
                <th width="50"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in formData.items" :key="index">
                <td class="pa-2">
                  <v-text-field v-if="!item.service_type_id && item.service_name && (quotationSeed || orderToEdit?.source_quotation_id)" v-model="item.service_name" variant="outlined" density="compact" hide-details />
                  <v-autocomplete v-else
                    v-model="item.service_type_id"
                    :items="serviceTypes"
                    item-title="name"
                    item-value="id"
                    placeholder="Select Service"
                    variant="outlined"
                    density="compact"
                    class="soft-input"
                    bg-color="transparent"
                    hide-details
                    :disabled="item.is_locked"
                    @update:modelValue="(val) => onServiceTypeSelect(val, index)"
                  ></v-autocomplete>
                  <div v-if="item.is_locked" class="mt-1 d-flex align-center gap-1">
                    <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-bold" style="height: 18px; font-size: 10px;">
                      {{ item.service_order_id ? 'Pushed to Service' : (item.confirmed ? 'Confirmed' : item.status) }}
                    </v-chip>
                  </div>
                </td>
                <td class="pa-2">
                  <v-text-field
                    v-model="item.description"
                    placeholder="Notes..."
                    variant="outlined"
                    density="compact"
                    class="soft-input"
                    bg-color="transparent"
                    hide-details
                  ></v-text-field>
                </td>
                <td class="pa-2">
                  <v-text-field
                    v-model.number="item.quantity"
                    type="number"
                    variant="outlined"
                    density="compact"
                    class="soft-input"
                    bg-color="transparent"
                    hide-details
                    :disabled="item.is_locked"
                    style="width: 80px"
                  ></v-text-field>
                </td>
                <td class="pa-2">
                  <v-text-field
                    v-model.number="item.cost"
                    type="number"
                    variant="outlined"
                    density="compact"
                    class="soft-input"
                    bg-color="transparent"
                    hide-details
                    :disabled="item.is_locked"
                    style="width: 90px"
                    @update:modelValue="item.estimated_price = (Number(item.cost) || 0) + (Number(item.service_charge) || 0)"
                  ></v-text-field>
                </td>
                <td class="pa-2">
                  <v-text-field
                    v-model.number="item.service_charge"
                    type="number"
                    variant="outlined"
                    density="compact"
                    class="soft-input"
                    bg-color="transparent"
                    hide-details
                    :disabled="item.is_locked"
                    style="width: 90px"
                    @update:modelValue="item.estimated_price = (Number(item.cost) || 0) + (Number(item.service_charge) || 0)"
                  ></v-text-field>
                </td>
                <td class="pa-2">
                  <v-text-field
                    v-model.number="item.estimated_price"
                    type="number"
                    variant="outlined"
                    density="compact"
                    class="soft-input"
                    bg-color="transparent"
                    hide-details
                    :disabled="item.is_locked"
                    style="width: 100px"
                  ></v-text-field>
                </td>
                <td class="pa-2">
                  <v-select
                    v-model="item.priority"
                    :items="['Normal', 'Moderate', 'Critical']"
                    variant="outlined"
                    density="compact"
                    class="soft-input"
                    bg-color="transparent"
                    hide-details
                    style="width: 110px"
                  ></v-select>
                </td>
                <td class="pa-2">
                  <v-menu v-model="menuState[index]" :close-on-content-click="false" location="bottom">
                    <template v-slot:activator="{ props: menuProps }">
                      <v-text-field
                        v-bind="menuProps"
                        :model-value="item.expected_date"
                        readonly
                        append-inner-icon="mdi-calendar"
                        variant="outlined"
                        density="compact"
                        class="soft-input"
                        bg-color="transparent"
                        hide-details
                        style="width: 140px"
                        placeholder="Select Date"
                        clearable
                        @click:clear="item.expected_date = null"
                      ></v-text-field>
                    </template>
                    <v-date-picker
                      hide-header
                      color="primary"
                      @update:modelValue="(val) => onDateSelected(val, index)"
                    ></v-date-picker>
                  </v-menu>
                  <p v-if="item.expected_processing_time && !/^\d{4}-\d{2}-\d{2}$/.test(item.expected_processing_time)" class="text-caption mt-1">{{ item.expected_processing_time }}</p>
                </td>
                <td class="pa-2 text-center">
                  <v-tooltip v-if="item.is_locked" text="Action processed (cannot delete)" location="top">
                    <template v-slot:activator="{ props: tipProps }">
                      <v-icon v-bind="tipProps" size="18" color="grey-darken-1">mdi-lock-outline</v-icon>
                    </template>
                  </v-tooltip>
                  <v-btn v-else icon="mdi-delete" variant="text" color="error" size="small" @click="removeServiceItem(index)" title="Remove service"></v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-if="formData.items.length === 0" class="text-center pa-4 text-secondary border rounded-lg bg-surface opacity-60">
            No services added yet. Click "Add Service" above.
          </div>
          <v-row class="mt-4" justify="end">
            <v-col cols="12" md="5">
              <div class="d-flex justify-space-between mb-4"><span>Subtotal</span><strong>AED {{ pricing.subtotal.toFixed(2) }}</strong></div>
              <v-text-field v-model.number="formData.discount" label="Discount (AED)" type="number" min="0" step="0.01" variant="outlined" :rules="[discountRule]" />
              <v-text-field v-model.number="formData.tax_rate" label="VAT %" type="number" min="0" max="100" step="0.01" variant="outlined" :rules="[taxRateRule]" @update:model-value="vatTouched = true" />
              <div class="d-flex justify-space-between mb-4"><span>VAT after discount</span><strong>AED {{ pricing.tax_amount.toFixed(2) }}</strong></div>
              <div class="d-flex justify-space-between text-h6"><span>Total</span><strong>AED {{ pricing.total.toFixed(2) }}</strong></div>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>

      <v-card-actions class="pa-6 border-t bg-surface">
        <v-spacer></v-spacer>
        <v-btn variant="text" color="secondary" size="large" @click="$emit('update:modelValue', false)" class="mr-2">Cancel</v-btn>
        <v-btn class="btn-standard px-6" size="large" @click="save" :loading="saving" :disabled="pricingDefaultsLoading || (pricingDefaultsError && !vatTouched) || templateBusy || !valid || formData.items.length === 0">
          {{ isEditMode ? 'Update Sales Order' : 'Save Sales Order' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { useNuxtApp } from '#app'
import { useUIStore } from '~/stores/ui'
import { appendBundleLines } from '~/utils/serviceBundleLines.mjs'
import ServiceBundlePicker from '~/components/services/ServiceBundlePicker.vue'

const uiStore = useUIStore()

const props = defineProps({
  modelValue: Boolean,
  customers: {
    type: Array,
    default: () => []
  },
  serviceTypes: {
    type: Array,
    default: () => []
  },
  initialCustomerId: {
    type: [Number, String],
    default: null
  },
  orderToEdit: {
    type: Object,
    default: null
  },
  quotationSeed: { type: Object, default: null }
})

const isEditMode = computed(() => !!props.orderToEdit?.id)
const isConvertingQuotation = computed(() => !!props.quotationSeed && !isEditMode.value)

const emit = defineEmits(['update:modelValue', 'saved'])
const { $api } = useNuxtApp()

const form = ref(null)
const valid = ref(false)
const saving = ref(false)
const templateBusy = ref(false)
const menuState = ref({})
const vatTouched = ref(false), pricingDefaultsLoading = ref(false), pricingDefaultsError = ref(false)
const documentTouched = ref(false)
const bankFields = [{key:'bank_name',label:'Bank Name'},{key:'account_name',label:'Account Holder Name'},{key:'account_number',label:'Account Number'},{key:'iban',label:'IBAN'},{key:'swift',label:'SWIFT / BIC'},{key:'branch',label:'Bank Branch'}]
let defaultsRequest = 0

const onDateSelected = (val, index) => {
  if (val) {
    const d = new Date(val)
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    formData.items[index].expected_date = dateString
    menuState.value[index] = false
  }
}

const defaultItem = () => ({
  service_type_id: null,
  service_name: '',
  description: '',
  quantity: 1,
  cost: 0,
  service_charge: 0,
  estimated_price: 0,
  priority: 'Normal',
  expected_processing_time: '',
  expected_date: null,
  is_locked: false
})

const formData = reactive({
  customer_id: null,
  contact_person: '',
  customer_reference: '',
  branch: '',
  internal_remarks: '',
  discount: 0,
  tax_rate: 0,
  bank_details: {},
  payment_terms: '',
  terms: '',
  recipient_snapshot: {},
  notes: '',
  sales_executive_id: null,
  items: []
})
const pricing = computed(() => {
  const subtotalCents = formData.items.reduce((sum, item) => sum + Math.round(Number(item.estimated_price || 0) * 100) * Number(item.quantity || 1), 0)
  const taxable = Math.max(0, subtotalCents - Math.round(Number(formData.discount || 0) * 100))
  const rate = Math.round(Number(formData.tax_rate || 0) * 100)
  const taxCents = Number.isSafeInteger(taxable) && Number.isSafeInteger(rate) && taxable >= 0 && rate >= 0 ? Number((BigInt(taxable) * BigInt(rate) + 5000n) / 10000n) : 0
  return { subtotal: subtotalCents / 100, tax_amount: taxCents / 100, total: (taxable + taxCents) / 100 }
})
const amountValid = value => ['number', 'string'].includes(typeof value) && /^\d+(\.\d{1,2})?$/.test(String(value)) && Number.isFinite(Number(value))
const discountRule = value => amountValid(value) && Number(value) <= pricing.value.subtotal || 'Enter a valid discount no greater than the subtotal'
const taxRateRule = value => amountValid(value) && Number(value) <= 100 || 'Enter VAT from 0 to 100, with at most two decimals'

watch(() => props.modelValue, (val) => {
  const request = ++defaultsRequest
  pricingDefaultsLoading.value = false
  if (val) {
    vatTouched.value = false
    documentTouched.value = false
    pricingDefaultsError.value = false
    if (props.orderToEdit) {
      formData.customer_id = props.orderToEdit.customer_id
      formData.contact_person = props.orderToEdit.contact_person || ''
      formData.customer_reference = props.orderToEdit.customer_reference || ''
      formData.branch = props.orderToEdit.branch || ''
      formData.internal_remarks = props.orderToEdit.internal_remarks || ''
      formData.discount = Number(props.orderToEdit.discount || 0)
      formData.tax_rate = Number(props.orderToEdit.tax_rate || 0)
      formData.bank_details = { ...(props.orderToEdit.bank_details || {}) }
      formData.payment_terms = props.orderToEdit.payment_terms || ''
      formData.terms = props.orderToEdit.terms || ''
      formData.recipient_snapshot = { ...(props.orderToEdit.recipient_snapshot || {}) }
      formData.notes = props.orderToEdit.notes || ''
      formData.sales_executive_id = props.orderToEdit.sales_executive_id || null
      formData.items = (props.orderToEdit.SalesOrderItems || []).map(i => ({
        id: i.id,
        service_type_id: i.service_type_id,
        service_name: i.service_name,
        description: i.description || '',
        quantity: i.quantity || 1,
        cost: Number(i.cost) || 0,
        service_charge: Number(i.service_charge) || 0,
        estimated_price: Number(i.estimated_price) || 0,
        priority: i.priority || 'Normal',
        expected_processing_time: i.expected_processing_time || '',
        expected_date: i.expected_date || (/^\d{4}-\d{2}-\d{2}$/.test(i.expected_processing_time || '') ? i.expected_processing_time : null),
        status: i.status,
        confirmed: i.confirmed,
        service_order_id: i.service_order_id,
        is_locked: !!(i.service_order_id || i.confirmed || i.status === 'In Progress' || i.status === 'CompletedInvoicePending' || i.status === 'CompletedInvoiceCreated')
      }))
      if (formData.items.length === 0) {
        formData.items = [defaultItem()]
      }
    } else if (props.quotationSeed) {
      Object.assign(formData, JSON.parse(JSON.stringify(props.quotationSeed)))
      formData.items = props.quotationSeed.items.map(item => ({ ...defaultItem(), ...item }))
    } else {
      formData.customer_id = props.initialCustomerId || null
      formData.contact_person = ''
      formData.customer_reference = ''
      formData.branch = ''
      formData.internal_remarks = ''
      formData.discount = 0
      formData.tax_rate = 0
      formData.bank_details = {}
      formData.payment_terms = ''
      formData.terms = ''
      formData.recipient_snapshot = {}
      formData.notes = ''
      formData.sales_executive_id = null
      pricingDefaultsLoading.value = true
      $api.get('/sales-orders/pricing-defaults').then(response => {
        if (request === defaultsRequest && props.modelValue && !props.orderToEdit && !vatTouched.value) formData.tax_rate = Number(response.data.data?.tax_rate || 0)
        if (request === defaultsRequest && props.modelValue && !props.orderToEdit && !documentTouched.value) {
          const defaults = response.data.data?.document_defaults || {}
          formData.bank_details = { ...(defaults.bank_details || {}) }
          formData.payment_terms = defaults.payment_terms || ''
          formData.terms = defaults.terms || ''
        }
      }).catch(() => {
        if (request !== defaultsRequest) return
        pricingDefaultsError.value = true
        uiStore.showError('Unable to load the VAT default. Enter the VAT rate before saving.')
      }).finally(() => { if (request === defaultsRequest) pricingDefaultsLoading.value = false })
      formData.items = [defaultItem()]
    }
    if (form.value) form.value.resetValidation()
  }
}, { immediate: true })

const addServiceItem = () => {
  formData.items.push(defaultItem())
}
const addTemplate = items => {
  formData.items = appendBundleLines(formData.items, items)
}

const removeServiceItem = (index) => {
  const item = formData.items[index]
  if (item && item.is_locked) {
    uiStore.showError('Cannot delete service that has already been confirmed or pushed.')
    return
  }
  formData.items.splice(index, 1)
}

const onServiceTypeSelect = (id, index) => {
  const st = props.serviceTypes.find(s => s.id === id)
  if (st) {
    formData.items[index].service_name = st.name
    
    let selectedPricing = null
    if (st.ServiceTypePricings && st.ServiceTypePricings.length > 0) {
      if (st.pricing_mode === 'Multi') {
        const customer = props.customers.find(c => c.id === formData.customer_id)
        const category = customer ? customer.pricing_category : 'Normal'
        selectedPricing = st.ServiceTypePricings.find(p => p.pricing_type === category)
      } else {
        selectedPricing = st.ServiceTypePricings.find(p => p.pricing_type === 'Single') || st.ServiceTypePricings[0]
      }
    }

    const cost = Number(st.cost_price) || 0
    const serviceCharge = selectedPricing ? (Number(selectedPricing.service_charge) || 0) : (Number(st.service_charge) || 0)

    formData.items[index].cost = cost
    formData.items[index].service_charge = serviceCharge
    formData.items[index].estimated_price = cost + serviceCharge
  }
}

const save = async () => {
  if (saving.value || templateBusy.value || pricingDefaultsLoading.value || (pricingDefaultsError.value && !vatTouched.value)) return
  const { valid: isValid } = await form.value.validate()
  if (!isValid) return

  // Validate items
  for (let i = 0; i < formData.items.length; i++) {
    const item = formData.items[i]
    if ((!item.service_type_id && !(props.quotationSeed || props.orderToEdit?.source_quotation_id)) || !item.service_name) {
      uiStore.showError(`Please select a service type for item #${i + 1}`)
      return
    }
  }

  saving.value = true
  try {
    if (isEditMode.value) {
      const response = await $api.put(`/sales-orders/${props.orderToEdit.id}`, formData)
      emit('saved', response.data.data)
      uiStore.showSuccess('Sales Order updated successfully')
    } else if (props.quotationSeed) {
      const response = await $api.post(`/quotations/${props.quotationSeed.source_quotation_id}/sales-order`, formData)
      emit('saved', response.data.data)
      uiStore.showSuccess('Sales order saved as Unconfirmed. Quotation status is SO.')
    } else {
      const response = await $api.post('/sales-orders', formData)
      emit('saved', response.data.data)
      uiStore.showSuccess('Sales Order created successfully')
    }
    emit('update:modelValue', false)
  } catch (err) {
    console.error(err)
    uiStore.showError(err.response?.data?.message || 'Failed to save Sales Order')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
</style>
