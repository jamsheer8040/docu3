<template>
  <v-container fluid class="pa-2 pa-sm-4 pa-md-6">
    <!-- Header -->
    <v-row class="mb-2 align-center">
      <v-col cols="12" class="py-1">
        <div class="d-flex align-center justify-space-between w-100 flex-wrap">
          <div>
            <h1 class="text-h4 font-weight-bold color-primary mb-0">
              <v-icon icon="mdi-file-eye-outline" class="mr-2" color="primary"></v-icon>
              Document Management
            </h1>
            <p class="text-subtitle-2 text-grey-darken-1 mb-0">Monitor and manage document validity across your client base</p>
          </div>
          <div class="d-flex align-center mt-4 mt-sm-0" style="gap: 12px;">
            <v-btn
              v-if="auth.can('settings', 'write')"
              icon="mdi-cog"
              variant="tonal"
              color="primary"
              height="40"
              width="40"
              rounded="lg"
              @click="settingsDialog = true"
            ></v-btn>
            <v-btn
              v-if="auth.can('documents', 'create')"
              color="primary"
              prepend-icon="mdi-plus"
              rounded="lg"
              elevation="2"
              height="40"
              class="font-weight-bold"
              @click="openForm()"
            >
              Add Document
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Main Tabs -->
    <v-tabs v-model="activeTab" color="primary" class="mb-6 font-weight-bold" grow>
      <v-tab v-if="auth.user?.role_type === 'CustomerPortal'" value="alerts">
        <v-icon start icon="mdi-clock-alert-outline"></v-icon> Alerts
      </v-tab>
      <v-tab value="tracker"><v-icon start icon="mdi-calendar-clock"></v-icon> Tracker</v-tab>
      <v-tab value="all"><v-icon start icon="mdi-format-list-bulleted"></v-icon> All Documents</v-tab>
    </v-tabs>

    <!-- Status / Errors -->
    <v-row v-if="error" class="mb-4">
      <v-col cols="12">
        <v-alert
          type="error"
          variant="tonal"
          closable
          icon="mdi-alert-circle-outline"
          class="rounded-xl"
        >
          {{ error }}
          <template v-slot:append>
             <v-btn variant="text" size="small" @click="fetchDocuments">Retry</v-btn>
          </template>
        </v-alert>
      </v-col>
    </v-row>

    <v-window v-model="activeTab" :touch="{ left: null, right: null }" class="overflow-visible">
      <!-- ALERTS TAB (Only for Customer Portal) -->
      <v-window-item v-if="auth.user?.role_type === 'CustomerPortal'" value="alerts">
        <div class="d-flex flex-column" style="gap: 14px;">
          <template v-if="alertDocuments.length">
            <v-card
              v-for="doc in alertDocuments"
              :key="doc.id"
              class="alert-card rounded-xl pa-4 d-flex align-center cursor-pointer"
              :class="doc.days_remaining <= 0 ? 'alert-card--overdue' : (doc.days_remaining <= 7 ? 'alert-card--critical' : 'alert-card--warning')"
              elevation="0"
              @click="openDetails(doc)"
            >
              <v-avatar
                size="52"
                class="alert-card__icon mr-4 flex-shrink-0"
                :class="doc.days_remaining <= 0 ? 'alert-card__icon--overdue' : (doc.days_remaining <= 7 ? 'alert-card__icon--critical' : 'alert-card__icon--warning')"
              >
                <v-icon icon="mdi-file-document-outline" size="26"></v-icon>
              </v-avatar>

              <div class="flex-grow-1 overflow-hidden">
                <div class="text-subtitle-1 font-weight-bold text-truncate" style="line-height: 1.3;">
                  {{ doc.DocumentType?.name || doc.type || 'Document' }}
                </div>
                <div class="text-body-2 text-medium-emphasis text-truncate" style="line-height: 1.4;">
                  {{ doc.Customer?.name || 'Unknown' }}
                </div>
              </div>

              <div class="d-flex flex-column align-center justify-center flex-shrink-0 ml-4" style="min-width: 60px;">
                <span
                  class="font-weight-black"
                  :class="doc.days_remaining <= 0 ? 'text-error' : (doc.days_remaining <= 7 ? 'text-error' : 'text-warning-darken-2')"
                  style="font-size: 2rem; line-height: 1;"
                >
                  {{ doc.days_remaining <= 0 ? Math.abs(doc.days_remaining) : doc.days_remaining }}
                </span>
                <span
                  class="text-uppercase font-weight-black mt-1"
                  :class="doc.days_remaining <= 0 ? 'text-error' : (doc.days_remaining <= 7 ? 'text-error' : 'text-warning-darken-2')"
                  style="font-size: 0.65rem; letter-spacing: 0.08em;"
                >
                  {{ doc.days_remaining < 0 ? 'OVERDUE' : (doc.days_remaining === 0 ? 'TODAY' : 'DAYS LEFT') }}
                </span>
              </div>
            </v-card>
          </template>

          <div v-else class="pa-12 text-center">
            <v-avatar color="success" variant="tonal" size="64" class="mb-4">
              <v-icon icon="mdi-shield-check-outline" size="32" color="success"></v-icon>
            </v-avatar>
            <h3 class="text-h6 font-weight-bold mb-1">All Clear</h3>
            <p class="text-caption text-secondary">No documents are expiring within the next 30 days.</p>
          </div>
        </div>
      </v-window-item>

      <!-- EXPIRY TRACKER TAB -->
      <v-window-item value="tracker">
        <!-- Tracker Action Bar -->
        <v-row class="mb-6 align-center">
          <v-col cols="12" sm="4" md="3">
            <v-select
              v-model="urgencyFilter"
              :items="filterOptions"
              placeholder="Filter by Status"
              prepend-inner-icon="mdi-filter-variant"
              variant="solo"
              flat
              hide-details
              class="search-pill font-weight-bold"
              density="comfortable"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                   <template v-slot:prepend>
                      <v-icon 
                        :icon="getStatusIcon(item.value)" 
                        :color="getStatusColor(item.value)"
                      ></v-icon>
                   </template>
                </v-list-item>
              </template>
            </v-select>
          </v-col>
          <v-col cols="12" sm="8" md="5">
            <v-text-field
              v-model="searchQuery"
              placeholder="Search in tracker..."
              prepend-inner-icon="mdi-magnify"
              variant="solo"
              flat
              hide-details
              class="search-pill"
              density="comfortable"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4" class="d-flex justify-md-end">
            <div class="bg-white border rounded-pill d-flex align-center pa-1 elevation-1" style="height: 48px;">
              <v-btn
                :class="['text-none font-weight-bold px-6 rounded-pill', viewMode === 'kanban' ? 'active-toggle' : 'text-grey-darken-3']"
                :variant="viewMode === 'kanban' ? 'flat' : 'text'"
                @click="viewMode = 'kanban'"
                height="40"
              >
                <v-icon start size="20">mdi-view-column</v-icon>
                Kanban
              </v-btn>
              <v-btn
                :class="['text-none font-weight-bold px-6 rounded-pill ml-1', viewMode === 'calendar' ? 'active-toggle' : 'text-grey-darken-3']"
                :variant="viewMode === 'calendar' ? 'flat' : 'text'"
                @click="viewMode = 'calendar'"
                height="40"
              >
                <v-icon start size="20">mdi-calendar-month</v-icon>
                Calendar
              </v-btn>
            </div>
          </v-col>
        </v-row>

        <div class="views-container">
          <!-- Kanban View -->
          <div v-if="viewMode === 'kanban'" class="kanban-wrapper">
             <v-row v-if="loading && !allDocumentsFlat.length" class="mt-4">
              <v-col v-for="i in 4" :key="i" cols="12" md="3">
                <v-skeleton-loader type="card" height="300"></v-skeleton-loader>
              </v-col>
            </v-row>
            <!-- Desktop Kanban -->
            <v-row v-else-if="!$vuetify.display.smAndDown" class="kanban-row">
              <v-col 
                v-for="stage in documentStore.stages" 
                :key="stage.id" 
                v-show="urgencyFilter === 'all' || urgencyFilter === stage.id" 
                class="kanban-col"
              >
                <div class="pa-2 mb-2">
                  <v-chip :color="stage.color" variant="tonal" class="font-weight-bold px-4 py-4" style="height: auto; width: 100%; border-radius: 12px;">
                    <v-icon start :icon="stage.icon"></v-icon>
                    {{ stage.title }} ({{ (documentStore.groupedDocs[stage.id] || []).length }})
                  </v-chip>
                </div>
                <div class="col-content pa-2 rounded-xl">
                  <DocumentCard
                    v-for="doc in filterDocs(documentStore.groupedDocs[stage.id] || [])"
                    :key="doc.id"
                    :document="doc"
                    @edit="openForm"
                    @delete="confirmDelete"
                    @preview="openDocumentPreview"
                  />
                  <div v-if="(documentStore.groupedDocs[stage.id] || []).length === 0" class="text-caption text-center py-4 text-grey">No documents</div>
                </div>
              </v-col>
            </v-row>

            <!-- Mobile Kanban Tabs -->
            <div v-else>
              <div class="d-flex flex-column mb-4">
                <v-btn
                  v-for="stage in documentStore.stages"
                  :key="stage.id"
                  block
                  :color="mobileKanbanTab === stage.id ? stage.color : 'white'"
                  variant="flat"
                  class="text-none justify-start px-4 rounded-xl py-3 border mb-2"
                  :style="{
                    height: 'auto',
                    opacity: mobileKanbanTab === stage.id ? 1 : 0.45,
                    borderColor: mobileKanbanTab === stage.id ? 'transparent' : 'rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.25s ease'
                  }"
                  @click="mobileKanbanTab = stage.id"
                >
                  <div class="d-flex align-center w-100 justify-space-between">
                    <div class="d-flex align-center">
                      <v-avatar size="32" :color="stage.color" class="mr-3" variant="tonal">
                        <v-icon :icon="stage.icon" size="18"></v-icon>
                      </v-avatar>
                      <span class="font-weight-bold text-subtitle-2" :class="mobileKanbanTab === stage.id ? 'text-white' : 'text-grey-darken-3'">
                        {{ stage.title }}
                      </span>
                    </div>
                    <v-chip
                      size="small"
                      :color="mobileKanbanTab === stage.id ? 'white' : stage.color"
                      :variant="mobileKanbanTab === stage.id ? 'flat' : 'tonal'"
                      class="font-weight-black"
                      :class="mobileKanbanTab === stage.id ? 'text-primary' : ''"
                    >
                      {{ (documentStore.groupedDocs[stage.id] || []).length }}
                    </v-chip>
                  </div>
                </v-btn>
              </div>

              <v-window v-model="mobileKanbanTab">
                <v-window-item 
                  v-for="stage in documentStore.stages" 
                  :key="stage.id" 
                  :value="stage.id"
                >
                  <div class="col-content pa-1">
                    <DocumentCard
                      v-for="doc in filterDocs(documentStore.groupedDocs[stage.id] || [])"
                      :key="doc.id"
                      :document="doc"
                      @edit="openForm"
                      @delete="confirmDelete"
                      @preview="openDocumentPreview"
                    />
                    <div v-if="(documentStore.groupedDocs[stage.id] || []).length === 0" class="text-caption text-center py-8 text-grey">No documents</div>
                  </div>
                </v-window-item>
              </v-window>
            </div>
          </div>

          <!-- Calendar View -->
          <div v-if="viewMode === 'calendar'" class="calendar-container">
            <v-card class="pa-6 border rounded-xl" border elevation="0">
              <div class="d-flex align-center justify-space-between mb-4">
                <v-btn icon="mdi-chevron-left" variant="text" @click="prevMonth"></v-btn>
                <h2 class="text-h5">{{ currentMonthName }} {{ currentYear }}</h2>
                <v-btn icon="mdi-chevron-right" variant="text" @click="nextMonth"></v-btn>
              </div>

              <div class="calendar-grid">
                <div v-for="day in weekDays" :key="day" class="calendar-header-cell">
                  {{ day }}
                </div>
                <div
                  v-for="(cell, index) in calendarCells"
                  :key="index"
                  class="calendar-day-cell"
                  :class="{ 'other-month': cell.otherMonth, 'is-today': cell.isToday }"
                >
                  <div class="day-number">{{ cell.date.date() }}</div>
                  <div class="day-dot-container">
                     <template v-for="doc in getDocsForDate(cell.date)" :key="doc.id">
                       <v-tooltip location="top">
                          <template v-slot:activator="{ props }">
                            <v-chip
                              v-if="!smAndDown"
                              v-bind="props"
                              :color="getUrgencyColor(doc.expiry_date)"
                              size="x-small"
                              class="mb-1 d-block text-truncate"
                              @click="openDetails(doc)"
                            >
                              {{ doc.DocumentType?.name || doc.type }}: {{ doc.Customer?.name }}
                            </v-chip>
                            <v-avatar
                              v-else
                              v-bind="props"
                              :color="getUrgencyColor(doc.expiry_date)"
                              size="20"
                              class="cursor-pointer mx-auto d-flex align-center justify-center text-white font-weight-black"
                              style="font-size: 9px; min-width: 20px; border-radius: 50%;"
                              @click="openDetails(doc)"
                            >
                              {{ getDocInitials(doc) }}
                            </v-avatar>
                          </template>
                          <span>{{ doc.DocumentType?.name || doc.type }} - {{ doc.Customer?.name }} ({{ doc.doc_number }})</span>
                       </v-tooltip>
                     </template>
                  </div>
                </div>
              </div>
            </v-card>
          </div>
        </div>
      </v-window-item>

      <!-- ALL DOCUMENTS TAB -->
      <v-window-item value="all">
        <v-row class="mb-4 align-center">
          <v-col cols="12" md="3" sm="12" class="pb-md-3 pb-0">
            <v-select
               v-model="categoryFilter"
               :items="['All Categories', 'Company Document', 'Personal Document']"
               placeholder="Filter by Category"
               prepend-inner-icon="mdi-filter-variant"
               variant="solo"
               flat
               hide-details
               class="search-pill"
               density="comfortable"
            ></v-select>
          </v-col>
          <v-col cols="12" md="9" sm="12">
            <v-text-field
               v-model="allSearchQuery"
               placeholder="Search by doc number, staff name, document type, customer..."
               prepend-inner-icon="mdi-magnify"
               variant="solo"
               flat
               hide-details
               clearable
               class="search-pill"
               density="comfortable"
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- Desktop Data Table -->
        <v-card v-if="!$vuetify.display.smAndDown" class="border rounded-xl" border elevation="0">
          <v-data-table-server
            v-model:items-per-page="itemsPerPage"
            :headers="headers"
            :items="documentStore.documents"
            :items-length="documentStore.totalDocuments"
            :loading="documentStore.loading"
            @update:options="loadDocumentList"
            hover
            @click:row="handleRowClick"
          >
            <template v-slot:item.Customer="{ item }">
              <div class="font-weight-bold">{{ item.Customer?.name }}</div>
            </template>
            
            <template v-slot:item.status="{ item }">
              <v-chip :color="getUrgencyColor(item.expiry_date)" size="x-small" label class="font-weight-black text-uppercase">
                 {{ getStatusLabel(item.expiry_date) }}
              </v-chip>
            </template>

            <template v-slot:item.type="{ item }">
              <span class="font-weight-bold">{{ item.DocumentType?.name || item.type }}</span>
            </template>

            <template v-slot:item.expiry_date="{ item }">
              <span class="text-caption font-weight-bold">{{ formatDate(item.expiry_date) }}</span>
            </template>

            <template v-slot:item.staff_name="{ item }">
              <span class="text-caption font-weight-bold">{{ item.staff_name || 'N/A' }}</span>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn 
                variant="text" 
                size="small" 
                color="warning" 
                title="Send WhatsApp Reminder"
                @click.stop="sendWhatsAppReminder(item)"
                v-if="item.Customer?.phone_whatsapp && auth.user?.role_type !== 'CustomerPortal'"
                class="px-2"
              >
                <v-icon icon="mdi-bell-ring-outline" class="mr-1"></v-icon>
                <span class="text-caption font-weight-bold">{{ item.reminder_count || 0 }}</span>
              </v-btn>
              <v-btn 
                v-if="item.file_path"
                icon="mdi-whatsapp" 
                variant="text" 
                size="small" 
                color="success" 
                title="Share Document via WhatsApp"
                @click.stop="shareWhatsApp(item)"
              ></v-btn>
              <v-btn 
                v-if="item.file_path" 
                icon="mdi-eye-outline" 
                variant="text" 
                size="small" 
                color="info" 
                title="View Document"
                @click.stop="openDocumentPreview(item.file_path)"
              ></v-btn>
              <v-btn v-if="auth.canRecord('documents', 'edit_form', item)" icon="mdi-pencil" variant="text" size="small" color="primary" @click.stop="openForm(item)"></v-btn>
              <v-btn v-if="auth.canRecord('documents', 'delete', item)" icon="mdi-delete" variant="text" size="small" color="error" @click.stop="confirmDelete(item)"></v-btn>
            </template>
          </v-data-table-server>
        </v-card>

        <!-- Mobile Card UI -->
        <div v-else class="mobile-doc-list mt-2">
          <v-card 
            v-for="item in documentStore.documents" 
            :key="item.id" 
            class="mb-4 rounded-xl border" 
            elevation="0"
            @click="handleRowClick(null, { item })"
          >
            <div class="d-flex justify-space-between align-center pa-4 pb-2 border-b">
              <div class="d-flex align-center">
                <v-avatar color="primary" variant="tonal" size="36" class="mr-3">
                  <v-icon icon="mdi-file-document-outline" size="18"></v-icon>
                </v-avatar>
                <div>
                  <div class="text-subtitle-2 font-weight-bold">{{ item.DocumentType?.name || item.type }}</div>
                  <div class="text-caption text-grey-darken-1">{{ item.doc_number || 'No Number' }}</div>
                </div>
              </div>
              <v-chip :color="getUrgencyColor(item.expiry_date)" size="small" label class="font-weight-black text-uppercase">
                 {{ getStatusLabel(item.expiry_date) }}
              </v-chip>
            </div>
            
            <div class="pa-4 pt-3">
              <div class="d-flex justify-space-between mb-2">
                <span class="text-caption text-grey">Customer</span>
                <span class="text-caption font-weight-bold">{{ item.Customer?.name }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2" v-if="item.staff_name">
                <span class="text-caption text-grey">Staff Member</span>
                <span class="text-caption font-weight-bold">{{ item.staff_name }}</span>
              </div>
              <div class="d-flex justify-space-between">
                <span class="text-caption text-grey">Expiry Date</span>
                <span class="text-caption font-weight-bold">{{ formatDate(item.expiry_date) }}</span>
              </div>
            </div>

            <div class="bg-grey-lighten-4 pa-2 d-flex justify-space-evenly align-center border-t rounded-b-xl">
              <v-btn 
                variant="text" 
                size="small" 
                color="warning" 
                @click.stop="sendWhatsAppReminder(item)"
                v-if="item.Customer?.phone_whatsapp && auth.user?.role_type !== 'CustomerPortal'"
                class="px-2"
              >
                <v-icon icon="mdi-bell-ring-outline" class="mr-1"></v-icon>
                <span class="text-caption font-weight-bold">{{ item.reminder_count || 0 }}</span>
              </v-btn>
              <v-btn 
                v-if="item.file_path"
                icon="mdi-whatsapp" 
                variant="text" 
                size="small" 
                color="success" 
                @click.stop="shareWhatsApp(item)"
              ></v-btn>
              <v-btn 
                v-if="item.file_path" 
                icon="mdi-eye-outline" 
                variant="text" 
                size="small" 
                color="info" 
                @click.stop="openDocumentPreview(item.file_path)"
              ></v-btn>
              <v-btn v-if="auth.canRecord('documents', 'edit_form', item)" icon="mdi-pencil" variant="text" size="small" color="primary" @click.stop="openForm(item)"></v-btn>
              <v-btn v-if="auth.canRecord('documents', 'delete', item)" icon="mdi-delete" variant="text" size="small" color="error" @click.stop="confirmDelete(item)"></v-btn>
            </div>
          </v-card>
          
          <div v-if="!documentStore.documents.length && !documentStore.loading" class="text-center py-8 text-grey">
             No documents found.
          </div>

          <!-- Mobile Pagination -->
          <div v-if="documentStore.totalDocuments > itemsPerPage" class="d-flex justify-center mt-4 mb-8">
            <v-pagination
              v-model="currentPage"
              :length="Math.ceil(documentStore.totalDocuments / itemsPerPage)"
              :total-visible="5"
              active-color="primary"
              density="comfortable"
              @update:model-value="loadDocumentList({ page: $event, itemsPerPage })"
            ></v-pagination>
          </div>
        </div>
      </v-window-item>
    </v-window>

    <!-- Form Dialog -->
    <v-dialog v-model="formDialog" max-width="800px" persistent>
      <DocumentForm
        v-if="formDialog"
        :document="activeDocument"
        :loading="saving"
        @save="saveDocument"
        @cancel="closeForm"
      />
    </v-dialog>

    <!-- Delete Confirm -->
    <v-dialog v-model="deleteDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">Confirm Delete</v-card-title>
        <v-card-text>Are you sure you want to delete this document record? This action cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="executeDelete" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Details Popover/Dialog (for Calendar) -->
     <v-dialog v-model="detailsDialog" max-width="500px">
        <v-card v-if="selectedDoc">
          <v-card-title class="bg-primary text-white">
            {{ selectedDoc.DocumentType?.name || selectedDoc.type }} Details
          </v-card-title>
          <v-card-text class="pt-4">
            <div class="mb-2"><strong>Customer:</strong> {{ selectedDoc.Customer?.name }}</div>
            <div class="mb-2"><strong>Doc Number:</strong> {{ selectedDoc.doc_number || 'N/A' }}</div>
            <div class="mb-2"><strong>Expiry Date:</strong> {{ formatDate(selectedDoc.expiry_date) }}</div>

            <div class="mb-2" v-if="selectedDoc.notes"><strong>Notes:</strong> {{ selectedDoc.notes }}</div>
          </v-card-text>
          <v-divider></v-divider>
          <v-card-actions>
            <v-btn 
              v-if="selectedDoc.Customer?.phone_whatsapp"
              color="success" 
              prepend-icon="mdi-whatsapp"
              @click="sendWhatsAppReminder(selectedDoc)"
            >
              WhatsApp ({{ selectedDoc.reminder_count || 0 }})
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="detailsDialog = false">Close</v-btn>
            <v-btn color="primary" variant="outlined" @click="editFromDetails(selectedDoc)">Edit</v-btn>
          </v-card-actions>
        </v-card>
     </v-dialog>

    <!-- Document Viewer Dialog -->
    <v-dialog v-model="previewDialog" max-width="900" fullscreen-on-mobile>
      <v-card class="rounded-xl overflow-hidden glass-card" variant="flat">
        <v-toolbar color="transparent" title="Document Preview">
          <template v-slot:append>
             <v-btn icon="mdi-download" variant="text" :href="previewUrl" download target="_blank" title="Download Document"></v-btn>
             <v-btn icon="mdi-share-variant" variant="text" @click="shareDocument(previewUrl)" title="Share Document Link"></v-btn>
             <v-btn icon="mdi-open-in-new" variant="text" :href="previewUrl" target="_blank" title="Open PDF / Image in new tab"></v-btn>
             <v-btn icon="mdi-close" @click="previewDialog = false" variant="text"></v-btn>
          </template>
        </v-toolbar>
        <v-divider></v-divider>
        <v-card-text class="pa-0 bg-grey-lighten-4 d-flex align-center justify-center p-relative" style="min-height: 500px;">
            <iframe 
              v-if="previewUrl && previewUrl.toLowerCase().endsWith('.pdf')" 
              :src="previewUrl" 
              style="width: 100%; height: 75vh; border: none; display: block;"
            ></iframe>
            <img 
              v-else-if="previewUrl"
              :src="previewUrl" 
              style="max-width: 100%; max-height: 75vh; object-fit: contain; display: block;" 
            />
            <div v-else class="text-h6 text-grey font-weight-medium">Preview not available</div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Settings Dialog -->
    <v-dialog v-model="settingsDialog" max-width="800px" persistent>
      <DocumentTrackerSettings
        v-if="settingsDialog"
        :initial-stages="documentStore.stages"
        @close="settingsDialog = false"
        @saved="onSettingsSaved"
      />
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useDisplay } from 'vuetify';
import dayjs from 'dayjs';
import DocumentCard from '~/components/documents/DocumentCard.vue';
import DocumentForm from '~/components/documents/DocumentForm.vue';
import DocumentTrackerSettings from '~/components/documents/DocumentTrackerSettings.vue';
import { useWhatsApp } from '~/composables/useWhatsApp';
import { useAuthStore } from '~/stores/auth';
import { useDocumentStore } from '~/stores/documents';
import { useDashboardStore } from '~/stores/dashboard';
import { useUIStore } from '~/stores/ui';

