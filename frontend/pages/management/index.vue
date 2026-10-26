<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6 align-center">
      <v-col cols="12" md="6">
        <h1 class="text-h4 font-weight-bold color-primary">
          <v-icon icon="mdi-briefcase-account" class="mr-2" color="primary"></v-icon>
          Management
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">Shareholders, Capital & Dividends</p>
      </v-col>
    </v-row>

    <!-- Tabs -->
    <v-row class="mb-6">
      <v-col cols="12">
        <v-tabs v-model="activeTab" color="primary" class="bg-white rounded-xl border" grow>
          <v-tab value="dashboard" prepend-icon="mdi-view-dashboard" class="font-weight-bold text-none">Overview</v-tab>
          <v-tab value="shareholders" prepend-icon="mdi-account-group" class="font-weight-bold text-none">Shareholders</v-tab>
          <v-tab value="capital" prepend-icon="mdi-bank-transfer" class="font-weight-bold text-none">Capital Transactions</v-tab>
          <v-tab value="dividends" prepend-icon="mdi-chart-pie" class="font-weight-bold text-none">Dividends</v-tab>
          <v-tab v-if="auth.can('settings', 'write')" value="setup" prepend-icon="mdi-cog" class="font-weight-bold text-none">Setup</v-tab>
        </v-tabs>
      </v-col>
    </v-row>

    <v-alert v-if="management.refreshWarning" type="warning" class="mb-4">{{ management.refreshWarning }}</v-alert>
    <v-alert v-else-if="management.error" type="error" class="mb-4">{{ management.error }}</v-alert>
    <!-- Tab Content -->
    <v-window v-model="activeTab" class="bg-transparent" style="overflow: visible;">
      <!-- DASHBOARD -->
      <v-window-item value="dashboard">
        <ManagementDashboard v-if="activeTab === 'dashboard'" />
      </v-window-item>

      <!-- SHAREHOLDERS -->
      <v-window-item value="shareholders">
        <ManagementShareholders v-if="activeTab === 'shareholders'" />
      </v-window-item>

      <!-- CAPITAL TRANSACTIONS -->
      <v-window-item value="capital">
        <ManagementCapital v-if="activeTab === 'capital'" />
      </v-window-item>

      <!-- DIVIDENDS -->
      <v-window-item value="dividends">
        <ManagementDividends v-if="activeTab === 'dividends'" />
      </v-window-item>

      <!-- SETUP -->
      <v-window-item value="setup">
        <ManagementSetup v-if="activeTab === 'setup' && auth.can('settings', 'write')" />
      </v-window-item>
    </v-window>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useManagementStore } from '~/stores/management';
const auth = useAuthStore();
const management = useManagementStore();

const activeTab = ref('dashboard');
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(10px);
}
</style>
