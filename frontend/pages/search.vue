<template>
  <v-container fluid class="pa-6">
    <h1 class="text-h4 mb-2">Search</h1>
    <p class="text-body-2 text-medium-emphasis mb-5">Find customers, leads and their transactions in your company.</p>
    <form class="d-flex ga-3 mb-5" @submit.prevent="submit">
      <v-text-field v-model="text" label="Name, phone, email or document number" prepend-inner-icon="mdi-magnify" variant="solo" flat hide-details maxlength="100" />
      <v-btn type="submit" color="primary" height="56">Search</v-btn>
    </form>
    <v-card rounded="xl" flat class="pa-3">
      <p v-if="query.length < 2" class="pa-4 text-body-2">Enter at least two characters to search.</p>
      <RecordSearchResults v-else :groups="groups" :query="query" :loading="loading" :error="error" full @retry="fetchResults()" @page="fetchResults" />
    </v-card>
  </v-container>
</template>
<script setup>
import RecordSearchResults from '~/components/search/RecordSearchResults.vue';
const route = useRoute();
const query = computed(() => String(route.query.q || '').trim().slice(0, 100));
const text = ref(query.value);
watch(query, value => { text.value = value; });
const { groups, loading, error, fetchResults } = useRecordSearch(query, 20);
function submit() { navigateTo({ path: '/search', query: { q: text.value.trim() } }, { replace: true }); }
</script>
