<template>
  <v-container class="pa-6" style="max-width: 1400px">
    <v-row class="mb-4 align-center">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-avatar size="56" class="rounded-xl mr-4 glass-icon-primary glass-avatar-container">
            <v-icon icon="mdi-cog-outline" color="white" size="32"></v-icon>
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold color-primary mb-1">
              System Settings
            </h1>
            <p class="text-subtitle-1 text-grey-darken-1 mb-0">Manage users, roles, layouts, and global configurations</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Horizontal Tab Bar -->
    <v-card class="soft-card mb-6 overflow-hidden" variant="flat">
      <v-tabs
        v-model="activeTab"
        color="primary"
        bg-color="transparent"
        show-arrows
        density="comfortable"
      >
        <v-tab
          v-for="tab in tabs"
          :key="tab.value"
          :value="tab.value"
          :prepend-icon="tab.icon"
          class="font-weight-bold text-capitalize"
        >
          {{ tab.title }}
        </v-tab>
      </v-tabs>
    </v-card>

    <!-- Main Content -->
    <v-window v-model="activeTab">
      <v-window-item value="service-templates">
        <ServiceBundleSettings v-if="activeTab === 'service-templates'" />
      </v-window-item>
      <!-- Service Catalog Management -->
      <v-window-item value="services">
        <v-card class="soft-card">
          <v-data-table-server
            v-model:items-per-page="itemsPerPageCatalog"
            :headers="catalogHeaders"
            :items="serviceStore.serviceTypes"
            :items-length="serviceStore.totalServiceTypes"
            :loading="serviceStore.loading"
            @update:options="loadCatalog"
            hover
          >
            <template v-slot:top>
              <v-toolbar flat color="transparent" class="px-4">
                <v-toolbar-title class="font-weight-bold">Service Catalog (Settings)</v-toolbar-title>
                <v-spacer></v-spacer>
                <v-text-field
                  v-model="searchCatalog"
                  placeholder="Search services..."
                  prepend-inner-icon="mdi-magnify"
                  density="comfortable"
                  hide-details
                  style="max-width: 300px;"
                  variant="solo"
                  flat
                  class="search-pill mr-4"
                ></v-text-field>
                <v-btn
                  v-if="auth.can('services', 'write')"
                  color="primary"
                  prepend-icon="mdi-plus"
                  class="btn-3d"
                  @click="openTypeForm()"
                >
                  Add Service Type
                </v-btn>
              </v-toolbar>
            </template>

            <!-- Custom Sell Price Column -->
            <template v-slot:item.sell_price="{ item }">
              <div v-if="item.pricing_mode === 'Multi'" class="text-caption">
                <div v-for="p in item.ServiceTypePricings" :key="p.id" class="mb-1">
                  <span class="opacity-60">{{ p.pricing_type }}:</span> AED {{ parseFloat(p.selling_price).toFixed(2) }}
                </div>
              </div>
              <span v-else>
                AED {{ formatSellPrice(item) }}
              </span>
            </template>

            <!-- Custom Profit Column -->
            <template v-slot:item.profit="{ item }">
              <div v-if="item.pricing_mode === 'Multi'" class="text-caption text-success font-weight-bold">
                <div v-for="p in item.ServiceTypePricings" :key="p.id" class="mb-1">
                  <span class="opacity-60">{{ p.pricing_type }}:</span> AED {{ parseFloat(p.service_charge).toFixed(2) }}
                </div>
              </div>
              <span v-else class="font-weight-bold text-success">
                AED {{ formatProfit(item) }}
              </span>
            </template>
            <!-- Status Column -->
            <template v-slot:item.is_active="{ item }">
              <v-switch
                v-if="auth.can('services', 'write')"
                v-model="item.is_active"
                color="success"
                hide-details
                density="compact"
                @change="toggleTypeStatus(item)"
              ></v-switch>
              <v-chip v-else :color="item.is_active ? 'success' : 'grey'" size="x-small">{{ item.is_active ? 'Active' : 'Inactive' }}</v-chip>
            </template>

            <!-- Actions -->
            <template v-slot:item.actions="{ item }">
              <v-btn v-if="auth.can('services', 'write')" icon="mdi-pencil-outline" variant="text" size="small" color="primary" @click="openTypeForm(item)"></v-btn>
              <v-btn v-if="auth.can('services', 'delete')" icon="mdi-delete-outline" variant="text" size="small" color="error" @click="confirmDeleteType(item)"></v-btn>
            </template>
          </v-data-table-server>
        </v-card>
      </v-window-item>

      <!-- Document Types Management -->
      <v-window-item value="doc-types">
        <v-card class="soft-card">
          <v-data-table
            :headers="docTypeHeaders"
            :items="documentTypes"
            :loading="loadingDocTypes"
            hover
          >
            <template v-slot:top>
              <v-toolbar flat color="transparent" class="px-4">
                <v-toolbar-title class="font-weight-bold">Document Types (Settings)</v-toolbar-title>
                <v-spacer></v-spacer>
                <v-btn
                  v-if="auth.can('settings', 'write')"
                  color="primary"
                  prepend-icon="mdi-plus"
                  rounded="lg"
                  variant="flat"
                  @click="openDocTypeDialog"
                >
                  Add New Type
                </v-btn>
              </v-toolbar>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn v-if="auth.can('settings', 'write')" icon="mdi-pencil-outline" variant="text" size="small" color="primary" @click="openDocTypeDialog(item)"></v-btn>
              <v-btn v-if="auth.can('settings', 'delete')" icon="mdi-delete-outline" variant="text" size="small" color="error" @click="confirmDeleteDocType(item)"></v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- Users Management -->
      <v-window-item value="users">
        <v-card class="soft-card">
          <v-data-table
            :headers="userHeaders"
            :items="users"
            :loading="loading"
            hover
          >
            <template v-slot:top>
              <v-toolbar flat color="transparent" class="px-4">
                <v-toolbar-title class="font-weight-bold">Staff Directory</v-toolbar-title>
                <v-spacer></v-spacer>
                <v-btn
                  v-if="auth.can('settings', 'write')"
                  color="primary"
                  prepend-icon="mdi-account-plus"
                  rounded="lg"
                  variant="flat"
                  @click="openUserForm()"
                >
                  Create Staff / User
                </v-btn>
              </v-toolbar>
            </template>

            <template v-slot:item.avatar="{ item }">
              <v-avatar size="40" color="primary-light" :class="(auth.isAdmin || auth.can('staff', 'read')) ? 'cursor-pointer' : ''" @click="(auth.isAdmin || auth.can('staff', 'read')) ? $router.push(`/staff/${item.id}`) : null">
                <v-img v-if="item.avatar" :src="$api.defaults.baseURL.replace('/api/v1', '') + item.avatar" cover></v-img>
                <span v-else class="text-primary font-weight-bold">{{ item.name.charAt(0).toUpperCase() }}</span>
              </v-avatar>
            </template>

            <template v-slot:item.name="{ item }">
              <div class="d-flex flex-column py-1">
                <span
                  class="font-weight-bold text-primary d-inline-flex align-center"
                  :class="(auth.isAdmin || auth.can('staff', 'read')) ? 'cursor-pointer hover-underline' : ''"
                  @click="(auth.isAdmin || auth.can('staff', 'read')) ? $router.push(`/staff/${item.id}`) : null"
                >
                  {{ item.name }}
                  <v-icon v-if="auth.isAdmin || auth.can('staff', 'read')" icon="mdi-open-in-new" size="13" class="ml-1 opacity-60"></v-icon>
                </span>
                <span v-if="item.designation" class="text-caption text-grey">
                  {{ item.designation }}
                </span>
              </div>
            </template>

            <template v-slot:item.email="{ item }">
              <span v-if="item.email" class="text-body-2">{{ item.email }}</span>
              <span v-else class="text-caption text-grey italic">No login email</span>
            </template>

            <template v-slot:item.can_login="{ item }">
               <v-chip
                 :color="item.can_login !== false ? 'primary' : 'blue-grey'"
                 :variant="item.can_login !== false ? 'tonal' : 'outlined'"
                 size="x-small"
                 class="font-weight-bold"
               >
                 <v-icon start :icon="item.can_login !== false ? 'mdi-shield-key' : 'mdi-shield-off-outline'" size="12"></v-icon>
                 {{ item.can_login !== false ? 'Enabled' : 'No Login' }}
               </v-chip>
            </template>

            <template v-slot:item.Role="{ item }">
              <v-chip v-if="item.can_login !== false" size="small" variant="tonal" color="primary" class="font-weight-bold">
                {{ item.Role?.name || 'No Role' }}
              </v-chip>
              <span v-else class="text-caption text-grey italic">Non-Login Staff</span>
            </template>

            <template v-slot:item.Customer="{ item }">
               <span v-if="item.LinkedCustomers && item.LinkedCustomers.length > 0" class="font-weight-bold text-primary">
                 {{ item.LinkedCustomers.map(c => c.name).join(', ') }}
               </span>
               <span v-else class="text-caption text-grey">N/A (Internal)</span>
             </template>

            <template v-slot:item.total_salary="{ item }">
              <div v-if="auth.isAdmin || auth.can('staff', 'read')" class="text-right">
                <v-chip size="small" variant="flat" class="font-weight-bold" style="background: #ECFDF5; color: #047857;">
                  {{ formatCurrency(item.total_salary) }}
                </v-chip>
              </div>
              <span v-else class="text-caption text-grey">Confidential</span>
            </template>

            <template v-slot:item.is_active="{ item }">
               <v-chip :color="item.is_active ? 'success' : 'grey'" size="x-small" label class="text-uppercase font-weight-bold">
                  {{ item.is_active ? 'Active' : 'Inactive' }}
               </v-chip>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn v-if="auth.isAdmin || auth.can('staff', 'read')" icon="mdi-card-account-details-outline" variant="text" size="small" color="info" :to="`/staff/${item.id}`" title="View Detailed Profile"></v-btn>
              <v-btn v-if="auth.can('settings', 'write')" icon="mdi-pencil" variant="text" size="small" color="primary" @click="openUserForm(item)" title="Edit User"></v-btn>
              <v-btn v-if="auth.can('settings', 'delete') && item.Role?.name !== 'Admin'" icon="mdi-delete" variant="text" size="small" color="error" @click="confirmDeleteUser(item)" title="Delete User"></v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- Roles & Permissions -->
      <v-window-item value="roles">
        <v-row>
           <v-col cols="12" class="roles-list-column">
              <v-card class="soft-card h-100 compact-role-list">
                 <v-list lines="two">
                    <v-list-subheader class="font-weight-bold text-primary">AVAILABLE ROLES</v-list-subheader>
                    <v-list-item
                      v-for="role in roles"
                      :key="role.id"
                      :active="selectedRole?.id === role.id"
                      @click="selectRole(role)"
                      rounded="lg"
                      class="ma-2 border"
                    >
                      <template v-slot:prepend>
                        <v-avatar size="28" class="glass-icon-indigo glass-avatar-container">
                          <v-icon icon="mdi-shield-check" color="white"></v-icon>
                        </v-avatar>
                      </template>
                      <v-list-item-title class="font-weight-bold">{{ role.name }}</v-list-item-title>
                      <v-list-item-subtitle>{{ role.type === 'CustomerPortal' ? 'Customer Portal' : 'Internal' }} • {{ role.UserCount || 0 }} Users Assigned</v-list-item-subtitle>
                     <template v-slot:append>
                        <div class="d-flex flex-column align-center">
                           <v-btn
                             v-if="auth.can('settings', 'write') && role.name !== 'Admin' && role.name !== 'Staff'"
                             icon="mdi-pencil-outline"
                             variant="text"
                             size="x-small"
                             color="primary"
                             class="ma-0"
                             @click.stop="openRoleDialog(role)"
                           ></v-btn>
                           <v-btn
                             v-if="auth.can('settings', 'delete') && role.name !== 'Admin' && role.name !== 'Staff'"
                             icon="mdi-delete-outline"
                             variant="text"
                             size="x-small"
                             color="error"
                             :disabled="role.UserCount > 0"
                             @click.stop="confirmDeleteRole(role)"
                           ></v-btn>
                           <v-icon v-else icon="mdi-chevron-right" color="grey"></v-icon>
                        </div>
                     </template>
                    </v-list-item>
                    <v-divider></v-divider>
                    <div class="pa-2" v-if="auth.can('settings', 'write')">
                       <v-btn block size="small" color="primary" variant="outlined" prepend-icon="mdi-plus" rounded="lg" @click="openRoleDialog()">
                          New Role
                       </v-btn>
                    </div>
                 </v-list>
              </v-card>
           </v-col>

           <v-col cols="12" class="role-permissions-column">
              <v-card v-if="selectedRole" class="soft-card">
                 <div class="pa-4 d-flex flex-wrap align-center justify-space-between ga-3">
                    <div class="text-subtitle-1">
                       <span class="text-grey">Permissions for:</span>
                       <span class="font-weight-bold ml-2">{{ selectedRole.name }}</span>
                    </div>
                    <div class="d-flex flex-wrap ga-2">
                    <v-btn to="/record-assignments" variant="text" size="x-small">Record assignments</v-btn>
                    <v-btn v-if="auth.can('settings', 'write') && !['Admin', 'Developer'].includes(selectedRole.name)" color="success" prepend-icon="mdi-content-save" rounded="lg" @click="saveRolePermissions">Save Changes</v-btn>
                    </div>
                 </div>

                 <v-divider></v-divider>

                 <v-card-text class="pa-0">
                    <RoleDashboardAssignment :role="selectedRole" :disabled="!auth.can('settings', 'write')" @saved="id => { selectedRole.dashboard_template_id = id; const role = roles.find(item => item.id === selectedRole.id); if (role) role.dashboard_template_id = id }" />
                    <RolePermissionEditor :permissions="selectedRole.permissions" :modules="filteredSystemModules" :disabled="['Admin', 'Developer'].includes(selectedRole.name) || !auth.can('settings', 'write')" />
                 </v-card-text>
              </v-card>
              <v-sheet v-else height="400" border class="rounded-xl d-flex flex-column align-center justify-center text-grey border">
                 <v-icon icon="mdi-shield-alert" size="64" class="mb-4"></v-icon>
                 <div class="text-h6">Select a role to manage responsibilities</div>
              </v-sheet>
           </v-col>
        </v-row>
      </v-window-item>

      <!-- General Settings -->
      <v-window-item value="dashboard-templates"><DashboardTemplateSettings /></v-window-item>
      <v-window-item value="general">
         <v-row>
            <v-col cols="12" md="8">
               <v-card class="soft-card pa-6">
                  <div class="d-flex align-center mb-6">
                     <v-avatar size="48" class="mr-4 rounded-lg glass-icon-blue glass-avatar-container">
                        <v-icon icon="mdi-tune" color="white"></v-icon>
                     </v-avatar>
                     <div>
                        <div class="text-h6 font-weight-bold">Global Configuration</div>
                        <div class="text-caption text-grey">Manage system-wide defaults and branding</div>
                     </div>
                  </div>

                  <v-form v-model="configValid" @submit.prevent="saveConfigs">
                     <v-row>
                        <v-col cols="12" md="12">
                           <div class="mb-4">
                              <label class="text-subtitle-2 font-weight-bold d-block mb-2">Company Logo</label>
                              <div v-if="configs.app_logo" class="mb-4 px-2">
                                <img :src="configs.app_logo" alt="Company Logo" style="max-height: 80px; object-fit: contain; mix-blend-mode: multiply;" />
                              </div>
                              <v-file-input
                                v-model="logoFile"
                                label="Upload New Logo"
                                accept="image/*"
                                variant="outlined"
                                density="comfortable"
                                class="soft-input"
                                prepend-icon="mdi-camera"
                                @change="handleLogoUpload"
                                :loading="uploadingLogo"
                                hint="Preferred size 200x200px"
                                persistent-hint
                              ></v-file-input>
                           </div>
                        </v-col>
                        <v-col cols="12" md="6">
                           <v-text-field
                             v-model="configs.app_name"
                             label="Company Name"
                             variant="outlined"
                             class="soft-input"
                             hint="Your company name"
                             persistent-hint
                           ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                           <v-text-field
                             v-model="configs.base_currency"
                             label="Base Currency"
                             variant="outlined"
                             class="soft-input"
                             hint="Default currency for new invoices"
                             persistent-hint
                           ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="12">
                           <v-text-field
                             v-model="configs.company_address"
                             label="Company Address"
                             variant="outlined"
                             class="soft-input"
                             hint="Used on invoices"
                             persistent-hint
                           ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                           <v-text-field
                             v-model="configs.company_phone"
                             label="Company Phone"
                             variant="outlined"
                             class="soft-input"
                           ></v-text-field>
                        </v-col>
                        <v-col cols="12" md="6">
                           <v-text-field
                             v-model="configs.company_email"
                             label="Company Email"
                             variant="outlined"
                             class="soft-input"
                           ></v-text-field>
                        </v-col>
                     </v-row>



                      <div class="d-flex align-center mb-6">
                         <v-avatar size="48" class="mr-4 rounded-lg glass-icon-success glass-avatar-container">
                            <v-icon icon="mdi-cash-clock" color="white"></v-icon>
                         </v-avatar>
                         <div>
                            <div class="text-h6 font-weight-bold">Cost Deduction Policy</div>
                            <div class="text-caption text-grey">Configure when service costs and fees are deducted (from wallets or suppliers)</div>
                         </div>
                      </div>
                      <v-row>
                         <v-col cols="12" md="6">
                            <v-select
                              v-model="configs.wallet_deduction_point"
                              :items="[
                                { title: 'Deduct on Invoice Creation (Default)', value: 'invoice_creation' },
                                { title: 'Deduct on Service Completion', value: 'service_completion' }
                              ]"
                              item-title="title"
                              item-value="value"
                              label="Cost Deduction Point"
                              variant="outlined"
                              class="soft-input"
                              hint="Choose whether costs are deducted upon service completion or invoice creation"
                              persistent-hint
                            ></v-select>
                         </v-col>
                      </v-row>

                     <v-divider class="my-6"></v-divider>

                      <CommissionMasterSwitch />
                      <v-divider class="my-6" />

                      <div class="d-flex align-center mb-6">
                         <v-avatar size="48" class="mr-4 rounded-lg glass-icon-indigo glass-avatar-container">
                            <v-icon icon="mdi-palette-outline" color="white"></v-icon>
                         </v-avatar>
                         <div>
                            <div class="text-h6 font-weight-bold">Theme & Appearance</div>
                            <div class="text-caption text-grey">Choose a visual style for your workspace</div>
                         </div>
                      </div>

                      <!-- Visual Theme Picker -->
                      <v-row dense>
                        <!-- Default (Blue) Theme Card - ACTIVE -->
                        <v-col cols="12" sm="6" lg="3">
                          <div
                            class="theme-pick-card"
                            :class="{ 'theme-pick-card--active': configs.theme_name === 'light' }"
                            @click="configs.theme_name = 'light'"
                          >
                            <!-- Mini Browser Preview -->
                            <div class="theme-preview theme-preview--light">
                              <div class="tp-sidebar"></div>
                              <div class="tp-content">
                                <div class="tp-header"></div>
                                <div class="tp-cards">
                                  <div class="tp-card"></div>
                                  <div class="tp-card"></div>
                                </div>
                                <div class="tp-row"></div>
                                <div class="tp-row tp-row--short"></div>
                              </div>
                            </div>
                            <!-- Label -->
                            <div class="theme-pick-label">
                              <div class="d-flex align-center justify-space-between">
                                <div>
                                  <div class="d-flex align-center gap-2">
                                    <span class="font-weight-bold text-body-2">Default</span>
                                    <v-chip size="x-small" color="primary" variant="flat" class="font-weight-bold px-1 py-0 text-caption" style="height: 18px; font-size: 0.65rem !important;">ACTIVE</v-chip>
                                  </div>
                                  <div class="text-caption" style="color:#94A3B8">Ocean Blue</div>
                                </div>
                                <v-icon v-if="configs.theme_name === 'light'" icon="mdi-check-circle" color="#3B82F6" size="20"></v-icon>
                                <div v-else class="theme-dot" style="background:#3B82F6"></div>
                              </div>
                            </div>
                          </div>
                        </v-col>

                        <!-- White (Monochrome) Theme Card - FROZEN / BETA -->
                        <v-col cols="12" sm="6" lg="3">
                          <div
                            class="theme-pick-card theme-pick-card--disabled"
                            @click="showFrozenThemeNotice('White (Monochrome)')"
                          >
                            <div class="theme-preview theme-preview--white">
                              <div class="theme-freeze-badge">
                                <v-icon icon="mdi-lock" size="11" class="mr-1"></v-icon>
                                <span>FROZEN</span>
                              </div>
                              <div class="tp-sidebar"></div>
                              <div class="tp-content">
                                <div class="tp-header"></div>
                                <div class="tp-cards">
                                  <div class="tp-card"></div>
                                  <div class="tp-card"></div>
                                </div>
                                <div class="tp-row"></div>
                                <div class="tp-row tp-row--short"></div>
                              </div>
                            </div>
                            <div class="theme-pick-label">
                              <div class="d-flex align-center justify-space-between">
                                <div>
                                  <div class="d-flex align-center gap-2">
                                    <span class="font-weight-bold text-body-2">White</span>
                                    <v-chip size="x-small" color="warning" variant="tonal" class="font-weight-bold px-1 py-0 text-caption" style="height: 18px; font-size: 0.65rem !important;">BETA</v-chip>
                                  </div>
                                  <div class="text-caption text-grey">Monochrome (Frozen)</div>
                                </div>
                                <v-icon icon="mdi-lock-outline" color="grey-darken-1" size="18"></v-icon>
                              </div>
                            </div>
                          </div>
                        </v-col>

                        <!-- Classic (Violet) Theme Card - FROZEN / BETA -->
                        <v-col cols="12" sm="6" lg="3">
                          <div
                            class="theme-pick-card theme-pick-card--disabled"
                            @click="showFrozenThemeNotice('Classic (Violet)')"
                          >
                            <div class="theme-preview theme-preview--classic">
                              <div class="theme-freeze-badge">
                                <v-icon icon="mdi-lock" size="11" class="mr-1"></v-icon>
                                <span>FROZEN</span>
                              </div>
                              <div class="tp-sidebar"></div>
                              <div class="tp-content">
                                <div class="tp-header"></div>
                                <div class="tp-cards">
                                  <div class="tp-card"></div>
                                  <div class="tp-card"></div>
                                </div>
                                <div class="tp-row"></div>
                                <div class="tp-row tp-row--short"></div>
                              </div>
                            </div>
                            <div class="theme-pick-label">
                              <div class="d-flex align-center justify-space-between">
                                <div>
                                  <div class="d-flex align-center gap-2">
                                    <span class="font-weight-bold text-body-2">Classic</span>
                                    <v-chip size="x-small" color="warning" variant="tonal" class="font-weight-bold px-1 py-0 text-caption" style="height: 18px; font-size: 0.65rem !important;">BETA</v-chip>
                                  </div>
                                  <div class="text-caption text-grey">Violet (Frozen)</div>
                                </div>
                                <v-icon icon="mdi-lock-outline" color="grey-darken-1" size="18"></v-icon>
                              </div>
                            </div>
                          </div>
                        </v-col>
                        <v-col cols="12" sm="6" lg="3">
                          <div
                            class="theme-pick-card"
                            :class="{ 'theme-pick-card--active': configs.theme_name === 'sage' }"
                            role="button"
                            tabindex="0"
                            :aria-pressed="configs.theme_name === 'sage'"
                            aria-label="Select Sage beta theme"
                            @click="configs.theme_name = 'sage'"
                            @keydown.enter="configs.theme_name = 'sage'"
                            @keydown.space.prevent="configs.theme_name = 'sage'"
                          >
                            <div class="theme-preview theme-preview--sage" :style="{
                              '--beta-primary': configs.beta_theme_colors.primary,
                              '--beta-background': configs.beta_theme_colors.background,
                              '--beta-surface': configs.beta_theme_colors.surface,
                              '--beta-text': configs.beta_theme_colors['on-surface']
                            }">
                              <div class="tp-sidebar"></div>
                              <div class="tp-content">
                                <div class="tp-header"></div>
                                <div class="tp-cards"><div class="tp-card"></div><div class="tp-card"></div></div>
                                <div class="tp-row"></div><div class="tp-row tp-row--short"></div>
                              </div>
                            </div>
                            <div class="theme-pick-label">
                              <div class="d-flex align-center justify-space-between">
                                <div>
                                  <div class="d-flex align-center gap-2">
                                    <span class="font-weight-bold text-body-2">Sage</span>
                                    <v-chip size="x-small" color="success" variant="tonal">BETA</v-chip>
                                  </div>
                                  <div class="text-caption text-grey">Editable palette</div>
                                </div>
                                <v-icon v-if="configs.theme_name === 'sage'" icon="mdi-check-circle" :color="configs.beta_theme_colors.primary" size="20"></v-icon>
                                <div v-else class="theme-dot" :style="{ background: configs.beta_theme_colors.primary }"></div>
                              </div>
                            </div>
                          </div>
                        </v-col>
                      </v-row>
                      <div v-if="configs.theme_name === 'sage'" class="beta-theme-editor mt-5">
                        <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3">
                          <div>
                            <div class="font-weight-bold">Make Sage yours</div>
                            <div class="text-caption text-grey">Preview colors instantly. Save Configuration to keep them for your workspace.</div>
                          </div>
                          <v-btn type="button" variant="text" size="small" :disabled="!auth.can('settings', 'write')" @click="resetBetaTheme">Reset colors</v-btn>
                        </div>
                        <div class="beta-color-grid">
                          <label v-for="field in betaThemeFields" :key="field.key" class="beta-color-field">
                            <span class="text-caption font-weight-medium">{{ field.label }}</span>
                            <div class="d-flex align-center gap-2">
                              <input v-model="configs.beta_theme_colors[field.key]" type="color" :aria-label="`Sage ${field.label.toLowerCase()} color`" :disabled="!auth.can('settings', 'write')" />
                              <code>{{ configs.beta_theme_colors[field.key] }}</code>
                            </div>
                          </label>
                        </div>
                      </div>
                      <div class="text-caption text-primary mt-2 ml-1 d-flex align-center gap-1 font-weight-medium">
                        <v-icon icon="mdi-information-outline" size="15"></v-icon>
                        Sage Beta is available now with editable colors. White and Classic remain frozen.
                      </div>

                     <v-divider class="my-6"></v-divider>

                     <div class="d-flex justify-end">
                        <v-btn
                          v-if="auth.can('settings', 'write')"
                          color="primary"
                          class="btn-3d px-8"
                          height="44"
                          type="submit"
                          :loading="savingConfigs"
                        >
                           Save Configuration
                        </v-btn>
                     </div>
                  </v-form>
               </v-card>
            </v-col>
            <v-col cols="12" md="4">
               <v-card class="soft-card pa-6 rounded-2xl" variant="flat">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Pro Tip</h4>
                  <p class="text-body-2 opacity-70">
                     Changes to the **Business Name** will reflect immediately on all newly generated PDF invoices.
                  </p>
               </v-card>
            </v-col>
         </v-row>
      </v-window-item>
      <!-- Subscription Details -->
      <v-window-item value="subscription">
         <v-row>
            <v-col cols="12" md="8">
               <v-card class="soft-card pa-6">
                  <div class="d-flex align-center mb-6">
                     <v-avatar size="48" class="mr-4 rounded-lg glass-icon-purple glass-avatar-container">
                        <v-icon icon="mdi-card-account-details-star-outline" color="white"></v-icon>
                     </v-avatar>
                     <div>
                        <div class="text-h6 font-weight-bold">Subscription Information</div>
                        <div class="text-caption text-grey">View your current plan and billing details</div>
                     </div>
                  </div>

                  <v-list lines="two" class="bg-transparent">
                     <v-list-item>
                        <v-list-item-title class="font-weight-bold">Current Status</v-list-item-title>
                        <v-list-item-subtitle class="text-uppercase text-primary font-weight-black mt-1">{{ auth.user?.Tenant?.status || 'Unknown' }}</v-list-item-subtitle>
                     </v-list-item>
                     <v-divider class="my-2"></v-divider>
                     <v-list-item>
                        <v-list-item-title class="font-weight-bold">Active Package</v-list-item-title>
                        <v-list-item-subtitle class="mt-1">{{ auth.user?.Tenant?.Plan?.name || 'Standard' }}</v-list-item-subtitle>
                     </v-list-item>
                     <v-divider class="my-2"></v-divider>
                     <v-list-item>
                        <v-list-item-title class="font-weight-bold">Billing Cycle</v-list-item-title>
                        <v-list-item-subtitle class="mt-1 text-capitalize">{{ auth.user?.Tenant?.billing_cycle || 'monthly' }}</v-list-item-subtitle>
                     </v-list-item>
                     <v-divider class="my-2"></v-divider>
                     <v-list-item>
                        <v-list-item-title class="font-weight-bold">Subscription Start Date</v-list-item-title>
                        <v-list-item-subtitle class="mt-1">{{ auth.user?.Tenant?.subscription_starts_at ? new Date(auth.user.Tenant.subscription_starts_at).toLocaleDateString() : 'N/A' }}</v-list-item-subtitle>
                     </v-list-item>
                     <v-divider class="my-2"></v-divider>
                     <v-list-item>
                        <v-list-item-title class="font-weight-bold">Subscription Expiry Date</v-list-item-title>
                        <v-list-item-subtitle class="mt-1">{{ auth.user?.Tenant?.subscription_ends_at ? new Date(auth.user.Tenant.subscription_ends_at).toLocaleDateString() : 'N/A' }}</v-list-item-subtitle>
                     </v-list-item>
                     <v-divider class="my-2"></v-divider>
                     <v-list-item>
                        <v-list-item-title class="font-weight-bold">Next Invoice Date</v-list-item-title>
                        <v-list-item-subtitle class="mt-1">{{ auth.user?.Tenant?.next_billing_date ? new Date(auth.user.Tenant.next_billing_date).toLocaleDateString() : 'N/A' }}</v-list-item-subtitle>
                     </v-list-item>
                  </v-list>
               </v-card>
            </v-col>
            <v-col cols="12" md="4">
               <v-card class="soft-card pa-6 rounded-2xl" variant="flat">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Billing Support</h4>
                  <p class="text-body-2 opacity-70 mb-4">
                     For plan upgrades or billing inquiries, please contact our support team.
                  </p>
                  <v-btn color="primary" variant="outlined" block>Contact Support</v-btn>
               </v-card>
            </v-col>
         </v-row>
      </v-window-item>

      <!-- Taxes Management -->
      <v-window-item value="taxes">
        <v-card class="soft-card mb-4">
          <v-card-title class="font-weight-bold px-4 pt-4">Global Tax Configuration</v-card-title>
          <v-card-text>
            <v-row class="align-center mt-2">
              <v-col cols="12" md="4">
                <v-switch
                  v-model="taxGlobalConfig.is_tax_enabled"
                  color="primary"
                  label="Enable Tax System"
                  hide-details
                ></v-switch>
              </v-col>
              <v-col cols="12" md="6" v-if="taxGlobalConfig.is_tax_enabled">
                <v-text-field
                  v-model="taxGlobalConfig.tax_registration_number"
                  label="Tax Registration Number (TRN)"
                  variant="outlined"
                  density="compact"
                  hide-details
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="2" class="text-right">
                <v-btn color="primary" @click="saveGlobalTaxConfig" :loading="savingGlobalTax">Save</v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="soft-card">
          <v-data-table
            :headers="taxHeaders"
            :items="taxes"
            :loading="loadingTaxes"
            hover
          >
            <template v-slot:top>
              <v-toolbar flat color="transparent" class="px-4">
                <v-toolbar-title class="font-weight-bold">Tax Rates</v-toolbar-title>
                <v-spacer></v-spacer>
                <v-btn
                  v-if="auth.can('settings', 'write')"
                  color="primary"
                  prepend-icon="mdi-plus"
                  rounded="lg"
                  variant="flat"
                  @click="openTaxDialog"
                >
                  Add New Tax
                </v-btn>
              </v-toolbar>
            </template>

            <template v-slot:item.rate="{ item }">
              {{ parseFloat(item.rate).toFixed(2) }} %
            </template>

            <template v-slot:item.is_active="{ item }">
              <v-chip :color="item.is_active ? 'success' : 'grey'" size="x-small">
                {{ item.is_active ? 'Active' : 'Inactive' }}
              </v-chip>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn v-if="auth.can('settings', 'write')" icon="mdi-pencil-outline" variant="text" size="small" color="primary" @click="openTaxDialog(item)"></v-btn>
              <v-btn v-if="auth.can('settings', 'delete')" icon="mdi-delete-outline" variant="text" size="small" color="error" @click="confirmDeleteTax(item)"></v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- Voucher Design Settings -->
      <v-window-item value="voucher-design">
              <DocumentTemplates />
      </v-window-item>
    </v-window>

    <!-- Dialog User -->
    <v-dialog v-model="userDialog" max-width="650">
       <v-card v-if="userDialog" class="soft-card pa-4">
          <v-card-title class="text-h5 font-weight-bold">
             {{ edittingUser ? 'Edit System User' : 'Register New User' }}
          </v-card-title>
          <v-card-text class="mt-4">
            <div class="d-flex justify-center mb-6">
              <v-avatar size="100" color="grey-lighten-3" class="cursor-pointer" @click="triggerAvatarUpload" style="border: 2px dashed #ccc;">
                <v-img v-if="avatarPreview" :src="avatarPreview" cover></v-img>
                <v-icon v-else size="40" color="grey">mdi-camera-plus</v-icon>
              </v-avatar>
              <input type="file" ref="avatarInput" accept="image/*" class="d-none" @change="handleAvatarSelect" />
            </div>

            <v-form ref="userForm" v-model="formValid">
              <!-- Login Access Toggle Card -->
              <v-card variant="outlined" class="rounded-xl pa-3 mb-4 bg-slate-50 border" :color="currentUser.can_login ? 'primary' : 'grey-lighten-1'">
                <div class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center">
                    <v-avatar size="36" :color="currentUser.can_login ? 'primary-lighten-5' : 'grey-lighten-3'" class="mr-3 rounded-lg">
                      <v-icon :icon="currentUser.can_login ? 'mdi-shield-key-outline' : 'mdi-shield-off-outline'" :color="currentUser.can_login ? 'primary' : 'grey'"></v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-subtitle-2 font-weight-bold" :class="currentUser.can_login ? 'text-primary' : 'text-grey-darken-2'">
                        {{ currentUser.can_login ? 'System & Portal Login Enabled' : 'No System Login (HR & Documents Only)' }}
                      </div>
                      <div class="text-caption text-grey">
                        {{ currentUser.can_login ? 'Staff can sign into the system with email and password' : 'For staff (driver, helper, field crew) who only need HR & document tracking' }}
                      </div>
                    </div>
                  </div>
                  <v-switch
                    v-model="currentUser.can_login"
                    color="primary"
                    hide-details
                    inset
                    density="compact"
                  ></v-switch>
                </div>
              </v-card>

              <v-text-field v-model="currentUser.name" label="Full Name *" variant="outlined" rounded="lg" :rules="[v => !!v || 'Name is required']" class="mb-4"></v-text-field>

              <v-text-field
                v-model="currentUser.email"
                :label="currentUser.can_login ? 'Email Address (Login Username) *' : 'Email Address (Optional)'"
                variant="outlined"
                rounded="lg"
                :rules="currentUser.can_login ? [v => !!v || 'Email is required for login', v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email format'] : [v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email format']"
                class="mb-4"
              ></v-text-field>

              <v-text-field
                v-if="currentUser.can_login"
                v-model="currentUser.password"
                :label="edittingUser ? 'New Password (Optional)' : 'Temporary Password *'"
                variant="outlined"
                rounded="lg"
                type="password"
                :rules="edittingUser ? [] : [v => !!v || 'Password is required']"
                hint="Leave blank to keep the current password when editing."
                :persistent-hint="edittingUser"
                class="mb-4"
              ></v-text-field>

              <template v-if="currentUser.can_login">
                <v-radio-group v-model="currentUser.user_type" inline class="mb-2" hide-details>
                  <v-radio label="Internal Staff" value="Internal"></v-radio>
                  <v-radio label="Customer User" value="Customer"></v-radio>
                </v-radio-group>

                <v-select
                  v-model="currentUser.role_id"
                  :items="filteredRoles"
                  item-title="name"
                  item-value="id"
                  :label="currentUser.user_type === 'Customer' ? 'Assign Customer Role' : 'Assign Internal Role'"
                  variant="outlined"
                  rounded="lg"
                  :rules="[v => !!v || 'Role assignment is required']"
                  class="mb-4"
                >
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props" :subtitle="item.raw.type === 'CustomerPortal' ? 'Customer Portal' : 'Internal Role'"></v-list-item>
                  </template>
                </v-select>

                <v-autocomplete
                   v-if="isSelectedRoleCustomerPortal"
                   v-model="currentUser.customer_ids"
                   :items="customers"
                   item-title="name"
                   item-value="id"
                   label="Link Customer Profiles"
                   variant="outlined"
                   rounded="lg"
                   multiple
                   chips
                   closable-chips
                   :rules="[v => (v && v.length > 0) || 'At least one Linked Customer is required for Customer Portal user']"
                   class="mb-4"
                 ></v-autocomplete>
              </template>

              <template v-if="currentUser.user_type === 'Internal'">
                <v-row dense class="mb-2">
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="currentUser.phone"
                      label="UAE Contact Number"
                      placeholder="+971 50 123 4567"
                      variant="outlined"
                      rounded="lg"
                      prepend-inner-icon="mdi-phone"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="currentUser.designation"
                      label="Designation / Role Title"
                      placeholder="e.g. Senior Typist, PRO"
                      variant="outlined"
                      rounded="lg"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="4" v-if="auth.isAdmin || auth.can('staff', 'read')">
                    <v-text-field
                      v-model.number="currentUser.basic_salary"
                      :rules="auth.isAdmin || auth.can('staff','write') ? [salaryAmountRule] : []"
                      min="0" step="0.01"
                      @update:model-value="recalcUserSalary"
                      label="Basic Salary (AED)"
                      type="number"
                      variant="outlined"
                      rounded="lg"
                      :readonly="!(auth.isAdmin || auth.can('staff', 'write'))"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="4" v-if="auth.isAdmin || auth.can('staff', 'read')">
                    <v-text-field
                      v-model.number="currentUser.hr_allowance"
                      :rules="auth.isAdmin || auth.can('staff','write') ? [salaryAmountRule] : []"
                      min="0" step="0.01"
                      @update:model-value="recalcUserSalary"
                      label="Housing/HR (AED)"
                      type="number"
                      variant="outlined"
                      rounded="lg"
                      :readonly="!(auth.isAdmin || auth.can('staff', 'write'))"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="4" v-if="auth.isAdmin || auth.can('staff', 'read')">
                    <v-text-field
                      v-model.number="currentUser.other_allowances"
                      :rules="auth.isAdmin || auth.can('staff','write') ? [salaryAmountRule] : []"
                      min="0" step="0.01"
                      @update:model-value="recalcUserSalary"
                      label="Other Allow. (AED)"
                      type="number"
                      variant="outlined"
                      rounded="lg"
                      :readonly="!(auth.isAdmin || auth.can('staff', 'write'))"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" v-if="auth.isAdmin || auth.can('staff', 'read')">
                    <div class="d-flex justify-space-between align-center bg-grey-lighten-4 pa-3 rounded-lg">
                      <span class="text-caption font-weight-bold text-slate-700">Total Monthly Salary</span>
                      <span class="text-subtitle-1 font-weight-black text-primary">AED {{ currentUser.total_salary == null ? '—' : Number(currentUser.total_salary).toFixed(2) }}</span>
                    </div>
                  </v-col>
                </v-row>
                <div v-if="edittingUser && currentUser.id && (auth.isAdmin || auth.can('staff', 'read'))" class="mb-3">
                  <v-btn
                    variant="tonal"
                    color="primary"
                    block
                    rounded="lg"
                    prepend-icon="mdi-card-account-details"
                    :to="`/staff/${currentUser.id}`"
                  >
                    Open Full Staff Profile & Documents
                  </v-btn>
                </div>
              </template>

              <v-switch v-model="currentUser.is_active" label="Account Active Status" color="success" inset></v-switch>
            </v-form>
          </v-card-text>
          <v-card-actions class="pb-4">
             <v-spacer></v-spacer>
             <v-btn variant="text" rounded="lg" @click="userDialog = false">Cancel</v-btn>
             <v-btn color="primary" variant="flat" rounded="lg" class="px-8" :loading="savingUser" @click="saveUser">
                Save Account
             </v-btn>
          </v-card-actions>
       </v-card>
    </v-dialog>

    <!-- Dialog Role -->
    <v-dialog v-model="roleDialog" max-width="400">
        <v-card v-if="roleDialog" class="soft-card pa-4">
           <v-card-title class="text-h5 font-weight-bold">
              {{ editingRole ? 'Edit System Role' : 'New System Role' }}
           </v-card-title>
           <v-card-text class="mt-4">
              <v-text-field
                v-model="newRoleName"
                label="Role Title (e.g. Accountant)"
                variant="outlined"
                rounded="lg"
                class="mb-4"
                @keyup.enter="saveRole"
              ></v-text-field>
              <v-select
                v-model="newRoleType"
                :items="[
                  { title: 'Internal Role', value: 'Internal' },
                  { title: 'Customer Portal', value: 'CustomerPortal' }
                ]"
                item-title="title"
                item-value="value"
                label="User Category"
                variant="outlined"
                rounded="lg"
                hide-details
              ></v-select>
              <DashboardTemplateChoice v-if="newRoleType === 'Internal'" v-model="newRoleTemplateId" class="mt-4" />
           </v-card-text>
           <v-card-actions class="pb-4">
              <v-spacer></v-spacer>
              <v-btn variant="text" rounded="lg" @click="roleDialog = false">Cancel</v-btn>
              <v-btn color="primary" variant="flat" rounded="lg" class="px-8" @click="saveRole">
                 {{ editingRole ? 'Update Role' : 'Create Role' }}
              </v-btn>
           </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Dialog Service Type -->
    <v-dialog v-model="typeDialog" max-width="700px" persistent>
      <ServiceTypeForm
        v-if="typeDialog"
        :service="selectedType"
        :loading="serviceStore.loading"
        @save="saveServiceType"
        @cancel="typeDialog = false"
      />
    </v-dialog>

    <!-- Dialog Document Type -->
    <v-dialog v-model="docTypeDialog" max-width="400">
        <v-card class="soft-card pa-4">
           <v-card-title class="text-h5 font-weight-bold">{{ editingDocType ? 'Edit Document Type' : 'New Document Type' }}</v-card-title>
            <v-card-text class="mt-4">
              <v-text-field v-model="newDocTypeName" label="Type Name (e.g. Work Permit)" variant="outlined" rounded="lg" class="mb-4"></v-text-field>
              <v-select
                v-model="newDocTypeCategory"
                :items="['Company Document', 'Personal Document']"
                label="Document Category"
                variant="outlined"
                rounded="lg"
                hide-details
              ></v-select>
            </v-card-text>
           <v-card-actions class="pb-4">
              <v-spacer></v-spacer>
              <v-btn variant="text" rounded="lg" @click="docTypeDialog = false">Cancel</v-btn>
              <v-btn color="primary" variant="flat" rounded="lg" class="px-8" @click="saveDocType">
                 {{ editingDocType ? 'Update' : 'Create' }}
               </v-btn>
           </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <!-- Dialog Tax -->
    <v-dialog v-model="taxDialog" max-width="400">
      <v-card class="soft-card pa-4">
        <v-card-title class="text-h5 font-weight-bold">
          {{ editingTax ? 'Edit Tax' : 'New Tax' }}
        </v-card-title>
        <v-card-text class="pt-4">
          <v-form ref="taxFormRef" v-model="taxFormValid" @submit.prevent="saveTax">
            <v-text-field
              v-model="taxForm.name"
              label="Tax Name (e.g. VAT 5)"
              variant="outlined"
              :rules="[v => !!v || 'Name is required']"
              required
            ></v-text-field>
            <v-text-field
              v-model="taxForm.rate"
              label="Tax Rate (%)"
              type="number"
              variant="outlined"
              :rules="[v => !!v || 'Rate is required', v => v >= 0 || 'Cannot be negative']"
              required
            ></v-text-field>
            <v-switch
              v-model="taxForm.is_active"
              label="Is Active"
              color="success"
              hide-details
            ></v-switch>
          </v-form>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" color="grey-darken-1" @click="taxDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!taxFormValid" @click="saveTax" class="px-6 rounded-lg">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" rounded="pill">
       {{ snackbarText }}
    </v-snackbar>

    <!-- Email Settings & Templates -->
    <template v-if="activeTab === 'email'">
      <EmailSettings class="mb-6" />
      <EmailTemplates />
    </template>
  </v-container>
