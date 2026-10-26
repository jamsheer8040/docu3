<template>
  <v-avatar :size="26" :color="staff ? 'primary' : undefined" variant="tonal" class="service-staff-avatar" :title="label" role="img" :aria-label="label">
    <img v-if="photo && !failed" :src="photo" alt="" @error="failed = true" />
    <span v-else-if="staff" class="service-staff-initials">{{ initials }}</span>
    <span v-else-if="unassignedMarker" class="service-staff-initials">{{ unassignedMarker }}</span>
    <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20v-2a7 7 0 0 1 14 0v2" /></svg>
  </v-avatar>
</template>
<script setup>
import { useAuthStore } from '~/stores/auth';
const props = defineProps({ staff: Object, unassignedMarker: String, unassignedLabel: { type: String, default: 'Unassigned service' } });
const auth = useAuthStore(); const config = useRuntimeConfig(); const failed = ref(false);
const label = computed(() => props.staff ? `Assigned to ${props.staff.name}` : props.unassignedLabel);
const initials = computed(() => (props.staff?.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase() || '?');
const photo = computed(() => {
  const path = props.staff?.avatar;
  const canView = String(props.staff?.id) === String(auth.user?.id) || ['staff', 'expenses', 'settings'].some(module => auth.can(module));
  if (!canView || typeof path !== 'string' || !/^\/uploads\/avatars\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/i.test(path)) return '';
  return String(config.public.apiBase || '/api/v1').replace(/\/api\/v1\/?$/, '') + path;
});
watch(photo, () => { failed.value = false; });
</script>
<style scoped>
.service-staff-avatar { flex-shrink:0; color:rgb(var(--v-theme-primary)); }
.service-staff-avatar img { display:block; width:100%; height:100%; object-fit:cover; }
.service-staff-initials { font-size:10px; font-weight:600; line-height:1; }
</style>
