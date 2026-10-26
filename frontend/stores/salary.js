import { defineStore } from 'pinia';

export const useSalaryStore = defineStore('salary', {
  state: () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const defaultMonth = `${yyyy}-${mm}`;

    return {
      currentMonth: defaultMonth,
      monthData: {
        isBooked: false,
        payroll: null,
        staffPreview: [],
        suggestedBookingDate: '',
        estimatedTotal: 0
      },
      summary: {
        operational: { total: 0, paid: 0, pending: 0 },
        salary: { total: 0, paid: 0, pending: 0 },
        combined: { total: 0, paid: 0, pending: 0 }
      },
      paymentHistory: [],
      historyLoading: false,
      loading: false,
      error: null
    };
  },

  getters: {
    isBooked: (state) => !!state.monthData?.isBooked,
    payroll: (state) => state.monthData?.payroll || null,
    items: (state) => state.monthData?.payroll?.Items || [],
    staffPreview: (state) => state.monthData?.staffPreview || [],
    monthTotals: (state) => {
      if (state.monthData?.isBooked && state.monthData?.payroll) {
        const p = state.monthData.payroll;
        const total = parseFloat(p.total_amount || 0);
        const paid = parseFloat(p.paid_amount || 0);
        const pending = Math.max(0, total - paid);
        const count = p.Items?.length || 0;
        return { total, paid, pending, count, status: p.status };
      }
      return {
        total: state.monthData?.estimatedTotal || 0,
        paid: 0,
        pending: state.monthData?.estimatedTotal || 0,
        count: state.monthData?.staffPreview?.length || 0,
        status: 'Not Booked'
      };
    }
  },

  actions: {
    async fetchSummary(month = null) {
      try {
        const { $api } = useNuxtApp();
        const targetMonth = month || this.currentMonth;
        const response = await $api.get('/salaries/summary', {
          params: { month: targetMonth }
        });
        if (response.data?.success) {
          this.summary = response.data.data;
        }
      } catch (err) {
        console.error('Failed to fetch salary summary:', err);
      }
    },

    async fetchMonthPayroll(month = null) {
      if (month) this.currentMonth = month;
      this.loading = true;
      this.error = null;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get(`/salaries/month/${this.currentMonth}`);
        if (response.data?.success) {
          this.monthData = response.data;
        }
        await this.fetchSummary(this.currentMonth);
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to fetch monthly payroll';
      } finally {
        this.loading = false;
      }
    },

    async bookMonthSalary(payload) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/salaries/book', {
          month: this.currentMonth,
          ...payload
        });
        if (response.data?.success) {
          await this.fetchMonthPayroll(this.currentMonth);
          return response.data;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to book salary';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async paySingleSalary(payload) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/salaries/pay-single', payload);
        if (response.data?.success) {
          await this.fetchMonthPayroll(this.currentMonth);
          return response.data;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to pay salary';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async payBatchSalary(payload) {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/salaries/pay-batch', payload);
        if (response.data?.success) {
          await this.fetchMonthPayroll(this.currentMonth);
          return response.data;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to execute batch transfer';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async unbookMonthSalary(month = null) {
      const targetMonth = month || this.currentMonth;
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.delete(`/salaries/month/${targetMonth}`);
        if (response.data?.success) {
          await this.fetchMonthPayroll(targetMonth);
          return response.data;
        }
      } catch (err) {
        this.error = err.response?.data?.message || 'Failed to unbook salary';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchPaymentHistory(salaryItemId) {
      this.historyLoading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get(`/salaries/items/${salaryItemId}/payments`);
        if (response.data?.success) {
          this.paymentHistory = response.data.data;
          return response.data.data;
        }
      } catch (err) {
        console.error('Failed to fetch payment history:', err);
      } finally {
        this.historyLoading = false;
      }
    }
  }
});