// State
const { smAndDown } = useDisplay();
const auth = useAuthStore();
const documentStore = useDocumentStore();
const dashboardStore = useDashboardStore();
const uiStore = useUIStore();
const config = useRuntimeConfig();
const viewMode = ref('kanban'); // kanban, calendar
const searchQuery = ref('');
const urgencyFilter = ref('all');
const activeTab = ref(auth.user?.role_type === 'CustomerPortal' ? 'alerts' : 'tracker');
const mobileKanbanTab = ref(null);
const categoryFilter = ref('All Categories');
const allSearchQuery = ref('');
const currentSortBy = ref([]);
const itemsPerPage = ref(10);
const currentPage = ref(1);
const loading = computed(() => documentStore.loading);
const error = computed(() => documentStore.error);

let searchTimeout = null;
watch(allSearchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (activeTab.value === 'all') {
      loadDocumentList({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
    }
  }, 400);
});

watch(categoryFilter, () => {
  if (activeTab.value === 'all') {
    loadDocumentList({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: currentSortBy.value });
  }
});

// Dialogs
const formDialog = ref(false);
const activeDocument = ref(null);
const saving = ref(false);

const deleteDialog = ref(false);
const docToDelete = ref(null);
const deleting = ref(false);

const detailsDialog = ref(false);
const selectedDoc = ref(null);

