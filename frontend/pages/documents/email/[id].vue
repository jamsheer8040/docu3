<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-5">
      <div><h1 class="text-h4">Email expiry reminder</h1><p class="text-body-2 text-medium-emphasis mt-2">Review the recipient and message before sending.</p></div>
      <v-btn to="/documents" variant="text" prepend-icon="mdi-arrow-left">Documents</v-btn>
    </div>
    <v-card class="pa-5 mx-auto" max-width="1000" rounded="xl" flat>
      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
      <v-alert v-if="loaded && !configured" type="warning" variant="tonal" class="mb-5">
        Configure the company sender account in Settings → Email before sending.
        <v-btn v-if="auth.can('settings')" to="/settings?tab=email" variant="text" size="small">Email settings</v-btn>
      </v-alert>
      <v-form v-if="loaded" ref="composeForm" @submit.prevent="send">
        <v-text-field :model-value="fromLabel" label="From" readonly variant="outlined" class="mb-2" />
        <v-text-field v-model="form.to" label="To" type="email" :rules="[value => validEmail(value) || 'Enter a valid email address']" variant="outlined" class="mb-2" :disabled="sending" />
        <v-text-field v-model="form.cc" label="CC (optional)" hint="Separate additional email addresses with commas." persistent-hint variant="outlined" class="mb-4" :disabled="sending" />
        <v-text-field v-model="form.subject" label="Subject" maxlength="250" :rules="[value => !!value?.trim() || 'Subject is required']" variant="outlined" class="mb-2" :disabled="sending" />
        <v-textarea v-model="form.body" label="Message" rows="12" auto-grow maxlength="20000" :rules="[value => !!value?.trim() || 'Message is required']" variant="outlined" :disabled="sending" />
        <div class="d-flex justify-end ga-3 mt-3">
          <v-btn to="/documents" variant="text" :disabled="sending">Cancel</v-btn>
          <v-btn type="submit" color="primary" prepend-icon="mdi-send" :loading="sending" :disabled="!configured || sending">Send email</v-btn>
        </div>
      </v-form>
    </v-card>
  </v-container>
</template>
<script setup>
import { useAuthStore } from '~/stores/auth';
import { useUIStore } from '~/stores/ui';
const { $api } = useNuxtApp(), route = useRoute(), auth = useAuthStore(), ui = useUIStore();
const loading = ref(false), loaded = ref(false), sending = ref(false), configured = ref(false), error = ref(''), composeForm = ref(null);
const form = ref({ to: '', cc: '', subject: '', body: '' }), from = ref({ email: '', name: '' });
const fromLabel = computed(() => from.value.email ? `${from.value.name} <${from.value.email}>` : 'Sender not configured');
const validEmail = value => typeof value === 'string' && value.length <= 250 && /^[^\s@<>;,\r\n]+@[^\s@<>;,\r\n]+\.[^\s@<>;,\r\n]+$/.test(value.trim());
let version = 0;
async function load() {
  const current = ++version; loaded.value = false; configured.value = false; loading.value = true; error.value = '';
  try {
    if (!/^\d+$/.test(String(route.params.id))) throw new Error('Invalid document.');
    const { data } = await $api.get(`/email/documents/${route.params.id}/reminder`);
    if (current !== version) return;
    form.value = { to: data.data.to, cc: '', subject: data.data.subject, body: data.data.body };
    from.value = { email: data.data.from_email, name: data.data.from_name }; configured.value = data.data.configured; loaded.value = true;
  } catch (err) { if (current === version) error.value = err.response?.data?.message || 'Unable to load the document reminder.'; }
  finally { if (current === version) loading.value = false; }
}
async function send() {
  if (sending.value || !loaded.value || !configured.value) return;
  error.value = '';
  const result = await composeForm.value?.validate();
  if (!result?.valid || sending.value) return;
  const cc = [...new Set(form.value.cc.split(/[;,\n]/).map(value => value.trim()).filter(Boolean))];
  if (cc.length > 20 || cc.some(value => !validEmail(value))) { error.value = 'Add no more than 20 valid CC email addresses, separated by commas.'; return; }
  sending.value = true;
  try {
    const response = await $api.post(`/email/documents/${route.params.id}/reminder`, { ...form.value, cc });
    if (!response.data.success) { error.value = response.data.message || 'Unable to send email.'; return; }
    ui.showSuccess(response.data.message || 'Expiry reminder email sent.');
    await navigateTo('/documents');
  } catch (err) { error.value = err.response?.data?.message || 'Unable to send email. Check the email configuration and try again.'; }
  finally { sending.value = false; }
}
onMounted(load);
watch(() => route.params.id, load);
onBeforeUnmount(() => { ++version; });
</script>
