import { useUIStore } from '~/stores/ui';

// Fetch the exact record rather than relying on the currently visible table page.
export function useLinkedRecord(key, fetchRecord, open) {
  const route = useRoute(), ui = useUIStore();
  let version = 0;
  async function load() {
    const current = ++version;
    const id = String(route.query[key] || '');
    if (!/^\d+$/.test(id)) return;
    try {
      const row = await fetchRecord(id);
      if (current === version && row) open(row);
    } catch (error) { if (current === version) ui.showError(error.response?.data?.message || 'Unable to open the selected record.'); }
  }
  onMounted(load);
  watch(() => route.query[key], load);
  onBeforeUnmount(() => { ++version; });
}
