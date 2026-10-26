<template>
  <v-container fluid class="leads-page py-6 px-6">
    <!-- Header -->
    <v-row class="mb-6 align-start">
      <v-col cols="12" md="7">
        <div class="text-caption text-uppercase font-weight-bold opacity-60 color-primary mb-1" style="letter-spacing: 0.08em;">
          LEADS
        </div>
        <h1 class="text-h4 font-weight-black color-primary">Lead Management</h1>
        <p class="text-subtitle-1 text-grey-darken-1 mt-1">Track potential customers and plan the next conversation</p>
        <!-- View Toggle -->
        <div class="view-toggle-pill d-inline-flex align-center pa-1 mt-3" style="height: 40px;">
          <v-btn
            :class="['text-none font-weight-bold px-4 rounded-pill', viewMode === 'list' ? 'classic-toggle-active' : 'text-grey-darken-3']"
            :variant="viewMode === 'list' ? 'flat' : 'text'"
            @click="viewMode = 'list'"
            height="32"
            size="small"
          >
            <v-icon start size="18">mdi-format-list-bulleted</v-icon>
            List
          </v-btn>
          <v-btn
            :class="['text-none font-weight-bold px-4 rounded-pill ml-1', viewMode === 'kanban' ? 'classic-toggle-active' : 'text-grey-darken-3']"
            :variant="viewMode === 'kanban' ? 'flat' : 'text'"
            @click="viewMode = 'kanban'"
            height="32"
            size="small"
          >
            <v-icon start size="18">mdi-view-column</v-icon>
            Kanban
          </v-btn>
        </div>
      </v-col>
      <v-col cols="12" md="5" class="lead-header-actions d-flex align-center justify-md-end ga-2 flex-wrap">
        <v-btn variant="tonal" color="primary" prepend-icon="mdi-download-outline" height="34" size="small" :loading="exporting" :disabled="!filteredLeads.length" @click="downloadExcel">Excel</v-btn>
        <v-btn v-if="authStore.can('leads', 'create')" variant="tonal" color="primary" prepend-icon="mdi-upload-outline" height="34" size="small" @click="importVisible=true">Import Excel</v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          rounded="lg"
          elevation="0"
          height="34"
          size="small"
          class="px-4 font-weight-bold text-capitalize"
          v-if="authStore.can('leads', 'create')"
          @click="openCreateDialog"
        >
          Add Lead
        </v-btn>
      </v-col>
    </v-row>

    <!-- KPI Summary Cards Row -->
    <v-row class="mb-6">
      <!-- Card 1: Total Leads -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-account-group-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Total Leads</div>
            <div class="text-h5 font-weight-black color-primary mb-1">{{ leadStore.leads.length }}</div>
            <div class="text-caption font-weight-bold text-success">&uarr; 10% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span></div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 2: New / Contacted -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-account-clock-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">In Pipeline</div>
            <div class="text-h5 font-weight-black text-info mb-1">{{ newAndContactedCount }}</div>
            <div class="text-caption font-weight-bold text-success">&uarr; 8% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span></div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Qualified -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-check-decagram-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Qualified</div>
            <div class="text-h5 font-weight-black color-primary mb-1">{{ qualifiedCount }}</div>
            <div class="text-caption font-weight-bold text-success">&uarr; 15% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span></div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Follow-up -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-trophy-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">On Follow-up</div>
            <div class="text-h5 font-weight-black text-success mb-1">{{ followUpCount }}</div>
            <div class="text-caption font-weight-bold text-success">&uarr; 20% <span class="opacity-60 font-weight-regular text-grey">vs. last month</span></div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Search & Filters -->
    <v-card class="soft-card mb-6 pa-4" variant="flat" rounded="xl">
      <v-row align="center">
        <v-col cols="12" sm="6" md="3">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search leads..."
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="search-pill"
          ></v-text-field>
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-autocomplete v-model="serviceFilter" :items="serviceOptions" label="Service" clearable variant="solo" flat density="comfortable" hide-details class="search-pill" />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-select v-model="sourceFilter" :items="sourceOptions" label="Source" clearable variant="solo" flat density="comfortable" hide-details class="search-pill" />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-select
            v-model="statusFilter"
            :items="statusOptions"
            label="Status"
            prepend-inner-icon="mdi-filter-variant"
            placeholder="Filter by Status"
            variant="solo"
            flat
            density="comfortable"
            hide-details
            class="search-pill"
          ></v-select>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-select v-model="followUpSort" :items="followUpSortOptions" label="Sort follow-up" variant="solo" flat density="comfortable" hide-details class="search-pill" />
        </v-col>
      </v-row>
      <div class="d-flex align-center justify-space-between flex-wrap ga-3 mt-3"><span class="text-caption text-medium-emphasis" role="status">{{ filteredLeads.length }} of {{ leadStore.leads.length }} leads</span><v-btn variant="text" rounded="pill" prepend-icon="mdi-filter-remove-outline" :disabled="!hasFilters" @click="resetFilters">Reset filters</v-btn></div>
    </v-card>

    <!-- ═══════════════════════════════════════ -->
    <!-- LIST VIEW                              -->
    <!-- ═══════════════════════════════════════ -->
    <v-card v-if="viewMode === 'list'" class="soft-card overflow-hidden" variant="flat" rounded="xl">
      <v-data-table
        v-model:page="listPage"
        v-model:sort-by="tableSort"
        :headers="headers"
        :cell-props="leadCellProps"
        :items="filteredLeads"
        :loading="leadStore.loading"
        class="bg-transparent lead-list-table"
        hover
      >
        <template v-slot:item.name="{ item }">
          <div class="d-flex align-center py-2">
            <v-avatar color="primary" size="36" class="mr-3 text-white font-weight-bold">
              {{ (item.company_name || item.name || '?').charAt(0).toUpperCase() }}
            </v-avatar>
            <div>
              <NuxtLink v-if="authStore.canRecord('leads', 'detail', item)" :to="`/leads/${item.id}`" class="font-weight-bold text-body-1 text-primary text-decoration-none" @click.stop>{{ item.company_name }}</NuxtLink><span v-else class="font-weight-bold text-body-1 text-primary">{{ item.company_name }}</span>
              <v-chip v-if="item.lead_type" size="x-small" variant="tonal" color="primary" class="ml-2" :title="item.lead_type === 'Person' ? 'Personal lead' : 'Company lead'">{{ item.lead_type === 'Person' ? 'B2C' : 'B2B' }}</v-chip>
              <div class="text-caption text-secondary" v-if="item.name">{{ item.name }}</div>
            </div>
          </div>
        </template>

        <!-- Contact column -->
        <template v-slot:item.contact="{ item }">
          <div class="d-flex flex-column">
            <a
              v-if="item.phone"
              :href="`https://wa.me/${item.phone.replace(/[^0-9]/g, '')}`"
              target="_blank"
              class="d-flex align-center text-body-2 mb-1 text-decoration-none whatsapp-link"
              @click.stop="leadStore.trackWhatsappClick(item.id)"
            >
              <v-icon size="small" class="mr-1" color="success">mdi-whatsapp</v-icon>
              <span class="text-success">{{ item.phone }}</span>
              <v-tooltip location="top" :text="`WhatsApp opened ${item.whatsapp_clicks || 0} time(s)`">
                <template v-slot:activator="{ props }">
                  <v-chip
                    v-bind="props"
                    size="x-small"
                    :color="(item.whatsapp_clicks || 0) > 0 ? 'success' : 'default'"
                    variant="tonal"
                    class="ml-2 font-weight-bold"
                    style="font-size: 10px;"
                  >{{ item.whatsapp_clicks || 0 }}</v-chip>
                </template>
              </v-tooltip>
            </a>
            <div v-if="item.email" class="d-flex align-center text-body-2 text-secondary">
              <v-icon size="small" class="mr-1">mdi-email</v-icon> {{ item.email }}
            </div>
          </div>
        </template>

        <!-- Service column -->
        <template v-slot:item.service="{ item }">
          <v-chip v-if="item.Service" size="small" variant="tonal" :color="serviceColor(item.Service)" class="font-weight-medium">
            <v-icon size="x-small" class="mr-1">mdi-briefcase</v-icon>
            {{ item.Service.name }}
          </v-chip>
          <span v-else class="text-caption text-secondary">None</span>
        </template>

        <!-- Status column - clickable dropdown -->
        <template #item.assigned_user_id="{ item }"><ServiceStaffAvatar :staff="item.AssignedStaff" unassigned-marker="?" unassigned-label="Unassigned lead" /></template>
        <template v-slot:item.status="{ item }">
          <div class="d-flex align-center ga-1 flex-wrap">
          <v-menu location="bottom">
            <template v-slot:activator="{ props }">
              <v-chip
                v-bind="props"
                :color="getStatusColor(item.status)"
                size="small"
                variant="flat"
                class="lead-status-badge font-weight-bold px-3 text-uppercase cursor-pointer"
                style="letter-spacing: 0.5px"
                append-icon="mdi-chevron-down"
              >
                {{ item.status }}
              </v-chip>
            </template>
            <v-list density="compact">
              <v-list-item
                v-for="status in kanbanColumns"
                :key="status"
                @click="updateLeadStatus(item, status)"
                :disabled="status === item.status || !authStore.canRecord('leads', 'edit', item)"
              >
                <v-list-item-title class="d-flex align-center">
                  <v-chip :color="getStatusColor(status)" size="x-small" class="mr-2" style="width: 12px; height: 12px;"></v-chip>
                  {{ status }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-chip v-if="item.quote_sent" size="x-small" variant="tonal" color="info">Quote Sent</v-chip>
          </div>
        </template>

        <template v-slot:item.follow_up="{ item }"><LeadFollowUpAction :lead="item" compact @saved="leadStore.fetchLeads()" /></template>
        <!-- Date column -->
        <template v-slot:item.created_at="{ item }">
          <span class="text-caption text-secondary">{{ formatDate(item.created_at) }}</span>
        </template>

        <!-- Actions column -->
        <template v-slot:item.actions="{ item }">
          <div class="d-flex align-center justify-end">
            <v-btn
              icon="mdi-pencil"
              width="32"
              height="32"
              v-if="authStore.canRecord('leads', 'edit_form', item)"
              aria-label="Edit lead"
              variant="text"
              color="primary"
              size="small"
              @click.stop="openEditDialog(item)"
            ></v-btn>
            <v-btn
              v-if="authStore.canRecord('leads', 'delete', item)"
              icon="mdi-delete"
              width="32"
              height="32"
              aria-label="Delete lead"
              variant="text"
              color="error"
              size="small"
              @click.stop="confirmDelete(item)"
            ></v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- ═══════════════════════════════════════ -->
    <!-- KANBAN VIEW                            -->
    <!-- ═══════════════════════════════════════ -->
    <div v-if="viewMode === 'kanban'" class="kanban-board mb-6">
      <div class="d-flex overflow-x-auto pb-4 gap-4" style="min-height: 520px;">
        <div
          v-for="column in kanbanColumns"
          :key="column"
          class="kanban-column"
          @dragover.prevent
          @dragenter.prevent
          @drop="onDrop($event, column)"
        >
          <!-- Column Header -->
          <div class="d-flex align-center mb-4 px-1">
            <div class="status-dot mr-2" :class="`bg-${getStatusColor(column)}`"></div>
            <h3 class="text-subtitle-1 font-weight-bold mb-0">{{ column }}</h3>
            <v-chip size="x-small" variant="tonal" class="ml-auto font-weight-bold">{{ getLeadsByStatus(column).length }}</v-chip>
          </div>

          <!-- Lead Cards -->
          <div class="kanban-cards d-flex flex-column gap-3">
            <v-card
              v-for="lead in getLeadsByStatus(column)"
              :key="lead.id"
              class="kanban-card soft-card cursor-pointer mb-3"
              variant="flat"
              :draggable="authStore.canRecord('leads', 'edit', lead)"
              @dragstart="onDragStart($event, lead)"
              @click="authStore.canRecord('leads', 'detail', lead) && navigateTo(`/leads/${lead.id}`)"
            >
              <v-card-text class="pa-3">
                <div class="d-flex justify-space-between align-start mb-2">
                  <ServiceStaffAvatar :staff="lead.AssignedStaff" unassigned-marker="?" unassigned-label="Unassigned lead" class="mr-2" />
                  <div class="font-weight-bold text-body-2 text-truncate flex-grow-1 mr-1">{{ lead.company_name }}</div>
                  <v-chip v-if="lead.lead_type" size="x-small" variant="tonal" color="primary" :title="lead.lead_type === 'Person' ? 'Personal lead' : 'Company lead'">{{ lead.lead_type === 'Person' ? 'B2C' : 'B2B' }}</v-chip>
                  <v-btn
                    v-if="authStore.can('customers', 'delete')"
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="x-small"
                    @click.stop="confirmDelete(lead)"
                  ></v-btn>
                </div>

                <div class="text-caption text-secondary mb-2" v-if="lead.name">
                  <v-icon size="x-small" class="mr-1">mdi-account</v-icon>{{ lead.name }}
                </div>
                <div v-if="lead.quote_sent" class="d-flex ga-1 mb-2"><v-chip size="x-small" variant="tonal">{{ lead.status }}</v-chip><v-chip size="x-small" variant="tonal" color="info">Quote Sent</v-chip></div>

                <v-chip v-if="lead.Service" size="small" variant="tonal" :color="serviceColor(lead.Service)" class="font-weight-medium mb-1">
                  <v-icon size="x-small" class="mr-1">mdi-briefcase</v-icon>{{ lead.Service.name }}
                </v-chip>

                <div v-if="lead.source" class="d-flex align-center text-caption text-secondary mb-1">
                  <v-icon size="x-small" class="mr-1">mdi-tag-outline</v-icon>{{ lead.source }}
                </div>

                <a
                  v-if="lead.phone"
                  :href="`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`"
                  target="_blank"
                  class="d-flex align-center text-caption mb-1 text-decoration-none whatsapp-link"
                  @click.stop="leadStore.trackWhatsappClick(lead.id)"
                >
                  <v-icon size="x-small" class="mr-1" color="success">mdi-whatsapp</v-icon>
                  <span class="text-success">{{ lead.phone }}</span>
                  <v-tooltip location="top" :text="`WhatsApp opened ${lead.whatsapp_clicks || 0} time(s)`">
                    <template v-slot:activator="{ props }">
                      <v-chip
                        v-bind="props"
                        size="x-small"
                        :color="(lead.whatsapp_clicks || 0) > 0 ? 'success' : 'default'"
                        variant="tonal"
                        class="ml-1 font-weight-bold"
                        style="font-size: 9px;"
                      >{{ lead.whatsapp_clicks || 0 }}</v-chip>
                    </template>
                  </v-tooltip>
                </a>
                <div v-if="lead.email" class="d-flex align-center text-caption text-secondary mb-2">
                  <v-icon size="x-small" class="mr-1">mdi-email</v-icon>
                  <span class="text-truncate">{{ lead.email }}</span>
                </div>

                <div class="d-flex justify-space-between align-center mt-2 pt-2 border-t">
                  <span class="text-caption text-grey-darken-1">{{ formatDate(lead.created_at) }}</span>

                  <LeadFollowUpAction :lead="lead" compact @saved="leadStore.fetchLeads()" />
                </div>
              </v-card-text>
            </v-card>

            <!-- Empty state -->
            <div v-if="getLeadsByStatus(column).length === 0" class="kanban-empty-slot text-center py-10 text-secondary">
              <v-icon size="32" class="mb-2 opacity-30">mdi-inbox-outline</v-icon>
              <div class="text-caption">No leads here</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <LeadFollowUpAction v-if="scheduleLead" ref="scheduleAction" :lead="scheduleLead" class="d-none" @saved="leadStore.fetchLeads()" />
    <!-- Lead Create/Edit Dialog -->
    <LeadDialog
      v-if="dialogVisible"
      v-model="dialogVisible"
      :lead="selectedLead"
      @saved="onSaved"
    />

    <LeadImportDialog v-model="importVisible" @saved="leadStore.fetchLeads()" />
    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card class="rounded-xl text-center pa-6">
        <v-icon size="64" color="error" class="mb-4">mdi-alert-circle</v-icon>
        <h3 class="text-h5 font-weight-bold mb-2">Delete Lead</h3>
        <p class="text-body-1 text-grey-darken-1 mb-6">
          Are you sure you want to delete this lead? This action cannot be undone.
        </p>
        <div class="d-flex justify-center gap-4">
          <v-btn variant="tonal" rounded="lg" size="large" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" rounded="lg" size="large" class="px-8" :loading="deleting" @click="executeDelete">Delete</v-btn>
        </div>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useLeadStore } from '~/stores/leads';