const previewDialog = ref(false);
const previewUrl = ref('');

const settingsDialog = ref(false);

const filterOptions = computed(() => {
  return [
    { title: 'All Documents', value: 'all' },
    ...documentStore.stages.map(s => ({ title: s.title, value: s.id }))
  ];
});

// Constants
const weekDays = computed(() => {
  return smAndDown.value 
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] 
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
});
const { openWhatsApp, MESSAGES } = useWhatsApp();

const headers = [
  { title: 'Customer', key: 'Customer', sortable: true },
  { title: 'Document Type', key: 'type', sortable: true },
  { title: 'Doc Number', key: 'doc_number', sortable: true },
  { title: 'Staff', key: 'staff_name', sortable: true },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Expiry Date', key: 'expiry_date', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
];

// Calculated properties for Kanban/Calendar
const allDocumentsFlat = computed(() => {
  let all = [];
  for (const key in documentStore.groupedDocs) {
    all = all.concat(documentStore.groupedDocs[key] || []);
  }
  return all;
});

// Alert documents: expired + critical + warning stages with days_remaining calculated
const alertDocuments = computed(() => {
  const groups = documentStore.groupedDocs;
  const alertStageIds = ['expired', 'critical'];
  const docs = [];
  const today = dayjs().startOf('day');
  
  for (const stageId of alertStageIds) {
    if (groups[stageId]) {
      for (const doc of groups[stageId]) {
        const diffDays = dayjs(doc.expiry_date).startOf('day').diff(today, 'day');
        docs.push({ ...doc, days_remaining: diffDays });
      }
    }
  }
  
  // Sort: most overdue first (ascending by days_remaining)
  docs.sort((a, b) => a.days_remaining - b.days_remaining);
  return docs;
});

