<script setup>
definePageMeta({
  middleware: [
    function () {
      return navigateTo('/settings?tab=users');
    }
  ]
});
</script>

<template>
  <div class="d-flex justify-center align-center py-16">
    <v-progress-circular indeterminate color="primary"></v-progress-circular>
  </div>
</template>