</template>

<script setup>
import DashboardTemplateSettings from '~/components/settings/DashboardTemplateSettings.vue';
import ServiceBundleSettings from '~/components/settings/ServiceBundleSettings.vue';
import CommissionMasterSwitch from '~/components/settings/CommissionMasterSwitch.vue';
import DashboardTemplateChoice from '~/components/settings/DashboardTemplateChoice.vue';
import RoleDashboardAssignment from '~/components/settings/RoleDashboardAssignment.vue';
import { businessModules, rulesFor as permissionRulesFor } from '~/utils/recordPermissions';
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import {salaryAmountRule,salaryComponentsTotal} from '~/utils/salaryCalculation.mjs';
import { useAuthStore } from '@/stores/auth';
import { useServiceStore } from '@/stores/services';
import { useConfigStore } from '@/stores/config';
import { useTheme } from 'vuetify';
import { betaThemeDefaults, betaThemeFields, normalizeBetaColors, resolveThemeName, applyWorkspaceTheme } from '~/utils/themes';
import ServiceTypeForm from '@/components/services/ServiceTypeForm.vue';
import DocumentTemplates from '@/components/settings/DocumentTemplates.vue';
import EmailSettings from '@/components/email/EmailSettings.vue';
import EmailTemplates from '@/components/email/EmailTemplates.vue';

