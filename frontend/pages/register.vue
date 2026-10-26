<template>
  <v-container fluid fill-height class="register-container py-12 px-6">
    <v-row align="center" justify="center" class="ma-0">
      <v-col cols="12" sm="10" md="8" lg="6" xl="5" class="d-flex justify-center">
        <v-card class="pa-8 pb-10 rounded-2xl glass-card w-100" max-width="640" variant="flat">
          
          <div class="text-center mb-6">
            <v-avatar color="primary" size="64" variant="flat" rounded="lg" class="mb-4 shadow-glow">
              <v-icon size="36" color="white">mdi-domain-plus</v-icon>
            </v-avatar>
            <h1 class="text-h4 font-weight-black text-gradient mb-1">Create Your Workspace</h1>
            <p class="text-subtitle-1 text-secondary font-weight-medium">Get started with DocClear SaaS in minutes</p>
          </div>

          <v-stepper v-model="step" :items="['Workspace', 'Select Plan', 'Admin Account']" hide-actions class="elevation-0 bg-transparent">
            <template v-slot:item.1>
              <v-card title="Workspace Information" variant="flat" class="bg-transparent mt-4">
                <v-form ref="workspaceForm" @submit.prevent="nextStep(1)">
                  <v-text-field
                    v-model="state.companyName"
                    label="Company / Business Name"
                    prepend-inner-icon="mdi-briefcase-outline"
                    placeholder="e.g. Acme Services"
                    :error-messages="v$.companyName.$errors.map(e => e.$message)"
                    @blur="v$.companyName.$touch"
                    class="mb-4"
                  ></v-text-field>

                  <v-text-field
                    v-model="state.slug"
                    label="Workspace URL Slug"
                    prepend-inner-icon="mdi-link-variant"
                    placeholder="e.g. acme"
                    suffix=".docclear.com"
                    hint="Lowercase letters, numbers, and dashes only"
                    persistent-hint
                    :error-messages="v$.slug.$errors.map(e => e.$message)"
                    @blur="v$.slug.$touch"
                    class="mb-6"
                  ></v-text-field>

                  <v-btn
                    color="primary"
                    block
                    size="large"
                    height="54"
                    class="font-weight-bold rounded-xl mt-4"
                    @click="nextStep(1)"
                  >
                    Choose Subscription Plan
                  </v-btn>
                </v-form>
              </v-card>
            </template>

            <template v-slot:item.2>
              <v-card title="Choose Your Plan" variant="flat" class="bg-transparent mt-4 text-center">
                <div class="text-subtitle-1 mb-6 text-secondary">Prices shown are starting monthly rates. You will not be billed until your workspace is approved and activated.</div>

                <v-row class="justify-center">
                  <v-col
                    v-for="plan in plans"
                    :key="plan.id"
                    cols="12"
                    sm="6"
                    class="d-flex"
                  >
                    <v-card
                      class="plan-card w-100 pa-6 rounded-xl d-flex flex-column"
                      :class="state.planId === plan.id ? 'plan-selected' : 'plan-unselected'"
                      @click="selectPlan(plan.id)"
                      variant="outlined"
                      style="cursor: pointer;"
                    >
                      <div class="text-h6 font-weight-black mb-1">{{ plan.name }}</div>
                      <div class="d-flex align-baseline justify-center my-3">
                        <span class="text-h4 font-weight-black text-primary">AED {{ plan.price_monthly }}</span>
                        <span class="text-caption text-secondary ml-1">/mo</span>
                      </div>
                      
                      <v-divider class="my-3 opacity-10"></v-divider>
                      
                      <div class="flex-grow-1 text-left">
                        <div class="d-flex align-center text-body-2 mb-2">
                          <v-icon icon="mdi-account-multiple-outline" size="18" color="primary" class="mr-2"></v-icon>
                          <span>Up to <strong>{{ plan.max_users === -1 || !plan.max_users ? 'Unlimited' : plan.max_users }}</strong> users</span>
                        </div>
                        <div class="d-flex align-center text-body-2 mb-2">
                          <v-icon icon="mdi-account-group-outline" size="18" color="primary" class="mr-2"></v-icon>
                          <span>Up to <strong>{{ plan.max_customers === -1 || !plan.max_customers ? 'Unlimited' : plan.max_customers }}</strong> customers</span>
                        </div>
                        <div class="d-flex align-center text-body-2 mb-2">
                          <v-icon icon="mdi-file-document-outline" size="18" color="primary" class="mr-2"></v-icon>
                          <span>Up to <strong>{{ plan.max_documents === -1 || !plan.max_documents ? 'Unlimited' : plan.max_documents }}</strong> documents</span>
                        </div>
                        <div class="d-flex align-center text-body-2 mb-2">
                          <v-icon icon="mdi-wallet-outline" size="18" color="primary" class="mr-2"></v-icon>
                          <span>Up to <strong>{{ plan.max_wallet_accounts === -1 || !plan.max_wallet_accounts ? 'Unlimited' : plan.max_wallet_accounts }}</strong> bank accounts</span>
                        </div>
                      </div>

                      <v-btn
                        variant="flat"
                        :color="state.planId === plan.id ? 'primary' : 'secondary'"
                        block
                        class="mt-4 font-weight-bold rounded-lg"
                      >
                        {{ state.planId === plan.id ? 'Selected' : 'Select Plan' }}
                      </v-btn>
                    </v-card>
                  </v-col>
                </v-row>

                <div class="d-flex justify-space-between mt-4">
                  <v-btn variant="outlined" color="primary" rounded="xl" @click="step = 1">Back</v-btn>
                  <v-btn color="primary" rounded="xl" :disabled="!state.planId" @click="step = 3">Next</v-btn>
                </div>
              </v-card>
            </template>

            <template v-slot:item.3>
              <v-card title="Owner/Admin Account Setup" variant="flat" class="bg-transparent mt-4">
                <v-form ref="accountForm" @submit.prevent="handleRegister">
                  <v-text-field
                    v-model="state.name"
                    label="Full Name"
                    prepend-inner-icon="mdi-account-outline"
                    placeholder="e.g. John Doe"
                    :error-messages="v$.name.$errors.map(e => e.$message)"
                    @blur="v$.name.$touch"
                    class="mb-4"
                  ></v-text-field>

                  <v-text-field
                    v-model="state.email"
                    label="Email Address"
                    prepend-inner-icon="mdi-email-outline"
                    placeholder="john@example.com"
                    type="email"
                    :error-messages="v$.email.$errors.map(e => e.$message)"
                    @blur="v$.email.$touch"
                    class="mb-4"
                  ></v-text-field>

                  <v-text-field
                    v-model="state.password"
                    label="Password"
                    prepend-inner-icon="mdi-lock-outline"
                    type="password"
                    :error-messages="v$.password.$errors.map(e => e.$message)"
                    @blur="v$.password.$touch"
                    class="mb-4"
                  ></v-text-field>

                  <v-text-field
                    v-model="state.confirmPassword"
                    label="Confirm Password"
                    prepend-inner-icon="mdi-lock-check-outline"
                    type="password"
                    :error-messages="v$.confirmPassword.$errors.map(e => e.$message)"
                    @blur="v$.confirmPassword.$touch"
                    class="mb-6"
                  ></v-text-field>

                  <v-alert
                    v-if="error"
                    type="error"
                    closable
                    class="mb-6 rounded-xl"
                  >
                    {{ error }}
                  </v-alert>

                  <div class="d-flex justify-space-between align-center mt-4">
                    <v-btn variant="outlined" color="primary" rounded="xl" @click="step = 2">Back</v-btn>
                    <v-btn
                      type="submit"
                      color="success"
                      size="large"
                      height="54"
                      width="180"
                      class="font-weight-bold rounded-xl"
                      :loading="loading"
                    >
                      Complete Signup
                    </v-btn>
                  </div>
                </v-form>
              </v-card>
            </template>
          </v-stepper>

          <v-divider class="my-6 opacity-10"></v-divider>

          <div class="text-center font-weight-medium text-secondary">
            Already have an account? <NuxtLink to="/login" class="text-primary font-weight-bold text-decoration-none">Sign In</NuxtLink>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, helpers } from '@vuelidate/validators';