// Calendar State
const calendarDate = ref(dayjs());
const currentMonthName = computed(() => calendarDate.value.format('MMMM'));
const currentYear = computed(() => calendarDate.value.format('YYYY'));

const calendarCells = computed(() => {
  const startOfMonth = calendarDate.value.startOf('month');
  const endOfMonth = calendarDate.value.endOf('month');
  const startDate = startOfMonth.startOf('week');
  const endDate = endOfMonth.endOf('week');

  const cells = [];
  let day = startDate;

  while (day.isBefore(endDate) || day.isSame(endDate, 'day')) {
    cells.push({
      date: day,
      isToday: day.isSame(dayjs(), 'day'),
      otherMonth: !day.isSame(calendarDate.value, 'month')
    });
    day = day.add(1, 'day');
  }
  return cells;
});

// Methods
const fetchDocuments = async () => {
    await documentStore.fetchExpiring();
};

const loadDocumentList = async ({ page, itemsPerPage: limit, sortBy }) => {
    currentPage.value = page;
    itemsPerPage.value = limit;
    if (sortBy !== undefined) currentSortBy.value = sortBy;
    
    await documentStore.fetchDocuments({
        page,
        limit,
        search: allSearchQuery.value || undefined,
        category: categoryFilter.value !== 'All Categories' ? categoryFilter.value : undefined,
        sortBy: currentSortBy.value && currentSortBy.value.length ? JSON.stringify(currentSortBy.value) : undefined
    });
};

