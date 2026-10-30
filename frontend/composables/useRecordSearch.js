import { useAuthStore } from '~/stores/auth';

export function useRecordSearch(query, limit = 3) {
  const { $api } = useNuxtApp();
  const auth = useAuthStore();
  const groups = ref([]), loading = ref(false), error = ref('');
  let timer, controller, version = 0;
  async function fetchResults(group, page = 1) {
    const q = String(unref(query) || '').trim();
    if (q.length < 2) return;
    controller?.abort();
    controller = new AbortController();
    const current = ++version;
    const identity = `${auth.user?.tenant_id}:${auth.user?.id}`;
    loading.value = true; error.value = '';
    try {
      const response = await $api.get('/search', { params: { q, limit, ...(group ? { group, page } : {}) }, signal: controller.signal });
      if (current !== version || identity !== `${auth.user?.tenant_id}:${auth.user?.id}`) return;
      if (group) groups.value = groups.value.map(item => response.data.data.find(next => next.key === item.key) || item);
      else groups.value = response.data.data;
    } catch (err) {
      if (current === version && err.code !== 'ERR_CANCELED') error.value = err.response?.data?.message || 'Unable to search. Please try again.';
    } finally { if (current === version) loading.value = false; }
  }
  function schedule() {
    clearTimeout(timer); controller?.abort(); ++version;
    groups.value = []; error.value = '';
    loading.value = String(unref(query) || '').trim().length >= 2;
    if (loading.value) timer = setTimeout(() => fetchResults(), 300);
  }
  watch([query, () => auth.user?.id, () => auth.user?.tenant_id], schedule);
  onMounted(schedule);
  onBeforeUnmount(() => { clearTimeout(timer); controller?.abort(); ++version; });
  return { groups, loading, error, fetchResults };
}