import { useUIStore } from '~/stores/ui';
import { useAuthStore } from '~/stores/auth';
import LeadDialog from '~/components/leads/LeadDialog.vue';
import LeadImportDialog from '~/components/leads/LeadImportDialog.vue';
import ServiceStaffAvatar from '~/components/services/ServiceStaffAvatar.vue';
import LeadFollowUpAction from '~/components/leads/LeadFollowUpAction.vue';
import { sortLeadFollowUps } from '~/utils/leadFollowUpSort';
import dayjs from 'dayjs';

const leadStore = useLeadStore();
const uiStore = useUIStore();
const authStore = useAuthStore();
const { $api } = useNuxtApp();
const exporting = ref(false);
const importVisible = ref(false);
async function downloadExcel() {
  exporting.value = true;
  try {
    const {data} = await $api.post('/leads/export/excel', {ids:filteredLeads.value.map(lead=>Number(lead.id))}, {responseType:'blob'});
    const url = URL.createObjectURL(data);
    const link = document.createElement('a'); link.href=url; link.download=`leads-${dayjs().format('YYYY-MM-DD')}.xlsx`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch(error) { uiStore.showError('Unable to download leads. Please try again.'); }
  finally { exporting.value=false; }
}

const search = ref('');
const statusFilter = ref('All');
const sourceFilter = ref(null);
const serviceFilter = ref(null);
const listPage = ref(1);
const followUpSort = ref('default');
const tableSort = ref([]);
const followUpSortOptions = [{ title: 'Default order', value: 'default' }, { title: 'Days remaining: Ascending', value: 'asc' }, { title: 'Days remaining: Descending', value: 'desc' }];
watch(followUpSort, value => { listPage.value = 1; if (value !== 'default') tableSort.value = []; });
watch(tableSort, value => { if (value.length) followUpSort.value = 'default'; });
const statusOptions = [{ title: 'All statuses', value: 'All' }, ...['New', 'Contacted', 'Qualified', 'Follow-up', 'Archived'].map(value => ({ title: value, value }))];
const sourceOptions = computed(() => [{ title: 'All sources', value: '' }, ...[...new Set(leadStore.leads.map(lead => (lead.source || '').trim()))].sort((a, b) => a.localeCompare(b)).map(source => ({ title: source || 'No source', value: source || '__none__' }))]);
const serviceColor = service => {
  const name = (service?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const colors = { goldenvisa: 'amber-darken-3', etraderlicense: 'blue-darken-2', ajmannuventure: 'deep-purple', ecommerce: 'teal-darken-2' };
  const palette = ['indigo', 'pink-darken-2', 'cyan-darken-3', 'orange-darken-3', 'green-darken-2', 'brown'];
  const hash = [...name].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 0);
  return colors[name] || palette[hash % palette.length];
};
const serviceOptions = computed(() => {
  const services = new Map();
  for (const lead of leadStore.leads) {
    const id = lead.service_id == null ? '__none__' : String(lead.service_id);
    services.set(id, { title: id === '__none__' ? 'No service' : lead.Service?.name || `Service #${id}`, value: id });
  }
  return [{ title: 'All services', value: '' }, ...[...services.values()].sort((a, b) => a.title.localeCompare(b.title))];
});
const hasFilters = computed(() => !!search.value || statusFilter.value !== 'All' || !!sourceFilter.value || !!serviceFilter.value || followUpSort.value !== 'default' || tableSort.value.length > 0);
function resetFilters() { search.value = ''; statusFilter.value = 'All'; sourceFilter.value = null; serviceFilter.value = null; followUpSort.value = 'default'; tableSort.value = []; listPage.value = 1; }
watch([search, statusFilter, sourceFilter, serviceFilter], () => { listPage.value = 1; });
const viewMode = ref('list');
const kanbanColumns = ['New', 'Contacted', 'Qualified', 'Follow-up', 'Archived'];
const scheduleAction = ref(null);
const scheduleLead = ref(null);

const dialogVisible = ref(false);
const selectedLead = ref(null);

const deleteDialog = ref(false);
const leadToDelete = ref(null);
const deleting = ref(false);



function leadCellProps({ item, column }) {
  if (!['name', 'contact', 'service', 'source', 'assigned_user_id'].includes(column.key) || !authStore.canRecord('leads', 'detail', item)) return {};
  return {
    class: 'cursor-pointer',
    onClick: event => {
      if (event.target.closest('a, button, input, select, textarea, [role="button"]')) return;
      navigateTo(`/leads/${item.id}`);
    }
  };
}
const headers = [
  { title: 'LEAD DETAILS', key: 'name', sortable: true },
  { title: 'CONTACT', key: 'contact', sortable: false },
  { title: 'SERVICE', key: 'service', sortable: true },
  { title: 'SOURCE', key: 'source', sortable: true },
  { title: 'ASSIGNED STAFF', key: 'assigned_user_id', sortable: false, align: 'center', width: 110 },
  { title: 'STATUS', key: 'status', sortable: true },
  { title: 'FOLLOW-UP', key: 'follow_up', sortable: false },
  { title: 'ADDED ON', key: 'created_at', sortable: true, width: 120 },
  { title: 'ACTIONS', key: 'actions', sortable: false, align: 'end', width: 80 }
];

const newAndContactedCount = computed(() =>
  leadStore.leads.filter(l => l.status === 'New' || l.status === 'Contacted').length
);

const qualifiedCount = computed(() =>
  leadStore.leads.filter(l => l.status === 'Qualified').length
);

const followUpCount = computed(() =>
  leadStore.leads.filter(l => l.status === 'Follow-up').length
);

const filteredLeads = computed(() => {
  let list = leadStore.leads;
  if (statusFilter.value !== 'All') {
    list = list.filter(l => l.status === statusFilter.value);
  }
  if (sourceFilter.value) list = list.filter(lead => ((lead.source || '').trim() || '__none__') === sourceFilter.value);
  if (serviceFilter.value) list = list.filter(lead => (lead.service_id == null ? '__none__' : String(lead.service_id)) === serviceFilter.value);
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.company_name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q)
    );
  }
  return sortLeadFollowUps(list, followUpSort.value);
});

