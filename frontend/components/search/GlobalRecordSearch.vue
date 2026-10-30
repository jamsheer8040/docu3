<template>
  <div v-click-outside="() => opened = false" class="global-record-search">
    <v-icon icon="mdi-magnify" size="20" />
    <input v-model="query" aria-label="Search customer names, transactions and documents" placeholder="Search anything…" maxlength="100" :aria-expanded="opened && query.trim().length >= 2" aria-controls="global-record-results" @focus="opened = true" @input="opened = true" @keydown.esc="opened = false" @keydown.enter.prevent="viewAll" />
    <div v-if="opened && query.trim().length >= 2" id="global-record-results" class="global-record-dropdown">
      <RecordSearchResults :groups="groups" :query="query" :loading="loading" :error="error" @select="opened = false" @retry="fetchResults()" />
    </div>
  </div>
</template>
<script setup>
import RecordSearchResults from './RecordSearchResults.vue';
const query = ref(''), opened = ref(false);
const { groups, loading, error, fetchResults } = useRecordSearch(query);
function viewAll() { if (query.value.trim().length >= 2) { opened.value = false; navigateTo({ path: '/search', query: { q: query.value.trim() } }); } }
</script>
<style scoped>
.global-record-search { position:relative; display:flex; align-items:center; gap:8px; background:rgba(var(--v-theme-surface),.9); border-radius:28px; padding:10px 15px; width:230px; color:rgba(var(--v-theme-on-surface),.65); }
input { min-width:0; width:100%; outline:none; font-size:12px; }
.global-record-dropdown { position:absolute; z-index:100; top:calc(100% + 8px); right:0; width:460px; max-width:calc(100vw - 32px); max-height:65vh; overflow-y:auto; background:rgb(var(--v-theme-surface)); color:rgb(var(--v-theme-on-surface)); border-radius:18px; padding:8px; box-shadow:0 12px 30px rgba(var(--v-theme-primary),.2); }
@media(max-width:959px) { .global-record-search { flex:1; } }
</style>