const filterDocs = (docs) => {
  if (!searchQuery.value) return docs;
  const q = searchQuery.value.toLowerCase();
  return docs.filter(d => 
    d.Customer?.name.toLowerCase().includes(q) || 
    (d.doc_number && d.doc_number.toLowerCase().includes(q)) ||
    (d.DocumentType?.name || d.type).toLowerCase().includes(q)
  );
};

const getDocsForDate = (date) => {
  const dateStr = date.format('YYYY-MM-DD');
  return allDocumentsFlat.value.filter(d => d.expiry_date === dateStr);
};

const getDocInitials = (doc) => {
  const name = doc.DocumentType?.name || doc.type || 'D';
  return name.substring(0, 2).toUpperCase();
};

const getDocStage = (expiryDate) => {
  const diff = dayjs(expiryDate).diff(dayjs().startOf('day'), 'day');
  for (const stage of documentStore.stages) {
    const min = stage.minDays !== null && stage.minDays !== '' ? parseInt(stage.minDays) : -Infinity;
    const max = stage.maxDays !== null && stage.maxDays !== '' ? parseInt(stage.maxDays) : Infinity;
    if (diff >= min && diff <= max) return stage;
  }
  return { id: 'uncategorized', title: 'Uncategorized', color: 'grey', icon: 'mdi-help-circle' };
};