const getStatusColor = (status) => {
  const map = {
    'New': 'info',
    'Contacted': 'warning',
    'Qualified': 'primary',
    'Follow-up': 'primary',
    'Archived': 'grey'
  };
  return map[status] || 'grey';
};

const formatDate = (date) => {
  return dayjs(date).format('DD MMM YYYY');
};

const getLeadsByStatus = (status) => {
  const leads = filteredLeads.value.filter(l => l.status === status);
  return followUpSort.value === 'default' ? leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : leads;
};

const onDragStart = (event, lead) => {
  event.dataTransfer.setData('leadId', lead.id);
  event.dataTransfer.effectAllowed = 'move';
};

const onDrop = (event, targetStatus) => {
  const leadId = event.dataTransfer.getData('leadId');
  if (!leadId) return;
  const lead = leadStore.leads.find(l => l.id == leadId);
  if (!lead || !authStore.canRecord('leads', 'edit', lead) || lead.status === targetStatus) return;
  updateLeadStatus(lead, targetStatus, 'Kanban');
};

const updateLeadStatus = async (lead, newStatus, source = 'List') => {
  if (newStatus === 'Archived') { openEditDialog({ ...lead, status: 'Archived', archive_reason: '' }); return; }
  if (lead.status === 'Archived' && newStatus === 'Follow-up') { openEditDialog({ ...lead, status: 'Follow-up' }); return; }
  if (newStatus === 'Follow-up') { scheduleLead.value = lead; await nextTick(); scheduleAction.value?.openSchedule(); return; }
  try {
    await leadStore.updateLead(lead.id, { status: newStatus, update_source: source });
    uiStore.showSuccess(`Status updated to ${newStatus}`);
  } catch (error) {
    uiStore.showError('Failed to update status');
  }
};

