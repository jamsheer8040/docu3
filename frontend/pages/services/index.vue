<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6 align-center">
      <v-col cols="12" sm="7" md="8">
        <div class="text-caption text-uppercase font-weight-bold opacity-60 color-primary mb-1" style="letter-spacing: 0.08em;">
          SERVICES
        </div>
        <h1 class="text-h4 font-weight-black color-primary">
          Service Management
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1 mt-1">
          Manage service workflows, track orders, and issue invoices in one place.
        </p>
      </v-col>
      <v-col cols="12" sm="5" md="4" class="d-flex align-center justify-sm-end gap-3 flex-wrap">
        <v-btn
          v-if="auth.can('settings', 'write')"
          variant="outlined"
          color="grey-darken-2"
          prepend-icon="mdi-cog-outline"
          rounded="lg"
          height="44"
          class="px-4 font-weight-bold text-capitalize bg-white"
          @click="settingsDialog = true"
        >
          Settings
        </v-btn>
        <v-btn
          v-if="auth.can('services', 'create')"
          color="primary"
          prepend-icon="mdi-clipboard-plus-outline"
          rounded="lg"
          elevation="2"
          height="44"
          class="px-6 font-weight-bold text-capitalize"
          @click="openOrderForm()"
        >
          New Service Order
        </v-btn>
      </v-col>
    </v-row>



    <!-- VIEW TOGGLE & FILTERS CONTAINER -->
    <v-card class="mb-6 soft-card pa-4" variant="flat" rounded="xl">
      <div class="d-flex align-center flex-wrap gap-4">
        <div class="bg-grey-lighten-5 border rounded-pill d-flex align-center pa-1" style="height: 48px;">
          <v-btn
            :class="['text-capitalize font-weight-bold px-5 rounded-pill', viewMode === 'kanban' ? 'bg-primary text-white' : 'text-grey-darken-2']"
            :variant="viewMode === 'kanban' ? 'flat' : 'text'"
            @click="viewMode = 'kanban'"
            height="40"
          >
            <v-icon start size="20">mdi-view-column-outline</v-icon>
            Kanban Board
          </v-btn>
          <v-btn
            :class="['text-capitalize font-weight-bold px-5 rounded-pill ml-1', viewMode === 'list' ? 'bg-primary text-white' : 'text-grey-darken-2']"
            :variant="viewMode === 'list' ? 'flat' : 'text'"
            @click="viewMode = 'list'"
            height="40"
          >
            <v-icon start size="20">mdi-format-list-bulleted</v-icon>
            List View
          </v-btn>
        </div>
        
        <v-spacer></v-spacer>
        
        <!-- Controls & Filters -->
        <div class="d-flex align-center gap-3 flex-wrap">
          <v-select v-if="auth.user?.role_type !== 'CustomerPortal'" v-model="staffFilter" :items="staffFilterOptions" label="Assigned Staff" density="compact" hide-details variant="outlined" rounded="lg" style="width:190px" />
          <v-select
            v-model="criticalityFilter"
            :items="[
              { title: 'Show All', value: 'All' },
              { title: 'Critical Only 🔴', value: 'Critical' },
              { title: 'Moderate Only 🟠', value: 'Moderate' },
              { title: 'Normal Only 🟢', value: 'Normal' }
            ]"
            prepend-inner-icon="mdi-tune-variant"
            placeholder="Criticality"
            density="compact"
            hide-details
            style="width: 170px;"
            variant="outlined"
            rounded="lg"
            bg-color="white"
            class="text-caption"
          ></v-select>

          <v-select
            v-model="sortBy"
            :items="[
              { title: 'Default Sort', value: 'default' },
              { title: 'Sort by Criticality', value: 'criticality' }
            ]"
            prepend-inner-icon="mdi-sort-variant"
            placeholder="Sort By"
            density="compact"
            hide-details
            style="width: 170px;"
            variant="outlined"
            rounded="lg"
            bg-color="white"
            class="text-caption"
          ></v-select>

          <v-text-field
            v-model="searchOrders"
            placeholder="Search orders..."
            prepend-inner-icon="mdi-magnify"
            density="compact"
            hide-details
            style="width: 220px;"
            variant="outlined"
            rounded="lg"
            bg-color="grey-lighten-5"
            class="search-pill"
          ></v-text-field>

          <v-btn icon="mdi-refresh" variant="outlined" color="grey-darken-1" size="small" rounded="lg" @click="fetchData" :loading="serviceStore.loading || completionSaving"></v-btn>
        </div>
      </div>
    </v-card>

    <v-chip v-if="serviceRoute.query.service_id" closable color="primary" variant="tonal" class="mb-3" @click:close="serviceRouter.replace({ query: { ...serviceRoute.query, service_id: undefined } })">Service #{{ serviceRoute.query.service_id }}</v-chip>
    <v-window v-model="viewMode">

      <!-- ============================
           KANBAN VIEW
           ============================ -->
      <v-window-item value="kanban">
        <div class="kanban-container mt-4">
          <v-row class="kanban-row flex-nowrap overflow-x-auto pb-4">

            <!-- 1. PENDING -->
            <v-col class="kanban-col">
              <div class="kanban-header kanban-header--pending mb-4">
                <v-icon icon="mdi-clock-outline" size="18" class="mr-2"></v-icon>
                <span class="text-subtitle-2 font-weight-bold">Pending</span>
                <v-chip size="x-small" class="ml-auto font-weight-bold" color="grey">{{ groupedOrders.Pending.length }}</v-chip>
              </div>
              <v-slide-y-transition group>
                <v-card v-for="order in groupedOrders.Pending" :key="order.id" class="mb-3 order-card" :class="'criticality-border-' + order.criticality" border>
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-start mb-2">
                      <div class="d-flex align-center ga-2"><ServiceStaffAvatar :staff="order.AssignedStaff" /><span class="text-caption font-weight-bold opacity-50 mt-1">#{{ String(order.id).padStart(5, '0') }}</span></div>
                      <div class="d-flex flex-column align-end">
                        <div class="d-flex align-center gap-1">
                          <v-chip size="x-small" color="deep-purple" variant="tonal" class="font-weight-bold">{{ order.ServiceType?.name }}</v-chip>
                          <v-icon
                            :color="order.criticality === 'Critical' ? 'error' : (order.criticality === 'Moderate' ? 'orange' : 'success')"
                            size="small"
                            :title="'Priority: ' + order.criticality"
                          >mdi-lightbulb-on</v-icon>
                        </div>
                        <div v-if="order.is_cost_deducted && order.deducted_wallet_name" class="text-success font-weight-bold mt-1 d-flex align-center" style="font-size: 0.65rem !important;">
                          <v-icon size="x-small" icon="mdi-check-all" class="mr-1"></v-icon>{{ order.deducted_wallet_name.substring(0, 4).toUpperCase() }}
                        </div>
                      </div>
                    </div>
                    <div class="text-body-2 font-weight-bold mb-1">{{ order.Customer?.name }}</div>

                    <!-- Card details -->
                    <div class="text-caption text-grey mb-2">
                      <div>Created: {{ formatDate(order.created_at) }}</div>
                    </div>

                    <!-- Invoice Badge -->
                    <ServiceInvoiceBadge v-if="hasInvoice(order)" :invoice="order.Invoice" class="mb-2" @open="openInvoiceView" />
                    <v-chip
                      v-else
                      color="orange"
                      size="x-small"
                      prepend-icon="mdi-receipt-outline"
                      variant="tonal"
                      class="font-weight-bold mb-2"
                    >Invoice Pending</v-chip>

                    <div class="d-flex gap-1 align-center mt-2">
                      <v-btn color="success" size="x-small" variant="text" @click.stop="openWhatsAppRemind(order)" class="px-1">
                        <v-icon icon="mdi-whatsapp" class="mr-1"></v-icon>
                        <span class="text-caption font-weight-bold">{{ order.reminder_count || 0 }}</span>
                      </v-btn>
                      <v-btn
                        v-if="auth.canRecord('services', 'edit', order)"
                        color="primary" block variant="tonal" size="small"
                        append-icon="mdi-play-circle-outline"
                        @click.stop="updateStatus(order, 'In Progress')"
                        class="ml-1"
                      >Start Service</v-btn>
                    </div>
                    <div class="service-card-footer d-flex justify-end mt-2 pt-2 border-t" :style="footerStyle('Pending')">
                      <v-btn v-if="auth.canRecord('services', 'edit', order)" icon="mdi-close-circle-outline" variant="text" size="x-small" color="warning" class="mr-1" title="Cancel Order" @click.stop="updateStatus(order, 'Cancelled')"></v-btn>
                      <v-btn v-if="auth.canRecord('services', 'edit_form', order) && !hasInvoice(order)" icon="mdi-pencil-outline" variant="text" size="x-small" color="primary" class="mr-1" @click.stop="openEditOrderForm(order)"></v-btn>
                      <v-btn v-if="auth.canRecord('services', 'delete', order)" icon="mdi-delete-outline" variant="text" size="x-small" color="error" @click.stop="confirmDeleteOrder(order)"></v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-slide-y-transition>
              <div v-if="groupedOrders.Pending.length === 0" class="empty-col">No pending orders</div>
            </v-col>

            <!-- 2. IN PROGRESS -->
            <v-col class="kanban-col">
              <div class="kanban-header kanban-header--inprogress mb-4">
                <v-icon icon="mdi-progress-clock" size="18" class="mr-2"></v-icon>
                <span class="text-subtitle-2 font-weight-bold">In Progress</span>
                <v-chip size="x-small" class="ml-auto font-weight-bold" color="primary">{{ groupedOrders['In Progress'].length }}</v-chip>
              </div>
              <v-slide-y-transition group>
                <v-card v-for="order in groupedOrders['In Progress']" :key="order.id" class="mb-3 order-card" :class="'criticality-border-' + order.criticality" border>
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-start mb-2">
                      <div class="d-flex align-center ga-2"><ServiceStaffAvatar :staff="order.AssignedStaff" /><span class="text-caption font-weight-bold opacity-50 mt-1">#{{ String(order.id).padStart(5, '0') }}</span></div>
                      <div class="d-flex flex-column align-end">
                        <div class="d-flex align-center gap-1">
                          <v-chip size="x-small" color="deep-purple" variant="tonal" class="font-weight-bold">{{ order.ServiceType?.name }}</v-chip>
                          <v-icon
                            :color="order.criticality === 'Critical' ? 'error' : (order.criticality === 'Moderate' ? 'orange' : 'success')"
                            size="small"
                            :title="'Priority: ' + order.criticality"
                          >mdi-lightbulb-on</v-icon>
                        </div>
                        <div v-if="order.is_cost_deducted && order.deducted_wallet_name" class="text-success font-weight-bold mt-1 d-flex align-center" style="font-size: 0.65rem !important;">
                          <v-icon size="x-small" icon="mdi-check-all" class="mr-1"></v-icon>{{ order.deducted_wallet_name.substring(0, 4).toUpperCase() }}
                        </div>
                      </div>
                    </div>
                    <div class="text-body-2 font-weight-bold mb-1">{{ order.Customer?.name }}</div>

                    <!-- Card details -->
                    <div class="text-caption text-grey mb-2">
                      <div>Created: {{ formatDate(order.created_at) }}</div>
                    </div>

                    <!-- Invoice Badge -->
                    <ServiceInvoiceBadge v-if="hasInvoice(order)" :invoice="order.Invoice" class="mb-2" @open="openInvoiceView" />
                    <v-chip
                      v-else
                      color="orange"
                      size="x-small"
                      prepend-icon="mdi-receipt-outline"
                      variant="tonal"
                      class="font-weight-bold mb-2"
                    >Invoice Pending</v-chip>

                    <div class="text-caption text-grey mb-2">
                      <v-icon size="x-small" icon="mdi-calendar-play-outline" class="mr-1"></v-icon>
                      Started: {{ formatDate(order.started_at) }}
                    </div>
                    <div class="d-flex gap-1 align-center mt-2">
                      <v-btn color="success" size="x-small" variant="text" @click.stop="openWhatsAppRemind(order)" class="px-1">
                        <v-icon icon="mdi-whatsapp" class="mr-1"></v-icon>
                        <span class="text-caption font-weight-bold">{{ order.reminder_count || 0 }}</span>
                      </v-btn>
                      <v-btn
                        v-if="auth.canRecord('services', 'edit', order)"
                        color="success" block variant="flat" size="small"
                        append-icon="mdi-check-circle-outline"
                        @click.stop="confirmOrderCompletion(order)"
                        class="ml-1"
                      >Complete Service</v-btn>
                    </div>
                    <div class="service-card-footer d-flex justify-end mt-2 pt-2 border-t" :style="footerStyle('In Progress')">
                      <v-btn v-if="auth.canRecord('services', 'edit', order)" icon="mdi-close-circle-outline" variant="text" size="x-small" color="warning" class="mr-1" title="Cancel Order" @click.stop="updateStatus(order, 'Cancelled')"></v-btn>
                      <v-btn v-if="auth.canRecord('services', 'edit_form', order) && !hasInvoice(order)" icon="mdi-pencil-outline" variant="text" size="x-small" color="primary" @click.stop="openEditOrderForm(order)"></v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-slide-y-transition>
              <div v-if="groupedOrders['In Progress'].length === 0" class="empty-col">No services in progress</div>
            </v-col>

            <!-- 3. COMPLETED — INVOICE PENDING -->
            <v-col class="kanban-col">
              <div class="kanban-header kanban-header--invoice-pending mb-4">
                <v-icon icon="mdi-receipt-text-clock-outline" size="18" class="mr-2"></v-icon>
                <span class="text-subtitle-2 font-weight-bold">✓ - Invoice Pending</span>
                <v-chip size="x-small" class="ml-auto font-weight-bold" color="orange">{{ groupedOrders.CompletedInvoicePending.length }}</v-chip>
              </div>
              <v-slide-y-transition group>
                <v-card v-for="order in groupedOrders.CompletedInvoicePending" :key="order.id" class="mb-3 order-card" border>
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-start mb-2">
                      <div class="d-flex align-center ga-2"><ServiceStaffAvatar :staff="order.AssignedStaff" /><span class="text-caption font-weight-bold opacity-50 mt-1">#{{ String(order.id).padStart(5, '0') }}</span></div>
                      <div class="d-flex flex-column align-end">
                        <v-chip size="x-small" color="deep-purple" variant="tonal" class="font-weight-bold">{{ order.ServiceType?.name }}</v-chip>
                        <div v-if="order.is_cost_deducted && order.deducted_wallet_name" class="text-success font-weight-bold mt-1 d-flex align-center" style="font-size: 0.65rem !important;">
                          <v-icon size="x-small" icon="mdi-check-all" class="mr-1"></v-icon>{{ order.deducted_wallet_name.substring(0, 4).toUpperCase() }}
                        </div>
                      </div>
                    </div>
                    <div class="text-body-2 font-weight-bold mb-1">{{ order.Customer?.name }}</div>

                    <!-- Card details -->
                    <div class="text-caption text-grey mb-2">
                      <div>Created: {{ formatDate(order.created_at) }}</div>
                    </div>

                    <!-- Invoice Badge -->
                    <ServiceInvoiceBadge v-if="hasInvoice(order)" :invoice="order.Invoice" class="mb-2" @open="openInvoiceView" />
                    <v-chip
                      v-else
                      color="orange"
                      size="x-small"
                      prepend-icon="mdi-receipt-outline"
                      variant="tonal"
                      class="font-weight-bold mb-2"
                    >Invoice Pending</v-chip>

                    <div class="text-caption text-grey mb-2">
                      <v-icon size="x-small" icon="mdi-check-all" color="success" class="mr-1"></v-icon>
                      Completed: {{ formatDate(order.completed_at) }}
                    </div>
                    <div class="service-card-footer d-flex gap-1 align-center mt-2 pt-2 border-t" :style="footerStyle('CompletedInvoicePending')">
                      <v-btn color="success" size="x-small" variant="text" @click.stop="openWhatsAppRemind(order)" class="px-1">
                        <v-icon icon="mdi-whatsapp" class="mr-1"></v-icon>
                        <span class="text-caption font-weight-bold">{{ order.reminder_count || 0 }}</span>
                      </v-btn>
                      <v-btn
                        v-if="auth.can('invoices', 'write')"
                        color="orange" block variant="flat" size="small"
                        append-icon="mdi-receipt-text-plus"
                        @click.stop="triggerCreateInvoice(order)"
                        class="ml-1"
                      >Create Invoice</v-btn>
                    </div>

                  </v-card-text>
                </v-card>
              </v-slide-y-transition>
              <div v-if="groupedOrders.CompletedInvoicePending.length === 0" class="empty-col">No orders awaiting invoice</div>
            </v-col>

            <!-- 4. COMPLETED — INVOICE CREATED -->
            <v-col class="kanban-col">
              <div class="kanban-header kanban-header--done mb-4">
                <v-icon icon="mdi-check-decagram-outline" size="18" class="mr-2"></v-icon>
                <span class="text-subtitle-2 font-weight-bold">✓ - Invoice Created</span>
                <v-chip size="x-small" class="ml-auto font-weight-bold" color="success">{{ groupedOrders.CompletedInvoiceCreated.length }}</v-chip>
              </div>
              <v-slide-y-transition group>
                <v-card v-for="order in groupedOrders.CompletedInvoiceCreated" :key="order.id" class="mb-3 order-card opacity-80" border>
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-start mb-2">
                      <div class="d-flex align-center ga-2"><ServiceStaffAvatar :staff="order.AssignedStaff" /><span class="text-caption font-weight-bold opacity-50 mt-1">#{{ String(order.id).padStart(5, '0') }}</span></div>
                      <div class="d-flex flex-column align-end">
                        <v-chip size="x-small" color="deep-purple" variant="tonal" class="font-weight-bold">{{ order.ServiceType?.name }}</v-chip>
                        <div v-if="order.is_cost_deducted && order.deducted_wallet_name" class="text-success font-weight-bold mt-1 d-flex align-center" style="font-size: 0.65rem !important;">
                          <v-icon size="x-small" icon="mdi-check-all" class="mr-1"></v-icon>{{ order.deducted_wallet_name.substring(0, 4).toUpperCase() }}
                        </div>
                      </div>
                    </div>
                    <div class="text-body-2 font-weight-bold mb-1 opacity-70">{{ order.Customer?.name }}</div>

                    <!-- Card details -->
                    <div class="text-caption text-grey mb-2">
                      <div>Created: {{ formatDate(order.created_at) }}</div>
                    </div>

                    <!-- Invoice Badge -->
                    <ServiceInvoiceBadge v-if="hasInvoice(order)" :invoice="order.Invoice" class="mb-2" @open="openInvoiceView" />
                    <v-chip
                      v-else
                      color="orange"
                      size="x-small"
                      prepend-icon="mdi-receipt-outline"
                      variant="tonal"
                      class="font-weight-bold mb-2"
                    >Invoice Pending</v-chip>

                    <div class="service-card-footer d-flex justify-end align-center mt-2 pt-2 border-t" :style="footerStyle('CompletedInvoiceCreated')">
                      <v-btn color="primary" variant="text" size="x-small" append-icon="mdi-arrow-right" to="/invoices">Invoices</v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-slide-y-transition>
              <div v-if="groupedOrders.CompletedInvoiceCreated.length === 0" class="empty-col">No fully completed orders</div>
            </v-col>

            <!-- FOLLOW UP REQUIRED -->
            <v-col class="kanban-col">
              <div class="kanban-header kanban-header--followup mb-4">
                <v-icon icon="mdi-calendar-alert" size="18" class="mr-2"></v-icon>
                <span class="text-subtitle-2 font-weight-bold">Follow Up Required</span>
                <v-chip size="x-small" class="ml-auto font-weight-bold" color="orange">{{ groupedOrders.FollowUpRequired.length }}</v-chip>
              </div>
              <v-slide-y-transition group>
                <v-card v-for="order in groupedOrders.FollowUpRequired" :key="order.id + '-followup'" class="mb-3 order-card" border style="border-left: 4px solid #D97706 !important;">
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-start mb-2">
                      <div class="d-flex align-center ga-2"><ServiceStaffAvatar :staff="order.AssignedStaff" /><span class="text-caption font-weight-bold opacity-50 mt-1">Copy of #{{ String(order.id).padStart(5, '0') }}</span></div>
                      <v-chip size="x-small" color="deep-purple" variant="tonal" class="font-weight-bold">{{ order.ServiceType?.name }}</v-chip>
                    </div>
                    <div class="text-body-2 font-weight-bold mb-1">{{ order.Customer?.name }}</div>

                    <!-- Card details -->
                    <div class="text-caption text-grey mb-2">
                      <div>Created: {{ formatDate(order.created_at) }}</div>
                      <div v-if="order.completed_at">Completed: {{ formatDate(order.completed_at) }}</div>
                    </div>

                    <ServiceInvoiceBadge v-if="hasInvoice(order)" :invoice="order.Invoice" class="mb-2" @open="openInvoiceView" />
                    <div class="service-card-footer d-flex justify-center mt-2 pt-2 border-t" :style="footerStyle('FollowUpRequired')">
                      <v-btn
                        v-if="auth.canRecord('services', 'edit', order)"
                        color="success" block variant="tonal" size="small"
                        prepend-icon="mdi-check-all"
                        @click.stop="markFollowUpDone(order)"
                      >Follow Up Done</v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-slide-y-transition>
              <div v-if="groupedOrders.FollowUpRequired.length === 0" class="empty-col">No follow ups pending</div>
            </v-col>

            <!-- 5. CANCELLED -->
            <v-col class="kanban-col">
              <div class="kanban-header kanban-header--cancelled mb-4">
                <v-icon icon="mdi-cancel" size="18" class="mr-2"></v-icon>
                <span class="text-subtitle-2 font-weight-bold">Cancelled</span>
                <v-chip size="x-small" class="ml-auto font-weight-bold" color="error">{{ groupedOrders.Cancelled.length }}</v-chip>
              </div>
              <v-slide-y-transition group>
                <v-card v-for="order in groupedOrders.Cancelled" :key="order.id" class="mb-3 order-card opacity-60" border>
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-center mb-2">
                      <div class="d-flex align-center ga-2"><ServiceStaffAvatar :staff="order.AssignedStaff" /><span class="text-caption font-weight-bold opacity-50">#{{ String(order.id).padStart(5, '0') }}</span></div>
                      <v-chip size="x-small" color="error" variant="flat">Cancelled</v-chip>
                    </div>
                    <div class="text-body-2 font-weight-bold mb-1">{{ order.Customer?.name }}</div>

                    <!-- Card details -->
                    <div class="text-caption text-grey mb-2">
                      <div>Created: {{ formatDate(order.created_at) }}</div>
                    </div>

                    <ServiceInvoiceBadge v-if="hasInvoice(order)" :invoice="order.Invoice" class="mb-2" @open="openInvoiceView" />
                    <div class="service-card-footer d-flex justify-end mt-2 pt-2 border-t" :style="footerStyle('Cancelled')">
                      <v-btn v-if="auth.canRecord('services', 'edit', order)" variant="text" size="x-small" prepend-icon="mdi-restore" @click.stop="updateStatus(order, 'Pending')">Restore</v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-slide-y-transition>
              <div v-if="groupedOrders.Cancelled.length === 0" class="empty-col">No cancelled orders</div>
            </v-col>

          </v-row>
        </div>
      </v-window-item>

      <!-- ============================
           LIST VIEW
           ============================ -->
      <v-window-item value="list">
        <v-card class="border mt-4" border>
          <v-data-table :headers="orderHeaders" :items="filteredOrders" :loading="serviceStore.loading || completionSaving" hover>

            <template #item.id="{ item }"><div class="d-flex align-center ga-2 text-no-wrap"><ServiceStaffAvatar :staff="item.AssignedStaff" /><span>#{{ String(item.id).padStart(5, '0') }}</span></div></template>
            <template v-slot:item.ServiceType="{ item }">
              <div class="font-weight-bold d-flex align-center gap-2">
                {{ item.ServiceType?.name }}
                <v-icon
                  :color="item.criticality === 'Critical' ? 'error' : (item.criticality === 'Moderate' ? 'orange' : 'success')"
                  size="small"
                  :title="'Priority: ' + item.criticality"
                >mdi-lightbulb-on</v-icon>
              </div>
              <div class="text-caption text-grey">{{ item.ServiceType?.category }}</div>
            </template>

            <template v-slot:item.Customer="{ item }">
              <div class="font-weight-bold">{{ item.Customer?.name }}</div>
              <div class="text-caption text-grey">{{ item.Customer?.phone_whatsapp }}</div>
            </template>

            <template v-slot:item.created_at="{ item }">{{ formatDate(item.created_at) }}</template>

            <!-- Invoice Badge column -->
            <template v-slot:item.invoice_badge="{ item }">
              <ServiceInvoiceBadge v-if="hasInvoice(item)" :invoice="item.Invoice" @open="openInvoiceView" />
              <v-chip
                v-else
                color="orange"
                size="x-small"
                prepend-icon="mdi-receipt-outline"
                variant="tonal"
                class="font-weight-bold"
              >Invoice Pending</v-chip>
            </template>

            <template #item.AssignedStaff.name="{ item }">{{ item.AssignedStaff?.name || 'Unassigned' }}</template>
            <template v-slot:item.status="{ item }">
              <v-chip :color="getStatusColor(item.status)" size="x-small" label class="font-weight-bold" style="font-size: 10px !important;">
                <template v-if="item.status === 'CompletedInvoicePending'">✓ - Invoice Pending</template>
                <template v-else-if="item.status === 'CompletedInvoiceCreated'">✓ - Invoice Created</template>
                <template v-else>{{ item.status }}</template>
              </v-chip>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn variant="text" size="small" color="success" @click="openWhatsAppRemind(item)" class="px-2">
                <v-icon icon="mdi-whatsapp" class="mr-1"></v-icon>
                <span class="text-caption font-weight-bold">{{ item.reminder_count || 0 }}</span>
              </v-btn>
              <v-btn
                v-if="['Pending', 'In Progress'].includes(item.status) && auth.canRecord('services', 'edit_form', item) && !hasInvoice(item)"
                icon="mdi-pencil-outline"
                variant="text"
                size="small"
                color="primary"
                title="Edit"
                @click="openEditOrderForm(item)"
              ></v-btn>
              <v-btn
                v-if="item.status === 'Pending' && auth.canRecord('services', 'edit', item)"
                prepend-icon="mdi-play-circle-outline"
                variant="tonal"
                size="x-small"
                color="primary"
                class="mr-1"
                @click="updateStatus(item, 'In Progress')"
              >Start Service</v-btn>
              <v-btn
                v-if="item.status === 'In Progress' && auth.canRecord('services', 'edit', item)"
                prepend-icon="mdi-check-circle-outline"
                variant="tonal"
                size="x-small"
                color="success"
                class="mr-1"
                @click="confirmOrderCompletion(item)"
              >Complete</v-btn>
              <v-btn
                v-if="['Pending', 'In Progress'].includes(item.status) && auth.canRecord('services', 'edit', item)"
                prepend-icon="mdi-close-circle-outline"
                variant="tonal"
                size="x-small"
                color="warning"
                class="mr-1"
                @click="updateStatus(item, 'Cancelled')"
              >Cancel</v-btn>
              <v-btn
                v-if="item.status === 'CompletedInvoicePending' && auth.can('invoices', 'write')"
                prepend-icon="mdi-receipt-text-plus"
                variant="flat"
                size="x-small"
                color="orange"
                class="mr-1"
                @click="triggerCreateInvoice(item)"
              >Create Invoice</v-btn>
              <v-btn
                v-if="['CompletedInvoicePending', 'CompletedInvoiceCreated'].includes(item.status) && auth.canRecord('services', 'edit', item)"
                prepend-icon="mdi-undo"
                variant="tonal"
                size="x-small"
                color="grey"
                class="mr-1"
                @click="revertOrder(item)"
              >Revert</v-btn>
              <v-btn
                v-if="item.status === 'Cancelled' && auth.canRecord('services', 'edit', item)"
                prepend-icon="mdi-restore"
                variant="tonal"
                size="x-small"
                color="primary"
                class="mr-1"
                @click="updateStatus(item, 'Pending')"
              >Restore</v-btn>
              <v-btn v-if="auth.canRecord('services', 'delete', item)" icon="mdi-delete-outline" variant="text" size="small" color="error" title="Delete" @click="confirmDeleteOrder(item)"></v-btn>
            </template>

          </v-data-table>
        </v-card>
      </v-window-item>

    </v-window>

    <!-- DIALOGS -->
    <v-dialog v-model="orderDialog" max-width="600px" persistent>
      <ServiceOrderForm
        v-if="orderDialog"
        :service-types="activeServiceTypes"
        :loading="serviceStore.loading || completionSaving"
        :order="editingOrder"
        @save="saveOrder"
        @cancel="closeOrderForm"
      />
    </v-dialog>

    <v-dialog v-model="invoiceDialog" fullscreen persistent>
      <InvoiceDialog
        v-if="invoiceDialog"
        :prefilled-service-order-id="prefilledServiceOrderId"
        @save="onInvoiceSaved"
        @cancel="invoiceDialog = false"
      />
    </v-dialog>

    <!-- Settings Dialog -->
    <v-dialog v-model="settingsDialog" max-width="720px" persistent>
      <ServiceSettingsDialog
        v-if="settingsDialog"
        @close="settingsDialog = false"
        @success="onSettingsSuccess"
        @error="onSettingsError"
      />
    </v-dialog>

    <!-- Invoice Detail View -->
    <v-dialog v-model="viewDialog" max-width="95vw">
      <InvoiceDetailView
        v-if="viewDialog"
        :invoice-id="selectedViewInvoice?.id"
        @close="viewDialog = false"
      />
    </v-dialog>

    <ConfirmDialog
      v-model="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-text="confirmDialog.confirmText"
      color="success"
      icon="mdi-check-circle-outline"
      :loading="serviceStore.loading || completionSaving"
      @confirm="executeOrderCompletion"
    >
      <v-card
        class="mt-4 pa-3 d-flex align-center cursor-pointer transition-swing border"
        :class="followUpRequired ? 'bg-orange-lighten-5 border-orange' : 'bg-grey-lighten-4 border-transparent'"
        variant="flat"
        @click="followUpRequired = !followUpRequired"
      >
        <v-icon
          :icon="followUpRequired ? 'mdi-check-circle' : 'mdi-circle-outline'"
          :color="followUpRequired ? 'orange' : 'grey'"
          size="28"
          class="mr-3"
        ></v-icon>
        <div class="d-flex flex-column text-left">
          <span class="font-weight-bold" :class="followUpRequired ? 'text-orange-darken-2' : 'text-grey-darken-2'">Requires Follow-Up</span>
          <span class="text-caption" :class="followUpRequired ? 'text-orange-darken-1' : 'text-grey'">Create a reminder card to verify results later</span>
        </div>
      </v-card>
    </ConfirmDialog>

    <!-- Completion Cost Management Dialog -->
    <v-dialog v-model="completionWalletDialog.show" max-width="500px" persistent>
      <v-card class="soft-card pa-4">
        <v-card-title class="text-h5 font-weight-bold d-flex align-center">
          <v-icon icon="mdi-cash-multiple" color="primary" class="mr-2"></v-icon>
          {{ completionWalletDialog.amount === 0 ? 'Complete Zero-Cost Service' : 'Service Cost Deduction' }}
        </v-card-title>
        <v-card-text class="mt-4">
          <p class="text-h6 mb-1">Service cost: AED {{ Number(completionWalletDialog.amount).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) }}</p><p class="text-caption text-medium-emphasis mb-4">From {{ completionWalletDialog.source }}</p><v-alert v-if="completionWalletDialog.amount===0" type="warning" variant="tonal" class="mb-3"><strong>Zero-cost service — no wallet deduction will be made.</strong><br>If a cost applies, cancel and correct the service master or linked sales order/invoice before completing.</v-alert><v-checkbox v-if="completionWalletDialog.amount===0" v-model="completionWalletDialog.zeroConfirmed" label="I confirm the cost is AED 0.00 and no wallet deduction is needed" hide-details class="mb-4" /><p v-else class="mb-4 text-grey-darken-1">Select the wallet or supplier for this cost.</p>
          
          <v-btn-toggle v-if="completionWalletDialog.amount>0" v-model="completionWalletDialog.costType" mandatory class="mb-4 d-flex rounded-lg" color="primary" variant="tonal" density="comfortable">
            <v-btn value="Wallet" class="flex-grow-1 font-weight-bold text-none">Deduct from Wallet</v-btn>
            <v-btn value="Supplier" class="flex-grow-1 font-weight-bold text-none">Bill to Supplier</v-btn>
          </v-btn-toggle>

          <v-select
            v-if="completionWalletDialog.amount>0 && completionWalletDialog.costType === 'Wallet'"
            v-model="completionWalletDialog.selectedWallet"
            :items="walletStore.accounts"
            item-title="name"
            item-value="id"
            label="Wallet Account"
            variant="outlined"
            prepend-inner-icon="mdi-wallet"
            :rules="[v => !!v || 'Wallet selection is required']"
          >
            <template v-slot:selection="{ item }">
              <div class="d-flex align-center">
                <v-avatar size="20" class="mr-2" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
                <v-avatar size="20" class="mr-2 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
                <span>{{ item.raw.name }}</span>
              </div>
            </template>
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :title="item.raw.name">
                <template v-slot:prepend>
                  <v-avatar size="24" class="mr-3" v-if="item.raw.logo_url" rounded="0"><v-img :src="item.raw.logo_url"></v-img></v-avatar>
                  <v-avatar size="24" class="mr-3 bg-primary" v-else><v-icon size="x-small" icon="mdi-bank"></v-icon></v-avatar>
                </template>
              </v-list-item>
            </template>
          </v-select>

          <v-select
            v-if="completionWalletDialog.amount>0 && completionWalletDialog.costType === 'Supplier'"
            v-model="completionWalletDialog.selectedSupplier"
            :items="suppliersList"
            item-title="name"
            item-value="id"
            label="Supplier"
            variant="outlined"
            prepend-inner-icon="mdi-truck-outline"
            :rules="[v => !!v || 'Supplier selection is required']"
          ></v-select>

          <v-card
            class="mt-4 pa-3 d-flex align-center cursor-pointer transition-swing border"
            :class="followUpRequired ? 'bg-orange-lighten-5 border-orange' : 'bg-grey-lighten-4 border-transparent'"
            variant="flat"
            @click="followUpRequired = !followUpRequired"
          >
            <v-icon
              :icon="followUpRequired ? 'mdi-check-circle' : 'mdi-circle-outline'"
              :color="followUpRequired ? 'orange' : 'grey'"
              size="28"
              class="mr-3"
            ></v-icon>
            <div class="d-flex flex-column text-left">
              <span class="font-weight-bold" :class="followUpRequired ? 'text-orange-darken-2' : 'text-grey-darken-2'">Requires Follow-Up</span>
              <span class="text-caption" :class="followUpRequired ? 'text-orange-darken-1' : 'text-grey'">Create a reminder card to verify results later</span>
            </div>
          </v-card>

        </v-card-text>
        <v-card-actions class="pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="completionWalletDialog.show = false">Cancel</v-btn>
          <v-btn 
            color="primary" 
            variant="flat" 
            rounded="lg" 
            class="px-8" 
            :loading="serviceStore.loading || completionSaving" 
            @click="executeOrderCompletionWithCost" 
            :disabled="completionWalletDialog.amount===0 ? !completionWalletDialog.zeroConfirmed : (completionWalletDialog.costType === 'Wallet' && !completionWalletDialog.selectedWallet) || (completionWalletDialog.costType === 'Supplier' && !completionWalletDialog.selectedSupplier)"
          >
            Complete Service
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4000">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useServiceStore } from '~/stores/services';
import { useAuthStore } from '~/stores/auth';
import ServiceOrderForm from '~/components/services/ServiceOrderForm.vue';
import ServiceStaffAvatar from '~/components/services/ServiceStaffAvatar.vue';
import ServiceInvoiceBadge from '~/components/services/ServiceInvoiceBadge.vue';
import { refreshServiceInvoiceBadges } from '~/utils/serviceInvoice.mjs';
import ServiceSettingsDialog from '~/components/services/ServiceSettingsDialog.vue';
import {serviceFooterColors} from '~/utils/serviceAppearance';
import ConfirmDialog from '~/components/common/ConfirmDialog.vue';
import InvoiceDialog from '~/components/invoices/InvoiceDialog.vue';
import InvoiceDetailView from '~/components/invoices/InvoiceDetailView.vue';
import { useWhatsApp } from '~/composables/useWhatsApp';
import { useConfigStore } from '~/stores/config';
import { useWalletStore } from '~/stores/wallet';

