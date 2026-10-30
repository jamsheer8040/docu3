<template>
  <button
    type="button"
    class="service-invoice-badge"
    :class="{ 'service-invoice-badge--paid': paid }"
    :aria-label="`${invoice.invoice_number} — ${paid ? 'Fully paid' : 'Not fully paid'}. View invoice`"
    :title="paid ? 'Invoice fully paid' : 'View invoice — payment outstanding'"
    @click.stop="$emit('open', invoice)"
  >
    <span class="service-invoice-badge__number">{{ invoice.invoice_number }}</span>
    <span v-if="paid" class="service-invoice-badge__check" aria-hidden="true"><v-icon icon="mdi-check" size="15" /></span>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { isServiceInvoicePaid } from '~/utils/serviceInvoice.mjs';
const props = defineProps({ invoice: { type: Object, required: true } });
defineEmits(['open']);
const paid = computed(() => isServiceInvoicePaid(props.invoice));
</script>

<style scoped>
.service-invoice-badge {
  display: inline-flex; align-items: stretch; vertical-align: middle;
  max-width: 100%; height: 22px; overflow: hidden; padding: 0;
  border: 0; border-radius: 999px; background: #e1ebe7; color: #438a72;
  font: inherit; font-size: 10px; font-weight: 750; cursor: pointer;
}
.service-invoice-badge__number { display: flex; align-items: center; padding: 0 13px; white-space: nowrap; }
.service-invoice-badge--paid { background: #dce7e1; color: #235c40; }
.service-invoice-badge--paid .service-invoice-badge__number { padding-right: 16px; border-radius: 0 0 13px 0; position: relative; z-index: 1; background: #dce7e1; }
.service-invoice-badge__check { display: flex; align-items: center; justify-content: center; min-width: 37px; margin-left: -10px; padding: 0 10px 0 15px; background: #235c40; color: #fff; }
.service-invoice-badge:hover { filter: brightness(.96); }
.service-invoice-badge:focus-visible { outline: 2px solid #438a72; outline-offset: 3px; }
</style>
