import { defineStore } from 'pinia';

import { getBankLogo } from '~/utils/banks';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    accounts: [],
    transactions: [],
    meta: {
      total: 0,
      page: 1,
      last_page: 1
    },
    loading: false,
    summary: {
      cash_total: 0,
      debit_total: 0,
      credit_outstanding: 0,
      total_balance: 0,
      net_worth: 0
    }
  }),
  getters: {
    cashAccounts: (state) => state.accounts.filter(a => a.account_type === 'Cash'),
    debitAccounts: (state) => state.accounts.filter(a => a.account_type === 'Debit'),
    creditAccounts: (state) => state.accounts.filter(a => a.account_type === 'Credit'),
    // For dropdowns that need non-credit accounts (e.g., receiving payments)
    nonCreditAccounts: (state) => state.accounts.filter(a => a.account_type !== 'Credit')
  },
  actions: {
    async fetchAccounts() {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/wallet/accounts');
        if (response.data.success) {
          this.accounts = response.data.data.map(account => {
            account.logo_url = getBankLogo(account.name);
            return account;
          });
        }
      } finally {
        this.loading = false;
      }
    },
    async fetchSummary() {
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/wallet/summary');
        if (response.data.success) {
          this.summary = response.data.data;
        }
      } catch (err) {}
    },
    async fetchTransactions(params = {}) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/wallet/transactions', { params });
        if (response.data.success) {
          this.transactions = response.data.data;
          this.meta = response.data.meta;
        }
      } finally {
        this.loading = false;
      }
    },
    async performTransfer(transferData) {
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/wallet/transfer', transferData);
        if (response.data.success) {
          await this.fetchAccounts();
          await this.fetchSummary();
          return { success: true };
        }
        return { success: false, message: response.data.message };
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Transfer failed' };
      }
    },
    async createAccount(data) {
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/wallet/accounts', data);
        if (response.data.success) {
          await this.fetchAccounts();
          return { success: true };
        }
        return { success: false, message: response.data.message };
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Failed to create account' };
      }
    },
    async updateAccount(id, data) {
      try {
        const { $api } = useNuxtApp();
        const response = await $api.put(`/wallet/accounts/${id}`, data);
        if (response.data.success) {
          await this.fetchAccounts();
          return { success: true };
        }
        return { success: false, message: response.data.message };
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Failed to update account' };
      }
    }
  }
});