// ─── Stores ───────────────────────────────────────────────────────────────────
const serviceStore = useServiceStore();
const auth = useAuthStore();
const configStore = useConfigStore();
const walletStore = useWalletStore();
const { openWhatsApp } = useWhatsApp();

// ─── UI State ─────────────────────────────────────────────────────────────────
const serviceRoute = useRoute();
const serviceRouter = useRouter();
const viewMode = ref(serviceRoute.query.service_id ? 'list' : 'kanban');
const searchOrders = ref(String(useRoute().query.search || ''));
const staffFilter = ref('all');
const staffFilterOptions = computed(() => [{ title: 'All staff', value: 'all' }, { title: 'Unassigned', value: 'unassigned' }, { title: 'Assigned to me', value: String(auth.user?.id) }, ...Array.from(new Map(serviceStore.serviceOrders.filter(order => order.AssignedStaff).map(order => [String(order.assigned_user_id), { title: order.AssignedStaff.name, value: String(order.assigned_user_id) }])).values()).filter(user => user.value !== String(auth.user?.id))]);
const orderDialog = ref(false);
const invoiceDialog = ref(false);
const settingsDialog = ref(false);
const footerColours=computed(()=>serviceFooterColors(configStore.settings.service_footer_colors));
const footerStyle=status=>({backgroundColor:footerColours.value[status]});
const viewDialog = ref(false);
const prefilledServiceOrderId = ref(null);
const selectedOrderForCompletion = ref(null);
const selectedViewInvoice = ref(null);
const editingOrder = ref(null);
const followUpRequired = ref(false);

