<template>
  <div class="d-flex flex-wrap align-start ga-2 mb-4">
    <v-autocomplete v-model="selected" :items="templates" item-title="name" item-value="id" label="Service template" placeholder="Choose a bundle of services" clearable variant="outlined" density="compact" hide-details :loading="loading" :disabled="busy || disabled" style="max-width:420px;min-width:240px" />
    <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-playlist-plus" :disabled="!selected || disabled" :loading="busy" @click="add">Add template</v-btn>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="w-100">{{ error }}</v-alert>
    <span v-else-if="!loading && !templates.length" class="text-caption text-medium-emphasis pt-2">No active service templates. Create one in Settings → Service Templates.</span>
  </div>
</template>
<script setup>
import { bundleLines } from '~/utils/serviceBundleLines.mjs';
const props = defineProps({ kind: String, pricingCategory: { type: String, default: 'Normal' }, disabled: Boolean });
const emit = defineEmits(['add', 'busy']);
const { $api } = useNuxtApp();
const selected = ref(null), templates = ref([]), loading = ref(false), busy = ref(false), error = ref('');
const controller = new AbortController();
onBeforeUnmount(() => { controller.abort(); emit('busy', false); });
onMounted(async () => {
  loading.value = true;
  try { templates.value = (await $api.get('/service-bundles', { signal: controller.signal })).data.data; }
  catch (e) { error.value = e.response?.data?.message || 'Unable to load service templates.'; }
  finally { loading.value = false; }
});
async function add() {
  if (!selected.value || busy.value || props.disabled) return;
  busy.value = true; emit('busy', true); error.value = '';
  try {
    const result = (await $api.get(`/service-bundles/${selected.value}/expand`, { signal: controller.signal })).data.data;
    if (controller.signal.aborted) return;
    emit('add', bundleLines(result.items, { kind: props.kind, pricingCategory: props.pricingCategory }));
    selected.value = null;
  } catch (e) { error.value = e.response?.data?.message || e.message || 'Unable to add template services.'; }
  finally { busy.value = false; emit('busy', false); }
}
</script>
