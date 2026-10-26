<template>
  <v-dialog v-model="show" max-width="600px" persistent>
    <v-card class="soft-card">
      <v-card-title class="pa-6 d-flex align-center">
        <div class="text-h6 font-weight-bold">
          <v-icon icon="mdi-account-edit-outline" class="mr-2" color="primary"></v-icon>
          {{ isEdit ? 'Edit Customer' : 'Add New Customer' }}
        </div>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close"></v-btn>
      </v-card-title>
      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>
        <v-form @submit.prevent="submit">
          <v-row>
            <v-col cols="12">
              <v-select v-model="state.assigned_user_id" :items="salesStaff" item-title="name" item-value="id" label="Salesperson / customer owner *" variant="outlined" density="comfortable" :loading="staffLoading" :error-messages="v$.assigned_user_id.$errors.map(e => e.$message)" @blur="v$.assigned_user_id.$touch" />
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Full Name *</label>
              <v-text-field
                v-model="state.name"
                :error-messages="v$.name.$errors.map(e => e.$message)"
                @blur="v$.name.$touch"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Email</label>
              <v-text-field
                v-model="state.email"
                :error-messages="v$.email.$errors.map(e => e.$message)"
                @blur="v$.email.$touch"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Phone / WhatsApp *</label>
              <v-text-field
                v-model="state.phone_whatsapp"
                hint="Format: +971501234567"
                persistent-hint
                :error-messages="v$.phone_whatsapp.$errors.map(e => e.$message)"
                @blur="v$.phone_whatsapp.$touch"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Trade License No</label>
              <v-text-field
                v-model="state.trade_license_no"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">City</label>
              <v-text-field
                v-model="state.city"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Country</label>
              <v-text-field
                v-model="state.country"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Pricing Category</label>
              <v-select
                v-model="state.pricing_category"
                :items="['Normal', 'Prime', 'Prime+']"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-select>
            </v-col>
            <v-col cols="12">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Address</label>
              <v-textarea
                v-model="state.address"
                rows="2"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-textarea>
            </v-col>
            <v-col cols="12">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 ml-1 d-block">Notes</label>
              <v-textarea
                v-model="state.notes"
                rows="2"
                variant="outlined"
                class="soft-input"
                bg-color="transparent"
                density="comfortable"
              ></v-textarea>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-6 pt-0">
        <v-spacer></v-spacer>
        <v-btn variant="text" color="grey-darken-1" @click="close">Cancel</v-btn>
        <v-btn
          class="btn-standard px-6"
          @click="submit"
          :loading="loading"
          :disabled="v$.$invalid"
        >
          {{ isEdit ? 'Update Customer' : 'Save Customer' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, maxLength, helpers } from '@vuelidate/validators';
import { useAuthStore } from '~/stores/auth';
const auth = useAuthStore();

const props = defineProps({
  modelValue: Boolean,
  customer: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'saved']);

const show = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const isEdit = computed(() => !!props.customer);
const loading = ref(false);
const salesStaff = ref([]), staffLoading = ref(false), errorMessage = ref('');
async function loadSalesStaff() {
  staffLoading.value = true;
  try { salesStaff.value = (await useNuxtApp().$api.get('/record-assignments/staff')).data.data; }
  catch (error) { errorMessage.value = error.response?.data?.message || 'Could not load sales staff. Try again before changing the assignment.'; }
  finally { staffLoading.value = false; }
}

const initialState = {
  assigned_user_id: null,
  name: '',
  email: '',
  phone_whatsapp: '',
  address: '',
  city: '',
  country: 'UAE',
  trade_license_no: '',
  pricing_category: 'Normal',
  notes: ''
};

const state = reactive({ ...initialState });

const rules = {
  assigned_user_id: { required: helpers.withMessage('Select a salesperson', required) },
  name: { 
    required, 
    minLength: minLength(2), 
    maxLength: maxLength(150) 
  },
  email: { 
    email: helpers.withMessage('Invalid email format', email) 
  },
  phone_whatsapp: { 
    required: helpers.withMessage('Phone is required', required),
    regex: helpers.withMessage(
      'Format: +971501234567', 
      helpers.regex(/^\+?[1-9]\d{7,14}$/)
    )
  }
};

const v$ = useVuelidate(rules, state);

watch(() => props.customer, (newVal) => {
  if (newVal) {
    Object.assign(state, newVal);
  } else {
    Object.assign(state, initialState, { assigned_user_id: auth.user?.id ?? null });
    v$.value.$reset();
  }
}, { immediate: true });

// Also reset when dialog opens to ensure a clean form for "New Customer"
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) { errorMessage.value = ''; loadSalesStaff(); }
  if (isOpen && !props.customer) {
    Object.assign(state, initialState, { assigned_user_id: auth.user?.id ?? null });
    v$.value.$reset();
  }
});

const close = () => {
  show.value = false;
};

const submit = async () => {
  const result = await v$.value.$validate();
  if (!result) return;

  loading.value = true;
  const { $api } = useNuxtApp();
  
  try {
    let response;
    if (isEdit.value) {
      response = await $api.put(`/customers/${props.customer.id}`, state);
    } else {
      response = await $api.post('/customers', state);
    }

    if (response.data.success) {
      emit('saved', response.data.data);
      close();
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Could not save customer.';
    console.error('Error saving customer:', error);
  } finally {
    loading.value = false;
  }
};
</script>
