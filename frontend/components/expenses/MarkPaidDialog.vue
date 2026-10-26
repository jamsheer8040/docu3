<template>
  <v-card class="pa-4 rounded-xl shadow-premium">
    <v-card-title class="text-h6 font-weight-bold d-flex align-center">
      <v-avatar color="success-lighten-5" size="32" class="mr-3">
        <v-icon icon="mdi-cash-check" color="success" size="small"></v-icon>
      </v-avatar>
      Mark as Paid
    </v-card-title>
    
    <v-card-text class="pt-4">
      <div class="mb-6 pa-4 bg-grey-lighten-4 rounded-lg border">
        <v-row dense>
          <v-col cols="6">
            <div class="text-caption text-uppercase font-weight-bold opacity-60 mb-1">Total Amount</div>
            <div class="text-subtitle-1 font-weight-bold">
              AED {{ parseFloat(expense?.amount || 0).toFixed(2) }}
            </div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-uppercase font-weight-bold opacity-60 mb-1">Pending</div>
            <div class="text-subtitle-1 font-weight-bold text-error">
              AED {{ (parseFloat(expense?.amount || 0) - parseFloat(expense?.paid_amount || 0)).toFixed(2) }}
            </div>
          </v-col>
        </v-row>
        <div class="text-caption mt-2 opacity-70">{{ expense?.description }}</div>
      </div>

      <v-form ref="form" v-model="isValid">
        <v-text-field
          v-model="amount"
          label="Payment Amount"
          prefix="AED"
          variant="outlined"
          density="comfortable"
          type="number"
          :rules="[
            v => !!v || 'Required',
            v => v > 0 || 'Must be greater than 0',
            v => v <= (parseFloat(expense?.amount || 0) - parseFloat(expense?.paid_amount || 0)) + 0.01 || 'Cannot exceed pending amount'
          ]"
          class="mb-4"
        ></v-text-field>

        <v-select
          v-model="account_id"
          :items="accounts"
          item-title="name"
          item-value="id"
          label="Payment Account"
          placeholder="Select Wallet/Bank"
          variant="outlined"
          density="comfortable"
          :rules="[v => !!v || 'Required']"
          class="mb-4"
        >
          <template v-slot:selection="{ item }">
            <div class="d-flex align-center">
              <v-avatar size="20" class="mr-2" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
              <v-avatar size="20" class="mr-2 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
              <span>{{ item.raw.name }}</span>
            </div>
          </template>
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.name" :subtitle="'Balance: AED ' + item.raw.balance?.toFixed(2)">
              <template v-slot:prepend>
                <v-avatar size="24" class="mr-3" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
                <v-avatar size="24" class="mr-3 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
              </template>
            </v-list-item>
          </template>
        </v-select>

        <v-text-field
          v-model="payment_date"
          label="Payment Date"
          type="date"
          variant="outlined"
          density="comfortable"
          persistent-placeholder
          :rules="[v => !!v || 'Required']"
        ></v-text-field>
      </v-form>
    </v-card-text>

    <v-card-actions class="px-4 pb-4">
      <v-spacer></v-spacer>
      <v-btn variant="text" @click="$emit('cancel')" class="rounded-pill px-4">Cancel</v-btn>
      <v-btn 
        color="success" 
        variant="flat" 
        :disabled="!isValid" 
        @click="submit"
        :loading="loading"
        class="rounded-pill px-6"
      >
        Confirm Payment
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  expense: { type: Object, required: true },
  accounts: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['submit', 'cancel']);

const isValid = ref(false);
const form = ref(null);
const account_id = ref(null);
const amount = ref(parseFloat(props.expense?.amount || 0) - parseFloat(props.expense?.paid_amount || 0));
const payment_date = ref(new Date().toISOString().substring(0, 10));

const submit = () => {
  if (isValid.value) {
    emit('submit', {
      account_id: account_id.value,
      payment_date: payment_date.value,
      amount: amount.value
    });
  }
};
</script>

<style scoped>
.shadow-premium {
  box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
}
</style>