const openCreateDialog = () => {
  selectedLead.value = null;
  dialogVisible.value = true;
};
useCreateAction('leads', openCreateDialog);

const openEditDialog = (item) => {
  selectedLead.value = Object.assign({}, item);
  dialogVisible.value = true;
};

const confirmDelete = (item) => {
  leadToDelete.value = item;
  deleteDialog.value = true;
};

const executeDelete = async () => {
  deleting.value = true;
  try {
    await leadStore.deleteLead(leadToDelete.value.id);
    uiStore.showSuccess('Lead deleted');
    deleteDialog.value = false;
  } catch (error) {
    uiStore.showError('Failed to delete lead');
  } finally {
    deleting.value = false;
  }
};

const onSaved = () => {
  uiStore.showSuccess('Lead saved successfully');
};

onMounted(() => {
  leadStore.fetchLeads();
});
</script>

<style>
/* ===========================================================
   STRICT CLASSIC THEME — Leads Page
   Scoped under .v-theme--classic only
   =========================================================== */

:global(.v-theme--classic) .v-container {
  background: #F8F9FE !important;
}

/* ── Stat & Filter Cards ── */
:global(.v-theme--classic) .soft-card {
  background: #FFFFFF !important;
  border: 1px solid rgba(79, 66, 148, 0.12) !important;
  box-shadow: 0 4px 20px -4px rgba(79, 66, 148, 0.08) !important;
}

