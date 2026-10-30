<template>
  <v-card class="mb-3 document-card border cursor-pointer" border @click="$emit('preview', document.file_path)">
    <v-card-item>
      <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center">
        <v-icon :icon="getTypeIcon(document.DocumentType?.name || document.type)" size="small" class="mr-2" color="primary"></v-icon>
        {{ document.DocumentType?.name || document.type }}
      </v-card-title>
      <v-card-subtitle class="mt-1 d-flex justify-space-between align-center">
        <span>{{ document.Customer?.name || 'Unknown Customer' }}</span>
        <v-chip :color="getUrgencyColor" size="x-small" variant="tonal" class="font-weight-bold">
          {{ daysRemainingText }}
        </v-chip>
      </v-card-subtitle>
    </v-card-item>

    <v-card-text class="pt-0 pb-2">
      <div class="d-flex flex-column gap-1 text-caption">
        <div v-show="document.doc_number" class="text-truncate">
          <v-icon size="x-small" icon="mdi-pound" class="mr-1"></v-icon>
          <strong>No:</strong> {{ document.doc_number }}
        </div>
        <div v-show="document.staff_name" class="text-truncate">
          <v-icon size="x-small" icon="mdi-account-outline" class="mr-1"></v-icon>
          <strong>Staff:</strong> {{ document.staff_name }}
        </div>
        <div>
          <v-icon size="x-small" icon="mdi-calendar-remove" class="mr-1 text-error"></v-icon>
          <strong>Expires:</strong> {{ formatDate(document.expiry_date) }}
        </div>
      </div>
    </v-card-text>

    <v-divider></v-divider>

    <v-card-actions class="px-3 py-2 d-flex justify-space-between flex-wrap ga-1">
        <div>
          <v-btn
            v-if="document.file_path"
            icon="mdi-eye-outline"
            size="small"
            variant="text"
            color="info"
            @click.stop="$emit('preview', document.file_path)"
            title="View Document"
          ></v-btn>
          <v-btn
            v-if="auth.can('documents', 'write')"
            icon="mdi-pencil-outline"
            size="small"
            variant="text"
            color="primary"
            @click.stop="$emit('edit', props.document)"
            title="Edit Document"
          ></v-btn>
         <v-btn
           v-if="auth.can('documents', 'delete')"
           icon="mdi-delete-outline"
           size="small"
           variant="text"
           color="error"
           @click.stop="$emit('delete', props.document)"
           title="Delete Document"
         ></v-btn>
       </div>
       <v-btn v-if="auth.user?.role_type !== 'CustomerPortal' && auth.canRecord('documents', 'edit_form', document)" icon="mdi-email-outline" variant="text" color="primary" size="small" title="Email expiry reminder" aria-label="Email expiry reminder" :to="`/documents/email/${document.id}`" @click.stop />
       <v-btn
        v-if="document.Customer?.phone_whatsapp && auth.user?.role_type !== 'CustomerPortal'"
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-whatsapp"
        @click.stop="sendReminder"
       >
         Remind ({{ document.reminder_count || 0 }})
       </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { computed } from 'vue';
import { useWhatsApp } from '~/composables/useWhatsApp';
import { useAuthStore } from '~/stores/auth';
import { useDocumentStore } from '~/stores/documents';

const auth = useAuthStore();
const documentStore = useDocumentStore();
const config = useRuntimeConfig();
const props = defineProps({
  document: {
    type: Object,
    required: true
  }
});

defineEmits(['edit', 'delete', 'preview']);

const { openWhatsApp, MESSAGES } = useWhatsApp();

const getUrgencyColor = computed(() => {
  const diff = daysRemaining.value;
  if (diff < 0) return 'error';
  if (diff <= 7) return 'error';
  if (diff <= 14) return 'warning';
  if (diff <= 30) return 'info';
  return 'success';
});

const daysRemaining = computed(() => {
  if (!props.document.expiry_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(props.document.expiry_date);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
});

const daysRemainingText = computed(() => {
  const diff = daysRemaining.value;
  if (diff === null) return 'N/A';
  if (diff < 0) return `Expired by ${Math.abs(diff)} days`;
  if (diff === 0) return 'Expires Today';
  if (diff === 1) return 'Expires Tomorrow';
  return `In ${diff} days`;
});

const getTypeIcon = (type) => {
  const icons = {
    'Visa': 'mdi-passport',
    'Passport': 'mdi-book-open-page-variant',
    'TradeLicense': 'mdi-certificate',
    'EmiratesID': 'mdi-card-account-details',
    'MedicalFitness': 'mdi-medical-bag',
    'Other': 'mdi-file-document-outline'
  };
  return icons[type] || 'mdi-file-document-outline';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GB').format(date);
};

const sendReminder = async () => {
  if (!props.document.Customer?.phone_whatsapp) return;
  const num = props.document.Customer.phone_whatsapp;
  const msg = MESSAGES.docReminder(
    props.document.Customer.name,
    props.document.DocumentType?.name || props.document.type,
    props.document.doc_number || 'N/A',
    formatDate(props.document.expiry_date)
  );
  openWhatsApp(num, msg);

  try {
    await documentStore.incrementReminderCount(props.document.id);
  } catch (err) {
    console.error('Failed to increment reminder count:', err);
  }
};
</script>

<style scoped>
.document-card {
  transition: all 0.2s ease-in-out;
  border-color: #E0E0E0 !important;
}
.document-card:hover {
  transform: translateY(-4px);
  border-color: #0B57D0 !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
}
</style>