const getUrgencyColor = (expiryDate) => getDocStage(expiryDate).color;

const getStatusLabel = (expiryDate) => getDocStage(expiryDate).title;

const getStatusIcon = (statusId) => {
  if (statusId === 'all') return 'mdi-filter-variant';
  const stage = documentStore.stages.find(s => s.id === statusId);
  return stage ? stage.icon : 'mdi-help-circle';
};

const getStatusColor = (statusId) => {
  if (statusId === 'all') return 'primary';
  const stage = documentStore.stages.find(s => s.id === statusId);
  return stage ? stage.color : 'grey';
};

const onSettingsSaved = async (newStages) => {
  settingsDialog.value = false;
  await fetchDocuments();
  if (viewMode.value === 'list') {
    loadDocumentList({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
  }
};

// Form Actions
const openForm = (doc = null) => {
  activeDocument.value = doc;
  formDialog.value = true;
};
useCreateAction('documents', () => openForm());

const closeForm = () => {
  formDialog.value = false;
  activeDocument.value = null;
};

const saveDocument = async (formData) => {
  saving.value = true;
  try {
    if (activeDocument.value) {
      await documentStore.updateDocument(activeDocument.value.id, formData);
    } else {
      await documentStore.createDocument(formData);
    }
    
    fetchDocuments(); // Update Kanban
    loadDocumentList({ page: currentPage.value, itemsPerPage: itemsPerPage.value }); // Update List
    closeForm();
  } catch (err) {
    console.error('Failed to save document', err);
  } finally {
    saving.value = false;
  }
};

// Delete Actions
const confirmDelete = (doc) => {
  docToDelete.value = doc;
  deleteDialog.value = true;
};

const executeDelete = async () => {
  if (!docToDelete.value) return;
  deleting.value = true;
  try {
    await documentStore.deleteDocument(docToDelete.value.id);
    fetchDocuments();
    loadDocumentList({ page: currentPage.value, itemsPerPage: itemsPerPage.value });
    deleteDialog.value = false;
    docToDelete.value = null;
  } catch (err) {
    console.error('Failed to delete document', err);
  } finally {
    deleting.value = false;
  }
};

// Calendar Nav
const prevMonth = () => { calendarDate.value = calendarDate.value.subtract(1, 'month'); };
const nextMonth = () => { calendarDate.value = calendarDate.value.add(1, 'month'); };

// Details
const openDetails = (doc) => {
  selectedDoc.value = doc;
  detailsDialog.value = true;
};

const editFromDetails = (doc) => {
  detailsDialog.value = false;
  openForm(doc);
};

const handleRowClick = (event, arg2) => {
  const item = arg2 && arg2.item ? arg2.item : arg2;
  const doc = item && item.raw ? item.raw : item;
  openDocumentPreview(doc ? doc.file_path : null);
};

const openDocumentPreview = (filePath) => {
  if (filePath) {
    const baseUrl = config.public.apiBase.replace('/api/v1', '');
    previewUrl.value = baseUrl + filePath;
  } else {
    previewUrl.value = null;
  }
  previewDialog.value = true;
};

const shareDocument = async (url) => {
  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Document Shared via DocClear',
        url: url
      });
    } else {
      await navigator.clipboard.writeText(url);
      uiStore.showSuccess('Document link copied to clipboard!');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      uiStore.showError('Failed to share document');
    }
  }
};