const { $api } = useNuxtApp();
const theme = useTheme();

const activeTab = ref('services');

const tabs = [
  { value: 'services', title: 'Services', icon: 'mdi-cog-box' },
  { value: 'service-templates', title: 'Service Templates', icon: 'mdi-playlist-check' },
  { value: 'doc-types', title: 'Doc Types', icon: 'mdi-file-cog' },
  { value: 'users', title: 'Users', icon: 'mdi-account-group' },
  { value: 'roles', title: 'Roles', icon: 'mdi-shield-account' },
  { value: 'dashboard-templates', title: 'Dashboard Templates', icon: 'mdi-view-dashboard-outline' },
  { value: 'general', title: 'General', icon: 'mdi-tune' },
  { value: 'subscription', title: 'Subscription', icon: 'mdi-card-account-details-star-outline' },
  { value: 'taxes', title: 'Taxes', icon: 'mdi-cash-register' },
  { value: 'voucher-design', title: 'Document Templates', icon: 'mdi-file-document-multiple-outline' },
  { value: 'email', title: 'Email', icon: 'mdi-email-cog' }
]
const auth = useAuthStore();
const { formatCurrency } = useCurrency();
const serviceStore = useServiceStore();
const configStore = useConfigStore();
const loading = ref(false);
const users = ref([]);
const roles = ref([]);
const selectedRole = ref(null);

