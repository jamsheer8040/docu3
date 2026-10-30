<template>
  <div class="record-results">
    <p v-if="loading" class="search-message" role="status">Searching…</p>
    <div v-else-if="error" class="search-message" role="alert">{{ error }} <button @click="$emit('retry')">Retry</button></div>
    <template v-else>
      <p v-if="!visibleGroups.length" class="search-message">No matching records you can access.</p>
      <section v-for="group in visibleGroups" :key="group.key" class="result-group">
        <h3>{{ group.label }} <span>{{ group.total }}</span></h3>
        <NuxtLink v-for="item in group.items" :key="item.id" :to="item.to" class="record-result" @click="$emit('select')">
          <div><strong>{{ item.title }}</strong><small v-if="item.subtitle">{{ item.subtitle }}</small><small v-if="item.expiry_date">Expires {{ item.expiry_date }}</small></div>
          <div class="result-meta"><span v-if="item.status">{{ item.status }}</span><span v-if="item.total !== null">AED {{ money(item.total) }}</span><small v-if="item.paid_amount !== null">Paid AED {{ money(item.paid_amount) }}</small></div>
        </NuxtLink>
        <div v-if="full && group.total > group.limit" class="result-pages">
          <button :disabled="group.page <= 1" @click="$emit('page', group.key, group.page - 1)">Previous</button>
          <span>Page {{ group.page }} of {{ Math.ceil(group.total / group.limit) }}</span>
          <button :disabled="group.page * group.limit >= group.total" @click="$emit('page', group.key, group.page + 1)">Next</button>
        </div>
      </section>
    </template>
  </div>
</template>
<script setup>
import { useAuthStore } from '~/stores/auth';
const props = defineProps({ groups: { type: Array, default: () => [] }, query: String, loading: Boolean, error: String, full: Boolean });
defineEmits(['select', 'retry', 'page']);
const auth = useAuthStore();
const pages = [
  ['Dashboard', '/', 'dashboard'], ['Customers', '/customers', 'customers'], ['Leads', '/leads', 'leads'],
  ['Quotations', '/quotations', 'quotations'], ['Sales Orders', '/sales-orders', 'sales_orders'],
  ['Services', '/services', 'services'], ['Invoices', '/invoices', 'invoices'], ['Documents', '/documents', 'documents'],
  ['Purchases', '/purchases', 'suppliers'], ['Suppliers', '/suppliers', 'suppliers'], ['Expenses', '/expenses', 'expenses'],
  ['Wallet', '/wallet', 'wallet'], ['Management', '/management', 'management'], ['Tools', '/tools', 'tools'],
  ['Settings', '/settings', 'settings'], ['Reports & Analytics', '/reports', 'reports']
];
const visibleGroups = computed(() => {
  const q = String(props.query || '').trim().toLowerCase();
  const matches = q.length >= 2 ? pages.filter(([title, , permission]) => title.toLowerCase().includes(q) && auth.can(permission, 'read')).map(([title, to]) => ({ id: to, title, to, total: null, paid_amount: null })) : [];
  return [...props.groups.filter(group => group.total), ...(matches.length ? [{ key: 'pages', label: 'Pages', total: matches.length, page: 1, limit: matches.length, items: matches }] : [])];
});
const money = value => Number(value || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>
<style scoped>
.record-results { max-width:100%; }
.search-message { padding:18px; font-size:13px; }
.search-message button,.result-pages button { color:rgb(var(--v-theme-primary)); font-weight:600; padding:6px 10px; border-radius:16px; }
.result-group { padding:6px 0; }
.result-group h3 { display:flex; align-items:center; gap:8px; font-size:12px; padding:8px 12px; color:rgba(var(--v-theme-on-surface),.65); }
.result-group h3 span { background:rgba(var(--v-theme-primary),.08); border-radius:12px; padding:2px 7px; }
.record-result { display:flex; justify-content:space-between; gap:16px; padding:12px; border-radius:14px; color:inherit; text-decoration:none; }
.record-result:hover,.record-result:focus-visible { background:rgba(var(--v-theme-primary),.07); }
.record-result strong { font-size:13px; display:block; overflow-wrap:anywhere; }
.record-result small { display:block; font-size:11px; opacity:.7; margin-top:4px; overflow-wrap:anywhere; }
.result-meta { text-align:right; flex-shrink:0; font-size:11px; }
.result-meta span { display:block; margin-bottom:4px; }
.result-pages { display:flex; align-items:center; justify-content:flex-end; gap:12px; font-size:12px; }
.result-pages button:disabled { opacity:.4; cursor:default; }
</style>