const shareWhatsApp = async (doc) => {
  if (!doc.file_path) return;
  const baseUrl = config.public.apiBase.replace('/api/v1', '');
  const url = baseUrl + doc.file_path;
  const num = (auth.user?.role_type !== 'CustomerPortal' && doc.Customer?.phone_whatsapp) ? doc.Customer.phone_whatsapp : '';
  const msg = `Here is the document: ${doc.DocumentType?.name || doc.type} - ${doc.doc_number || ''}\n${url}`;
  openWhatsApp(num, msg);

  try {
    await documentStore.incrementReminderCount(doc.id);
  } catch (err) {
    console.error('Failed to increment reminder count:', err);
  }
};

const sendWhatsAppReminder = async (doc) => {
  const num = doc.Customer.phone_whatsapp;
  const msg = MESSAGES.docReminder(
    doc.Customer.name,
    doc.DocumentType?.name || doc.type,
    doc.doc_number || 'N/A',
    formatDate(doc.expiry_date)
  );
  openWhatsApp(num, msg);

  try {
    await documentStore.incrementReminderCount(doc.id);
  } catch (err) {
    console.error('Failed to increment reminder count:', err);
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return dayjs(dateString).format('DD/MM/YYYY');
};

onMounted(async () => {
  fetchDocuments();
});

let searchTimer;
watch(searchQuery, () => {
    if (viewMode.value === 'list') {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            loadDocumentList({ page: 1, itemsPerPage: itemsPerPage.value });
        }, 400);
    }
});