definePageMeta({
  layout: false
});

const { $api } = useNuxtApp();
const router = useRouter();

const step = ref(1);
const loading = ref(false);
const error = ref('');
const plans = ref([]);

const state = reactive({
  companyName: '',
  slug: '',
  planId: null,
  billingCycle: 'monthly',
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
});

// Custom validator for slug (lowercase, numbers, dashes only)
const slugPattern = helpers.regex(/^[a-z0-9-]+$/);

const rules = {
  companyName: { required },
  slug: { 
    required, 
    slugPattern: helpers.withMessage('Slug can only contain lowercase letters, numbers, and dashes.', slugPattern)
  },
  name: { required },
  email: { required, email },
  password: { required, minLength: minLength(8) },
  confirmPassword: { 
    required, 
    sameAsPassword: helpers.withMessage('Passwords do not match.', sameAs(computed(() => state.password)))
  }
};

const v$ = useVuelidate(rules, state);

onMounted(async () => {
  await fetchPlans();
});

const fetchPlans = async () => {
  try {
    const res = await $api.get('/auth/plans');
    if (res.data.success) {
      plans.value = res.data.data;
      if (plans.value.length > 0) {
        state.planId = plans.value[0].id; // Default select first
      }
    }
  } catch (err) {
    console.error('Error fetching subscription plans:', err);
  }
};

const selectPlan = (id) => {
  state.planId = id;
};

const nextStep = async (currentStep) => {
  if (currentStep === 1) {
    const isCompanyValid = await v$.value.companyName.$validate();
    const isSlugValid = await v$.value.slug.$validate();
    if (isCompanyValid && isSlugValid) {
      step.value = 2;
    }
  }
};

const handleRegister = async () => {
  error.value = '';
  const isFormValid = await v$.value.$validate();
  if (!isFormValid) return;

  loading.value = true;
  try {
    const res = await $api.post('/auth/register-tenant', {
      companyName: state.companyName,
      slug: state.slug,
      planId: state.planId,
      billingCycle: state.billingCycle,
      name: state.name,
      email: state.email,
      password: state.password
    });

    if (res.data.success) {
      router.push('/login?registered=true');
    } else {
      error.value = res.data.message;
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Tenant registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  background: transparent;
}

/* The global input style makes placeholders visible even under resting labels.
   Let the label occupy the empty field until focus moves it above the input. */
.register-container :deep(.v-field:not(.v-field--active) input::placeholder) {
  opacity: 0 !important;
}

.glass-card {
  background: rgba(255, 255, 255, 0.75) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05) !important;
}

.text-gradient {
  background: linear-gradient(135deg, #0B57D0 0%, #002d72 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.shadow-glow {
  box-shadow: 0 0 20px rgba(11, 87, 208, 0.3) !important;
}

.plan-card {
  border-width: 2px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.plan-selected {
  border-color: #0B57D0 !important;
  background: rgba(11, 87, 208, 0.03) !important;
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(11, 87, 208, 0.1) !important;
}

.plan-unselected {
  border-color: rgba(0, 0, 0, 0.08) !important;
  background: white !important;
}

.plan-card:hover {
  border-color: #0B57D0 !important;
}
</style>