const sortBy = ref('default');
const criticalityFilter = ref('All');

const snackbar = reactive({ show: false, text: '', color: 'success' });
const confirmDialog = reactive({ show: false, title: '', message: '', confirmText: 'Confirm' });
const completionWalletDialog = reactive({ show: false, selectedWallet: null, costType: 'Wallet', selectedSupplier: null, amount:0, source:'', zeroConfirmed:false });
const completionSaving=ref(false),completionPreviewLoading=ref(false);

const { $api } = useNuxtApp();
const suppliersList = ref([]);

const fetchSuppliers = async () => {
  try {
    const res = await $api.get('/suppliers', { params: { is_active: true } });
    if (res.data?.success) {
      suppliersList.value = res.data.data;
    }
  } catch (err) {
    console.error('Failed to load suppliers for cost deduction:', err);
  }
};

// ─── Status Options ────────────────────────────────────────────────────────────
const statusOptions = [
  { title: 'Pending',              value: 'Pending' },
  { title: 'In Progress',          value: 'In Progress' },
  { title: '✓ - Invoice Pending',  value: 'CompletedInvoicePending' },
  { title: '✓ - Invoice Created',  value: 'CompletedInvoiceCreated' },
  { title: 'Cancelled',            value: 'Cancelled' },
];

// ─── Table Headers ─────────────────────────────────────────────────────────────
const orderHeaders = [
  { title: '#ID',      key: 'id',            width: '125px' },
  { title: 'Date',     key: 'created_at',    sortable: true },
  { title: 'Customer', key: 'Customer',      sortable: false },
  { title: 'Service',  key: 'ServiceType',   sortable: false },
  { title: 'Assigned Staff', key: 'AssignedStaff.name', sortable: false },
  { title: 'Invoice',  key: 'invoice_badge', align: 'center', sortable: false },
  { title: 'Status',   key: 'status',        align: 'center', sortable: true },
  { title: 'Actions',  key: 'actions',       align: 'end',    sortable: false },
];

