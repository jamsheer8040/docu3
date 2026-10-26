<template>
  <svg class="supplier-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(path, index) in artwork[name]" :key="index" :d="path" />
  </svg>
</template>

<script setup>
defineProps({ name: { type: String, required: true } });
const artwork = {
  billed: ['M6 3h12a1 1 0 0 1 1 1v17l-3-2-4 2-4-2-3 2V4a1 1 0 0 1 1-1Z', 'M9 8h6M9 12h6M9 16h3'],
  paid: ['M13 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-5', 'M3 9h10M17 3h4v4M14 10l7-7', 'M17 15h4M17 18h.01'],
  balance: ['M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6M8 8h4M8 12h2', 'M21 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM16 13v3l2 1'],
  settlement: ['M5 17a8 8 0 1 1 14 0', 'M12 12l4-4M8 20h8', 'M6 8l1 1M12 4v2M18 8l-1 1']
};
</script>

<style scoped>
.supplier-summary-icon { display:block; width:24px; height:24px; flex-shrink:0; }
</style>