// Dialogs
const userDialog = ref(false);
const roleDialog = ref(false);
const savingUser = ref(false);
const edittingUser = ref(false);
const editingRole = ref(null);
const formValid = ref(false);
const userForm = ref(null);

const currentUser = ref({
  name: '',
  email: '',
  password: '',
  role_id: null,
  user_type: 'Internal',
  is_active: true
});

const avatarInput = ref(null);
const avatarPreview = ref(null);
const avatarBlob = ref(null);

const triggerAvatarUpload = () => {
  avatarInput.value?.click();
};

const handleAvatarSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Compress and crop using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 250; // Target square size

      canvas.width = size;
      canvas.height = size;

      // Calculate crop to center the image
      const scale = Math.max(size / img.width, size / img.height);
      const sw = size / scale;
      const sh = size / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // Draw square centered crop
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

      // Convert to blob
      canvas.toBlob((blob) => {
        avatarBlob.value = blob;
        avatarPreview.value = URL.createObjectURL(blob);
      }, 'image/jpeg', 0.85); // 85% quality JPEG
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

const newRoleName = ref('');
const newRoleTemplateId = ref(null);
const newRoleType = ref('Internal');
const configValid = ref(false);
const savingConfigs = ref(false);

const configs = reactive({
    business_name: 'DocClear Management',
    app_name: '',
    app_logo: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    base_currency: 'AED',
    contact_email: 'support@docclear.com',
    default_language: 'English',
    wallet_deduction_point: 'invoice_creation',
    theme_name: 'sage',
    beta_theme_colors: { ...betaThemeDefaults }
});

