<template>
  <v-container fluid class="pa-2 pa-sm-4 pa-md-6">
    <!-- Back Button -->
    <div class="d-flex align-center mb-2">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        to="/settings?tab=users"
        class="font-weight-bold px-0 text-grey-darken-1"
        size="small"
        density="comfortable"
      >
        Back to Staff Directory
      </v-btn>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="d-flex justify-center align-center py-16">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <!-- Error State -->
    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      class="mb-6 rounded-xl"
      closable
    >
      {{ error }}
      <template v-slot:append>
        <v-btn color="error" variant="text" @click="fetchStaff">Retry</v-btn>
      </template>
    </v-alert>

    <!-- Access Restricted State -->
    <v-card
      v-else-if="!canViewStaff"
      class="soft-card pa-8 text-center rounded-2xl mx-auto my-12"
      max-width="560"
    >
      <v-avatar size="64" color="amber-lighten-5" class="mb-4">
        <v-icon icon="mdi-shield-lock-outline" color="amber-darken-3" size="36"></v-icon>
      </v-avatar>
      <h2 class="text-h5 font-weight-bold text-slate-800 mb-2">Restricted Information</h2>
      <p class="text-body-2 text-slate-600 mb-6">
        Viewing staff compensation, salary details, and confidential employee documents is restricted to administrators and authorized roles with Staff & HR privileges.
      </p>
      <v-btn color="primary" rounded="lg" prepend-icon="mdi-arrow-left" to="/settings?tab=users">
        Back to Staff Directory
      </v-btn>
    </v-card>

    <!-- Main Content -->
    <div v-else-if="staff">
      <!-- Header Section -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-6">
        <div class="d-flex align-center gap-4">
          <!-- Avatar with Upload Overlay -->
          <div class="position-relative">
            <v-avatar color="primary" size="72" class="rounded-2xl elevation-2 text-white font-weight-black text-h4">
              <v-img v-if="staff.avatar" :src="formatAvatarUrl(staff.avatar)" cover></v-img>
              <span v-else>{{ (staff.name || 'S').charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <v-btn
              icon="mdi-camera"
              size="x-small"
              color="white"
              class="position-absolute elevation-2"
              style="bottom: -4px; right: -4px; border: 2px solid white;"
              title="Change Avatar"
              @click="triggerAvatarInput"
            ></v-btn>
            <input type="file" ref="avatarInput" accept="image/*" class="d-none" @change="handleAvatarUpload" />
          </div>

          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h4 font-weight-black text-blue-grey-darken-4 mb-0">
                {{ staff.name }}
              </h1>
              <v-chip
                :color="staff.is_active ? '#22C55E' : '#94A3B8'"
                variant="flat"
                size="small"
                class="font-weight-bold text-white px-3"
              >
                {{ staff.is_active ? 'Active' : 'Inactive' }}
              </v-chip>
              <v-chip
                size="small"
                :variant="staff.can_login !== false ? 'tonal' : 'outlined'"
                :color="staff.can_login !== false ? 'primary' : 'blue-grey'"
                class="font-weight-bold"
              >
                <v-icon start :icon="staff.can_login !== false ? 'mdi-shield-check' : 'mdi-shield-off-outline'" size="14"></v-icon>
                {{ staff.can_login !== false ? (staff.Role?.name || 'Staff') : 'No System Login' }}
              </v-chip>
            </div>
            <p class="text-blue-grey-darken-1 text-subtitle-2 mt-1 mb-0 d-flex align-center gap-2">
              <span v-if="staff.designation" class="font-weight-bold text-slate-700">
                {{ staff.designation }}
              </span>
              <span v-if="staff.designation">•</span>
              <span>Staff Profile, Compensation & Compliance Documents</span>
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2">
          <v-btn
            v-if="canEditStaff"
            color="white"
            variant="flat"
            class="font-weight-bold px-4 rounded-lg elevation-1"
            prepend-icon="mdi-pencil-outline"
            @click="openEditDialog"
          >
            Edit Profile
          </v-btn>
          <v-btn
            v-if="canEditStaff"
            color="primary"
            variant="flat"
            class="font-weight-bold px-4 rounded-lg elevation-2"
            prepend-icon="mdi-file-document-plus-outline"
            @click="openAddDocumentDialog"
          >
            Add Document
          </v-btn>
        </div>
      </div>

      <!-- KPI Summary Stat Cards -->
      <v-row class="mb-6">
        <!-- Total Salary -->
        <v-col cols="12" sm="6" md="3" class="d-flex">
          <v-card class="soft-card pa-4 flex-grow-1 d-flex flex-column justify-space-between border-0 elevation-1 rounded-xl">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption font-weight-bold text-slate-500 text-uppercase tracking-wider">Total Salary</span>
              <v-avatar size="36" rounded="lg" class="glass-icon-success glass-avatar-container">
                <v-icon icon="mdi-cash-multiple" color="white" size="20"></v-icon>
              </v-avatar>
            </div>
            <div>
              <div class="text-h5 font-weight-black text-slate-800">
                {{ formatCurrency(staff.total_salary) }}
              </div>
              <div class="text-caption text-slate-500 mt-1 d-flex flex-wrap gap-1">
                <span>Basic: {{ formatCurrency(staff.basic_salary) }}</span>
                <span>•</span>
                <span>HR: {{ formatCurrency(staff.hr_allowance) }}</span>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Total Documents -->
        <v-col cols="12" sm="6" md="3" class="d-flex">
          <v-card class="soft-card pa-4 flex-grow-1 d-flex flex-column justify-space-between border-0 elevation-1 rounded-xl">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption font-weight-bold text-slate-500 text-uppercase tracking-wider">Staff Documents</span>
              <v-avatar size="36" rounded="lg" class="glass-icon-blue glass-avatar-container">
                <v-icon icon="mdi-file-document-multiple-outline" color="white" size="20"></v-icon>
              </v-avatar>
            </div>
            <div>
              <div class="text-h5 font-weight-black text-slate-800">
                {{ (staff.StaffDocuments || []).length }}
              </div>
              <div class="text-caption text-slate-500 mt-1">
                Verified compliance records on file
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Expiry Alert -->
        <v-col cols="12" sm="6" md="3" class="d-flex">
          <v-card class="soft-card pa-4 flex-grow-1 d-flex flex-column justify-space-between border-0 elevation-1 rounded-xl">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption font-weight-bold text-slate-500 text-uppercase tracking-wider">Expiry Status</span>
              <v-avatar :color="expiredCount > 0 ? 'red-lighten-5' : (dueSoonCount > 0 ? 'amber-lighten-5' : 'green-lighten-5')" size="36" rounded="lg">
                <v-icon
                  :icon="expiredCount > 0 ? 'mdi-alert-circle' : (dueSoonCount > 0 ? 'mdi-clock-alert' : 'mdi-check-circle')"
                  :color="expiredCount > 0 ? '#EF4444' : (dueSoonCount > 0 ? '#F59E0B' : '#10B981')"
                  size="20"
                ></v-icon>
              </v-avatar>
            </div>
            <div>
              <div class="text-h5 font-weight-black" :class="expiredCount > 0 ? 'text-red-600' : (dueSoonCount > 0 ? 'text-amber-600' : 'text-slate-800')">
                {{ expiredCount > 0 ? `${expiredCount} Expired` : (dueSoonCount > 0 ? `${dueSoonCount} Due Soon` : 'All Active') }}
              </div>
              <div class="text-caption text-slate-500 mt-1">
                {{ dueSoonCount > 0 ? `${dueSoonCount} expiring within 30 days` : 'No urgent document actions needed' }}
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Joining Date & Tenure -->
        <v-col cols="12" sm="6" md="3" class="d-flex">
          <v-card class="soft-card pa-4 flex-grow-1 d-flex flex-column justify-space-between border-0 elevation-1 rounded-xl">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption font-weight-bold text-slate-500 text-uppercase tracking-wider">Joining Date</span>
              <v-avatar size="36" rounded="lg" class="glass-icon-purple glass-avatar-container">
                <v-icon icon="mdi-calendar-account-outline" color="white" size="20"></v-icon>
              </v-avatar>
            </div>
            <div>
              <div class="text-h5 font-weight-black text-slate-800">
                {{ staff.joining_date ? formatDate(staff.joining_date) : 'N/A' }}
              </div>
              <div class="text-caption text-slate-500 mt-1">
                {{ calculateTenure(staff.joining_date) }}
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Main Tabs Section -->
      <v-card class="soft-card rounded-2xl border-0 elevation-1 mb-6">
        <v-tabs v-model="activeTab" color="primary" class="border-b px-4">
          <v-tab value="profile" class="font-weight-bold text-none">
            <v-icon start icon="mdi-account-details-outline"></v-icon> Profile & Employment
          </v-tab>
          <v-tab value="documents" class="font-weight-bold text-none">
            <v-icon start icon="mdi-file-document-outline"></v-icon>
            Staff Documents
            <v-chip size="x-small" color="primary" variant="flat" class="ml-2 font-weight-bold">
              {{ (staff.StaffDocuments || []).length }}
            </v-chip>
          </v-tab>
          <v-tab v-if="canViewCommission" value="commission" class="font-weight-bold text-none">
            <v-icon start icon="mdi-percent-circle-outline"></v-icon> Commission
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="pa-4 pa-sm-6">
          <!-- ─── TAB 1: Profile & Employment Details ─── -->
          <v-window-item value="profile">
            <v-row>
              <!-- UAE Local Contact Card -->
              <v-col cols="12" md="4" class="d-flex">
                <v-card class="pa-5 rounded-xl border bg-slate-50 flex-grow-1 d-flex flex-column" variant="flat">
                  <div class="d-flex align-center mb-4">
                    <v-avatar size="32" class="rounded-lg mr-3 glass-icon-primary glass-avatar-container">
                      <v-icon icon="mdi-map-marker-account-outline" size="18" color="white"></v-icon>
                    </v-avatar>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-800 mb-0">UAE Contact & Residence</h3>
                  </div>
                  <v-divider class="mb-4"></v-divider>

                  <div class="mb-3">
                    <div class="text-caption text-slate-500 font-weight-bold mb-1">EMAIL ADDRESS</div>
                    <div class="d-flex align-center" style="word-break: break-word;">
                      <v-icon icon="mdi-email-outline" size="20" color="blue-grey-lighten-1" class="mr-3"></v-icon>
                      <span class="font-weight-medium text-body-2 text-slate-800">{{ staff.email || 'N/A' }}</span>
                    </div>
                  </div>

                  <div class="mb-3">
                    <div class="text-caption text-slate-500 font-weight-bold mb-1">LOCAL PHONE / WHATSAPP</div>
                    <div class="d-flex align-center">
                      <v-icon icon="mdi-phone-outline" size="20" color="blue-grey-lighten-1" class="mr-3"></v-icon>
                      <span class="font-weight-medium text-body-2 text-slate-800">{{ staff.phone || 'N/A' }}</span>
                      <v-btn
                        v-if="staff.phone"
                        icon="mdi-whatsapp"
                        size="x-small"
                        color="success"
                        variant="text"
                        class="ml-1"
                        :href="`https://wa.me/${staff.phone.replace(/[^0-9]/g, '')}`"
                        target="_blank"
                        title="Chat on WhatsApp"
                      ></v-btn>
                    </div>
                  </div>

                  <div>
                    <div class="text-caption text-slate-500 font-weight-bold mb-1">UAE RESIDENCE ADDRESS</div>
                    <div class="d-flex align-start">
                      <v-icon icon="mdi-map-marker-outline" size="20" color="blue-grey-lighten-1" class="mr-3 mt-1"></v-icon>
                      <span class="font-weight-medium text-body-2 text-slate-800" style="word-break: break-word;">{{ staff.address || 'Not specified' }}</span>
                    </div>
                  </div>
                </v-card>
              </v-col>

              <!-- Home Country Details Card -->
              <v-col cols="12" md="4" class="d-flex">
                <v-card class="pa-5 rounded-xl border bg-slate-50 flex-grow-1 d-flex flex-column" variant="flat">
                  <div class="d-flex align-center mb-4">
                    <v-avatar size="32" class="rounded-lg mr-3 glass-icon-indigo glass-avatar-container">
                      <v-icon icon="mdi-earth" size="18" color="white"></v-icon>
                    </v-avatar>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-800 mb-0">Home Country Details</h3>
                  </div>
                  <v-divider class="mb-4"></v-divider>

                  <div class="mb-3">
                    <div class="text-caption text-slate-500 font-weight-bold mb-1">HOME COUNTRY ADDRESS</div>
                    <div class="d-flex align-start">
                      <v-icon icon="mdi-home-city-outline" size="20" color="blue-grey-lighten-1" class="mr-3 mt-1"></v-icon>
                      <span class="font-weight-medium text-body-2 text-slate-800" style="word-break: break-word;">{{ staff.home_country_address || 'Not specified' }}</span>
                    </div>
                  </div>

                  <div class="mb-3">
                    <div class="text-caption text-slate-500 font-weight-bold mb-1">PRIMARY CONTACT NUMBER</div>
                    <div class="d-flex align-center">
                      <v-icon icon="mdi-phone-outline" size="20" color="blue-grey-lighten-1" class="mr-3"></v-icon>
                      <span class="font-weight-medium text-body-2 text-slate-800">{{ staff.home_country_contact || 'N/A' }}</span>
                    </div>
                  </div>

                  <div>
                    <div class="text-caption text-slate-500 font-weight-bold mb-1">ALTERNATE EMERGENCY NUMBER</div>
                    <div class="d-flex align-center">
                      <v-icon icon="mdi-cellphone" size="20" color="blue-grey-lighten-1" class="mr-3"></v-icon>
                      <span class="font-weight-medium text-body-2 text-slate-800">{{ staff.home_country_alternate_contact || 'N/A' }}</span>
                    </div>
                  </div>
                </v-card>
              </v-col>

              <!-- Salary & Employment Card -->
              <v-col cols="12" md="4" class="d-flex">
                <v-card class="pa-5 rounded-xl border bg-slate-50 flex-grow-1 d-flex flex-column" variant="flat">
                  <div class="d-flex align-center mb-4">
                    <v-avatar size="32" class="rounded-lg mr-3 glass-icon-success glass-avatar-container">
                      <v-icon icon="mdi-wallet-outline" size="18" color="white"></v-icon>
                    </v-avatar>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-800 mb-0">Salary & Compensation</h3>
                  </div>
                  <v-divider class="mb-4"></v-divider>

                  <div class="d-flex justify-space-between align-center mb-2 pb-2 border-b flex-wrap gap-2">
                    <span class="text-body-2 text-slate-600 font-weight-medium">Basic Salary</span>
                    <span class="font-weight-bold text-slate-800">{{ formatCurrency(staff.basic_salary) }}</span>
                  </div>

                  <div class="d-flex justify-space-between align-center mb-2 pb-2 border-b flex-wrap gap-2">
                    <span class="text-body-2 text-slate-600 font-weight-medium">Housing / HR Allowance</span>
                    <span class="font-weight-bold text-slate-800">{{ formatCurrency(staff.hr_allowance) }}</span>
                  </div>

                  <div class="d-flex justify-space-between align-center mb-2 pb-2 border-b flex-wrap gap-2">
                    <span class="text-body-2 text-slate-600 font-weight-medium">Other Allowances</span>
                    <span class="font-weight-bold text-slate-800">{{ formatCurrency(staff.other_allowances) }}</span>
                  </div>

                  <div class="d-flex justify-space-between align-center my-3 bg-emerald-lighten-5 pa-3 rounded-xl flex-wrap gap-2" style="background: #ECFDF5; border: 1px solid #A7F3D0;">
                    <div>
                      <span class="text-subtitle-2 font-weight-bold text-emerald-900 d-block" style="color: #065F46;">Total Monthly Salary</span>
                      <span class="text-caption text-emerald-700 font-weight-medium" style="color: #047857;">Annual: {{ formatCurrency((parseFloat(staff.total_salary) || 0) * 12) }}</span>
                    </div>
                    <span class="text-h6 font-weight-black text-emerald-700" style="color: #047857;">{{ formatCurrency(staff.total_salary) }}</span>
                  </div>

                  <div class="bg-slate-100 pa-2 rounded-lg mt-auto d-flex align-start gap-2">
                    <v-icon icon="mdi-information-outline" size="16" color="blue-grey" class="mt-0.5"></v-icon>
                    <span class="text-caption text-blue-grey-darken-2" style="font-size: 11px !important; line-height: 1.3;">
                      UAE Labour Law: Gratuity & End-of-Service benefit (EOSG) is calculated on Basic Salary ({{ formatCurrency(staff.basic_salary) }}).
                    </span>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- ─── TAB 2: Staff Documents Tracker ─── -->
          <v-window-item value="documents">
            <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-4">
              <div>
                <h3 class="text-h6 font-weight-bold text-slate-800 mb-0">Compliance & Identity Documents</h3>
                <p class="text-caption text-slate-500 mb-0">Keep track of Emirates IDs, Visas, Passports, and Labour cards</p>
              </div>
              <v-btn
                v-if="canEditStaff"
                color="primary"
                variant="flat"
                class="font-weight-bold rounded-lg"
                prepend-icon="mdi-plus"
                @click="openAddDocumentDialog"
              >
                Add Document
              </v-btn>
            </div>

            <!-- Documents Table -->
            <v-data-table
              :headers="docHeaders"
              :items="staff.StaffDocuments || []"
              :loading="loading"
              hover
              class="border rounded-xl"
            >
              <!-- Document Type Column -->
              <template v-slot:item.type="{ item }">
                <div class="d-flex align-center gap-2 py-2">
                  <v-avatar color="primary-lighten-5" size="36" class="rounded-lg">
                    <v-icon icon="mdi-file-document-outline" color="primary" size="20"></v-icon>
                  </v-avatar>
                  <div>
                    <div class="font-weight-bold text-slate-800">
                      {{ item.DocumentType?.name || item.title || 'Document' }}
                    </div>
                    <div v-if="item.title && item.title !== item.DocumentType?.name" class="text-caption text-slate-500">
                      {{ item.title }}
                    </div>
                  </div>
                </div>
              </template>

              <!-- Document Number -->
              <template v-slot:item.doc_number="{ item }">
                <span class="font-weight-bold text-slate-700 font-mono">
                  {{ item.doc_number || '—' }}
                </span>
              </template>

              <!-- Issue Date -->
              <template v-slot:item.issue_date="{ item }">
                <span class="text-body-2 text-slate-600">
                  {{ item.issue_date ? formatDate(item.issue_date) : '—' }}
                </span>
              </template>

              <!-- Expiry Date -->
              <template v-slot:item.expiry_date="{ item }">
                <div class="d-flex flex-column">
                  <span class="font-weight-bold text-slate-800">
                    {{ formatDate(item.expiry_date) }}
                  </span>
                  <span class="text-caption" :class="getExpiryTextClass(item.expiry_date)">
                    {{ getExpiryRelativeText(item.expiry_date) }}
                  </span>
                </div>
              </template>

              <!-- Status Badge -->
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="getExpiryChipColor(item.expiry_date)"
                  size="small"
                  variant="tonal"
                  class="font-weight-bold text-uppercase text-caption"
                  :prepend-icon="getExpiryChipIcon(item.expiry_date)"
                >
                  {{ getExpiryStatusLabel(item.expiry_date) }}
                </v-chip>
              </template>

              <!-- Attachment -->
              <template v-slot:item.file_path="{ item }">
                <v-btn
                  v-if="item.file_path"
                  size="small"
                  variant="tonal"
                  color="primary"
                  class="font-weight-bold rounded-lg text-none"
                  prepend-icon="mdi-file-download-outline"
                  :href="formatFileUrl(item.file_path)"
                  target="_blank"
                >
                  View File
                </v-btn>
                <span v-else class="text-caption text-slate-400 italic">No attachment</span>
              </template>

              <!-- Actions -->
              <template v-slot:item.actions="{ item }">
                <div class="d-flex align-center justify-end gap-1">
                  <v-btn
                    v-if="canEditStaff"
                    icon="mdi-pencil-outline"
                    variant="text"
                    size="small"
                    color="primary"
                    title="Edit Document"
                    @click="openEditDocumentDialog(item)"
                  ></v-btn>
                  <v-btn
                    v-if="canDeleteStaff"
                    icon="mdi-delete-outline"
                    variant="text"
                    size="small"
                    color="error"
                    title="Delete Document"
                    @click="confirmDeleteDocument(item)"
                  ></v-btn>
                </div>
              </template>

              <template v-slot:no-data>
                <div class="py-8 text-center">
                  <v-icon icon="mdi-file-document-outline" size="48" color="grey-lighten-1" class="mb-2"></v-icon>
                  <div class="text-body-1 font-weight-bold text-slate-700">No documents found</div>
                  <p class="text-caption text-slate-500 mb-4">Click below to upload the first document for this staff member.</p>
                  <v-btn color="primary" variant="flat" size="small" class="rounded-lg" prepend-icon="mdi-plus" @click="openAddDocumentDialog">
                    Add First Document
                  </v-btn>
                </div>
              </template>
            </v-data-table>
          </v-window-item>
          <v-window-item v-if="canViewCommission" value="commission">
            <StaffCommissionStatement v-if="activeTab === 'commission'" :key="staff.id" :staff-id="staff.id" />
          </v-window-item>
        </v-window>
      </v-card>
    </div>

    <!-- ─── DIALOG 1: Edit Staff Profile Dialog ─── -->
    <v-dialog v-model="editDialog" max-width="700px" persistent>
      <v-card class="soft-card pa-4 rounded-2xl">
        <v-card-title class="text-h5 font-weight-bold d-flex align-center">
          <v-icon icon="mdi-account-edit" color="primary" class="mr-2"></v-icon>
          Edit Staff Profile
        </v-card-title>
        <v-card-text class="pt-4">
          <v-form ref="editFormRef" v-model="editFormValid">
            <!-- Login Access Switch Card -->
            <v-card variant="outlined" class="rounded-xl pa-3 mb-4 bg-slate-50 border" :color="editForm.can_login ? 'primary' : 'grey-lighten-1'">
              <div class="d-flex align-center justify-space-between">
                <div class="d-flex align-center">
                  <v-avatar size="36" :color="editForm.can_login ? 'primary-lighten-5' : 'grey-lighten-3'" class="mr-3 rounded-lg">
                    <v-icon :icon="editForm.can_login ? 'mdi-shield-key-outline' : 'mdi-shield-off-outline'" :color="editForm.can_login ? 'primary' : 'grey'"></v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-subtitle-2 font-weight-bold" :class="editForm.can_login ? 'text-primary' : 'text-grey-darken-2'">
                      {{ editForm.can_login ? 'System & Portal Login Enabled' : 'No System Login (HR & Documents Only)' }}
                    </div>
                    <div class="text-caption text-grey">
                      {{ editForm.can_login ? 'Staff can sign into the system with email and password' : 'Staff without login (drivers, helpers) only tracked for salary and documents' }}
                    </div>
                  </div>
                </div>
                <v-switch
                  v-model="editForm.can_login"
                  color="primary"
                  hide-details
                  inset
                  density="compact"
                ></v-switch>
              </div>
            </v-card>

            <h4 class="text-caption font-weight-bold text-slate-500 mb-3 text-uppercase">Basic Information</h4>
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.name"
                  label="Full Name *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => !!v || 'Name is required']"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.email"
                  :label="editForm.can_login ? 'Email Address (Login Username) *' : 'Email Address (Optional)'"
                  variant="outlined"
                  density="comfortable"
                  :rules="editForm.can_login ? [v => !!v || 'Email is required for login', v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email format'] : [v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email format']"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6" v-if="editForm.can_login">
                <v-select
                  v-model="editForm.role_id"
                  :items="roles"
                  item-title="name"
                  item-value="id"
                  label="Role *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => !!v || 'Role is required']"
                ></v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.designation"
                  label="Designation (e.g. Senior Typist, PRO)"
                  variant="outlined"
                  density="comfortable"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.joining_date"
                  label="Joining Date"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-switch
                  v-model="editForm.is_active"
                  label="Account Active Status"
                  color="success"
                  inset
                  density="comfortable"
                ></v-switch>
              </v-col>
            </v-row>

            <v-divider class="my-4"></v-divider>
            <h4 class="text-caption font-weight-bold text-slate-500 mb-3 text-uppercase">UAE Local Contact & Residence</h4>
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.phone"
                  label="UAE Phone / WhatsApp"
                  placeholder="+971 50 123 4567"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-phone"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.address"
                  label="UAE Residence Address"
                  placeholder="e.g. Flat 101, Al Nahda, Dubai"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-map-marker"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-divider class="my-4"></v-divider>
            <h4 class="text-caption font-weight-bold text-slate-500 mb-3 text-uppercase">Home Country Information</h4>
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="editForm.home_country_address"
                  label="Permanent Address in Home Country"
                  placeholder="Full residential address in home country"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-home"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.home_country_contact"
                  label="Home Country Primary Phone"
                  placeholder="e.g. +91 98765 43210"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-phone-classic"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.home_country_alternate_contact"
                  label="Alternate / Family Contact in Home Country"
                  placeholder="e.g. +91 98765 00000"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-phone-incoming"
                ></v-text-field>
              </v-col>
            </v-row>

            <template v-if="canEditStaff">
              <v-divider class="my-4"></v-divider>
              <h4 class="text-caption font-weight-bold text-slate-500 mb-3 text-uppercase">Salary Details</h4>
              <v-row dense>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model.number="editForm.basic_salary"
                    :rules="[salaryAmountRule]"
                    label="Basic Salary (AED)"
                    type="number"
                    variant="outlined"
                    density="comfortable"
                    min="0"
                    step="0.01"
                    @update:model-value="recalcEditTotalSalary"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model.number="editForm.hr_allowance"
                    :rules="[salaryAmountRule]"
                    label="Housing / HR (AED)"
                    type="number"
                    variant="outlined"
                    density="comfortable"
                    min="0"
                    step="0.01"
                    @update:model-value="recalcEditTotalSalary"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model.number="editForm.other_allowances"
                    :rules="[salaryAmountRule]"
                    label="Other Allowances (AED)"
                    type="number"
                    variant="outlined"
                    density="comfortable"
                    min="0"
                    step="0.01"
                    @update:model-value="recalcEditTotalSalary"
                  ></v-text-field>
                </v-col>
                <v-col cols="12">
                  <div class="d-flex justify-space-between align-center bg-grey-lighten-4 pa-3 rounded-lg">
                    <span class="text-subtitle-2 font-weight-bold text-slate-700">Total Monthly Salary</span>
                    <span class="text-h6 font-weight-black text-primary">AED {{ (parseFloat(editForm.total_salary) || 0).toFixed(2) }}</span>
                  </div>
                </v-col>
              </v-row>
            </template>
          </v-form>
        </v-card-text>
        <v-card-actions class="pb-4 px-6">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="editDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="px-8" :loading="saving" @click="saveStaffProfile">
            Save Changes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─── DIALOG 2: Add/Edit Staff Document Dialog ─── -->
    <v-dialog v-model="documentDialog" max-width="550px" persistent>
      <v-card class="soft-card pa-4 rounded-2xl">
        <v-card-title class="text-h5 font-weight-bold d-flex align-center">
          <v-icon :icon="editingDocId ? 'mdi-file-edit-outline' : 'mdi-file-document-plus-outline'" color="primary" class="mr-2"></v-icon>
          {{ editingDocId ? 'Edit Staff Document' : 'Upload Staff Document' }}
        </v-card-title>
        <v-card-text class="pt-4">
          <v-form ref="docFormRef" v-model="docFormValid">
            <v-select
              v-model="docForm.document_type_id"
              :items="documentTypes"
              item-title="name"
              item-value="id"
              label="Document Type *"
              variant="outlined"
              density="comfortable"
              class="mb-3"
              :rules="[v => !!v || 'Document type is required']"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props" :subtitle="item.raw.category"></v-list-item>
              </template>
            </v-select>

            <v-text-field
              v-model="docForm.doc_number"
              label="Document / ID Number"
              placeholder="e.g. 784-1990-1234567-1"
              variant="outlined"
              density="comfortable"
              class="mb-3"
            ></v-text-field>

            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="docForm.issue_date"
                  label="Issue Date"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  class="mb-3"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="docForm.expiry_date"
                  label="Expiry Date *"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  class="mb-3"
                  :rules="[v => !!v || 'Expiry date is required']"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-file-input
              v-model="docFile"
              label="Attach Document File (PDF / Images)"
              variant="outlined"
              density="comfortable"
              prepend-icon=""
              prepend-inner-icon="mdi-paperclip"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              class="mb-3"
              show-size
              :hint="editingDocId ? 'Leave empty to keep existing file' : ''"
              :persistent-hint="!!editingDocId"
            ></v-file-input>

            <v-textarea
              v-model="docForm.notes"
              label="Notes & Remarks"
              placeholder="e.g. Renewed upon 2-year employment visa"
              rows="2"
              variant="outlined"
              density="comfortable"
            ></v-textarea>
          </v-form>
        </v-card-text>
        <v-card-actions class="pb-4 px-6">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="documentDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="px-8" :loading="savingDoc" @click="saveStaffDocument">
            {{ editingDocId ? 'Update Document' : 'Save Document' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ─── DIALOG 3: Delete Confirm Dialog ─── -->
    <v-dialog v-model="deleteConfirm.show" max-width="400px">
      <v-card class="pa-4 rounded-xl">
        <v-card-title class="text-h6 font-weight-bold text-red-600">Delete Document?</v-card-title>
        <v-card-text class="pt-2 text-body-2">
          Are you sure you want to delete this document? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteConfirm.show = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" class="rounded-lg px-6" :loading="deletingDoc" @click="executeDeleteDocument">
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Toast Notification -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4000">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useCurrency } from '~/composables/useCurrency';
import { useConfigStore } from '~/stores/config';
import { permissionFor } from '~/utils/recordPermissions';
import StaffCommissionStatement from '~/components/staff/StaffCommissionStatement.vue';
import {salaryAmountRule,salaryComponentsTotal} from '~/utils/salaryCalculation.mjs';

const route = useRoute();
const staffId = route.params.id;
const { $api } = useNuxtApp();
const { formatCurrency } = useCurrency();
const auth = useAuthStore();
const configStore = useConfigStore();
const canViewCommission = computed(() => {
  if (!configStore.commissionEnabled || auth.user?.role_type === 'CustomerPortal') return false;
  if (auth.isAdmin || auth.isDeveloper) return true;
  const permission = permissionFor(auth.user, 'commissions');
  const scope = permission.rules?.list || (permission.read ? 'own' : 'none');
  return scope === 'all' || (scope === 'own' && String(auth.user?.id) === String(staffId));
});

const canViewStaff = computed(() => auth.isAdmin || auth.can('staff', 'read'));
const canEditStaff = computed(() => auth.isAdmin || auth.can('staff', 'write'));
const canDeleteStaff = computed(() => auth.isAdmin || auth.can('staff', 'delete'));

// State
const staff = ref(null);
const roles = ref([]);
const documentTypes = ref([]);
const loading = ref(true);
const error = ref('');
const activeTab = ref('profile');
watch(canViewCommission, visible => { if (!visible && activeTab.value === 'commission') activeTab.value = 'profile'; });

const snackbar = reactive({ show: false, text: '', color: 'success' });
const showNotify = (text, color = 'success') => {
  snackbar.text = text;
  snackbar.color = color;
  snackbar.show = true;
};

// Edit Profile Dialog State
const editDialog = ref(false);
const editFormValid = ref(false);
const editFormRef = ref(null);
const saving = ref(false);
const editForm = reactive({
  name: '',
  email: '',
  can_login: true,
  role_id: null,
  is_active: true,
  phone: '',
  address: '',
  home_country_address: '',
  home_country_contact: '',
  home_country_alternate_contact: '',
  designation: '',
  joining_date: '',
  basic_salary: 0,
  hr_allowance: 0,
  other_allowances: 0,
  total_salary: 0
});

// Document Dialog State
const documentDialog = ref(false);
const docFormValid = ref(false);
const docFormRef = ref(null);
const savingDoc = ref(false);
const editingDocId = ref(null);
const docFile = ref(null);
const docForm = reactive({
  document_type_id: null,
  title: '',
  doc_number: '',
  issue_date: '',
  expiry_date: '',
  notes: ''
});

// Delete Document Confirm State
const deleteConfirm = reactive({ show: false, docId: null });
const deletingDoc = ref(false);

// Avatar input ref
const avatarInput = ref(null);

// Table Headers for Documents
const docHeaders = [
  { title: 'Document Type', key: 'type', sortable: true },
  { title: 'ID / Doc Number', key: 'doc_number', sortable: true },
  { title: 'Issue Date', key: 'issue_date', sortable: true },
  { title: 'Expiry Date', key: 'expiry_date', sortable: true },
  { title: 'Status', key: 'status', sortable: false, align: 'center' },
  { title: 'Attachment', key: 'file_path', sortable: false, align: 'center' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
];

// ─── Computed Statistics ───────────────────────────────────────────────────
const expiredCount = computed(() => {
  if (!staff.value?.StaffDocuments) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return staff.value.StaffDocuments.filter(d => {
    if (!d.expiry_date) return false;
    return new Date(d.expiry_date) < today;
  }).length;
});

const dueSoonCount = computed(() => {
  if (!staff.value?.StaffDocuments) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  return staff.value.StaffDocuments.filter(d => {
    if (!d.expiry_date) return false;
    const exp = new Date(d.expiry_date);
    return exp >= today && exp <= thirtyDaysLater;
  }).length;
});

// ─── Formatting Helpers ────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

const formatAvatarUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = $api.defaults.baseURL.replace('/api/v1', '');
  return `${base}${path}`;
};

const formatFileUrl = (path) => {
  if (!path) return '#';
  if (path.startsWith('http')) return path;
  const base = $api.defaults.baseURL.replace('/api/v1', '');
  return `${base}${path}`;
};

const calculateTenure = (joiningDate) => {
  if (!joiningDate) return 'Tenure not recorded';
  const start = new Date(joiningDate);
  const now = new Date();
  const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (diffMonths < 1) return 'Joined this month';
  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;
  if (years === 0) return `${months} month${months > 1 ? 's' : ''} tenure`;
  if (months === 0) return `${years} year${years > 1 ? 's' : ''} tenure`;
  return `${years} yr${years > 1 ? 's' : ''}, ${months} mo${months > 1 ? 's' : ''} tenure`;
};

const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  const diffTime = exp - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getExpiryStatusLabel = (expiryDate) => {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'Unknown';
  if (days < 0) return 'Expired';
  if (days <= 7) return 'Critical';
  if (days <= 30) return 'Due Soon';
  return 'Active';
};

const getExpiryChipColor = (expiryDate) => {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'grey';
  if (days < 0) return 'error';
  if (days <= 7) return 'deep-orange';
  if (days <= 30) return 'warning';
  return 'success';
};

const getExpiryChipIcon = (expiryDate) => {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'mdi-help-circle-outline';
  if (days < 0) return 'mdi-alert-octagon-outline';
  if (days <= 7) return 'mdi-clock-alert-outline';
  if (days <= 30) return 'mdi-bell-alert-outline';
  return 'mdi-check-circle-outline';
};

const getExpiryTextClass = (expiryDate) => {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'text-slate-400';
  if (days < 0) return 'text-red-600 font-weight-bold';
  if (days <= 7) return 'text-deep-orange-darken-1 font-weight-bold';
  if (days <= 30) return 'text-amber-700 font-weight-bold';
  return 'text-slate-500';
};

const getExpiryRelativeText = (expiryDate) => {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return '';
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago`;
  if (days === 0) return 'Expires today!';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
};

// ─── Data Fetching ─────────────────────────────────────────────────────────
const fetchStaff = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await $api.get(`/users/${staffId}`);
    if (res.data?.success) {
      staff.value = res.data.data;
    } else {
      error.value = res.data?.message || 'Failed to load staff details.';
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Error fetching staff profile.';
  } finally {
    loading.value = false;
  }
};

const fetchRolesAndDocTypes = async () => {
  try {
    const [roleRes, docTypeRes] = await Promise.all([
      $api.get('/roles'),
      $api.get('/document-types')
    ]);
    if (roleRes.data?.success) roles.value = roleRes.data.data;
    if (docTypeRes.data?.success) documentTypes.value = docTypeRes.data.data;
  } catch (err) {
    console.error('Failed to load roles or document types:', err);
  }
};

// ─── Edit Profile ──────────────────────────────────────────────────────────
const openEditDialog = () => {
  if (!staff.value) return;
  Object.assign(editForm, {
    name: staff.value.name || '',
    email: staff.value.email || '',
    can_login: staff.value.can_login !== undefined ? !!staff.value.can_login : true,
    role_id: staff.value.Role?.id || staff.value.role_id,
    is_active: !!staff.value.is_active,
    phone: staff.value.phone || '',
    address: staff.value.address || '',
    home_country_address: staff.value.home_country_address || '',
    home_country_contact: staff.value.home_country_contact || '',
    home_country_alternate_contact: staff.value.home_country_alternate_contact || '',
    designation: staff.value.designation || '',
    joining_date: staff.value.joining_date || '',
    basic_salary: parseFloat(staff.value.basic_salary) || 0,
    hr_allowance: parseFloat(staff.value.hr_allowance) || 0,
    other_allowances: parseFloat(staff.value.other_allowances) || 0,
    total_salary: parseFloat(staff.value.total_salary) || 0
  });
  editDialog.value = true;
};

const editSalaryTouched=ref(false);
watch(editDialog,open=>{if(open)editSalaryTouched.value=false;});
const recalcEditTotalSalary = () => {
  editSalaryTouched.value=true;
  try{editForm.total_salary=salaryComponentsTotal(editForm);}catch{editForm.total_salary=null;}
};

const saveStaffProfile = async () => {
  const { valid } = await editFormRef.value.validate();
  if (!valid) return;

  saving.value = true;
  try {
    if(canEditStaff.value&&editSalaryTouched.value)editForm.total_salary=salaryComponentsTotal(editForm);
    const res = await $api.put(`/users/${staffId}`, editForm);
    if (res.data?.success) {
      staff.value = res.data.data;
      editDialog.value = false;
      showNotify('Staff profile updated successfully!');
    }
  } catch (err) {
    showNotify(err.response?.data?.message || err.message || 'Failed to update staff profile', 'error');
  } finally {
    saving.value = false;
  }
};

// ─── Avatar Upload ─────────────────────────────────────────────────────────
const triggerAvatarInput = () => {
  avatarInput.value?.click();
};

const handleAvatarUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const res = await $api.post(`/users/${staffId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data?.success) {
      staff.value.avatar = res.data.avatar;
      showNotify('Profile picture updated successfully!');
    }
  } catch (err) {
    showNotify(err.response?.data?.message || 'Avatar upload failed', 'error');
  } finally {
    if (avatarInput.value) avatarInput.value.value = '';
  }
};

// ─── Staff Documents CRUD ──────────────────────────────────────────────────
const openAddDocumentDialog = () => {
  editingDocId.value = null;
  docFile.value = null;
  Object.assign(docForm, {
    document_type_id: documentTypes.value.length > 0 ? documentTypes.value[0].id : null,
    title: '',
    doc_number: '',
    issue_date: '',
    expiry_date: '',
    notes: ''
  });
  documentDialog.value = true;
};

const openEditDocumentDialog = (doc) => {
  editingDocId.value = doc.id;
  docFile.value = null;
  Object.assign(docForm, {
    document_type_id: doc.document_type_id,
    title: doc.title || '',
    doc_number: doc.doc_number || '',
    issue_date: doc.issue_date || '',
    expiry_date: doc.expiry_date || '',
    notes: doc.notes || ''
  });
  documentDialog.value = true;
};

const saveStaffDocument = async () => {
  const { valid } = await docFormRef.value.validate();
  if (!valid) return;

  savingDoc.value = true;
  const formData = new FormData();
  formData.append('document_type_id', docForm.document_type_id || '');
  formData.append('title', docForm.title || '');
  formData.append('doc_number', docForm.doc_number || '');
  if (docForm.issue_date) formData.append('issue_date', docForm.issue_date);
  formData.append('expiry_date', docForm.expiry_date);
  formData.append('notes', docForm.notes || '');
  if (docFile.value) {
    formData.append('file', docFile.value);
  }

  try {
    if (editingDocId.value) {
      const res = await $api.put(`/users/${staffId}/documents/${editingDocId.value}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        showNotify('Document updated successfully!');
        documentDialog.value = false;
        fetchStaff();
      }
    } else {
      const res = await $api.post(`/users/${staffId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        showNotify('Document added successfully!');
        documentDialog.value = false;
        fetchStaff();
      }
    }
  } catch (err) {
    showNotify(err.response?.data?.message || 'Failed to save document', 'error');
  } finally {
    savingDoc.value = false;
  }
};

const confirmDeleteDocument = (doc) => {
  deleteConfirm.docId = doc.id;
  deleteConfirm.show = true;
};

const executeDeleteDocument = async () => {
  if (!deleteConfirm.docId) return;
  deletingDoc.value = true;
  try {
    const res = await $api.delete(`/users/${staffId}/documents/${deleteConfirm.docId}`);
    if (res.data?.success) {
      showNotify('Document deleted successfully!');
      deleteConfirm.show = false;
      fetchStaff();
    }
  } catch (err) {
    showNotify(err.response?.data?.message || 'Failed to delete document', 'error');
  } finally {
    deletingDoc.value = false;
  }
};

onMounted(() => {
  fetchStaff();
  fetchRolesAndDocTypes();
});
</script>

<style scoped>
.soft-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease-in-out;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.hover-underline:hover {
  text-decoration: underline !important;
}

/* Glassmorphism Icon Styles */
.glass-avatar-container {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.glass-icon-primary {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%) !important;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3) !important;
}
.glass-icon-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3) !important;
}
.glass-icon-indigo {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%) !important;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3) !important;
}
.glass-icon-purple {
  background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%) !important;
  box-shadow: 0 4px 15px rgba(168, 85, 247, 0.3) !important;
}
.glass-icon-blue {
  background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%) !important;
  box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3) !important;
}
</style>
