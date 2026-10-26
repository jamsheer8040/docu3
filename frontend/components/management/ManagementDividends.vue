<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <div class="text-h6 font-weight-bold">Dividends</div>
      <v-btn color="primary" prepend-icon="mdi-bullhorn" v-if="auth.can('management', 'create')" @click="openDeclareDialog">Declare Dividend</v-btn>
    </div>

    <v-card class="border rounded-xl mb-6" border v-for="dec in store.dividends" :key="dec.id">
      <v-card-title class="pa-4 bg-grey-lighten-4 border-b d-flex justify-space-between align-center">
        <div>
          <span class="font-weight-bold">FY: {{ dec.financial_year }}</span>
          <v-chip size="small" class="ml-3" :color="dec.status === 'Fully Paid' ? 'success' : (dec.status === 'Partially Paid' ? 'orange' : 'info')">{{ dec.status }}</v-chip>
        </div>
        <div class="text-subtitle-2 text-grey">Declared: {{ formatDate(dec.declaration_date) }}</div>
      </v-card-title>
      <v-card-text class="pa-4">
        <v-row class="mb-4">
          <v-col cols="6">
            <div class="text-caption text-grey text-uppercase font-weight-bold">Total Profit</div>
            <div class="text-h6">{{ formatCurrency(dec.total_profit) }}</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-grey text-uppercase font-weight-bold">Dividend Amount</div>
            <div class="text-h6 text-success font-weight-bold">{{ formatCurrency(dec.dividend_amount) }}</div>
          </v-col>
        </v-row>
        
        <div class="text-subtitle-2 font-weight-bold mb-2">Distributions</div>
        <v-table density="comfortable" class="border rounded-lg">
          <thead>
            <tr>
              <th>Shareholder</th>
              <th class="text-center">Ownership %</th>
              <th class="text-right">Allocated</th>
              <th class="text-right">Paid</th>
              <th class="text-right">Balance</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dist in dec.DividendDistributions" :key="dist.id">
              <td class="font-weight-bold">{{ dist.Shareholder?.name }}</td>
              <td class="text-center">{{ dist.ownership_percentage }}%</td>
              <td class="text-right">{{ formatCurrency(dist.allocated_amount) }}</td>
              <td class="text-right text-success">{{ formatCurrency(dist.paid_amount) }}</td>
              <td class="text-right text-error">{{ formatCurrency(dist.allocated_amount - dist.paid_amount) }}</td>
              <td class="text-right">
                <v-btn v-if="(dist.allocated_amount - dist.paid_amount) > 0 && auth.canRecord('management', 'edit', dec) && ['Declared', 'Partially Paid'].includes(dec.status)" size="small" variant="tonal" color="primary" @click="openPayDialog(dist)">Pay</v-btn>
                <v-icon v-else-if="Number(dist.allocated_amount) === Number(dist.paid_amount)" color="success" icon="mdi-check-circle"></v-icon>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <!-- Declare Dialog -->
    <v-dialog v-model="declareDialog" max-width="500">
      <v-card class="rounded-xl border">
        <v-card-title class="pa-4 border-b bg-grey-lighten-4">
          <span class="text-h6 font-weight-bold">Declare Dividend</span>
        </v-card-title>
        <v-card-text class="pa-4">
          <v-form ref="declareForm" v-model="declareValid">
            <v-text-field v-model="declareItem.financial_year" label="Financial Year*" variant="outlined" density="comfortable" :rules="[v => !!v || 'Required']" class="mb-2"></v-text-field>
            <v-text-field v-model.number="declareItem.total_profit" label="Total Profit (AED)*" type="number" variant="outlined" density="comfortable" :rules="[v => !!v || 'Required']" class="mb-2"></v-text-field>
            <v-text-field v-model.number="declareItem.dividend_amount" label="Dividend Amount (AED)*" type="number" variant="outlined" density="comfortable" :rules="[v => Number.isFinite(Number(v)) && Number(v) > 0 || 'Enter an amount greater than zero', v => v <= declareItem.total_profit || 'Cannot exceed total profit']" class="mb-2"></v-text-field>
            <v-text-field v-model="declareItem.declaration_date" label="Declaration Date*" type="date" variant="outlined" density="comfortable" :rules="[v => !!v || 'Required']" class="mb-2"></v-text-field>
            <v-textarea v-model="declareItem.remarks" label="Remarks" variant="outlined" density="comfortable" rows="2"></v-textarea>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-4 border-t">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="declareDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!declareValid || saving" :loading="saving" @click="saveDeclaration">Declare</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Pay Dialog -->
    <v-dialog v-model="payDialog" max-width="500">
      <v-card class="rounded-xl border">
        <v-card-title class="pa-4 border-b bg-grey-lighten-4">
          <span class="text-h6 font-weight-bold">Pay Dividend</span>
        </v-card-title>
        <v-card-text class="pa-4">
          <div class="mb-4">
            <div class="text-caption text-grey">Shareholder</div>
            <div class="font-weight-bold">{{ payItem.shareholderName }}</div>
            <div class="text-caption text-grey mt-2">Remaining Balance</div>
            <div class="text-h6 text-error">{{ formatCurrency(payItem.max_amount) }}</div>
          </div>
          <v-form ref="payForm" v-model="payValid">
            <v-text-field v-model.number="payItem.amount" label="Payment Amount (AED)*" type="number" variant="outlined" density="comfortable" :rules="[v => Number.isFinite(Number(v)) && Number(v) > 0 || 'Enter an amount greater than zero', v => v <= payItem.max_amount || 'Exceeds balance']" class="mb-2"></v-text-field>
            <v-text-field v-model="payItem.date" label="Payment Date*" type="date" variant="outlined" density="comfortable" :rules="[v => !!v || 'Required']" class="mb-2"></v-text-field>
            <v-select v-model="payItem.method" :items="['Bank Transfer', 'Cash', 'Cheque', 'Other']" label="Payment Method" variant="outlined" density="comfortable" class="mb-2"></v-select>
            <v-select v-model="payItem.wallet_id" :items="walletStore.accounts" item-title="name" item-value="id" label="Pay From Wallet" variant="outlined" density="comfortable" class="mb-2" persistent-hint hint="Will reduce wallet balance">
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
            <v-text-field v-model="payItem.reference_number" label="Reference / Cheque Number" variant="outlined" density="comfortable" class="mb-2"></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-4 border-t">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="payDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!payValid || saving" :loading="saving" @click="savePayment">Record Payment</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { businessDate } from '~/utils/businessDate';
