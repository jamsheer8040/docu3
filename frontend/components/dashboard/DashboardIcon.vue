<template>
  <svg class="dashboard-icon" :style="iconStyle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" :data-icon="name">
    <path v-for="(path, index) in paths" :key="index" :d="path" />
  </svg>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({ icon: String, size: { type: [Number, String], default: 24 }, color: String });
// Dashboard-only rounded line artwork. Preserve the original size as the input
// and apply the requested 70% scale once, including responsive CSS overrides.
const artwork = {
  suppliers: ['M3 5h11v12H3ZM14 10h4l3 4v3h-7M7 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM18 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM6 9h5'],
  spark: ['M12 3 14.5 9.5 21 12 14.5 14.5 12 21 9.5 14.5 3 12 9.5 9.5Z'],
  menu: ['M4 7h16M4 12h11M4 17h16'],
  search: ['M16.5 10a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0ZM15 15l5 5'],
  northeast: ['M6 18 18 6M7 6h11v11'],
  bell: ['M8 17h8M9.5 20h5M5 16l2-3V9a5 5 0 0 1 10 0v4l2 3H5Z'],
  down: ['m6 9 6 6 6-6'], right: ['m9 6 6 6-6 6'], left: ['m15 6-6 6 6 6'],
  more: ['M12 4v.01M12 12v.01M12 20v.01'],
  revenue: ['M4 19V5M4 19h16M8 14l4-5 4 2 4-6'],
  profit: ['M4 16 9 11l4 3 7-9M15 5h5v5M5 20h14'],
  people: ['M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 20v-2a6 6 0 0 1 12 0v2M17 4a3 3 0 0 1 0 6M20 20v-2a6 6 0 0 0-3-5'],
  grid: ['M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z'],
  layers: ['m12 3 9 5-9 5-9-5ZM3 12l9 5 9-5M3 17l9 5 9-5'],
  services: ['m13 3-2 7H4l7 11 2-7h7Z'],
  pending: ['M21 12a9 9 0 1 1-9-9M12 7v5l3 2M17 3h4v4'],
  progress: ['M12 3a9 9 0 1 1-8 5M3 3v5h5M12 7v5l3 2'],
  document: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5'],
  documentClock: ['M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l6 6v2M14 3v6h6M8 13h3M21 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17 15v2l1 1'],
  check: ['M21 11v1a9 9 0 1 1-5-8M8 11l4 4 9-10'],
  cancel: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9l6 6M15 9l-6 6'],
  wallet: ['M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7M20 13h-4a2 2 0 0 0 0 4h4M16 15h.01'],
  calendar: ['M8 3v4M16 3v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 14h2M14 14h2M8 17h2'],
  alert: ['M12 8v5M12 17h.01M10.3 3.9 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0Z'],
  plus: ['M12 5v14M5 12h14']
};
const aliases = {
  'mdi-truck-outline':'suppliers',
  'mdi-menu':'menu','mdi-star-four-points':'spark','mdi-magnify':'search','mdi-arrow-top-right':'northeast',
  'mdi-bell-outline':'bell','mdi-chevron-down':'down','mdi-chevron-right':'right','mdi-chevron-left':'left','mdi-dots-vertical':'more',
  'mdi-chart-box':'revenue','mdi-chart-line':'profit','mdi-account-multiple':'people','mdi-account-group':'people','mdi-account-clock':'pending',
  'mdi-view-grid-outline':'grid','mdi-layers-triple-outline':'layers','mdi-cog':'services','mdi-run':'services',
  'mdi-clock-outline':'pending','mdi-progress-clock':'progress','mdi-clock-alert-outline':'pending',
  'mdi-file-clock':'documentClock','mdi-file-clock-outline':'documentClock','mdi-file-document':'document','mdi-file-document-outline':'document',
  'mdi-check-circle':'check','mdi-check-circle-outline':'check','mdi-check-decagram-outline':'check',
  'mdi-close-circle':'cancel','mdi-close-circle-outline':'cancel','mdi-wallet':'wallet','mdi-wallet-outline':'wallet',
  'mdi-calendar-month':'calendar','mdi-calendar':'calendar','mdi-alert-circle':'alert','mdi-alert-octagon-outline':'alert','mdi-plus-circle':'plus'
};
const name = computed(() => aliases[props.icon] || 'grid');
const paths = computed(() => artwork[name.value]);
const iconStyle = computed(() => ({
  '--dashboard-icon-size': `${(Number(props.size) || 24) * 0.7}px`,
  color: props.color ? (props.color.startsWith('#') || props.color.startsWith('rgb') ? props.color : `rgb(var(--v-theme-${props.color}))`) : undefined
}));
</script>

<style scoped>
.dashboard-icon { display:inline-block; width:1em; height:1em; font-size:var(--dashboard-icon-size); flex-shrink:0; vertical-align:middle; }
</style>
