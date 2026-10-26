import { canAccess } from '~/utils/recordPermissions';
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('auth_user') || 'null') : null,
    token: typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null,
    activeCustomerFilter: typeof localStorage !== 'undefined' ? 
      (() => {
        try {
          const val = JSON.parse(localStorage.getItem('active_customer_filter') || '[]');
          return Array.isArray(val) ? val : (val ? [val] : []);
        } catch(e) {
          return [];
        }
      })() : [],
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    can: (state) => (module, action = 'read') => canAccess(state.user, module, action),
    canRecord: (state) => (module, action, record) => canAccess(state.user, module, action, record),
    isAdmin: (state) => state.user?.role?.toLowerCase() === 'admin',
    isDeveloper: (state) => state.user?.role === 'Developer',
    userName: (state) => state.user?.name || 'User',
    /** Returns comma-separated customer IDs string for API queries, or empty string if all selected */
    customerFilterParam: (state) => state.activeCustomerFilter.length > 0 ? state.activeCustomerFilter.join(',') : '',
  },
  actions: {
    async login(credentials) {
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/auth/login', credentials, { withCredentials: true });
        
        if (response.data.success) {
          const { token, user } = response.data.data;
          this.token = token;
          this.user = user;
          
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));
          }
          return { success: true };
        }
        return { success: false, message: response.data.message };
      } catch (error) {
        return { 
          success: false, 
          message: error.response?.data?.message || 'Login failed. Please check your credentials.' 
        };
      }
    },
    async fetchMe() {
      if (!this.token) return;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/auth/me');
        if (response.data.success) {
          this.user = response.data.data;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('auth_user', JSON.stringify(this.user));
          }
        }
      } catch (error) {
        this.logout();
      }
    },
    async logout() {
      this.user = null;
      this.token = null;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
      try {
        const { $api } = useNuxtApp();
        await $api.post('/auth/logout', {}, { withCredentials: true });
      } catch (e) {
        console.warn('Logout API call failed, but clearing local session.');
      }
      navigateTo('/login');
    },
    checkAuth() {
      if (!this.token) return false;
      return true;
    },
    setActiveCustomerFilter(customerIds) {
      this.activeCustomerFilter = Array.isArray(customerIds) ? customerIds : [];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('active_customer_filter', JSON.stringify(this.activeCustomerFilter));
      }
    }
  }
});
