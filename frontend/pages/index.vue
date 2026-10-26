<template>
  <v-container fluid :class="configStore.themeName === 'sage' ? 'pa-0' : 'standard-dashboard pa-2 pa-md-4'">
    <!-- Registration check -->
    <template v-if="authStore.user?.Tenant?.status === 'new_registration'">
      <v-row class="fill-height align-center justify-center" style="min-height: 70vh;">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <v-card class="glass-card-3d glass-card-3d-purple pa-12" variant="flat">
            <DashboardIcon icon="mdi-account-clock" size="80" color="info" class="mb-6"></DashboardIcon>
            <h1 class="text-h3 font-weight-black text-info mb-4">Account Approval Pending</h1>
            <p class="text-h6 text-secondary font-weight-medium mb-6">
              Your registration has been received successfully. Our team will review and approve your account shortly.
            </p>
            <v-btn class="btn-3d px-8" size="x-large" @click="authStore.fetchMe()">
              Refresh Status
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </template>
    
    <v-progress-linear v-else-if="layoutLoading" indeterminate color="primary" />
    <v-alert v-else-if="layoutError" type="error" variant="tonal" class="ma-6">{{ layoutError }}<v-btn variant="text" @click="loadDashboard">Retry</v-btn></v-alert>
    <TemplateDashboard v-else-if="roleLayout?.template" :initial="roleLayout" />
    <SageDashboard v-else-if="configStore.themeName === 'sage'" />
    <template v-else>
      <v-row>
        <!-- LEFT COLUMN (cols 12, lg 9) -->
        <v-col cols="12" lg="9">
          <!-- Header -->
          <div class="d-flex align-center justify-space-between mb-3">
            <h1 class="text-h4 font-weight-black text-blue-grey-darken-4">Home</h1>
            <div class="glass-card-3d rounded-pill px-1 py-1 d-flex shadow-sm">
              <v-btn 
                :variant="selectedPeriod === 'yearly' ? 'flat' : 'text'" 
                :class="selectedPeriod === 'yearly' ? 'btn-3d' : 'text-blue-grey-darken-1'"
                size="small" 
                class="rounded-pill px-4 text-none font-weight-light"
                @click="changePeriod('yearly')"
              >Yearly</v-btn>
              <v-btn 
                :variant="selectedPeriod === 'monthly' ? 'flat' : 'text'" 
                :class="selectedPeriod === 'monthly' ? 'btn-3d' : 'text-blue-grey-darken-1'"
                size="small" 
                class="rounded-pill px-4 text-none font-weight-light"
                @click="changePeriod('monthly')"
              >Monthly</v-btn>
              <v-btn 
                :variant="selectedPeriod === 'today' ? 'flat' : 'text'" 
                :class="selectedPeriod === 'today' ? 'btn-3d' : 'text-blue-grey-darken-1'"
                size="small" 
                class="rounded-pill px-4 text-none font-weight-light"
                @click="changePeriod('today')"
              >Today</v-btn>
            </div>
          </div>
          
          <!-- Top Row Stats -->
          <v-row class="mb-3" align="stretch" dense>
            <!-- Total Invoices -->
            <v-col cols="12" md="4">
              <v-card class="glass-card-3d glass-card-3d-purple pa-4 d-flex flex-column h-100" variant="flat" :to="authStore.can('reports') && authStore.can('invoices') ? dashboardReportLink('invoice', selectedPeriod) : undefined">
                <div class="text-subtitle-1 font-weight-light text-blue-grey-darken-3 mb-1">{{ periodLabel }} Revenue</div>
                <div class="text-h4 font-weight-black text-blue-grey-darken-4 mb-4">
                  <span class="text-h6 text-blue-grey-lighten-1 mr-1">AED</span>{{ Number(dashboardStore.stats?.monthly_receivable || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                </div>
                
                <div class="mb-4">
                  <div class="d-flex justify-space-between text-caption font-weight-light mb-1">
                    <span class="text-blue-grey-darken-4">Invoice Paid</span>
                    <span>AED {{ Number(dashboardStore.stats?.monthly_revenue || 0).toLocaleString() }}</span>
                  </div>
                  <v-progress-linear :model-value="revenuePaidPct" bg-color="#E7ECE9" :bg-opacity="1" color="#3B82F6" height="8" rounded></v-progress-linear>
                  <div class="text-caption font-weight-light mt-1 text-blue-grey-darken-1">{{ revenuePaidPct }}%</div>
                </div>
                
                <div class="mt-auto">
                  <div class="d-flex justify-space-between text-caption font-weight-light mb-1">
                    <span class="text-blue-grey-darken-4">Total Receivable</span>
                    <span>AED {{ Math.max(0, Number(dashboardStore.stats?.monthly_receivable || 0) - Number(dashboardStore.stats?.monthly_revenue || 0)).toLocaleString() }}</span>
                  </div>
                  <v-progress-linear :model-value="revenuePendingPct" bg-color="#E7ECE9" :bg-opacity="1" color="#8B5CF6" height="8" rounded></v-progress-linear>
                  <div class="text-caption font-weight-light mt-1 text-blue-grey-darken-1">{{ revenuePendingPct }}%</div>
                </div>
              </v-card>
            </v-col>
            
            <!-- Grid of 6 KPIs -->
            <v-col cols="12" md="4">
              <v-row dense class="fill-height">
                <v-col cols="4">
                  <v-card class="glass-card-3d glass-card-3d-blue pa-2 text-center h-100 d-flex flex-column justify-center align-center" variant="flat">
                    <v-avatar color="rgba(59, 130, 246, 0.15)" size="32" class="mb-2"><DashboardIcon icon="mdi-account-group" color="#3B82F6" size="16"></DashboardIcon></v-avatar>
                    <div class="text-caption font-weight-light text-blue-grey-darken-2 mb-1" style="line-height: 1.1">Total Clients</div>
                    <div class="text-h5 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.total_customers || 0 }}</div>
                  </v-card>
                </v-col>
                <v-col cols="4">
                  <v-card class="glass-card-3d glass-card-3d-green pa-2 text-center h-100 d-flex flex-column justify-center align-center" variant="flat">
                    <v-avatar color="rgba(34, 197, 94, 0.15)" size="32" class="mb-2"><DashboardIcon icon="mdi-file-document-outline" color="#22C55E" size="16"></DashboardIcon></v-avatar>
                    <div class="text-caption font-weight-light text-blue-grey-darken-2 mb-1" style="line-height: 1.1">Active Documents</div>
                    <div class="text-h5 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.active_documents || 0 }}</div>
                  </v-card>
                </v-col>
                <v-col cols="4">
                  <v-card class="glass-card-3d glass-card-3d-orange pa-2 text-center h-100 d-flex flex-column justify-center align-center" variant="flat">
                    <v-avatar color="rgba(249, 115, 22, 0.15)" size="32" class="mb-2"><DashboardIcon icon="mdi-clock-alert-outline" color="#F97316" size="16"></DashboardIcon></v-avatar>
                    <div class="text-caption font-weight-light text-blue-grey-darken-2 mb-1" style="line-height: 1.1">Expiring Soon (30d)</div>
                    <div class="text-h5 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.expiring_soon || 0 }}</div>
                  </v-card>
                </v-col>
                <v-col cols="4">
                  <v-card class="glass-card-3d glass-card-3d-purple pa-2 text-center h-100 d-flex flex-column justify-center align-center" variant="flat">
                    <v-avatar color="rgba(139, 92, 246, 0.15)" size="32" class="mb-2"><DashboardIcon icon="mdi-alert-octagon-outline" color="#8B5CF6" size="16"></DashboardIcon></v-avatar>
                    <div class="text-caption font-weight-light text-blue-grey-darken-2 mb-1" style="line-height: 1.1">Critical Docs (7d)</div>
                    <div class="text-h5 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.critical_count || 0 }}</div>
                  </v-card>
                </v-col>
                <v-col cols="4">
                  <v-card class="glass-card-3d glass-card-3d-red pa-2 text-center h-100 d-flex flex-column justify-center align-center" variant="flat">
                    <v-avatar color="rgba(239, 68, 68, 0.15)" size="32" class="mb-2"><DashboardIcon icon="mdi-run" color="#EF4444" size="16"></DashboardIcon></v-avatar>
                    <div class="text-caption font-weight-light text-blue-grey-darken-2 mb-1" style="line-height: 1.1">Active Service Orders</div>
                    <div class="text-h5 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.active_service_orders || 0 }}</div>
                  </v-card>
                </v-col>
                <v-col cols="4">
                  <v-card class="glass-card-3d glass-card-3d-grey pa-2 text-center h-100 d-flex flex-column justify-center align-center" variant="flat" :to="authStore.can('reports') ? '/reports?report=invoice&aging=30' : undefined">
                    <v-avatar color="rgba(148, 163, 184, 0.15)" size="32" class="mb-2"><DashboardIcon icon="mdi-file-clock-outline" color="#64748B" size="16"></DashboardIcon></v-avatar>
                    <div class="text-caption font-weight-light text-blue-grey-darken-2 mb-1" style="line-height: 1.1">Invoices (30+ days)</div>
                    <div class="text-h5 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.aged_invoices || 0 }}</div>
                  </v-card>
                </v-col>
              </v-row>
            </v-col>
            
            <!-- Service Charge -->
            <v-col cols="12" md="4">
              <v-card class="glass-card-3d glass-card-3d-green pa-4 d-flex flex-column h-100" variant="flat" :to="authStore.can('reports') ? dashboardReportLink('profit', selectedPeriod) : undefined">
                <div class="text-subtitle-1 font-weight-light text-blue-grey-darken-3 mb-1">Net Profit</div>
                <div class="text-h4 font-weight-black text-blue-grey-darken-4 mb-4">
                  <span class="text-h6 text-blue-grey-lighten-1 mr-1">AED</span>{{ Number(dashboardStore.stats?.monthly_profit || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                </div>
                
                <div class="mb-4">
                  <div class="d-flex justify-space-between text-caption font-weight-light mb-1">
                    <span class="text-blue-grey-darken-4">Service charges created</span>
                    <span>AED {{ Number(dashboardStore.stats?.monthly_service_charges || 0).toLocaleString() }}</span>
                  </div>
                  <v-progress-linear :model-value="serviceChargePct" bg-color="#E7ECE9" :bg-opacity="1" color="#3B82F6" height="8" rounded></v-progress-linear> 
                  <div class="text-caption font-weight-light mt-1 text-blue-grey-darken-1">{{ serviceChargePct }}%</div>
                </div>
                
                <div class="mt-auto">
                  <div class="d-flex justify-space-between text-caption font-weight-light mb-1">
                    <span class="text-blue-grey-darken-4">Total expenses</span>
                    <span>AED {{ Number(dashboardStore.stats?.monthly_expenses || 0).toLocaleString() }}</span>
                  </div>
                  <v-progress-linear :model-value="Math.min(costPct, 100)" bg-color="#E7ECE9" :bg-opacity="1" color="#EF4444" height="8" rounded></v-progress-linear>
                  <div class="text-caption font-weight-light mt-1 text-blue-grey-darken-1">{{ costPct }}%</div>
                </div>
              </v-card>
            </v-col>
          </v-row>
          
          <!-- Service Status Overview -->
          <div class="d-flex align-center justify-space-between mb-2 mt-4">
            <h2 class="text-h6 font-weight-regular text-blue-grey-darken-4">Service Status Overview</h2>
            <v-btn variant="outlined" size="small" class="rounded-pill text-none px-4 text-blue-grey-darken-1 font-weight-light glass-card-3d">View all services</v-btn>
          </div>
          
          <v-row class="mb-3" dense>
            <v-col cols="12" sm="5ths" class="flex-grow-1" style="max-width: 20%; flex-basis: 20%;">
              <v-card class="glass-card-3d glass-card-3d-orange pa-4 text-center" variant="flat">
                 <v-avatar color="rgba(249, 115, 22, 0.15)" size="36" class="mb-3"><DashboardIcon icon="mdi-clock-outline" color="#F97316" size="20"></DashboardIcon></v-avatar>
                 <div class="text-caption font-weight-light text-blue-grey-darken-2">Pending</div>
                 <div class="text-h4 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.service_overview?.Pending || 0 }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" sm="5ths" class="flex-grow-1" style="max-width: 20%; flex-basis: 20%;">
              <v-card class="glass-card-3d glass-card-3d-blue pa-4 text-center" variant="flat">
                 <v-avatar color="rgba(59, 130, 246, 0.15)" size="36" class="mb-3"><DashboardIcon icon="mdi-progress-clock" color="#3B82F6" size="20"></DashboardIcon></v-avatar>
                 <div class="text-caption font-weight-light text-blue-grey-darken-2">In Progress</div>
                 <div class="text-h4 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.service_overview?.['In Progress'] || 0 }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" sm="5ths" class="flex-grow-1" style="max-width: 20%; flex-basis: 20%;">
              <v-card class="glass-card-3d glass-card-3d-purple pa-4 text-center" variant="flat">
                 <v-avatar color="rgba(139, 92, 246, 0.15)" size="36" class="mb-3"><DashboardIcon icon="mdi-file-clock-outline" color="#8B5CF6" size="20"></DashboardIcon></v-avatar>
                 <div class="text-caption font-weight-light text-blue-grey-darken-2">Invoice Pending</div>
                 <div class="text-h4 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.service_overview?.CompletedInvoicePending || 0 }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" sm="5ths" class="flex-grow-1" style="max-width: 20%; flex-basis: 20%;">
              <v-card class="glass-card-3d glass-card-3d-green pa-4 text-center" variant="flat">
                 <v-avatar color="rgba(34, 197, 94, 0.15)" size="36" class="mb-3"><DashboardIcon icon="mdi-check-circle-outline" color="#22C55E" size="20"></DashboardIcon></v-avatar>
                 <div class="text-caption font-weight-light text-blue-grey-darken-2">Invoice Created</div>
                 <div class="text-h4 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.service_overview?.CompletedInvoiceCreated || 0 }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" sm="5ths" class="flex-grow-1" style="max-width: 20%; flex-basis: 20%;">
              <v-card class="glass-card-3d glass-card-3d-red pa-4 text-center" variant="flat">
                 <v-avatar color="rgba(239, 68, 68, 0.15)" size="36" class="mb-3"><DashboardIcon icon="mdi-close-circle-outline" color="#EF4444" size="20"></DashboardIcon></v-avatar>
                 <div class="text-caption font-weight-light text-blue-grey-darken-2">Cancelled</div>
                 <div class="text-h4 font-weight-black text-blue-grey-darken-4">{{ dashboardStore.stats?.service_overview?.Cancelled || 0 }}</div>
              </v-card>
            </v-col>
          </v-row>
          
          <!-- Bottom Row: Recent Services & Wallet -->
          <v-row dense>
            <!-- Recent Services -->
            <v-col cols="12" md="6">
              <v-card class="glass-card-3d glass-card-3d-green pa-4" variant="flat" style="min-height: 250px;">
                <div class="d-flex align-center mb-3">
                  <v-avatar color="rgba(34, 197, 94, 0.15)" size="32" class="mr-2"><DashboardIcon icon="mdi-cog" color="#22C55E" size="18"></DashboardIcon></v-avatar>
                  <h2 class="text-h6 font-weight-regular text-blue-grey-darken-4 mb-0">Recent Services</h2>
                </div>
                <div class="text-subtitle-2 font-weight-light text-blue-grey-darken-2 mb-1">Active Delivery Orders</div>
                <div class="text-h4 font-weight-black mb-4 text-blue-grey-darken-4">{{ dashboardStore.stats?.active_service_orders || 0 }} <span class="text-subtitle-2 font-weight-light">running</span></div>
                
                <v-list class="bg-transparent pa-0">
                  <template v-if="dashboardStore.recentActivity?.recent_services?.length">
                    <v-list-item v-for="service in dashboardStore.recentActivity.recent_services" :key="service.id" class="px-0 mb-2">
                      <template v-slot:prepend><div class="rounded-circle mr-3" :class="service.status === 'Pending' ? 'bg-red' : 'bg-orange'" style="width: 8px; height: 8px; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);"></div></template>
                      <v-list-item-title class="text-caption font-weight-light">{{ service.Customer?.name || 'Unknown' }} <span class="text-blue-grey-lighten-2 mx-1">•</span> {{ service.ServiceType?.name || 'Service' }}</v-list-item-title>
                      <template v-slot:append><span class="text-caption font-weight-light" :class="service.status === 'Pending' ? 'text-red' : 'text-orange'">{{ service.status }}</span></template>
                    </v-list-item>
                  </template>
                  <template v-else>
                    <div class="text-center text-caption text-blue-grey mt-6">No recent active services</div>
                  </template>
                </v-list>
              </v-card>
            </v-col>
            
            <!-- Wallet Balances -->
            <v-col cols="12" md="6">
              <v-card class="glass-card-3d glass-card-3d-blue pa-4" variant="flat" style="min-height: 250px;">
                <div class="d-flex align-center mb-3">
                  <v-avatar color="rgba(59, 130, 246, 0.15)" size="32" class="mr-2"><DashboardIcon icon="mdi-wallet" color="#3B82F6" size="18"></DashboardIcon></v-avatar>
                  <h2 class="text-h6 font-weight-regular text-blue-grey-darken-4 mb-0">Wallet Balances</h2>
                </div>
                <div class="text-subtitle-2 font-weight-light text-blue-grey-darken-2 mb-1">Grand Total Liquidity</div>
                <div class="text-h4 font-weight-black text-blue-grey-darken-4 mb-6">
                  <span class="text-h6 text-blue-grey-lighten-1 mr-1">AED</span>{{ Number(dashboardStore.stats?.wallet_balances?.reduce((sum, w) => sum + parseFloat(w.balance || 0), 0) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                </div>
                
                <v-list class="bg-transparent pa-0" v-if="dashboardStore.stats?.wallet_balances?.length">
                  <v-list-item v-for="(wallet, index) in dashboardStore.stats.wallet_balances.slice(0,4)" :key="wallet.id" class="px-0 py-2">
                    <template v-slot:prepend>
                      <v-avatar size="28" class="mr-3 rounded" v-if="getBankLogo(wallet.name)">
                        <v-img :src="getBankLogo(wallet.name)"></v-img>
                      </v-avatar>
                      <v-avatar size="28" class="mr-3 rounded" :class="['bg-blue-grey-darken-4', 'bg-blue', 'bg-orange', 'bg-teal'][index % 4]" style="box-shadow: inset 0 2px 4px rgba(255,255,255,0.4);" v-else>
                        <span class="text-caption text-white font-weight-regular">{{ wallet.name.substring(0, 4).toUpperCase() }}</span>
                      </v-avatar>
                    </template>
                    <v-list-item-title class="text-caption font-weight-light">{{ wallet.name }}</v-list-item-title>
                    <template v-slot:append>
                      <span class="text-caption font-weight-regular text-blue-grey-darken-3">{{ wallet.currency }} {{ Number(wallet.balance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</span>
                    </template>
                  </v-list-item>
                </v-list>
                <div v-else class="text-center text-caption text-blue-grey mt-6">No wallets found</div>
              </v-card>
            </v-col>
          </v-row>
        </v-col>
        
        <!-- RIGHT SIDEBAR (cols 12, lg 3) -->
        <v-col cols="12" lg="3">
          <!-- Calendar Widget -->
          <v-card class="glass-card-3d glass-card-3d-grey pa-4 mb-4" variant="flat">
             <div class="d-flex align-center justify-space-between mb-3">
                <div class="d-flex align-center">
                  <DashboardIcon icon="mdi-calendar" color="#8B5CF6" class="mr-2" size="24"></DashboardIcon>
                  <span class="text-subtitle-1 font-weight-regular text-blue-grey-darken-4">{{ dayjs().format('MMMM YYYY') }}</span>
                </div>
             </div>
             <!-- A dynamic representation of the calendar -->
             <v-table density="compact" class="text-center calendar-table bg-transparent">
               <thead>
                 <tr>
                   <th class="text-center text-caption font-weight-bold px-0 text-blue-grey-darken-4">Sun</th>
                   <th class="text-center text-caption font-weight-bold px-0 text-blue-grey-darken-4">Mon</th>
                   <th class="text-center text-caption font-weight-bold px-0 text-blue-grey-darken-4">Tue</th>
                   <th class="text-center text-caption font-weight-bold px-0 text-blue-grey-darken-4">Wed</th>
                   <th class="text-center text-caption font-weight-bold px-0 text-blue-grey-darken-4">Thu</th>
                   <th class="text-center text-caption font-weight-bold px-0 text-blue-grey-darken-4">Fri</th>
                   <th class="text-center text-caption font-weight-bold px-0 text-blue-grey-darken-4">Sat</th>
                 </tr>
               </thead>
               <tbody>
                 <tr v-for="(week, index) in calendarDays" :key="index">
                   <td v-for="(day, idx) in week" :key="idx">
                     <div v-if="day.day" class="cal-circle" :class="{'cal-outline-red': day.status === 'red', 'cal-outline-orange': day.status === 'orange'}">
                       {{ String(day.day).padStart(2, '0') }}
                     </div>
                   </td>
                 </tr>
               </tbody>
             </v-table>
          </v-card>
          
          <!-- Critical Expiries -->
          <h3 class="text-h6 font-weight-regular text-blue-grey-darken-4 mb-2">Critical Expiries</h3>
          <v-card class="glass-card-3d glass-card-3d-red pa-4" variant="flat">
            <div class="text-subtitle-2 font-weight-light text-blue-grey-darken-2 mb-1">Active Document Alerts</div>
            <div class="text-h3 font-weight-black mb-4 text-blue-grey-darken-4">{{ dashboardStore.stats?.critical_count || 0 }} <span class="text-subtitle-2 font-weight-light">critical</span></div>
            
            <v-list class="bg-transparent pa-0">
               <template v-if="dashboardStore.recentActivity?.expiring_documents?.length">
                  <v-list-item v-for="doc in dashboardStore.recentActivity.expiring_documents.slice(0,10)" :key="doc.id" class="px-0 py-1">
                    <template v-slot:prepend><div class="rounded-circle mr-3" :class="doc.days_remaining <= 7 ? 'bg-red' : 'bg-orange'" style="width: 8px; height: 8px; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);"></div></template>
                    <v-list-item-title class="text-caption font-weight-light text-truncate" style="max-width: 140px;">
                      {{ doc.Customer?.name || 'Unknown' }} <span class="text-blue-grey-lighten-2 mx-1">•</span> {{ doc.DocumentType?.name || 'Document' }}
                    </v-list-item-title>
                    <template v-slot:append>
                       <span class="text-caption font-weight-light" :class="doc.days_remaining <= 7 ? 'text-red' : 'text-orange'">
                         {{ doc.days_remaining < 0 ? Math.abs(doc.days_remaining) + ' Days Overdue' : (doc.days_remaining === 0 ? 'TODAY' : 'In ' + doc.days_remaining + ' Days') }}
                       </span>
                    </template>
                  </v-list-item>
               </template>
               <template v-else>
                  <v-list-item class="px-0 py-1">
                    <template v-slot:prepend><div class="rounded-circle bg-red mr-3" style="width: 8px; height: 8px; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);"></div></template>
                    <v-list-item-title class="text-caption font-weight-light text-truncate" style="max-width: 140px;">mazaya <span class="text-blue-grey-lighten-2 mx-1">•</span> EmiratesID</v-list-item-title>
                    <template v-slot:append><span class="text-caption font-weight-light text-red">5 Days Overdue</span></template>
                  </v-list-item>
                  <v-list-item class="px-0 py-1">
                    <template v-slot:prepend><div class="rounded-circle bg-red mr-3" style="width: 8px; height: 8px; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);"></div></template>
                    <v-list-item-title class="text-caption font-weight-light text-truncate" style="max-width: 140px;">mazaya <span class="text-blue-grey-lighten-2 mx-1">•</span> EmiratesID</v-list-item-title>
                    <template v-slot:append><span class="text-caption font-weight-light text-red">3 Days Overdue</span></template>
                  </v-list-item>
                  <v-list-item class="px-0 py-1">
                    <template v-slot:prepend><div class="rounded-circle bg-orange mr-3" style="width: 8px; height: 8px; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);"></div></template>
                    <v-list-item-title class="text-caption font-weight-light text-truncate" style="max-width: 140px;">mazaya <span class="text-blue-grey-lighten-2 mx-1">•</span> TradeLicense</v-list-item-title>
                    <template v-slot:append><span class="text-caption font-weight-light text-orange">In 2 Days</span></template>
                  </v-list-item>
                  <v-list-item class="px-0 py-1">
                    <template v-slot:prepend><div class="rounded-circle bg-orange mr-3" style="width: 8px; height: 8px; box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);"></div></template>
                    <v-list-item-title class="text-caption font-weight-light text-truncate" style="max-width: 140px;">mazaya <span class="text-blue-grey-lighten-2 mx-1">•</span> TradeLicense</v-list-item-title>
                    <template v-slot:append><span class="text-caption font-weight-light text-orange">In 5 Days</span></template>
                  </v-list-item>
               </template>
            </v-list>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup>
import DashboardIcon from '~/components/dashboard/DashboardIcon.vue';
import { dashboardReportLink } from '~/utils/dashboardReports';
import SageDashboard from '~/components/dashboard/SageDashboard.vue';
import TemplateDashboard from '~/components/dashboard/TemplateDashboard.vue';
import { useConfigStore } from '~/stores/config';
const configStore = useConfigStore();
import { onMounted, computed, ref } from 'vue';
import { useDashboardStore } from '~/stores/dashboard';
import { useAuthStore } from '~/stores/auth';
import { getBankLogo } from '~/utils/banks';
import dayjs from 'dayjs';

const dashboardStore = useDashboardStore();
const authStore = useAuthStore();
const { $api } = useNuxtApp();
const roleLayout=ref(null),layoutLoading=ref(true),layoutError=ref('');
async function loadDashboard(){
  layoutLoading.value=true;layoutError.value='';
  try {
    if (!authStore.can('dashboard')) { roleLayout.value={template:{name:'Home',description:'Dashboard access is disabled for your role.'},widgets:[]}; return; }
    roleLayout.value=(await $api.get('/dashboard/layout')).data.data;
    if(!roleLayout.value.template)await Promise.all([dashboardStore.fetchStats({period:'monthly'}),dashboardStore.fetchRecentActivity()]);
  }catch(e){layoutError.value=e.response?.data?.message || 'Unable to load dashboard.';}
  finally{layoutLoading.value=false;}
}

const selectedPeriod = ref('monthly');
const periodLabel = computed(() => {
  if (selectedPeriod.value === 'yearly') return 'Yearly';
  if (selectedPeriod.value === 'today') return "Today's";
  return 'Monthly';
});

const changePeriod = async (period) => {
  selectedPeriod.value = period;
  await dashboardStore.fetchStats({ period });
};

const serviceChargePct = computed(() => {
  const revenue = dashboardStore.stats?.monthly_service_charges || 0;
  return revenue > 0 ? 100 : 0;
});

const revenuePaidPct = computed(() => {
  const paid = dashboardStore.stats?.monthly_revenue || 0;
  const total = dashboardStore.stats?.monthly_receivable || 0;
  return total > 0 ? Math.round((paid / total) * 100) : 0;
});

const revenuePendingPct = computed(() => {
  const paid = dashboardStore.stats?.monthly_revenue || 0;
  const total = dashboardStore.stats?.monthly_receivable || 0;
  const pending = total - paid;
  return total > 0 ? Math.round((pending / total) * 100) : 0;
});

const costPct = computed(() => {
  const cost = dashboardStore.stats?.monthly_expenses || 0;
  const revenue = dashboardStore.stats?.monthly_service_charges || 0;
  return revenue > 0 ? Math.round((cost / revenue) * 100) : (cost > 0 ? 100 : 0);
});

const profitPct = computed(() => {
  const profit = dashboardStore.stats?.monthly_profit || 0;
  const revenue = dashboardStore.stats?.monthly_service_charges || 0;
  return revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
});

const calendarDays = computed(() => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const weeks = [];
  let currentWeek = [];
  
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push({ day: '', status: null });
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let status = null;
    
    const docsOnDay = dashboardStore.recentActivity?.expiring_documents?.filter(doc => {
      if (!doc.expiry_date) return false;
      return doc.expiry_date.startsWith(dateStr);
    });
    
    if (docsOnDay && docsOnDay.length > 0) {
      const hasCritical = docsOnDay.some(doc => doc.days_remaining <= 7);
      status = hasCritical ? 'red' : 'orange';
    }
    
    currentWeek.push({ day: d, status });
    
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ day: '', status: null });
    }
    weeks.push(currentWeek);
  }
  
  return weeks;
});

onMounted(loadDashboard);
</script>

<style scoped>
/* Subtract one physical pixel from the existing Vuetify typography tokens. */
.standard-dashboard :deep(.text-h3) { font-size: calc(3rem - 1px) !important; }
.standard-dashboard :deep(.text-h4) { font-size: calc(2.125rem - 1px) !important; }
.standard-dashboard :deep(.text-h5) { font-size: calc(1.5rem - 1px) !important; }
.standard-dashboard :deep(.text-h6) { font-size: calc(1.25rem - 1px) !important; }
.standard-dashboard :deep(.text-subtitle-1), .standard-dashboard :deep(.text-body-1) { font-size: calc(1rem - 1px) !important; }
.standard-dashboard :deep(.text-subtitle-2), .standard-dashboard :deep(.text-body-2) { font-size: calc(.875rem - 1px) !important; }
.standard-dashboard :deep(.text-caption), .standard-dashboard :deep(.text-overline) { font-size: calc(.75rem - 1px) !important; }
.standard-dashboard :deep(.v-btn__content:not(:has(> .v-icon))) { font-size: calc(var(--v-btn-size) - 1px); }
.cal-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  font-weight: 500;
  font-size: calc(0.85rem - 1px);
  color: #334155;
  background-color: #F1F5F9;
  border: 2px solid transparent;
}
.cal-outline-red { background-color: transparent; border: 2px solid #EF4444; }
.cal-outline-orange { background-color: transparent; border: 2px solid #F59E0B; }
.cal-solid-teal { background-color: #14B8A6; border-color: #14B8A6; }

.calendar-table th, .calendar-table td {
  border-bottom: none !important;
  font-size: calc(0.85rem - 1px);
}
.calendar-table td {
  padding: 4px 0 !important;
  color: #475569;
  font-weight: 700;
}
</style>