const showFrozenThemeNotice = (themeName) => {
    showNotify(`${themeName} theme is currently in Beta and frozen. Ocean Blue is the active system default.`, 'warning');
};

watch(() => [configs.theme_name, configs.beta_theme_colors], ([name, colors]) => {
    applyWorkspaceTheme(theme, name, colors);
}, { deep: true });

onBeforeUnmount(() => {
    applyWorkspaceTheme(theme, configStore.themeName, configStore.betaThemeColors);
});

const resetBetaTheme = () => {
    configs.beta_theme_colors = { ...betaThemeDefaults };
};

const logoFile = ref(null);
const uploadingLogo = ref(false);

const handleLogoUpload = async () => {
    if (!logoFile.value) return;

    uploadingLogo.value = true;
    const formData = new FormData();
    formData.append('logo', logoFile.value);

    try {
        const { data } = await $api.post('/config/upload-logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (data.success) {
            configs.app_logo = data.url;
            // Also notify configStore to update globally if needed
            configStore.fetchSettings();
            showNotify('Logo uploaded successfully', 'success');
        }
    } catch (err) {
        showNotify(err.response?.data?.message || 'Logo upload failed', 'error');
    } finally {
        uploadingLogo.value = false;
        logoFile.value = null; // reset input
    }
};

