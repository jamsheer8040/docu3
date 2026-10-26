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
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Customer *</label>
              <v-autocomplete
                v-model="formData.customer_id"
                :items="customers"
                item-title="name"
                item-value="id"
                :rules="[v => !!v || 'Customer is required']"
                :disabled="isEditMode"
                variant="outlined"
                density="comfortable"
                class="mb-2 soft-input"
                bg-color="transparent"
                placeholder="Search customer..."
              ></v-autocomplete>
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
                  <v-autocomplete
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
                        :model-value="item.expected_processing_time"
                        readonly
                        append-inner-icon="mdi-calendar"
                        variant="outlined"
                        density="compact"
                        class="soft-input"
                        bg-color="transparent"
                        hide-details
                        style="width: 140px"
                        placeholder="Select Date"
                      ></v-text-field>
                    </template>
                    <v-date-picker
                      hide-header
                      color="primary"
                      @update:modelValue="(val) => onDateSelected(val, index)"
                    ></v-date-picker>
                  </v-menu>
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
        </v-form>
      </v-card-text>

      <v-card-actions class="pa-6 border-t bg-surface">
        <v-spacer></v-spacer>
        <v-btn variant="text" color="secondary" size="large" @click="$emit('update:modelValue', false)" class="mr-2">Cancel</v-btn>
        <v-btn class="btn-standard px-6" size="large" @click="save" :loading="saving" :disabled="templateBusy || !valid || formData.items.length === 0">
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
  }
})

const isEditMode = computed(() => !!props.orderToEdit?.id)

const emit = defineEmits(['update:modelValue', 'saved'])
const { $api } = useNuxtApp()

const form = ref(null)
const valid = ref(false)
const saving = ref(false)
const templateBusy = ref(false)
const menuState = ref({})

const onDateSelected = (val, index) => {
  if (val) {
    const d = new Date(val)
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    formData.items[index].expected_processing_time = dateString
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
  is_locked: false
})

const formData = reactive({
  customer_id: null,
  contact_person: '',
  customer_reference: '',
  branch: '',
  internal_remarks: '',
  items: []
})

watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.orderToEdit) {
      formData.customer_id = props.orderToEdit.customer_id
      formData.contact_person = props.orderToEdit.contact_person || ''
      formData.customer_reference = props.orderToEdit.customer_reference || ''
      formData.branch = props.orderToEdit.branch || ''
      formData.internal_remarks = props.orderToEdit.internal_remarks || ''
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
        status: i.status,
        confirmed: i.confirmed,
        service_order_id: i.service_order_id,
        is_locked: !!(i.service_order_id || i.confirmed || i.status === 'In Progress' || i.status === 'CompletedInvoicePending' || i.status === 'CompletedInvoiceCreated')
      }))
      if (formData.items.length === 0) {
        formData.items = [defaultItem()]
      }
    } else {
      formData.customer_id = props.initialCustomerId || null
      formData.contact_person = ''
      formData.customer_reference = ''
      formData.branch = ''
      formData.internal_remarks = ''
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
  if (saving.value || templateBusy.value) return
  const { valid: isValid } = await form.value.validate()
  if (!isValid) return

  // Validate items
  for (let i = 0; i < formData.items.length; i++) {
    const item = formData.items[i]
    if (!item.service_type_id || !item.service_name) {
      uiStore.showError(`Please select a service type for item #${i + 1}`)
      return
    }
  }

  saving.value = true
  try {
    if (isEditMode.value) {
      await $api.put(`/sales-orders/${props.orderToEdit.id}`, formData)
      uiStore.showSuccess('Sales Order updated successfully')
    } else {
      await $api.post('/sales-orders', formData)
      uiStore.showSuccess('Sales Order created successfully')
    }
    emit('saved')
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
