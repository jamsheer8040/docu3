<template>
  <div class="pa-4">
    <p class="text-body-2 mb-4">Choose what this role can do and which records it can access. “Created or assigned” includes either relationship. Changes apply to everyone using this role after saving.</p>
    <v-table class="permission-table">
      <thead><tr><th>Module</th><th>View list</th><th>View details</th><th>Create</th><th>Edit</th><th>Delete</th></tr></thead>
      <tbody>
        <tr v-for="module in modules" :key="module.id">
          <td class="font-weight-bold text-capitalize">{{ module.name }}</td>
          <template v-if="module.id === 'dashboard'"><td colspan="2"><v-switch v-model="permissions[module.id].read" aria-label="Dashboard access" :disabled="disabled" color="primary" hide-details density="compact" /></td><td colspan="3" class="text-caption">Choose a dashboard template above to control cards and priorities.</td></template>
          <template v-else-if="module.id === 'commissions'"><td colspan="2"><v-select v-model="permissions[module.id].rules.list" :items="trackingScopes" aria-label="Commission statements view" :disabled="disabled" density="compact" variant="outlined" hide-details @update:model-value="value => { if (value !== 'all') { permissions[module.id].manage_rules = false; permissions[module.id].pay = false; } }" /></td><td><v-switch v-model="permissions[module.id].manage_rules" label="Manage rules" :disabled="disabled || permissions[module.id].rules.list !== 'all'" hide-details density="compact" color="primary" /></td><td><v-switch v-model="permissions[module.id].pay" label="Pay / reverse" :disabled="disabled || permissions[module.id].rules.list !== 'all'" hide-details density="compact" color="primary" /></td><td class="text-caption">Own = this employee’s commission. Paid history is retained.</td></template>
          <template v-else-if="module.id === 'employee_tracking'"><td colspan="2"><v-select v-model="permissions[module.id].rules.list" :items="trackingScopes" aria-label="Employee Tracking view" :disabled="disabled" density="compact" variant="outlined" hide-details /></td><td colspan="3" class="text-caption">Own shows this employee’s assigned work and completion performance. All shows everyone in the workspace.</td></template>
          <template v-else-if="permissions[module.id]?.rules">
            <td v-for="action in ['list', 'detail']" :key="action">
              <v-select v-model="permissions[module.id].rules[action]" :items="scopes" :aria-label="`${module.name} ${action}`" :disabled="disabled" density="compact" variant="outlined" hide-details />
            </td>
            <td><v-switch v-model="permissions[module.id].rules.create" :aria-label="`${module.name} create`" :disabled="disabled" color="primary" hide-details density="compact" /></td>
            <td v-for="action in ['edit', 'delete']" :key="action">
              <v-select v-model="permissions[module.id].rules[action]" :items="scopes" :aria-label="`${module.name} ${action}`" :disabled="disabled" density="compact" variant="outlined" hide-details />
            </td>
          </template>
          <template v-else>
            <td colspan="2"><v-switch v-model="permissions[module.id].read" :aria-label="`${module.name} view`" :disabled="disabled" color="primary" hide-details density="compact" /></td>
            <td colspan="2"><v-switch v-model="permissions[module.id].write" :aria-label="`${module.name} manage`" :disabled="disabled" color="primary" hide-details density="compact" /></td>
            <td><v-switch v-model="permissions[module.id].delete" :aria-label="`${module.name} delete`" :disabled="disabled" color="error" hide-details density="compact" /></td>
          </template>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
<script setup>
defineProps({ permissions: { type: Object, required: true }, modules: { type: Array, required: true }, disabled: Boolean });
const scopes = [
  { title: 'No access', value: 'none' }, { title: 'Created by me', value: 'created' },
  { title: 'Assigned to me', value: 'assigned' }, { title: 'Created or assigned to me', value: 'own' },
  { title: 'All records', value: 'all' }
];
const trackingScopes = [{ title: 'No access', value: 'none' }, { title: 'Own', value: 'own' }, { title: 'All', value: 'all' }];
</script>
<style scoped>
.permission-table :deep(th) { white-space: nowrap; }
.permission-table :deep(td) { padding: 10px 8px; }
.permission-table :deep(.v-select) { min-width: 170px; }
</style>
