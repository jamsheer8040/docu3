import { betaThemeDefaults } from './utils/themes.js';
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2024-11-01',
  css: ['~/assets/css/main.css', '~/assets/css/typography.css'],
  devtools: { enabled: true },
  modules: [
    'vuetify-nuxt-module',
    '@pinia/nuxt',
  ],
  vuetify: {
    vuetifyOptions: {
      theme: {
        defaultTheme: 'sage',
        themes: {
          light: {
            colors: {
              primary: '#3B82F6',
              secondary: '#A3AED0',
              background: '#F4F7FE',
              surface: '#FFFFFF',
              'on-surface': '#2B3674',
              success: '#05CD99',
              warning: '#FFCE20',
              error: '#EE5D50',
            },
          },
          white: {
            colors: {
              primary: '#111827',
              secondary: '#6B7280',
              background: '#FFFFFF', /* Pure white canvas */
              surface: '#F3F4F6',    /* Light grey cards/forms */
              'on-surface': '#111827',
              success: '#10B981',
              warning: '#F59E0B',
              error: '#EF4444',
            },
          },
          sage: {
            dark: false,
            colors: {
              ...betaThemeDefaults,
              'on-background': betaThemeDefaults['on-surface'],
              success: '#47856B',
              warning: '#B88C42',
              error: '#C56969',
            },
          },
          classic: {
            colors: {
              primary: '#4F4294',
              secondary: '#6554C0',
              background: '#F8F9FD',
              surface: '#FFFFFF',
              'on-surface': '#1e293b',
              success: '#10b981',
              warning: '#f59e0b',
              error: '#f43f5e',
            },
          }
        },
      },
      defaults: {
        VCard: {
          rounded: 'xl', /* Translates to roughly 20-24px */
          elevation: 0,
          variant: 'flat',
        },
        VBtn: {
          rounded: 'lg',
          fontWeight: '600',
          textTransform: 'none',
          elevation: 0,
        },
        VTextField: {
          variant: 'outlined',
          rounded: 'lg',
          color: 'primary',
          density: 'comfortable',
          bgColor: '#FFFFFF',
        },
        VSelect: {
          variant: 'outlined',
          rounded: 'lg',
          color: 'primary',
          density: 'comfortable',
          bgColor: '#FFFFFF',
        },
        VAlert: {
          rounded: 'lg',
          variant: 'flat',
        }
      }
    }
  },
  devServer: {
    host: process.env.NUXT_HOST || '127.0.0.2',
    port: parseInt(process.env.NUXT_PORT || '3000', 10)
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api/v1'
    }
  },
  nitro: {
    routeRules: {
      '/api/**': { proxy: `http://${process.env.BACKEND_HOST || '127.0.0.2'}:${process.env.BACKEND_PORT || '5000'}/api/**` },
      '/uploads/**': { proxy: `http://${process.env.BACKEND_HOST || '127.0.0.2'}:${process.env.BACKEND_PORT || '5000'}/uploads/**` }
    }
  },
  typescript: {
    strict: true
  }
})
