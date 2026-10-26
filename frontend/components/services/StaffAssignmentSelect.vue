<template>
  <div>
    <v-autocomplete v-model="selected" label="Assigned Staff" :items="options" item-title="name" item-value="id" :loading="loading" clearable placeholder="Unassigned" variant="outlined" density="comfortable" hide-details="auto" :disabled="disabled" />
    <div v-if="failed" class="text-caption text-error mt-1">Unable to load staff. <button type="button" class="text-decoration-underline" @click="load">Retry</button></div>
  </div>
</template>
<script setup>
const selected = defineModel({ type: [Number, String], default: null });
const props = defineProps({ currentStaff: Object, disabled: Boolean });
const { $api } = useNuxtApp();
const staff = ref([]); const loading = ref(false); const failed = ref(false);
const options = computed(() => {
  const current = props.currentStaff;
  if (!current || staff.value.some(user => String(user.id) === String(current.id))) return staff.value;
  return [...staff.value, { ...current, name: `${current.name} (inactive)`, props: { disabled: true } }];
});
async function load() {
  loading.value = true; failed.value = false;
  try { staff.value = (await $api.get('/services/assignees')).data.data; }
  catch { failed.value = true; }
  finally { loading.value = false; }
}
onMounted(load);
</script>
