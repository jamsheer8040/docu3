import { defineStore } from 'pinia';
import { normalizeBetaColors, resolveThemeName } from '~/utils/themes';

export const useConfigStore = defineStore('config', {
  state: () => ({
    settings: {
      app_name: 'DocClear',
      app_logo: '',
      license_expiry_date: null,
      is_tax_enabled: false,
      tax_registration_number: '',
      wallet_deduction_point: 'invoice_creation',
      theme_name: 'sage',
      commission_enabled: true
    },
    loading: false
  }),

  getters: {
    commissionEnabled: state => ![false, 'false', 0, '0'].includes(state.settings.commission_enabled),
    appName: (state) => state.settings.app_name || 'DocClear',
    appLogo: (state) => state.settings.app_logo || null,
    isExpired: (state) => {
      if (!state.settings.license_expiry_date) return false;
      return new Date() > new Date(state.settings.license_expiry_date);
    },
    isTaxEnabled: (state) => state.settings.is_tax_enabled === 'true' || state.settings.is_tax_enabled === true,
    taxRegistrationNumber: (state) => state.settings.tax_registration_number || '',
    invoiceDocumentType: (state) => {
      const enabled = state.settings.is_tax_enabled ?? state.settings.tax_global_config?.is_tax_enabled;
      const registration = state.settings.tax_registration_number ?? state.settings.tax_global_config?.tax_registration_number;
      const registered = (typeof registration === 'string' || (typeof registration === 'number' && Number.isFinite(registration))) && String(registration).trim();
      return (enabled === true || enabled === 'true') && registered ? 'tax_invoice' : 'invoice';
    },
    walletDeductionPoint: (state) => state.settings.wallet_deduction_point || 'invoice_creation',
    themeName: (state) => resolveThemeName(state.settings.theme_name),
    betaThemeColors: (state) => normalizeBetaColors(state.settings.beta_theme_colors)
  },

  actions: {
    async fetchSettings() {
      this.loading = true;
      try {
        const { $api } = useNuxtApp();
        const config = useRuntimeConfig();
        const baseUrl = config.public.apiBase.replace('/api/v1', '');
        
        const res = await $api.get('/config');
        if (res.data.success) {
          const data = res.data.data;
          
          // Resolve Logo URL
          if (data.app_logo && !data.app_logo.startsWith('http')) {
            data.app_logo = `${baseUrl}${data.app_logo}`;
          }
          
          this.settings = data;
        }
      } catch (err) {
        console.error('[Config Store] Failed to fetch settings:', err);
      } finally {
        this.loading = false;
      }
    }
  }
});