/* ── Primary Buttons ── */
:global(.v-theme--classic) .v-btn--variant-elevated,
:global(.v-theme--classic) .v-btn--variant-flat {
  background: #4F4294 !important;
  color: #FFFFFF !important;
  box-shadow: 0 4px 14px -4px rgba(79, 66, 148, 0.40) !important;
}
:global(.v-theme--classic) .v-btn--variant-elevated:hover,
:global(.v-theme--classic) .v-btn--variant-flat:hover {
  background: #6554C0 !important;
  transform: translateY(-1px) !important;
}

:global(.v-theme--classic) .v-btn--variant-outlined {
  border-color: rgba(79, 66, 148, 0.30) !important;
  color: #4F4294 !important;
  background: #FFFFFF !important;
}

/* ── Data Table Header ── */
:global(.v-theme--classic) .v-data-table .v-data-table-header__content {
  color: #4F4294 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

/* ── Row Hover ── */
:global(.v-theme--classic) .v-data-table .v-data-table__tr:hover td {
  background: rgba(79, 66, 148, 0.04) !important;
}

/* ── Kanban Column ── */
:global(.v-theme--classic) .kanban-column {
  background: rgba(79, 66, 148, 0.03) !important;
  border: 1px solid rgba(79, 66, 148, 0.08) !important;
  border-radius: 16px;
}

/* ── Kanban Card ── */
:global(.v-theme--classic) .kanban-card {
  border: 1px solid rgba(79, 66, 148, 0.10) !important;
}
:global(.v-theme--classic) .kanban-card:hover {
  box-shadow: 0 8px 20px -4px rgba(79, 66, 148, 0.18) !important;
  transform: translateY(-2px);
}

/* ── Kanban Empty Slot ── */
:global(.v-theme--classic) .kanban-empty-slot {
  border: 2px dashed rgba(79, 66, 148, 0.20);
  border-radius: 12px;
}

/* ── View Toggle Pill ── */
:global(.v-theme--classic) .view-toggle-pill {
  background: #FFFFFF;
  border: 1px solid rgba(79, 66, 148, 0.20);
  border-radius: 999px;
  box-shadow: 0 2px 8px -2px rgba(79, 66, 148, 0.12);
}

/* ── Active Toggle Button in Classic ── */
:global(.v-theme--classic) .classic-toggle-active {
  background: #4F4294 !important;
  color: white !important;
  box-shadow: 0 4px 12px -3px rgba(79, 66, 148, 0.45) !important;
}

/* ── Active Pagination Button ── */
:global(.v-theme--classic) .v-pagination .v-btn--active {
  background: #4F4294 !important;
  color: #FFFFFF !important;
}

/* ── Focus Outline ── */
:global(.v-theme--classic) .v-field--focused .v-field__outline {
  border-color: #4F4294 !important;
}
</style>

<style scoped>
.lead-list-table :deep(th:nth-last-child(2)),
.lead-list-table :deep(td:nth-last-child(2)),
.lead-list-table :deep(th:last-child),
.lead-list-table :deep(td:last-child) { width:1%; white-space:nowrap; padding-inline:8px !important; }
.kanban-board {
  width: 100%;
}

.kanban-column {
  min-width: 300px;
  max-width: 300px;
  background: transparent;
  border: none;
  border-radius: 24px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.kanban-cards {
  min-height: 80px;
  flex: 1;
}

.kanban-empty-slot {
  border: 2px dashed rgba(var(--v-border-color), 0.3);
  border-radius: 12px;
}

.kanban-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12) !important;
}

.whatsapp-link {
  transition: opacity 0.15s ease;
}
.whatsapp-link:hover {
  opacity: 0.75;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lead-list-table .lead-status-badge {
  font-size: calc(0.75rem - 2px) !important;
}

.lead-header-actions .v-btn { letter-spacing: 0; white-space: nowrap; }
</style>
