<template>
  <v-btn-group v-if="remember" color="primary" variant="tonal" :rounded="compact ? 'lg' : 'pill'" class="flex-shrink-0" :class="{ 'document-export-compact': compact }" @click.stop>
    <v-btn prepend-icon="mdi-download" :title="`Download ${names[types[0]] || types[0]} PDF`" :aria-label="`Download ${names[types[0]] || types[0]} PDF`" :size="size" :loading="busy" @click.stop="download(types[0], selected)">{{ label }}</v-btn>
    <v-menu><template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" icon="mdi-chevron-down" :size="size" :disabled="busy" :aria-label="`Choose ${names[types[0]] || types[0]} template`" /></template>
      <v-list :aria-label="`${names[types[0]] || types[0]} templates`"><v-list-subheader>Choose template</v-list-subheader><v-list-item v-for="style in options" :key="style.value" :title="style.title" role="menuitemradio" :aria-checked="selected === style.value" :active="selected === style.value" :prepend-icon="selected === style.value ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'" @click="selectTemplate(style.value)" /></v-list>
    </v-menu>
  </v-btn-group>
  <v-btn v-else-if="direct" color="primary" variant="tonal" rounded="pill" prepend-icon="mdi-download" :size="size" :loading="busy" @click.stop="download(types[0], 'default')">{{ label }}</v-btn>
  <v-menu v-else><template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" color="primary" variant="tonal" rounded="pill" prepend-icon="mdi-file-pdf-box" :loading="busy">{{ label }}</v-btn></template>
    <v-list><template v-for="type in types" :key="type"><v-list-subheader>{{ names[type] || type }}</v-list-subheader><v-list-item v-for="style in options" :key="`${type}-${style.value}`" :title="style.title" @click="download(type, style.value)" /></template></v-list>
  </v-menu>
  <v-snackbar v-model="failed" color="error">Unable to download the document. Please try again.</v-snackbar>
</template>
<script setup>
import { useAuthStore } from '@/stores/auth';
const props = defineProps({ recordId: [Number, String], types: { type: Array, default: () => ['invoice'] }, label: { type: String, default: 'Template PDF' }, direct: Boolean, remember: Boolean, compact: Boolean, size: { type: String, default: 'default' } });
const { $api } = useNuxtApp(); const busy = ref(false); const failed = ref(false);
const names = { invoice: 'Invoice', tax_invoice: 'Tax Invoice', proforma: 'Pro Forma Invoice', sales_order: 'Sales Order', receipt: 'Payment Receipt', expense: 'Expense Voucher' };
const options = [{ title: 'Document default', value: 'default' }, ...['classic','modern','compact','minimal'].map(value => ({ value, title: value.charAt(0).toUpperCase() + value.slice(1) }))];
const auth = useAuthStore();
// Share choices between the list and detail view, but isolate users, tenants and document types.
const selections = useState('document-template-selections', () => ({}));
const storageKey = computed(() => props.remember && auth.user?.id ? `docclear:template:${auth.user.Tenant?.id || auth.user.tenant_id || 'workspace'}:${auth.user.id}:${props.types[0]}` : '');
watch(storageKey, key => {
  if (!key || Object.hasOwn(selections.value, key)) return;
  let value; try { value = localStorage.getItem(key); } catch { /* Keep an in-session choice if storage is unavailable. */ }
  selections.value[key] = options.some(option => option.value === value) ? value : 'default';
}, { immediate: true });
const selected = computed(() => selections.value[storageKey.value] || 'default');
function selectTemplate(value) {
  if (!storageKey.value || !options.some(option => option.value === value)) return;
  selections.value[storageKey.value] = value;
  try { localStorage.setItem(storageKey.value, value); } catch { /* Selection still works for this session. */ }
}
async function download(type, template) { if (busy.value || !props.recordId) return; busy.value = true; try { const { data } = await $api.get(`/document-templates/${type}/${props.recordId}/pdf`, { params: { template }, responseType: 'blob' }); const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = `${type}-${props.recordId}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch { failed.value = true; } finally { busy.value = false; } }
</script>
<style scoped>
.document-export-compact {
  height: 30px;
}
.document-export-compact :deep(.v-btn) {
  height: 30px;
  min-width: 52px;
  padding-inline: 8px;
  font-size: 11px;
  letter-spacing: 0.2px;
}
.document-export-compact :deep(.v-btn--icon) {
  width: 26px;
  min-width: 26px;
  padding: 0;
  border-inline-start: 1px solid rgba(var(--v-theme-primary), 0.12);
}
.document-export-compact :deep(.v-btn__prepend) {
  margin-inline-end: 4px;
}
</style>
