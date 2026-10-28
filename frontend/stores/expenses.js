import { defineStore } from 'pinia';

export const useExpenseStore = defineStore('expenses', {
  state: () => ({
    expenses: [],
    loading: false,
    error: null,
    totalSpent: 0,
    totalPaid: 0,
    totalItems: 0
  }),

  actions: {
    async fetchExpenses(params = {}) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/expenses', { params });
        if (response.data?.success) {
          this.expenses = response.data.data;
          this.totalSpent = response.data.meta?.total_sum || 0;
          this.totalPaid = response.data.meta?.total_paid_sum || 0;
          this.totalItems = response.data.meta?.total || 0;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to fetch expenses';
      } finally {
        this.loading = false;
      }
    },

    async createExpense(data) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/expenses', data);
        if (response.data?.success) {
          await this.fetchExpenses();
          return response.data;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to create expense';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateExpense(id, data) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.put(`/expenses/${id}`, data);
        if (response.data?.success) {
          await this.fetchExpenses();
          return response.data;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to update expense';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async payExpense(id, accountId, paymentDate, amount = null) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.put(`/expenses/${id}/pay`, {
          account_id: accountId,
          payment_date: paymentDate,
          amount: amount
        });
        if (response.data?.success) {
          await this.fetchExpenses();
          return response.data;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to process payment';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async deleteExpense(id) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.delete(`/expenses/${id}`);
        if (response.data?.success) {
          await this.fetchExpenses();
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to delete expense';
        throw err;
      } finally {
        this.loading = false;
      }
    }
  }
});
