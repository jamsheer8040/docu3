import { defineStore } from 'pinia'


function requestConfig(data) {
  if (!data._requestKey) Object.defineProperty(data, '_requestKey', { value: globalThis.crypto.randomUUID?.() || Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join(''), configurable: true });
  return { headers: { 'Idempotency-Key': data._requestKey } };
}
export const useManagementStore = defineStore('management', {
  state: () => ({
    dashboardStats: null,
    shareholders: [],
    capitalTransactions: [],
    dividends: [],
    loading: false,
    error: null,
    refreshWarning: null
  }),

  actions: {
    async refreshAfterSave(refreshers) {
      const results = await Promise.allSettled(refreshers.map(refresh => refresh()));
      this.refreshWarning = results.some(result => result.status === 'rejected')
        ? 'Saved successfully, but the latest data could not be loaded. Refresh the page; do not submit again.' : null;
    },
    async fetchDashboardStats() {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.get('/management/dashboard')
        this.dashboardStats = response.data.data
        return this.dashboardStats
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch dashboard stats'
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchShareholders() {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.get('/management/shareholders')
        this.shareholders = response.data.data
        return this.shareholders
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch shareholders'
        throw error
      } finally {
        this.loading = false
      }
    },

    async createShareholder(data) {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.post('/management/shareholders', data, requestConfig(data))
        await this.refreshAfterSave([() => this.fetchShareholders()])
        return response.data.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateShareholder(id, data) {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.put(`/management/shareholders/${id}`, data, requestConfig(data))
        await this.refreshAfterSave([() => this.fetchShareholders()])
        return response.data.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchCapitalTransactions() {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.get('/management/capital-transactions')
        this.capitalTransactions = response.data.data
        return this.capitalTransactions
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch capital transactions'
        throw error
      } finally {
        this.loading = false
      }
    },

    async createCapitalTransaction(data) {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.post('/management/capital-transactions', data, requestConfig(data))
        await this.refreshAfterSave([() => this.fetchCapitalTransactions(), () => this.fetchShareholders()])
        return response.data.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchDividends() {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.get('/management/dividends')
        this.dividends = response.data.data
        return this.dividends
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch dividends'
        throw error
      } finally {
        this.loading = false
      }
    },

    async declareDividend(data) {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.post('/management/dividends', data, requestConfig(data))
        await this.refreshAfterSave([() => this.fetchDividends()])
        return response.data.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async payDividend(data) {
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const response = await $api.post('/management/dividends/pay', data, requestConfig(data))
        await this.refreshAfterSave([() => this.fetchDividends()])
        return response.data.data
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})
