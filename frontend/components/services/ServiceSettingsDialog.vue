<template>
  <v-card class="rounded-xl">
    <v-card-title class="pa-6 d-flex align-center">
      <div class="text-h6 font-weight-bold">
        <v-icon icon="mdi-cog" class="mr-2" color="primary"></v-icon>
        Service Settings
      </div>
      <v-spacer></v-spacer>
      <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('close')"></v-btn>
    </v-card-title>

    <v-card-text class="pt-0">
      <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">{{ loadError }}<v-btn size="small" variant="text" @click="fetchConfig">Retry</v-btn></v-alert>
      <v-alert type="info" variant="tonal" class="mb-4 text-caption" border="start">
        Configure the number of days before active service orders are automatically escalated to a higher criticality level.
      </v-alert>

      <v-form v-if="!loading" ref="form" @submit.prevent="save">
        <h3 class="text-subtitle-2 font-weight-bold mb-3">Normal Service Escalation</h3>
        <v-row dense class="mb-4">
          <v-col cols="6">
            <v-text-field
              v-model.number="config.svc_escalation_normal_to_moderate_days"
              label="Normal → Moderate"
              suffix="days"
              type="number"
              min="1"
              variant="outlined"
              density="comfortable"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="config.svc_escalation_normal_to_critical_days"
              label="Moderate → Critical (from start)"
              suffix="days"
              type="number"
              min="1"
              variant="outlined"
              density="comfortable"
              hide-details
            ></v-text-field>
          </v-col>
        </v-row>

        <h3 class="text-subtitle-2 font-weight-bold mb-3">Moderate Service Escalation</h3>
        <v-row dense class="mb-4">
          <v-col cols="12">
            <v-text-field
              v-model.number="config.svc_escalation_moderate_to_critical_days"
              label="Moderate → Critical"
              suffix="days"
              type="number"
              min="1"
              variant="outlined"
              density="comfortable"
              hide-details
            ></v-text-field>
          </v-col>
        </v-row>

        <v-divider class="my-4"></v-divider>

        <div class="d-flex align-center justify-space-between flex-wrap gap-2">
          <div>
            <h3 class="text-subtitle-2 font-weight-bold">Trigger Escalation Engine</h3>
            <p class="text-caption text-grey">Manually evaluate active orders against the configured escalation periods.</p>
          </div>
          <v-btn
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-flash"
            :loading="escalating"
            @click="triggerEscalation"
          >
            Run Escalation Now
          </v-btn>
        </div>
        <v-divider class="my-4" />
        <div class="d-flex align-center justify-space-between ga-2 mb-2"><h3 class="text-subtitle-2 font-weight-bold">Card Footer Colours</h3><v-btn size="small" variant="text" @click="resetFooterColours">Reset to defaults</v-btn></div>
        <p class="text-caption text-medium-emphasis mb-2">Footer colours for this workspace.</p>
        <v-row dense class="mb-4">
          <v-col v-for="field in serviceFooterFields" :key="field.key" cols="6" sm="4">
            <div class="footer-colour-field pa-2 h-100 rounded-lg border">
              <label :for="`service-footer-${field.key}`" class="text-caption font-weight-bold">{{ field.label }}</label>
              <input :id="`service-footer-${field.key}`" v-model="config.service_footer_colors[field.key]" type="color" :aria-label="`${field.label} footer colour`" :title="config.service_footer_colors[field.key]" />
            </div>
          </v-col>
        </v-row>
      </v-form>

      <div v-else class="d-flex justify-center my-6">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </v-card-text>

    <v-card-actions class="pa-6 pt-0">
      <v-spacer></v-spacer>
      <v-btn variant="text" color="grey-darken-1" @click="$emit('close')">Cancel</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        class="px-6"
        :loading="saving"
        :disabled="loading || !!loadError"
        @click="save"
      >
        Save Settings
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {serviceFooterDefaults,serviceFooterFields,serviceFooterColors} from '~/utils/serviceAppearance';

const emit = defineEmits(['close', 'success', 'error']);

const config = ref({
  svc_escalation_normal_to_moderate_days: 2,
  svc_escalation_normal_to_critical_days: 4,
  svc_escalation_moderate_to_critical_days: 2,
  service_footer_colors:{...serviceFooterDefaults}
});

const loading = ref(false);
const saving = ref(false);
const escalating = ref(false);
const loadError=ref('');
const resetFooterColours=()=>{config.value.service_footer_colors={...serviceFooterDefaults};};

const fetchConfig = async () => {
  loading.value = true;
  loadError.value='';
  try {
    const { $api } = useNuxtApp();
    const response = await $api.get('/services/config/criticality');
    if (response.data?.success && response.data.data) {
      config.value = {
        svc_escalation_normal_to_moderate_days: response.data.data.svc_escalation_normal_to_moderate_days ?? 2,
        svc_escalation_normal_to_critical_days: response.data.data.svc_escalation_normal_to_critical_days ?? 4,
        svc_escalation_moderate_to_critical_days: response.data.data.svc_escalation_moderate_to_critical_days ?? 2,
        service_footer_colors:serviceFooterColors(response.data.data.service_footer_colors)
      };
    }
  } catch (err) {
    console.error('Failed to fetch criticality config', err);
    loadError.value='Unable to load service settings. Retry before saving.';
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  if(loading.value || loadError.value)return;
  saving.value = true;
  try {
    const { $api } = useNuxtApp();
    const response = await $api.put('/services/config/criticality', config.value);
    if (response.data?.success) {
      emit('success', 'Workflow settings saved successfully');
      emit('close');
    } else {
      emit('error', 'Failed to save settings');
    }
  } catch (err) {
    emit('error', err.response?.data?.message || 'Failed to save settings');
  } finally {
    saving.value = false;
  }
};

const triggerEscalation = async () => {
  escalating.value = true;
  try {
    const { $api } = useNuxtApp();
    const response = await $api.post('/services/orders/escalate');
    if (response.data?.success) {
      emit('success', response.data.message || 'Escalation trigger complete');
    } else {
      emit('error', 'Escalation execution failed');
    }
  } catch (err) {
    emit('error', err.response?.data?.message || 'Failed to trigger escalation');
  } finally {
    escalating.value = false;
  }
};

onMounted(() => {
  fetchConfig();
});
</script>
<style scoped>
.footer-colour-field{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:46px}
.footer-colour-field label{line-height:15px;font-size:11px!important;cursor:pointer}
.footer-colour-field input[type=color]{flex-shrink:0;width:32px;height:26px;padding:2px;border:1px solid rgba(var(--v-border-color),.3);border-radius:7px;cursor:pointer;background:transparent}

</style>
