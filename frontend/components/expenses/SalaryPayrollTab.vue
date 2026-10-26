<template>
  <div>
    <!-- Top Month Control & Navigation Bar -->
    <v-card class="pa-4 soft-card mb-6" variant="flat" rounded="xl">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <!-- Month Navigator -->
        <div class="d-flex align-center gap-3">
          <v-btn
            icon="mdi-chevron-left"
            variant="tonal"
            color="primary"
            size="small"
            rounded="lg"
            :disabled="salaryStore.loading"
            @click="changeMonth(-1)"
          ></v-btn>

          <div class="d-flex align-center gap-2">
            <v-icon color="primary" size="20">mdi-calendar-month</v-icon>
            <span class="text-h6 font-weight-black color-primary" style="min-width: 170px;">
              {{ formattedMonthName }}
            </span>
          </div>

          <v-btn
            icon="mdi-chevron-right"
            variant="tonal"
            color="primary"
            size="small"
            rounded="lg"
            :disabled="salaryStore.loading"
            @click="changeMonth(1)"
          ></v-btn>

          <v-btn
            v-if="!isCurrentMonth"
            variant="text"
            color="primary"
            size="small"
            class="text-caption font-weight-bold text-capitalize"
            @click="jumpToCurrentMonth"
          >
            Current Month
          </v-btn>

          <!-- Status Chip -->
          <v-chip
            size="small"
            rounded="pill"
            class="font-weight-bold px-3 ml-2"
            :color="statusColor"
            variant="tonal"
          >
            {{ salaryStore.monthTotals.status }}
          </v-chip>
        </div>

        <!-- Month Action Buttons -->
        <div class="d-flex align-center gap-3">
          <v-btn
            v-if="!salaryStore.isBooked && canSalary('create')"
            color="primary"
            prepend-icon="mdi-calendar-check"
            rounded="lg"
            elevation="2"
            height="42"
            class="px-5 font-weight-bold text-capitalize"
            :loading="salaryStore.loading"
            @click="openBookDialog"
          >
            Book Month's Salary
          </v-btn>

          <v-btn
            v-else-if="salaryStore.isBooked && salaryStore.monthTotals.paid === 0 && canSalary('delete')"
            variant="outlined"
            color="error"
            prepend-icon="mdi-delete-sweep-outline"
            rounded="lg"
            height="42"
            class="px-4 font-weight-bold text-capitalize bg-white"
            :loading="salaryStore.loading"
            @click="confirmUnbook"
          >
            Unbook Month
          </v-btn>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            icon="mdi-refresh"
            size="small"
            rounded="lg"
            :loading="salaryStore.loading"
            @click="reloadMonth"
          ></v-btn>
        </div>
      </div>
    </v-card>

    <!-- Month Metric KPI Cards -->
    <v-row class="mb-6">
      <!-- Total Month Payroll -->
      <v-col cols="12" sm="4">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-account-cash</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">
              {{ salaryStore.isBooked ? 'Booked Payroll' : 'Estimated Payroll' }}
            </div>
            <div class="text-h5 font-weight-black color-primary mb-1">
              AED {{ salaryStore.monthTotals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-medium text-grey-darken-1">
              {{ salaryStore.monthTotals.count }} active staff member{{ salaryStore.monthTotals.count === 1 ? '' : 's' }}
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Paid / Disbursed -->
      <v-col cols="12" sm="4">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(46, 125, 50, 0.1); color: #2E7D32; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-check-decagram-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Disbursed / Paid</div>
            <div class="text-h5 font-weight-black text-success mb-1">
              AED {{ salaryStore.monthTotals.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-bold text-success">
              {{ paidPercentage }}% disbursed
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Remaining Pending -->
      <v-col cols="12" sm="4">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(198, 40, 40, 0.1); color: #C62828; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-clock-alert-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Pending Transfer</div>
            <div class="text-h5 font-weight-black text-error mb-1">
              AED {{ salaryStore.monthTotals.pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-bold text-error">
              {{ salaryStore.monthTotals.pending > 0 ? 'Action required' : 'All clear' }}
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- CASE 1: NOT BOOKED STATE - CLEAN DIRECT SALARY BOOKING SHEET (NO BOX OVERLOAD) -->
    <v-card v-if="!salaryStore.isBooked" class="soft-card pa-6" variant="flat" rounded="xl">
      <!-- Clean Top Info Bar (Zero Form Box Clutter) -->
      <div class="d-flex align-center justify-space-between flex-wrap ga-4 py-3 px-5 bg-grey-lighten-4 rounded-xl mb-4 border" style="gap: 16px;">
        <div class="d-flex align-center flex-wrap ga-5" style="gap: 20px;">
          <div class="px-1">
            <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Payroll Month</div>
            <div class="text-subtitle-1 font-weight-black text-primary d-flex align-center">
              <v-icon size="20" color="primary" class="mr-2">mdi-calendar-month</v-icon>
              {{ formattedMonthName }}
            </div>
          </div>

          <v-divider vertical class="mx-3 my-1" style="height: 36px; align-self: center;"></v-divider>

          <div class="px-1">
            <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Calculation Basis</div>
            <div class="text-subtitle-1 font-weight-bold d-flex align-center">
              <v-icon size="18" color="grey-darken-2" class="mr-2">mdi-calculator-variant</v-icon>
              {{ daysInCurrentMonth }} Calendar Days
            </div>
          </div>

          <v-divider vertical class="mx-3 my-1" style="height: 36px; align-self: center;"></v-divider>

          <div class="px-1">
            <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Booking Date (Month End)</div>
            <div class="d-flex align-center">
              <v-icon size="18" color="primary" class="mr-2">mdi-calendar-check</v-icon>
              <input
                type="date"
                v-model="bookingForm.booking_date"
                class="clean-date-input font-weight-bold text-body-2"
              />
            </div>
          </div>
        </div>

        <div class="d-flex align-center gap-3">
          <v-chip variant="flat" color="primary" class="font-weight-bold px-3">
            {{ bookingForm.items.length }} Active Staff
          </v-chip>
          <v-btn
            v-if="canSalary('edit')"
            color="primary"
            variant="flat"
            rounded="lg"
            class="px-5 font-weight-bold text-capitalize"
            :loading="submitting"
            @click="submitBooking"
          >
            Confirm &amp; Book (AED {{ bookingComputedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
          </v-btn>
        </div>
      </div>

      <div class="d-flex align-center justify-space-between mb-3 px-1 flex-wrap gap-2">
        <div class="text-caption text-grey-darken-1 d-flex align-center gap-1">
          <v-icon size="16" color="primary">mdi-information-outline</v-icon>
          Base salaries are auto-loaded from staff records. Default attendance is <strong>No Leave</strong> (0 days). Use <span class="color-primary font-weight-bold mx-1">+</span> to add unpaid leave days.
        </div>
        <div class="text-caption font-weight-bold text-grey">
          Daily Rate = Monthly Salary &divide; {{ daysInCurrentMonth }} Days
        </div>
      </div>

      <!-- Clean Staff Table (Zero Form Box Clutter) -->
      <div class="border rounded-xl mb-4 overflow-hidden bg-white">
        <v-table density="comfortable" hover>
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold" style="min-width: 250px;">STAFF MEMBER</th>
              <th class="text-right font-weight-bold" style="min-width: 180px;">BASE SALARY (AED)</th>
              <th class="text-center font-weight-bold" style="min-width: 140px;">PER-DAY RATE</th>
              <th class="text-center font-weight-bold" style="min-width: 210px;">UNPAID LEAVE</th>
              <th class="text-right font-weight-bold" style="min-width: 160px;">LEAVE DEDUCTION</th>
              <th class="text-right font-weight-bold" style="min-width: 190px;">NET AMOUNT (AED)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="staff in bookingForm.items" :key="staff.user_id" class="hover-bg-grey">
              <!-- Staff Info -->
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <v-avatar size="36" color="primary" variant="tonal">
                    <v-img v-if="staff.avatar" :src="staff.avatar"></v-img>
                    <span v-else class="text-caption font-weight-bold">{{ staff.name?.charAt(0) || 'U' }}</span>
                  </v-avatar>
                  <div>
                    <div class="font-weight-bold text-body-2">{{ staff.name }}</div>
                    <div class="text-caption text-grey-darken-1">{{ staff.designation || 'Staff' }}</div>
                  </div>
                </div>
              </td>

              <!-- Base Monthly Salary (Clean text with optional edit) -->
              <td class="text-right">
                <div v-if="!staff.editingSalary" class="d-flex align-center justify-end gap-1">
                  <span class="font-weight-bold text-body-2">
                    AED {{ (staff.base_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </span>
                  <v-btn
                    icon="mdi-pencil-outline"
                    size="x-small"
                    variant="text"
                    color="grey"
                    density="compact"
                    title="Edit base salary"
                    @click="staff.editingSalary = true"
                  ></v-btn>
                </div>
                <div v-else class="d-flex align-center justify-end gap-1">
                  <input
                    v-model.number="staff.base_salary"
                    type="number"
                    min="0"
                    step="100"
                    class="clean-mini-input text-right font-weight-bold"
                    @keyup.enter="saveSalaryEdit(staff)"
                  />
                  <v-btn
                    icon="mdi-check"
                    size="x-small"
                    color="success"
                    variant="flat"
                    density="compact"
                    @click="saveSalaryEdit(staff)"
                  ></v-btn>
                </div>
              </td>

              <!-- Per-Day Rate -->
              <td class="text-center">
                <span class="text-caption font-weight-bold text-grey-darken-2">
                  AED {{ (staff.daily_rate || 0).toFixed(2) }}/d
                </span>
              </td>

              <!-- Leave Days (Unpaid) - Clean Stepper Pill -->
              <td class="text-center">
                <div class="d-flex align-center justify-center gap-1">
                  <v-btn
                    v-if="staff.leave_days > 0"
                    icon="mdi-minus"
                    size="x-small"
                    variant="tonal"
                    color="grey-darken-2"
                    density="compact"
                    title="Subtract 1 day"
                    @click="decrementLeave(staff)"
                  ></v-btn>

                  <v-chip
                    size="small"
                    :color="staff.leave_days > 0 ? 'error' : 'default'"
                    :variant="staff.leave_days > 0 ? 'flat' : 'tonal'"
                    class="font-weight-bold cursor-pointer px-3"
                    @click="promptEditLeave(staff)"
                    title="Click to enter exact leave days"
                  >
                    <v-icon start size="14" v-if="staff.leave_days > 0">mdi-calendar-remove</v-icon>
                    {{ staff.leave_days > 0 ? `${staff.leave_days} Day${staff.leave_days === 1 ? '' : 's'}` : 'No Leave' }}
                  </v-chip>

                  <v-btn
                    icon="mdi-plus"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    density="compact"
                    title="Add 1 unpaid leave day"
                    @click="incrementLeave(staff)"
                  ></v-btn>

                  <v-btn
                    v-if="staff.leave_days > 0"
                    icon="mdi-close-circle"
                    size="x-small"
                    variant="text"
                    color="error"
                    density="compact"
                    title="Reset to No Leave (0 days)"
                    @click="setNoLeave(staff)"
                  ></v-btn>
                </div>
              </td>

              <!-- Leave Deduction Amount -->
              <td class="text-right">
                <span v-if="staff.leave_deduction > 0" class="text-error font-weight-bold text-body-2">
                  -AED {{ (staff.leave_deduction || 0).toFixed(2) }}
                </span>
                <span v-else class="text-caption text-grey-lighten-1">
                  —
                </span>
              </td>

              <!-- Final Payable Amount -->
              <td class="text-right font-weight-black text-body-1 color-primary">
                AED {{ (staff.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
            </tr>

            <tr v-if="bookingForm.items.length === 0">
              <td colspan="6" class="text-center py-6 text-grey">
                No active staff found. Please add staff in Settings &gt; Users.
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- Clean Consolidated Summary Bar -->
      <div class="pa-4 rounded-xl border mb-4" style="background: linear-gradient(135deg, #FAF9FD 0%, #F4F1FA 100%); border-color: rgba(79, 66, 148, 0.2) !important;">
        <div class="d-flex align-center justify-space-between flex-wrap gap-4">
          <div class="d-flex align-center gap-6 flex-wrap">
            <div>
              <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Staff Count</div>
              <div class="text-body-1 font-weight-black">{{ bookingForm.items.length }} Members</div>
            </div>
            <v-divider vertical class="my-1"></v-divider>
            <div>
              <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Gross Base Salary</div>
              <div class="text-body-1 font-weight-bold">
                AED {{ bookingGrossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </div>
            </div>
            <v-divider vertical class="my-1"></v-divider>
            <div>
              <div class="text-caption font-weight-bold text-uppercase" :class="bookingLeaveDeductionsTotal > 0 ? 'text-error' : 'text-grey-darken-1'">
                Leave Deductions
              </div>
              <div class="text-body-1 font-weight-black" :class="bookingLeaveDeductionsTotal > 0 ? 'text-error' : 'text-grey-darken-1'">
                {{ bookingLeaveDeductionsTotal > 0 ? `-AED ${bookingLeaveDeductionsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'AED 0.00' }}
              </div>
            </div>
          </div>

          <div class="text-right">
            <div class="text-caption font-weight-bold text-uppercase color-primary">Final Net Payroll Liability</div>
            <div class="text-h5 font-weight-black color-primary">
              AED {{ bookingComputedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Clean Inline Notes -->
      <div class="d-flex align-center gap-2 mb-4 px-3 py-2 bg-grey-lighten-4 rounded-lg border">
        <v-icon size="18" color="grey">mdi-note-edit-outline</v-icon>
        <input
          v-model="bookingForm.notes"
          type="text"
          placeholder="Add optional booking notes (e.g. Regular monthly payroll booking)..."
          class="clean-notes-input"
        />
      </div>

      <!-- Bottom Action Bar -->
      <div class="d-flex justify-end">
        <v-btn
          v-if="canSalary('edit')"
          color="primary"
          variant="flat"
          rounded="lg"
          size="large"
          class="px-8 font-weight-bold text-capitalize"
          :loading="submitting"
          @click="submitBooking"
        >
          Confirm &amp; Book {{ formattedMonthName }} Salary (AED {{ bookingComputedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
        </v-btn>
      </div>
    </v-card>

    <!-- CASE 2: BOOKED STATE - INTERACTIVE PAYROLL TABLE -->
    <v-card v-else class="soft-card overflow-hidden pa-4" variant="flat" rounded="xl">
      <!-- Filter Bar & Search -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4">
        <!-- Search Input -->
        <div style="min-width: 260px; max-width: 360px;" class="flex-grow-1">
          <v-text-field
            v-model="search"
            placeholder="Search staff by name, designation..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            density="compact"
            variant="outlined"
            rounded="lg"
            bg-color="grey-lighten-5"
          ></v-text-field>
        </div>

        <!-- Filter Controls -->
        <div class="d-flex align-center gap-3 flex-wrap">
          <v-select
            v-model="statusFilter"
            :items="['All', 'Unpaid', 'Partially Paid', 'Paid']"
            prepend-inner-icon="mdi-tune-variant"
            hide-details
            density="compact"
            variant="outlined"
            rounded="lg"
            bg-color="white"
            style="width: 170px;"
            class="text-caption"
          ></v-select>

          <v-chip variant="outlined" color="primary" class="font-weight-bold">
            Booking Date: {{ formatDate(salaryStore.payroll?.booking_date) }}
          </v-chip>
        </div>
      </div>

      <!-- Batch Transfer Action Banner (When rows are selected) -->
      <v-slide-y-transition>
        <div 
          v-if="selectedItems.length > 0" 
          class="pa-3 mb-4 rounded-xl d-flex align-center justify-space-between flex-wrap gap-3"
          style="background: #ECEAF6; border: 1px solid rgba(79, 66, 148, 0.25);"
        >
          <div class="d-flex align-center gap-3">
            <v-icon color="primary">mdi-checkbox-marked-circle-outline</v-icon>
            <div>
              <span class="font-weight-black color-primary text-body-2">
                {{ selectedItems.length }} staff member{{ selectedItems.length === 1 ? '' : 's' }} selected
              </span>
              <span class="text-caption text-grey-darken-2 ml-2">
                (Total Pending: <strong>AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</strong>)
              </span>
            </div>
          </div>

          <div class="d-flex align-center gap-2">
            <v-btn
              variant="text"
              size="small"
              color="grey-darken-2"
              class="text-capitalize"
              @click="selectedItems = []"
            >
              Deselect All
            </v-btn>
            <v-btn
              v-if="canSalary('edit')"
              color="primary"
              prepend-icon="mdi-bank-transfer"
              rounded="lg"
              size="small"
              height="36"
              class="font-weight-bold text-capitalize"
              :disabled="selectedPendingTotal <= 0"
              @click="openBatchPayDialog"
            >
              Pay Selected (AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
            </v-btn>
          </div>
        </div>
      </v-slide-y-transition>

      <!-- Interactive Salary Table -->
      <v-table class="bg-transparent elevation-0 custom-salary-table" hover>
        <thead>
          <tr>
            <th style="width: 48px;">
              <v-checkbox
                :model-value="isAllSelected"
                :indeterminate="isIndeterminate"
                hide-details
                density="compact"
                color="primary"
                @update:model-value="toggleSelectAll"
              ></v-checkbox>
            </th>
            <th class="text-left">STAFF MEMBER</th>
            <th class="text-right">BASIC</th>
            <th class="text-right">ALLOWANCES</th>
            <th class="text-center">LEAVE</th>
            <th class="text-right">NET SALARY</th>
            <th class="text-right">PAID</th>
            <th class="text-right">PENDING</th>
            <th class="text-center">STATUS</th>
            <th class="text-left">DISBURSED FROM</th>
            <th class="text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="item in filteredItems" 
            :key="item.id"
            :class="{ 'bg-purple-lighten-5': isSelected(item) }"
          >
            <!-- Checkbox -->
            <td>
              <v-checkbox
                :model-value="isSelected(item)"
                hide-details
                density="compact"
                color="primary"
                :disabled="item.status === 'Paid'"
                @update:model-value="toggleSelectItem(item)"
              ></v-checkbox>
            </td>

            <!-- Staff Info -->
            <td>
              <div class="d-flex align-center gap-3 py-2">
                <v-avatar size="36" color="primary" variant="tonal">
                  <v-img v-if="item.Staff?.avatar" :src="item.Staff.avatar"></v-img>
                  <span v-else class="text-caption font-weight-bold">{{ item.Staff?.name?.charAt(0) || 'U' }}</span>
                </v-avatar>
                <div>
                  <div class="font-weight-bold text-body-2 color-on-surface">{{ item.Staff?.name }}</div>
                  <div class="text-caption text-grey-darken-1">{{ item.Staff?.designation || 'Staff' }}</div>
                </div>
              </div>
            </td>

            <!-- Basic Salary -->
            <td class="text-right font-weight-medium text-body-2">
              AED {{ parseFloat(item.basic_salary).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </td>

            <!-- Allowances -->
            <td class="text-right font-weight-medium text-body-2">
              AED {{ (parseFloat(item.hr_allowance) + parseFloat(item.other_allowances)).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </td>

            <!-- Leave -->
            <td class="text-center">
              <v-chip
                v-if="parseFloat(item.leave_days || 0) > 0"
                size="x-small"
                color="error"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ item.leave_days }}d (-AED {{ parseFloat(item.leave_deduction || 0).toFixed(0) }})
              </v-chip>
              <span v-else class="text-caption text-grey opacity-60">No Leave</span>
            </td>

            <!-- Net Salary -->
            <td class="text-right font-weight-black text-body-2 color-primary">
              AED {{ parseFloat(item.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </td>

            <!-- Paid -->
            <td class="text-right font-weight-bold text-body-2 text-success">
              AED {{ parseFloat(item.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </td>

            <!-- Pending -->
            <td class="text-right font-weight-black text-body-2">
              <span :class="(parseFloat(item.net_salary) - parseFloat(item.paid_amount || 0)) > 0 ? 'text-error' : 'text-success'">
                AED {{ (parseFloat(item.net_salary) - parseFloat(item.paid_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </span>
            </td>

            <!-- Status Chip -->
            <td class="text-center">
              <v-chip
                size="small"
                rounded="pill"
                class="px-3 font-weight-bold text-capitalize"
                :color="item.status === 'Paid' ? 'success' : (item.status === 'Partially Paid' ? 'primary' : 'error')"
                variant="tonal"
                style="font-size: 11px; height: 24px;"
              >
                {{ item.status }}
              </v-chip>
            </td>

            <!-- Disbursed From / Account -->
            <td>
              <div v-if="item.Account" class="d-flex align-center gap-2">
                <v-avatar v-if="getAccountLogo(item.Account.name)" size="20" rounded="0">
                  <v-img :src="getAccountLogo(item.Account.name)"></v-img>
                </v-avatar>
                <span class="text-caption font-weight-medium">{{ item.Account.name }}</span>
              </div>
              <span v-else class="text-caption text-grey-darken-1 opacity-60">Not Disbursed</span>
            </td>

            <!-- Actions -->
            <td class="text-right">
              <div class="d-flex align-center justify-end gap-1">
                <!-- Pay Button (if not fully paid) -->
                <v-btn
                  v-if="item.status !== 'Paid' && canSalary('edit', item)"
                  color="primary"
                  variant="flat"
                  size="small"
                  rounded="lg"
                  class="font-weight-bold text-capitalize px-3"
                  @click="openSinglePayDialog(item)"
                >
                  Pay
                </v-btn>

                <!-- More actions menu -->
                <v-menu location="bottom end">
                  <template v-slot:activator="{ props }">
                    <v-btn icon="mdi-dots-horizontal" variant="text" size="small" color="grey-darken-1" v-bind="props"></v-btn>
                  </template>
                  <v-list density="compact" width="220" rounded="lg" elevation="3">
                    <v-list-item
                      v-if="item.status !== 'Paid' && canSalary('edit', item)"
                      prepend-icon="mdi-credit-card-check-outline"
                      title="Pay Salary (Full/Partial)"
                      color="primary"
                      @click="openSinglePayDialog(item)"
                    ></v-list-item>

                    <v-list-item
                      prepend-icon="mdi-history"
                      title="Payment History"
                      @click="openHistoryDialog(item)"
                    ></v-list-item>

                    <v-list-item
                      prepend-icon="mdi-file-document-outline"
                      title="View Salary Breakdown"
                      @click="openBreakdownDialog(item)"
                    ></v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </td>
          </tr>

          <tr v-if="filteredItems.length === 0">
            <td colspan="10" class="text-center py-8 text-grey">
              No staff records matching the selected filter.
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- ==================== DIALOGS ==================== -->

    <!-- 1. BOOK SALARY DIALOG (FULL WIDTH EXPANDED VIEW WITH LEAVE DAYS & PER-DAY RATE) -->
    <v-dialog
      v-model="bookDialog"
      :fullscreen="isBookFullscreen"
      :width="isBookFullscreen ? undefined : '98vw'"
      :max-width="isBookFullscreen ? undefined : '98vw'"
      scrollable
      persistent
      transition="dialog-bottom-transition"
    >
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="primary" class="px-5">
          <v-icon color="white" class="mr-2">mdi-calendar-check</v-icon>
          <v-toolbar-title class="font-weight-bold text-white text-h6">
            Book Salary &amp; Payroll &bull; {{ formattedMonthName }}
          </v-toolbar-title>
          <v-chip variant="flat" color="white" class="text-primary font-weight-black mr-3">
            {{ daysInCurrentMonth }} Days in this Month
          </v-chip>
          <v-btn
            :icon="isBookFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
            variant="text"
            color="white"
            class="mr-1"
            :title="isBookFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'"
            @click="isBookFullscreen = !isBookFullscreen"
          ></v-btn>
          <v-btn icon="mdi-close" variant="text" color="white" @click="bookDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Clean Top Info Bar (Zero Form Box Clutter) -->
          <div class="d-flex align-center justify-space-between flex-wrap ga-4 py-3 px-5 bg-grey-lighten-4 rounded-xl mb-4 border" style="gap: 16px;">
            <div class="d-flex align-center flex-wrap ga-5" style="gap: 20px;">
              <div class="px-1">
                <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Payroll Month</div>
                <div class="text-subtitle-1 font-weight-black text-primary d-flex align-center">
                  <v-icon size="20" color="primary" class="mr-2">mdi-calendar-month</v-icon>
                  {{ formattedMonthName }}
                </div>
              </div>

              <v-divider vertical class="mx-3 my-1" style="height: 36px; align-self: center;"></v-divider>

              <div class="px-1">
                <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Calculation Basis</div>
                <div class="text-subtitle-1 font-weight-bold d-flex align-center">
                  <v-icon size="18" color="grey-darken-2" class="mr-2">mdi-calculator-variant</v-icon>
                  {{ daysInCurrentMonth }} Calendar Days
                </div>
              </div>

              <v-divider vertical class="mx-3 my-1" style="height: 36px; align-self: center;"></v-divider>

              <div class="px-1">
                <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Booking Date (Month End)</div>
                <div class="d-flex align-center">
                  <v-icon size="18" color="primary" class="mr-2">mdi-calendar-check</v-icon>
                  <input
                    type="date"
                    v-model="bookingForm.booking_date"
                    class="clean-date-input font-weight-bold text-body-2"
                  />
                </div>
              </div>
            </div>

            <div class="d-flex align-center gap-2">
              <v-chip variant="flat" color="primary" class="font-weight-bold px-3">
                {{ bookingForm.items.length }} Active Staff
              </v-chip>
            </div>
          </div>

          <div class="d-flex align-center justify-space-between mb-3 px-1 flex-wrap gap-2">
            <div class="text-caption text-grey-darken-1 d-flex align-center gap-1">
              <v-icon size="16" color="primary">mdi-information-outline</v-icon>
              Base salaries are auto-loaded from staff records. Default attendance is <strong>No Leave</strong> (0 days). Use <span class="color-primary font-weight-bold mx-1">+</span> to add unpaid leave days.
            </div>
            <div class="text-caption font-weight-bold text-grey">
              Daily Rate = Monthly Salary &divide; {{ daysInCurrentMonth }} Days
            </div>
          </div>

          <!-- Clean Staff Table (Zero Form Box Clutter) -->
          <div class="border rounded-xl mb-4 overflow-hidden bg-white">
            <div style="max-height: 480px; overflow-y: auto;">
              <v-table density="comfortable" hover>
                <thead>
                  <tr class="bg-grey-lighten-5">
                    <th class="text-left font-weight-bold" style="min-width: 250px;">STAFF MEMBER</th>
                    <th class="text-right font-weight-bold" style="min-width: 180px;">BASE SALARY (AED)</th>
                    <th class="text-center font-weight-bold" style="min-width: 140px;">PER-DAY RATE</th>
                    <th class="text-center font-weight-bold" style="min-width: 210px;">UNPAID LEAVE</th>
                    <th class="text-right font-weight-bold" style="min-width: 160px;">LEAVE DEDUCTION</th>
                    <th class="text-right font-weight-bold" style="min-width: 190px;">NET AMOUNT (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="staff in bookingForm.items" :key="staff.user_id" class="hover-bg-grey">
                    <!-- Staff Info -->
                    <td>
                      <div class="d-flex align-center gap-3 py-2">
                        <v-avatar size="36" color="primary" variant="tonal">
                          <v-img v-if="staff.avatar" :src="staff.avatar"></v-img>
                          <span v-else class="text-caption font-weight-bold">{{ staff.name?.charAt(0) || 'U' }}</span>
                        </v-avatar>
                        <div>
                          <div class="font-weight-bold text-body-2">{{ staff.name }}</div>
                          <div class="text-caption text-grey-darken-1">{{ staff.designation || 'Staff' }}</div>
                        </div>
                      </div>
                    </td>

                    <!-- Base Monthly Salary (Clean text with optional edit) -->
                    <td class="text-right">
                      <div v-if="!staff.editingSalary" class="d-flex align-center justify-end gap-1">
                        <span class="font-weight-bold text-body-2">
                          AED {{ (staff.base_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                        </span>
                        <v-btn
                          icon="mdi-pencil-outline"
                          size="x-small"
                          variant="text"
                          color="grey"
                          density="compact"
                          title="Edit base salary"
                          @click="staff.editingSalary = true"
                        ></v-btn>
                      </div>
                      <div v-else class="d-flex align-center justify-end gap-1">
                        <input
                          v-model.number="staff.base_salary"
                          type="number"
                          min="0"
                          step="100"
                          class="clean-mini-input text-right font-weight-bold"
                          @keyup.enter="saveSalaryEdit(staff)"
                        />
                        <v-btn
                          icon="mdi-check"
                          size="x-small"
                          color="success"
                          variant="flat"
                          density="compact"
                          @click="saveSalaryEdit(staff)"
                        ></v-btn>
                      </div>
                    </td>

                    <!-- Per-Day Rate -->
                    <td class="text-center">
                      <span class="text-caption font-weight-bold text-grey-darken-2">
                        AED {{ (staff.daily_rate || 0).toFixed(2) }}/d
                      </span>
                    </td>

                    <!-- Leave Days (Unpaid) - Clean Stepper Pill -->
                    <td class="text-center">
                      <div class="d-flex align-center justify-center gap-1">
                        <v-btn
                          v-if="staff.leave_days > 0"
                          icon="mdi-minus"
                          size="x-small"
                          variant="tonal"
                          color="grey-darken-2"
                          density="compact"
                          title="Subtract 1 day"
                          @click="decrementLeave(staff)"
                        ></v-btn>

                        <v-chip
                          size="small"
                          :color="staff.leave_days > 0 ? 'error' : 'default'"
                          :variant="staff.leave_days > 0 ? 'flat' : 'tonal'"
                          class="font-weight-bold cursor-pointer px-3"
                          @click="promptEditLeave(staff)"
                          title="Click to enter exact leave days"
                        >
                          <v-icon start size="14" v-if="staff.leave_days > 0">mdi-calendar-remove</v-icon>
                          {{ staff.leave_days > 0 ? `${staff.leave_days} Day${staff.leave_days === 1 ? '' : 's'}` : 'No Leave' }}
                        </v-chip>

                        <v-btn
                          icon="mdi-plus"
                          size="x-small"
                          variant="tonal"
                          color="primary"
                          density="compact"
                          title="Add 1 unpaid leave day"
                          @click="incrementLeave(staff)"
                        ></v-btn>

                        <v-btn
                          v-if="staff.leave_days > 0"
                          icon="mdi-close-circle"
                          size="x-small"
                          variant="text"
                          color="error"
                          density="compact"
                          title="Reset to No Leave (0 days)"
                          @click="setNoLeave(staff)"
                        ></v-btn>
                      </div>
                    </td>

                    <!-- Leave Deduction Amount -->
                    <td class="text-right">
                      <span v-if="staff.leave_deduction > 0" class="text-error font-weight-bold text-body-2">
                        -AED {{ (staff.leave_deduction || 0).toFixed(2) }}
                      </span>
                      <span v-else class="text-caption text-grey-lighten-1">
                        —
                      </span>
                    </td>

                    <!-- Final Payable Amount -->
                    <td class="text-right font-weight-black text-body-1 color-primary">
                      AED {{ (staff.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </td>
                  </tr>

                  <tr v-if="bookingForm.items.length === 0">
                    <td colspan="6" class="text-center py-6 text-grey">
                      No active staff found. Please add staff in Settings &gt; Users.
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </div>

          <!-- Clean Consolidated Summary Bar -->
          <div class="pa-4 rounded-xl border mb-4" style="background: linear-gradient(135deg, #FAF9FD 0%, #F4F1FA 100%); border-color: rgba(79, 66, 148, 0.2) !important;">
            <div class="d-flex align-center justify-space-between flex-wrap gap-4">
              <div class="d-flex align-center gap-6 flex-wrap">
                <div>
                  <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Staff Count</div>
                  <div class="text-body-1 font-weight-black">{{ bookingForm.items.length }} Members</div>
                </div>
                <v-divider vertical class="my-1"></v-divider>
                <div>
                  <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Gross Base Salary</div>
                  <div class="text-body-1 font-weight-bold">
                    AED {{ bookingGrossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                  </div>
                </div>
                <v-divider vertical class="my-1"></v-divider>
                <div>
                  <div class="text-caption font-weight-bold text-uppercase" :class="bookingLeaveDeductionsTotal > 0 ? 'text-error' : 'text-grey-darken-1'">
                    Leave Deductions
                  </div>
                  <div class="text-body-1 font-weight-black" :class="bookingLeaveDeductionsTotal > 0 ? 'text-error' : 'text-grey-darken-1'">
                    {{ bookingLeaveDeductionsTotal > 0 ? `-AED ${bookingLeaveDeductionsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'AED 0.00' }}
                  </div>
                </div>
              </div>

              <div class="text-right">
                <div class="text-caption font-weight-bold text-uppercase color-primary">Final Net Payroll Liability</div>
                <div class="text-h5 font-weight-black color-primary">
                  AED {{ bookingComputedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Clean Inline Notes -->
          <div class="d-flex align-center gap-2 mb-2 px-3 py-2 bg-grey-lighten-4 rounded-lg border">
            <v-icon size="18" color="grey">mdi-note-edit-outline</v-icon>
            <input
              v-model="bookingForm.notes"
              type="text"
              placeholder="Add optional booking notes (e.g. Regular monthly payroll booking)..."
              class="clean-notes-input"
            />
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4 border-t d-flex justify-end gap-2">
          <v-btn
            variant="text"
            color="grey-darken-1"
            class="text-capitalize"
            @click="bookDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="px-6 font-weight-bold text-capitalize"
            :loading="submitting"
            @click="submitBooking"
          >
            Confirm &amp; Book Salary (AED {{ bookingComputedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 2. INDIVIDUAL PAY SALARY DIALOG (FULL OR PARTIAL) -->
    <v-dialog v-model="singlePayDialog" max-width="540px" persistent>
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="primary" class="px-4">
          <v-toolbar-title class="font-weight-bold text-white">
            Disburse Salary: {{ activeItem?.Staff?.name }}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" color="white" @click="singlePayDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Staff Summary Card -->
          <div class="pa-4 bg-grey-lighten-4 rounded-xl mb-5">
            <div class="d-flex align-center gap-3 mb-3">
              <v-avatar size="44" color="primary" variant="tonal">
                <v-img v-if="activeItem?.Staff?.avatar" :src="activeItem.Staff.avatar"></v-img>
                <span v-else class="text-subtitle-1 font-weight-bold">{{ activeItem?.Staff?.name?.charAt(0) }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-bold text-body-1">{{ activeItem?.Staff?.name }}</div>
                <div class="text-caption text-grey-darken-1">{{ activeItem?.Staff?.designation || 'Staff' }} &bull; {{ formattedMonthName }}</div>
              </div>
            </div>

            <v-divider class="my-2"></v-divider>

            <div class="d-flex justify-space-between text-caption py-1">
              <span class="text-grey-darken-1">Net Monthly Salary:</span>
              <span class="font-weight-bold">AED {{ parseFloat(activeItem?.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-caption py-1">
              <span class="text-grey-darken-1">Already Paid:</span>
              <span class="font-weight-bold text-success">AED {{ parseFloat(activeItem?.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="font-weight-bold color-primary">Remaining Due:</span>
              <span class="font-weight-black text-error">AED {{ remainingPendingForActiveItem.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
          </div>

          <!-- Payment Mode Selection -->
          <div class="text-caption font-weight-bold text-uppercase mb-2 text-grey-darken-1">Payment Mode</div>
          <v-radio-group v-model="singlePayForm.mode" inline class="mb-3">
            <v-radio label="Full Payment" value="full" color="primary"></v-radio>
            <v-radio label="Partial Payment" value="partial" color="primary"></v-radio>
          </v-radio-group>

          <!-- Custom Partial Amount Input -->
          <v-text-field
            v-if="singlePayForm.mode === 'partial'"
            v-model.number="singlePayForm.amount"
            label="Partial Payment Amount (AED)"
            type="number"
            :max="remainingPendingForActiveItem"
            min="1"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            prefix="AED"
            class="mb-3"
          ></v-text-field>

          <!-- Amount to pay preview -->
          <div class="pa-3 mb-4 rounded-lg d-flex justify-space-between align-center" style="background: rgba(46, 125, 50, 0.08); border: 1px solid rgba(46, 125, 50, 0.2);">
            <span class="text-caption font-weight-bold text-success text-uppercase">Disbursement Amount</span>
            <span class="text-h6 font-weight-black text-success">
              AED {{ currentSinglePayAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </span>
          </div>

          <!-- Bank / Wallet Account Selector -->
          <v-select
            v-model="singlePayForm.account_id"
            :items="walletStore.accounts"
            item-value="id"
            item-title="name"
            label="Pay From (Bank or Wallet Account)"
            placeholder="Select Bank or Cash Wallet"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mb-3"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="`${item.raw.account_type} • Balance: AED ${parseFloat(item.raw.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`">
                <template v-slot:prepend>
                  <v-avatar v-if="item.raw.logo_url" size="26" rounded="0" class="mr-2">
                    <v-img :src="item.raw.logo_url"></v-img>
                  </v-avatar>
                  <v-icon v-else size="24" class="mr-2" color="primary">
                    {{ item.raw.account_type === 'Cash' ? 'mdi-cash' : 'mdi-bank' }}
                  </v-icon>
                </template>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item }">
              <div class="d-flex align-center gap-2">
                <v-avatar v-if="item.raw.logo_url" size="20" rounded="0">
                  <v-img :src="item.raw.logo_url"></v-img>
                </v-avatar>
                <span class="font-weight-medium">{{ item.raw.name }}</span>
                <span class="text-caption text-grey">({{ item.raw.account_type }})</span>
              </div>
            </template>
          </v-select>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="singlePayForm.payment_date"
                label="Payment Date"
                type="date"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="singlePayForm.payment_method"
                :items="['Bank Transfer', 'Cash', 'Cheque', 'Online']"
                label="Method"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-select>
            </v-col>
          </v-row>

          <v-text-field
            v-model="singlePayForm.notes"
            label="Transaction Reference / Note (Optional)"
            placeholder="e.g. Bank Ref #12345"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mt-2"
          ></v-text-field>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4 border-t d-flex justify-end gap-2">
          <v-btn variant="text" color="grey-darken-1" class="text-capitalize" @click="singlePayDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="px-6 font-weight-bold text-capitalize"
            :loading="submitting"
            :disabled="!singlePayForm.account_id || currentSinglePayAmount <= 0"
            @click="submitSinglePayment"
          >
            Process Transfer (AED {{ currentSinglePayAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 3. BATCH / BULK TRANSFER DIALOG -->
    <v-dialog v-model="batchPayDialog" max-width="640px" persistent>
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="primary" class="px-4">
          <v-toolbar-title class="font-weight-bold text-white">
            Batch Salary Transfer
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" color="white" @click="batchPayDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <div class="pa-4 rounded-xl mb-4" style="background: rgba(79, 66, 148, 0.08); border: 1px solid rgba(79, 66, 148, 0.2);">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-caption font-weight-bold text-uppercase opacity-70">Selected Staff Members</span>
              <span class="font-weight-bold text-body-2">{{ selectedItems.length }} Persons</span>
            </div>
            <div class="d-flex justify-space-between align-center">
              <span class="text-caption font-weight-bold text-uppercase opacity-70">Total Transfer Amount</span>
              <span class="text-h6 font-weight-black color-primary">
                AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </span>
            </div>
          </div>

          <!-- Selected Staff List Preview -->
          <div class="border rounded-xl mb-4 overflow-hidden" style="max-height: 200px; overflow-y: auto;">
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">STAFF</th>
                  <th class="text-right">PENDING DUE</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in selectedItems" :key="item.id">
                  <td>
                    <span class="font-weight-medium text-body-2">{{ item.Staff?.name }}</span>
                    <span class="text-caption text-grey ml-1">({{ item.Staff?.designation || 'Staff' }})</span>
                  </td>
                  <td class="text-right font-weight-black text-error">
                    AED {{ (parseFloat(item.net_salary) - parseFloat(item.paid_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <!-- Bank / Wallet Account Selector -->
          <v-select
            v-model="batchPayForm.account_id"
            :items="walletStore.accounts"
            item-value="id"
            item-title="name"
            label="Pay From (Bank or Wallet Account)"
            placeholder="Select Bank or Cash Wallet"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mb-3"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="`${item.raw.account_type} • Balance: AED ${parseFloat(item.raw.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`">
                <template v-slot:prepend>
                  <v-avatar v-if="item.raw.logo_url" size="26" rounded="0" class="mr-2">
                    <v-img :src="item.raw.logo_url"></v-img>
                  </v-avatar>
                  <v-icon v-else size="24" class="mr-2" color="primary">
                    {{ item.raw.account_type === 'Cash' ? 'mdi-cash' : 'mdi-bank' }}
                  </v-icon>
                </template>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item }">
              <div class="d-flex align-center gap-2">
                <v-avatar v-if="item.raw.logo_url" size="20" rounded="0">
                  <v-img :src="item.raw.logo_url"></v-img>
                </v-avatar>
                <span class="font-weight-medium">{{ item.raw.name }}</span>
                <span class="text-caption text-grey">({{ item.raw.account_type }})</span>
              </div>
            </template>
          </v-select>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="batchPayForm.payment_date"
                label="Payment Date"
                type="date"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="batchPayForm.payment_method"
                :items="['Bank Transfer', 'Cash', 'Cheque', 'Online']"
                label="Method"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-select>
            </v-col>
          </v-row>

          <v-text-field
            v-model="batchPayForm.notes"
            label="Batch Reference / Notes"
            placeholder="e.g. September Salary Disbursal via WPS / Corporate Bank"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mt-2"
          ></v-text-field>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4 border-t d-flex justify-end gap-2">
          <v-btn variant="text" color="grey-darken-1" class="text-capitalize" @click="batchPayDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="px-6 font-weight-bold text-capitalize"
            :loading="submitting"
            :disabled="!batchPayForm.account_id || selectedPendingTotal <= 0"
            @click="submitBatchPayment"
          >
            Disburse All (AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 4. PAYMENT HISTORY & BREAKDOWN DIALOG -->
    <v-dialog v-model="historyDialog" max-width="560px">
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="surface" flat border-b class="px-4">
          <v-toolbar-title class="font-weight-bold">
            Payment History &bull; {{ activeItem?.Staff?.name }}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="historyDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <div class="pa-4 bg-grey-lighten-4 rounded-xl mb-4">
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="text-grey-darken-1">Net Salary:</span>
              <span class="font-weight-bold">AED {{ parseFloat(activeItem?.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="text-grey-darken-1">Total Paid:</span>
              <span class="font-weight-bold text-success">AED {{ parseFloat(activeItem?.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="text-grey-darken-1">Remaining Due:</span>
              <span class="font-weight-bold text-error">AED {{ remainingPendingForActiveItem.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
          </div>

          <div class="font-weight-bold text-caption text-uppercase mb-3 opacity-60">
            Payment Transactions ({{ salaryStore.paymentHistory.length }})
          </div>

          <div v-if="salaryStore.historyLoading" class="text-center py-6">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
          </div>

          <div v-else-if="salaryStore.paymentHistory.length === 0" class="text-center py-6 text-grey">
            No payments have been recorded for this staff member yet.
          </div>

          <div v-else class="border rounded-xl overflow-hidden">
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">DATE</th>
                  <th class="text-left">ACCOUNT / METHOD</th>
                  <th class="text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pay in salaryStore.paymentHistory" :key="pay.id">
                  <td>{{ formatDate(pay.payment_date) }}</td>
                  <td>
                    <div class="font-weight-medium text-caption">{{ pay.Account?.name || 'Bank' }}</div>
                    <div class="text-caption text-grey opacity-70">{{ pay.payment_method }}</div>
                  </td>
                  <td class="text-right font-weight-black text-success">
                    AED {{ parseFloat(pay.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 5. SALARY BREAKDOWN SLIP DIALOG -->
    <v-dialog v-model="breakdownDialog" max-width="500px">
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="surface" flat border-b class="px-4">
          <v-toolbar-title class="font-weight-bold">
            Salary Breakdown &bull; {{ activeItem?.Staff?.name }}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="breakdownDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <v-avatar size="44" color="primary" variant="tonal">
              <v-img v-if="activeItem?.Staff?.avatar" :src="activeItem.Staff.avatar"></v-img>
              <span v-else class="text-subtitle-1 font-weight-bold">{{ activeItem?.Staff?.name?.charAt(0) }}</span>
            </v-avatar>
            <div>
              <div class="font-weight-bold text-body-1">{{ activeItem?.Staff?.name }}</div>
              <div class="text-caption text-grey">{{ activeItem?.Staff?.designation || 'Staff' }} &bull; {{ formattedMonthName }}</div>
            </div>
          </div>

          <v-table density="compact" class="border rounded-xl">
            <tbody>
              <tr>
                <td class="text-grey-darken-1 font-weight-medium">Basic Salary</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.basic_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr>
                <td class="text-grey-darken-1 font-weight-medium">HR / Housing Allowance</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.hr_allowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr>
                <td class="text-grey-darken-1 font-weight-medium">Other Allowances</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.other_allowances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.daily_rate || 0) > 0">
                <td class="text-grey-darken-1 font-weight-medium">Daily Rate (Based on {{ daysInCurrentMonth }} days)</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.daily_rate).toFixed(2) }}/day</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.leave_days || 0) > 0">
                <td class="text-error font-weight-medium">Leave Days Taken</td>
                <td class="text-right font-weight-bold text-error">{{ activeItem?.leave_days }} Days (-AED {{ parseFloat(activeItem?.leave_deduction || 0).toFixed(2) }})</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.bonus || 0) > 0">
                <td class="text-success font-weight-medium">Bonus / Incentives</td>
                <td class="text-right font-weight-bold text-success">+ AED {{ parseFloat(activeItem?.bonus).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.deductions || 0) > 0">
                <td class="text-error font-weight-medium">Other Deductions</td>
                <td class="text-right font-weight-bold text-error">- AED {{ parseFloat(activeItem?.deductions).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr class="bg-grey-lighten-4">
                <td class="font-weight-black color-primary">Net Monthly Salary</td>
                <td class="text-right font-weight-black text-subtitle-1 color-primary">
                  AED {{ parseFloat(activeItem?.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSalaryStore } from '~/stores/salary';
import { useWalletStore } from '~/stores/wallet';
import { useAuthStore } from '~/stores/auth';
import { hasScopedRules } from '~/utils/recordPermissions';
import { useUIStore } from '~/stores/ui';
import { getBankLogo } from '~/utils/banks';

const salaryStore = useSalaryStore();
const walletStore = useWalletStore();
const auth = useAuthStore();
const canSalary = (action, record) => {
  if (hasScopedRules(auth.user?.permissions)) return record ? auth.canRecord('staff', action, record) : auth.can('staff', action);
  const legacy = ['create', 'edit'].includes(action) ? 'write' : action;
  return auth.can('expenses', legacy) || auth.can('staff', legacy);
};
const uiStore = useUIStore();

// UI Filters
const search = ref('');
const statusFilter = ref('All');

// Selection state
const selectedItems = ref([]);

// Active item for modals
const activeItem = ref(null);
const submitting = ref(false);

// Dialogs
const bookDialog = ref(false);
const isBookFullscreen = ref(false);
const singlePayDialog = ref(false);
const batchPayDialog = ref(false);
const historyDialog = ref(false);
const breakdownDialog = ref(false);

// Forms
const bookingForm = ref({
  booking_date: '',
  notes: '',
  items: []
});

const daysInCurrentMonth = computed(() => {
  if (!salaryStore.currentMonth) return 30;
  const [year, month] = salaryStore.currentMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
});

const bookingGrossTotal = computed(() => {
  return (bookingForm.value.items || []).reduce((sum, item) => sum + (parseFloat(item.base_salary) || 0), 0);
});

const bookingLeaveDeductionsTotal = computed(() => {
  return (bookingForm.value.items || []).reduce((sum, item) => sum + (parseFloat(item.leave_deduction) || 0), 0);
});

const bookingComputedTotal = computed(() => {
  return (bookingForm.value.items || []).reduce((sum, item) => sum + (parseFloat(item.net_salary) || 0), 0);
});

const onStaffBaseSalaryChange = (staff) => {
  const base = parseFloat(staff.base_salary) || 0;
  const leaves = parseFloat(staff.leave_days) || 0;
  const days = daysInCurrentMonth.value || 30;
  staff.daily_rate = days > 0 ? parseFloat((base / days).toFixed(2)) : 0;
  staff.leave_deduction = parseFloat((leaves * staff.daily_rate).toFixed(2));
  staff.net_salary = Math.max(0, parseFloat((base - staff.leave_deduction).toFixed(2)));
};

const onStaffLeaveChange = (staff) => {
  const base = parseFloat(staff.base_salary) || 0;
  const leaves = parseFloat(staff.leave_days) || 0;
  const days = daysInCurrentMonth.value || 30;
  staff.daily_rate = days > 0 ? parseFloat((base / days).toFixed(2)) : 0;
  staff.leave_deduction = parseFloat((leaves * staff.daily_rate).toFixed(2));
  staff.net_salary = Math.max(0, parseFloat((base - staff.leave_deduction).toFixed(2)));
};

const initBookingForm = () => {
  bookingForm.value.booking_date = salaryStore.monthData?.suggestedBookingDate || '';
  bookingForm.value.notes = '';
  const days = daysInCurrentMonth.value || 30;
  bookingForm.value.items = (salaryStore.staffPreview || []).map(s => {
    const base = parseFloat(s.base_salary || s.net_salary || (parseFloat(s.basic_salary) + parseFloat(s.hr_allowance) + parseFloat(s.other_allowances))) || 0;
    const daily = days > 0 ? parseFloat((base / days).toFixed(2)) : 0;
    return {
      user_id: s.user_id,
      name: s.Staff?.name || s.name,
      designation: s.Staff?.designation || s.designation,
      avatar: s.Staff?.avatar || s.avatar,
      basic_salary: parseFloat(s.basic_salary) || 0,
      hr_allowance: parseFloat(s.hr_allowance) || 0,
      other_allowances: parseFloat(s.other_allowances) || 0,
      base_salary: base,
      leave_days: 0,
      daily_rate: daily,
      leave_deduction: 0.00,
      deductions: 0.00,
      bonus: 0.00,
      net_salary: base,
      editingSalary: false
    };
  });
};

watch(() => salaryStore.staffPreview, () => {
  if (!salaryStore.isBooked) {
    initBookingForm();
  }
}, { immediate: true });

const incrementLeave = (staff) => {
  const maxDays = daysInCurrentMonth.value || 30;
  const current = parseFloat(staff.leave_days) || 0;
  if (current < maxDays) {
    staff.leave_days = current + 1;
    onStaffLeaveChange(staff);
  }
};

const decrementLeave = (staff) => {
  const current = parseFloat(staff.leave_days) || 0;
  if (current > 0) {
    staff.leave_days = Math.max(0, current - 1);
    onStaffLeaveChange(staff);
  }
};

const setNoLeave = (staff) => {
  staff.leave_days = 0;
  onStaffLeaveChange(staff);
};

const promptEditLeave = (staff) => {
  const input = prompt(`Enter unpaid leave days for ${staff.name} (0 to ${daysInCurrentMonth.value}):`, staff.leave_days || 0);
  if (input !== null && input.trim() !== '') {
    const val = parseFloat(input);
    if (!isNaN(val) && val >= 0 && val <= daysInCurrentMonth.value) {
      staff.leave_days = val;
      onStaffLeaveChange(staff);
    }
  }
};

const toggleEditSalary = (staff) => {
  staff.editingSalary = !staff.editingSalary;
};

const saveSalaryEdit = (staff) => {
  staff.editingSalary = false;
  onStaffBaseSalaryChange(staff);
};

const singlePayForm = ref({
  mode: 'full',
  amount: 0,
  account_id: null,
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: 'Bank Transfer',
  notes: ''
});

const batchPayForm = ref({
  account_id: null,
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: 'Bank Transfer',
  notes: ''
});

// Mounted
onMounted(async () => {
  await Promise.all([
    walletStore.fetchAccounts(),
    salaryStore.fetchMonthPayroll(salaryStore.currentMonth)
  ]);
});

// Computed Month Displays
const formattedMonthName = computed(() => {
  if (!salaryStore.currentMonth) return '';
  const [year, month] = salaryStore.currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

const isCurrentMonth = computed(() => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  return salaryStore.currentMonth === `${yyyy}-${mm}`;
});

const statusColor = computed(() => {
  const st = salaryStore.monthTotals.status;
  if (st === 'Paid') return 'success';
  if (st === 'Partially Paid') return 'primary';
  if (st === 'Booked') return 'warning';
  return 'grey';
});

const paidPercentage = computed(() => {
  const total = salaryStore.monthTotals.total;
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((salaryStore.monthTotals.paid / total) * 100));
});

// Filtered items in booked table
const filteredItems = computed(() => {
  let list = salaryStore.items || [];
  if (statusFilter.value !== 'All') {
    list = list.filter(item => item.status === statusFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(item => {
      const name = item.Staff?.name?.toLowerCase() || '';
      const desig = item.Staff?.designation?.toLowerCase() || '';
      return name.includes(q) || desig.includes(q);
    });
  }
  return list;
});

// Selection helpers
const isSelected = (item) => {
  return selectedItems.value.some(i => i.id === item.id);
};

const toggleSelectItem = (item) => {
  const idx = selectedItems.value.findIndex(i => i.id === item.id);
  if (idx > -1) {
    selectedItems.value.splice(idx, 1);
  } else {
    selectedItems.value.push(item);
  }
};

const isAllSelected = computed(() => {
  const selectable = filteredItems.value.filter(i => i.status !== 'Paid');
  return selectable.length > 0 && selectable.every(i => isSelected(i));
});

const isIndeterminate = computed(() => {
  const selectable = filteredItems.value.filter(i => i.status !== 'Paid');
  const count = selectable.filter(i => isSelected(i)).length;
  return count > 0 && count < selectable.length;
});

const toggleSelectAll = (val) => {
  const selectable = filteredItems.value.filter(i => i.status !== 'Paid');
  if (val) {
    selectedItems.value = [...selectable];
  } else {
    selectedItems.value = [];
  }
};

const selectedPendingTotal = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    const net = parseFloat(item.net_salary || 0);
    const paid = parseFloat(item.paid_amount || 0);
    return sum + Math.max(0, net - paid);
  }, 0);
});

const remainingPendingForActiveItem = computed(() => {
  if (!activeItem.value) return 0;
  const net = parseFloat(activeItem.value.net_salary || 0);
  const paid = parseFloat(activeItem.value.paid_amount || 0);
  return Math.max(0, net - paid);
});

const currentSinglePayAmount = computed(() => {
  if (singlePayForm.value.mode === 'full') {
    return remainingPendingForActiveItem.value;
  }
  return parseFloat(singlePayForm.value.amount || 0);
});

// Month change functions
const changeMonth = async (delta) => {
  const [year, month] = salaryStore.currentMonth.split('-').map(Number);
  const newDate = new Date(year, month - 1 + delta, 1);
  const newY = newDate.getFullYear();
  const newM = String(newDate.getMonth() + 1).padStart(2, '0');
  selectedItems.value = [];
  await salaryStore.fetchMonthPayroll(`${newY}-${newM}`);
};

const jumpToCurrentMonth = async () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  selectedItems.value = [];
  await salaryStore.fetchMonthPayroll(`${yyyy}-${mm}`);
};

const reloadMonth = async () => {
  selectedItems.value = [];
  await salaryStore.fetchMonthPayroll(salaryStore.currentMonth);
};

// Modals Open
const openBookDialog = () => {
  if (!bookingForm.value.items || bookingForm.value.items.length === 0) {
    initBookingForm();
  }
  bookDialog.value = true;
};

const submitBooking = async () => {
  submitting.value = true;
  try {
    await salaryStore.bookMonthSalary({
      booking_date: bookingForm.value.booking_date,
      notes: bookingForm.value.notes,
      items: bookingForm.value.items
    });
    uiStore.showSuccess(`Salary for ${formattedMonthName.value} booked successfully!`);
    bookDialog.value = false;
  } catch (err) {
    uiStore.showError(err.response?.data?.message || 'Failed to book salary');
  } finally {
    submitting.value = false;
  }
};

const confirmUnbook = async () => {
  if (confirm(`Are you sure you want to unbook the salary for ${formattedMonthName.value}?`)) {
    try {
      await salaryStore.unbookMonthSalary(salaryStore.currentMonth);
      uiStore.showSuccess('Monthly salary unbooked');
    } catch (err) {
      uiStore.showError(err.response?.data?.message || 'Failed to unbook salary');
    }
  }
};

const openSinglePayDialog = (item) => {
  activeItem.value = item;
  const pending = Math.max(0, parseFloat(item.net_salary) - parseFloat(item.paid_amount || 0));
  singlePayForm.value = {
    mode: 'full',
    amount: pending,
    account_id: walletStore.accounts[0]?.id || null,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    notes: ''
  };
  singlePayDialog.value = true;
};

const submitSinglePayment = async () => {
  if (!activeItem.value || !singlePayForm.value.account_id) return;
  submitting.value = true;
  try {
    await salaryStore.paySingleSalary({
      salary_item_id: activeItem.value.id,
      account_id: singlePayForm.value.account_id,
      amount: currentSinglePayAmount.value,
      payment_date: singlePayForm.value.payment_date,
      payment_method: singlePayForm.value.payment_method,
      notes: singlePayForm.value.notes
    });
    uiStore.showSuccess('Salary payment recorded successfully');
    singlePayDialog.value = false;
  } catch (err) {
    uiStore.showError(err.response?.data?.message || 'Failed to process payment');
  } finally {
    submitting.value = false;
  }
};

const openBatchPayDialog = () => {
  if (selectedItems.value.length === 0) return;
  batchPayForm.value = {
    account_id: walletStore.accounts[0]?.id || null,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    notes: ''
  };
  batchPayDialog.value = true;
};

const submitBatchPayment = async () => {
  if (selectedItems.value.length === 0 || !batchPayForm.value.account_id) return;
  submitting.value = true;
  try {
    const ids = selectedItems.value.map(i => i.id);
    await salaryStore.payBatchSalary({
      salary_item_ids: ids,
      account_id: batchPayForm.value.account_id,
      payment_date: batchPayForm.value.payment_date,
      payment_method: batchPayForm.value.payment_method,
      notes: batchPayForm.value.notes
    });
    uiStore.showSuccess('Batch salary payment processed successfully');
    selectedItems.value = [];
    batchPayDialog.value = false;
  } catch (err) {
    uiStore.showError(err.response?.data?.message || 'Failed to process batch payment');
  } finally {
    submitting.value = false;
  }
};

const openHistoryDialog = async (item) => {
  activeItem.value = item;
  historyDialog.value = true;
  await salaryStore.fetchPaymentHistory(item.id);
};

const openBreakdownDialog = (item) => {
  activeItem.value = item;
  breakdownDialog.value = true;
};

// Utils
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB');
};

const getAccountLogo = (accName) => {
  return getBankLogo(accName);
};
</script>

<style scoped>
.custom-salary-table th {
  color: #4F4294 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

.custom-salary-table tr:hover td {
  background: rgba(79, 66, 148, 0.04) !important;
}

.clean-mini-input {
  border: 1px solid #D1C4E9;
  background: #FFFFFF;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 14px;
  width: 120px;
  outline: none;
  transition: border-color 0.2s;
}
.clean-mini-input:focus {
  border-color: #4F4294;
  box-shadow: 0 0 0 2px rgba(79, 66, 148, 0.15);
}

.clean-date-input {
  border: 1px solid #E0E0E0;
  background: #FFFFFF;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 13px;
  color: #333;
  outline: none;
}
.clean-date-input:focus {
  border-color: #4F4294;
}

.clean-notes-input {
  border: none;
  background: transparent;
  width: 100%;
  padding: 4px 6px;
  font-size: 13px;
  outline: none;
}

.hover-bg-grey:hover td {
  background: rgba(79, 66, 148, 0.02) !important;
}
</style>
