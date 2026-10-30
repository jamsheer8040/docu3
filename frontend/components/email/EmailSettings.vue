<template>
  <div>
    <v-card class="soft-card pa-6 mb-6" variant="flat">
      <div class="d-flex align-center mb-6">
        <v-icon color="primary" size="28" class="mr-3">mdi-email-cog</v-icon>
        <div>
          <h2 class="text-h6 font-weight-bold">Email Configuration (SMTP)</h2>
          <p class="text-caption text-secondary">Connect your business email account to send emails directly from the platform.</p>
        </div>
      </div>
      <v-alert variant="tonal" color="primary" class="mb-5">
        <div class="d-flex align-center justify-space-between flex-wrap ga-3">
          <div><strong>Send from Gmail</strong><div class="text-body-2 mt-1">Enable Google 2-Step Verification and use an App Password here. Port 587 uses STARTTLS.</div><a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer">Google App Password setup</a></div>
          <v-btn variant="outlined" color="primary" :disabled="!auth.can('settings', 'write') || saving || testing" @click="useGmail">Use Gmail settings</v-btn>
        </div>
      </v-alert>

      <v-row>
        <v-col cols="12" sm="8">
          <v-text-field v-model="form.smtp_host" label="SMTP Host" placeholder="smtp.gmail.com" variant="outlined" density="comfortable" class="mb-3" />
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field v-model="form.smtp_port" label="Port" placeholder="587" type="number" variant="outlined" density="comfortable" class="mb-3" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field v-model="form.smtp_user" label="Email / Username" placeholder="you@company.com" variant="outlined" density="comfortable" class="mb-3" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field v-model="form.smtp_pass" label="Password / App Password" type="password" autocomplete="new-password" placeholder="••••••••" hint="For Gmail, enter your Google App Password." variant="outlined" density="comfortable" class="mb-3" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field v-model="form.smtp_from_name" label="From Name" placeholder="DocClear" variant="outlined" density="comfortable" class="mb-3" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field v-model="form.smtp_from_email" label="From Email" placeholder="no-reply@company.com" variant="outlined" density="comfortable" class="mb-3" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-switch v-model="form.smtp_secure" label="Use SSL/TLS (port 465)" color="primary" inset density="comfortable" />
        </v-col>
      </v-row>

      <v-divider class="my-4" />
      <h3 class="text-subtitle-1 font-weight-bold mb-3">Automated Emails</h3>
      <v-row>
        <v-col cols="12" sm="6">
          <v-switch v-model="form.email_auto_invoice" label="Auto-send email when invoice is issued" color="primary" inset density="comfortable" />
        </v-col>
        <v-col cols="12" sm="6">
          <v-switch v-model="form.email_auto_document_reminder" label="Auto-send document expiry reminders" color="primary" inset density="comfortable" />
        </v-col>
      </v-row>

      <div class="d-flex align-center gap-3 mt-4 flex-wrap">
        <v-btn class="btn-standard" :loading="saving" :disabled="testing || !auth.can('settings', 'write')" @click="save()">
          <v-icon start>mdi-content-save</v-icon> Save Settings
        </v-btn>
        <v-btn variant="outlined" color="primary" :loading="testing" :disabled="saving || !auth.can('settings', 'write')" @click="testConnection">
          <v-icon start>mdi-wifi</v-icon> Save &amp; Test Connection
        </v-btn>
        <v-chip v-if="testResult" :color="testResult.success ? 'success' : 'error'" variant="flat" size="small">
          {{ testResult.success ? 'Connection OK ✓' : testResult.message }}
        </v-chip>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useNuxtApp } from '#app'
import { useUIStore } from '~/stores/ui'
import { useAuthStore } from '~/stores/auth'

const { $api } = useNuxtApp()
const uiStore = useUIStore()
const auth = useAuthStore()

const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

const form = ref({
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from_name: '',
  smtp_from_email: '',
  smtp_secure: false,
  email_auto_invoice: false,
  email_auto_document_reminder: false
})

const load = async () => {
  try {
    const res = await $api.get('/email/smtp')
    const d = res.data.data
    form.value = {
      smtp_host: d.smtp_host || '',
      smtp_port: d.smtp_port || '587',
      smtp_user: d.smtp_user || '',
      smtp_pass: d.smtp_pass || '',
      smtp_from_name: d.smtp_from_name || '',
      smtp_from_email: d.smtp_from_email || '',
      smtp_secure: d.smtp_secure === 'true',
      email_auto_invoice: d.email_auto_invoice === 'true',
      email_auto_document_reminder: d.email_auto_document_reminder === 'true'
    }
  } catch (err) {
    console.error(err)
  }
}

const useGmail = () => {
  form.value.smtp_host = 'smtp.gmail.com'
  form.value.smtp_port = '587'
  form.value.smtp_secure = false
  if (!form.value.smtp_from_email) form.value.smtp_from_email = form.value.smtp_user
  testResult.value = null
}

const save = async (notify = true) => {
  if (saving.value) return false
  saving.value = true
  try {
    await $api.post('/email/smtp', {
      ...form.value,
      smtp_secure: String(form.value.smtp_secure),
      email_auto_invoice: String(form.value.email_auto_invoice),
      email_auto_document_reminder: String(form.value.email_auto_document_reminder)
    })
    if (notify) uiStore.showSuccess('SMTP settings saved successfully!')
    return true
  } catch (err) {
    uiStore.showError(err.response?.data?.message || 'Failed to save SMTP settings')
    return false
  } finally {
    saving.value = false
  }
}

const testConnection = async () => {
  if (testing.value || saving.value) return
  testing.value = true
  testResult.value = null
  try {
    if (!await save(false)) return
    const res = await $api.post('/email/smtp/test')
    testResult.value = res.data
    if (res.data.success) uiStore.showSuccess('SMTP connection successful!')
    else uiStore.showError(res.data.message || 'Connection failed')
  } catch (err) {
    testResult.value = { success: false, message: 'Connection failed' }
    uiStore.showError('Connection test failed')
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>