// Service Catalog State
const searchCatalog = ref('');
const typeDialog = ref(false);
const selectedType = ref(null);
const itemsPerPageCatalog = ref(10);
const currentPageCatalog = ref(1);

const catalogHeaders = [
  { title: 'Service Name', key: 'name', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Sell Price (AED)', key: 'sell_price', align: 'end' },
  { title: 'Cost Price (AED)', key: 'cost_price', align: 'end' },
  { title: 'Profit', key: 'profit', align: 'end', sortable: false },
  { title: 'Status', key: 'is_active', align: 'center', sortable: false },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false },
];

const docTypeHeaders = [
  { title: 'Type Name', key: 'name', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false },
];

const documentTypes = ref([]);
const loadingDocTypes = ref(false);
const docTypeDialog = ref(false);
const newDocTypeName = ref('');
const newDocTypeCategory = ref('Company Document');
const editingDocType = ref(null);

// Taxes State
const taxHeaders = [
  { title: 'Tax Name', key: 'name', sortable: true },
  { title: 'Rate (%)', key: 'rate', sortable: true },
  { title: 'Status', key: 'is_active', sortable: true },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false }
];
const taxes = ref([]);
const loadingTaxes = ref(false);
const taxDialog = ref(false);
const editingTax = ref(null);
const taxFormRef = ref(null);
const taxFormValid = ref(false);
const taxForm = reactive({ name: '', rate: 0, is_active: true });
const taxGlobalConfig = reactive({ is_tax_enabled: false, tax_registration_number: '' });
const savingGlobalTax = ref(false);

// UI Meta
const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const userHeaders = computed(() => {
  const headers = [
    { title: 'Avatar', key: 'avatar', sortable: false },
    { title: 'Full Name', key: 'name', sortable: true },
    { title: 'Email Address', key: 'email', sortable: true },
    { title: 'Login Access', key: 'can_login', sortable: true, align: 'center' },
    { title: 'Assigned Role', key: 'Role', sortable: true },
    { title: 'Linked Customer', key: 'Customer', sortable: true }
  ];

  if (auth.isAdmin || auth.can('staff', 'read')) {
    headers.push({ title: 'Monthly Salary', key: 'total_salary', sortable: true, align: 'end' });
  }

  headers.push(
    { title: 'Account Status', key: 'is_active', sortable: true, align: 'center' },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
  );

  return headers;
});

const systemModules = [
  { id: 'dashboard', name: 'dashboard', icon: 'mdi-view-dashboard' },
  { id: 'leads', name: 'Leads', icon: 'mdi-account-search-outline' },
  { id: 'suppliers', name: 'Purchases & Suppliers', icon: 'mdi-truck-outline' },
  { id: 'tools', name: 'Tools / CVs', icon: 'mdi-tools' },
  { id: 'customers', name: 'customers', icon: 'mdi-account-group' },
  { id: 'documents', name: 'documents', icon: 'mdi-file-eye' },
  { id: 'sales_orders', name: 'Sales Orders', icon: 'mdi-handshake-outline' },
  { id: 'quotations', name: 'Quotations', icon: 'mdi-file-document-edit-outline' },
  { id: 'services', name: 'services', icon: 'mdi-cog' },
  { id: 'employee_tracking', name: 'Employee Tracking', icon: 'mdi-account-clock-outline' },
  { id: 'invoices', name: 'invoices', icon: 'mdi-file-document-outline' },
  { id: 'expenses', name: 'expenses', icon: 'mdi-cash-remove' },
  { id: 'wallet', name: 'wallet', icon: 'mdi-wallet' },
  { id: 'reports', name: 'reports', icon: 'mdi-chart-line' },
  { id: 'settings', name: 'settings', icon: 'mdi-shield-lock' },
  { id: 'financials', name: 'financials', icon: 'mdi-currency-usd' },
  { id: 'management', name: 'management', icon: 'mdi-briefcase-account' },
  { id: 'commissions', name: 'Commissions', icon: 'mdi-percent-circle-outline' },
  { id: 'staff', name: 'Staff (Documents & Salary)', icon: 'mdi-card-account-details-outline' }
];

const customers = ref([]);

const isSelectedRoleCustomerPortal = computed(() => {
  return currentUser.value.user_type === 'Customer';
});

const filteredRoles = computed(() => {
  const targetType = currentUser.value.user_type === 'Customer' ? 'CustomerPortal' : 'Internal';
  return roles.value.filter(r => r.type === targetType);
});

// Watch user_type to reset role_id when switching
watch(() => currentUser.value.user_type, (newType, oldType) => {
  if (newType !== oldType && userDialog.value) {
    currentUser.value.role_id = null;
    if (newType === 'Internal') {
      currentUser.value.customer_ids = [];
    }
  }
});

const fetchCustomersForDropdown = async () => {
  try {
    const res = await $api.get('/customers?limit=1000&is_active=true');
    if (res.data.success) {
      customers.value = res.data.data;
    }
  } catch (err) {
    console.error('Failed to load customers:', err);
  }
};

const filteredSystemModules = computed(() => {
  if (selectedRole.value?.type === 'CustomerPortal') {
    return systemModules.filter(m => m.id === 'documents');
  }
  return systemModules.filter(module => module.id !== 'commissions' || configStore.commissionEnabled);
});

// Fetch Data
const initSettings = async () => {
    loading.value = true;
    try {
        // 1. Fetch Users
        try {
            const uRes = await $api.get('/users');
            if (uRes.data.success) users.value = uRes.data.data;
        } catch (e) {
            console.error('[Settings] Users fetch failed:', e);
            showNotify('Could not load user list.', 'error');
        }

        // 2. Fetch Roles
        try {
            const rRes = await $api.get('/roles');
            if (rRes.data.success) {
                roles.value = rRes.data.data;
                // Auto-select Admin if available
                if (roles.value.length > 0 && !selectedRole.value) {
                    const adminRole = roles.value.find(r => r.name === 'Admin') || roles.value[0];
                    selectRole(adminRole);
                }
            }
        } catch (e) {
            console.error('[Settings] Roles fetch failed:', e);
            showNotify('Could not load role configurations.', 'error');
        }

        // 3. Fetch Configs (Non-blocking)
        try {
            const cRes = await $api.get('/config');
            if (cRes.data.success) {
                Object.assign(configs, cRes.data.data);
                configs.theme_name = resolveThemeName(cRes.data.data.theme_name);
                configs.beta_theme_colors = normalizeBetaColors(cRes.data.data.beta_theme_colors);
                taxGlobalConfig.is_tax_enabled = cRes.data.data.is_tax_enabled === 'true' || cRes.data.data.is_tax_enabled === true;
                taxGlobalConfig.tax_registration_number = cRes.data.data.tax_registration_number || '';
            }
        } catch (e) {
            console.warn('[Settings] Config fetch failed, using defaults:', e);
        }

        // 4. Fetch Document Types
        await fetchDocTypes();

        // 4.5. Fetch Taxes
        await fetchTaxes();

        // 5. Fetch Customers
        await fetchCustomersForDropdown();
    } catch (err) {
        showNotify('General system error occurred while fetching settings.', 'error');
    } finally {
        loading.value = false;
    }
};

