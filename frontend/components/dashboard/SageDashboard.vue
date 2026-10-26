<template>
  <div class="sage-dashboard">
    <header class="sage-header">
      <div class="sage-welcome">
        <div><h1>Home <DashboardIcon icon="mdi-star-four-points" size="16" /></h1><p>Welcome back! Here's what's happening with your business today.</p></div>
      </div>
      <div class="sage-header-actions">
        <div class="sage-periods" aria-label="Statistics period">
          <button v-for="period in periods" :key="period.value" :class="{ selected: selectedPeriod === period.value }" :aria-pressed="selectedPeriod === period.value" :disabled="store.loading" @click="changePeriod(period.value)">{{ period.label }}</button>
        </div>
        <div class="sage-search">
          <DashboardIcon icon="mdi-magnify" size="21" /><input v-model="search" aria-label="Search pages" placeholder="Search anything…" @keydown.esc="search = ''" />
          <div v-if="search.trim()" class="sage-search-results">
            <NuxtLink v-for="item in searchResults" :key="item.to" :to="item.to">{{ item.label }} <DashboardIcon icon="mdi-arrow-top-right" size="16" /></NuxtLink>
            <p v-if="!searchResults.length">No matching pages</p>
          </div>
        </div>
        <v-menu location="bottom end"><template #activator="{ props }"><button v-bind="props" class="sage-icon-button sage-bell" aria-label="Document notifications"><DashboardIcon icon="mdi-bell-outline" /><span v-if="alerts.length" class="notification-dot" /></button></template><v-list><v-list-item title="Document alerts" subtitle="Upcoming and overdue expiries" /><v-list-item v-if="!alerts.length" title="You're all caught up" /><v-list-item v-for="doc in alerts.slice(0, 5)" :key="doc.id" :title="doc.Customer?.name || 'Document'" :subtitle="expiryLabel(doc.days_remaining)" to="/documents" /></v-list></v-menu>
        <v-menu location="bottom end"><template #activator="{ props }"><button v-bind="props" class="sage-profile" aria-label="Open profile menu"><span>{{ initials }}</span><DashboardIcon icon="mdi-chevron-down" size="18" /></button></template><v-list><v-list-item :title="auth.user?.name || auth.user?.email || 'My account'" /><v-list-item title="My Profile" to="/profile" /><v-list-item v-if="auth.can('settings')" title="Settings" to="/settings" /><v-list-item title="Sign out" @click="logout" /></v-list></v-menu>
      </div>
    </header>

    <div v-if="store.error" class="sage-error" role="alert">{{ store.error }} <button @click="changePeriod(selectedPeriod)">Retry</button></div>
    <div class="sage-layout" :aria-busy="store.loading">
      <div class="sage-main-column">
        <section class="sage-metrics" aria-label="Business overview">
          <component :is="auth.can('reports') && auth.can('invoices') ? NuxtLink : 'article'" :to="auth.can('reports') && auth.can('invoices') ? dashboardReportLink('invoice', selectedPeriod) : undefined" class="sage-panel sage-finance sage-finance-link" aria-label="Open revenue invoice report">
            <div class="sage-card-heading"><span class="sage-icon purple"><DashboardIcon icon="mdi-chart-box" /></span><h2>{{ periodLabel }} Revenue</h2><span class="sage-more"><DashboardIcon icon="mdi-dots-vertical" /></span></div>
            <div class="sage-amount"><span>AED</span> {{ money(stats.monthly_receivable) }}</div>
            <div class="sage-progress-block"><div><span>Invoice Paid</span><span>AED {{ money(stats.monthly_revenue) }}</span></div><div class="sage-track blue-track" role="progressbar" aria-label="Invoice paid percentage" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="paidPercent"><span :style="{ width: paidPercent + '%' }" /></div><small>{{ paidPercent }}%</small></div>
            <div class="sage-progress-block"><div><span>Total Receivable</span><span>AED {{ money(Math.max(0, Number(stats.monthly_receivable || 0) - Number(stats.monthly_revenue || 0))) }}</span></div><div class="sage-track purple-track" role="progressbar" aria-label="Total receivable percentage" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="receivablePercent"><span :style="{ width: receivablePercent + '%' }" /></div><small>{{ receivablePercent }}%</small></div>
          </component>
          <div class="sage-kpis">
            <template v-for="kpi in kpis" :key="kpi.key">
            <div v-if="kpi.key === 'quick_actions'" class="sage-quick-actions" aria-label="Create new records">
              <component v-for="action in quickActions" :key="action.module" :is="canCreate(action.module) ? NuxtLink : 'button'" :to="canCreate(action.module) ? `${action.to}?action=create` : undefined" :disabled="!canCreate(action.module)" :aria-label="action.name" class="sage-quick-action" :class="action.color"><DashboardIcon icon="mdi-plus-circle" size="24" /><span>{{ action.label }}</span></component>
            </div>
            <component v-else :is="kpi.to && auth.can(kpi.permission) ? NuxtLink : 'div'" :to="kpi.to && auth.can(kpi.permission) ? (kpi.report ? dashboardReportLink(kpi.report, selectedPeriod) : kpi.to) : undefined" class="sage-kpi" :class="kpi.color">
              <span class="sage-icon" :class="kpi.color"><DashboardIcon :icon="kpi.icon" size="28" /></span><span class="sage-kpi-label">{{ kpi.label }}</span><strong :class="{ 'sage-kpi-currency': kpi.currency }">{{ kpi.placeholder ? '—' : kpi.currency ? `AED ${money(stats[kpi.key])}` : stats[kpi.key] || 0 }}</strong>
            </component>
            </template>
          </div>
          <component :is="auth.can('reports') ? NuxtLink : 'article'" :to="auth.can('reports') ? dashboardReportLink('profit', selectedPeriod) : undefined" class="sage-panel sage-finance sage-finance-link" aria-label="Open net profit financial report">
            <div class="sage-card-heading"><span class="sage-icon green"><DashboardIcon icon="mdi-chart-line" /></span><h2>Net Profit</h2><span class="sage-more"><DashboardIcon icon="mdi-dots-vertical" /></span></div>
            <div class="sage-amount"><span>AED</span> {{ money(stats.monthly_profit) }}</div>
            <div class="sage-progress-block"><div><span>Service charges created</span><span>AED {{ money(stats.monthly_service_charges) }}</span></div><div class="sage-track green-track" role="progressbar" aria-label="Service charges percentage" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="stats.monthly_service_charges > 0 ? 100 : 0"><span :style="{ width: stats.monthly_service_charges > 0 ? '100%' : '0%' }" /></div><small>{{ stats.monthly_service_charges > 0 ? 100 : 0 }}%</small></div>
            <div class="sage-progress-block"><div><span>Total expenses</span><span>AED {{ money(stats.monthly_expenses) }}</span></div><div class="sage-track red-track" role="progressbar" aria-label="Expenses percentage" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="costPercent"><span :style="{ width: costPercent + '%' }" /></div><small>{{ costPercent }}%</small></div>
          </component>
        </section>

        <section class="sage-status-section">
          <div class="sage-section-heading"><h2><DashboardIcon icon="mdi-layers-triple-outline" /> Service Status Overview</h2><NuxtLink v-if="auth.can('services')" to="/services" class="sage-pill-link">View all services <DashboardIcon icon="mdi-chevron-right" size="20" /></NuxtLink></div>
          <div class="sage-status-grid"><article v-for="status in statuses" :key="status.key" class="sage-status" :class="status.color"><span class="sage-icon" :class="status.color"><DashboardIcon :icon="status.icon" size="31" /></span><div><span>{{ status.label }}</span><strong>{{ stats.service_overview?.[status.key] || 0 }}</strong></div><NuxtLink v-if="auth.can('services')" to="/services" :aria-label="'View services: ' + status.label" class="sage-status-link"><DashboardIcon icon="mdi-chevron-right" size="20" /></NuxtLink></article></div>
        </section>

        <div class="sage-bottom-grid">
          <section class="sage-panel sage-bottom-panel"><div class="sage-card-heading"><span class="sage-icon green"><DashboardIcon icon="mdi-cog" /></span><h2>Recent Services</h2><NuxtLink v-if="auth.can('services')" to="/services" class="sage-more" aria-label="View recent services"><DashboardIcon icon="mdi-dots-vertical" /></NuxtLink></div><p class="sage-muted">Active Delivery Orders</p><div class="sage-running"><strong>{{ stats.active_service_orders || 0 }}</strong><span>● &nbsp;running</span></div>
            <div v-if="!recentServices.length" class="sage-empty"><DashboardIcon icon="mdi-file-clock-outline" size="64" /><h3>No recent active services</h3><p>Active service orders will appear here once available.</p></div>
            <div v-else class="sage-records"><NuxtLink v-for="service in recentServices.slice(0, 4)" :key="service.id" to="/services"><div><strong>{{ service.Customer?.name || 'Customer' }}</strong><small>{{ service.ServiceType?.name || 'Service order' }}</small></div><span>{{ service.status }}</span></NuxtLink></div>
          </section>
          <section class="sage-panel sage-bottom-panel"><div class="sage-card-heading"><span class="sage-icon blue"><DashboardIcon icon="mdi-wallet" /></span><h2>Wallet Balances</h2><NuxtLink v-if="auth.can('wallet')" to="/wallet" class="sage-more" aria-label="View wallet balances"><DashboardIcon icon="mdi-dots-vertical" /></NuxtLink></div><p class="sage-muted">Grand Total Liquidity</p><div class="sage-wallet-total">AED {{ money(walletTotal) }}</div>
            <div v-if="!wallets.length" class="sage-empty wallet-empty"><DashboardIcon icon="mdi-wallet-outline" size="63" /><h3>No wallets found</h3><p>Connect a wallet or add a new one to see balances here.</p><NuxtLink v-if="auth.can('wallet', 'create')" to="/wallet" class="sage-primary-link"><DashboardIcon icon="mdi-plus-circle" size="18" /> Add Wallet</NuxtLink></div>
            <div v-else class="sage-records"><NuxtLink v-for="wallet in wallets.slice(0, 4)" :key="wallet.id" to="/wallet"><span class="sage-wallet-label"><span class="sage-wallet-logo"><img v-if="getBankLogo(wallet.name) && !failedWalletLogos.includes(wallet.id)" :src="getBankLogo(wallet.name)" alt="" @error="failedWalletLogos.push(wallet.id)" /><DashboardIcon v-else :icon="wallet.name?.toLowerCase() === 'cash' ? 'mdi-cash' : 'mdi-bank-outline'" size="18" /></span><strong>{{ wallet.name }}</strong></span><span>{{ wallet.currency || 'AED' }} {{ money(wallet.balance) }}</span></NuxtLink></div>
          </section>
        </div>
      </div>

      <aside class="sage-right-column">
        <section class="sage-panel sage-calendar"><div class="sage-card-heading"><span class="sage-icon purple"><DashboardIcon icon="mdi-calendar-month" /></span><h2 aria-live="polite">{{ calendarMonth.format('MMMM YYYY') }}</h2><button class="sage-icon-button" aria-label="Previous month" @click="calendarMonth = calendarMonth.subtract(1, 'month')"><DashboardIcon icon="mdi-chevron-left" size="20" /></button><button class="sage-icon-button" aria-label="Next month" @click="calendarMonth = calendarMonth.add(1, 'month')"><DashboardIcon icon="mdi-chevron-right" size="20" /></button></div><div class="sage-calendar-grid"><span v-for="day in weekdays" :key="day" class="sage-weekday">{{ day }}</span><span v-for="(day, index) in calendarDays" :key="index" class="sage-day" :class="{ blank: !day, today: day && calendarMonth.date(day).isSame(today, 'day'), 'has-expiry': day && hasExpiry(day) }" :aria-label="day ? calendarMonth.date(day).format('D MMMM YYYY') + (hasExpiry(day) ? ', document expiry' : '') : undefined" :aria-current="day && calendarMonth.date(day).isSame(today, 'day') ? 'date' : undefined">{{ day }}</span></div></section>
        <section class="sage-panel sage-expiries"><div class="sage-card-heading"><span class="sage-alert-icon"><DashboardIcon icon="mdi-alert-circle" size="28" /></span><h2>Critical Expiries</h2><NuxtLink v-if="auth.can('documents')" to="/documents" class="sage-more" aria-label="View document expiries"><DashboardIcon icon="mdi-chevron-right" /></NuxtLink></div><div class="sage-alert-summary"><div><p>Active Document Alerts</p><strong>{{ stats.critical_count || 0 }}</strong><span>critical</span></div><DashboardIcon icon="mdi-file-document" size="58" /></div><div v-if="alerts.length" class="sage-alert-list"><NuxtLink v-for="doc in alerts.slice(0, 5)" :key="doc.id" to="/documents"><i :class="{ overdue: doc.days_remaining < 0 }" /><span>{{ doc.Customer?.name || 'Customer' }}<small>{{ doc.DocumentType?.name || 'Document' }}</small></span><em :class="{ overdue: doc.days_remaining < 0 }">{{ expiryLabel(doc.days_remaining) }}</em><DashboardIcon icon="mdi-chevron-right" size="17" /></NuxtLink></div><div v-else class="sage-alert-empty"><DashboardIcon icon="mdi-check-decagram-outline" size="36" /><h3>You're all caught up</h3><p>No upcoming document expiries.</p></div></section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import DashboardIcon from '~/components/dashboard/DashboardIcon.vue';
