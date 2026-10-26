<template>
  <v-dialog v-model="show" max-width="500px" persistent>
    <v-card class="rounded-2xl pa-4 shadow-xl">
      <v-card-title class="pa-6 d-flex align-center">
        <div class="text-h5 font-weight-bold">
          <v-icon icon="mdi-swap-horizontal-circle-outline" class="mr-3" color="primary"></v-icon>
          Internal Transfer
        </div>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" size="small" @click="show = false"></v-btn>
      </v-card-title>

      <v-card-text class="px-6">
        <v-form ref="form" v-model="valid">
          <div class="text-caption font-weight-bold opacity-60 mb-2 uppercase">Transfer Source</div>
          <v-select
            v-model="transferData.from_account_id"
            :items="accounts"
            item-title="name"
            item-value="id"
            label="From Account"
            variant="solo-filled"
            flat
            rounded="lg"
            class="mb-4"
            :rules="[v => !!v || 'Required']"
          >
            <template v-slot:selection="{ item }">
              <div class="d-flex align-center">
                <v-avatar size="20" class="mr-2" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
                <v-avatar size="20" class="mr-2 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
                <span>{{ item.raw.name }}</span>
              </div>
            </template>
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :title="item.raw.name" :subtitle="`Available: AED ${item.raw.balance.toLocaleString()}`">
                <template v-slot:prepend>
                  <v-avatar size="24" class="mr-3" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
                  <v-avatar size="24" class="mr-3 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
                </template>
              </v-list-item>
            </template>
          </v-select>

          <div class="text-caption font-weight-bold opacity-60 mb-2 uppercase">Transfer Destination</div>
          <v-select
            v-model="transferData.to_account_id"
            :items="availableDestinationAccounts"
            item-title="name"
            item-value="id"
            label="To Account"
            variant="solo-filled"
            flat
            rounded="lg"
            class="mb-4"
            :rules="[v => !!v || 'Required']"
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
          </v-select>

          <div class="text-caption font-weight-bold opacity-60 mb-2 uppercase">Transaction Amount</div>
          <v-text-field
            v-model.number="transferData.amount"
            label="Amount"
            type="number"
            variant="solo-filled"
            flat
            rounded="lg"
            prefix="AED"
            class="mb-4"
            :rules="[v => !!v || 'Required', v => v > 0 || 'Must be > 0', validateBalance]"
          >
            <template v-slot:append-inner>
               <v-chip size="x-small" color="primary" variant="tonal" v-if="selectedSource">
                   Max: {{ selectedSource.balance.toLocaleString() }}
               </v-chip>
            </template>
          </v-text-field>

          <div class="text-caption font-weight-bold opacity-60 mb-2 uppercase">Description / Notes</div>
          <v-textarea
            v-model="transferData.description"
            label="What is this for?"
            variant="solo-filled"
            flat
            rounded="lg"
            rows="2"
            no-resize
          ></v-textarea>
        </v-form>
      </v-card-text>

      <v-card-actions class="pa-6">
        <v-spacer></v-spacer>
        <v-btn variant="text" color="grey-darken-1" size="large" @click="show = false" class="px-6 rounded-pill">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          size="large"
          class="px-10 rounded-pill font-weight-bold shadow-md"
          :loading="loading"
          :disabled="!valid"
          @click="submit"
        >
          Confirm Transfer
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'

const uiStore = useUIStore()
import { ref, computed, reactive } from 'vue';
import { useWalletStore } from '~/stores/wallet';

const props = defineProps({
  modelValue: Boolean,
  accounts: Array
});
const emit = defineEmits(['update:modelValue', 'success']);

const walletStore = useWalletStore();
const loading = ref(false);
const valid = ref(false);
const form = ref(null);

const show = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const transferData = reactive({
  from_account_id: null,
  to_account_id: null,
  amount: 0,
  description: ''
});

const selectedSource = computed(() => {
  return props.accounts.find(a => a.id === transferData.from_account_id);
});

const availableDestinationAccounts = computed(() => {
  return props.accounts.filter(a => a.id !== transferData.from_account_id);
});

const validateBalance = (v) => {
  if (selectedSource.value && v > selectedSource.value.balance) {
      return `Insufficient balance (Limit: AED ${selectedSource.value.balance})`;
  }
  return true;
};

const submit = async () => {
    const { valid } = await form.value.validate();
    if (!valid) return;

    loading.value = true;
    try {
        const result = await walletStore.performTransfer({
            from_account_id: transferData.from_account_id,
            to_account_id: transferData.to_account_id,
            amount: transferData.amount,
            description: transferData.description
        });

        if (result.success) {
          show.value = false;
          emit('success');
          // Reset form
          Object.assign(transferData, { from_account_id: null, to_account_id: null, amount: 0, description: '' });
        } else {
          uiStore.showError(result.message);
        }
    } finally {
        loading.value = false;
    }
};
</script>

<style scoped>
.shadow-xl {
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
}
.shadow-md {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
}
</style>