const openUserForm = (user = null) => {
    edittingUser.value = !!user;
    avatarPreview.value = null;
    avatarBlob.value = null;

    if (user) {
        const isCustomer = user.Role?.type === 'CustomerPortal';
        currentUser.value = {
            ...user,
            password: '',
            can_login: user.can_login !== undefined ? !!user.can_login : true,
            user_type: isCustomer ? 'Customer' : 'Internal',
            customer_ids: user.LinkedCustomers ? user.LinkedCustomers.map(c => c.id) : [],
            phone: user.phone || '',
            address: user.address || '',
            home_country_address: user.home_country_address || '',
            home_country_contact: user.home_country_contact || '',
            home_country_alternate_contact: user.home_country_alternate_contact || '',
            designation: user.designation || '',
            joining_date: user.joining_date || '',
            basic_salary: parseFloat(user.basic_salary) || 0,
            hr_allowance: parseFloat(user.hr_allowance) || 0,
            other_allowances: parseFloat(user.other_allowances) || 0,
            total_salary: parseFloat(user.total_salary) || 0
        };
        if (user.avatar) {
            avatarPreview.value = $api.defaults.baseURL.replace('/api/v1', '') + user.avatar;
        }
    } else {
        const defaultInternalRole = roles.value.find(r => r.type === 'Internal');
        currentUser.value = {
            name: '',
            email: '',
            password: '',
            can_login: true,
            user_type: 'Internal',
            role_id: defaultInternalRole?.id || null,
            customer_ids: [],
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
        };
    }
    userDialog.value = true;
};

const userSalaryTouched=ref(false);
function recalcUserSalary(){userSalaryTouched.value=true;try{currentUser.value.total_salary=salaryComponentsTotal(currentUser.value);}catch{currentUser.value.total_salary=null;}}
watch(userDialog,open=>{if(open)userSalaryTouched.value=false;});
const saveUser = async () => {
    const { valid } = await userForm.value.validate();
    if (!valid) return;

    savingUser.value = true;
    try {
        if((auth.isAdmin||auth.can('staff','write'))&&(!edittingUser.value||userSalaryTouched.value))currentUser.value.total_salary=salaryComponentsTotal(currentUser.value);
        let userId = currentUser.value.id;

        if (edittingUser.value) {
            await $api.put(`/users/${userId}`, currentUser.value);
            showNotify('User account updated.', 'success');
        } else {
            const res = await $api.post('/users', currentUser.value);
            userId = res.data.data.id;
            showNotify('New user registered successfully.', 'success');
        }

        // Upload avatar if changed
        if (avatarBlob.value && userId) {
            const formData = new FormData();
            formData.append('avatar', avatarBlob.value, 'avatar.jpg');
            await $api.post(`/users/${userId}/avatar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }

        userDialog.value = false;
        initSettings();
    } catch (err) {
        showNotify(err.response?.data?.message || err.message || 'Error saving account.', 'error');
    } finally {
        savingUser.value = false;
    }
};

const confirmDeleteUser = async (user) => {
    if (confirm(`Delete user ${user.name}? This cannot be undone.`)) {
        try {
            await $api.delete(`/users/${user.id}`);
            showNotify('User removed from system.', 'success');
            initSettings();
        } catch (err) {
            showNotify('Failed to delete user.', 'error');
        }
    }
};

const openRoleDialog = (role = null) => {
    // Vue passes MouseEvent if called without parens in template
    if (role instanceof Event) role = null;
    editingRole.value = role;
    newRoleName.value = role ? role.name : '';
    newRoleType.value = role ? role.type : 'Internal';
    newRoleTemplateId.value = role?.dashboard_template_id || null;
    roleDialog.value = true;
};

const saveRole = async () => {
    if (!newRoleName.value) return;
    try {
        if (editingRole.value) {
            await $api.put(`/roles/${editingRole.value.id}`, {
                name: newRoleName.value,
                type: newRoleType.value
            });
            if (newRoleType.value === 'Internal') await $api.put(`/dashboard/templates/role/${editingRole.value.id}`, { dashboard_template_id: newRoleTemplateId.value });
            showNotify('Role renamed.', 'success');
        } else {
            await $api.post('/roles', {
                name: newRoleName.value,
                type: newRoleType.value,
                dashboard_template_id: newRoleType.value === 'Internal' ? newRoleTemplateId.value : null
            });
            showNotify('New role initialized.', 'success');
        }
        roleDialog.value = false;
        initSettings();
    } catch (err) {
        showNotify(err.response?.data?.message || 'Error saving role.', 'error');
    }
};

const confirmDeleteRole = async (role) => {
    if (role.UserCount > 0) {
        showNotify(`Cannot delete "${role.name}" because it has ${role.UserCount} assigned users.`, 'warning');
        return;
    }

    if (confirm(`Are you sure you want to delete the "${role.name}" role? This cannot be undone.`)) {
        try {
            await $api.delete(`/roles/${role.id}`);
            showNotify('Role removed.', 'success');
            initSettings();
        } catch (err) {
            showNotify(err.response?.data?.message || 'Failed to delete role.', 'error');
        }
    }
};

const selectRole = (role) => {
    try {
        // Double Ensure permissions object exists and is fresh
        const roleCopy = JSON.parse(JSON.stringify(role));

        // Safety: Parse string permissions if they come from the API as a string
        if (typeof roleCopy.permissions === 'string') {
            try {
                roleCopy.permissions = JSON.parse(roleCopy.permissions);
            } catch (e) {
                console.error('[Settings] Permission parse failed:', e);
                roleCopy.permissions = {};
            }
        }

        if (!roleCopy.permissions || typeof roleCopy.permissions !== 'object') {
            roleCopy.permissions = {};
        }

        const leadFallback = roleCopy.permissions.leads || roleCopy.permissions.customers;
        systemModules.forEach(mod => {
            const p = ['Admin', 'Developer'].includes(roleCopy.name) ? { read:true, write:true, delete:true } : roleCopy.permissions[mod.id] || (mod.id === 'leads' ? leadFallback : null) || {};
            if (mod.id === 'commissions') {
              const admin = ['Admin', 'Developer'].includes(roleCopy.name);
              roleCopy.permissions[mod.id] = { rules: { list: admin ? 'all' : p.rules?.list || (p.read ? 'own' : 'none') }, read: admin || p.read === true, manage_rules: admin || p.manage_rules === true, pay: admin || p.pay === true };
              return;
            }
            if (mod.id === 'employee_tracking') {
              roleCopy.permissions[mod.id] = { rules: { list: p.rules?.list || (p.read ? 'all' : 'none'), detail:'none', create:false, edit:'none', delete:'none' }, read:p.read === true, write:false, delete:false };
              return;
            }
            roleCopy.permissions[mod.id] = roleCopy.type !== 'CustomerPortal' && businessModules.includes(mod.id)
              ? { ...p, rules: { ...permissionRulesFor(p) } }
              : { read: p.read === true, write: p.write === true, delete: p.delete === true };
        });
        selectedRole.value = roleCopy;
    } catch (err) {
        console.error('[Settings] Role selection failed:', err);
    }
};

const saveRolePermissions = async () => {
    if (!selectedRole.value) return;
    try {
        await $api.put(`/roles/${selectedRole.value.id}`, {
            permissions: selectedRole.value.permissions
        });
        showNotify('Responsibilities updated successfully.', 'success');
        initSettings();
    } catch (err) {
        showNotify('Failed to save permissions.', 'error');
    }
};

const saveConfigs = async () => {
    savingConfigs.value = true;
    try {
        const {commission_enabled, commission_activation, ...generalSettings} = configs;
        const res = await $api.put('/config', generalSettings);
        showNotify(res.data?.message || 'System configuration updated.', 'success');
        await configStore.fetchSettings(); // refresh globally
    } catch (err) {
        showNotify(err.response?.data?.message || err.message || 'Error saving configuration.', 'error');
    } finally {
        savingConfigs.value = false;
    }
};

const showNotify = (text, color) => {
    snackbarText.value = text;
    snackbarColor.value = color;
    snackbar.value = true;
};

// --- SERVICE CATALOG LOGIC ---

const loadCatalog = async ({ page, itemsPerPage: limit }) => {
    currentPageCatalog.value = page;
    itemsPerPageCatalog.value = limit;

    await serviceStore.fetchServiceTypes({
        page,
        limit,
        search: searchCatalog.value || undefined
    });
};

const openTypeForm = (type = null) => {
  selectedType.value = type;
  typeDialog.value = true;
};

const formatSellPrice = (item) => {
  if (!item.ServiceTypePricings || item.ServiceTypePricings.length === 0) return '0.00';
  const p = item.ServiceTypePricings.find(x => x.pricing_type === 'Single') || item.ServiceTypePricings[0];
  return p ? parseFloat(p.selling_price).toFixed(2) : '0.00';
};

const formatProfit = (item) => {
  if (!item.ServiceTypePricings || item.ServiceTypePricings.length === 0) return '0.00';
  if (item.pricing_mode === 'Single') {
    const p = item.ServiceTypePricings.find(x => x.pricing_type === 'Single');
    return p ? parseFloat(p.service_charge).toFixed(2) : '0.00';
  } else {
    // For Multi, we can show a range or just "Variable"
    const charges = item.ServiceTypePricings.map(p => parseFloat(p.service_charge));
    const min = Math.min(...charges);
    const max = Math.max(...charges);
    if (min === max) return min.toFixed(2);
    return `${min.toFixed(2)} - ${max.toFixed(2)}`;
  }
};

const saveServiceType = async (data) => {
  try {
    if (selectedType.value) {
      await serviceStore.updateServiceType(selectedType.value.id, data);
      showNotify('Service updated successfully', 'success');
    } else {
      await serviceStore.createServiceType(data);
      showNotify('New service added to catalog', 'success');
    }
    typeDialog.value = false;
  } catch (err) {
    showNotify(err.message || 'Operation failed', 'error');
  }
};

const toggleTypeStatus = async (type) => {
    try {
        await serviceStore.updateServiceType(type.id, { is_active: type.is_active });
        showNotify(`Service ${type.is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
        showNotify(err.message || 'Failed to toggle status', 'error');
    }
};

const confirmDeleteType = async (type) => {
    if (confirm(`Are you sure you want to delete "${type.name}"?`)) {
        try {
            await serviceStore.deleteServiceType(type.id);
            showNotify('Service type deleted', 'success');
        } catch (err) {
            showNotify('Failed to delete service type', 'error');
        }
    }
};

let searchTimer;
watch(searchCatalog, (val) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadCatalog({ page: 1, itemsPerPage: itemsPerPageCatalog.value });
    }, 400);
});

