<template>
  <v-card class="pa-4 rounded-xl">
    <v-card-title class="pa-6 d-flex align-center">
      <div class="text-h5 font-weight-bold">
        <v-icon icon="mdi-cash-minus" class="mr-3" color="primary"></v-icon>
        {{ isEdit ? 'Edit Expense' : 'Log New Expense' }}
      </div>
      <v-spacer></v-spacer>
      <DocumentExport v-if="expense?.id" :record-id="expense.id" :types="['expense']" />
      <v-btn icon="mdi-close" variant="text" @click="$emit('cancel')"></v-btn>
    </v-card-title>

    <v-card-text>
      <v-form ref="form" v-slot="{ isValid }">
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="state.description"
              label="Description *"
              placeholder="e.g., Office Rent, Utility Bill"
              variant="outlined"
              :rules="[v => !!v || 'Description is required']"
              density="comfortable"
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="6">
            <v-autocomplete
              v-model="state.expense_sub_type_id"
              :items="expenseSubTypes"
              item-title="sub_type_name"
              item-value="id"
              label="Expense Sub Type *"
              variant="outlined"
              placeholder="Select Sub Type"
              density="comfortable"
              clearable
              :rules="[v => !!v || 'Sub Type is required']"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props" :subtitle="item.raw.ParentType?.type_name"></v-list-item>
              </template>
            </v-autocomplete>
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="state.amount"
              label="Amount *"
              prefix="AED"
              type="number"
              variant="outlined"
              :rules="[v => !!v || 'Amount is required', v => v > 0 || 'Must be > 0']"
              density="comfortable"
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="6">
            <v-radio-group
              v-model="state.status"
              label="Status"
              inline
              class="mt-2"
            >
              <v-radio label="Unpaid" value="Unpaid"></v-radio>
              <v-radio label="Paid" value="Paid" color="success"></v-radio>
            </v-radio-group>
          </v-col>

          <v-col cols="12" md="6" v-if="state.status === 'Paid'">
            <v-select
              v-model="state.account_id"
              :items="walletStore.accounts"
              item-title="name"
              item-value="id"
              label="Paid From Account *"
              placeholder="Select Wallet/Bank"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Account is required for Paid expenses']"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props" :title="item.raw.name">
                  <template v-slot:prepend>
                    <v-avatar size="28" class="mr-3" v-if="item.raw.logo_url" rounded="0">
                      <v-img :src="item.raw.logo_url"></v-img>
                    </v-avatar>
                    <v-avatar size="28" class="mr-3 bg-primary" v-else>
                      <v-icon size="small" icon="mdi-bank"></v-icon>
                    </v-avatar>
                  </template>
                </v-list-item>
              </template>
            </v-select>
          </v-col>

          <v-col cols="12" md="6" v-if="state.status === 'Paid'">
            <v-text-field
              v-model="state.payment_date"
              label="Payment Date *"
              type="date"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Date is required']"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <v-textarea
              v-model="state.notes"
              label="Internal Notes"
              variant="outlined"
              rows="3"
              density="comfortable"
              placeholder="Any extra details..."
            ></v-textarea>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>

    <v-card-actions class="pa-6">
      <v-spacer></v-spacer>
      <v-btn variant="text" size="large" @click="$emit('cancel')">Discard</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        size="large"
        class="px-10"
        :loading="expenseStore.loading"
        @click="save"
      >
        {{ isEdit ? 'Save Changes' : 'Log Expense' }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'

const uiStore = useUIStore()
import { ref, reactive, computed, onMounted } from 'vue';
import { useExpenseStore } from '~/stores/expenses';
import { useWalletStore } from '~/stores/wallet';

const expenseStore = useExpenseStore();
const walletStore = useWalletStore();

const props = defineProps({
  expense: Object // Null if creating
});

const emit = defineEmits(['save', 'cancel']);

const form = ref(null);
const isEdit = !!props.expense;

const { $api } = useNuxtApp();

const expenseSubTypes = ref([]);

const loadConfig = async () => {
  try {
    const res = await $api.get('/expense-sub-types');
    if (res.data.success) {
      expenseSubTypes.value = res.data.data.filter(t => t.status === 'Active');
    }
  } catch (err) {
    console.error('Failed to load expense categories config', err);
  }
};

const state = reactive({
  description: '',
  expense_sub_type_id: null,
  amount: 0,
  status: 'Unpaid',
  payment_date: new Date().toISOString().substring(0, 10),
  account_id: null,
  notes: ''
});



onMounted(() => {
  loadConfig();
  if (isEdit) {
    Object.assign(state, {
      ...props.expense,
      amount: parseFloat(props.expense.amount)
    });
  }
});

const save = async () => {
  const { valid } = await form.value.validate();
  if (!valid) return;

  try {
    if (isEdit) {
      await expenseStore.updateExpense(props.expense.id, state);
    } else {
      await expenseStore.createExpense(state);
    }
    emit('save');
  } catch (err) {
    uiStore.showError(err.message || 'Operation failed');
  }
};
</script>
