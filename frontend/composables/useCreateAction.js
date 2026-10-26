import { useAuthStore } from '~/stores/auth';

// Consume a dashboard creation link once; cancelling the form then refreshing
// should leave the user on the ordinary list page.
export function useCreateAction(module, openForm) {
  const route = useRoute();
  const router = useRouter();
  const auth = useAuthStore();
  let handling = false;
  async function handle() {
    if (handling || route.query.action !== 'create') return;
    handling = true;
    try {
      if (auth.can(module, 'read') && auth.can(module, 'create')) openForm();
      const { action, ...query } = route.query;
      await router.replace({ path: route.path, query, hash: route.hash });
    } finally { handling = false; }
  }
  onMounted(handle);
  watch(() => route.query.action, handle);
}
