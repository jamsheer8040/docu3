<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
    <v-card class="soft-card">
      <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
        <span class="text-h5 font-weight-black text-primary">{{ isEditing ? 'Edit Lead' : 'New Lead' }}</span>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)"></v-btn>
      </v-card-title>

      <v-card-text class="pa-6">
        <v-form ref="form" v-model="valid" @submit.prevent="save">
          <div class="mb-4">
            <label class="text-caption font-weight-bold mb-2 d-block">Lead Type</label>
            <v-btn-toggle v-model="formData.lead_type" color="primary" variant="outlined" divided mandatory aria-label="Lead type">
              <v-btn value="Person">Person</v-btn>
              <v-btn value="Company">Company</v-btn>
            </v-btn-toggle>
          </div>

          <!-- Customer Search Field with custom dropdown -->
          <div class="customer-search-wrapper mb-4" @keydown.down.prevent="highlightNext" @keydown.up.prevent="highlightPrev" @keydown.enter.prevent="selectHighlighted" @keydown.esc="isFocused = false">
            <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">{{ formData.lead_type === 'Person' ? 'Customer Name *' : 'Customer / Company Name *' }}</label>
            <v-text-field
              ref="searchField"
              v-model="customerSearch"
              :rules="[v => !!v || 'Company / Customer name is required']"
              variant="outlined"
              density="comfortable"
              class="soft-input"
              bg-color="transparent"
              clearable
              autocomplete="off"
              :prepend-inner-icon="selectedCustomerId ? 'mdi-account-check' : (formData.lead_type === 'Person' ? 'mdi-account-outline' : 'mdi-domain')"
              :color="selectedCustomerId ? 'success' : 'primary'"
              :hint="selectedCustomerId ? 'Existing customer selected' : (customerSearch ? 'New prospect — fill in remaining fields' : '')"
              persistent-hint
              @focus="isFocused = true"
              @blur="onBlur"
            >
              <template v-slot:append-inner>
                <v-chip v-if="selectedCustomerId" color="success" size="x-small" variant="flat" class="mr-1">Existing</v-chip>
                <v-chip v-else-if="customerSearch && !selectedCustomerId" color="warning" size="x-small" variant="flat" class="mr-1">New</v-chip>
              </template>
            </v-text-field>

            <!-- Dropdown List -->
            <transition name="dropdown-fade">
              <div v-if="isFocused" class="customer-dropdown elevation-8">
                <!-- Loading state -->
                <div v-if="loadingCustomers" class="dropdown-info">
                  <v-progress-circular indeterminate size="16" width="2" class="mr-2"></v-progress-circular>
                  Loading customers...
                </div>
                <!-- No search yet: show hint -->
                <div v-else-if="!customerSearch" class="dropdown-info">
                  <v-icon size="16" class="mr-2">mdi-magnify</v-icon>
                  {{ customersList.length }} customers available — start typing to search
                </div>
                <!-- No match -->
                <div v-else-if="filteredCustomers.length === 0" class="dropdown-no-match">
                  <v-icon color="warning" size="16" class="mr-2">mdi-alert-circle-outline</v-icon>
                  <strong>No Match</strong>
                  <span class="ml-2 text-caption">— will be saved as new prospect</span>
                </div>
                <!-- Customer results -->
                <template v-else>
                  <div
                    v-for="(customer, index) in filteredCustomers"
                    :key="customer.id"
                    class="dropdown-item"
                    :class="{ 'dropdown-item--active': index === highlightedIndex }"
                    @mousedown.prevent="selectCustomer(customer)"
                  >
                    <v-avatar color="primary" size="34" class="mr-3 flex-shrink-0">
                      <span class="text-caption text-white font-weight-bold">{{ customer.name.charAt(0).toUpperCase() }}</span>
                    </v-avatar>
                    <div class="flex-grow-1 min-width-0">
                      <div class="font-weight-medium text-truncate" v-html="highlightMatch(customer.name, customerSearch)"></div>
                      <div class="text-caption text-medium-emphasis">{{ customer.phone_whatsapp || customer.email || 'No contact info' }}</div>
                    </div>
                    <v-icon size="16" color="primary">mdi-chevron-right</v-icon>
                  </div>
                </template>
              </div>
            </transition>
          </div>

          <v-row>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Contact Person (Optional)</label>
              <v-text-field
                v-model="formData.name"
                variant="outlined"
                density="comfortable"
                class="mb-3 soft-input"
                bg-color="transparent"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Service Required (Optional)</label>
              <v-select
                v-model="formData.service_id"
                :items="servicesList"
                item-title="name"
                item-value="id"
                variant="outlined"
                density="comfortable"
                class="mb-3 soft-input"
                bg-color="transparent"
                clearable
              ></v-select>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Email Address</label>
              <v-text-field
                v-model="formData.email"
                type="email"
                variant="outlined"
                density="comfortable"
                class="mb-3 soft-input"
                bg-color="transparent"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Phone / WhatsApp *</label>
              <v-text-field
                v-model="formData.phone"
                :rules="[v => !!v || 'Phone is required']"
                variant="outlined"
                density="comfortable"
                class="mb-3 soft-input"
                bg-color="transparent"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Lead Status</label>
              <v-select
                v-model="formData.status"
                :hint="lead?.status === 'Archived' ? 'Choose an active status to reopen this lead.' : ''"
                :persistent-hint="lead?.status === 'Archived'"
                :items="['New', 'Contacted', 'Qualified', 'Follow-up', 'Archived']"
                variant="outlined"
                density="comfortable"
                class="mb-3 soft-input"
                bg-color="transparent"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Lead Source</label>
              <v-select
                v-model="formData.source"
                :items="['Website', 'Referral', 'Social Media', 'Meta Ads', 'Cold Call', 'Other']"
                variant="outlined"
                density="comfortable"
                class="mb-3 soft-input"
                bg-color="transparent"
              ></v-select>
            </v-col>
          </v-row>

          <v-text-field v-if="formData.status === 'Follow-up'" v-model="formData.next_follow_up_date" label="Follow-up date" type="date" variant="outlined" :rules="[value => !!value || 'Choose a follow-up date']" />
          <v-textarea v-if="formData.status === 'Archived'" v-model="formData.archive_reason" label="Archive reason *" variant="outlined" rows="2" maxlength="5000" :rules="[value => !!value?.trim() || 'Enter an archive reason']" />

          <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Notes</label>
          <v-textarea
            v-model="formData.notes"
            rows="3"
            variant="outlined"
            density="comfortable"
            class="soft-input"
            bg-color="transparent"
          ></v-textarea>
        </v-form>
      </v-card-text>

      <v-card-actions class="pa-6 border-t bg-surface">
        <v-spacer></v-spacer>
        <v-btn variant="text" color="secondary" size="large" @click="$emit('update:modelValue', false)" class="mr-2">Cancel</v-btn>
        <v-btn class="btn-standard px-6" size="large" @click="save" :loading="saving" :disabled="!valid">
          {{ isEditing ? 'Save Changes' : 'Create Lead' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue';
import { useLeadStore } from '~/stores/leads';
import { useNuxtApp } from '#app';
import { visibleLeadNotes, preserveLeadTracking } from '~/utils/leadNotes';

const props = defineProps({
  modelValue: Boolean,
  lead: { type: Object, default: null }
});

const emit = defineEmits(['update:modelValue', 'saved']);
const leadStore = useLeadStore();
const { $api } = useNuxtApp();

const valid = ref(false);
const saving = ref(false);
const form = ref(null);
const searchField = ref(null);

// Customer search state
const customerSearch = ref('');
const customersList = ref([]);
const servicesList = ref([]);
const loadingCustomers = ref(false);
const selectedCustomerId = ref(null);
const isFocused = ref(false);
const highlightedIndex = ref(-1);

const isEditing = computed(() => !!props.lead);

const formData = reactive({
  lead_type: 'Company',
  archive_reason: '',
  customer_id: null,
  service_id: null,
  name: '',
  company_name: '',
  email: '',
  phone: '',
  status: 'New',
  next_follow_up_date: null,
  source: 'Website',
  notes: ''
});

// Filter customers by search text (ignore spaces, case insensitive)
const filteredCustomers = computed(() => {
  if (!customerSearch.value) return [];
  const q = customerSearch.value.toLowerCase().replace(/\s+/g, '');
  return customersList.value.filter(c => {
    const name = (c.name || '').toLowerCase().replace(/\s+/g, '');
    return name.includes(q);
  });
});

// Watch search text — sync company_name, handle clearing and deselection
watch(customerSearch, (val) => {
  highlightedIndex.value = -1;

  if (!val) {
    // Field cleared — reset everything
    selectedCustomerId.value = null;
    formData.customer_id = null;
    formData.company_name = '';
    formData.email = '';
    formData.phone = '';
  } else if (selectedCustomerId.value) {
    // User edited text after selecting a customer — deselect
    const selectedName = customersList.value.find(c => c.id === selectedCustomerId.value)?.name || '';
    if (val !== selectedName) {
      selectedCustomerId.value = null;
      formData.customer_id = null;
      formData.company_name = val;
      formData.email = '';
      formData.phone = '';
    }
  } else {
    // Normal typing without selection
    formData.company_name = val;
    formData.customer_id = null;
  }
});

onMounted(async () => {
  loadingCustomers.value = true;
  try {
    const [custResult, srvResult] = await Promise.allSettled([
      $api.get('/customers?limit=1000&is_active=true'),
      $api.get('/services/types')
    ]);
    
    if (custResult.status === 'fulfilled' && custResult.value.data.success) {
      customersList.value = Array.isArray(custResult.value.data.data) ? custResult.value.data.data : [];
    }
    
    if (srvResult.status === 'fulfilled' && srvResult.value.data.success) {
      servicesList.value = Array.isArray(srvResult.value.data.data) ? srvResult.value.data.data : [];
    }
  } catch (error) {
    console.error('Failed to fetch data', error);
  } finally {
    loadingCustomers.value = false;
  }
});

const highlightMatch = (text, query) => {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<strong style="color:rgb(var(--v-theme-primary))">$1</strong>');
};

const selectCustomer = (customer) => {
  selectedCustomerId.value = customer.id;
  customerSearch.value = customer.name;
  formData.customer_id = customer.id;
  formData.company_name = customer.name;
  // If the customer has a dedicated contact person field, use it, otherwise use their primary name
  formData.name = customer.contact_person || customer.name || '';
  formData.email = customer.email || '';
  formData.phone = customer.phone_whatsapp || '';
  isFocused.value = false;
  highlightedIndex.value = -1;
};

const onBlur = () => {
  // Delay so mousedown on item fires first
  setTimeout(() => {
    isFocused.value = false;
    // If user typed without selecting, use typed text as new prospect company name
    if (!selectedCustomerId.value && customerSearch.value) {
      formData.company_name = customerSearch.value;
      formData.customer_id = null;
    }
  }, 200);
};

const highlightNext = () => {
  if (filteredCustomers.value.length === 0) return;
  highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredCustomers.value.length - 1);
};

const highlightPrev = () => {
  highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
};

const selectHighlighted = () => {
  if (highlightedIndex.value >= 0 && filteredCustomers.value[highlightedIndex.value]) {
    selectCustomer(filteredCustomers.value[highlightedIndex.value]);
  } else {
    // Confirm typed text as new prospect
    formData.company_name = customerSearch.value;
    formData.customer_id = null;
    selectedCustomerId.value = null;
    isFocused.value = false;
  }
};

const resetForm = () => {
  formData.lead_type = 'Company';
  formData.archive_reason = '';
  formData.customer_id = null;
  formData.service_id = null;
  formData.name = '';
  formData.company_name = '';
  formData.email = '';
  formData.phone = '';
  formData.status = 'New';
  formData.next_follow_up_date = null;
  formData.source = 'Website';
  formData.notes = '';
  customerSearch.value = '';
  selectedCustomerId.value = null;
  isFocused.value = false;
  highlightedIndex.value = -1;
};

watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.lead) {
      formData.lead_type = props.lead.lead_type || null;
      formData.archive_reason = props.lead.archive_reason || '';
      formData.customer_id = props.lead.customer_id || null;
      formData.service_id = props.lead.service_id || null;
      formData.name = props.lead.name || '';
      formData.company_name = props.lead.company_name || '';
      formData.email = props.lead.email || '';
      formData.phone = props.lead.phone || '';
      formData.status = props.lead.status || 'New';
      formData.next_follow_up_date = props.lead.next_follow_up_date || null;
      formData.source = props.lead.source || 'Website';
      formData.notes = visibleLeadNotes(props.lead.notes);
      customerSearch.value = formData.company_name || formData.name;
      selectedCustomerId.value = formData.customer_id;
    } else {
      resetForm();
    }
    if (form.value) setTimeout(() => form.value.resetValidation(), 0);
  }
}, { immediate: true });

const save = async () => {
  if (!form.value) return;
  const { valid: isValid } = await form.value.validate();
  if (!isValid) return;

  saving.value = true;
  try {
    if (isEditing.value) {
      await leadStore.updateLead(props.lead.id, { ...formData, notes: preserveLeadTracking(formData.notes, props.lead.notes) });
    } else {
      await leadStore.createLead(formData);
    }
    emit('saved');
    emit('update:modelValue', false);
  } catch (error) {
    console.error('Failed to save lead', error);
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.customer-search-wrapper {
  position: relative;
}

.customer-dropdown {
  position: absolute;
  top: calc(100% - 8px);
  left: 0;
  right: 0;
  z-index: 2400;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  max-height: 260px;
  overflow-y: auto;
}

.dropdown-info {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  color: #666;
  font-size: 0.875rem;
}

.dropdown-no-match {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  font-size: 0.875rem;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover,
.dropdown-item--active {
  background: rgba(var(--v-theme-primary), 0.06);
}

.min-width-0 {
  min-width: 0;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
