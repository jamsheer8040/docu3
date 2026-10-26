<template>
  <div class="tracking-period-select" role="group" :aria-label="label">
    <v-btn v-for="option in trackingPeriods" :key="option.value" :aria-pressed="modelValue === option.value" :variant="modelValue === option.value ? 'flat' : 'text'" :color="modelValue === option.value ? 'primary' : undefined" rounded="pill" :size="compact ? 'x-small' : 'default'" class="text-none" @click="$emit('update:modelValue', option.value)">{{ option.title }}</v-btn>
  </div>
</template>
<script setup>
import { trackingPeriods } from '~/utils/trackingPeriods';
defineProps({ modelValue: String, label: { type: String, default: 'Tracking period' }, compact: Boolean });
defineEmits(['update:modelValue']);
</script>
<style scoped>
.tracking-period-select { display:inline-flex; flex-wrap:wrap; padding:4px; gap:2px; border-radius:999px; background:rgba(var(--v-theme-on-surface),.04); max-width:100%; }
</style>