watch(urgencyFilter, () => {
    if (viewMode.value === 'list') {
        loadDocumentList({ page: 1, itemsPerPage: itemsPerPage.value });
    }
});
</script>

<style scoped>
.kanban-wrapper {
  overflow-x: auto;
  padding-bottom: 20px;
}

.kanban-row {
  display: flex;
  flex-wrap: nowrap;
  width: 100%;
  gap: 16px;
}

.kanban-col {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
}

.col-content {
  flex-grow: 1;
  min-height: 500px;
  overflow-y: auto;
}

/* Calendar Styles */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border: 1px solid #e0e0e0;
}

.calendar-header-cell {
  background-color: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 10px;
  text-align: center;
  font-weight: bold;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.calendar-day-cell {
  min-height: 120px;
  padding: 8px;
  border-bottom: 1px solid #e0e0e0;
  border-right: 1px solid #e0e0e0;
  position: relative;
}

.calendar-day-cell.other-month {
  background-color: #fafafa;
  color: #bdbdbd;
}

.calendar-day-cell.is-today {
  background-color: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}

.day-number {
  font-weight: bold;
  margin-bottom: 5px;
}

.day-dot-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

@media (max-width: 600px) {
  .calendar-container {
    padding: 0 !important;
  }
  .calendar-container .v-card {
    padding: 8px !important;
  }
  .calendar-day-cell {
    min-height: 60px !important;
    padding: 4px !important;
  }
  .day-number {
    font-size: 11px;
    margin-bottom: 2px;
    text-align: center;
  }
  .day-dot-container {
    flex-direction: row !important;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }
  .calendar-header-cell {
    padding: 6px 2px !important;
    font-size: 11px;
  }
}

:deep(.v-data-table tbody tr) {
  cursor: pointer;
}

/* ── Alert Cards ── */
.alert-card {
  border: 1px solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.document-calendar :deep(.fc-event:hover) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.active-toggle {
  background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%) !important;
  color: white !important;
  box-shadow: 0 4px 15px -3px rgba(99, 102, 241, 0.4) !important;
}
.alert-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.08) !important;
}

/* Overdue (expired) */
.alert-card--overdue {
  background: rgba(239, 83, 80, 0.06);
  border-color: rgba(239, 83, 80, 0.18);
}
.alert-card__icon--overdue {
  background: rgba(239, 83, 80, 0.14) !important;
  color: #e53935 !important;
}

/* Critical (≤7 days) */
.alert-card--critical {
  background: rgba(239, 83, 80, 0.05);
  border-color: rgba(239, 83, 80, 0.14);
}
.alert-card__icon--critical {
  background: rgba(239, 83, 80, 0.12) !important;
  color: #ef5350 !important;
}

/* Warning (8-30 days) */
.alert-card--warning {
  background: rgba(255, 167, 38, 0.06);
  border-color: rgba(255, 167, 38, 0.18);
}
.alert-card__icon--warning {
  background: rgba(255, 167, 38, 0.14) !important;
  color: #f57c00 !important;
}
</style>
