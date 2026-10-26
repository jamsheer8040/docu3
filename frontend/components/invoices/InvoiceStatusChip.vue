<template>
  <v-chip
    :color="statusColor"
    :variant="variant"
    size="small"
    class="font-weight-bold"
    :data-status="status"
    label
  >
    <v-icon v-if="icon" start :icon="icon" size="x-small"></v-icon>
    {{ status }}
  </v-chip>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'tonal'
  }
});

const statusColor = computed(() => {
  const colors = {
    'Draft': 'grey',
    'Sent': 'info',
    'Partially Paid': 'orange-darken-1',
    'Paid': 'success',
    'Overdue': 'error',
    'Cancelled': 'error-darken-1'
  };
  return colors[props.status] || 'grey';
});

const icon = computed(() => {
  const icons = {
    'Draft': 'mdi-pencil-box-outline',
    'Sent': 'mdi-send-outline',
    'Partially Paid': 'mdi-cash-clock',
    'Paid': 'mdi-check-circle-outline',
    'Overdue': 'mdi-alert-circle-outline',
    'Cancelled': 'mdi-close-circle-outline'
  };
  return icons[props.status] || null;
});
</script>
