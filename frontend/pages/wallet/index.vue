<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6 align-center">
      <v-col cols="12" md="6">
        <h1 class="text-h4 font-weight-bold color-primary">
          <v-icon icon="mdi-wallet-outline" class="mr-2" color="primary"></v-icon>
          Wallet & Accounts
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">Monitor company liquidity, bank accounts, and credit cards</p>
      </v-col>
      <v-col cols="12" md="6" class="d-flex align-center justify-md-end flex-wrap" style="gap: 16px;">
        <v-btn
          v-if="auth.can('wallet', 'create')"
          color="success"
          prepend-icon="mdi-plus"
          rounded="lg"
          elevation="2"
          height="48"
          class="px-8 font-weight-bold"
          @click="openAddWallet"
        >
          Add Wallet
        </v-btn>
        <v-btn
          v-if="auth.can('wallet', 'edit')"
          color="primary"
          prepend-icon="mdi-swap-horizontal"
          rounded="lg"
          elevation="2"
          height="48"
          class="px-8 font-weight-bold"
          @click="showTransferDialog = true"
        >
          Internal Transfer
        </v-btn>
      </v-col>
    </v-row>

    <!-- Summary Statistics Cards row -->
    <v-row class="mb-8">
      <v-col cols="12" md="3">
        <v-card class="pa-6 glass-card d-flex flex-column justify-center align-center" height="100%">
          <div class="text-subtitle-2 text-uppercase font-weight-black opacity-60 mb-2">Cash on Hand</div>
          <div class="text-h5 font-weight-black text-primary">AED {{ summaryStats.cash.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="pa-6 glass-card d-flex flex-column justify-center align-center" height="100%">
          <div class="text-subtitle-2 text-uppercase font-weight-black opacity-60 mb-2">Bank Accounts</div>
          <div class="text-h5 font-weight-black text-primary">AED {{ summaryStats.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="pa-6 glass-card d-flex flex-column justify-center align-center" height="100%">
          <div class="text-subtitle-2 text-uppercase font-weight-black opacity-60 mb-2">Credit Outstanding</div>
          <div class="text-h5 font-weight-black text-error">AED {{ summaryStats.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="pa-6 glass-card d-flex flex-column justify-center align-center position-relative overflow-hidden" height="100%">
          <div class="card-glow" style="background: rgba(67, 24, 255, 0.04); position: absolute; inset: 0;"></div>
          <div class="text-subtitle-2 text-uppercase font-weight-black opacity-70 mb-2" style="z-index: 1;">Net Worth</div>
          <div class="text-h5 font-weight-black text-primary" style="z-index: 1;">AED {{ summaryStats.net_worth.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Cash Account Section -->
    <div v-if="walletStore.cashAccounts.length > 0" class="mb-8">
      <div class="text-overline font-weight-black opacity-40 mb-3 ml-1">
        <v-icon size="small" class="mr-1">mdi-cash-multiple</v-icon> CASH ACCOUNTS
      </div>
      <v-row>
        <v-col v-for="account in walletStore.cashAccounts" :key="account.id" cols="12" sm="6" md="3">
          <v-card variant="flat" class="pa-4 rounded-xl border bg-surface account-card position-relative overflow-hidden">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="account-icon-wrapper-small rounded-lg bg-primary-container">
                <v-icon size="small" color="primary">mdi-cash-multiple</v-icon>
              </div>
              <div class="d-flex align-center gap-1">
                <v-chip size="x-small" :color="account.balance < 0 ? 'error' : 'success'" class="font-weight-bold" style="font-size: 10px; height: 18px;">
                  {{ account.balance < 0 ? 'DEBT' : 'POSITIVE' }}
                </v-chip>
                <v-btn v-if="auth.canRecord('wallet', 'edit', account)" icon="mdi-pencil" variant="text" size="x-small" color="grey-darken-1" @click="openEditWallet(account)"></v-btn>
              </div>
            </div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">{{ account.name }}</div>
            <div class="text-h6 font-weight-black mb-3">
              <span class="text-caption font-weight-medium opacity-50 mr-1">AED</span>
              {{ parseFloat(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </div>
            <v-divider class="mb-3 opacity-10"></v-divider>
            <div class="d-flex align-center justify-space-between">
              <span class="text-caption opacity-60" style="font-size: 11px !important;">Cash Account</span>
              <v-btn variant="text" size="x-small" color="primary" class="font-weight-bold px-0" @click="filterByAccount(account.id)">VIEW LEDGER</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Debit / Bank Account Section -->
    <div v-if="walletStore.debitAccounts.length > 0" class="mb-8">
      <div class="text-overline font-weight-black opacity-40 mb-3 ml-1">
        <v-icon size="small" class="mr-1">mdi-bank</v-icon> BANK ACCOUNTS (DEBIT)
      </div>
      <v-row>
        <v-col v-for="account in walletStore.debitAccounts" :key="account.id" cols="12" sm="6" md="3">
          <v-card variant="flat" class="pa-4 rounded-xl border bg-surface account-card position-relative overflow-hidden">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="account-icon-wrapper-small rounded-lg overflow-hidden bg-white d-flex align-center justify-center border" style="padding: 2px;">
                <v-img v-if="getBankLogo(account.name)" :src="getBankLogo(account.name)" contain style="width: 100%; height: 100%;"></v-img>
                <v-icon v-else size="small" color="secondary">mdi-bank</v-icon>
              </div>
              <div class="d-flex align-center gap-1">
                <v-chip size="x-small" :color="account.balance < 0 ? 'error' : 'success'" class="font-weight-bold" style="font-size: 10px; height: 18px;">
                  {{ account.balance < 0 ? 'DEBT' : 'POSITIVE' }}
                </v-chip>
                <v-btn v-if="auth.canRecord('wallet', 'edit', account)" icon="mdi-pencil" variant="text" size="x-small" color="grey-darken-1" @click="openEditWallet(account)"></v-btn>
              </div>
            </div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">{{ account.name }}</div>
            <div class="text-h6 font-weight-black mb-3">
              <span class="text-caption font-weight-medium opacity-50 mr-1">AED</span>
              {{ parseFloat(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </div>
            <v-divider class="mb-3 opacity-10"></v-divider>
            <div class="d-flex align-center justify-space-between">
              <span class="text-caption opacity-60" style="font-size: 11px !important;">Debit Card / Bank</span>
              <v-btn variant="text" size="x-small" color="primary" class="font-weight-bold px-0" @click="filterByAccount(account.id)">VIEW LEDGER</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Credit Card Section -->
    <div v-if="walletStore.creditAccounts.length > 0" class="mb-8">
      <div class="text-overline font-weight-black opacity-40 mb-3 ml-1">
        <v-icon size="small" class="mr-1">mdi-credit-card-outline</v-icon> CREDIT CARDS
      </div>
      <v-row>
        <v-col v-for="account in walletStore.creditAccounts" :key="account.id" cols="12" sm="6" md="4">
          <v-card variant="flat" class="pa-5 rounded-xl border bg-surface account-card position-relative overflow-hidden">
            <div class="card-glow" style="background: rgba(186, 26, 26, 0.03);"></div>

            <div class="d-flex align-center justify-space-between mb-3">
              <div class="account-icon-wrapper-small rounded-lg overflow-hidden d-flex align-center justify-center border bg-white" style="padding: 2px;">
                <v-img v-if="getBankLogo(account.name)" :src="getBankLogo(account.name)" contain style="width: 100%; height: 100%;"></v-img>
                <v-icon v-else size="small" color="error">mdi-credit-card-outline</v-icon>
              </div>
              <div class="d-flex align-center gap-1">
                <v-chip size="x-small" color="error" variant="tonal" class="font-weight-bold" style="font-size: 10px; height: 18px;">
                  CREDIT
                </v-chip>
                <v-btn v-if="auth.canRecord('wallet', 'edit', account)" icon="mdi-pencil" variant="text" size="x-small" color="grey-darken-1" @click="openEditWallet(account)"></v-btn>
              </div>
            </div>

            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">{{ account.name }}</div>

            <!-- Outstanding Balance -->
            <div class="text-h6 font-weight-black text-error mb-2">
              <span class="text-caption font-weight-medium opacity-50 mr-1">AED</span>
              {{ parseFloat(account.outstanding_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              <span class="text-caption opacity-40 ml-1">outstanding</span>
            </div>

            <!-- Credit Limit Progress -->
            <div class="mb-3">
              <div class="d-flex justify-space-between text-caption opacity-60 mb-1">
                <span>Used</span>
                <span>AED {{ parseFloat(account.available_credit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }} available</span>
              </div>
              <v-progress-linear
                :model-value="creditUsagePercent(account)"
                :color="creditUsagePercent(account) > 80 ? 'error' : creditUsagePercent(account) > 50 ? 'warning' : 'success'"
                height="6"
                rounded
              ></v-progress-linear>
              <div class="text-caption opacity-40 mt-1">
                Limit: AED {{ parseFloat(account.credit_limit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </div>
            </div>

            <v-divider class="mb-3 opacity-10"></v-divider>

            <!-- Due Date & Payment Status -->
            <div class="pa-3 rounded-lg mb-3" style="background: rgba(0,0,0,0.02);">
              <div class="d-flex align-center justify-space-between mb-2">
                <div>
                  <div class="text-caption opacity-50 font-weight-bold">DUE DATE</div>
                  <div class="text-body-2 font-weight-black">{{ formatDate(account.current_due_date) }}</div>
                </div>
                <v-chip 
                  size="small" 
                  :color="parseFloat(account.billed_remaining || 0) > 0 ? 'error' : 'success'" 
                  variant="tonal"
                  class="font-weight-bold"
                >
                  {{ parseFloat(account.billed_remaining || 0) > 0 ? 'PAYMENT DUE' : 'CLEARED' }}
                </v-chip>
              </div>
              
              <!-- Payment Progress -->
              <v-row dense>
                <v-col cols="4">
                  <div class="text-caption opacity-50">Total Bill</div>
                  <div class="text-body-2 font-weight-bold">AED {{ parseFloat(account.total_billed || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
                </v-col>
                <v-col cols="4">
                  <div class="text-caption opacity-50">Paid</div>
                  <div class="text-body-2 font-weight-bold text-success">AED {{ parseFloat(account.paid_toward_bill || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
                </v-col>
                <v-col cols="4">
                  <div class="text-caption opacity-50">Remaining</div>
                  <div class="text-body-2 font-weight-bold text-error">AED {{ parseFloat(account.billed_remaining || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
                </v-col>
              </v-row>

              <!-- Payment progress bar -->
              <v-progress-linear
                v-if="parseFloat(account.total_billed || 0) > 0"
                :model-value="billPaymentPercent(account)"
                color="success"
                bg-color="error"
                bg-opacity="0.15"
                height="4"
                rounded
                class="mt-2"
              ></v-progress-linear>
            </div>

            <!-- Unbilled (current cycle) -->
            <div class="d-flex align-center justify-space-between mb-2">
              <div>
                <div class="text-caption opacity-50 font-weight-bold">UNBILLED (Current Cycle)</div>
                <div class="text-body-2 font-weight-black">AED {{ parseFloat(account.unbilled_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</div>
              </div>
              <div class="text-right">
                <div class="text-caption opacity-40">Next Bill</div>
                <div class="text-caption font-weight-bold">{{ formatDate(account.next_bill_date) }}</div>
              </div>
            </div>

            <v-divider class="mb-2 opacity-10"></v-divider>

            <div class="d-flex align-center justify-space-between">
              <span class="text-caption opacity-50" style="font-size: 10px !important;">Bill Day: {{ account.bill_day }} · Due Day: {{ account.due_day }}</span>
              <v-btn variant="text" size="x-small" color="primary" class="font-weight-bold px-0" @click="filterByAccount(account.id)">VIEW LEDGER</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Ledger Section -->
    <v-card class="border rounded-2xl" border>
      <v-toolbar color="surface" flat border-b class="px-4 ledger-toolbar">
          <v-icon icon="mdi-format-list-bulleted" color="primary" class="mr-3"></v-icon>
          <span class="text-h6 font-weight-bold">Detailed Financial Ledger</span>
          <v-spacer></v-spacer>
          <v-select
            v-model="accountFilter"
            :items="ledgerWalletOptions"
            label="Wallet"
            variant="outlined"
            density="compact"
            hide-details
            class="ledger-wallet-filter"
          ></v-select>
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search transactions..."
            variant="solo"
            density="comfortable"
            flat
            hide-details
            class="search-pill max-width-300"
          ></v-text-field>
      </v-toolbar>

      <v-data-table-server
        v-model:page="ledgerPage"
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="walletStore.transactions"
        :items-length="walletStore.meta.total"
        :loading="walletStore.loading"
        @update:options="loadTransactions"
        hover
      >
        <!-- Date formatting -->
        <template v-slot:item.created_at="{ item }">
          <div class="d-flex flex-column">
              <span class="font-weight-medium">{{ formatDate(item.created_at) }}</span>
              <span class="text-overline opacity-40">{{ formatTime(item.created_at) }}</span>
          </div>
        </template>
        
        <!-- Account tag -->
        <template v-slot:item.WalletAccount="{ item }">
          <v-chip size="small" variant="tonal" :color="getAccountTypeColor(item.WalletAccount?.account_type)" density="compact" class="font-weight-bold px-3">
              <v-icon start size="x-small">{{ getAccountIcon(item.WalletAccount?.account_type) }}</v-icon>
              {{ item.WalletAccount?.name }}
          </v-chip>
        </template>

        <!-- Transaction Type -->
        <template v-slot:item.type="{ item }">
           <v-chip :color="getTypeColor(item.type)" size="x-small" label class="text-uppercase font-weight-black">
             {{ item.type }}
           </v-chip>
        </template>

        <!-- Amount with direction -->
        <template v-slot:item.amount="{ item }">
          <div class="text-right d-flex flex-column">
              <span :class="item.direction === 'In' ? 'text-success font-weight-black' : 'text-error font-weight-black'">
                {{ item.direction === 'In' ? '+' : '-' }} AED {{ parseFloat(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </span>
              <span class="text-overline opacity-30">{{ item.direction === 'In' ? 'INFLOW' : 'OUTFLOW' }}</span>
          </div>
        </template>

        <!-- Reference Logic -->
        <template v-slot:item.reference="{ item }">
           <v-btn 
            v-if="item.reference_id" 
            variant="tonal" 
            size="x-small" 
            color="primary" 
            class="px-3 rounded-pill"
            :to="getReferenceRoute(item)"
           >
             {{ item.reference_type }} #{{ item.reference_id }}
           </v-btn>
           <span v-else class="text-caption opacity-40 italic font-mono px-2">SYSTEM_ENTRY</span>
           <DocumentExport v-if="item.reference_type === 'Invoice' && item.type === 'Income' && item.direction === 'In'" :record-id="item.id" :types="['receipt']" label="Receipt PDF" />
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Transfer Dialog Component -->
    <TransferDialog
      v-model="showTransferDialog"
      :accounts="walletStore.accounts"
      @success="onTransferSuccess"
    />

    <!-- Add / Edit Wallet Dialog -->
    <v-dialog v-model="walletDialog" max-width="550px">
      <v-card class="rounded-xl border">
        <v-toolbar color="surface" flat border-b>
          <v-toolbar-title class="font-weight-bold">{{ editingWallet ? 'Edit Wallet' : 'Add Wallet' }}</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="walletDialog = false"></v-btn>
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-form ref="walletForm" v-model="walletFormValid" @submit.prevent="saveWallet">
            <!-- Account Type Selector -->
            <div class="text-caption font-weight-bold opacity-60 mb-2 ml-1">Account Type *</div>
            <v-btn-toggle
              v-model="walletData.account_type"
              mandatory
              density="comfortable"
              divided
              variant="outlined"
              color="primary"
              class="mb-4 w-100"
            >
              <v-btn value="Cash" class="flex-grow-1">
                <v-icon start size="small">mdi-cash-multiple</v-icon> Cash
              </v-btn>
              <v-btn value="Debit" class="flex-grow-1">
                <v-icon start size="small">mdi-bank</v-icon> Debit Card
              </v-btn>
              <v-btn value="Credit" class="flex-grow-1">
                <v-icon start size="small">mdi-credit-card-outline</v-icon> Credit Card
              </v-btn>
            </v-btn-toggle>

            <v-combobox
              v-if="walletData.account_type === 'Debit' || walletData.account_type === 'Credit'"
              v-model="walletData.name"
              :items="uaeBanks"
              item-title="title"
              item-value="value"
              :return-object="false"
              label="Bank Name *"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Bank Name is required']"
              hint="Select a bank or type a custom name"
              required
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                  <template v-slot:prepend>
                    <v-avatar size="30" class="mr-3 border bg-white" rounded style="padding: 2px;">
                      <v-img v-if="item.raw.logo" :src="item.raw.logo" contain></v-img>
                      <v-icon v-else>mdi-bank</v-icon>
                    </v-avatar>
                  </template>
                </v-list-item>
              </template>
            </v-combobox>

            <v-text-field
              v-else
              v-model="walletData.name"
              label="Wallet Name *"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Name is required']"
              required
            ></v-text-field>

            <v-text-field
              v-model="walletData.description"
              label="Description (Optional)"
              variant="outlined"
              density="comfortable"
              class="mt-2"
            ></v-text-field>

            <!-- Opening Balance (Cash & Debit only) -->
            <v-text-field
              v-if="!editingWallet && walletData.account_type !== 'Credit'"
              v-model.number="walletData.opening_balance"
              label="Opening Balance (Optional)"
              type="number"
              min="0"
              step="0.01"
              variant="outlined"
              density="comfortable"
              class="mt-2"
              prefix="AED"
            ></v-text-field>

            <!-- Credit Card Specific Fields -->
            <v-expand-transition>
              <div v-if="walletData.account_type === 'Credit'" class="mt-4">
                <v-divider class="mb-4"></v-divider>
                <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center">
                  <v-icon size="small" color="error" class="mr-2">mdi-credit-card-settings-outline</v-icon>
                  Credit Card Settings
                </div>

                <v-text-field
                  v-model.number="walletData.credit_limit"
                  label="Credit Limit *"
                  type="number"
                  min="1"
                  step="0.01"
                  variant="outlined"
                  density="comfortable"
                  prefix="AED"
                  :rules="[v => (!!v && v > 0) || 'Credit limit is required']"
                ></v-text-field>

                <v-row dense class="mt-2">
                  <v-col cols="6">
                    <v-select
                      v-model.number="walletData.bill_day"
                      :items="dayOptions"
                      label="Billing Day *"
                      variant="outlined"
                      density="comfortable"
                      :rules="[v => !!v || 'Required']"
                      hint="Day of the month the bill is generated"
                      persistent-hint
                    ></v-select>
                  </v-col>
                  <v-col cols="6">
                    <v-select
                      v-model.number="walletData.due_day"
                      :items="dayOptions"
                      label="Due Day *"
                      variant="outlined"
                      density="comfortable"
                      :rules="[v => !!v || 'Required']"
                      hint="Day of the month payment is due"
                      persistent-hint
                    ></v-select>
                  </v-col>
                </v-row>

                <!-- Cycle Preview -->
                <v-alert v-if="walletData.bill_day && walletData.due_day" type="info" variant="tonal" density="compact" class="mt-4 text-caption">
                  <strong>Billing Cycle Preview:</strong> Purchases up to the <strong>{{ ordinal(walletData.bill_day) }}</strong> of each month will be due on the 
                  <strong>{{ ordinal(walletData.due_day) }}</strong> of
                  {{ walletData.due_day >= walletData.bill_day ? 'the same month' : 'the following month' }}.
                </v-alert>
              </div>
            </v-expand-transition>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-4 border-t">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="walletDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" class="px-6" @click="saveWallet" :loading="walletSaving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="successSnackbar" color="success" timeout="3000" location="top" variant="flat">
       <v-icon start icon="mdi-check-circle-outline"></v-icon>
       {{ snackbarMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { useUIStore } from '~/stores/ui'

const uiStore = useUIStore()
import { computed, ref, onMounted, watch } from 'vue';
import { useWalletStore } from '@/stores/wallet';
import { useAuthStore } from '@/stores/auth';
import TransferDialog from '@/components/wallet/TransferDialog.vue';
import dayjs from 'dayjs';

const walletStore = useWalletStore();
const auth = useAuthStore();
const showTransferDialog = ref(false);
const successSnackbar = ref(false);
const snackbarMessage = ref('');
const search = ref('');
const itemsPerPage = ref(10);
const accountFilter = ref(null);
const ledgerPage = ref(1);
const ledgerWalletOptions = computed(() => [
  { title: 'All wallets', value: null },
  ...walletStore.accounts.map(account => ({ title: account.name, value: account.id }))
]);

const walletDialog = ref(false);
const editingWallet = ref(null);
const walletSaving = ref(false);
const walletFormValid = ref(false);
const walletForm = ref(null);
const walletData = ref({ 
  name: '', 
  description: '', 
  account_type: 'Cash',
  opening_balance: 0,
  credit_limit: null,
  bill_day: null,
  due_day: null
});

// Generate day options 1-31
const dayOptions = Array.from({ length: 31 }, (_, i) => ({
  title: `${i + 1}${ordinal(i + 1).replace(String(i + 1), '')}`,
  value: i + 1
}));

const uaeBanks = [
  { title: 'Habib Bank AG Zurich', value: 'Habib Bank AG Zurich', logo: '/banks/Habib Bank.jpeg' },
  { title: 'Ruya Bank', value: 'Ruya Bank', logo: '/banks/Ruya Bank.jpeg' },
  { title: 'Al Maryah Community Bank', value: 'Al Maryah Community Bank', logo: '/banks/Maryah Bank.jpeg' },
  { title: 'Wio Bank', value: 'Wio Bank', logo: '/banks/Wio Bank.jpeg' },
  { title: 'Bank of Baroda', value: 'Bank of Baroda', logo: '/banks/Bank of Baroda.jpeg' },
  { title: 'Citi Bank', value: 'Citi Bank', logo: '/banks/Citi Bank.jpeg' },
  { title: 'Al Hilal Bank', value: 'Al Hilal Bank', logo: '/banks/Hilal Bank.jpeg' },
  { title: 'Ajman Bank', value: 'Ajman Bank', logo: '/banks/Ajman Bank.jpeg' },
  { title: 'National Bank of Fujairah (NBF)', value: 'National Bank of Fujairah (NBF)', logo: '/banks/NBF.jpeg' },
  { title: 'HSBC', value: 'HSBC', logo: '/banks/HSBC.jpeg' },
  { title: 'RAKBANK', value: 'RAKBANK', logo: '/banks/Rak Bank.jpeg' },
  { title: 'Sharjah Islamic Bank (SIB)', value: 'Sharjah Islamic Bank (SIB)', logo: '/banks/SIB.jpeg' },
  { title: 'Standard Chartered', value: 'Standard Chartered', logo: '/banks/Standard Chartered.jpeg' },
  { title: 'Abu Dhabi Islamic Bank (ADIB)', value: 'Abu Dhabi Islamic Bank (ADIB)', logo: '/banks/ADIB.jpeg' },
  { title: 'Commercial Bank of Dubai (CBD)', value: 'Commercial Bank of Dubai (CBD)', logo: '/banks/CBD.jpeg' },
  { title: 'Dubai Islamic Bank (DIB)', value: 'Dubai Islamic Bank (DIB)', logo: '/banks/DIB.jpeg' },
  { title: 'Emirates Islamic', value: 'Emirates Islamic', logo: '/banks/Emirates Islamic.jpeg' },
  { title: 'Mashreq Bank', value: 'Mashreq Bank', logo: '/banks/Mashreq.jpeg' },
  { title: 'Abu Dhabi Commercial Bank (ADCB)', value: 'Abu Dhabi Commercial Bank (ADCB)', logo: '/banks/ADCB.jpeg' },
  { title: 'Emirates NBD', value: 'Emirates NBD', logo: '/banks/Emirates NBD.jpeg' },
  { title: 'First Abu Dhabi Bank (FAB)', value: 'First Abu Dhabi Bank (FAB)', logo: '/banks/FAB.jpeg' },
  { title: 'Other', value: 'Other', logo: '/banks/OTHER.png' }
];

const getBankLogo = (accountName) => {
  if (!accountName) return null;
  const lowerName = accountName.toLowerCase();
  const match = uaeBanks.find(b => {
    const title = b.title.toLowerCase();
    if (lowerName.startsWith(title)) return true;
    if (title.includes('(')) {
      const abbr = title.split('(')[1].replace(')', '').trim();
      if (lowerName.startsWith(abbr)) return true;
    }
    return false;
  });
  return match ? match.logo : null;
};

const headers = [
  { title: 'Date / Time', key: 'created_at', sortable: false },
  { title: 'Account', key: 'WalletAccount', sortable: false },
  { title: 'Type', key: 'type', sortable: false },
  { title: 'Description', key: 'description', sortable: false },
  { title: 'Amount (AED)', key: 'amount', sortable: false, align: 'end' },
  { title: 'Source Reference', key: 'reference', sortable: false, align: 'end' }
];

// Summary Statistics Computation
const summaryStats = computed(() => {
    let cash = 0;
    let debit = 0;
    let credit = 0;
    walletStore.accounts.forEach(acc => {
        const bal = parseFloat(acc.balance || 0);
        if (acc.account_type === 'Cash') cash += bal;
        else if (acc.account_type === 'Debit') debit += bal;
        else if (acc.account_type === 'Credit') credit += parseFloat(acc.outstanding_balance || 0);
    });
    return { cash, debit, credit, net_worth: cash + debit - credit };
});

onMounted(() => {
  walletStore.fetchAccounts();
  walletStore.fetchSummary();
});

const loadTransactions = ({ page, itemsPerPage }) => {
  walletStore.fetchTransactions({
    page,
    limit: itemsPerPage,
    search: search.value,
    account_id: accountFilter.value
  });
};

watch([search, accountFilter], () => {
    // A page change triggers the table's options event; otherwise refresh directly.
    if (ledgerPage.value !== 1) ledgerPage.value = 1;
    else loadTransactions({ page: 1, itemsPerPage: itemsPerPage.value });
});

const filterByAccount = (id) => {
    accountFilter.value = id;
};

const onTransferSuccess = () => {
  snackbarMessage.value = 'Internal transfer completed successfully.';
  successSnackbar.value = true;
  loadTransactions({ page: 1, itemsPerPage: itemsPerPage.value });
};

const openAddWallet = () => {
  editingWallet.value = null;
  walletData.value = { 
    name: '', 
    description: '', 
    account_type: 'Cash',
    opening_balance: 0,
    credit_limit: null,
    bill_day: null,
    due_day: null
  };
  walletDialog.value = true;
};

const openEditWallet = (account) => {
  editingWallet.value = account;
  walletData.value = { 
    name: account.name, 
    description: account.description || '',
    account_type: account.account_type || 'Cash',
    credit_limit: account.credit_limit || null,
    bill_day: account.bill_day || null,
    due_day: account.due_day || null
  };
  walletDialog.value = true;
};

const saveWallet = async () => {
  const { valid } = await walletForm.value.validate();
  if (!valid) return;

  walletSaving.value = true;
  try {
    const payload = { ...walletData.value };
    let res;
    if (editingWallet.value) {
      res = await walletStore.updateAccount(editingWallet.value.id, payload);
    } else {
      res = await walletStore.createAccount(payload);
    }

    if (res.success) {
      snackbarMessage.value = editingWallet.value ? 'Wallet updated successfully.' : 'Wallet created successfully.';
      successSnackbar.value = true;
      walletDialog.value = false;
    } else {
      uiStore.showError(res.message || 'Failed to save wallet');
    }
  } catch (error) {
    console.error(error);
  } finally {
    walletSaving.value = false;
  }
};

const creditUsagePercent = (account) => {
  const limit = parseFloat(account.credit_limit || 1);
  const outstanding = parseFloat(account.outstanding_balance || 0);
  return Math.min(100, (outstanding / limit) * 100);
};

const billPaymentPercent = (account) => {
  const total = parseFloat(account.total_billed || 0);
  if (total === 0) return 100;
  const paid = parseFloat(account.paid_toward_bill || 0);
  return Math.min(100, (paid / total) * 100);
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const formatDate = (date) => {
  if (!date) return '—';
  return dayjs(date).format('DD MMM YYYY');
};
const formatTime = (date) => dayjs(date).format('hh:mm A');

const getTypeColor = (type) => {
  switch (type) {
    case 'Income': return 'success';
    case 'Expense': return 'error';
    case 'Transfer': return 'info';
    case 'Manual': return 'grey-darken-1';
    default: return 'grey';
  }
};

const getAccountTypeColor = (type) => {
  switch (type) {
    case 'Cash': return 'primary';
    case 'Debit': return 'secondary';
    case 'Credit': return 'error';
    default: return 'primary';
  }
};

const getAccountIcon = (type) => {
  switch (type) {
    case 'Cash': return 'mdi-cash-multiple';
    case 'Debit': return 'mdi-bank';
    case 'Credit': return 'mdi-credit-card-outline';
    default: return 'mdi-wallet';
  }
};

const getReferenceRoute = (item) => {
    if (item.reference_type === 'Invoice') return `/invoices`;
    if (item.reference_type === 'Expense') return `/expenses`;
    return null;
};
</script>

<style scoped>
.ledger-toolbar {
  height: auto !important;
}
.ledger-toolbar :deep(.v-toolbar__content) {
  height: auto !important;
  min-height: 64px;
  flex-wrap: wrap;
  gap: 12px;
  padding-block: 12px;
}
.ledger-wallet-filter {
  flex: 0 1 220px;
  min-width: 180px;
}
.max-width-300 {
  max-width: 300px;
}
.account-card {
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
    cursor: default;
}
.account-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 12px 32px -4px rgba(0,0,0,0.12) !important;
}
.account-icon-wrapper-small {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.card-glow {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
}
</style>