import { useAuthStore } from '~/stores/auth';
const auth = useAuthStore();
import { useManagementStore } from '~/stores/management';
import { useWalletStore } from '~/stores/wallet';

const store = useManagementStore();
const walletStore = useWalletStore();

const declareDialog = ref(false);
const declareValid = ref(false);
const saving = ref(false);
const declareItem = ref({});

const payDialog = ref(false);
const payValid = ref(false);
const payItem = ref({});

const formatCurrency = (val) => {
  if (val == null) return '—';
  if (!val) return '0.00';
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
};

const openDeclareDialog = () => {
  declareItem.value = { declaration_date: businessDate(), financial_year: businessDate().slice(0, 4) };
  declareDialog.value = true;
};

const saveDeclaration = async () => {
  if (!declareValid.value) return;
  saving.value = true;
  try {
    await store.declareDividend(declareItem.value);
    declareDialog.value = false;
  } catch (err) {
    alert(err.response?.data?.message || 'Error declaring dividend');
  } finally {
    saving.value = false;
  }
};

const openPayDialog = (dist) => {
  payItem.value = { 
    distribution_id: dist.id, 
    shareholderName: dist.Shareholder?.name,
    max_amount: dist.allocated_amount - dist.paid_amount,
    amount: dist.allocated_amount - dist.paid_amount,
    date: businessDate(),
    method: 'Bank Transfer'
  };
  payDialog.value = true;
};

const savePayment = async () => {
  if (!payValid.value) return;
  saving.value = true;
  try {
    await store.payDividend(payItem.value);
    payDialog.value = false;
  } catch (err) {
    alert(err.response?.data?.message || 'Error recording payment');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  store.fetchDividends().catch(() => {});
  if (!walletStore.accounts.length) walletStore.fetchAccounts().catch(() => {});
});
</script>
