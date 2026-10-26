import { defineStore } from 'pinia';

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    stats: {
      total_customers: 0,
      total_suppliers: 0,
      active_customers: 0,
      active_documents: 0,
      expiring_soon: 0,
      critical_count: 0,
      monthly_revenue: 0,
      monthly_receivable: 0,
      monthly_cost: 0,
      monthly_profit: 0,
      active_service_orders: 0,
      aged_invoices: 0,
      service_overview: {
        'Pending': 0,
        'In Progress': 0,
        'CompletedInvoicePending': 0,
        'CompletedInvoiceCreated': 0,
        'Cancelled': 0
      },
      wallet_balances: []
    },
    recentActivity: {
      recent_invoices: [],
      expiring_documents: [],
      recent_services: []
    },
    loading: false,
    statsRequest: 0,
    error: null
  }),

  actions: {
    async fetchStats(params = {}) {
      const request = ++this.statsRequest;
      this.loading = true;
      this.error = null;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/dashboard/stats', { params });
        if (request === this.statsRequest && response.data?.success) {
          this.stats = response.data.data;
        }
      } catch (err) {
        if (request === this.statsRequest) this.error = err.response?.data?.message || 'Failed to fetch dashboard statistics';
      } finally {
        if (request === this.statsRequest) this.loading = false;
      }
    },

    async fetchRecentActivity() {
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/dashboard/recent-activity');
        if (response.data?.success) {
          this.recentActivity = response.data.data;
        }
      } catch (err) {
        console.error('Recent activity fetch failed', err);
      }
    }
  }
});
