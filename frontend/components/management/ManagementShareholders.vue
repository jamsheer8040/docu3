<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <div class="text-h6 font-weight-bold">Shareholders</div>
      <v-btn v-if="auth.can('management', 'create')" color="primary" prepend-icon="mdi-plus" @click="openDialog(null)">Add Shareholder</v-btn>
    </div>

    <v-card class="border rounded-xl" border>
      <v-data-table
        :headers="headers"
        :items="store.shareholders"
        :loading="store.loading"
        hover
      >
        <template v-slot:item.name="{ item }">
          <div class="font-weight-bold">{{ item.name }}</div>
          <div class="text-caption text-grey">{{ item.email }}</div>
        </template>
        <template v-slot:item.ownership_percentage="{ item }">
          <v-chip v-if="item.ownership_percentage != null" color="primary" size="small" variant="flat" class="font-weight-bold">{{ item.ownership_percentage }}%</v-chip>
          <span v-else>—</span>
        </template>
        <template v-slot:item.required_capital="{ item }">
          {{ formatCurrency(item.required_capital) }}
        </template>
        <template v-slot:item.contributed_capital="{ item }">
          <span class="text-success font-weight-bold">{{ formatCurrency(item.contributed_capital) }}</span>
        </template>
        <template v-slot:item.pending_capital="{ item }">
          <span v-if="item.pending_capital > 0" class="text-error font-weight-bold">{{ formatCurrency(item.pending_capital) }}</span>
          <span v-else class="text-grey">-</span>
        </template>
        <template v-slot:item.excess_capital="{ item }">
          <span v-if="item.excess_capital > 0" class="text-info font-weight-bold">{{ formatCurrency(item.excess_capital) }}</span>
          <span v-else class="text-grey">-</span>
        </template>
        <template v-slot:item.status="{ item }">
          <v-chip :color="item.status === 'Active' ? 'success' : 'grey'" size="small">{{ item.status }}</v-chip>
        </template>
        <template v-slot:item.actions="{ item }">
          <v-btn icon="mdi-pencil-outline" variant="text" size="small" color="primary" v-if="auth.canRecord('management', 'edit_form', item)" @click="openDialog(item)"></v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- Dialog -->
    <v-dialog v-model="dialog" max-width="600">
      <v-card class="rounded-xl border">
        <v-card-title class="pa-4 border-b bg-grey-lighten-4">
          <span class="text-h6 font-weight-bold">{{ editedItem.id ? 'Edit Shareholder' : 'New Shareholder' }}</span>
        </v-card-title>
        <v-card-text class="pa-4">
          <v-form ref="form" v-model="valid">
            <v-text-field v-model="editedItem.name" label="Full Name*" variant="outlined" density="comfortable" :rules="[v => !!v || 'Required']" class="mb-2"></v-text-field>
            <v-row>
              <v-col cols="6">
                <v-text-field v-model="editedItem.email" label="Email" variant="outlined" density="comfortable" class="mb-2"></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="editedItem.mobile" label="Mobile" variant="outlined" density="comfortable" class="mb-2"></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6">
                <v-text-field v-model="editedItem.nationality" label="Nationality" variant="outlined" density="comfortable" class="mb-2"></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="editedItem.identity_number" label="Identity / Passport" variant="outlined" density="comfortable" class="mb-2"></v-text-field>
              </v-col>
            </v-row>
            
            <v-divider class="my-4"></v-divider>
            <div class="text-subtitle-2 font-weight-bold mb-2">Ownership</div>
            
            <v-text-field v-model.number="editedItem.ownership_percentage" label="Ownership Percentage (%)*" type="number" variant="outlined" density="comfortable" :rules="[v => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100 || 'Enter 0–100']" class="mb-2" suffix="%"></v-text-field>
            <v-text-field v-if="editedItem.id" v-model="editedItem.ownership_change_reason" label="Reason for Change (if altering %)" variant="outlined" density="comfortable" class="mb-2"></v-text-field>
            
            <v-select v-model="editedItem.status" :items="['Active', 'Inactive']" label="Status" variant="outlined" density="comfortable"></v-select>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-4 border-t">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!valid || saving" :loading="saving" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
const auth = useAuthStore();
import { useManagementStore } from '~/stores/management';

const store = useManagementStore();
const dialog = ref(false);
const valid = ref(false);
const saving = ref(false);
const editedItem = ref({});

const headers = [
  { title: 'Shareholder', key: 'name' },
  { title: 'Ownership', key: 'ownership_percentage', align: 'center' },
  { title: 'Required Cap.', key: 'required_capital', align: 'end' },
  { title: 'Contributed', key: 'contributed_capital', align: 'end' },
  { title: 'Pending', key: 'pending_capital', align: 'end' },
  { title: 'Excess', key: 'excess_capital', align: 'end' },
  { title: 'Status', key: 'status', align: 'center' },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false }
];

const formatCurrency = (val) => {
  if (val == null) return '—';
  if (!val) return '0.00';
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const openDialog = (item) => {
  editedItem.value = item ? { ...item } : { status: 'Active', ownership_percentage: 0 };
  dialog.value = true;
};

const save = async () => {
  if (!valid.value) return;
  saving.value = true;
  try {
    if (editedItem.value.id) {
      await store.updateShareholder(editedItem.value.id, editedItem.value);
    } else {
      await store.createShareholder(editedItem.value);
    }
    dialog.value = false;
  } catch (err) {
    alert(err.response?.data?.message || 'Error saving');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  store.fetchShareholders().catch(() => {});
});
</script>