// Open the same InvoiceDetailView as in the invoice list
const openInvoiceView = (invoice) => {
  if (!invoice?.id) return;
  selectedViewInvoice.value = invoice;
  viewDialog.value = true;
};

// ─── Invoice Badge Helper ─────────────────────────────────────────────────────
const hasInvoice = (order) => {
  return order.Invoice && order.Invoice.id && order.Invoice.status !== 'Cancelled';
};

// ─── Computed ─────────────────────────────────────────────────────────────────
const filteredOrders = computed(() => {
  const s = searchOrders.value.toLowerCase().trim();
  return serviceStore.serviceOrders.filter(order => {
    const matchesStaff = staffFilter.value === 'all' || (staffFilter.value === 'unassigned' ? !order.assigned_user_id : String(order.assigned_user_id) === staffFilter.value);
    return matchesStaff && (!s || order.Customer?.name?.toLowerCase().includes(s) || order.ServiceType?.name?.toLowerCase().includes(s) || order.AssignedStaff?.name?.toLowerCase().includes(s) || String(order.id).includes(s) || ('srv-' + String(order.id).padStart(5, '0')).includes(s));
  });
});

const activeServiceTypes = computed(() =>
  serviceStore.serviceTypes.filter(t => t.is_active)
);

const groupedOrders = computed(() => {
  const groups = {
    Pending: [],
    'In Progress': [],
    CompletedInvoicePending: [],
    CompletedInvoiceCreated: [],
    FollowUpRequired: [],
    Cancelled: []
  };
  filteredOrders.value.forEach(o => {
    if (groups[o.status] !== undefined) groups[o.status].push(o);
    if (o.requires_follow_up && !o.is_follow_up_done && o.status.startsWith('Completed')) {
      groups.FollowUpRequired.push({ ...o, is_followup_card: true });
    }
  });
  return groups;
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────
const fetchData = async () => {
  try {
    const { $api } = useNuxtApp();
    await $api.post('/services/orders/escalate');
  } catch (err) {
    console.error('Failed to run automatic criticality escalation', err);
  }

  const params = {};
  if (serviceRoute.query.service_id) params.service_id = serviceRoute.query.service_id;
  if (criticalityFilter.value !== 'All') {
    params.criticality = criticalityFilter.value;
  }
  if (sortBy.value === 'criticality') {
    params.sort = 'criticality';
  }
  if (auth.can('services', 'read')) {
    await serviceStore.fetchServiceOrders(params);
    await serviceStore.fetchServiceTypes({ limit: 1000 });
    await walletStore.fetchAccounts();
  }
};

onMounted(async () => {
  // Always refresh the global config so wallet_deduction_point reflects
  // any changes made in Settings without requiring a hard page refresh.
  await configStore.fetchSettings();
  fetchData();
  fetchSuppliers();
});
watch(() => serviceRoute.query.service_id, () => { if (serviceRoute.query.service_id) viewMode.value = 'list'; fetchData(); });

watch([sortBy, criticalityFilter], () => {
  fetchData();
});

// Refresh only invoice badges, without replacing service workflow data or filters.
let badgeRefreshTimer, badgeRefreshRunning = false, badgeRefreshActive = false;
const refreshInvoiceBadges = async () => {
  if (!badgeRefreshActive || document.hidden || badgeRefreshRunning || serviceStore.loading || !auth.can('services', 'read') || !serviceStore.serviceOrders.some(hasInvoice)) return;
  const actor = auth.user, filter = criticalityFilter.value, sort = sortBy.value;
  badgeRefreshRunning = true;
  try {
    const { data } = await $api.get('/services/orders', { params: {
      ...(filter !== 'All' ? { criticality: filter } : {}),
      ...(sort === 'criticality' ? { sort } : {}), limit: 200
    } });
    if (badgeRefreshActive && auth.user === actor && auth.can('services', 'read') && filter === criticalityFilter.value && sort === sortBy.value && data.success) {
      serviceStore.serviceOrders = refreshServiceInvoiceBadges(serviceStore.serviceOrders, data.data);
    }
  } catch (error) { console.debug('Invoice badge refresh will retry.', error); }
  finally { badgeRefreshRunning = false; }
};
onMounted(() => {
  badgeRefreshActive = true;
  window.addEventListener('focus', refreshInvoiceBadges);
  document.addEventListener('visibilitychange', refreshInvoiceBadges);
  badgeRefreshTimer = window.setInterval(refreshInvoiceBadges, 30000);
});
onBeforeUnmount(() => {
  badgeRefreshActive = false;
  window.clearInterval(badgeRefreshTimer);
  window.removeEventListener('focus', refreshInvoiceBadges);
  document.removeEventListener('visibilitychange', refreshInvoiceBadges);
});

// ─── Actions ──────────────────────────────────────────────────────────────────
const openOrderForm = () => {
  editingOrder.value = null;
  orderDialog.value = true;
};
useCreateAction('services', openOrderForm);

const openEditOrderForm = (order) => {
  editingOrder.value = order;
  orderDialog.value = true;
};

const saveOrder = async (data) => {
  try {
    if (editingOrder.value) {
      await serviceStore.updateServiceOrder(editingOrder.value.id, data);
      showSnackbar('Service order updated successfully');
    } else {
      await serviceStore.createServiceOrder(data);
      showSnackbar('Service order created successfully');
    }
    closeOrderForm();
  } catch (err) {
    showSnackbar(err.message || 'Failed to save order', 'error');
  }
};

const closeOrderForm = () => {
  orderDialog.value = false;
  editingOrder.value = null;
};

const updateStatus = async (order, newStatus) => {
  if (newStatus === 'Completed') {
    confirmOrderCompletion(order);
    return;
  }
  try {
    const res = await serviceStore.updateOrderStatus(order.id, newStatus);
    showSnackbar(res?.message || `Order moved to ${newStatus}`);
  } catch (err) {
    showSnackbar(err.message || 'Failed to update status', 'error');
    await serviceStore.fetchServiceOrders();
  }
};

// ─── Settings callbacks ──────────────────────────────────────────────────────
const onSettingsSuccess = async (message) => {
  showSnackbar(message, 'success');
  // Re-fetch global config so any wallet_deduction_point change is reactive immediately
  await configStore.fetchSettings();
  fetchData();
};

const onSettingsError = (message) => {
  showSnackbar(message, 'error');
};

// ─── Completion Flow ──────────────────────────────────────────────────────────
const confirmOrderCompletion = async (order) => {
  if(completionPreviewLoading.value || completionSaving.value)return;
  let zeroCostCompletion=false;
  completionPreviewLoading.value=true;
  selectedOrderForCompletion.value=order;
  try {
    const {$api}=useNuxtApp();
    const cost=(await $api.get(`/services/orders/${order.id}/completion`)).data.data;
    zeroCostCompletion=Number(cost.amount)===0 && !cost.already_deducted;
    if(cost.policy==='service_completion' && !cost.already_deducted){
      followUpRequired.value=false;
      Object.assign(completionWalletDialog,{amount:Number(cost.amount),source:cost.source,zeroConfirmed:false,selectedWallet:null,selectedSupplier:null,costType:'Wallet',show:true});
      return;
    }
  }catch(error){showSnackbar(error.response?.data?.message || 'Unable to check the completion cost. Please retry.','error');return;}
  finally{completionPreviewLoading.value=false;}
  const invoiceExists = hasInvoice(order);
  followUpRequired.value = false;
  confirmDialog.title = 'Complete Service?';
  confirmDialog.confirmText = 'Complete Service';
  confirmDialog.message = invoiceExists
    ? `Completing service for "${order.Customer?.name}".\n\nAn invoice already exists — the service will move to Completed – Invoice Created.`
    : `Completing service for "${order.Customer?.name}".\n\nNo invoice found — the service will move to Completed – Invoice Pending, where you can generate the invoice.`;
  if(zeroCostCompletion)confirmDialog.message+='\n\nZero-cost service — no wallet deduction will be made.';
  confirmDialog.show = true;
};

const executeOrderCompletion = async () => {
  if (!selectedOrderForCompletion.value || completionSaving.value) return;
  completionSaving.value=true;
  try {
    const { $api } = useNuxtApp();
    const res = await $api.put(`/services/orders/${selectedOrderForCompletion.value.id}/status`, {
      status: 'Completed',
      requires_follow_up: followUpRequired.value
    });
    confirmDialog.show = false;
    showSnackbar(res.data?.message || 'Service completed!', 'success');
    selectedOrderForCompletion.value = null;
    fetchData(); // Refresh to update kanban board
  } catch (err) {
    showSnackbar(err.response?.data?.message || err.message || 'Failed to complete order', 'error');
  } finally { completionSaving.value=false; }
};

const executeOrderCompletionWithCost = async () => {
  if(completionSaving.value || (completionWalletDialog.amount===0 && !completionWalletDialog.zeroConfirmed))return;
  if (completionWalletDialog.amount>0 && completionWalletDialog.costType === 'Wallet' && !completionWalletDialog.selectedWallet) return;
  if (completionWalletDialog.amount>0 && completionWalletDialog.costType === 'Supplier' && !completionWalletDialog.selectedSupplier) return;
  if (!selectedOrderForCompletion.value) return;
  completionSaving.value=true;
  try {
    // Determine payload based on costType
    const payload = {
      status: 'Completed',
      cost_type: completionWalletDialog.amount>0?completionWalletDialog.costType:undefined,
      confirm_zero_cost:completionWalletDialog.amount===0 && completionWalletDialog.zeroConfirmed,
      requires_follow_up: followUpRequired.value
    };
    if (completionWalletDialog.amount>0 && completionWalletDialog.costType === 'Wallet') {
      payload.wallet_id = completionWalletDialog.selectedWallet;
    } else if(completionWalletDialog.amount>0) {
      payload.cost_supplier_id = completionWalletDialog.selectedSupplier;
    }

    const { $api } = useNuxtApp();
    const response = await $api.put(`/services/orders/${selectedOrderForCompletion.value.id}/status`, payload);
    
    completionWalletDialog.show = false;
    showSnackbar(response.data?.message || 'Service completed!', 'success');
    selectedOrderForCompletion.value = null;
    fetchData(); // Refresh to update kanban board
  } catch (err) {
    showSnackbar(err.response?.data?.message || err.message || 'Failed to complete order', 'error');
  } finally { completionSaving.value=false; }
};

// ─── Revert ───────────────────────────────────────────────────────────────────
const revertOrder = async (order) => {
  try {
    await serviceStore.updateOrderStatus(order.id, 'In Progress');
    showSnackbar('Service reverted to In Progress');
  } catch (err) {
    showSnackbar(err.message || 'Failed to revert', 'error');
  }
};

const markFollowUpDone = async (order) => {
  try {
    const { $api } = useNuxtApp();
    const res = await $api.put(`/services/orders/${order.id}/followup`);
    showSnackbar(res.data?.message || 'Follow up completed!', 'success');
    fetchData();
  } catch (err) {
    showSnackbar(err.response?.data?.message || err.message || 'Failed to mark follow up done', 'error');
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
const confirmDeleteOrder = async (order) => {
  if (confirm(`Delete Service Order #${String(order.id).padStart(5, '0')}?`)) {
    try {
      await serviceStore.deleteServiceOrder(order.id);
      showSnackbar('Order deleted');
    } catch (err) {
      showSnackbar('Failed to delete order', 'error');
    }
  }
};

// ─── Invoice Dialog ───────────────────────────────────────────────────────────
const triggerCreateInvoice = (order) => {
  prefilledServiceOrderId.value = order.id;
  invoiceDialog.value = true;
};

const onInvoiceSaved = () => {
  invoiceDialog.value = false;
  fetchData();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatusColor = (status) => {
  const map = {
    Pending:                 'grey',
    'In Progress':              'primary',
    CompletedInvoicePending: 'orange',
    CompletedInvoiceCreated: 'success',
    Cancelled:               'error',
  };
  return map[status] || 'grey';
};

const openWhatsAppRemind = async (order) => {
  const num = order.Customer?.phone_whatsapp;
  if (!num) return showSnackbar('Customer phone not found', 'warning');
  const msg = `Hi ${order.Customer?.name}, this is a reminder regarding your ${order.ServiceType?.name} service. Current status: ${order.status}.`;
  openWhatsApp(num, msg);

  try {
    await serviceStore.incrementReminderCount(order.id);
  } catch (err) {
    console.error('Failed to increment reminder count:', err);
  }
};

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB') + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const showSnackbar = (text, color = 'success') => {
  snackbar.text = text;
  snackbar.color = color;
  snackbar.show = true;
};
</script>

<style>
/* ==========================================================
   STRICT CLASSIC THEME — Service Management Page
   Scoped under .v-theme--classic only
   ========================================================== */

:global(.v-theme--classic) .v-container {
  background: #F8F9FE !important;
}

/* ── Stat Cards & Containers ── */
:global(.v-theme--classic) .soft-card {
  background: #FFFFFF !important;
  border: 1px solid rgba(79, 66, 148, 0.12) !important;
  box-shadow: 0 4px 20px -4px rgba(79, 66, 148, 0.08) !important;
}

/* ── Primary Buttons ── */
:global(.v-theme--classic) .v-btn--variant-elevated,
:global(.v-theme--classic) .v-btn--variant-flat:not(.v-tab):not(.v-btn--icon):not(.v-btn--variant-text) {
  background: #4F4294 !important;
  color: #FFFFFF !important;
  box-shadow: 0 4px 14px -4px rgba(79, 66, 148, 0.40) !important;
}
:global(.v-theme--classic) .v-btn--variant-elevated:hover,
:global(.v-theme--classic) .v-btn--variant-flat:not(.v-tab):not(.v-btn--icon):not(.v-btn--variant-text):hover {
  background: #6554C0 !important;
  transform: translateY(-1px) !important;
}

:global(.v-theme--classic) .v-btn--variant-text,
:global(.v-theme--classic) .v-btn--icon {
  color: #4F4294 !important;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

:global(.v-theme--classic) .v-btn--variant-outlined {
  border-color: rgba(79, 66, 148, 0.30) !important;
  color: #4F4294 !important;
  background: #FFFFFF !important;
}

/* ── Active View Mode Pill Toggle ── */
:global(.v-theme--classic) .bg-primary {
  background: #4F4294 !important;
  color: #FFFFFF !important;
}

/* ── Kanban Column Headers & Cards ── */
.kanban-container {
  min-height: 550px;
}

.kanban-row {
  scrollbar-width: thin;
  margin-inline: -6px;
}

.kanban-col {
  padding-inline: 6px !important;
  min-width: 290px !important;
  max-width: 325px !important;
  flex: 0 0 310px !important;
}

.service-card-footer { margin-inline:-12px; margin-bottom:-12px; padding:8px 12px 12px; }

.kanban-container .kanban-header,
.kanban-container .order-card { border-radius:12px !important; }

.kanban-header {
  display: flex !important;
  align-items: center !important;
  padding: 10px 16px !important;
  border-radius: 12px !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  background: #FFFFFF !important;
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.05) !important;
  letter-spacing: 0.01em;
}

.kanban-header--pending {
  background: rgba(100, 116, 139, 0.08) !important;
  border-color: rgba(100, 116, 139, 0.22) !important;
  color: #334155 !important;
}

.kanban-header--inprogress,
:global(.v-theme--classic) .kanban-header--inprogress {
  background: rgba(79, 66, 148, 0.08) !important;
  border-color: rgba(79, 66, 148, 0.22) !important;
  color: #4F4294 !important;
}

.kanban-header--invoice-pending {
  background: rgba(245, 158, 11, 0.09) !important;
  border-color: rgba(245, 158, 11, 0.25) !important;
  color: #B45309 !important;
}

.kanban-header--done {
  background: rgba(16, 185, 129, 0.09) !important;
  border-color: rgba(16, 185, 129, 0.22) !important;
  color: #047857 !important;
}

.kanban-header--followup {
  background: rgba(245, 158, 11, 0.1) !important;
  border-color: rgba(245, 158, 11, 0.28) !important;
  color: #D97706 !important;
}

.kanban-header--cancelled {
  background: rgba(239, 68, 68, 0.08) !important;
  border-color: rgba(239, 68, 68, 0.20) !important;
  color: #B91C1C !important;
}

.empty-col {
  text-align: center;
  padding: 32px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #94A3B8;
  border: 2px dashed rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}

:global(.v-theme--classic) .order-card {
  border-color: rgba(79, 66, 148, 0.12) !important;
}
:global(.v-theme--classic) .order-card:hover {
  border-color: #4F4294 !important;
  box-shadow: 0 6px 20px -4px rgba(79, 66, 148, 0.15) !important;
}

/* ── Data Table Header (List View) ── */
:global(.v-theme--classic) .v-data-table .v-data-table-header__content {
  color: #4F4294 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

:global(.v-theme--classic) .v-data-table .v-data-table__tr:hover td {
  background: rgba(79, 66, 148, 0.04) !important;
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