import { computed, ref, inject, resolveComponent } from 'vue';
import dayjs from 'dayjs';
import { dashboardReportLink } from '~/utils/dashboardReports';
import { getBankLogo } from '~/utils/banks';
import { useDashboardStore } from '~/stores/dashboard';
import { useAuthStore } from '~/stores/auth';
const NuxtLink = resolveComponent('NuxtLink');
const store = useDashboardStore();
const auth = useAuthStore();
const toggleNavigation = inject('toggleDashboardNavigation', () => {});
const stats = computed(() => store.stats || {});
const selectedPeriod = ref('monthly');
const periods = [{ value: 'yearly', label: 'Yearly' }, { value: 'monthly', label: 'Monthly' }, { value: 'today', label: 'Today' }];
const periodLabel = computed(() => selectedPeriod.value === 'today' ? "Today's" : selectedPeriod.value === 'yearly' ? 'Yearly' : 'Monthly');
async function changePeriod(period) { selectedPeriod.value = period; store.error = null; await store.fetchStats({ period }); }
const money = value => Number(value || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (part, total) => total > 0 ? Math.min(100, Math.max(0, Math.round(Number(part || 0) / total * 100))) : 0;
const paidPercent = computed(() => percent(stats.value.monthly_revenue, stats.value.monthly_receivable));
const receivablePercent = computed(() => percent(Number(stats.value.monthly_receivable || 0) - Number(stats.value.monthly_revenue || 0), stats.value.monthly_receivable));
const costPercent = computed(() => percent(stats.value.monthly_expenses, stats.value.monthly_service_charges));
const wallets = computed(() => stats.value.wallet_balances || []);
const failedWalletLogos = ref([]);
const walletTotal = computed(() => wallets.value.reduce((total, wallet) => total + Number(wallet.balance || 0), 0));
const recentServices = computed(() => store.recentActivity?.recent_services || []);
const alerts = computed(() => store.recentActivity?.expiring_documents || []);
const initials = computed(() => (auth.user?.name || auth.user?.email || 'User').split(/[ @.]+/).slice(0, 2).map(part => part[0]).join('').toUpperCase());
const logout = () => { auth.logout(); navigateTo('/login'); };
const kpis = [
  { key: 'total_customers', label: 'Total Clients', icon: 'mdi-account-multiple', color: 'blue', permission: 'customers', to: '/customers' },
  { key: 'total_suppliers', label: 'Suppliers', icon: 'mdi-truck-outline', color: 'green', permission: 'suppliers', to: '/suppliers' },
  { key: 'monthly_profit', label: 'Profit Report', icon: 'mdi-chart-line', color: 'amber', permission: 'reports', to: '/reports?report=profit', report: 'profit', currency: true },
  { key: 'quick_actions' },
  { key: 'aged_invoices', label: 'Invoices (30+ days)', icon: 'mdi-file-clock', color: 'slate', permission: 'reports', to: '/reports?report=invoice&aging=30' }
];
const quickActions = [
  { label: 'Invoice', name: 'Create invoice', module: 'invoices', to: '/invoices', color: 'purple' },
  { label: 'SO', name: 'Create sales order', module: 'sales_orders', to: '/sales-orders', color: 'red' },
  { label: 'Service', name: 'Create service order', module: 'services', to: '/services', color: 'blue' },
  { label: 'Document', name: 'Create document', module: 'documents', to: '/documents', color: 'green' }
];
const canCreate = module => auth.can(module, 'read') && auth.can(module, 'create');
const statuses = [
  { key: 'Pending', label: 'Pending', icon: 'mdi-clock-outline', color: 'amber' },
  { key: 'In Progress', label: 'In Progress', icon: 'mdi-progress-clock', color: 'blue' },
  { key: 'CompletedInvoicePending', label: 'Invoice Pending', icon: 'mdi-file-clock', color: 'purple' },
  { key: 'CompletedInvoiceCreated', label: 'Invoice Created', icon: 'mdi-check-circle', color: 'green' },
  { key: 'Cancelled', label: 'Cancelled', icon: 'mdi-close-circle', color: 'red' }
];
const search = ref('');
const pages = [
  { label: 'Dashboard', to: '/', permission: 'dashboard' }, { label: 'Customers', to: '/customers', permission: 'customers' },
  { label: 'Leads', to: '/leads', permission: 'customers' }, { label: 'Purchases', to: '/purchases', permission: 'suppliers' }, { label: 'Suppliers', to: '/suppliers', permission: 'suppliers' },
  { label: 'Documents', to: '/documents', permission: 'documents' }, { label: 'Sales Orders', to: '/sales-orders', permission: 'sales_orders' },
  { label: 'Services', to: '/services', permission: 'services' }, { label: 'Invoices', to: '/invoices', permission: 'invoices' },
  { label: 'Expenses', to: '/expenses', permission: 'expenses' }, { label: 'Wallet', to: '/wallet', permission: 'wallet' },
  { label: 'Management', to: '/management', permission: 'management' }, { label: 'Tools', to: '/tools', permission: 'tools' },
  { label: 'Settings', to: '/settings', permission: 'settings' }, { label: 'Reports & Analytics', to: '/reports', permission: 'reports' }
];
const searchResults = computed(() => pages.filter(item => auth.can(item.permission) && item.label.toLowerCase().includes(search.value.trim().toLowerCase())).slice(0, 6));
const today = dayjs();
const calendarMonth = ref(today.startOf('month'));
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const calendarDays = computed(() => [...Array(calendarMonth.value.day()).fill(null), ...Array.from({ length: calendarMonth.value.daysInMonth() }, (_, index) => index + 1)]);
const hasExpiry = day => alerts.value.some(doc => doc.expiry_date && dayjs(doc.expiry_date).isSame(calendarMonth.value.date(day), 'day'));
const expiryLabel = days => Number(days) < 0 ? `${Math.abs(Number(days))} Days Overdue` : Number(days) === 0 ? 'Due Today' : `In ${days} Days`;
</script>

<style scoped>
.sage-finance-link { color:inherit; text-decoration:none; display:block; }
.sage-finance-link[href]:hover { box-shadow:0 8px 28px rgba(var(--v-theme-primary),.12); }
.sage-finance-link[href]:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:3px; }
/* These labels inherited their size; make the 1px reduction explicit to avoid compounding. */
.sage-alert-summary span { font-size: 15px; }
.sage-records small, .sage-alert-list small { font-size: 9px; }
.sage-dashboard { --sage-ink:rgb(var(--v-theme-on-surface)); --sage-muted:rgba(var(--v-theme-on-surface),.76); padding:22px 24px 24px; color:var(--sage-ink); min-height:100vh; background:transparent; font-family:Arial,sans-serif; }
.sage-dashboard * { box-sizing:border-box; }
.sage-dashboard a { text-decoration:none; color:inherit; }
.sage-dashboard button { cursor:pointer; }
.sage-dashboard button:focus-visible,.sage-dashboard a:focus-visible,.sage-dashboard input:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:4px; }
.sage-header { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:20px; }
.sage-welcome { display:flex; align-items:center; gap:10px; }
.sage-welcome h1 { font-family:Arial,sans-serif !important; font-size:35px; font-weight:650 !important; letter-spacing:-1.4px; line-height:1.1; color:var(--sage-ink) !important; }
.sage-welcome h1 .dashboard-icon { color:rgb(var(--v-theme-primary)); margin-left:10px; }
.sage-welcome p { margin:4px 0 0; color:var(--sage-muted); font-size:13px; }
.sage-header-actions { display:flex; align-items:center; gap:16px; }
.sage-periods { display:flex; padding:3px; border-radius:30px; background:rgba(var(--v-theme-surface),.9); box-shadow:0 4px 10px rgba(var(--v-theme-primary),.06); }
.sage-periods button { padding:10px 20px; font-size:12px; border-radius:24px; color:var(--sage-muted); }
.sage-periods button.selected { color:white; background:linear-gradient(160deg,rgba(var(--v-theme-primary),.85),rgb(var(--v-theme-primary))); box-shadow:0 3px 5px rgba(var(--v-theme-primary),.2); }
.sage-periods button:disabled { cursor:wait; }
.sage-search { position:relative; display:flex; align-items:center; gap:8px; background:rgba(var(--v-theme-surface),.9); border-radius:28px; padding:10px 15px; width:230px; color:var(--sage-muted); }
.sage-search input { min-width:0; width:100%; outline:none; font-size:12px; }
.sage-search-results { position:absolute; z-index:10; top:48px; left:0; right:0; background:rgb(var(--v-theme-surface)); border-radius:16px; padding:8px; box-shadow:0 12px 30px rgba(var(--v-theme-primary),.2); }
.sage-search-results a { display:flex; justify-content:space-between; padding:10px; font-size:12px; border-radius:10px; }
.sage-search-results a:hover { background:rgba(var(--v-theme-primary),.1); }
.sage-search-results p { font-size:12px; padding:8px; }
.sage-icon-button { display:grid; place-items:center; width:35px; height:35px; flex-shrink:0; background:rgba(var(--v-theme-primary),.04); border-radius:50%; }
.sage-bell { position:relative; background:rgb(var(--v-theme-surface)); width:42px; height:42px; }
.notification-dot { position:absolute; top:0; right:3px; width:9px; height:9px; border:2px solid white; border-radius:50%; background:#ff3f53; }
.sage-profile { display:flex; align-items:center; gap:8px; }.sage-profile span { display:grid; place-items:center; width:43px; height:43px; border-radius:50%; background:linear-gradient(150deg,rgba(var(--v-theme-primary),.8),rgb(var(--v-theme-primary))); color:white; font-size:13px; box-shadow:0 5px 10px rgba(var(--v-theme-primary),.15); }
.mobile-navigation { display:none; }
.sage-layout { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:16px; }
.sage-main-column,.sage-right-column { min-width:0; }
.sage-panel { background:rgba(var(--v-theme-surface),.92); border:1px solid rgba(var(--v-theme-primary),.025); border-radius:20px; box-shadow:0 10px 25px -15px rgba(var(--v-theme-primary),.16); }
.sage-metrics { display:grid; grid-template-columns:1fr 1.12fr 1fr; gap:12px; }
.sage-finance { padding:18px 20px; position:relative; overflow:hidden; min-width:0; }
.sage-finance::before { content:''; position:absolute; width:240px; height:180px; right:-80px; bottom:10px; border-radius:60px; transform:rotate(-32deg); background:linear-gradient(130deg,transparent,rgba(var(--v-theme-primary),.045)); pointer-events:none; }
.sage-card-heading { display:flex; align-items:center; gap:10px; position:relative; }
.sage-dashboard h2 { font-family:Arial,sans-serif !important; color:var(--sage-ink) !important; font-size:16px; font-weight:600 !important; letter-spacing:-.5px; line-height:1.25; }
.sage-card-heading h2 { flex:1; }
.sage-more { margin-left:auto; display:grid; place-items:center; width:24px; height:32px; color:var(--sage-muted) !important; flex-shrink:0; }
.sage-icon { display:grid; place-items:center; width:45px; height:45px; border-radius:15px; flex-shrink:0; }
.blue { --tone:0,119,255; }.green { --tone:0,174,79; }.amber { --tone:244,146,0; }.purple { --tone:148,40,255; }.red { --tone:255,49,67; }.slate { --tone:114,139,150; }
.sage-icon { background:linear-gradient(150deg,rgba(var(--tone),.04),rgba(var(--tone),.19)); color:rgb(var(--tone)); }
.sage-amount { display:flex; align-items:baseline; gap:7px; font-size:39px; line-height:1.3; letter-spacing:-1.7px; font-weight:600; margin:8px 0 21px; position:relative; overflow-wrap:anywhere; flex-wrap:wrap; }
.sage-amount > span { font-size:23px; font-weight:500; letter-spacing:-.6px; }
.sage-progress-block { position:relative; margin-top:20px; color:var(--sage-muted); font-size:12px; }
.sage-progress-block > div:first-child { display:flex; justify-content:space-between; gap:6px; margin-bottom:7px; }
.sage-progress-block small { display:block; margin-top:5px; font-size:11px; }
.sage-track { height:11px; border-radius:15px; background:rgba(112,135,127,.12); overflow:hidden; }.sage-track span { display:block; height:100%; border-radius:15px; background:rgb(var(--track)); transition:width .45s ease; }
@media(prefers-reduced-motion:reduce) { .sage-track span { transition:none; } }.blue-track { --track:63,166,255; }.purple-track { --track:177,112,245; }.green-track { --track:64,218,140; }.red-track { --track:255,102,112; }
.sage-kpis { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; }
.sage-quick-actions { grid-column:span 2; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; }
.sage-quick-action { display:flex; align-items:center; justify-content:center; gap:6px; padding:12px 6px; border-radius:19px; color:var(--sage-ink); background:linear-gradient(160deg,rgba(var(--v-theme-surface),.97),rgba(var(--tone),.08)); text-decoration:none; font-size:12px; font-weight:600; min-width:0; }
.sage-quick-action:disabled { opacity:.45; cursor:not-allowed; }
.sage-quick-action:not(:disabled):hover { box-shadow:0 5px 16px rgba(var(--tone),.15); }
.sage-quick-action:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:2px; }
.sage-kpi { display:flex; align-items:center; flex-direction:column; justify-content:center; text-align:center; min-height:145px; padding:14px 7px; gap:7px; border-radius:19px; background:linear-gradient(160deg,rgba(var(--v-theme-surface),.97),rgba(var(--tone),.055)); }
.sage-kpi-label { font-size:11px; line-height:1.3; color:var(--sage-muted); max-width:110px; }
.sage-kpi strong { font-size:27px; line-height:1.1; font-weight:600; }
.sage-kpi strong.sage-kpi-currency { font-size:17px; max-width:100%; overflow-wrap:anywhere; }
.sage-section-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:19px 3px 12px; }.sage-section-heading h2 { display:flex; align-items:center; gap:12px; font-size:20px; }
.sage-pill-link { display:flex; align-items:center; gap:12px; background:rgba(var(--v-theme-surface),.9); border-radius:25px; padding:8px 16px; color:rgb(var(--v-theme-primary)) !important; font-size:12px; white-space:nowrap; box-shadow:0 4px 10px rgba(var(--v-theme-primary),.05); }
.sage-status-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:9px; }
.sage-status { position:relative; overflow:hidden; display:flex; gap:12px; align-items:flex-start; border-radius:18px; background:linear-gradient(155deg,rgba(var(--v-theme-surface),.95),rgba(var(--tone),.045)); padding:15px 13px; min-height:111px; }
.sage-status::after { content:''; position:absolute; width:140%; height:70px; border-radius:50%; background:rgba(var(--tone),.035); bottom:-55px; left:15px; transform:rotate(-15deg); pointer-events:none; }
.sage-status > div { min-width:0; padding-top:5px; }.sage-status > div > span { font-size:11px; line-height:1.2; display:block; color:var(--sage-muted); }.sage-status strong { display:block; font-size:31px; line-height:1.3; margin-top:5px; font-weight:600; }
.sage-status .sage-icon { width:45px; height:45px; border-radius:50%; }.sage-status-link { position:absolute; right:12px; bottom:12px; display:grid; place-items:center; width:29px; height:29px; border:1px solid rgba(var(--v-theme-surface),.8); border-radius:50%; color:rgb(var(--tone)) !important; background:rgba(var(--tone),.07); }
.sage-bottom-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px; }.sage-bottom-panel { min-height:270px; padding:17px 21px 14px; }.sage-bottom-panel .sage-icon { width:38px; height:38px; border-radius:12px; }.sage-bottom-panel h2 { font-size:19px; }.sage-muted { margin:10px 0 4px; color:var(--sage-muted); font-size:13px; }.sage-running { display:flex; align-items:center; gap:12px; }.sage-running > strong { font-size:37px; line-height:1; font-weight:600; }.sage-running > span { background:#e1fbed; color:#008e42; padding:6px 12px; border-radius:20px; font-size:12px; }
.sage-wallet-label { display:inline-flex; align-items:center; gap:9px; min-width:0; }
.sage-wallet-label strong { color:var(--sage-ink); }
.sage-wallet-logo { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; flex-shrink:0; border-radius:7px; background:rgba(var(--v-theme-primary),.07); overflow:hidden; }
.sage-wallet-logo img { width:100%; height:100%; object-fit:contain; padding:3px; background:white; }
.sage-wallet-total { font-size:28px; font-weight:600; letter-spacing:-1px; }.sage-empty { text-align:center; margin:0 auto; color:#8b9fa6; }.sage-empty h3,.sage-alert-empty h3 { font-size:14px; color:var(--sage-ink); margin:7px 0 4px; font-weight:500; }.sage-empty p,.sage-alert-empty p { color:var(--sage-muted); font-size:12px; margin:0; }.wallet-empty { margin-top:-25px; }.sage-primary-link { display:inline-flex; align-items:center; gap:9px; padding:11px 26px; border-radius:12px; color:white !important; margin-top:12px; font-size:12px; background:linear-gradient(150deg,rgba(var(--v-theme-primary),.85),rgb(var(--v-theme-primary))); box-shadow:0 5px 12px rgba(var(--v-theme-primary),.17); }
.sage-records { margin-top:12px; }.sage-records a { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:11px 0; border-bottom:1px solid rgba(var(--v-theme-primary),.07); font-size:11px; }.sage-records strong { font-weight:500; }.sage-records small { display:block; color:var(--sage-muted); margin-top:3px; }.sage-records span { color:var(--sage-muted); }
.sage-calendar { padding:16px; }.sage-calendar .sage-icon { width:34px; height:34px; border-radius:10px; }.sage-calendar .sage-card-heading { gap:7px; }.sage-calendar h2 { font-size:15px; white-space:nowrap; }.sage-calendar .sage-icon-button { width:29px; height:29px; }.sage-calendar-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; margin-top:11px; text-align:center; }.sage-weekday { font-size:11px; color:var(--sage-muted); padding:3px 0; }.sage-day { display:grid; place-items:center; height:34px; background:rgba(var(--v-theme-primary),.035); border-radius:12px; font-size:13px; position:relative; }.sage-day.today { background:linear-gradient(145deg,rgba(var(--v-theme-primary),.8),rgb(var(--v-theme-primary))); color:white; box-shadow:0 3px 7px rgba(var(--v-theme-primary),.2); }.sage-day.blank { color:transparent; }.sage-day.has-expiry::after { content:''; position:absolute; bottom:3px; width:4px; height:4px; background:#fa8e35; border-radius:50%; }
.sage-expiries { padding:14px 12px; margin-top:16px; }.sage-expiries .sage-card-heading { margin:0 3px 12px; }.sage-expiries h2 { font-size:20px; }.sage-alert-icon { color:#ff3248; }.sage-alert-summary { display:flex; justify-content:space-between; align-items:center; padding:19px; background:linear-gradient(130deg,rgba(255,61,80,.08),rgba(255,61,80,.055)); border-radius:14px; }.sage-alert-summary p { font-size:13px; color:#f82f45; margin-bottom:5px; }.sage-alert-summary strong { font-size:39px; line-height:1.2; font-weight:600; }.sage-alert-summary span { margin-left:9px; color:var(--sage-muted); }.sage-alert-summary > .dashboard-icon { color:rgba(220,90,105,.17); }.sage-alert-list a { display:flex; align-items:center; gap:10px; padding:16px 7px; border-bottom:1px solid rgba(var(--v-theme-primary),.07); font-size:11px; }.sage-alert-list i { width:9px; height:9px; background:#ff9b0a; border-radius:50%; flex-shrink:0; }.sage-alert-list span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.sage-alert-list small { display:block; margin-top:4px; color:var(--sage-muted); }.sage-alert-list em { font-style:normal; font-size:10px; white-space:nowrap; color:var(--sage-muted); }.sage-alert-list i.overdue { background:#ff3248; }.sage-alert-list em.overdue { color:#f82f45; }.sage-alert-empty { text-align:center; padding:28px 8px; color:rgb(var(--v-theme-primary)); }.sage-error { margin-bottom:12px; padding:12px; border-radius:14px; background:#fff0f1; color:#9b2638; font-size:13px; }.sage-error button { text-decoration:underline; margin-left:12px; }
@media (min-width:1700px) { .sage-layout { grid-template-columns:minmax(0,1fr) 360px; }.sage-metrics { grid-template-columns:1fr 1.12fr 1fr; }.sage-kpi { min-height:149px; }.sage-bottom-panel { min-height:270px; }.sage-calendar .sage-day { height:36px; } }
@media (max-width:1450px) { .sage-dashboard { padding:20px 18px; }.sage-layout { grid-template-columns:minmax(0,1fr) 280px; }.sage-header { flex-wrap:wrap; }.sage-header-actions { margin-left:auto; }.sage-finance { padding:15px 13px; }.sage-card-heading { gap:7px; }.sage-card-heading h2 { font-size:14px; }.sage-amount { font-size:30px; }.sage-amount > span { font-size:19px; }.sage-kpi { min-height:138px; }.sage-kpi-label { font-size:10px; }.sage-status { padding:13px 10px; gap:7px; }.sage-status .sage-icon { width:34px; height:34px; }.sage-status .sage-icon .dashboard-icon { font-size:17.5px !important; }.sage-status > div > span { font-size:10px; }.sage-bottom-panel h2,.sage-expiries h2 { font-size:17px; }.sage-calendar h2 { font-size:13px; }.sage-calendar { padding:12px; } }
@media (max-width:1199px) { .sage-layout { grid-template-columns:minmax(0,1fr); }.sage-right-column { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }.sage-expiries { margin-top:0; }.sage-kpi { min-height:142px; }.sage-header-actions { gap:10px; }.sage-search { width:200px; } }
@media (max-width:959px) { .mobile-navigation { display:grid; }.sage-dashboard { padding:20px; }.sage-header-actions { margin:0; width:100%; }.sage-search { flex:1; }.sage-header { gap:16px; } }
@media (max-width:650px) { .sage-dashboard { padding:18px 14px; }.sage-welcome h1 { font-size:29px; }.sage-welcome p { font-size:11px; line-height:1.4; }.sage-header-actions { flex-wrap:wrap; gap:10px; }.sage-periods { order:4; width:100%; }.sage-periods button { flex:1; }.sage-search { width:auto; }.sage-metrics { grid-template-columns:1fr 1fr; }.sage-kpis { grid-column:1/-1; grid-row:2; gap:8px; }.sage-finance { padding:14px; }.sage-finance .sage-icon { width:33px; height:33px; border-radius:11px; }.sage-finance h2 { font-size:13px; }.sage-finance .sage-more { display:none; }.sage-amount { font-size:27px; gap:5px; margin-bottom:15px; }.sage-amount > span { font-size:16px; }.sage-progress-block { font-size:10px; margin-top:14px; }.sage-progress-block > div:first-child { flex-wrap:wrap; }.sage-status-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.sage-status:last-child { grid-column:1/-1; }.sage-status { min-height:100px; padding:14px; }.sage-status > div > span { font-size:12px; }.sage-section-heading { align-items:flex-start; }.sage-section-heading h2 { font-size:17px; gap:6px; }.sage-pill-link { padding:7px 9px; font-size:10px; gap:3px; }.sage-bottom-grid,.sage-right-column { grid-template-columns:1fr; }.sage-bottom-panel { min-height:270px; }.sage-bottom-panel h2 { font-size:19px; }.sage-calendar h2 { font-size:16px; }.sage-calendar .sage-day { height:38px; }.wallet-empty { margin-top:0; }.sage-empty { margin-top:12px; } }
@media (min-width:1451px) { .sage-dashboard { padding-top:18px; }.sage-header { margin-bottom:14px; }.sage-welcome h1 { font-size:33px; line-height:36px; }.sage-welcome p { margin-top:0; line-height:18px; }.sage-empty h3 { line-height:20px; }.sage-empty p { line-height:18px; }.sage-bottom-panel { min-height:270px; }.sage-primary-link { padding-top:9px; padding-bottom:9px; } }
</style>