// --- TAXES LOGIC ---

const fetchTaxes = async () => {
    loadingTaxes.value = true;
    try {
        const res = await $api.get('/taxes');
        if (res.data.success) taxes.value = res.data.data;
    } catch (e) {
        console.error('Failed to fetch taxes', e);
    } finally {
        loadingTaxes.value = false;
    }
};

const saveGlobalTaxConfig = async () => {
    savingGlobalTax.value = true;
    try {
        const res = await $api.put('/config', {
            is_tax_enabled: taxGlobalConfig.is_tax_enabled,
            tax_registration_number: taxGlobalConfig.tax_registration_number
        });
        if (res.data.success) {
            showNotify('Global tax configuration updated', 'success');
            await configStore.fetchSettings();
        }
    } catch (e) {
        console.error('Failed to save global tax config', e);
        showNotify('Failed to save global tax config', 'error');
    } finally {
        savingGlobalTax.value = false;
    }
};

const openTaxDialog = (tax = null) => {
    if (tax instanceof Event) tax = null;
    editingTax.value = tax;
    if (tax) {
        taxForm.name = tax.name;
        taxForm.rate = parseFloat(tax.rate);
        taxForm.is_active = tax.is_active;
    } else {
        taxForm.name = '';
        taxForm.rate = 0;
        taxForm.is_active = true;
    }
    taxDialog.value = true;
};

const saveTax = async () => {
    if (!taxFormValid.value) return;
    try {
        if (editingTax.value) {
            await $api.put(`/taxes/${editingTax.value.id}`, taxForm);
            showNotify('Tax updated successfully', 'success');
        } else {
            await $api.post('/taxes', taxForm);
            showNotify('Tax created successfully', 'success');
        }
        taxDialog.value = false;
        fetchTaxes();
    } catch (e) {
        showNotify(e.response?.data?.message || 'Error saving tax', 'error');
    }
};

const confirmDeleteTax = async (tax) => {
    if (confirm(`Are you sure you want to delete ${tax.name}?`)) {
        try {
            await $api.delete(`/taxes/${tax.id}`);
            showNotify('Tax deleted successfully', 'success');
            fetchTaxes();
        } catch (e) {
            showNotify('Error deleting tax', 'error');
        }
    }
};

// --- DOCUMENT TYPES LOGIC ---

const fetchDocTypes = async () => {
    loadingDocTypes.value = true;
    try {
        const res = await $api.get('/document-types');
        if (res.data.success) documentTypes.value = res.data.data;
    } catch (e) {
        console.error('Failed to fetch doc types', e);
    } finally {
        loadingDocTypes.value = false;
    }
};

const openDocTypeDialog = (type = null) => {
    // Vue passes MouseEvent if called without parens in template
    if (type instanceof Event) type = null;
    editingDocType.value = type;
    newDocTypeName.value = type ? type.name : '';
    newDocTypeCategory.value = type ? type.category : 'Company Document';
    docTypeDialog.value = true;
};

const saveDocType = async () => {
    if (!newDocTypeName.value) return;
    try {
        if (editingDocType.value) {
            await $api.put(`/document-types/${editingDocType.value.id}`, {
                name: newDocTypeName.value,
                category: newDocTypeCategory.value
            });
            showNotify('Document type updated.', 'success');
        } else {
            await $api.post('/document-types', {
                name: newDocTypeName.value,
                category: newDocTypeCategory.value
            });
            showNotify('Document type added.', 'success');
        }
        docTypeDialog.value = false;
        fetchDocTypes();
    } catch (err) {
        showNotify(err.response?.data?.message || 'Failed to save document type.', 'error');
    }
};

const confirmDeleteDocType = async (type) => {
    if (confirm(`Delete document type "${type.name}"? Existing documents with this type will keep their label but it won't be in the dropdown.`)) {
        try {
            await $api.delete(`/document-types/${type.id}`);
            showNotify('Document type removed.', 'success');
            fetchDocTypes();
        } catch (err) {
            showNotify('Failed to delete.', 'error');
        }
    }
};

onMounted(async () => {
    await initSettings();
    await auth.fetchMe();
});
</script>

<style scoped>
/* Keep the role picker compact so permission scopes have room. */
.compact-role-list :deep(.v-list-item) { padding-inline:8px; }
.compact-role-list :deep(.v-list-item__prepend > .v-avatar) { margin-inline-end:8px; }
.compact-role-list :deep(.v-list-item-title) { white-space:normal; overflow-wrap:anywhere; }
.compact-role-list :deep(.v-list-item-subtitle) { white-space:normal; -webkit-line-clamp:unset; font-size:11px; }
.compact-role-list :deep(.v-list-subheader) { padding-inline:12px; font-size:12px; }
@media (min-width:960px) {
  .roles-list-column { flex:0 0 18.4%; max-width:18.4%; min-width:248.4px; }
  .role-permissions-column { flex:1 1 0; max-width:none; min-width:0; }
}

.settings-tabs :deep(.v-tab) {
    text-transform: none;
    font-weight: 700;
    letter-spacing: 0;
}

.border {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

.primary-light {
    background: rgba(var(--v-theme-primary), 0.1);
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
/* ── Theme Picker Cards ── */
.theme-pick-card {
  border-radius: 16px;
  border: 2px solid rgba(226, 232, 240, 0.8);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: #FFFFFF;
  box-shadow: 0 2px 8px -2px rgba(0,0,0,0.06);
}
.theme-pick-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px -6px rgba(0,0,0,0.12);
}
.theme-pick-card--active {
  border-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 8px 24px -6px rgba(59, 130, 246, 0.25) !important;
}

.theme-preview--sage { background: var(--beta-background); }
.theme-preview--sage .tp-sidebar { background: var(--beta-primary); opacity: 0.3; }
.theme-preview--sage .tp-header { background: var(--beta-text); opacity: 0.5; }
.theme-preview--sage .tp-card { background: var(--beta-surface); }
.theme-preview--sage .tp-row { background: var(--beta-primary); opacity: 0.25; }
.theme-pick-card:focus-visible { outline: 3px solid rgb(var(--v-theme-primary)); outline-offset: 3px; }
.beta-theme-editor { padding: 20px; border-radius: 24px; background: rgba(var(--v-theme-primary), 0.04); }
.beta-color-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; }
.beta-color-field { display: grid; gap: 8px; }
.beta-color-field input { width: 36px; height: 36px; border: none; padding: 0; background: transparent; cursor: pointer; }
.beta-color-field code { font-size: 11px; }

.theme-pick-card--disabled {
  opacity: 0.65;
  cursor: not-allowed !important;
  position: relative;
  filter: grayscale(15%);
}
.theme-pick-card--disabled:hover {
  transform: none !important;
  box-shadow: 0 2px 8px -2px rgba(0,0,0,0.06) !important;
}

.theme-freeze-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  color: #F8FAFC;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

/* Mini browser preview container */
.theme-preview {
  height: 90px;
  display: flex;
  gap: 6px;
  padding: 8px;
  border-radius: 0;
}

/* Sidebar strip */
.tp-sidebar {
  width: 22px;
  border-radius: 6px;
  flex-shrink: 0;
}

.tp-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tp-header {
  height: 10px;
  border-radius: 4px;
  width: 70%;
}

.tp-cards {
  display: flex;
  gap: 4px;
}
.tp-card {
  flex: 1;
  height: 20px;
  border-radius: 5px;
}

.tp-row {
  height: 7px;
  border-radius: 4px;
  width: 100%;
}
.tp-row--short {
  width: 60%;
}

/* ── Default (Blue) Preview ── */
.theme-preview--light {
  background: linear-gradient(135deg, rgba(255,235,218,1) 0%, rgba(238,230,255,1) 60%, rgba(224,242,254,1) 100%);
}
.theme-preview--light .tp-sidebar   { background: rgba(59,130,246,0.25); }
.theme-preview--light .tp-header    { background: rgba(43,54,116,0.5); }
.theme-preview--light .tp-card      { background: rgba(255,255,255,0.7); }
.theme-preview--light .tp-row       { background: rgba(59,130,246,0.2); }

/* ── White (Monochrome) Preview ── */
.theme-preview--white {
  background: #F3F4F6;
}
.theme-preview--white .tp-sidebar   { background: rgba(17,24,39,0.10); }
.theme-preview--white .tp-header    { background: rgba(17,24,39,0.30); }
.theme-preview--white .tp-card      { background: #FFFFFF; border: 1px solid rgba(17,24,39,0.07); }
.theme-preview--white .tp-row       { background: rgba(17,24,39,0.12); }

/* ── Classic (Violet) Preview ── */
.theme-preview--classic {
  background: #FFFFFF;
}
.theme-preview--classic .tp-sidebar { background: rgba(79,66,148,0.18); }
.theme-preview--classic .tp-header  { background: rgba(79,66,148,0.45); }
.theme-preview--classic .tp-card    { background: #FFFFFF; border: 1px solid rgba(79,66,148,0.12); }
.theme-preview--classic .tp-row     { background: rgba(79,66,148,0.15); }

.theme-pick-label {
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(226,232,240,0.6);
}
.theme-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  opacity: 0.5;
}

/* Scoped avatar gradient adjustments for classic mode */
.v-theme--classic .glass-icon-primary {
  background: linear-gradient(135deg, #6554C0 0%, #4F4294 100%) !important;
  box-shadow: 0 4px 15px rgba(79, 66, 148, 0.35) !important;
}
</style>
