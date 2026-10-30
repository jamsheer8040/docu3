<template>
  <v-app class="bg-dreamy-gradient" :class="{ 'sage-shell': isSageShell, 'dashboard-typography': route.path === '/' }">
    <!-- Navigation Drawer (Sidebar) -->
    <v-navigation-drawer
      v-model="drawer"
      :permanent="$vuetify.display.mdAndUp && drawer"
      :temporary="$vuetify.display.smAndDown"
      elevation="0"
      border="0"
      width="250"
      class="bg-transparent"
      style="border-right: none !important;"
    >
      <div class="px-4 pt-4 pb-1 h-100 d-flex flex-column bg-transparent overflow-hidden">
          <div v-if="isSageShell" class="sage-brand">
            <NuxtLink to="/" class="sage-brand-home"><span class="sage-brand-mark"><v-icon icon="mdi-file-document" size="21" /></span><span>{{ configStore.appName }}</span></NuxtLink>
            <v-btn icon="mdi-chevron-double-left" size="small" variant="text" aria-label="Hide menu" title="Hide menu" @click="drawer = false" />
          </div>
          <div v-else class="d-flex flex-column align-center text-center cursor-pointer" @click="navigateTo('/')">
            <div v-if="configStore.appLogo" class="mb-2 d-flex align-center justify-center p-2" style="width: 100%; height: 80px;">
               <v-img 
                 :src="configStore.appLogo"
                 width="140"
                 height="70"
                 contain
                 style="mix-blend-mode: multiply;"
               ></v-img>
            </div>
            <v-avatar v-else color="primary" variant="flat" rounded="lg" size="56" class="mb-2">
              <v-icon icon="mdi-shield-crown" color="white" size="28"></v-icon>
            </v-avatar>
          </div>
        
        <div class="flex-grow-1 overflow-y-auto pr-1" style="scrollbar-width: thin; min-height: 0;">

        <v-list density="comfortable" nav class="pa-0 bg-transparent" @click="$vuetify.display.smAndDown ? (drawer = false) : null">
          <v-list-item
            v-if="authStore.can('dashboard')"
            prepend-icon="mdi-view-dashboard-outline"
            title="Dashboard"
            to="/"
            exact
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item
            v-if="authStore.can('customers')"
            prepend-icon="mdi-account-group-outline"
            title="Customers"
            to="/customers"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item
            v-if="authStore.can('leads')"
            prepend-icon="mdi-account-star-outline"
            title="Leads"
            to="/leads"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item v-if="authStore.can('suppliers')" prepend-icon="mdi-shopping-outline" title="Purchases" to="/purchases" color="primary" class="mb-2" />
          <v-list-item
            v-if="authStore.can('documents')"
            prepend-icon="mdi-file-document-outline"
            title="Documents"
            to="/documents"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item v-if="authStore.can('quotations')" prepend-icon="mdi-file-document-edit-outline" title="Quotations" to="/quotations" color="primary" class="mb-2" />
          <v-list-item
            v-if="authStore.can('sales_orders')"
            prepend-icon="mdi-handshake-outline"
            title="Sales Orders"
            to="/sales-orders"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item
            v-if="authStore.can('services')"
            prepend-icon="mdi-cog-outline"
            title="Services"
            to="/services"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item v-if="authStore.can('employee_tracking') && authStore.user?.role_type !== 'CustomerPortal'" prepend-icon="mdi-account-clock-outline" title="Employee Tracking" to="/employee-tracking" color="primary" class="mb-2" />
          <v-list-item
            v-if="authStore.can('invoices')"
            prepend-icon="mdi-receipt"
            title="Invoices"
            to="/invoices"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item
            v-if="authStore.can('expenses') || canAccessSalary(authStore.user)"
            prepend-icon="mdi-cash-remove"
            :title="authStore.can('expenses') ? 'Expenses' : 'Salary & Payroll'"
            :to="authStore.can('expenses') ? '/expenses' : '/expenses?tab=salary'"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item
            v-if="authStore.can('wallet')"
            prepend-icon="mdi-wallet-outline"
            title="Wallet"
            to="/wallet"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item
            v-if="authStore.can('management')"
            prepend-icon="mdi-briefcase-account-outline"
            title="Management"
            to="/management"
            color="primary"
            class="mb-2"
          ></v-list-item>
          <v-list-item v-if="configStore.commissionEnabled && authStore.can('commissions') && authStore.user?.role_type !== 'CustomerPortal'" prepend-icon="mdi-percent-circle-outline" title="Commissions" to="/commissions" color="primary" class="mb-2" />

          <v-list-item
            v-if="authStore.isAdmin || authStore.can('reports')"
            prepend-icon="mdi-chart-line"
            title="Reports & Analytics"
            to="/reports"
            color="primary"
            class="mb-2"
          ></v-list-item>

          <v-list-item
            v-if="authStore.isAdmin || authStore.can('tools')"
            prepend-icon="mdi-toolbox-outline"
            title="Tools"
            to="/tools"
            color="primary"
            class="mb-2"
          ></v-list-item>

          <v-list-item
            v-if="authStore.isAdmin || authStore.can('settings')"
            prepend-icon="mdi-cog-outline"
            title="Settings"
            to="/settings"
            color="primary"
            class="mb-2"
          ></v-list-item>
        </v-list>
        </div>
        
        <div class="sidebar-footer mt-auto flex-shrink-0 border-t pt-1">
          <!-- All Companies (moved from top bar) -->
          <div v-if="authStore.user?.role_type === 'CustomerPortal' && authStore.user?.LinkedCustomers?.length > 1" class="px-4 mb-1">
            <v-select
              v-model="authStore.activeCustomerFilter"
              :items="authStore.user.LinkedCustomers"
              item-title="name"
              item-value="id"
              label="All Companies"
              multiple
              chips
              closable-chips
              density="compact"
              hide-details
              variant="solo-filled"
              rounded="lg"
              flat
              class="bg-transparent"
              @update:modelValue="onCustomerFilterChange"
            ></v-select>
          </div>

          <!-- Bottom Icons -->
          <div class="d-flex align-center justify-center px-2" style="gap: 16px;">
            <!-- 1. Help Dialog -->
            <v-btn icon="mdi-help-circle-outline" variant="text" size="small" @click="helpDialog = true"></v-btn>

            <!-- 2. Notification Bell -->
            <v-menu v-if="authStore.user?.role_type !== 'CustomerPortal'" width="350" location="bottom end" offset="10">
              <template v-slot:activator="{ props }">
                <v-btn icon size="small" v-bind="props">
                  <v-badge :content="notificationCount" :model-value="notificationCount > 0" color="error" overlap>
                      <v-icon icon="mdi-bell-outline"></v-icon>
                  </v-badge>
                </v-btn>
              </template>
              <v-card class="glass-card overflow-hidden">
                <v-list lines="two" class="pa-0 bg-transparent">
                  <v-list-subheader class="font-weight-bold d-flex align-center pa-4 text-primary">
                      Notifications
                      <v-spacer></v-spacer>
                      <v-chip size="x-small" color="primary" variant="flat">{{ notificationCount }} New</v-chip>
                  </v-list-subheader>
                  <v-divider></v-divider>
                  
                  <template v-if="notifications.length > 0">
                      <v-list-item v-for="(note, i) in notifications" :key="i" :to="'/documents'" class="py-3">
                          <template v-slot:prepend>
                              <v-avatar :color="note.color" size="40" variant="tonal">
                                  <v-icon :icon="note.icon" size="22"></v-icon>
                              </v-avatar>
                          </template>
                          <v-list-item-title class="text-subtitle-2 font-weight-bold">{{ note.title }}</v-list-item-title>
                          <v-list-item-subtitle class="text-caption mt-1">{{ note.subtitle }}</v-list-item-subtitle>
                      </v-list-item>
                  </template>
                  <v-list-item v-else class="pa-10 text-center opacity-30">
                      <v-icon icon="mdi-bell-off-outline" size="48" class="mb-2"></v-icon>
                      <div class="text-subtitle-2">No new alerts</div>
                  </v-list-item>
                  
                  <v-divider></v-divider>
                  <v-btn block variant="text" size="small" class="text-none py-5" to="/documents">View All Tracking</v-btn>
                </v-list>
              </v-card>
            </v-menu>

            <!-- 3. User Dropdown Menu -->
            <v-menu width="260" location="bottom end" offset="10">
              <template v-slot:activator="{ props }">
                <v-avatar color="primary" variant="flat" size="36" class="cursor-pointer shadow-glow" v-bind="props">
                    <v-icon icon="mdi-account" color="white" size="20"></v-icon>
                </v-avatar>
              </template>
              <v-card class="glass-card overflow-hidden">
                <v-list class="pa-0 bg-transparent">
                  <v-list-item class="py-4 px-4 bg-primary text-white">
                    <template v-slot:prepend>
                      <v-avatar color="white" size="40">
                        <v-icon icon="mdi-account" color="primary"></v-icon>
                      </v-avatar>
                    </template>
                    <v-list-item-title class="font-weight-bold">{{ authStore.user?.email || 'Administrator' }}</v-list-item-title>
                    <v-list-item-subtitle class="text-white opacity-80 mt-1">{{ authStore.user?.role || 'Admin' }}</v-list-item-subtitle>
                  </v-list-item>
                  
                  <v-list-item to="/profile" prepend-icon="mdi-account-circle-outline" title="My Profile" class="py-3 font-weight-medium"></v-list-item>
                  <v-list-item v-if="authStore.can('settings')" to="/settings" prepend-icon="mdi-cog-outline" title="System Settings" class="py-3 font-weight-medium"></v-list-item>
                  
                  <v-divider></v-divider>
                  <v-list-item @click="logout" prepend-icon="mdi-logout" title="Logout" color="error" class="py-4 font-weight-bold text-error"></v-list-item>
                </v-list>
              </v-card>
            </v-menu>
          </div>
          
          <div class="text-center">
              <div class="text-overline text-grey opacity-60" style="font-size: calc(.6rem - var(--dashboard-font-reduction, 0px)) !important; line-height: 16px;">{{ configStore.appName }} v1.1.0</div>
          </div>
        </div>
      </div>
    </v-navigation-drawer>




    <!-- Help Dialog -->
    <v-dialog v-model="helpDialog" max-width="600px">
        <HelpDialog @close="helpDialog = false" />
    </v-dialog>

    <!-- Main Content -->
    <v-main>
      <div v-if="!drawer" class="px-4 pt-3"><v-btn variant="text" prepend-icon="mdi-menu" rounded="pill" aria-label="Show menu" @click="drawer = true">Show menu</v-btn></div>
      <v-container fluid class="pa-0">
        <!-- Tenant Status Banners -->
        <v-alert
          v-if="authStore.user?.Tenant?.status === 'new_registration'"
          type="info"
          variant="flat"
          class="rounded-0 text-center font-weight-bold"
        >
          Account Approval Pending. Our team will review and approve your account.
        </v-alert>

        <v-alert
          v-if="authStore.user?.Tenant?.status === 'trial'"
          type="primary"
          variant="flat"
          class="rounded-0 text-center font-weight-bold"
        >
          <div class="d-flex flex-column flex-md-row align-center justify-center gap-4">
            <span><strong>Status:</strong> TRIAL</span>
            <span><strong>Started:</strong> {{ authStore.user.Tenant.subscription_starts_at ? new Date(authStore.user.Tenant.subscription_starts_at).toLocaleDateString() : 'N/A' }}</span>
            <span><strong>Expires:</strong> {{ new Date(authStore.user.Tenant.trial_ends_at).toLocaleDateString() }}</span>
            <v-chip size="small" color="white" text-color="primary" class="font-weight-black ml-md-2">
              {{ Math.max(0, Math.ceil((new Date(authStore.user.Tenant.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))) }} Days Remaining
            </v-chip>
          </div>
        </v-alert>



        <v-alert
          v-if="authStore.user?.Tenant?.status === 'trial_expired'"
          type="error"
          variant="flat"
          class="rounded-0 text-center font-weight-bold"
        >
          Trial Period Expired (Read-Only Mode). Please contact support or select a subscription package to continue.
        </v-alert>

        <v-alert
          v-if="authStore.user?.Tenant?.status === 'expired'"
          type="error"
          variant="flat"
          class="rounded-0 text-center font-weight-bold"
        >
          Your subscription has expired (Read-Only Mode). Please renew your plan to restore full access.
        </v-alert>
        
        <v-alert
          v-if="['suspended', 'cancelled'].includes(authStore.user?.Tenant?.status)"
          type="error"
          variant="flat"
          class="rounded-0 text-center font-weight-bold"
        >
          Your organization has been suspended. Transactions are blocked.
        </v-alert>

        <slot />
      </v-container>
    </v-main>

    <!-- Global Notification (Snackbar) -->
    <v-snackbar
      v-model="uiStore.snackbar.show"
      :color="uiStore.snackbar.color"
      :timeout="4000"
      location="top right"
      variant="flat"
      elevation="24"
      class="mt-4"
    >
      <div class="d-flex align-center">
        <v-icon :icon="uiStore.snackbar.icon" class="mr-3"></v-icon>
        <span class="font-weight-medium">{{ uiStore.snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn icon="mdi-close" variant="text" @click="uiStore.hideSnackbar"></v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';
import { canAccessSalary } from '~/utils/recordPermissions';
import { useUIStore } from '~/stores/ui';
import { useConfigStore } from '~/stores/config';
import { useDocumentStore } from '~/stores/documents';
import HelpDialog from '~/components/common/HelpDialog.vue';

import { useDisplay } from 'vuetify';

const display = useDisplay();
const drawer = ref(!display.smAndDown.value);
const helpDialog = ref(false);
const route = useRoute();
const authStore = useAuthStore();
const configStore = useConfigStore();
const isSageShell = computed(() => configStore.themeName === 'sage');
provide('toggleDashboardNavigation', () => { drawer.value = !drawer.value; });
const uiStore = useUIStore();
const documentStore = useDocumentStore();

const onCustomerFilterChange = (val) => {
  authStore.setActiveCustomerFilter(val);
  window.location.reload();
};

onMounted(async () => {
    // Refresh the session before the optional-auth config endpoint reads tenant settings.
    // An expired token otherwise returns global defaults while protected requests refresh it.
    await authStore.fetchMe();
    // Fetch critical system/document data
    await Promise.all([
        configStore.fetchSettings(),
        documentStore.fetchExpiring()
    ]);
});

const notificationCount = computed(() => {
    return (documentStore.groupedDocs.expired?.length || 0) + 
           (documentStore.groupedDocs.critical?.length || 0);
});

const notifications = computed(() => {
    const list = [];
    
    if (documentStore.groupedDocs.expired?.length > 0) {
        list.push({
            title: `${documentStore.groupedDocs.expired.length} Expired Documents`,
            subtitle: 'Action required immediately for compliance.',
            icon: 'mdi-alert-octagon',
            color: 'error'
        });
    }
    
    if (documentStore.groupedDocs.critical?.length > 0) {
        list.push({
            title: `${documentStore.groupedDocs.critical.length} Critical Expiries`,
            subtitle: 'Expiring within the next 5 days.',
            icon: 'mdi-clock-alert',
            color: 'warning'
        });
    }
    
    return list;
});

const currentPageTitle = computed(() => {
  const titles = {
    'index': 'Dashboard Overview',
    'customers': 'Customer Management',
    'documents': 'Document Tracking',
    'services': 'Service Workflow',
    'invoices': 'Invoices & Billing',
    'expenses': 'Expense Tracking',
    'wallet': 'Wallet & Accounts',
    'reports': 'Reports & Analytics',
    'login': 'Login'
  };
  return titles[route.name] || configStore.appName;
});

const logout = () => {
  authStore.logout();
  navigateTo('/login');
};
</script>

<style>
.dashboard-typography { --dashboard-font-reduction: 1px; }
.dashboard-typography .v-navigation-drawer .v-list-item-title { font-size: calc(.8125rem - 1px); }
.dashboard-typography.sage-shell .v-navigation-drawer .v-list-item-title { font-size: 13px; }
.dashboard-typography.sage-shell .sage-brand { font-size: 21px; }
.dashboard-typography .v-navigation-drawer .text-overline { font-size: calc(.6rem - 1px) !important; }
.dashboard-typography .v-badge__badge { font-size: calc(.75rem - 1px); }
.v-theme--sage.sage-shell { --sage-background:radial-gradient(ellipse at 65% -30%,rgba(var(--v-theme-primary),.14),transparent 65%),rgb(var(--v-theme-background)); background:var(--sage-background) !important; background-attachment:fixed !important; }
.v-theme--sage.sage-shell .v-main { background:transparent !important; }
.v-theme--sage.sage-shell .v-navigation-drawer { background:transparent !important; border:none !important; box-shadow:none !important; }
.v-theme--sage.sage-shell .v-navigation-drawer__content { background:transparent !important; }
@media (max-width:959px) {
  .v-theme--sage.sage-shell .v-navigation-drawer--temporary { backdrop-filter:blur(24px); background:rgba(var(--v-theme-background),.94) !important; }
}
.sage-shell .sage-brand { display:flex; align-items:center; gap:10px; min-height:62px; margin-bottom:0; color:rgb(var(--v-theme-on-surface)); text-decoration:none; font-size:22px; font-weight:700; letter-spacing:-1px; }
.sage-brand-home { display:flex; align-items:center; gap:10px; color:inherit; text-decoration:none; min-width:0; flex:1; }
.sage-brand-home > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sage-shell .sage-brand > .v-btn { margin-left:auto; color:rgb(var(--v-theme-primary)); flex-shrink:0; }
.sage-shell .sage-brand-mark { display:grid; place-items:center; width:36px; height:36px; border-radius:10px; background:linear-gradient(145deg,rgba(var(--v-theme-primary),.8),rgb(var(--v-theme-primary))); color:white; }
.sage-shell .v-navigation-drawer .v-list-item { min-height:43px; margin-bottom:3px !important; border-radius:12px; font-size:14px; }
.sage-shell .v-navigation-drawer .v-list-item__prepend > .v-icon { opacity:.9; margin-inline-end:20px; }
.sage-shell .v-navigation-drawer .v-list-item-title { font-size:14px; font-weight:500; }
.sage-shell .v-navigation-drawer .v-list-item + .v-list-item { margin-top:0 !important; }
.sage-shell .v-navigation-drawer .v-list-item-title,.sage-shell .sage-brand { font-family:Arial,sans-serif; }
.sage-shell .v-navigation-drawer .v-list-item--active { border-left:3px solid rgb(var(--v-theme-primary)); }
</style>
